import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * 弹幕类型枚举
 * @enum
 * @member scroll 滚动弹幕
 * @member top 顶部弹幕
 * @member bottom 底部弹幕
 */
export const danmakuTypeEnum = pgEnum('danmaku_type', [
  'scroll',
  'top',
  'bottom'
]);
