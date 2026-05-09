import { asc, desc, SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';

/**
 * 计算分页偏移量
 */
export function calcOffset(page: number, pageSize: number): number {
  return (page - 1) * pageSize;
}

/**
 * 构建排序条件（附带 tiebreaker 保证分页稳定）
 */
export function buildOrderBy(
  column: PgColumn,
  order: 'asc' | 'desc',
  tiebreaker?: PgColumn
): SQL | SQL[] {
  const primary = order === 'asc' ? asc(column) : desc(column);
  if (!tiebreaker) return primary;
  return [primary, order === 'asc' ? asc(tiebreaker) : desc(tiebreaker)];
}
