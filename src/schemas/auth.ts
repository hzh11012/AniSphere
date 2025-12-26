import { Type } from '@sinclair/typebox';
import { EmailSchema } from './common.js';

export const SendCodeSchema = Type.Object({
  email: EmailSchema
});

export const LoginSchema = Type.Object({
  email: EmailSchema,
  code: Type.String({ pattern: '^[0-9]{6}$' })
});
