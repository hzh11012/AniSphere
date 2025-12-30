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

export const PaginationQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  pageSize: Type.Optional(
    Type.Integer({ minimum: 1, maximum: 100, default: 10 })
  )
});

export const ListResponseSchema = Type.Object({
  message: Type.String(),
  data: Type.Object({
    items: Type.Array(Type.Any()),
    total: Type.Integer()
  })
});
