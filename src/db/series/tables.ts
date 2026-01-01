import { integer, pgTable, varchar } from 'drizzle-orm/pg-core';
import { timestamps } from '../columns.helpers.js';

/** 系列表 */
export const seriesTable = pgTable('series', {
  /** 系列ID */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /** 系列名 */
  name: varchar({ length: 100 }).notNull().unique(),
  ...timestamps
});
