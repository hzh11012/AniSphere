import {
  index,
  integer,
  text,
  boolean,
  pgTable,
  varchar,
  pgEnum
} from 'drizzle-orm/pg-core';
import { timestamps } from '../columns.helpers.js';

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

/** 用户表 */
export const usersTable = pgTable(
  'users',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    name: varchar({ length: 255 }).notNull(),
    email: varchar({ length: 255 }).notNull().unique(),
    role: userRoleEnum().notNull().default('guest'),
    status: boolean().notNull().default(true),
    avatar: text(),
    ...timestamps
  },
  table => [
    index('users_name_idx').on(table.name),
    index('users_role_idx').on(table.role),
    index('users_status_idx').on(table.status)
  ]
);
