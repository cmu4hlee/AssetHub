const express = require('express');
const router = express.Router();
const db = require('../config/database');
const logger = require('../config/logger');
const fs = require('fs').promises;
const path = require('path');
const { authenticate, requireSystemAdmin } = require('../middleware/auth');
const { auditLogger, logAudit } = require('../middleware/auditLogger');
const { addTenantFilter, getTenantId } = require('../middleware/tenant-filter');
const {
  filterMenuDefinitionsByTenantConfig,
  getModuleMenuDefinitions,
} = require('../services/module-menu.service');

function logRolesPermissionsError(message, error, req, context = {}) {
  // 记录完整的错误详情，包括 MySQL 特定字段，便于排查 500 错误根因
  const errorDetails = {
    error: error?.message || String(error || ''),
    code: error?.code || undefined,
    errno: error?.errno || undefined,
    sqlState: error?.sqlState || undefined,
    sqlMessage: error?.sqlMessage || undefined,
    sql: error?.sql || undefined,
    stack: error?.stack || undefined,
    tenantId: getTenantId(req) || null,
    userId: req?.user?.id || null,
    username: req?.user?.username || null,
    userRole: req?.user?.role || null,
    ...context,
  };
  logger.error(message, errorDetails);
  // 同时输出到控制台，确保即使文件日志未启用也能看到
  console.error(`[roles-permissions ERROR] ${message}:`, JSON.stringify(errorDetails, null, 2));
}

function validateRoleCode(roleCode) {
  return typeof roleCode === 'string' && /^[A-Za-z][A-Za-z0-9_-]*$/.test(roleCode.trim());
}

function isValidPermissionFormat(permission) {
  return (
    typeof permission === 'string' &&
    /^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)+$/.test(permission.trim())
  );
}

function normalizePermissions(permissions) {
  if (!Array.isArray(permissions)) {
    return [];
  }

  const normalized = permissions
    .filter(permission => typeof permission === 'string')
    .map(permission => permission.trim())
    .filter(Boolean);

  return Array.from(new Set(normalized));
}

// DDL 操作已完成标志（进程级别单次执行）
let menuTablesInitialized = false;
let permissionTablesInitialized = false;

