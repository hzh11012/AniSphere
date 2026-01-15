import { z } from 'zod';
import { PaginationQuerySchema } from './common.js';

export const AddTorrentSchema = z.object({
  torrentUrl: z.string().min(1)
});

export type AddTorrentBody = z.infer<typeof AddTorrentSchema>;

const TorrentStatus = [
  // 下载相关
  'downloading',
  'metaDL',
  'forcedDL',
  'stalledDL',
  'checkingDL',
  'queuedDL',
  'pausedDL',
  'allocating',
  // 做种相关
  'uploading',
  'forcedUP',
  'stalledUP',
  'checkingUP',
  'queuedUP',
  'pausedUP',
  // 其他
  'error',
  'missingFiles',
  'moving',
  'checkingResumeData',
  'unknown'
] as const;

export const TorrentListSchema = z.preprocess(
  val => val ?? {},
  z.object({
    ...PaginationQuerySchema,
    status: z.enum(TorrentStatus).optional(),
    sort: z.enum(['size', 'added_on']).default('added_on'),
    order: z.enum(['asc', 'desc']).default('desc')
  })
);

export const TorrentListSchemaResponse = z.object({
  items: z.array(
    z.object({
      name: z.string(),
      status: z.enum(TorrentStatus),
      progress: z.number(),
      size: z.number(),
      createdAt: z.date()
    })
  ),
  total: z.number()
});

export type TorrentListQuery = z.infer<typeof TorrentListSchema>;
