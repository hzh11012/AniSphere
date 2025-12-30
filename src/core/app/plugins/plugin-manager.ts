import type { FastifyInstance } from 'fastify';
import { join, resolve } from 'node:path';
import type { IPlugin, PluginApi, PluginMeta } from './plugin-types.js';
import { PluginScheduler } from './plugin-scheduler.js';
import { PluginMarket } from './plugin-market.js';
import { PluginConfigStore } from './plugin-config-store.js';

interface LoadedPlugin {
  instance: IPlugin;
  meta: PluginMeta;
  enabled: boolean;
  routes: Map<string, PluginApi>;
}

const pluginsDir = join(process.cwd(), 'src', 'plugins');

export class PluginManager {
  private static instance: PluginManager;
  private plugins: Map<string, LoadedPlugin> = new Map();
  private routerRegistered = false;
  private pluginsDir = pluginsDir;
  private fastify: FastifyInstance | null = null;
  private scheduler = PluginScheduler.getInstance();
  private market = PluginMarket.getInstance();
  private store = PluginConfigStore.getInstance();

  private constructor() {}

  static getInstance() {
    return (PluginManager.instance ??= new PluginManager());
  }

  /**
   * 初始化插件管理器
   * @param fastify Fastify 实例
   */
  async init(fastify: FastifyInstance) {
    this.fastify = fastify;

    const { redis, config, log } = fastify;

    // 初始化各个子模块
    this.scheduler.init(config.TZ, log);
    this.store.init(redis, log);
    this.market.init(this.pluginsDir, config.PLUGIN_MARKET_URL, log);

    // 加载已安装的插件
    const installed = await this.store.getInstalledPlugins();
    for (const pluginId of installed) {
      await this.load(pluginId);
    }

    // 只注册一次全局动态路由
    if (!this.routerRegistered) {
      this.registerDynamicRouter();
      this.routerRegistered = true;
    }

    fastify.log.info(
      `[Plugin-Manager] initialized with ${this.plugins.size} plugins`
    );
  }

  /**
   * 注册动态路由分发器
   * 所有插件 API 请求都通过这个入口
   */
  private registerDynamicRouter() {
    if (!this.fastify) return;

    // 匹配所有插件路由: /api/plugin/:pluginId/*
    this.fastify.all<{
      Params: { pluginId: string; '*': string };
    }>(
      '/api/plugin/:pluginId/*',
      {
        preHandler: [
          this.fastify.authenticate,
          this.fastify.rbac.requireRole('admin')
        ]
      },
      async (request, reply) => {
        const { pluginId } = request.params;
        const subPath = '/' + (request.params['*'] || '');
        const method = request.method as
          | 'GET'
          | 'POST'
          | 'PUT'
          | 'DELETE'
          | 'PATCH';

        // 查找插件
        const plugin = this.plugins.get(pluginId);
        if (!plugin) {
          return reply.notFound(`Plugin '${pluginId}' not found`);
        }

        if (!plugin.enabled) {
          return reply.badRequest(`Plugin '${pluginId}' is disabled`);
        }

        // 查找匹配的路由
        const routeKey = `${method}:${subPath}`;
        const route = plugin.routes.get(routeKey);

        if (!route) {
          return reply.notFound(
            `Route '${method} ${subPath}' not found in plugin '${pluginId}'`
          );
        }

        // 执行插件处理器
        return route.handler(request, reply);
      }
    );

    this.fastify.log.info(
      '[Plugin-Manager] Dynamic router registered at /api/plugin/:pluginId/*'
    );
  }

