import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * 动漫状态枚举
 * @enum
 * @member draft 草稿
 * @member upcoming 即将开播
 * @member airing 连载中
 * @member completed 已完结
 */
export const animeStatusEnum = pgEnum('anime_status', [
  'draft',
  'upcoming',
  'airing',
  'completed'
]);

/**
 * 动漫类型枚举
 * @enum
 * @member movie 剧场版
 * @member japanese 日番
 * @member american 美漫
 * @member chinese 国创
 * @member adult 里作
 */
export const animeTypeEnum = pgEnum('anime_type', [
  'movie',
  'japanese',
  'american',
  'chinese',
  'adult'
]);

/**
 * 动漫月份枚举
 * @enum
 * @member january 1月番
 * @member april 4月番
 * @member july 7月番
 * @member october 10月番
 */
export const animeMonthEnum = pgEnum('anime_month', [
  'january',
  'april',
  'july',
  'october'
]);
