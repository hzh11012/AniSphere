import { z } from 'zod';
import { EmailSchema } from './common.js';

export const SendCodeSchema = z.object({
  email: EmailSchema
});

export type SendCodeBody = z.infer<typeof SendCodeSchema>;

export const LoginSchema = z.object({
  email: EmailSchema,
  code: z.string().length(6).regex(/^\d+$/)
});

export type LoginBody = z.infer<typeof LoginSchema>;
