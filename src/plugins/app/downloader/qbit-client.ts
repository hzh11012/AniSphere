import bencode from 'bencode';
import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { toResult } from '../../../utils/result.js';

export interface TorrentInfo {
  hash: string;
  name: string;
  progress: number;
  state: string;
  save_path: string;
  content_path: string;
  size: number;
}

export class QBitClient {
  private cookie: string | null = null;
  private cookieExpiry = 0;
  private loginPromise: Promise<void> | null = null;

  constructor(private readonly fastify: FastifyInstance) {}

  private get baseUrl() {
    return this.fastify.config.QBIT_HOST;
  }

  private get username() {
    return this.fastify.config.QBIT_USERNAME;
  }

  private get password() {
    return this.fastify.config.QBIT_PASSWORD;
  }

  private get downloadPath() {
    return this.fastify.config.QBIT_DOWNLOAD_PATH;
  }

  private async login(): Promise<void> {
    if (this.loginPromise) return this.loginPromise;

    this.loginPromise = (async () => {
      const response = await fetch(`${this.baseUrl}/api/v2/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          username: this.username,
          password: this.password
        }).toString()
      });

      if (!response.ok) {
        throw new Error(`qBittorrent login failed: ${response.status}`);
      }

      const text = await response.text();
      if (text.trim() !== 'Ok.') {
        throw new Error(`qBittorrent login failed: ${text}`);
      }

      const setCookie = response.headers.get('set-cookie');
      if (!setCookie) {
        throw new Error('qBittorrent login failed: no cookie returned');
      }

      // qBittorrent 通常只返回 SID
      this.cookie = setCookie
        .split(',')
        .map(c => c.split(';')[0])
        .join('; ');

      this.cookieExpiry = Date.now() + 60 * 60 * 1000;
    })();

    try {
      await this.loginPromise;
    } finally {
      this.loginPromise = null;
    }
  }

  private async ensureLoggedIn() {
    if (!this.cookie || Date.now() > this.cookieExpiry) {
      await this.login();
    }
  }

  private async fetchWithAuth<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    await this.ensureLoggedIn();

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        ...options.headers,
        Cookie: this.cookie!
      }
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`qBittorrent API error ${response.status}: ${text}`);
    }

    const contentType = response.headers.get('content-type');
    return contentType?.includes('application/json')
      ? (response.json() as Promise<T>)
      : ((await response.text()) as unknown as T);
  }

  /**
   * 从 .torrent URL 计算 info hash
   */
  private async calculateInfoHash(uri: string) {
    const response = await fetch(uri);
    if (!response.ok) {
      throw new Error(`下载种子文件失败: ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const torrent = bencode.decode(buffer) as { info?: unknown };

    if (!torrent.info) {
      throw new Error('无效的种子文件：缺少 info 字典');
    }

    const infoBuffer = bencode.encode(torrent.info);
    return crypto.createHash('sha1').update(infoBuffer).digest('hex');
  }

  /**
   * 添加下载
   * @param uri 种子链接
   * @param taskId 任务ID
   */
  async addTorrent(uri: string) {
    return toResult(
      (async () => {
        // 计算hash
        const hash = await this.calculateInfoHash(uri);

        // 检查种子是否已存在
        const torrents = await this.fetchWithAuth<TorrentInfo[]>(
          `/api/v2/torrents/info?hashes=${hash}`
        );
        if (torrents.length > 0) {
          throw new Error('种子已存在于 qBittorrent 中');
        }

        // 添加种子
        await this.fetchWithAuth<void>('/api/v2/torrents/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            urls: uri,
            savepath: this.downloadPath,
            ratioLimit: '0',
            seedingTimeLimit: '0'
          }).toString()
        });

        return hash;
      })()
    );
  }

  /**
   * 获取种子信息
   * @param hash 种子hash
   */
  getTorrentInfo(hash: string) {
    return toResult(
      this.fetchWithAuth<TorrentInfo[]>(
        `/api/v2/torrents/info?hashes=${hash}`
      ).then(torrents => torrents[0] ?? null)
    );
  }

  /**
   * 暂停种子
   * @param hash 种子 hash
   */
  async pauseTorrent(hash: string) {
    return toResult(
      this.fetchWithAuth<void>('/api/v2/torrents/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ hashes: hash.toLowerCase() }).toString()
      })
    );
  }

  /**
   * 恢复种子
   * @param hash 种子 hash
   */
  resumeTorrent(hash: string) {
    return toResult(
      this.fetchWithAuth<void>('/api/v2/torrents/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ hashes: hash.toLowerCase() }).toString()
      })
    );
  }

  /**
   * 删除种子
   * @param hash 种子 hash
   * @param deleteFiles 是否删除文件
   */
  deleteTorrent(hash: string, deleteFiles = false) {
    return toResult(
      this.fetchWithAuth<void>('/api/v2/torrents/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          hashes: hash.toLowerCase(),
          deleteFiles: String(deleteFiles)
        }).toString()
      })
    );
  }

  /**
   * 测试连接
   */
  testConnection() {
    return toResult(this.login().then(() => '连接成功'));
  }
}
