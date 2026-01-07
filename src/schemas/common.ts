import { z } from 'zod';

/**
 * 邮箱 Schema
 */
export const EmailSchema = z.email().min(1).max(255);

/**
 * ID Schema
 */
export const IdSchema = z.coerce.number().min(0);

/**
 * 成功响应 Schema
 */
export const SuccessResponseSchema = <T extends z.ZodTypeAny>(
  dataSchema?: T
) => {
  const base = z.object({
    code: z.literal(200),
    message: z.string()
  });

  if (dataSchema) {
    return base.extend({ data: dataSchema });
  }
  return base;
};

/**
 * 分页查询 Schema
 */
export const PaginationQuerySchema = z.object({
  page: z.number().min(1).default(1).optional(),
  pageSize: z.number().min(1).max(50).default(10).optional()
});
