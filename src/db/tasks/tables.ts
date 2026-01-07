import {
  bigint,
  index,
  integer,
  pgTable,
  text,
  varchar
} from 'drizzle-orm/pg-core';
import { timestamps } from '../columns.helpers.js';
import { tasksStatusEnum } from './enum.js';

/** 任务表 */
export const tasksTable = pgTable(
  'tasks',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** 种子URL */
    torrentUrl: text('torrent_url').notNull(),
    /** 种子 Hash */
    torrentHash: varchar('torrent_hash', { length: 64 }),
    /** 任务状态 */
    status: tasksStatusEnum().notNull().default('pending'),

    // ===== 下载阶段 =====
    /** 原始下载路径（qBittorrent 下载位置） */
    downloadPath: varchar('download_path', { length: 500 }),
    /** 文件大小 (字节) */
    fileSize: bigint('file_size', { mode: 'number' }),
    /** 下载进度 (0-100) */
    downloadProgress: integer('download_progress').notNull().default(0),

    // ===== HLS 转码阶段 =====
    /** 转码临时输出目录 */
    transcodeTempDir: varchar('transcode_temp_dir', { length: 500 }),
    /** 转码进度 (0-100) */
    transcodeProgress: integer('transcode_progress').notNull().default(0),

    // ===== 错误处理 =====
    /** 错误信息 */
    errorMessage: text('error_message'),
    /** 失败时的状态 */
    failedAtStatus: varchar('failed_at_status', { length: 20 }),
    ...timestamps
  },
  table => [index('tasks_status_idx').on(table.status)]
);
