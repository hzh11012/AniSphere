import { index, integer, pgTable, real, unique } from 'drizzle-orm/pg-core';
import { timestamps } from '../columns.helpers.js';
import { usersTable } from '../users/index.js';
import { videosTable } from '../videos/tables.js';

/** 历史记录表 */
export const historiesTable = pgTable(
  'histories',
  {
    /** 历史记录ID */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** 用户ID (外键) */
    userId: integer('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    /** 视频ID (外键) */
    videoId: integer('video_id')
      .notNull()
      .references(() => videosTable.id, { onDelete: 'cascade' }),
    /** 历史记录视频时间 */
    time: real('time').notNull(),
    ...timestamps
  },
  table => [
    unique('histories_user_video_unique').on(table.userId, table.videoId),
    index('histories_user_id_idx').on(table.userId),
    index('histories_video_id_idx').on(table.videoId)
  ]
);
