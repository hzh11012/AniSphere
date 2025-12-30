import type { TSchema } from '@sinclair/typebox';
import type { FastifyBaseLogger, FastifyReply, FastifyRequest } from 'fastify';

export type TriggerType = 'cron' | 'interval';

/** 插件服务 */
export interface PluginService {
  /** 服务id */
  id: string;
  /** 服务名称 */
  name: string;
  /** 触发器类型 */
  trigger: TriggerType;
  /** 触发器配置 */
  triggerConfig: string | number;
  /** 执行函数 */
  func: () => Promise<void> | void;
}

/** 插件元信息 */
export interface PluginMeta {
  /** 插件id（唯一标识） */
  id: string;
  /** 插件名称 */
  name: string;
  /** 插件描述 */
  description: string;
  /** 插件标签 */
  tags: string[];
  /** 插件版本 */
  version: string;
  /** 插件图标 */
  icon: string;
  /** 插件作者 */
  author: string;
  /** 插件更新历史 */
  history: Record<string, string>;
}

/** 插件市场 插件远程响应信息 */
export interface PluginMarketResponseInfo {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string;
  type: 'file' | 'dir';
  _links: {
    self: string;
    git: string;
    html: string;
  };
}

/** 插件上下文 */
export interface PluginContext {
  /** fastify 日志实例 */
  log: FastifyBaseLogger;
}

/** 插件API */
export interface PluginApi {
  /** 路径 */
  path: string;
  /** 方法 */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** 处理器 */
  handler: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
  /** Schema 定义 */
  schema?: {
    body?: TSchema;
    querystring?: TSchema;
    params?: TSchema;
    headers?: TSchema;
    response?: Record<number, TSchema>;
  };
}

/** 插件表单字段 */
export interface PluginFormField {
  /** 字段名 */
  name: string;
  /** 字段标签 */
  label: string;
  /** 字段类型 */
  type: 'text' | 'number' | 'boolean' | 'select' | 'textarea' | 'cron';
  /** 是否必填 */
  required?: boolean;
  /** 默认值 */
  default?: any;
  /** 下拉选项 */
  options?: { label: string; value: string }[];
  /** 占位符 */
  placeholder?: string;
  /** 描述 */
  description?: string;
}

/** 插件接口 */
export interface IPlugin {
  init(
    config?: Record<string, any>,
    context?: PluginContext
  ): Promise<void> | void;
  stop(): Promise<void> | void;
  getState(): boolean;
  getService(): PluginService[];
  getApi(): PluginApi[];
  getForm(): { fields: PluginFormField[] };
  getConfig(): Record<string, any>;
}

/** 插件基类 */
export abstract class PluginBase implements IPlugin {
  protected config: Record<string, any> = {};
  protected enabled = false;
  protected log: FastifyBaseLogger | null = null;

  async init(config?: Record<string, any>, context?: PluginContext) {
    this.config = config || {};
    this.enabled = this.config.enabled ?? false;
    if (context) {
      this.log = context.log;
    }
  }

  async stop() {
    this.enabled = false;
  }

  getState(): boolean {
    return this.enabled;
  }

  getService(): PluginService[] {
    return [];
  }

  getApi(): PluginApi[] {
    return [];
  }

  getForm() {
    return { fields: [] as PluginFormField[] };
  }

  getConfig() {
    return this.config;
  }
}
