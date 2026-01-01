import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * 用户角色枚举
 * @enum
 * @member admin 管理员
 * @member premium 高级用户
 * @member user 普通用户
 * @member guest 游客
 */
export const userRoleEnum = pgEnum('user_role', [
  'admin',
  'premium',
  'user',
  'guest'
]);
