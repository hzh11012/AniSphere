import { z } from 'zod';

/**
 * 文件树查询 Schema
 */
export const FileTreeQuerySchema = z.object({
  path: z.string().optional().default('')
});

export type FileTreeQuery = z.infer<typeof FileTreeQuerySchema>;

/**
 * 文件树节点
 */
export const FileTreeSchemaResponse = z.array(
  z.object({
    name: z.string(),
    path: z.string(),
    hasChildren: z.boolean()
  })
);
