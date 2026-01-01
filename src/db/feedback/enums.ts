import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * 反馈类型枚举
 * @enum
 * @member consultation 咨询
 * @member suggestion 建议
 * @member complaint 投诉
 * @member other 其他
 */
export const feedbackTypeEnum = pgEnum('feedback_type', [
  'consultation',
  'suggestion',
  'complaint',
  'other'
]);

/**
 * 反馈状态枚举
 * @enum
 * @member pending 待处理
 * @member processing 处理中
 * @member done 已完成
 */
export const feedbackStatusEnum = pgEnum('feedback_status', [
  'pending',
  'processing',
  'done'
]);
