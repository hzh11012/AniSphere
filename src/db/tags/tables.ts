import { integer, pgTable, varchar } from 'drizzle-orm/pg-core';
import { timestamps } from '../columns.helpers.js';

/** 分类表 */
export const tagsTable = pgTable('tags', {
  /** 分类ID */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /** 分类名 */
  name: varchar({ length: 25 }).notNull().unique(),
  ...timestamps
});
