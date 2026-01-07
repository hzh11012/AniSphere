import { z } from 'zod';
import { EmailSchema, IdSchema } from './common.js';

export const SendCodeSchema = z.object({
  email: EmailSchema
});

export type SendCodeBody = z.infer<typeof SendCodeSchema>;

export const LoginSchema = z.object({
  email: EmailSchema,
  code: z.string().length(6).regex(/^\d+$/)
});

export const UserInfoSchema = z.object({
  id: IdSchema,
  email: EmailSchema,
  name: z.string(),
  role: z.enum(['admin', 'premium', 'user', 'guest']),
  avatar: z.string().nullable()
});

export type LoginBody = z.infer<typeof LoginSchema>;
