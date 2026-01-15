import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * 任务状态枚举
 * @enum
 * @member pending 待处理
 * @member transcoding 转码中
 * @member transcoded 转码完成
 * @member completed 已完成
 * @member failed 失败
 */
export const taskStatusEnum = pgEnum('task_status', [
  'pending',
  'transcoding',
  'transcoded',
  'completed',
  'failed'
]);
