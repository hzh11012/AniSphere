import type { Redis } from 'ioredis';
import type { FastifyBaseLogger } from 'fastify';

/** 插件配置前缀key */
const PLUGIN_CONFIG_PREFIX = 'plugin:config:';
/** 已安装插件ID集合key */
const INSTALLED_PLUGINS_KEY = 'plugin:installed';

export class PluginConfigStore {
  private static instance: PluginConfigStore;
  private redis: Redis | null = null;
  private log: FastifyBaseLogger | null = null;

  private constructor() {}

  static getInstance() {
    return (PluginConfigStore.instance ??= new PluginConfigStore());
  }

  /**
   * 初始化插件配置存储
   * @param redis redis 实例
   * @param log fastify 日志
   */
  init(redis: Redis, log: FastifyBaseLogger) {
    this.redis = redis;
    this.log = log;
  }

  /**
   * 获取插件配置
   * @param pluginId 插件ID
   */
  async getConfig(pluginId: string) {
    if (!this.redis) return null;
    const data = await this.redis.get(`${PLUGIN_CONFIG_PREFIX}${pluginId}`);
    return data ? JSON.parse(data) : null;
  }

  /**
   * 保存插件配置
   * @param pluginId 插件ID
   * @param config 配置数据
   */
  async saveConfig(pluginId: string, config: Record<string, any>) {
    if (!this.redis) return;

    await this.redis.set(
      `${PLUGIN_CONFIG_PREFIX}${pluginId}`,
      JSON.stringify(config)
    );

    this.log?.info({ pluginId }, '[Plugin-Config-Store] saved plugin config');
  }

  /**
   * 删除插件配置
   * @param pluginId 插件ID
   */
  async deleteConfig(pluginId: string) {
    if (!this.redis) return;

    await this.redis.del(`${PLUGIN_CONFIG_PREFIX}${pluginId}`);

    this.log?.info({ pluginId }, '[Plugin-Config-Store] deleted plugin config');
  }

  /**
   * 获取已安装插件ID集合
   */
  async getInstalledPlugins(): Promise<string[]> {
    if (!this.redis) return [];

    return await this.redis.smembers(INSTALLED_PLUGINS_KEY);
  }

  /**
   * 添加插件到已安装插件ID集合
   * @param pluginId 插件ID
   * @returns
   */
  async addInstalledPlugin(pluginId: string) {
    if (!this.redis) return;

    const added = await this.redis.sadd(INSTALLED_PLUGINS_KEY, pluginId);

    if (added > 0) {
      this.log?.info(
        { pluginId },
        '[Plugin-Config-Store] added to installed list'
      );
    }
  }

  /**
   * 从已安装插件ID集合中移除插件
   * @param pluginId 插件ID
   */
  async removeInstalledPlugin(pluginId: string) {
    if (!this.redis) return;

    await this.redis.srem(INSTALLED_PLUGINS_KEY, pluginId);

    this.log?.info(
      { pluginId },
      '[Plugin-Config-Store] removed from installed list'
    );
  }

  /**
   * 检查插件是否已安装
   * @param pluginId 插件ID
   */
  async isInstalled(pluginId: string): Promise<boolean> {
    if (!this.redis) return false;

    return (await this.redis.sismember(INSTALLED_PLUGINS_KEY, pluginId)) === 1;
  }
}