  /**
   * 插件加载
   * @param pluginId 插件ID
   */
  async load(pluginId: string): Promise<boolean> {
    if (!this.fastify) return false;

    try {
      const pluginPath = join(this.pluginsDir, pluginId, 'index.ts');

      // 获取插件 meta 信息
      const meta = await this.market.getLocalPluginMeta(pluginId);
      if (!meta) {
        this.fastify.log.error(
          { pluginId },
          '[Plugin-Manager] plugin meta.json not found'
        );
        return false;
      }

      // 动态加载插件
      const module = await import(
        `file://${resolve(pluginPath)}?t=${Date.now()}`
      );
      const PluginClass = module.default;

      if (!PluginClass) {
        this.fastify.log.error(
          { pluginId },
          '[Plugin-Manager] plugin has no default export'
        );
        return false;
      }

      // 实例化插件
      const instance: IPlugin = new PluginClass();
      const config = (await this.store.getConfig(meta.id)) || {};
      await instance.init(config, {
        log: this.fastify.log
      });

      // 保存插件信息
      this.plugins.set(pluginId, {
        instance,
        meta,
        enabled: instance.getState(),
        routes: new Map()
      });

      if (instance.getState()) {
        await this.activate(pluginId);
      }

      this.fastify.log.info(`[Plugin-Manager] plugin loaded`);
      return true;
    } catch (error) {
      this.fastify.log.error(
        { error, pluginId },
        `[Plugin-Manager] failed to load plugin`
      );
      return false;
    }
  }

  /**
   * 插件激活
   * @param pluginId 插件ID
   */
  private async activate(pluginId: string) {
    const plugin = this.plugins.get(pluginId);
    if (!plugin || !this.fastify) return;

    // 注册定时任务
    const services = plugin.instance.getService();
    if (services.length > 0) {
      this.scheduler.register(pluginId, services);
    }

    // 注册 API 路由
    const apis = plugin.instance.getApi();
    // 先清空，防止重复
    plugin.routes.clear();

    for (const api of apis) {
      const routeKey = `${api.method}:${api.path}`;
      plugin.routes.set(routeKey, api);
      this.fastify.log.info(
        `[Plugin-Manager] registered route: ${api.method} /api/plugin/${pluginId}${api.path}`
      );
    }

    plugin.enabled = true;
  }

  /**
   * 停用插件
   * - 停止插件实例
   * - 移除定时任务
   * - 清除路由配置
   * @param pluginId 插件ID
   */
  private async deactivate(pluginId: string) {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return;

    // 停止插件实例
    await plugin.instance.stop();

    // 移除定时任务
    this.scheduler.remove(pluginId);

    // 清除路由配置
    plugin.routes.clear();
    plugin.enabled = false;

    this.fastify?.log.info({ pluginId }, '[Plugin-Manager] plugin deactivated');
  }

