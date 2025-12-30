import type { FastifyBaseLogger } from 'fastify';
import { join } from 'node:path';
import type { PluginMarketResponseInfo, PluginMeta } from './plugin-types.js';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';

export class PluginMarket {
  private static instance: PluginMarket;
  private pluginsDir: string = '';
  private marketUrl: string = '';
  private cache = new Map<string, PluginMeta>();
  private cacheExpiry = 0;
  private log: FastifyBaseLogger | null = null;

  private constructor() {}

  static getInstance() {
    return (PluginMarket.instance ??= new PluginMarket());
  }

  /**
   * 初始化插件市场
   * @param pluginsDir 插件目录
   * @param marketUrl 插件市场源
   * @param log fastify log
   */
  init(pluginsDir: string, marketUrl: string, log: FastifyBaseLogger) {
    this.pluginsDir = pluginsDir;
    this.marketUrl = marketUrl;
    this.log = log;
  }

  /**
   * 获取线上插件列表（用于展示插件市场）
   * @param force 是否强制更新
   */
  async getOnlinePlugins(force = false) {
    if (!force && Date.now() < this.cacheExpiry && this.cache.size > 0) {
      return [...this.cache.values()];
    }

    this.cache.clear();
    try {
      const plugins = await this.fetchRepo(this.marketUrl);
      plugins.forEach(plugin => this.cache.set(plugin.id, plugin));
      this.log?.info(
        { url: this.marketUrl, count: plugins.length },
        '[Plugin-Market] fetched plugins from repo'
      );
    } catch (error) {
      this.log?.error(
        { error, url: this.marketUrl },
        '[Plugin-Market] failed to fetch repo'
      );
    }

    this.cacheExpiry = Date.now() + 60 * 60 * 1000; // 一小时缓存
    return [...this.cache.values()];
  }

  /**
   * 从远程仓库获取插件元数据
   * @param repoUrl 远程仓库地址
   */
  private async fetchRepo(repoUrl: string): Promise<PluginMeta[]> {
    const { user, repo } = this.parseGitHubUrl(repoUrl);
    const metaUrl = `https://raw.githubusercontent.com/${user}/${repo}/master/meta.json`;

    const res = await fetch(metaUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = (await res.json()) as Record<string, Omit<PluginMeta, 'id'>>;
    return Object.entries(data).map(([id, meta]) => {
      return {
        id,
        ...meta
      };
    });
  }

  /**
   * 从远程仓库获取单个插件的 meta 信息
   * @param pluginId 插件ID
   */
  private async fetchPluginMeta(pluginId: string): Promise<PluginMeta | null> {
    // 先检查缓存
    if (this.cache.has(pluginId)) {
      return this.cache.get(pluginId)!;
    }

    // 缓存没有，从远程获取
    try {
      const plugins = await this.fetchRepo(this.marketUrl);
      // 更新缓存
      plugins.forEach(meta => this.cache.set(meta.id, meta));
      this.cacheExpiry = Date.now() + 60 * 60 * 1000;

      return plugins.find(meta => meta.id === pluginId) || null;
    } catch (error) {
      this.log?.error(
        { error, pluginId },
        '[Plugin-Market] failed to fetch plugin meta'
      );
      return null;
    }
  }

  /**
   * 获取远程插件元信息
   * @param pluginId 插件ID
   */
  async getOnlinePluginMeta(pluginId: string) {
    return await this.fetchPluginMeta(pluginId);
  }

  /**
   * 解析 GitHub URL
   */
  private parseGitHubUrl(url: string): { user: string; repo: string } {
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) throw new Error(`Invalid GitHub URL: ${url}`);
    return { user: match[1], repo: match[2] };
  }

  /**
   * 安装插件到 plugins/{pluginId}/ 目录
   * @param pluginId 插件ID
   */
  async install(
    pluginId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // 获取插件 meta 信息
      const meta = await this.fetchPluginMeta(pluginId);
      if (!meta) {
        return { success: false, message: 'Plugin not found in market' };
      }

      // 解析远程仓库地址
      const { user, repo } = this.parseGitHubUrl(this.marketUrl);
      const apiUrl = `https://api.github.com/repos/${user}/${repo}/contents/plugins/${pluginId}`;
      const targetDir = join(this.pluginsDir, pluginId);

      // 下载插件到本地
      await this.downloadDir(apiUrl, targetDir);

      // 保存 meta 信息到本地
      await this.savePluginMeta(pluginId, meta);

      this.log?.info(
        { pluginId, targetDir },
        '[Plugin-Market] plugin installed'
      );
      return { success: true, message: 'Installed successfully' };
    } catch (error) {
      this.log?.error({ error, pluginId }, '[Plugin-Market] install failed');
      return { success: false, message: String(error) };
    }
  }

  /**
   * 保存插件 meta 信息到本地
   */
  private async savePluginMeta(
    pluginId: string,
    meta: PluginMeta
  ): Promise<void> {
    const metaPath = join(this.pluginsDir, pluginId, 'meta.json');
    await writeFile(metaPath, JSON.stringify(meta, null, 2));
  }

  /**
   * 从本地读取插件 meta 信息
   */
  async getLocalPluginMeta(pluginId: string): Promise<PluginMeta | null> {
    try {
      const metaPath = join(this.pluginsDir, pluginId, 'meta.json');
      const content = await readFile(metaPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      this.log?.error(
        { error, pluginId },
        '[Plugin-Market] failed to read local plugin meta'
      );
      return null;
    }
  }

  /**
   * 从远程仓库下载插件目录
   * @param apiUrl 插件目录远程地址
   * @param targetDir 插件目录本地地址
   */
  private async downloadDir(apiUrl: string, targetDir: string) {
    await mkdir(targetDir, { recursive: true });

    const res = await fetch(apiUrl, {
      headers: { Accept: 'application/vnd.github.v3+json' }
    });
    const files = (await res.json()) as PluginMarketResponseInfo[];

    if (!Array.isArray(files)) {
      throw new Error('Invalid GitHub API response');
    }

    for (const file of files) {
      if (file.type === 'file' && file.download_url) {
        const content = await (await fetch(file.download_url)).text();
        await writeFile(join(targetDir, file.name), content);
        this.log?.debug({ file: file.name }, '[Plugin-Market] downloaded file');
      } else if (file.type === 'dir') {
        await this.downloadDir(file.url, join(targetDir, file.name));
      }
    }
  }

  async uninstall(
    pluginId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const pluginDir = join(this.pluginsDir, pluginId);
      await rm(pluginDir, { recursive: true, force: true });
      this.log?.info({ pluginId }, '[Plugin-Market] uninstalled');
      return { success: true, message: 'Uninstalled successfully' };
    } catch (error) {
      this.log?.error({ error, pluginId }, '[Plugin-Market] uninstall failed');
      return { success: false, message: String(error) };
    }
  }
}
