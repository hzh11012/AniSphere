/**
 * 默认角色定义
 */
export const defaultRoles = [
  { name: '管理员', code: 'admin' },
  { name: '普通用户', code: 'user' },
  { name: '访客', code: 'guest' }
] as const;

/**
 * 默认权限定义
 * 格式: resource:action
 */
export const defaultPermissions = [
  // 用户管理
  { name: '查看用户', code: 'user:read' },
  { name: '创建用户', code: 'user:create' },
  { name: '更新用户', code: 'user:update' },
  { name: '删除用户', code: 'user:delete' },

  // 角色管理
  { name: '查看角色', code: 'role:read' },
  { name: '创建角色', code: 'role:create' },
  { name: '更新角色', code: 'role:update' },
  { name: '删除角色', code: 'role:delete' },

  // 权限管理
  { name: '查看权限', code: 'permission:read' },
  { name: '分配权限', code: 'permission:assign' },

  // 系统管理
  { name: '系统设置', code: 'system:settings' },
  { name: '查看日志', code: 'system:logs' }
] as const;

/**
 * 角色-权限映射
 * '*' 表示拥有所有权限
 */
export const rolePermissionMapping: Record<string, readonly string[]> = {
  admin: ['*'],
  user: ['user:read'],
  guest: [] // 访客无权限
};

export type RoleCode = (typeof defaultRoles)[number]['code'];
export type PermissionCode = (typeof defaultPermissions)[number]['code'];
