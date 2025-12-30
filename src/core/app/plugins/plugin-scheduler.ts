import cron, { type ScheduledTask } from 'node-cron';
import type { PluginService, TriggerType } from './plugin-types.js';
import type { FastifyBaseLogger } from 'fastify';

interface ScheduledJob {
  /** 插件ID */
  pluginId: string;
  /** 服务ID */
  serviceId: string;
  /** 定时任务 */
  task: ScheduledTask | NodeJS.Timeout;
  /** 触发器类型 */
  type: TriggerType;
  /** 触发器 */
  func: () => Promise<void> | void;
}

export class PluginScheduler {
  private static instance: PluginScheduler;
  private jobs: Map<string, ScheduledJob> = new Map();
  private timezone = 'Asia/Shanghai';
  private log: FastifyBaseLogger | null = null;

  private constructor() {}

  static getInstance() {
    return (PluginScheduler.instance ??= new PluginScheduler());
  }

  /**
   * 初始化定时调度器，设置时区
   * @param timezone 时区
   * @param log fastify 日志
   */
  init(timezone: string, log: FastifyBaseLogger) {
    this.timezone = timezone;
    this.log = log;
  }

  /**
   * 注册插件服务，根据触发器类型注册定时任务
   * @param pluginId 插件ID
   * @param services 服务数组
   */
  register(pluginId: string, services: PluginService[]) {
    this.remove(pluginId);

    for (const service of services) {
      const { id, trigger, triggerConfig, func } = service;
      const key = `${pluginId}:${id}`;

      if (trigger === 'cron') {
        const cronExpr = triggerConfig as string;
        if (!cron.validate(cronExpr)) {
          this.log?.error(
            { key, cronExpr },
            '[Plugin-Scheduler] invalid cron expression'
          );
          continue;
        }

        const task = cron.schedule(
          cronExpr,
          async () => {
            this.log?.info({ key }, '[Plugin-Scheduler] running cron job');

            try {
              await func();
            } catch (error) {
              this.log?.error(
                { key, error },
                '[Plugin-Scheduler] cron job error'
              );
            }
          },
          { timezone: this.timezone }
        );

        this.jobs.set(key, {
          pluginId,
          serviceId: id,
          task,
          type: trigger,
          func
        });
        this.log?.info({ key }, '[Plugin-Scheduler] registered cron job');
      } else if (trigger === 'interval') {
        const ms = triggerConfig as number;
        const task = setInterval(async () => {
          this.log?.info({ key }, '[Plugin-Scheduler] running interval job');

          try {
            await func();
          } catch (error) {
            this.log?.error(
              { key, error },
              '[Plugin-Scheduler] interval job error'
            );
          }
        }, ms);

        this.jobs.set(key, {
          pluginId,
          serviceId: id,
          task,
          type: trigger,
          func
        });
        this.log?.info({ key }, '[Plugin-Scheduler] registered interval job');
      }
    }
  }

  /**
   * 移除插件服务
   * @param pluginId 插件ID
   */
  remove(pluginId: string) {
    for (const [key, job] of this.jobs) {
      if (job.pluginId === pluginId) {
        if (job.type === 'cron') {
          (job.task as ScheduledTask).stop();
        } else {
          clearInterval(job.task as NodeJS.Timeout);
        }
        this.jobs.delete(key);
        this.log?.info({ key }, '[Plugin-Scheduler] removed cron job');
      }
    }
  }

  /**
   * 手动触发插件服务
   * @param pluginId 插件ID
   * @param serviceId 服务ID
   */
  async trigger(pluginId: string, serviceId: string): Promise<boolean> {
    const key = `${pluginId}:${serviceId}`;
    const job = this.jobs.get(key);
    if (job) {
      this.log?.info({ key }, '[Plugin-Scheduler] manually triggering job');
      await job?.func();
      return true;
    }
    return false;
  }

  /**
   * 获取所有插件服务
   */
  list() {
    return [...this.jobs.values()].map(j => ({
      pluginId: j.pluginId,
      serviceId: j.serviceId,
      type: j.type
    }));
  }

  /**
   * 停止所有插件服务
   */
  stopAll() {
    for (const [, job] of this.jobs) {
      if (job.type === 'cron') {
        (job.task as ScheduledTask).stop();
      } else {
        clearInterval(job.task as NodeJS.Timeout);
      }
    }
    this.jobs.clear();
    this.log?.info('[Plugin-Scheduler] All jobs stopped');
  }
}
