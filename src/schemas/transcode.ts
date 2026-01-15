import { z } from 'zod';
import { IdSchema } from './common.js';

export const TranscodeSchema = z.object({
  id: IdSchema
});

export type TranscodeBody = z.infer<typeof TranscodeSchema>;
