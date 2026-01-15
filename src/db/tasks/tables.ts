import {
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  text,
  varchar
} from 'drizzle-orm/pg-core';
import { timestamps } from '../columns.helpers.js';
import { taskStatusEnum } from './enum.js';

/** 任务表 */
export const tasksTable = pgTable(
  'tasks',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),

    // === qBit 信息 ===
    /** 种子hash */
    torrentHash: varchar('torrent_hash', { length: 64 }).notNull(),
    /** 文件在种子中的索引 */
    fileIndex: integer('file_index').notNull(),

    // === 文件信息 ===
    /** 文件名 */
    filename: varchar('filename', { length: 500 }).notNull(),
    /** 下载后的完整路径 */
    filePath: varchar('file_path', { length: 1000 }).notNull(),
    /** 文件大小 (字节) */
    fileSize: bigint('file_size', { mode: 'number' }).notNull(),

    // === 状态信息 ===
    /** 是否需要转码（非 MP4 为 true） */
    needsTranscode: boolean('needs_transcode').notNull().default(false),
    /** 任务状态 */
    status: taskStatusEnum().notNull().default('pending'),
    /** 转码进度 (0-100) */
    transcodeProgress: integer('transcode_progress').notNull().default(0),
    /** 转码输出路径 */
    transcodeOutputPath: varchar('transcode_output_path', { length: 1000 }),

    // === 错误信息 ===
    /** 错误信息 */
    errorMessage: text('error_message'),
    ...timestamps
  },
  table => [
    index('tasks_status_idx').on(table.status),
    index('tasks_torrent_hash_idx').on(table.torrentHash)
  ]
);
