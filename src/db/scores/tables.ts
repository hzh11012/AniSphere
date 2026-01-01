import {
  boolean,
  index,
  integer,
  pgTable,
  smallint,
  text,
  unique
} from 'drizzle-orm/pg-core';
import { timestamps } from '../columns.helpers.js';
import { usersTable } from '../users/index.js';
import { animeTable } from '../anime/index.js';

/** 评分表 */
export const scoresTable = pgTable(
  'scores',
  {
    /** 评分ID */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** 用户ID (外键) */
    userId: integer('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    /** 动漫ID (外键) */
    animeId: integer('anime_id')
      .notNull()
      .references(() => animeTable.id, { onDelete: 'cascade' }),
    /** 评分分数 */
    score: smallint().notNull(),
    /** 评分内容 */
    content: text().notNull(),
    /** 评分状态 */
    status: boolean().notNull().default(false),
    ...timestamps
  },
  table => [
    unique('scores_user_anime_unique').on(table.userId, table.animeId),
    index('scores_user_id_idx').on(table.userId),
    index('scores_anime_id_idx').on(table.animeId),
    index('scores_status_idx').on(table.status)
  ]
);
