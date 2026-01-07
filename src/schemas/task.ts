import { z } from 'zod';
import { IdSchema } from './common.js';

export const TaskSchema = z.object({
  torrentUrl: z.string().min(1)
});

export const DownloadSchema = z.object({
  id: IdSchema
});

export type TaskBody = z.infer<typeof TaskSchema>;

export type DownloadParams = z.infer<typeof DownloadSchema>;