async function ensurePermissionTablesExist(dbOrConnection) {
  if (permissionTablesInitialized) {
    return;
  }

  const executor = dbOrConnection.execute ? dbOrConnection : db;

  try {
    await executor.execute(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        role VARCHAR(50) NOT NULL COMMENT '角色代码',
        permission VARCHAR(100) NOT NULL COMMENT '权限标识',
        description VARCHAR(500) NULL COMMENT '权限描述',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_role_permission (role, permission),
        INDEX idx_role (role),
        INDEX idx_permission (permission)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色权限表'
    `);

    await executor.execute(`
      CREATE TABLE IF NOT EXISTS permission_definitions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        permission VARCHAR(100) NOT NULL UNIQUE COMMENT '权限标识',
        category VARCHAR(50) NOT NULL COMMENT '权限分类',
        name VARCHAR(100) NOT NULL COMMENT '权限名称',
        description VARCHAR(500) NULL COMMENT '权限描述',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_category (category)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='权限定义表'
    `);

    const [existingPerms] = await executor.execute('SELECT COUNT(*) as count FROM permission_definitions');
    if (existingPerms[0].count === 0) {
      const defaultPermissions = [
        { permission: 'asset.view_all', category: 'asset', name: '查看所有资产', description: '查看所有资产' },
        { permission: 'asset.view_own_department', category: 'asset', name: '查看本科室资产', description: '查看本科室资产' },
        { permission: 'asset.add', category: 'asset', name: '添加资产', description: '添加资产' },
        { permission: 'asset.edit_all', category: 'asset', name: '编辑所有资产', description: '编辑所有资产' },
        { permission: 'asset.edit_own_department', category: 'asset', name: '编辑本科室资产', description: '编辑本科室资产' },
        { permission: 'asset.delete_all', category: 'asset', name: '删除所有资产', description: '删除所有资产' },
        { permission: 'asset.delete_own_department', category: 'asset', name: '删除本科室资产', description: '删除本科室资产' },
        { permission: 'asset.import', category: 'asset', name: '导入资产', description: '导入资产' },
        { permission: 'asset.export', category: 'asset', name: '导出资产', description: '导出资产' },
        { permission: 'image.upload', category: 'image', name: '上传资产图片', description: '上传资产图片' },
        { permission: 'image.delete', category: 'image', name: '删除资产图片', description: '删除资产图片' },
        { permission: 'image.view', category: 'image', name: '查看资产图片', description: '查看资产图片' },
        { permission: 'document.upload', category: 'document', name: '上传技术资料', description: '上传技术资料' },
        { permission: 'document.download', category: 'document', name: '下载技术资料', description: '下载技术资料' },
        { permission: 'document.delete', category: 'document', name: '删除技术资料', description: '删除技术资料' },
        { permission: 'document.link', category: 'document', name: '关联技术资料', description: '关联技术资料' },
        { permission: 'document.unlink', category: 'document', name: '取消关联技术资料', description: '取消关联技术资料' },
        { permission: 'document.review', category: 'document', name: '审核技术资料', description: '审核技术资料' },
        { permission: 'maintenance.view', category: 'maintenance', name: '查看维护日志', description: '查看维护日志' },
        { permission: 'maintenance.add', category: 'maintenance', name: '添加维护日志', description: '添加维护日志' },
        { permission: 'maintenance.edit', category: 'maintenance', name: '编辑维护日志', description: '编辑维护日志' },
        { permission: 'maintenance.delete', category: 'maintenance', name: '删除维护日志', description: '删除维护日志' },
        { permission: 'user.view', category: 'user', name: '查看用户列表', description: '查看用户列表' },
        { permission: 'user.add', category: 'user', name: '添加用户', description: '添加用户' },
        { permission: 'user.edit', category: 'user', name: '编辑用户', description: '编辑用户' },
        { permission: 'user.delete', category: 'user', name: '删除用户', description: '删除用户' },
        { permission: 'user.manage_role', category: 'user', name: '管理用户角色', description: '管理用户角色' },
        { permission: 'role.view', category: 'role', name: '查看角色列表', description: '查看角色列表' },
        { permission: 'role.add', category: 'role', name: '添加角色', description: '添加角色' },
        { permission: 'role.edit', category: 'role', name: '编辑角色', description: '编辑角色' },
        { permission: 'role.delete', category: 'role', name: '删除角色', description: '删除角色' },
        { permission: 'role.manage_permissions', category: 'role', name: '管理角色权限', description: '管理角色权限' },
        { permission: 'department.view', category: 'department', name: '查看科室列表', description: '查看科室列表' },
        { permission: 'department.add', category: 'department', name: '添加科室', description: '添加科室' },
        { permission: 'department.edit', category: 'department', name: '编辑科室', description: '编辑科室' },
        { permission: 'department.delete', category: 'department', name: '删除科室', description: '删除科室' },
        { permission: 'statistics.view', category: 'statistics', name: '查看统计信息', description: '查看统计信息' },
        { permission: 'statistics.export', category: 'statistics', name: '导出统计报表', description: '导出统计报表' },
        { permission: 'system.backup', category: 'system', name: '系统备份', description: '系统备份' },
        { permission: 'system.restore', category: 'system', name: '系统恢复', description: '系统恢复' },
        { permission: 'system.config', category: 'system', name: '系统配置', description: '系统配置' },
        { permission: 'system.audit_log', category: 'system', name: '查看审计日志', description: '查看审计日志' },
        { permission: 'transfer.view', category: 'transfer', name: '查看调配记录', description: '查看调配记录' },
        { permission: 'transfer.apply', category: 'transfer', name: '申请调配', description: '申请调配' },
        { permission: 'transfer.approve', category: 'transfer', name: '审批调配', description: '审批调配' },
        { permission: 'transfer.complete', category: 'transfer', name: '完成调配', description: '完成调配' },
        { permission: 'inventory.view', category: 'inventory', name: '查看盘点记录', description: '查看盘点记录' },
        { permission: 'inventory.create', category: 'inventory', name: '创建盘点', description: '创建盘点' },
        { permission: 'inventory.edit', category: 'inventory', name: '编辑盘点', description: '编辑盘点' },
        { permission: 'inventory.delete', category: 'inventory', name: '删除盘点', description: '删除盘点' },
      ];

      for (const perm of defaultPermissions) {
        await executor.execute(
          'INSERT INTO permission_definitions (permission, category, name, description) VALUES (?, ?, ?, ?)',
          [perm.permission, perm.category, perm.name, perm.description],
        );
      }
    }

    permissionTablesInitialized = true;
    logger.info('权限系统表初始化完成');
  } catch (error) {
    logger.error('初始化权限系统表失败', { error: error.message });
    throw error;
  }
}

// 创建菜单权限表的辅助函数
async function createMenuPermissionsTables() {
  // 1. 创建菜单定义表
  await db.execute(`
    CREATE TABLE IF NOT EXISTS menu_definitions (
      id INT PRIMARY KEY AUTO_INCREMENT,
      menu_key VARCHAR(100) NOT NULL UNIQUE COMMENT '菜单键（如：/dashboard）',
      menu_label VARCHAR(100) NOT NULL COMMENT '菜单名称（如：仪表盘）',
      parent_key VARCHAR(100) NULL COMMENT '父菜单键（如果是子菜单）',
      icon VARCHAR(50) NULL COMMENT '图标名称',
      order_index INT DEFAULT 0 COMMENT '排序索引',
      is_active TINYINT(1) DEFAULT 1 COMMENT '是否启用',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT NULL,
      INDEX idx_parent_key (parent_key),
      INDEX idx_order_index (order_index)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='菜单定义表'
  `);

  // 2. 创建角色菜单权限表
  await db.execute(`
    CREATE TABLE IF NOT EXISTS role_menu_permissions (
      id INT PRIMARY KEY AUTO_INCREMENT,
      role VARCHAR(50) NOT NULL COMMENT '角色代码',
      menu_key VARCHAR(100) NOT NULL COMMENT '菜单键',
      is_visible TINYINT(1) DEFAULT 1 COMMENT '是否可见（1=可见，0=不可见）',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT NULL,
      UNIQUE KEY uk_role_menu (role, menu_key),
      INDEX idx_role (role),
      INDEX idx_menu_key (menu_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色菜单权限表'
  `);

  // 3. 插入/更新默认菜单（使用 ON DUPLICATE KEY UPDATE 确保菜单始终存在）
  // 注意：这里总是执行插入/更新，不检查表是否为空，确保质量管理菜单始终存在
  const defaultMenus = [
    // 一级菜单
    {
      menu_key: '/dashboard',
      menu_label: '仪表盘',
      parent_key: null,
      icon: 'DashboardOutlined',
      order_index: 1,
    },
    {
      menu_key: '/assets-parent',
      menu_label: '资产管理',
      parent_key: null,
      icon: 'AppstoreOutlined',
      order_index: 2,
    },
    {
      menu_key: '/ai-tools-parent',
      menu_label: 'AI工具',
      parent_key: null,
      icon: 'RobotOutlined',
      order_index: 3,
    },
    {
      menu_key: '/transfer-parent',
      menu_label: '资产调配',
      parent_key: null,
      icon: 'SwapOutlined',
      order_index: 4,
    },
    {
      menu_key: '/idle',
      menu_label: '闲置资产',
      parent_key: null,
      icon: 'GiftOutlined',
      order_index: 5,
    },
    {
      menu_key: '/maintenance-parent',
      menu_label: '维修维护',
      parent_key: null,
      icon: 'ToolOutlined',
      order_index: 6,
    },
    {
      menu_key: '/asset-monitoring-parent',
      menu_label: '资产定位',
      parent_key: null,
      icon: 'EnvironmentOutlined',
      order_index: 7,
    },
    {
      menu_key: '/technical-documents-parent',
      menu_label: '技术资料',
      parent_key: null,
      icon: 'FileTextOutlined',
      order_index: 8,
    },
    {
      menu_key: '/quality-control-parent',
      menu_label: '质量管理',
      parent_key: null,
      icon: 'ExperimentOutlined',
      order_index: 9,
    },
    {
      menu_key: '/acceptance-parent',
      menu_label: '验收管理',
      parent_key: null,
      icon: 'CheckCircleOutlined',
      order_index: 10,
    },
    {
      menu_key: '/depreciation-parent',
      menu_label: '折旧管理',
      parent_key: null,
      icon: 'DollarOutlined',
      order_index: 11,
    },
    {
      menu_key: '/modules',
      menu_label: '模块管理',
      parent_key: null,
      icon: 'AppstoreOutlined',
      order_index: 12,
    },
    {
      menu_key: '/system-parent',
      menu_label: '系统管理',
      parent_key: null,
      icon: 'SettingOutlined',
      order_index: 13,
    },

    // 资产管理子菜单
    {
      menu_key: '/assets',
      menu_label: '资产列表',
      parent_key: '/assets-parent',
      icon: null,
      order_index: 1,
    },
    {
      menu_key: '/assets/add',
      menu_label: '添加资产',
      parent_key: '/assets-parent',
      icon: null,
      order_index: 2,
    },
    {
      menu_key: '/inventory',
      menu_label: '资产盘点',
      parent_key: '/assets-parent',
      icon: null,
      order_index: 3,
    },
    {
      menu_key: '/inventory/self',
      menu_label: '我的资产盘点',
      parent_key: '/assets-parent',
      icon: null,
      order_index: 4,
    },
    {
      menu_key: '/temp-assets',
      menu_label: '临时资产',
      parent_key: '/assets-parent',
      icon: null,
      order_index: 6,
    },
    {
      menu_key: '/asset-labels/templates',
      menu_label: '标签模板管理',
      parent_key: '/assets-parent',
      icon: null,
      order_index: 5,
    },
    {
      menu_key: '/asset-labels/print',
      menu_label: '标签打印',
      parent_key: '/assets-parent',
      icon: null,
      order_index: 6,
    },
    {
      menu_key: '/assets/import',
      menu_label: '导入资产',
      parent_key: '/assets-parent',
      icon: null,
      order_index: 7,
    },

    // 折旧管理子菜单
    {
      menu_key: '/depreciation',
      menu_label: '资产折旧',
      parent_key: '/depreciation-parent',
      icon: null,
      order_index: 1,
    },
    {
      menu_key: '/asset-depreciation',
      menu_label: '资产折旧（兼容路径）',
      parent_key: '/depreciation-parent',
      icon: null,
      order_index: 2,
    },

    // AI工具子菜单
    {
      menu_key: '/ai-question-records',
      menu_label: '提问记录',
      parent_key: '/ai-tools-parent',
      icon: null,
      order_index: 1,
    },
    {
      menu_key: '/ai-maintenance',
      menu_label: 'AI助手',
      parent_key: '/ai-tools-parent',
      icon: null,
      order_index: 2,
    },

    // 资产调配子菜单
    {
      menu_key: '/transfer',
      menu_label: '调配记录',
      parent_key: '/transfer-parent',
      icon: null,
      order_index: 1,
    },
    {
      menu_key: '/transfer/new',
      menu_label: '调配申请',
      parent_key: '/transfer-parent',
      icon: null,
      order_index: 2,
    },
    {
      menu_key: '/transfer/requests',
      menu_label: '调配申请处理',
      parent_key: '/transfer-parent',
      icon: null,
      order_index: 3,
    },

    // 维修维护子菜单
    {
      menu_key: '/maintenance/logs',
      menu_label: '维修日志',
      parent_key: '/maintenance-parent',
      icon: null,
      order_index: 1,
    },
    {
      menu_key: '/maintenance/plans',
      menu_label: '预防性维护',
      parent_key: '/maintenance-parent',
      icon: null,
      order_index: 2,
    },
    {
      menu_key: '/maintenance/templates',
      menu_label: '维护计划模板',
      parent_key: '/maintenance-parent',
      icon: null,
      order_index: 3,
    },
    {
      menu_key: '/maintenance/requests',
      menu_label: '维修申请',
      parent_key: '/maintenance-parent',
      icon: null,
      order_index: 4,
    },
    {
      menu_key: '/maintenance/efficiency',
      menu_label: '维护效率分析',
      parent_key: '/maintenance-parent',
      icon: null,
      order_index: 5,
    },
    {
      menu_key: '/maintenance/reminders',
      menu_label: '维护提醒管理',
      parent_key: '/maintenance-parent',
      icon: null,
      order_index: 6,
    },
    {
      menu_key: '/maintenance/usage-triggers',
      menu_label: '阈值触发管理',
      parent_key: '/maintenance-parent',
      icon: null,
      order_index: 7,
    },
    {
      menu_key: '/maintenance/asset-usage',
      menu_label: '资产使用量管理',
      parent_key: '/maintenance-parent',
      icon: null,
      order_index: 8,
    },
    {
      menu_key: '/maintenance/workorders',
      menu_label: '维护工单',
      parent_key: '/maintenance-parent',
      icon: null,
      order_index: 9,
    },

    // 资产定位子菜单
    {
      menu_key: '/asset-location',
      menu_label: '地理定位',
      parent_key: '/asset-monitoring-parent',
      icon: null,
      order_index: 1,
    },
    {
      menu_key: '/beacon-location',
      menu_label: '区域定位',
      parent_key: '/asset-monitoring-parent',
      icon: null,
      order_index: 2,
    },
    {
      menu_key: '/iot-devices',
      menu_label: '区域定位配置',
      parent_key: '/asset-monitoring-parent',
      icon: null,
      order_index: 3,
    },

    // 技术资料子菜单
    {
      menu_key: '/technical-documents',
      menu_label: '资料列表',
      parent_key: '/technical-documents-parent',
      icon: null,
      order_index: 1,
    },
    {
      menu_key: '/technical-documents/ai',
      menu_label: 'AI智能助手',
      parent_key: '/technical-documents-parent',
      icon: null,
      order_index: 2,
    },
    {
      menu_key: '/technical-documents/batch-upload',
      menu_label: '资料批量上传',
      parent_key: '/technical-documents-parent',
      icon: null,
      order_index: 3,
    },
    {
      menu_key: '/technical-documents/review',
      menu_label: '资料审核',
      parent_key: '/technical-documents-parent',
      icon: null,
      order_index: 4,
    },

    // 质量管理子菜单
    {
      menu_key: '/quality-control/metrology',
      menu_label: '计量管理',
      parent_key: '/quality-control-parent',
      icon: null,
      order_index: 1,
    },
    {
      menu_key: '/quality-control/metrology/upload',
      menu_label: '报告智能识别',
      parent_key: '/quality-control-parent',
      icon: null,
      order_index: 2,
    },
    {
      menu_key: '/quality-control/qc',
      menu_label: '质控管理',
      parent_key: '/quality-control-parent',
      icon: null,
      order_index: 3,
    },
    {
      menu_key: '/quality-control/statistics',
      menu_label: '统计分析',
      parent_key: '/quality-control-parent',
      icon: null,
      order_index: 4,
    },
    {
      menu_key: '/adverse-reaction',
      menu_label: '不良事件管理',
      parent_key: '/quality-control-parent',
      icon: null,
      order_index: 5,
    },

    // 验收管理子菜单
    {
      menu_key: '/acceptance',
      menu_label: '验收记录',
      parent_key: '/acceptance-parent',
      icon: null,
      order_index: 1,
    },
    {
      menu_key: '/acceptance/create',
      menu_label: '创建验收记录',
      parent_key: '/acceptance-parent',
      icon: null,
      order_index: 2,
    },

    // 系统管理子菜单
    {
      menu_key: '/tenants',
      menu_label: '企业管理',
      parent_key: '/system-parent',
      icon: null,
      order_index: 1,
    },
    {
      menu_key: '/users',
      menu_label: '用户管理',
      parent_key: '/system-parent',
      icon: null,
      order_index: 2,
    },
    {
      menu_key: '/departments',
      menu_label: '部门管理',
      parent_key: '/system-parent',
      icon: null,
      order_index: 3,
    },
    {
      menu_key: '/roles-permissions',
      menu_label: '角色和权限管理',
      parent_key: '/system-parent',
      icon: null,
      order_index: 4,
    },
    {
      menu_key: '/dashboard-configs',
      menu_label: '仪表盘配置',
      parent_key: '/system-parent',
      icon: null,
      order_index: 5,
    },
    {
      menu_key: '/cloud-sync',
      menu_label: '云/IoT 同步',
      parent_key: '/system-parent',
      icon: null,
      order_index: 6,
    },
    {
      menu_key: '/audit-logs',
      menu_label: '操作日志',
      parent_key: '/system-parent',
      icon: null,
      order_index: 7,
    },
    {
      menu_key: '/backup',
      menu_label: '数据库备份',
      parent_key: '/system-parent',
      icon: null,
      order_index: 10,
    },
    {
      menu_key: '/database-connection',
      menu_label: '数据库连接管理',
      parent_key: '/system-parent',
      icon: null,
      order_index: 11,
    },
    {
      menu_key: '/api-docs',
      menu_label: 'Swagger API 文档',
      parent_key: '/system-parent',
      icon: null,
      order_index: 12,
    },
    {
      menu_key: '/api-documentation',
      menu_label: '完整API文档',
      parent_key: '/system-parent',
      icon: null,
      order_index: 13,
    },
  ];

  const insertMenuSQL = `
      INSERT INTO menu_definitions (menu_key, menu_label, parent_key, icon, order_index, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
      ON DUPLICATE KEY UPDATE
        menu_label = VALUES(menu_label),
        parent_key = VALUES(parent_key),
        icon = VALUES(icon),
        order_index = VALUES(order_index),
        updated_at = CURRENT_TIMESTAMP
    `;

  for (const menu of defaultMenus) {
    await db.execute(insertMenuSQL, [
      menu.menu_key,
      menu.menu_label,
      menu.parent_key,
      menu.icon,
      menu.order_index,
    ]);
  }

  // 4. 设置默认菜单权限：为不同角色分配合理的默认菜单权限
  const [menus] = await db.execute('SELECT menu_key FROM menu_definitions');
  const [roles] = await db.execute('SELECT role_code FROM roles');

  // 基于实际工作岗位的菜单权限映射（领域驱动，覆盖 menu_definitions 全量菜单）
  // 逻辑集中在 routes/role-menu-map.js，与一次性脚本 apply-role-menu-config.js 共用，避免漂移。
  const roleMenuPermissions = require('./role-menu-map').buildRoleMenuPermissions();

  for (const role of roles) {
    const roleCode = role.role_code;
    for (const menu of menus) {
      const menuKey = menu.menu_key;
      let isVisible = 0;

      // 根据角色获取默认菜单权限
      if (typeof roleMenuPermissions[roleCode] === 'number') {
        isVisible = roleMenuPermissions[roleCode];
      } else if (typeof roleMenuPermissions[roleCode] === 'function') {
        isVisible = roleMenuPermissions[roleCode](menuKey);
      }

      await db.execute(
        `
            INSERT INTO role_menu_permissions (role, menu_key, is_visible)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE is_visible = VALUES(is_visible)
          `,
        [roleCode, menuKey, isVisible],
      );
    }
  }
}

// 强制更新所有菜单定义（包括质量管理菜单）
async function forceUpdateMenus() {
  try {
    // 确保表存在
    await db.execute(`
      CREATE TABLE IF NOT EXISTS menu_definitions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        menu_key VARCHAR(100) NOT NULL UNIQUE COMMENT '菜单键（如：/dashboard）',
        menu_label VARCHAR(100) NOT NULL COMMENT '菜单名称（如：仪表盘）',
        parent_key VARCHAR(100) NULL COMMENT '父菜单键（如果是子菜单）',
        icon VARCHAR(50) NULL COMMENT '图标名称',
        order_index INT DEFAULT 0 COMMENT '排序索引',
        is_active TINYINT(1) DEFAULT 1 COMMENT '是否启用',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT NULL,
        INDEX idx_parent_key (parent_key),
        INDEX idx_order_index (order_index)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='菜单定义表'
    `);

    // 清理已移除的菜单
    try {
      await db.execute('DELETE FROM menu_definitions WHERE menu_key = ?', ['/dashboards']);
    } catch (cleanupError) {
      if (cleanupError.code !== 'ER_NO_SUCH_TABLE') {
        throw cleanupError;
      }
    }
    try {
      await db.execute('DELETE FROM role_menu_permissions WHERE menu_key = ?', ['/dashboards']);
    } catch (cleanupError) {
      if (cleanupError.code !== 'ER_NO_SUCH_TABLE') {
        throw cleanupError;
      }
    }

    // 所有默认菜单（包括质量管理）
    const defaultMenus = [
      // 一级菜单
      {
        menu_key: '/dashboard',
        menu_label: '仪表盘',
        parent_key: null,
        icon: 'DashboardOutlined',
        order_index: 1,
      },
      {
        menu_key: '/assets-parent',
        menu_label: '资产管理',
        parent_key: null,
        icon: 'AppstoreOutlined',
        order_index: 2,
      },
      {
        menu_key: '/ai-tools-parent',
        menu_label: 'AI工具',
        parent_key: null,
        icon: 'RobotOutlined',
        order_index: 3,
      },
      {
        menu_key: '/transfer-parent',
        menu_label: '资产调配',
        parent_key: null,
        icon: 'SwapOutlined',
        order_index: 4,
      },
      {
        menu_key: '/idle',
        menu_label: '闲置资产',
        parent_key: null,
        icon: 'GiftOutlined',
        order_index: 5,
      },
      {
        menu_key: '/maintenance-parent',
        menu_label: '维修维护',
        parent_key: null,
        icon: 'ToolOutlined',
        order_index: 6,
      },
      {
        menu_key: '/asset-monitoring-parent',
        menu_label: '资产定位',
        parent_key: null,
        icon: 'EnvironmentOutlined',
        order_index: 7,
      },
      {
        menu_key: '/technical-documents-parent',
        menu_label: '技术资料',
        parent_key: null,
        icon: 'FileTextOutlined',
        order_index: 8,
      },
      {
        menu_key: '/quality-control-parent',
        menu_label: '质量管理',
        parent_key: null,
        icon: 'ExperimentOutlined',
        order_index: 9,
      },
      {
        menu_key: '/acceptance-parent',
        menu_label: '验收管理',
        parent_key: null,
        icon: 'CheckCircleOutlined',
        order_index: 10,
      },
      {
        menu_key: '/depreciation-parent',
        menu_label: '折旧管理',
        parent_key: null,
        icon: 'DollarOutlined',
        order_index: 11,
      },
      {
        menu_key: '/modules',
        menu_label: '模块管理',
        parent_key: null,
        icon: 'AppstoreOutlined',
        order_index: 12,
      },
      {
        menu_key: '/system-parent',
        menu_label: '系统管理',
        parent_key: null,
        icon: 'SettingOutlined',
        order_index: 13,
      },

      // 资产管理子菜单
      {
        menu_key: '/assets',
        menu_label: '资产列表',
        parent_key: '/assets-parent',
        icon: null,
        order_index: 1,
      },
      {
        menu_key: '/assets/add',
        menu_label: '添加资产',
        parent_key: '/assets-parent',
        icon: null,
        order_index: 2,
      },
      {
        menu_key: '/inventory',
        menu_label: '资产盘点',
        parent_key: '/assets-parent',
        icon: null,
        order_index: 3,
      },
      {
        menu_key: '/inventory/self',
        menu_label: '我的资产盘点',
        parent_key: '/assets-parent',
        icon: null,
        order_index: 4,
      },
      {
        menu_key: '/temp-assets',
        menu_label: '临时资产',
        parent_key: '/assets-parent',
        icon: null,
        order_index: 6,
      },
      {
        menu_key: '/asset-labels/templates',
        menu_label: '标签模板管理',
        parent_key: '/assets-parent',
        icon: null,
        order_index: 5,
      },
      {
        menu_key: '/asset-labels/print',
        menu_label: '标签打印',
        parent_key: '/assets-parent',
        icon: null,
        order_index: 6,
      },
      {
        menu_key: '/assets/import',
        menu_label: '导入资产',
        parent_key: '/assets-parent',
        icon: null,
        order_index: 7,
      },

      // 折旧管理子菜单
      {
        menu_key: '/depreciation',
        menu_label: '资产折旧',
        parent_key: '/depreciation-parent',
        icon: null,
        order_index: 1,
      },
      {
        menu_key: '/asset-depreciation',
        menu_label: '资产折旧（兼容路径）',
        parent_key: '/depreciation-parent',
        icon: null,
        order_index: 2,
      },

      // AI工具子菜单
      {
        menu_key: '/ai-question-records',
        menu_label: '提问记录',
        parent_key: '/ai-tools-parent',
        icon: null,
        order_index: 1,
      },
      {
        menu_key: '/ai-maintenance',
        menu_label: 'AI助手',
        parent_key: '/ai-tools-parent',
        icon: null,
        order_index: 2,
      },

      // 资产调配子菜单
      {
        menu_key: '/transfer',
        menu_label: '调配记录',
        parent_key: '/transfer-parent',
        icon: null,
        order_index: 1,
      },
      {
        menu_key: '/transfer/new',
        menu_label: '调配申请',
        parent_key: '/transfer-parent',
        icon: null,
        order_index: 2,
      },
      {
        menu_key: '/transfer/requests',
        menu_label: '调配申请处理',
        parent_key: '/transfer-parent',
        icon: null,
        order_index: 3,
      },

      // 维修维护子菜单
      {
        menu_key: '/maintenance/logs',
        menu_label: '维修日志',
        parent_key: '/maintenance-parent',
        icon: null,
        order_index: 1,
      },
      {
        menu_key: '/maintenance/plans',
        menu_label: '预防性维护',
        parent_key: '/maintenance-parent',
        icon: null,
        order_index: 2,
      },
      {
        menu_key: '/maintenance/templates',
        menu_label: '维护计划模板',
        parent_key: '/maintenance-parent',
        icon: null,
        order_index: 3,
      },
      {
        menu_key: '/maintenance/requests',
        menu_label: '维修申请',
        parent_key: '/maintenance-parent',
        icon: null,
        order_index: 4,
      },
      {
        menu_key: '/maintenance/efficiency',
        menu_label: '维护效率分析',
        parent_key: '/maintenance-parent',
        icon: null,
        order_index: 5,
      },
      {
        menu_key: '/maintenance/reminders',
        menu_label: '维护提醒管理',
        parent_key: '/maintenance-parent',
        icon: null,
        order_index: 6,
      },
      {
        menu_key: '/maintenance/usage-triggers',
        menu_label: '阈值触发管理',
        parent_key: '/maintenance-parent',
        icon: null,
        order_index: 7,
      },
      {
        menu_key: '/maintenance/asset-usage',
        menu_label: '资产使用量管理',
        parent_key: '/maintenance-parent',
        icon: null,
        order_index: 8,
      },
      {
        menu_key: '/maintenance/workorders',
        menu_label: '维护工单',
        parent_key: '/maintenance-parent',
        icon: null,
        order_index: 9,
      },

      // 资产定位子菜单
      {
        menu_key: '/asset-location',
        menu_label: '地理定位',
        parent_key: '/asset-monitoring-parent',
        icon: null,
        order_index: 1,
      },
      {
        menu_key: '/beacon-location',
        menu_label: '区域定位',
        parent_key: '/asset-monitoring-parent',
        icon: null,
        order_index: 2,
      },
      {
        menu_key: '/iot-devices',
        menu_label: '区域定位配置',
        parent_key: '/asset-monitoring-parent',
        icon: null,
        order_index: 3,
      },

      // 技术资料子菜单
      {
        menu_key: '/technical-documents',
        menu_label: '资料列表',
        parent_key: '/technical-documents-parent',
        icon: null,
        order_index: 1,
      },
      {
        menu_key: '/technical-documents/ai',
        menu_label: 'AI智能助手',
        parent_key: '/technical-documents-parent',
        icon: null,
        order_index: 2,
      },
      {
        menu_key: '/technical-documents/batch-upload',
        menu_label: '资料批量上传',
        parent_key: '/technical-documents-parent',
        icon: null,
        order_index: 3,
      },
      {
        menu_key: '/technical-documents/review',
        menu_label: '资料审核',
        parent_key: '/technical-documents-parent',
        icon: null,
        order_index: 4,
      },

      // 质量管理子菜单
      {
        menu_key: '/quality-control/metrology',
        menu_label: '计量管理',
        parent_key: '/quality-control-parent',
        icon: null,
        order_index: 1,
      },
      {
        menu_key: '/quality-control/metrology/upload',
        menu_label: '报告智能识别',
        parent_key: '/quality-control-parent',
        icon: null,
        order_index: 2,
      },
      {
        menu_key: '/quality-control/qc',
        menu_label: '质控管理',
        parent_key: '/quality-control-parent',
        icon: null,
        order_index: 3,
      },
      {
        menu_key: '/quality-control/statistics',
        menu_label: '统计分析',
        parent_key: '/quality-control-parent',
        icon: null,
        order_index: 4,
      },
      {
        menu_key: '/adverse-reaction',
        menu_label: '不良事件管理',
        parent_key: '/quality-control-parent',
        icon: null,
        order_index: 5,
      },

      // 验收管理子菜单
      {
        menu_key: '/acceptance',
        menu_label: '验收记录',
        parent_key: '/acceptance-parent',
        icon: null,
        order_index: 1,
      },
      {
        menu_key: '/acceptance/create',
        menu_label: '创建验收记录',
        parent_key: '/acceptance-parent',
        icon: null,
        order_index: 2,
      },

      // 系统管理子菜单
      {
        menu_key: '/tenants',
        menu_label: '企业管理',
        parent_key: '/system-parent',
        icon: null,
        order_index: 1,
      },
      {
        menu_key: '/users',
        menu_label: '用户管理',
        parent_key: '/system-parent',
        icon: null,
        order_index: 2,
      },
      {
        menu_key: '/departments',
        menu_label: '部门管理',
        parent_key: '/system-parent',
        icon: null,
        order_index: 3,
      },
      {
        menu_key: '/roles-permissions',
        menu_label: '角色和权限管理',
        parent_key: '/system-parent',
        icon: null,
        order_index: 4,
      },
      {
        menu_key: '/dashboard-configs',
        menu_label: '仪表盘配置',
        parent_key: '/system-parent',
        icon: null,
        order_index: 5,
      },
      {
        menu_key: '/cloud-sync',
        menu_label: '云/IoT 同步',
        parent_key: '/system-parent',
        icon: null,
        order_index: 6,
      },
      {
        menu_key: '/audit-logs',
        menu_label: '操作日志',
        parent_key: '/system-parent',
        icon: null,
        order_index: 7,
      },
      {
        menu_key: '/backup',
        menu_label: '数据库备份',
        parent_key: '/system-parent',
        icon: null,
        order_index: 10,
      },
      {
        menu_key: '/database-connection',
        menu_label: '数据库连接管理',
        parent_key: '/system-parent',
        icon: null,
        order_index: 11,
      },
      {
        menu_key: '/api-docs',
        menu_label: 'Swagger API 文档',
        parent_key: '/system-parent',
        icon: null,
        order_index: 12,
      },
      {
        menu_key: '/api-documentation',
        menu_label: '完整API文档',
        parent_key: '/system-parent',
        icon: null,
        order_index: 9,
      },
    ];

    const insertMenuSQL = `
      INSERT INTO menu_definitions (menu_key, menu_label, parent_key, icon, order_index, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
      ON DUPLICATE KEY UPDATE
        menu_label = VALUES(menu_label),
        parent_key = VALUES(parent_key),
        icon = VALUES(icon),
        order_index = VALUES(order_index),
        updated_at = CURRENT_TIMESTAMP
    `;

    // 插入/更新所有菜单
    for (const menu of defaultMenus) {
      await db.execute(insertMenuSQL, [
        menu.menu_key,
        menu.menu_label,
        menu.parent_key,
        menu.icon,
        menu.order_index,
      ]);
    }

    // 更新菜单权限
    const [menus] = await db.execute('SELECT menu_key FROM menu_definitions');
    const [roles] = await db.execute('SELECT role_code FROM roles');

    // 定义不同角色的默认菜单权限
    const roleMenuPermissions = {
      // 超级管理员：所有菜单可见
      super_admin: 1,

      // 系统管理员：所有菜单可见
      system_admin: 1,

      // 资产管理员：业务菜单可见
      asset_admin: menuKey => {
        return !menuKey.startsWith('/system-parent') ? 1 : 0;
      },

      // 科室管理员：查看权限，无管理权限
      department_admin: menuKey => {
        return !menuKey.startsWith('/system-parent') &&
               !menuKey.includes('/add') &&
               !menuKey.includes('/import') &&
               !menuKey.includes('/new') &&
               !menuKey.includes('/requests') &&
               !menuKey.includes('/templates') ? 1 : 0;
      },

      // 计量管理员：计量相关菜单可见
      metrology_admin: menuKey => {
        return menuKey.includes('/quality-control/metrology') ||
               menuKey.includes('/dashboard') ||
               menuKey.includes('/assets') ||
               menuKey.includes('/assets-parent') ||
               menuKey.includes('/depreciation') ? 1 : 0;
      },

      // 质量管理员：质量控制相关菜单可见
      quality_admin: menuKey => {
        return menuKey.includes('/quality-control') ||
               menuKey.includes('/dashboard') ||
               menuKey.includes('/assets') ||
               menuKey.includes('/assets-parent') ||
               menuKey.includes('/depreciation') ? 1 : 0;
      },

      // 维护管理员：维护相关菜单可见
      maintenance_admin: menuKey => {
        return menuKey.includes('/maintenance') ||
               menuKey.includes('/dashboard') ||
               menuKey.includes('/assets') ||
               menuKey.includes('/assets-parent') ||
               menuKey.includes('/depreciation') ? 1 : 0;
      },

      // 维修工程师：维护相关菜单可见（不含管理功能）
      maintenance_engineer: menuKey => {
        return menuKey.includes('/maintenance/logs') ||
               menuKey.includes('/maintenance/requests') ||
               menuKey.includes('/maintenance/workorders') ||
               menuKey.includes('/dashboard') ||
               menuKey.includes('/assets') ||
               menuKey.includes('/assets-parent') ||
               menuKey.includes('/depreciation') ? 1 : 0;
      },

      // 验收管理员：验收相关菜单可见
      acceptance_admin: menuKey => {
        return menuKey.includes('/acceptance') ||
               menuKey.includes('/dashboard') ||
               menuKey.includes('/assets') ||
               menuKey.includes('/assets-parent') ||
               menuKey.includes('/depreciation') ? 1 : 0;
      },

      // 调配管理员：调配相关菜单可见
      transfer_admin: menuKey => {
        return menuKey.includes('/transfer') ||
               menuKey.includes('/dashboard') ||
               menuKey.includes('/assets') ||
               menuKey.includes('/assets-parent') ||
               menuKey.includes('/depreciation') ? 1 : 0;
      },

      // 盘点管理员：盘点相关菜单可见
      inventory_admin: menuKey => {
        return menuKey.includes('/inventory') ||
               menuKey.includes('/dashboard') ||
               menuKey.includes('/assets') ||
               menuKey.includes('/assets-parent') ||
               menuKey.includes('/depreciation') ? 1 : 0;
      },

      // 普通用户：仅查看权限
      user: menuKey => {
        return menuKey.includes('/dashboard') ||
               menuKey.includes('/assets') ||
               menuKey.includes('/depreciation') ||
               menuKey.includes('/quality-control') ||
               menuKey.includes('/maintenance/logs') ||
               menuKey.includes('/transfer') ||
               menuKey.includes('/inventory') ||
               menuKey.includes('/acceptance') ? 1 : 0;
      },
    };

    for (const role of roles) {
      const roleCode = role.role_code;
      for (const menu of menus) {
        const menuKey = menu.menu_key;
        let isVisible = 0;

        // 根据角色获取默认菜单权限
        if (typeof roleMenuPermissions[roleCode] === 'number') {
          isVisible = roleMenuPermissions[roleCode];
        } else if (typeof roleMenuPermissions[roleCode] === 'function') {
          isVisible = roleMenuPermissions[roleCode](menuKey);
        }

        await db.execute(
          `INSERT INTO role_menu_permissions (role, menu_key, is_visible)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE is_visible = VALUES(is_visible)
        `,
          [roleCode, menu.menu_key, isVisible],
        );
      }
    }

    return true;
  } catch (error) {
    logRolesPermissionsError('强制更新菜单失败', error, null);
    throw error;
  }
}

// ============================================
// 权限定义相关路由
// ============================================

// 获取所有权限定义（按分类分组）
router.get('/permissions/definitions', authenticate, async (req, res) => {
  try {
    await ensurePermissionTablesExist(db);

    // 从 permission_definitions 表获取所有权限定义，按分类分组
    const [rows] = await db.execute(
      'SELECT permission, category, name, description FROM permission_definitions ORDER BY category, permission',
    );

    // 按分类分组
    const grouped = {};
    rows.forEach(row => {
      if (!grouped[row.category]) {
        grouped[row.category] = [];
      }
      grouped[row.category].push({
        permission: row.permission,
        name: row.name,
        description: row.description,
      });
    });

    res.json({
      success: true,
      data: grouped,
    });
  } catch (error) {
    logRolesPermissionsError('获取权限定义失败', error, req);
    res.status(500).json({
      success: false,
      message: '获取权限定义失败',
      error: error.message,
    });
  }
});

// 获取所有权限列表（扁平结构）
router.get('/permissions/list', authenticate, async (req, res) => {
  try {
    await ensurePermissionTablesExist(db);

    const [rows] = await db.execute(
      'SELECT permission, category, name, description FROM permission_definitions ORDER BY category, permission',
    );

    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    logRolesPermissionsError('获取权限列表失败', error, req);
    res.status(500).json({
      success: false,
      message: '获取权限列表失败',
      error: error.message,
    });
  }
});

// ============================================
// 角色管理相关路由
// ============================================

// 获取所有角色列表
router.get('/roles', authenticate, async (req, res) => {
  try {
    // 获取当前用户角色，确保userRole始终有定义
    const userRole = req.user?.role;
    // 检查 roles 表是否存在
    const [tables] = await db.execute(
      `SELECT TABLE_NAME
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'roles'`,
    );

    let roles;
    if (tables.length > 0) {
      // 如果 roles 表存在，从表中获取动态角色
      const [rows] = await db.execute(
        'SELECT role_code as role, role_name as label, description, is_active FROM roles WHERE is_active = 1 ORDER BY id',
      );

      // 转换为前端需要的格式
      roles = rows.map(row => ({
        value: row.role,
        label: row.label || row.role,
        role: row.role,
        role_code: row.role,
        role_name: row.label,
        description: row.description || '',
      }));
    } else {
      // 如果 roles 表不存在，使用默认角色（兼容旧系统）
      // 根据用户角色决定返回哪些角色
      roles = [
        { value: 'asset_admin', label: '资产管理员', role: 'asset_admin' },
        { value: 'department_admin', label: '科室管理员', role: 'department_admin' },
        { value: 'metrology_admin', label: '计量管理员', role: 'metrology_admin' },
        { value: 'quality_admin', label: '质量管理员', role: 'quality_admin' },
        { value: 'maintenance_admin', label: '维护管理员', role: 'maintenance_admin' },
        { value: 'maintenance_engineer', label: '维修工程师', role: 'maintenance_engineer' },
        { value: 'acceptance_admin', label: '验收管理员', role: 'acceptance_admin' },
        { value: 'transfer_admin', label: '调配管理员', role: 'transfer_admin' },
        { value: 'inventory_admin', label: '盘点管理员', role: 'inventory_admin' },
        { value: 'user', label: '普通用户', role: 'user' },
      ];

      // 只有超级管理员可以看到和创建超级管理员角色
      if (userRole === 'super_admin') {
        roles.unshift({ value: 'super_admin', label: '超级管理员', role: 'super_admin' });
        roles.splice(1, 0, {
          value: 'system_admin',
          label: '系统管理员（租户级）',
          role: 'system_admin',
        });
      } else if (userRole === 'system_admin') {
        // 系统管理员（租户级）可以看到系统管理员角色，但不能创建超级管理员
        roles.unshift({
          value: 'system_admin',
          label: '系统管理员（租户级）',
          role: 'system_admin',
        });
      }
    }

    // 根据用户角色过滤角色列表（主要针对从数据库获取的角色）
    if (userRole === 'system_admin') {
      // 系统管理员（租户级）不能看到超级管理员角色
      roles = roles.filter(r => r.value !== 'super_admin');
    }

    res.json({
      success: true,
      data: roles,
    });
  } catch (error) {
    logRolesPermissionsError('获取角色列表失败', error, req);
    res.status(500).json({
      success: false,
      message: '获取角色列表失败',
      error: error.message,
    });
  }
});

// 创建新角色
router.post('/roles', authenticate, requireSystemAdmin, async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const role_code = typeof req.body?.role_code === 'string' ? req.body.role_code.trim() : req.body?.role_code;
    const { role_name, description } = req.body;

    if (!role_code || !role_name) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        success: false,
        message: '角色代码和角色名称不能为空',
      });
    }

    if (!validateRoleCode(role_code)) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        success: false,
        message: '角色代码格式不正确',
      });
    }

    // 检查 roles 表是否存在
    const [tables] = await connection.execute(
      `SELECT TABLE_NAME
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'roles'`,
    );

    if (tables.length === 0) {
      await connection.rollback();
      return res.status(500).json({
        success: false,
        message: '角色表未创建，请先运行 create-roles-table.js 脚本',
      });
    }

    // 检查角色代码是否已存在
    const [existing] = await connection.execute('SELECT id FROM roles WHERE role_code = ?', [
      role_code,
    ]);

    if (existing.length > 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        success: false,
        message: '角色代码已存在',
      });
    }

    // 插入新角色
    const [result] = await connection.execute(
      'INSERT INTO roles (role_code, role_name, description) VALUES (?, ?, ?)',
      [role_code, role_name, description || null],
    );

    await connection.commit();

    // 记录审计日志
    await logAudit(req, {
      action_type: 'create',
      module: 'roles',
      resource_id: result.insertId,
      details: {
        role_code,
        role_name,
        description,
      },
    });

    res.json({
      success: true,
      message: '角色创建成功',
      data: {
        id: result.insertId,
        role_code,
        role_name,
        description,
      },
    });
  } catch (error) {
    await connection.rollback();
    logRolesPermissionsError('创建角色失败', error, req, {
      roleCode: req.body?.role_code || null,
    });
    res.status(500).json({
      success: false,
      message: '创建角色失败',
      error: error.message,
    });
  } finally {
    connection.release();
  }
});

// 更新角色信息
router.put('/roles/:role', authenticate, requireSystemAdmin, async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { role } = req.params;
    const { role_name, description } = req.body;

    // 检查 roles 表是否存在
    const [tables] = await connection.execute(
      `SELECT TABLE_NAME
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'roles'`,
    );

    if (tables.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(500).json({
        success: false,
        message: '角色表未创建，请先运行 create-roles-table.js 脚本',
      });
    }

    // 检查角色是否存在
    const [existing] = await connection.execute('SELECT id FROM roles WHERE role_code = ?', [role]);

    if (existing.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({
        success: false,
        message: '角色不存在',
      });
    }

    // 更新角色信息
    await connection.execute(
      'UPDATE roles SET role_name = ?, description = ? WHERE role_code = ?',
      [role_name, description || null, role],
    );

    await connection.commit();

    // 记录审计日志
    await logAudit(req, {
      action_type: 'update',
      module: 'roles',
      resource_id: existing[0].id,
      details: {
        role,
        role_name,
        description,
      },
    });

    res.json({
      success: true,
      message: '角色更新成功',
    });
  } catch (error) {
    await connection.rollback();
    logRolesPermissionsError('更新角色失败', error, req, {
      role: req.params?.role || null,
    });
    res.status(500).json({
      success: false,
      message: '更新角色失败',
      error: error.message,
    });
  } finally {
    connection.release();
  }
});

// 删除角色
router.delete('/roles/:role', authenticate, requireSystemAdmin, async (req, res) => {
  const isSuperAdmin = req.user?.is_super_admin === true || req.user?.role === 'super_admin';
  if (!isSuperAdmin) {
    return res.status(403).json({
      success: false,
      message: '只有超级管理员可以删除角色',
    });
  }

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const { role } = req.params;

    // 检查 roles 表是否存在
    const [tables] = await connection.execute(
      `SELECT TABLE_NAME
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'roles'`,
    );

    if (tables.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(500).json({
        success: false,
        message: '角色表未创建，请先运行 create-roles-table.js 脚本',
      });
    }

    // 检查角色是否存在
    const [existing] = await connection.execute(
      'SELECT id, is_system_role FROM roles WHERE role_code = ?',
      [role],
    );

    if (existing.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: '角色不存在',
      });
    }

    if (Number(existing[0].is_system_role) === 1) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: '系统内置角色不允许删除',
      });
    }

    // 检查是否有用户使用该角色
    const [users] = await connection.execute(
      'SELECT COUNT(*) as count FROM user_tenant_roles WHERE role = ?',
      [role],
    );

    if (users[0].count > 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `该角色正在被 ${users[0].count} 个用户使用，无法删除`,
      });
    }

    // 删除角色的权限
    await connection.execute('DELETE FROM role_permissions WHERE role = ?', [role]);

    // 删除角色
    await connection.execute('DELETE FROM roles WHERE role_code = ?', [role]);

    await connection.commit();

    // 记录审计日志
    await logAudit(req, {
      action_type: 'delete',
      module: 'roles',
      resource_id: existing[0].id,
      details: {
        role,
      },
    });

    res.json({
      success: true,
      message: '角色删除成功',
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    logRolesPermissionsError('删除角色失败', error, req, {
      role: req.params?.role || null,
    });
    res.status(500).json({
      success: false,
      message: '删除角色失败',
      error: error.message,
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// 获取指定角色的菜单权限（必须在 /roles/:role/permissions 之前定义，避免路由冲突）
router.get('/roles/:role/menus', authenticate, requireSystemAdmin, async (req, res) => {
  try {
    const { role } = req.params;

    // 只在表不存在且未初始化时创建表（进程级别单次执行）
    if (!menuTablesInitialized) {
      try {
        await db.execute('SELECT 1 FROM role_menu_permissions LIMIT 1');
      } catch (tableError) {
        if (tableError.code === 'ER_NO_SUCH_TABLE') {
          await createMenuPermissionsTables();
          menuTablesInitialized = true;
        } else {
          throw tableError;
        }
      }
    }

    const [rows] = await db.execute(
      `SELECT menu_key, is_visible
       FROM role_menu_permissions
       WHERE role = ?`,
      [role],
    );

    const menuPermissions = {};
    rows.forEach(row => {
      menuPermissions[row.menu_key] = row.is_visible === 1;
    });

    res.json({
      success: true,
      data: menuPermissions,
    });
  } catch (error) {
    logRolesPermissionsError('获取角色菜单权限失败', error, req, {
      role: req.params?.role || null,
    });
    res.status(500).json({
      success: false,
      message: '获取角色菜单权限失败',
      error: error.message,
    });
  }
});

// 获取指定角色的所有权限
router.get('/roles/:role/permissions', authenticate, async (req, res) => {
  try {
    const { role } = req.params;
    const currentRole = String(req.user?.role || '').trim();
    const isAdminReader = req.user?.is_super_admin || currentRole === 'super_admin' || currentRole === 'system_admin';

    if (!isAdminReader && role !== currentRole) {
      return res.status(403).json({
        success: false,
        message: '无权限查看该角色权限',
      });
    }

    // 检查 role_permissions 表是否存在
    const [tables] = await db.execute(
      `SELECT TABLE_NAME
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'role_permissions'`,
    );

    if (tables.length === 0) {
      return res.json({
        success: true,
        data: [],
      });
    }

    // 检查 permission_definitions 表是否存在
    const [defTables] = await db.execute(
      `SELECT TABLE_NAME
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'permission_definitions'`,
    );

    let rows;
    if (defTables.length > 0) {
      // 如果 permission_definitions 表存在，使用 JOIN 获取描述
      [rows] = await db.execute(
        `SELECT rp.permission,
                COALESCE(pd.name, rp.description, rp.permission) as description
         FROM role_permissions rp
         LEFT JOIN permission_definitions pd ON rp.permission = pd.permission
         WHERE rp.role = ?
         ORDER BY rp.permission`,
        [role],
      );
    } else {
      // 如果 permission_definitions 表不存在，只从 role_permissions 获取
      [rows] = await db.execute(
        'SELECT permission, COALESCE(description, permission) as description FROM role_permissions WHERE role = ? ORDER BY permission',
        [role],
      );
    }

    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    logRolesPermissionsError('获取角色权限失败', error, req, {
      role: req.params?.role || null,
    });
    res.status(500).json({
      success: false,
      message: '获取角色权限失败',
      error: error.message,
    });
  }
});

// 更新角色的权限
router.put('/roles/:role/permissions', authenticate, requireSystemAdmin, async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const { role } = req.params;
    const { permissions } = req.body;

    if (!Array.isArray(permissions)) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        success: false,
        message: '权限列表必须是数组',
      });
    }

    const normalizedPermissions = normalizePermissions(permissions);

    await ensurePermissionTablesExist(connection);

    // 删除该角色的所有现有权限
    await connection.execute('DELETE FROM role_permissions WHERE role = ?', [role]);

    // 插入新权限
    if (normalizedPermissions.length > 0) {
      const insertSQL = `
        INSERT INTO role_permissions (role, permission, description)
        VALUES (?, ?, COALESCE((SELECT name FROM permission_definitions WHERE permission = ? LIMIT 1), ?))
      `;

      for (const permission of normalizedPermissions) {
        await connection.execute(insertSQL, [role, permission, permission, permission]);
      }
    }

    await connection.commit();

    // 记录审计日志
    await logAudit(req, {
      action_type: 'update',
      module: 'role_permissions',
      resource_id: role,
      details: {
        role,
        permissions_count: normalizedPermissions.length,
        permissions: normalizedPermissions,
      },
    });

    res.json({
      success: true,
      message: '角色权限更新成功',
    });
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (rbErr) {
        console.error('[roles-permissions] rollback 失败:', rbErr?.message);
      }
    }
    logRolesPermissionsError('更新角色权限失败', error, req, {
      role: req.params?.role || null,
      permissionsCount: Array.isArray(req.body?.permissions) ? req.body.permissions.length : null,
    });
    res.status(500).json({
      success: false,
      message: '更新角色权限失败',
      error: error.message,
    });
  } finally {
    if (connection) {
      try { connection.release(); } catch (relErr) {
        console.error('[roles-permissions] release 失败:', relErr?.message);
      }
    }
  }
});

// 批量更新多个角色的权限
router.put('/roles/permissions/batch', authenticate, requireSystemAdmin, async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const { rolePermissions } = req.body;

    if (!Array.isArray(rolePermissions)) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        success: false,
        message: '角色权限列表必须是数组',
      });
    }

    await ensurePermissionTablesExist(connection);

    // 批量更新每个角色的权限
    for (const { role, permissions } of rolePermissions) {
      if (!validateRoleCode(role) || !Array.isArray(permissions)) {
        continue;
      }

      const normalizedPermissions = normalizePermissions(permissions);

      // 删除该角色的所有现有权限
      await connection.execute('DELETE FROM role_permissions WHERE role = ?', [role]);

      // 插入新权限
      if (normalizedPermissions.length > 0) {
        const insertSQL = `
          INSERT INTO role_permissions (role, permission, description)
          VALUES (?, ?, COALESCE((SELECT name FROM permission_definitions WHERE permission = ? LIMIT 1), ?))
        `;

        for (const permission of normalizedPermissions) {
          await connection.execute(insertSQL, [role, permission, permission, permission]);
        }
      }
    }

    await connection.commit();

    // 记录审计日志
    await logAudit(req, {
      action_type: 'update',
      module: 'role_permissions',
      resource_id: 'batch',
      details: {
        roles_count: rolePermissions.length,
        rolePermissions,
      },
    });

    res.json({
      success: true,
      message: '批量更新角色权限成功',
    });
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (rbErr) {
        console.error('[roles-permissions] batch rollback 失败:', rbErr?.message);
      }
    }
    logRolesPermissionsError('批量更新角色权限失败', error, req, {
      rolesCount: Array.isArray(req.body?.rolePermissions) ? req.body.rolePermissions.length : null,
    });
    res.status(500).json({
      success: false,
      message: '批量更新角色权限失败',
      error: error.message,
    });
  } finally {
    if (connection) {
      try { connection.release(); } catch (relErr) {
        console.error('[roles-permissions] batch release 失败:', relErr?.message);
      }
    }
  }
});

// ============================================
// 用户权限相关路由
// ============================================

// 获取当前用户的权限列表
router.get('/user/permissions', authenticate, async (req, res) => {
  try {
    const userRole = req.user?.role;

    // 超级管理员和系统管理员（租户级）拥有所有权限
    if (userRole === 'super_admin' || userRole === 'system_admin') {
      // 从 permission_definitions 表获取所有权限
      const [tables] = await db.execute(
        `SELECT TABLE_NAME
         FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'permission_definitions'`,
      );

      if (tables.length > 0) {
        const [rows] = await db.execute('SELECT permission FROM permission_definitions');
        return res.json({
          success: true,
          data: rows.map(row => row.permission),
        });
      } else {
        // 如果权限定义表不存在，返回空数组
        return res.json({
          success: true,
          data: [],
        });
      }
    }

    // 普通用户从 role_permissions 表获取权限
    const [rows] = await db.execute('SELECT permission FROM role_permissions WHERE role = ?', [
      userRole,
    ]);

    res.json({
      success: true,
      data: rows.map(row => row.permission),
    });
  } catch (error) {
    logRolesPermissionsError('获取用户权限失败', error, req);
    res.status(500).json({
      success: false,
      message: '获取用户权限失败',
      error: error.message,
    });
  }
});

// 检查用户是否拥有指定权限
router.post('/user/check-permission', authenticate, async (req, res) => {
  try {
    const { permission } = req.body;
    const userRole = req.user?.role;

    if (!permission) {
      return res.status(400).json({
        success: false,
        message: '请指定要检查的权限',
      });
    }

    // 超级管理员和系统管理员（租户级）拥有所有权限
    if (userRole === 'super_admin' || userRole === 'system_admin') {
      return res.json({
        success: true,
        hasPermission: true,
      });
    }

    // 检查用户角色是否拥有该权限
    const [rows] = await db.execute(
      'SELECT COUNT(*) as count FROM role_permissions WHERE role = ? AND permission = ?',
      [userRole, permission],
    );

    res.json({
      success: true,
      hasPermission: rows[0].count > 0,
    });
  } catch (error) {
    logRolesPermissionsError('检查权限失败', error, req, {
      permission: req.body?.permission || null,
    });
    res.status(500).json({
      success: false,
      message: '检查权限失败',
      error: error.message,
    });
  }
});

// ============================================
// 菜单权限相关路由
// ============================================

// 获取所有菜单定义（树形结构）
router.get('/menus/definitions', authenticate, async (req, res) => {
  try {
    // 检查表是否存在，如果不存在则自动创建
    try {
      await db.execute('SELECT 1 FROM menu_definitions LIMIT 1');
    } catch (tableError) {
      if (tableError.code === 'ER_NO_SUCH_TABLE') {
        await createMenuPermissionsTables();
      } else {
        throw tableError;
      }
    }

    // 确保质量管理菜单存在（如果不存在则添加）
    try {
      const [qcMenu] = await db.execute('SELECT id FROM menu_definitions WHERE menu_key = ?', [
        '/quality-control-parent',
      ]);
      if (qcMenu.length === 0) {
        await forceUpdateMenus(); // 强制更新所有菜单
      }
    } catch (error) {
      console.warn('[菜单权限] 检查质量管理菜单时出错:', error.message);
      // 如果检查失败，尝试强制更新
      try {
        await forceUpdateMenus();
      } catch (updateError) {
        logRolesPermissionsError('[菜单权限] 强制更新菜单失败', updateError, req, {
          sourceError: error?.message || null,
        });
      }
    }

    // 获取所有菜单
    const [rows] = await db.execute(
      'SELECT * FROM menu_definitions WHERE is_active = 1 ORDER BY order_index, id',
    );

    // 构建树形结构
    const menuMap = {};
    const rootMenus = [];

    // 先创建所有菜单的映射
    rows.forEach(menu => {
      menuMap[menu.menu_key] = {
        ...menu,
        children: [],
      };
    });

    // 构建树形结构
    rows.forEach(menu => {
      if (menu.parent_key && menuMap[menu.parent_key]) {
        menuMap[menu.parent_key].children.push(menuMap[menu.menu_key]);
      } else {
        rootMenus.push(menuMap[menu.menu_key]);
      }
    });

    res.json({
      success: true,
      data: rootMenus,
    });
  } catch (error) {
    logRolesPermissionsError('获取菜单定义失败', error, req);
    res.status(500).json({
      success: false,
      message: '获取菜单定义失败',
      error: error.message,
    });
  }
});

// 获取所有菜单定义（扁平结构）
router.get('/menus/list', authenticate, async (req, res) => {
  try {
    // 检查表是否存在，如果不存在则自动创建
    try {
      await db.execute('SELECT 1 FROM menu_definitions LIMIT 1');
    } catch (tableError) {
      if (tableError.code === 'ER_NO_SUCH_TABLE') {
        await createMenuPermissionsTables();
      } else {
        throw tableError;
      }
    }

    // 确保质量控制菜单存在
    try {
      const [qcMenu] = await db.execute('SELECT id FROM menu_definitions WHERE menu_key = ?', [
        '/quality-control-parent',
      ]);
      if (qcMenu.length === 0) {
        await forceUpdateMenus();
      }
    } catch (error) {
      console.warn('[菜单权限] 检查质量管理菜单时出错:', error.message);
    }

    const [rows] = await db.execute(
      'SELECT * FROM menu_definitions WHERE is_active = 1 ORDER BY order_index, id',
    );

    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    logRolesPermissionsError('获取菜单列表失败', error, req);
    res.status(500).json({
      success: false,
      message: '获取菜单列表失败',
      error: error.message,
    });
  }
});

// 更新指定角色的菜单权限
router.put('/roles/:role/menus', authenticate, requireSystemAdmin, async (req, res) => {
  let connection;
  try {
    const { role } = req.params;
    const { menuPermissions } = req.body; // { menu_key: is_visible }

    // 检查表是否存在，如果不存在则自动创建
    try {
      await db.execute('SELECT 1 FROM role_menu_permissions LIMIT 1');
    } catch (tableError) {
      if (tableError.code === 'ER_NO_SUCH_TABLE') {
        await createMenuPermissionsTables();
      } else {
        throw tableError;
      }
    }

    if (!menuPermissions || typeof menuPermissions !== 'object') {
      return res.status(400).json({
        success: false,
        message: '请提供菜单权限配置',
      });
    }

    connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // 删除该角色的所有菜单权限
      await connection.execute('DELETE FROM role_menu_permissions WHERE role = ?', [role]);

      // 插入新的菜单权限
      const insertSQL = `
        INSERT INTO role_menu_permissions (role, menu_key, is_visible)
        VALUES (?, ?, ?)
      `;

      for (const [menuKey, isVisible] of Object.entries(menuPermissions)) {
        await connection.execute(insertSQL, [role, menuKey, isVisible ? 1 : 0]);
      }

      await connection.commit();

      // 记录审计日志
      await logAudit(req, {
        action_type: 'update',
        module: 'role_menu_permission',
        resource_id: role,
        details: {
          role,
          menu_permissions: menuPermissions,
        },
      });

      res.json({
        success: true,
        message: '菜单权限更新成功',
      });
    } catch (error) {
      try { await connection.rollback(); } catch (rbErr) {
        console.error('[roles-permissions] menus rollback 失败:', rbErr?.message);
      }
      throw error;
    } finally {
      try { connection.release(); } catch (relErr) {
        console.error('[roles-permissions] menus release 失败:', relErr?.message);
      }
    }
  } catch (error) {
    logRolesPermissionsError('更新角色菜单权限失败', error, req, {
      role: req.params?.role || null,
      menuCount:
        req.body?.menuPermissions && typeof req.body.menuPermissions === 'object'
          ? Object.keys(req.body.menuPermissions).length
          : null,
    });
    res.status(500).json({
      success: false,
      message: '更新角色菜单权限失败',
      error: error.message,
    });
  }
});

// 强制更新菜单定义（管理员专用）
router.post('/menus/force-update', authenticate, requireSystemAdmin, async (req, res) => {
  try {
    await forceUpdateMenus();
    res.json({
      success: true,
      message: '菜单更新成功',
    });
  } catch (error) {
    logRolesPermissionsError('强制更新菜单失败', error, req);
    res.status(500).json({
      success: false,
      message: '强制更新菜单失败',
      error: error.message,
    });
  }
});

// 注意：临时路由已移除，所有菜单更新操作都需要认证

// 获取当前用户的可见菜单
router.get('/user/menus', authenticate, async (req, res) => {
  try {
    const userRole = req.user?.role;
    const tenantId = req.user?.tenant_id;

    // 检查表是否存在，如果不存在则自动创建
    try {
      await db.execute('SELECT 1 FROM menu_definitions LIMIT 1');
    } catch (tableError) {
      if (tableError.code === 'ER_NO_SUCH_TABLE') {
        await createMenuPermissionsTables();
      } else {
        throw tableError;
      }
    }

    // 超级管理员默认拥有所有菜单
    if (userRole === 'super_admin') {
      try {
        const result = await db.execute('SELECT menu_key FROM menu_definitions WHERE is_active = 1');
        const menus = Array.isArray(result) ? result[0] : result;
        const menuList = Array.isArray(menus) ? menus : [];
        return res.json({
          success: true,
          data: menuList.map(m => (m && m.menu_key) || m),
        });
      } catch (e) {
        console.warn('获取全部菜单失败，返回默认菜单:', e.message);
        return res.json({
          success: true,
          data: ['/dashboard', '/assets', '/inventory', '/transfer', '/idle'],
        });
      }
    }

    // 系统管理员（租户级）和普通用户需要根据租户模块配置过滤菜单
    // 1. 首先获取角色的可见菜单
    //    多租户：优先读 tenant_role_menus（per-tenant 覆盖）；该 (tenant,role) 无记录则回退全局 role_menu_permissions
    let roleMenus = [];
    try {
      let visibleKeys = null; // null = 未取到租户覆盖，需回退
      try {
        if (tenantId) {
          const [trRows] = await db.execute(
            `SELECT menu_key, is_visible FROM tenant_role_menus WHERE tenant_id = ? AND role = ?`,
            [tenantId, userRole],
          );
          if (trRows && trRows.length > 0) {
            // 租户有该角色的覆盖配置：以租户表为准（即使全隐藏也认）
            visibleKeys = trRows.filter(r => r.is_visible === 1).map(r => r.menu_key);
          }
        }
      } catch (e) {
        // tenant_role_menus 表不存在等：忽略，回退全局
      }

      if (visibleKeys === null) {
        const result = await db.execute(
          `SELECT menu_key
           FROM role_menu_permissions
           WHERE role = ? AND is_visible = 1`,
          [userRole],
        );
        const rows = Array.isArray(result) ? result[0] : result;
        visibleKeys = (Array.isArray(rows) ? rows : []).map(row => row && row.menu_key).filter(Boolean);
      }
      roleMenus = visibleKeys;
    } catch (e) {
      console.warn('获取角色菜单失败，返回默认菜单:', e.message);
      roleMenus = ['/dashboard', '/assets', '/inventory', '/transfer', '/idle'];
    }

    const depreciationMenuKeys = ['/depreciation-parent', '/depreciation', '/asset-depreciation'];

    // 兼容历史权限数据：若角色已有资产菜单权限，则自动补齐折旧菜单权限
    if (roleMenus.includes('/assets-parent') || roleMenus.includes('/assets')) {
      roleMenus = Array.from(new Set([...roleMenus, ...depreciationMenuKeys]));
    }

    // 2. 对于系统管理员（租户级）和普通用户，需要根据租户模块配置过滤
    if (userRole === 'system_admin' || userRole !== 'super_admin') {
      // 系统管理员（租户级）不能看到企业管理菜单
      if (userRole === 'system_admin') {
        roleMenus = roleMenus.filter(menuKey => menuKey !== '/tenants');
      }

      // 根据租户模块配置过滤菜单
      if (tenantId) {
        try {
          // 获取企业空间的所有启用模块
          const [enabledModules] = await db.execute(
            'SELECT module_id FROM tenant_module_configs WHERE tenant_id = ? AND enabled = 1',
            [tenantId],
          );

          const moduleIds = enabledModules.map(m => m.module_id);

          if (moduleIds.length > 0) {
            const tenantMenuRowsByModule = new Map();

            try {
              const placeholders = moduleIds.map(() => '?').join(',');
              const [tenantMenuRows] = await db.execute(
                `SELECT module_id, menu_key, is_enabled
                 FROM tenant_module_menus
                 WHERE tenant_id = ? AND module_id IN (${placeholders})`,
                [tenantId, ...moduleIds],
              );

              tenantMenuRows.forEach(row => {
                const rows = tenantMenuRowsByModule.get(row.module_id) || [];
                rows.push(row);
                tenantMenuRowsByModule.set(row.module_id, rows);
              });
            } catch (menuConfigError) {
              console.warn('[菜单权限] 读取 tenant_module_menus 失败，改用模块定义:', menuConfigError.message);
            }

            const allowedMenuKeys = new Set();
            for (const moduleId of moduleIds) {
              const moduleMenus = await getModuleMenuDefinitions(moduleId);
              const filteredMenus = filterMenuDefinitionsByTenantConfig(
                moduleMenus,
                tenantMenuRowsByModule.get(moduleId) || [],
              );
              filteredMenus.forEach(menu => allowedMenuKeys.add(menu.menu_key));
            }

            // 兼容迁移期：折旧模块未单独启用时，资产模块可兜底放开折旧菜单
            if (
              moduleIds.includes('depreciation-management') ||
              moduleIds.includes('asset-management')
            ) {
              depreciationMenuKeys.forEach(menuKey => allowedMenuKeys.add(menuKey));
            }

            // 过滤出同时在角色菜单和模块菜单中的菜单
            roleMenus = roleMenus.filter(menuKey => allowedMenuKeys.has(menuKey));
          } else {
            // 如果没有启用的模块，返回空数组
            roleMenus = [];
          }
        } catch (moduleError) {
          console.warn('获取租户模块配置失败，使用角色菜单:', moduleError.message);
          // 如果获取模块配置失败，使用角色菜单
        }
      }
    }

    res.json({
      success: true,
      data: Array.from(new Set(roleMenus)),
    });
  } catch (error) {
    logRolesPermissionsError('获取用户菜单失败', error, req, {
      tenantId: req.user?.tenant_id || null,
    });
    res.status(500).json({
      success: false,
      message: '获取用户菜单失败',
      error: error.message,
    });
  }
});

module.exports = router;
module.exports.validateRoleCode = validateRoleCode;
module.exports.normalizePermissions = normalizePermissions;
module.exports.isValidPermissionFormat = isValidPermissionFormat;
module.exports.__test__ = {
  validateRoleCode,
  normalizePermissions,
  isValidPermissionFormat,
};
