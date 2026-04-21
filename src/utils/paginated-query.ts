import { asc, desc, SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';

/**
 * 计算分页偏移量
 */
export function calcOffset(page: number, pageSize: number): number {
  return (page - 1) * pageSize;
}

/**
 * 构建排序条件
 */
export function buildOrderBy(column: PgColumn, order: 'asc' | 'desc'): SQL {
  return order === 'asc' ? asc(column) : desc(column);
}
