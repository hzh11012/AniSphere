import { Type } from '@sinclair/typebox';

export const StringSchema = Type.String({
  minLength: 1,
  maxLength: 255
});

export const EmailSchema = Type.String({
  format: 'email',
  minLength: 1,
  maxLength: 255
});

export const IdSchema = Type.Integer({ minimum: 1 });

export const MessageResponseSchema = Type.Object({
  message: Type.String()
});
