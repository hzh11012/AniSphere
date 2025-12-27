import {
  index,
  integer,
  text,
  boolean,
  pgTable,
  varchar,
  unique
} from 'drizzle-orm/pg-core';
import { timestamps } from '../columns.helpers.js';

// 用户表
const usersTable = pgTable(
  'users',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    name: varchar({ length: 255 }).notNull(),
    email: varchar({ length: 255 }).notNull().unique(),
    status: boolean().notNull().default(true),
    avatar: text(),
    ...timestamps
  },
  table => [
    index('users_name_idx').on(table.name),
    index('users_email_idx').on(table.email),
    index('users_status_idx').on(table.status)
  ]
);

// 角色表
const rolesTable = pgTable(
  'roles',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    name: varchar({ length: 100 }).notNull(),
    code: varchar({ length: 100 }).notNull().unique(),
    status: boolean().notNull().default(true),
    ...timestamps
  },
  table => [
    index('roles_code_idx').on(table.code),
    index('roles_status_idx').on(table.status)
  ]
);

// 权限表
const permissionsTable = pgTable(
  'permissions',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    name: varchar({ length: 100 }).notNull(),
    code: varchar({ length: 100 }).notNull().unique(),
    ...timestamps
  },
  table => [index('permissions_code_idx').on(table.code)]
);

// 用户-角色关联表
const userRolesTable = pgTable(
  'user_roles',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: integer('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'restrict' }),
    roleId: integer('role_id')
      .notNull()
      .references(() => rolesTable.id, { onDelete: 'restrict' }),
    ...timestamps
  },
  table => [
    unique('user_roles_unique').on(table.userId, table.roleId),
    index('user_roles_user_id_idx').on(table.userId),
    index('user_roles_role_id_idx').on(table.roleId)
  ]
);

// 角色-权限关联表
const rolePermissionsTable = pgTable(
  'role_permissions',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    roleId: integer('role_id')
      .notNull()
      .references(() => rolesTable.id, { onDelete: 'restrict' }),
    permissionId: integer('permission_id')
      .notNull()
      .references(() => permissionsTable.id, { onDelete: 'restrict' }),
    ...timestamps
  },
  table => [
    unique('role_permissions_unique').on(table.roleId, table.permissionId),
    index('role_permissions_role_id_idx').on(table.roleId),
    index('role_permissions_permission_id_idx').on(table.permissionId)
  ]
);

export {
  usersTable,
  rolesTable,
  permissionsTable,
  userRolesTable,
  rolePermissionsTable
};
