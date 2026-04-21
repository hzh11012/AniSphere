/**
 * 转义 SQL LIKE 通配符（% 和 _），防止用户输入被当作通配符。
 * 使用 \ 作为转义字符（PostgreSQL 默认）。
 */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, ch => `\\${ch}`);
}
