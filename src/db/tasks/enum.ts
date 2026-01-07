import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * 任务状态枚举
 * @enum
 * @member pending 待下载
 * @member downloading 下载中
 * @member downloaded 下载完成（待转码 或 待刮削）
 * @member transcoding 转码中
 * @member transcoded 转码完成（待刮削）
 * @member completed 已完成
 * @member failed 失败
 */

export const tasksStatusEnum = pgEnum('task_status', [
  'pending',
  'downloading',
  'downloaded',
  'transcoding',
  'transcoded',
  'completed',
  'failed'
]);
