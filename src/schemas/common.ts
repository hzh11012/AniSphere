import { Type } from '@sinclair/typebox';

const MessageResponseSchema = Type.Object({
  message: Type.String()
});

export { MessageResponseSchema };