  /**
   * 插件重载
   * @param pluginId 插件ID
   * @returns
   */
  async reload(pluginId: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      await this.deactivate(pluginId);
      this.plugins.delete(pluginId);
    }
    return this.load(pluginId);
  }

  /**
   * 插件安装
   * @param pluginId 插件ID
   */
  async install(pluginId: string) {
    // 检查是否已安装
    const existing = this.plugins.get(pluginId);
    if (existing) {
      return {
        success: false,
        message: `Plugin '${pluginId}' is already installed (v${existing.meta.version})`
      };
    }

    const result = await this.market.install(pluginId);
    if (!result.success) {
      return result;
    }

    await this.store.addInstalledPlugin(pluginId);
    await this.load(pluginId);

    this.fastify?.log.info({ pluginId }, '[Plugin-Manager] plugin installed');

    return {
      success: true,
      message: `Plugin '${pluginId}' installed successfully`
    };
  }

  /**
   * 升级插件
   * @param pluginId 插件ID
   * @param options 配置选项
   */
  async upgrade(pluginId: string) {
    const existing = this.plugins.get(pluginId);

    // 检查是否已安装
    if (!existing) {
      return {
        success: false,
        message: `Plugin '${pluginId}' is not installed`
      };
    }

    // 获取远程版本信息
    const remoteMeta = await this.market.getOnlinePluginMeta(pluginId);
    if (!remoteMeta) {
      return { success: false, message: 'Plugin not found in market' };
    }

    const localVersion = existing.meta.version;
    const remoteVersion = remoteMeta.version;

    if (localVersion === remoteVersion) {
      return {
        success: false,
        message: `Plugin '${pluginId}' is already at the latest version (v${localVersion})`
      };
    }

    // 执行升级
    this.fastify?.log.info(
      { pluginId, from: localVersion, to: remoteVersion },
      '[Plugin-Manager] upgrading plugin'
    );

    // 停用当前插件
    await this.deactivate(pluginId);
    this.plugins.delete(pluginId);

    // 下载新版本
    const result = await this.market.install(pluginId);
    if (!result.success) {
      // 升级失败，尝试恢复旧版本
      this.fastify?.log.error(
        { pluginId, error: result.message },
        '[Plugin-Manager] upgrade failed, attempting rollback'
      );
      await this.load(pluginId);
      return {
        success: false,
        message: `Upgrade failed: ${result.message}. Rolled back to v${localVersion}`
      };
    }

    // 加载新版本
    const loadSuccess = await this.load(pluginId);
    if (!loadSuccess) {
      return {
        success: false,
        message: `Failed to load upgraded plugin`
      };
    }

    this.fastify?.log.info(
      { pluginId, from: localVersion, to: remoteVersion },
      '[Plugin-Manager] plugin upgraded'
    );

    return {
      success: true,
      message: `Plugin '${pluginId}' upgraded successfully`
    };
  }

  /**
   * 插件卸载
   * @param pluginId 插件ID
   */
  async uninstall(pluginId: string) {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      await this.deactivate(pluginId);
      this.plugins.delete(pluginId);
    }
    await this.store.removeInstalledPlugin(pluginId);
    await this.store.deleteConfig(pluginId);
    return this.market.uninstall(pluginId);
  }

  /**
   * 插件配置更新
   * @param pluginId 插件ID
   * @param config 新配置
   */
  async updateConfig(
    pluginId: string,
    config: Record<string, any>
  ): Promise<boolean> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin || !this.fastify) return false;

    // 保存旧状态用于回滚
    const oldConfig = { ...plugin.instance.getConfig() };
    const wasEnabled = plugin.enabled;

    try {
      // 停用插件
      await this.deactivate(pluginId);

      // 使用新配置重新初始化;
      await plugin.instance.init(config, {
        log: this.fastify.log
      });

      // 如果插件状态为启用则激活
      if (plugin.instance.getState()) {
        await this.activate(pluginId);
      }

      // 所有操作成功后才持久化配置
      await this.store.saveConfig(pluginId, config);

      this.fastify.log.info(
        { pluginId },
        '[Plugin-Manager] config updated successfully'
      );

      return true;
    } catch (error) {
      // 回滚：恢复旧配置
      this.fastify.log.error(
        { pluginId, error },
        '[Plugin-Manager] config update failed, rolling back'
      );

      try {
        await plugin.instance.init(oldConfig, {
          log: this.fastify.log
        });

        if (wasEnabled) {
          await this.activate(pluginId);
        }

        this.fastify.log.info(
          { pluginId },
          '[Plugin-Manager] rollback successful'
        );
      } catch (rollbackError) {
        this.fastify.log.error(
          { pluginId, rollbackError },
          '[Plugin-Manager] rollback failed, plugin in error state'
        );
      }

      return false;
    }
  }

  /**
   * 获取本地已安装插件列表
   */
  getLocalPlugins() {
    return [...this.plugins.values()].map(p => ({
      meta: p.meta,
      enabled: p.enabled,
      installed: true
    }));
  }

  /**
   * 获取线上所有插件列表
   * @param force 是否强制更新
   */
  getOnlinePlugins(force = false) {
    return this.market.getOnlinePlugins(force);
  }

  /**
   * 获取插件实例
   * @param pluginId 插件ID
   */
  getPlugin(pluginId: string) {
    return this.plugins.get(pluginId)?.instance;
  }

  /**
   * 获取插件表单配置
   * @param pluginId 插件ID
   * @returns
   */
  getForm(pluginId: string) {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return null;
    return {
      form: plugin.instance.getForm(),
      config: plugin.instance.getConfig()
    };
  }

  /**
   * 获取定时调度器实例
   */
  getScheduler() {
    return this.scheduler;
  }

  /**
   * 停止全部插件服务
   */
  async stopAll() {
    for (const [pluginId] of this.plugins) {
      await this.deactivate(pluginId);
    }
  }
}
