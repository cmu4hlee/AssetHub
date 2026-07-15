const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getTenantId } = require('../middleware/tenant-filter');
const db = require('../config/database');
const {
  filterMenuDefinitionsByTenantConfig,
  getModuleMenuDefinitions,
} = require('../services/module-menu.service');

// 默认固定菜单（与 ALL_MENUS 完全一致，按"使用频率从高到低"排列）
// 结构与 ALL_MENUS 同源，便于维护、便于 merge 排序、避免两份数据漂移
const DEFAULT_MENUS = [
  {
    menu_key: '/dashboard',
    icon: 'DashboardOutlined',
    label: '仪表盘',
    order_index: 1,
    is_active: 1,
  },
  {
    menu_key: '/assets-parent',
    icon: 'AppstoreOutlined',
    label: '资产主数据',
    order_index: 2,
    is_active: 1,
    module_id: 'asset-management',
    children: [
      { menu_key: '/assets', label: '资产列表', order_index: 1, is_active: 1 },
      { menu_key: '/assets/add', label: '添加资产', order_index: 2, is_active: 1 },
      { menu_key: '/temp-assets', label: '临时资产', order_index: 3, is_active: 1 },
      { menu_key: '/asset-labels/templates', label: '标签模板管理', order_index: 4, is_active: 1 },
      { menu_key: '/asset-labels/print', label: '标签打印', order_index: 5, is_active: 1 },
      {
        menu_key: '/assets/import',
        label: '导入资产',
        order_index: 6,
        is_active: 1,
        roles: ['super_admin', 'system_admin'],
      },
    ],
  },
  {
    menu_key: '/maintenance-parent',
    icon: 'ToolOutlined',
    label: '维修维护',
    order_index: 3,
    is_active: 1,
    module_id: 'maintenance-management',
    children: [
      { menu_key: '/maintenance/logs', label: '维修日志', order_index: 1, is_active: 1 },
      { menu_key: '/maintenance/temporary', label: '临时保养', order_index: 2, is_active: 1 },
      { menu_key: '/maintenance/plans', label: '预防性维护', order_index: 3, is_active: 1 },
      { menu_key: '/maintenance/templates', label: '维护计划模板', order_index: 4, is_active: 1 },
      { menu_key: '/maintenance/requests', label: '维修申请', order_index: 5, is_active: 1 },
      { menu_key: '/maintenance/workorders', label: '调度中心', order_index: 0, is_active: 1 },
      { menu_key: '/maintenance/efficiency', label: '维护效率分析', order_index: 7, is_active: 1 },
      { menu_key: '/maintenance/reminders', label: '维护提醒管理', order_index: 8, is_active: 1 },
      { menu_key: '/maintenance/warranty', label: '保修管理', order_index: 9, is_active: 1 },
      { menu_key: '/maintenance/warranty-contracts', label: '保修合同管理', order_index: 10, is_active: 1 },
      { menu_key: '/maintenance/warranty-reminders', label: '保修到期提醒', order_index: 11, is_active: 1 },
      { menu_key: '/maintenance/usage-triggers', label: '阈值触发管理', order_index: 12, is_active: 1 },
      { menu_key: '/maintenance/asset-usage', label: '资产使用量管理', order_index: 13, is_active: 1 },
      { menu_key: '/maintenance/costs', label: '维护成本管理', order_index: 14, is_active: 1 },
      { menu_key: '/maintenance/evaluations', label: '维护效果评估', order_index: 15, is_active: 1 },
    ],
  },
  {
    menu_key: '/inventory-parent',
    icon: 'FileSearchOutlined',
    label: '盘点管理',
    order_index: 4,
    is_active: 1,
    children: [
      { menu_key: '/inventory', label: '资产盘点列表', order_index: 1, is_active: 1 },
      { menu_key: '/inventory/self', label: '我的资产盘点', order_index: 2, is_active: 1 },
      { menu_key: '/inventory/new', label: '新建盘点', order_index: 3, is_active: 1 },
    ],
  },
  {
    menu_key: '/transfer-parent',
    icon: 'SwapOutlined',
    label: '资产调配',
    order_index: 5,
    is_active: 1,
    module_id: 'asset-management',
    children: [
      { menu_key: '/transfer', label: '调配记录', order_index: 1, is_active: 1 },
      { menu_key: '/transfer/new', label: '调配申请', order_index: 2, is_active: 1 },
      {
        menu_key: '/transfer/requests',
        label: '调配申请处理',
        order_index: 3,
        is_active: 1,
        roles: ['super_admin', 'system_admin'],
      },
    ],
  },
  {
    menu_key: '/asset-monitoring-parent',
    icon: 'EnvironmentOutlined',
    label: '资产定位与IoT',
    order_index: 6,
    is_active: 1,
    module_id: 'iot-management',
    children: [
      { menu_key: '/asset-location', label: '地理定位', order_index: 1, is_active: 1 },
      { menu_key: '/beacon-location', label: '区域定位', order_index: 2, is_active: 1 },
      { menu_key: '/iot-devices', label: 'IoT设备管理', order_index: 3, is_active: 1 },
      { menu_key: '/asset-monitoring', label: '资产监测', order_index: 4, is_active: 1 },
      { menu_key: '/environment-monitoring', label: '环境监测', order_index: 5, is_active: 1 },
    ],
  },
  {
    menu_key: '/quality-control-parent',
    icon: 'ExperimentOutlined',
    label: '质量管理',
    order_index: 7,
    is_active: 1,
    module_id: 'quality-control',
    children: [
      { menu_key: '/quality-control/metrology', label: '计量管理', order_index: 1, is_active: 1 },
      {
        menu_key: '/quality-control/metrology/management',
        label: '计量管理页',
        order_index: 2,
        is_active: 1,
      },
      { menu_key: '/quality-control/qc', label: '质控管理', order_index: 3, is_active: 1 },
      { menu_key: '/quality-control/statistics', label: '统计分析', order_index: 4, is_active: 1 },
      { menu_key: '/quality-control/management', label: '质量管理总览', order_index: 5, is_active: 1 },
      { menu_key: '/adverse-reaction', label: '不良事件管理', order_index: 6, is_active: 1 },
      {
        menu_key: '/quality-control/metrology/upload',
        label: '报告智能识别',
        order_index: 7,
        is_active: 1,
      },
    ],
  },
  {
    menu_key: '/acceptance-parent',
    icon: 'CheckCircleOutlined',
    label: '验收管理',
    order_index: 8,
    is_active: 1,
    children: [
      { menu_key: '/acceptance', label: '验收记录', order_index: 1, is_active: 1 },
      { menu_key: '/acceptance/create', label: '创建验收记录', order_index: 2, is_active: 1 },
      { menu_key: '/acceptance/applications', label: '验收申请', order_index: 3, is_active: 1 },
      { menu_key: '/acceptance/templates', label: '验收模板', order_index: 4, is_active: 1 },
      { menu_key: '/acceptance/statistics', label: '验收统计', order_index: 5, is_active: 1 },
    ],
  },
  {
    menu_key: '/idle-parent',
    icon: 'GiftOutlined',
    label: '闲置资产',
    order_index: 9,
    is_active: 1,
    children: [
      { menu_key: '/idle', label: '闲置资产列表', order_index: 1, is_active: 1 },
      { menu_key: '/idle/new', label: '新增闲置资产', order_index: 2, is_active: 1 },
    ],
  },
  {
    menu_key: '/depreciation-parent',
    icon: 'DollarOutlined',
    label: '财务管理',
    order_index: 10,
    is_active: 1,
    module_id: 'depreciation-management',
    children: [
      { menu_key: '/depreciation', label: '资产折旧', order_index: 1, is_active: 1 },
      { menu_key: '/finance/budget', label: '预算管理', order_index: 2, is_active: 1 },
      { menu_key: '/finance/transactions', label: '收支记录', order_index: 3, is_active: 1 },
      { menu_key: '/finance/reports', label: '财务报表', order_index: 4, is_active: 1 },
    ],
  },
  {
    menu_key: '/scrapping-parent',
    icon: 'DeleteOutlined',
    label: '报废管理',
    order_index: 11,
    is_active: 1,
    module_id: 'asset-management',
    children: [
      { menu_key: '/scrapping', label: '报废列表', order_index: 1, is_active: 1 },
      { menu_key: '/scrapping/new', label: '新增报废', order_index: 2, is_active: 1 },
    ],
  },
  {
    menu_key: '/technical-documents-parent',
    icon: 'FileTextOutlined',
    label: '技术资料',
    order_index: 12,
    is_active: 1,
    children: [
      { menu_key: '/technical-documents', label: '资料列表', order_index: 1, is_active: 1 },
      { menu_key: '/technical-documents/upload', label: '资料上传', order_index: 2, is_active: 1 },
      {
        menu_key: '/technical-documents/batch-upload',
        label: '资料批量上传',
        order_index: 3,
        is_active: 1,
      },
      { menu_key: '/technical-documents/review', label: '资料审核', order_index: 4, is_active: 1 },
    ],
  },
  {
    menu_key: '/tendering/suppliers',
    icon: 'ShopOutlined',
    label: '供应商管理',
    order_index: 13,
    is_active: 1,
  },
  {
    menu_key: '/tendering/contracts',
    icon: 'FileProtectOutlined',
    label: '合同管理',
    order_index: 14,
    is_active: 1,
  },
  {
    menu_key: '/tendering-parent',
    icon: 'AuditOutlined',
    label: '招标采购',
    order_index: 15,
    is_active: 1,
    children: [
      { menu_key: '/tendering/dashboard', label: '统计概览', order_index: 1, is_active: 1 },
      { menu_key: '/tendering/projects', label: '招标项目管理', order_index: 2, is_active: 1 },
      { menu_key: '/tendering/bids', label: '投标管理', order_index: 3, is_active: 1 },
      { menu_key: '/tendering/evaluations', label: '评标管理', order_index: 4, is_active: 1 },
      { menu_key: '/tendering/statistics', label: '招标统计', order_index: 5, is_active: 1 },
      { menu_key: '/tendering/qrcodes', label: '二维码管理', order_index: 6, is_active: 1 },
    ],
  },
  {
    menu_key: '/ai-assistant-parent',
    icon: 'RobotOutlined',
    label: 'AI模块',
    order_index: 16,
    is_active: 1,
    module_id: 'asset-ai-assistant',
    children: [
      { menu_key: '/ai-assistant', label: '资产AI助手', order_index: 1, is_active: 1 },
    ],
  },
  {
    menu_key: '/inspection-parent',
    icon: 'ReconciliationOutlined',
    label: '巡检管理',
    order_index: 17,
    is_active: 1,
    children: [
      { menu_key: '/inspection', label: '巡检任务', order_index: 1, is_active: 1 },
      { menu_key: '/inspection/records', label: '巡检记录单', order_index: 2, is_active: 1 },
      { menu_key: '/inspection/templates', label: '巡检模板', order_index: 3, is_active: 1 },
      { menu_key: '/inspection/issues', label: '异常问题', order_index: 4, is_active: 1 },
      { menu_key: '/inspection/statistics', label: '巡检统计', order_index: 5, is_active: 1 },
    ],
  },
  {
    menu_key: '/system-parent',
    icon: 'SettingOutlined',
    label: '系统管理',
    order_index: 999,
    is_active: 1,
    roles: ['super_admin', 'system_admin'],
    children: [
      { menu_key: '/system-settings', label: '系统设置', order_index: 0, is_active: 1, roles: ['super_admin'] },
      { menu_key: '/modules', label: '模块管理', order_index: 1, is_active: 1, module_id: 'module-management' },
      { menu_key: '/tenants', label: '企业管理', order_index: 2, is_active: 1, roles: ['super_admin'] },
      { menu_key: '/tenant-management', label: '租户管理', order_index: 3, is_active: 1, roles: ['super_admin'] },
      { menu_key: '/users', label: '用户管理', order_index: 4, is_active: 1, module_id: 'user-management' },
      { menu_key: '/user-roles', label: '用户与角色', order_index: 5, is_active: 1 },
      { menu_key: '/data-scope', label: '数据权限', order_index: 6, is_active: 1 },
      { menu_key: '/departments', label: '部门管理', order_index: 7, is_active: 1, module_id: 'department-management' },
      { menu_key: '/roles-permissions', label: '权限管理', order_index: 8, is_active: 1 },
      { menu_key: '/tenant-role-config', label: '租户角色配置', order_index: 9, is_active: 1, roles: ['super_admin', 'system_admin'] },
      { menu_key: '/tenant-module-config', label: '模块设置', order_index: 10, is_active: 1, module_id: 'module-management' },
      { menu_key: '/dashboard-configs', label: '仪表盘配置', order_index: 10, is_active: 1, module_id: 'dashboard' },
      { menu_key: '/cloud-sync', label: '云/IoT 同步', order_index: 11, is_active: 1 },
      { menu_key: '/audit-logs', label: '操作日志', order_index: 12, is_active: 1 },
      { menu_key: '/backup', label: '数据库备份', order_index: 13, is_active: 1 },
      { menu_key: '/database-connection', label: '数据库连接管理', order_index: 14, is_active: 1, roles: ['super_admin'] },
      { menu_key: '/feishu-config', label: '飞书配置', order_index: 15, is_active: 1 },
      { menu_key: '/tenant-access-url', label: '访问域名配置', order_index: 16, is_active: 1 },
      { menu_key: '/email-config', label: '邮件配置', order_index: 17, is_active: 1 },
      { menu_key: '/notification-config', label: '通知配置', order_index: 17.5, is_active: 1 },
      { menu_key: '/api-docs', label: 'Swagger API 文档', order_index: 18, is_active: 1, roles: ['super_admin'] },
      { menu_key: '/api-documentation', label: '完整API文档', order_index: 19, is_active: 1, roles: ['super_admin'] },
      { menu_key: '/system/token-management', label: 'Token管理', order_index: 20, is_active: 1 },
    ],
  },
];

// 旧的 BUILT_IN_MENUS 保留用于兼容（包含所有业务菜单）
const BUILT_IN_MENUS = [
  {
    menu_key: '/assets-parent',
    icon: 'AppstoreOutlined',
    label: '资产主数据',
    order_index: 1,
    is_active: 1,
    children: [
      { menu_key: '/assets', label: '资产列表', order_index: 1, is_active: 1 },
      { menu_key: '/assets/add', label: '添加资产', order_index: 2, is_active: 1 },
      { menu_key: '/inventory', label: '资产盘点', order_index: 3, is_active: 1 },
      { menu_key: '/inventory/self', label: '我的资产盘点', order_index: 4, is_active: 1 },
      { menu_key: '/temp-assets', label: '临时资产', order_index: 5, is_active: 1 },
      { menu_key: '/asset-labels/templates', label: '标签模板管理', order_index: 6, is_active: 1 },
      { menu_key: '/asset-labels/print', label: '标签打印', order_index: 7, is_active: 1 },
      { menu_key: '/assets/import', label: '导入资产', order_index: 8, is_active: 1 },
    ],
  },
  {
    menu_key: '/tendering/suppliers',
    icon: 'ShopOutlined',
    label: '供应商管理',
    order_index: 1.5,
    is_active: 1,
  },
  {
    menu_key: '/transfer-parent',
    icon: 'SwapOutlined',
    label: '资产调配',
    order_index: 2,
    is_active: 1,
    children: [
      { menu_key: '/transfer', label: '调配记录', order_index: 1, is_active: 1 },
      { menu_key: '/transfer/new', label: '调配申请', order_index: 2, is_active: 1 },
      { menu_key: '/transfer/requests', label: '调配申请处理', order_index: 3, is_active: 1 },
    ],
  },
  {
    menu_key: '/depreciation-parent',
    icon: 'DollarOutlined',
    label: '财务管理',
    order_index: 3,
    is_active: 1,
    children: [{ menu_key: '/depreciation', label: '资产折旧', order_index: 1, is_active: 1 }],
  },
  {
    menu_key: '/idle',
    icon: 'GiftOutlined',
    label: '闲置资产',
    order_index: 4,
    is_active: 1,
  },
  {
    menu_key: '/maintenance-parent',
    icon: 'ToolOutlined',
    label: '维修维护',
    order_index: 5,
    is_active: 1,
    children: [
      { menu_key: '/maintenance/logs', label: '维修日志', order_index: 1, is_active: 1 },
      { menu_key: '/maintenance/plans', label: '预防性维护', order_index: 2, is_active: 1 },
      { menu_key: '/maintenance/templates', label: '维护计划模板', order_index: 3, is_active: 1 },
      { menu_key: '/maintenance/requests', label: '维修申请', order_index: 4, is_active: 1 },
      { menu_key: '/maintenance/efficiency', label: '维护效率分析', order_index: 5, is_active: 1 },
      { menu_key: '/maintenance/reminders', label: '维护提醒管理', order_index: 6, is_active: 1 },
      { menu_key: '/maintenance/usage-triggers', label: '阈值触发管理', order_index: 7, is_active: 1 },
      { menu_key: '/maintenance/asset-usage', label: '资产使用量管理', order_index: 8, is_active: 1 },
      { menu_key: '/maintenance/workorders', label: '调度中心', order_index: 0, is_active: 1 },
    ],
  },
  {
    menu_key: '/asset-monitoring-parent',
    icon: 'EnvironmentOutlined',
    label: '资产定位',
    order_index: 6,
    is_active: 1,
    children: [
      { menu_key: '/asset-location', label: '地理定位', order_index: 1, is_active: 1 },
      { menu_key: '/beacon-location', label: '区域定位', order_index: 2, is_active: 1 },
      { menu_key: '/iot-devices', label: '区域定位配置', order_index: 3, is_active: 1 },
    ],
  },
  {
    menu_key: '/technical-documents-parent',
    icon: 'FileTextOutlined',
    label: '技术资料',
    order_index: 7,
    is_active: 1,
    children: [
      { menu_key: '/technical-documents', label: '资料列表', order_index: 1, is_active: 1 },
      { menu_key: '/technical-documents/upload', label: '上传资料', order_index: 2, is_active: 1 },
      { menu_key: '/technical-documents/batch-upload', label: '资料批量上传', order_index: 3, is_active: 1 },
      { menu_key: '/technical-documents/review', label: '资料审核', order_index: 4, is_active: 1 },
    ],
  },
  {
    menu_key: '/quality-control-parent',
    icon: 'ExperimentOutlined',
    label: '质量管理',
    order_index: 8,
    is_active: 1,
    children: [
      { menu_key: '/quality-control/metrology', label: '计量管理', order_index: 1, is_active: 1 },
      { menu_key: '/quality-control/metrology/upload', label: '报告智能识别', order_index: 2, is_active: 1 },
      { menu_key: '/quality-control/qc', label: '质控管理', order_index: 3, is_active: 1 },
      { menu_key: '/quality-control/statistics', label: '统计分析', order_index: 4, is_active: 1 },
      { menu_key: '/adverse-reaction', label: '不良事件管理', order_index: 5, is_active: 1 },
    ],
  },
  {
    menu_key: '/acceptance-parent',
    icon: 'CheckCircleOutlined',
    label: '验收管理',
    order_index: 9,
    is_active: 1,
    children: [
      { menu_key: '/acceptance', label: '验收记录', order_index: 1, is_active: 1 },
      { menu_key: '/acceptance/create', label: '创建验收记录', order_index: 2, is_active: 1 },
    ],
  },
];

/**
 * 完整菜单定义（单一数据源）
 * 包含所有业务菜单项，通过 roles/module_id 字段控制可见性
 * - roles: 角色白名单，未设置则所有角色可见
 * - module_id: 关联模块，受租户模块启用状态控制
 *
 * 一级菜单按“使用频率（高频在前）”原则排列：
 * 仪表盘 → 资产主数据 → 维修维护 → 盘点管理 → 资产调配 → 资产定位与IoT
 * → 质量管理 → 验收管理 → 闲置资产 → 财务管理 → 技术资料
 * → 供应商管理 → 合同管理 → 招标采购 → 合规模块 → 巡检管理 → 风险管理
 * → 人员资质 → 开机率管理 → AI模块 → 系统管理
 */
const ALL_MENUS = [
  {
    menu_key: '/dashboard',
    icon: 'DashboardOutlined',
    label: '仪表盘',
    order_index: 1,
    is_active: 1,
  },
  {
    menu_key: '/assets-parent',
    icon: 'AppstoreOutlined',
    label: '资产主数据',
    order_index: 2,
    is_active: 1,
    module_id: 'asset-management',
    children: [
      { menu_key: '/assets', label: '资产列表', order_index: 1, is_active: 1 },
      { menu_key: '/assets/add', label: '添加资产', order_index: 2, is_active: 1 },
      { menu_key: '/temp-assets', label: '临时资产', order_index: 3, is_active: 1 },
      { menu_key: '/asset-labels/templates', label: '标签模板管理', order_index: 4, is_active: 1 },
      { menu_key: '/asset-labels/print', label: '标签打印', order_index: 5, is_active: 1 },
      {
        menu_key: '/assets/import',
        label: '导入资产',
        order_index: 6,
        is_active: 1,
        roles: ['super_admin', 'system_admin'],
      },
    ],
  },
  {
    menu_key: '/maintenance-parent',
    icon: 'ToolOutlined',
    label: '维修维护',
    order_index: 3,
    is_active: 1,
    module_id: 'maintenance-management',
    children: [
      { menu_key: '/maintenance/logs', label: '维修日志', order_index: 1, is_active: 1 },
      { menu_key: '/maintenance/temporary', label: '临时保养', order_index: 2, is_active: 1 },
      { menu_key: '/maintenance/plans', label: '预防性维护', order_index: 3, is_active: 1 },
      { menu_key: '/maintenance/templates', label: '维护计划模板', order_index: 4, is_active: 1 },
      { menu_key: '/maintenance/requests', label: '维修申请', order_index: 5, is_active: 1 },
      { menu_key: '/maintenance/workorders', label: '调度中心', order_index: 0, is_active: 1 },
      { menu_key: '/maintenance/efficiency', label: '维护效率分析', order_index: 7, is_active: 1 },
      { menu_key: '/maintenance/reminders', label: '维护提醒管理', order_index: 8, is_active: 1 },
      { menu_key: '/maintenance/warranty', label: '保修管理', order_index: 9, is_active: 1 },
      { menu_key: '/maintenance/warranty-contracts', label: '保修合同管理', order_index: 10, is_active: 1 },
      { menu_key: '/maintenance/warranty-reminders', label: '保修到期提醒', order_index: 11, is_active: 1 },
      { menu_key: '/maintenance/usage-triggers', label: '阈值触发管理', order_index: 12, is_active: 1 },
      { menu_key: '/maintenance/asset-usage', label: '资产使用量管理', order_index: 13, is_active: 1 },
      { menu_key: '/maintenance/costs', label: '维护成本管理', order_index: 14, is_active: 1 },
      { menu_key: '/maintenance/evaluations', label: '维护效果评估', order_index: 15, is_active: 1 },
    ],
  },
  {
    menu_key: '/inventory-parent',
    icon: 'FileSearchOutlined',
    label: '盘点管理',
    order_index: 4,
    is_active: 1,
    children: [
      { menu_key: '/inventory', label: '资产盘点列表', order_index: 1, is_active: 1 },
      { menu_key: '/inventory/self', label: '我的资产盘点', order_index: 2, is_active: 1 },
      { menu_key: '/inventory/new', label: '新建盘点', order_index: 3, is_active: 1 },
    ],
  },
  {
    menu_key: '/transfer-parent',
    icon: 'SwapOutlined',
    label: '资产调配',
    order_index: 5,
    is_active: 1,
    module_id: 'asset-management',
    children: [
      { menu_key: '/transfer', label: '调配记录', order_index: 1, is_active: 1 },
      { menu_key: '/transfer/new', label: '调配申请', order_index: 2, is_active: 1 },
      {
        menu_key: '/transfer/requests',
        label: '调配申请处理',
        order_index: 3,
        is_active: 1,
        roles: ['super_admin', 'system_admin'],
      },
    ],
  },
  {
    menu_key: '/asset-monitoring-parent',
    icon: 'EnvironmentOutlined',
    label: '资产定位与IoT',
    order_index: 6,
    is_active: 1,
    module_id: 'iot-management',
    children: [
      { menu_key: '/asset-location', label: '地理定位', order_index: 1, is_active: 1 },
      { menu_key: '/beacon-location', label: '区域定位', order_index: 2, is_active: 1 },
      { menu_key: '/iot-devices', label: 'IoT设备管理', order_index: 3, is_active: 1 },
      { menu_key: '/asset-monitoring', label: '资产监测', order_index: 4, is_active: 1 },
      { menu_key: '/environment-monitoring', label: '环境监测', order_index: 5, is_active: 1 },
    ],
  },
  {
    menu_key: '/quality-control-parent',
    icon: 'ExperimentOutlined',
    label: '质量管理',
    order_index: 7,
    is_active: 1,
    module_id: 'quality-control',
    children: [
      { menu_key: '/quality-control/metrology', label: '计量管理', order_index: 1, is_active: 1 },
      { menu_key: '/quality-control/metrology/management', label: '计量管理页', order_index: 2, is_active: 1 },
      { menu_key: '/quality-control/qc', label: '质控管理', order_index: 3, is_active: 1 },
      { menu_key: '/quality-control/statistics', label: '统计分析', order_index: 4, is_active: 1 },
      { menu_key: '/quality-control/management', label: '质量管理总览', order_index: 5, is_active: 1 },
      { menu_key: '/adverse-reaction', label: '不良事件管理', order_index: 6, is_active: 1 },
      { menu_key: '/quality-control/metrology/upload', label: '报告智能识别', order_index: 7, is_active: 1 },
    ],
  },
  {
    menu_key: '/acceptance-parent',
    icon: 'CheckCircleOutlined',
    label: '验收管理',
    order_index: 8,
    is_active: 1,
    children: [
      { menu_key: '/acceptance', label: '验收记录', order_index: 1, is_active: 1 },
      { menu_key: '/acceptance/create', label: '创建验收记录', order_index: 2, is_active: 1 },
      { menu_key: '/acceptance/applications', label: '验收申请', order_index: 3, is_active: 1 },
      { menu_key: '/acceptance/templates', label: '验收模板', order_index: 4, is_active: 1 },
      { menu_key: '/acceptance/statistics', label: '验收统计', order_index: 5, is_active: 1 },
    ],
  },
  {
    menu_key: '/idle-parent',
    icon: 'GiftOutlined',
    label: '闲置资产',
    order_index: 9,
    is_active: 1,
    children: [
      { menu_key: '/idle', label: '闲置资产列表', order_index: 1, is_active: 1 },
      { menu_key: '/idle/new', label: '新增闲置资产', order_index: 2, is_active: 1 },
    ],
  },
  {
    menu_key: '/depreciation-parent',
    icon: 'DollarOutlined',
    label: '财务管理',
    order_index: 10,
    is_active: 1,
    module_id: 'depreciation-management',
    children: [
      { menu_key: '/depreciation', label: '资产折旧', order_index: 1, is_active: 1 },
      { menu_key: '/finance/budget', label: '预算管理', order_index: 2, is_active: 1 },
      { menu_key: '/finance/transactions', label: '收支记录', order_index: 3, is_active: 1 },
      { menu_key: '/finance/reports', label: '财务报表', order_index: 4, is_active: 1 },
    ],
  },
  {
    menu_key: '/technical-documents-parent',
    icon: 'FileTextOutlined',
    label: '技术资料',
    order_index: 11,
    is_active: 1,
    children: [
      { menu_key: '/technical-documents', label: '资料列表', order_index: 1, is_active: 1 },
      { menu_key: '/technical-documents/upload', label: '资料上传', order_index: 2, is_active: 1 },
      { menu_key: '/technical-documents/batch-upload', label: '资料批量上传', order_index: 3, is_active: 1 },
      { menu_key: '/technical-documents/review', label: '资料审核', order_index: 4, is_active: 1 },
    ],
  },
  {
    menu_key: '/tendering/suppliers',
    icon: 'ShopOutlined',
    label: '供应商管理',
    order_index: 12,
    is_active: 1,
  },
  {
    menu_key: '/tendering/contracts',
    icon: 'FileProtectOutlined',
    label: '合同管理',
    order_index: 13,
    is_active: 1,
  },
  {
    menu_key: '/tendering-parent',
    icon: 'AuditOutlined',
    label: '招标采购',
    order_index: 14,
    is_active: 1,
    children: [
      { menu_key: '/tendering/dashboard', label: '统计概览', order_index: 1, is_active: 1 },
      { menu_key: '/tendering/projects', label: '招标项目管理', order_index: 2, is_active: 1 },
      { menu_key: '/tendering/bids', label: '投标管理', order_index: 3, is_active: 1 },
      { menu_key: '/tendering/evaluations', label: '评标管理', order_index: 4, is_active: 1 },
      { menu_key: '/tendering/statistics', label: '招标统计', order_index: 5, is_active: 1 },
      { menu_key: '/tendering/qrcodes', label: '二维码管理', order_index: 6, is_active: 1 },
    ],
  },
  {
    menu_key: '/compliance-parent',
    icon: 'SafetyOutlined',
    label: '合规模块',
    order_index: 15,
    is_active: 1,
    module_id: 'compliance-management',
    children: [
      { menu_key: '/compliance', label: '合规仪表盘', order_index: 1, is_active: 1 },
      { menu_key: '/compliance/maintenance-level', label: '维护等级', order_index: 2, is_active: 1 },
      { menu_key: '/special-equipment', label: '特种设备', order_index: 3, is_active: 1 },
      { menu_key: '/safety-inspection', label: '安全巡检', order_index: 4, is_active: 1 },
    ],
  },
  {
    menu_key: '/inspection-parent',
    icon: 'ReconciliationOutlined',
    label: '巡检管理',
    order_index: 16,
    is_active: 1,
    children: [
      { menu_key: '/inspection', label: '巡检任务', order_index: 1, is_active: 1 },
      { menu_key: '/inspection/records', label: '巡检记录单', order_index: 2, is_active: 1 },
      { menu_key: '/inspection/templates', label: '巡检模板', order_index: 3, is_active: 1 },
      { menu_key: '/inspection/issues', label: '异常问题', order_index: 4, is_active: 1 },
      { menu_key: '/inspection/statistics', label: '巡检统计', order_index: 5, is_active: 1 },
    ],
  },
  {
    menu_key: '/risk-parent',
    icon: 'WarningOutlined',
    label: '风险管理',
    order_index: 17,
    is_active: 1,
    module_id: 'asset-risk-management',
    children: [
      { menu_key: '/risk', label: '风险仪表盘', order_index: 1, is_active: 1 },
      { menu_key: '/risk/assessment', label: '风险评估', order_index: 2, is_active: 1 },
      { menu_key: '/risk/classification', label: '风险分类', order_index: 3, is_active: 1 },
      { menu_key: '/risk/control', label: '风险控制', order_index: 4, is_active: 1 },
    ],
  },
  {
    menu_key: '/staff-parent',
    icon: 'UserOutlined',
    label: '人员资质',
    order_index: 18,
    is_active: 1,
    module_id: 'staff-qualification',
    children: [
      { menu_key: '/staff', label: '人员仪表盘', order_index: 1, is_active: 1 },
      { menu_key: '/staff/qualifications', label: '资质管理', order_index: 2, is_active: 1 },
      { menu_key: '/staff/training', label: '培训管理', order_index: 3, is_active: 1 },
      { menu_key: '/staff/assessments', label: '能力评估', order_index: 4, is_active: 1 },
    ],
  },
  {
    menu_key: '/uptime-parent',
    icon: 'DashboardOutlined',
    label: '开机率管理',
    order_index: 19,
    is_active: 1,
    module_id: 'uptime-management',
    children: [
      { menu_key: '/uptime', label: '开机率仪表盘', order_index: 1, is_active: 1 },
      { menu_key: '/uptime/overview', label: '开机率概览', order_index: 2, is_active: 1 },
      { menu_key: '/uptime/operation-logs', label: '运行日志', order_index: 3, is_active: 1 },
      { menu_key: '/uptime/statistics', label: '开机率统计', order_index: 4, is_active: 1 },
    ],
  },
  {
    menu_key: '/ai-assistant-parent',
    icon: 'RobotOutlined',
    label: 'AI模块',
    order_index: 20,
    is_active: 1,
    module_id: 'asset-ai-assistant',
    children: [
      { menu_key: '/ai-assistant', label: '资产AI助手', order_index: 1, is_active: 1 },
    ],
  },
  {
    menu_key: '/system-parent',
    icon: 'SettingOutlined',
    label: '系统管理',
    order_index: 21,
    is_active: 1,
    roles: ['super_admin', 'system_admin'],
    module_id: null,
    children: [
      { menu_key: '/system-settings', label: '系统设置', order_index: 0, is_active: 1, roles: ['super_admin'] },
      { menu_key: '/modules', label: '模块管理', order_index: 1, is_active: 1, module_id: 'module-management' },
      {
        menu_key: '/tenants',
        label: '企业管理',
        order_index: 2,
        is_active: 1,
        roles: ['super_admin'],
      },
      {
        menu_key: '/tenant-management',
        label: '租户管理',
        order_index: 3,
        is_active: 1,
        roles: ['super_admin'],
      },
      { menu_key: '/users', label: '用户管理', order_index: 4, is_active: 1, module_id: 'user-management' },
      { menu_key: '/user-roles', label: '用户与角色', order_index: 5, is_active: 1 },
      { menu_key: '/data-scope', label: '数据权限', order_index: 6, is_active: 1 },
      { menu_key: '/departments', label: '部门管理', order_index: 7, is_active: 1, module_id: 'department-management' },
      { menu_key: '/roles-permissions', label: '权限管理', order_index: 8, is_active: 1 },
      { menu_key: '/tenant-role-config', label: '租户角色配置', order_index: 9, is_active: 1, roles: ['super_admin', 'system_admin'] },
      { menu_key: '/tenant-module-config', label: '模块设置', order_index: 10, is_active: 1, module_id: 'module-management' },
      { menu_key: '/dashboard-configs', label: '仪表盘配置', order_index: 10, is_active: 1, module_id: 'dashboard' },
      { menu_key: '/cloud-sync', label: '云/IoT 同步', order_index: 11, is_active: 1 },
      { menu_key: '/audit-logs', label: '操作日志', order_index: 12, is_active: 1 },
      { menu_key: '/backup', label: '数据库备份', order_index: 13, is_active: 1 },
      {
        menu_key: '/database-connection',
        label: '数据库连接管理',
        order_index: 14,
        is_active: 1,
        roles: ['super_admin'],
      },
      { menu_key: '/feishu-config', label: '飞书配置', order_index: 15, is_active: 1 },
      { menu_key: '/tenant-access-url', label: '访问域名配置', order_index: 16, is_active: 1 },
      { menu_key: '/email-config', label: '邮件配置', order_index: 17, is_active: 1 },
      { menu_key: '/notification-config', label: '通知配置', order_index: 17.5, is_active: 1 },
      {
        menu_key: '/api-docs',
        label: 'Swagger API 文档',
        order_index: 18,
        is_active: 1,
        roles: ['super_admin'],
      },
      {
        menu_key: '/api-documentation',
        label: '完整API文档',
        order_index: 19,
        is_active: 1,
        roles: ['super_admin'],
      },
      { menu_key: '/system/token-management', label: 'Token管理', order_index: 20, is_active: 1 },
    ],
  },
];

const ICON_MAP = {
  DashboardOutlined: 'DashboardOutlined',
  AppstoreOutlined: 'AppstoreOutlined',
  FileSearchOutlined: 'FileSearchOutlined',
  SwapOutlined: 'SwapOutlined',
  GiftOutlined: 'GiftOutlined',
  UserOutlined: 'UserOutlined',
  LogoutOutlined: 'LogoutOutlined',
  MenuOutlined: 'MenuOutlined',
  ApartmentOutlined: 'ApartmentOutlined',
  ToolOutlined: 'ToolOutlined',
  EnvironmentOutlined: 'EnvironmentOutlined',
  FileTextOutlined: 'FileTextOutlined',
  SettingOutlined: 'SettingOutlined',
  AuditOutlined: 'AuditOutlined',
  CheckCircleOutlined: 'CheckCircleOutlined',
  RobotOutlined: 'RobotOutlined',
  ExperimentOutlined: 'ExperimentOutlined',
  WarningOutlined: 'WarningOutlined',
  PrinterOutlined: 'PrinterOutlined',
  MessageOutlined: 'MessageOutlined',
  ApiOutlined: 'ApiOutlined',
  DollarOutlined: 'DollarOutlined',
  ShopOutlined: 'ShopOutlined',
  SafetyOutlined: 'SafetyOutlined',
  AlertOutlined: 'AlertOutlined',
  ReconciliationOutlined: 'ReconciliationOutlined',
  ProfileOutlined: 'ProfileOutlined',
  BarChartOutlined: 'BarChartOutlined',
  FileProtectOutlined: 'FileProtectOutlined',
};

function buildMenuTree(menus, parentKey = null) {
  const result = [];

  for (const menu of menus) {
    if (menu.parent_key === parentKey) {
      const item = {
        key: menu.menu_key,
        label: menu.label || menu.menu_label,  // 与 normalizeBuiltInTree 保持一致：JavaScript 对象优先
        icon: menu.icon,
        order_index: menu.order_index,
        is_active: menu.is_active,
      };

      const children = menus.filter(m => m.parent_key === menu.menu_key);
      if (children.length > 0) {
        item.children = buildMenuTree(children, menu.menu_key);
      }

      result.push(item);
    }
  }

  return result.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
}

function getAllMenuKeys(menus, keys = []) {
  for (const menu of menus) {
    keys.push(menu.menu_key || menu.key);
    if (menu.children) {
      getAllMenuKeys(menu.children, keys);
    }
  }
  return keys;
}

function mergeMenuTrees(primary = [], secondary = []) {
  // 递归收集 primary 树中所有 key（任意深度），用于判断 secondary 的 key 是否已存在
  const primaryKeySet = new Set();
  const collectPrimaryKeys = (nodes) => {
    for (const n of nodes) {
      if (n?.key) primaryKeySet.add(n.key);
      if (Array.isArray(n?.children)) collectPrimaryKeys(n.children);
    }
  };
  collectPrimaryKeys(primary);

  // 浅克隆 primary 顶层节点（避免直接修改入参），保留树形结构
  const result = primary.map(n => ({
    ...n,
    children: Array.isArray(n?.children) ? n.children.map(c => ({ ...c })) : undefined,
  }));

  // 在 result 树中按 key 查找节点
  const findInResult = (key) => {
    const walk = (nodes) => {
      for (const n of nodes) {
        if (n?.key === key) return n;
        if (Array.isArray(n?.children)) {
          const found = walk(n.children);
          if (found) return found;
        }
      }
      return null;
    };
    return walk(result);
  };

  // 处理 secondary 根节点：
  //   1) key 已在 primary 树中 → 合并 children（跳过已在 primary 中的子项），不再新增 root
  //   2) key 不在 primary 中 → 作为新 root 加入，但子树中所有 key 已在 primary 中的子项必须剔除
  const filterChildren = (children) => {
    if (!Array.isArray(children)) return undefined;
    const filtered = [];
    for (const c of children) {
      if (!c?.key) continue;
      if (primaryKeySet.has(c.key)) continue; // 跳过已在 primary 中的子项
      filtered.push({
        ...c,
        children: filterChildren(c.children),
      });
    }
    return filtered.length > 0 ? filtered : undefined;
  };

  for (const sec of secondary) {
    if (!sec?.key) continue;

    if (primaryKeySet.has(sec.key)) {
      const existing = findInResult(sec.key);
      if (existing && Array.isArray(sec.children) && sec.children.length > 0) {
        if (!Array.isArray(existing.children)) existing.children = [];
        for (const child of sec.children) {
          if (!child?.key) continue;
          // 子项若已在 primary 树中（含父级、兄弟级位置），跳过避免重复
          if (primaryKeySet.has(child.key)) continue;
          if (existing.children.some(c => c?.key === child.key)) continue;
          existing.children.push({
            ...child,
            children: filterChildren(child.children),
          });
        }
      }
      continue;
    }

    // key 不在 primary 中，作为新 root 加入（递归剔除子树中已存在的 key）
    const filteredChildren = filterChildren(sec.children);
    result.push({
      ...sec,
      children: filteredChildren,
    });
  }

  // 顶层按 order_index 排序
  return result.slice().sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
}

async function getMenusFromDatabase(tenantId) {
  try {
    const [rows] = await db.execute(
      'SELECT menu_key, menu_label, parent_key, icon, order_index, is_active FROM menu_definitions ORDER BY order_index',
    );
    return rows;
  } catch (error) {
    return null;
  }
}

/**
 * 根据租户启用模块获取菜单
 * @param {string|number} tenantId - 租户ID
 * @returns {Promise<Array>} 合并后的菜单列表
 */
async function getMenusByTenantModules(tenantId) {
  try {
    if (!tenantId) {
      console.log('[菜单] tenantId 为空，跳过模块菜单查询');
      return null;
    }

    const enabledModules = await getEnabledModuleIds(tenantId);
    const moduleIds = Array.from(enabledModules);
    if (moduleIds.length === 0) {
      return null;
    }

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
    } catch (error) {
      console.warn('[菜单] 读取 tenant_module_menus 失败，改用模块定义直接生成:', error.message);
    }

    const collectedMenus = new Map();
    for (const moduleId of moduleIds) {
      const moduleMenus = await getModuleMenuDefinitions(moduleId);
      const filteredMenus = filterMenuDefinitionsByTenantConfig(
        moduleMenus,
        tenantMenuRowsByModule.get(moduleId) || [],
      );

      filteredMenus.forEach(menu => {
        if (!menu?.menu_key || collectedMenus.has(menu.menu_key)) {
          return;
        }
        collectedMenus.set(menu.menu_key, menu);
      });
    }

    return collectedMenus.size > 0 ? Array.from(collectedMenus.values()) : null;
  } catch (error) {
    console.error('根据模块获取菜单失败:', error);
    return null;
  }
}

/**
 * 获取租户已启用的模块ID列表
 * @param {string|number} tenantId - 租户ID
 * @returns {Promise<Set<string>>} 模块ID集合
 */
async function getEnabledModuleIds(tenantId) {
  try {
    const enabledModules = new Set();

    try {
      const [tenantConfigs] = await db.execute(
        'SELECT module_id FROM tenant_module_configs WHERE tenant_id = ? AND enabled = 1',
        [tenantId],
      );
      if (Array.isArray(tenantConfigs)) {
        tenantConfigs.forEach(row => row?.module_id && enabledModules.add(row.module_id));
      }
    } catch (tableError) {
      console.log('[菜单] tenant_module_configs 表不存在或查询失败，使用兼容菜单');
    }

    if (enabledModules.size === 0) {
      console.log('[菜单] 未找到模块配置，返回所有默认菜单');
      ALL_MENUS.forEach(menu => {
        if (menu.module_id) {
          enabledModules.add(menu.module_id);
        }
      });
    }

    return enabledModules;
  } catch (error) {
    console.error('获取启用模块列表失败:', error);
    return new Set();
  }
}

/**
 * 递归检查菜单项是否应该显示（根据模块配置）
 * 规则：
 * 1. 子菜单继承父菜单的 module_id（如果没有自己的 module_id）
 * 2. 有 module_id 的菜单，受模块控制：module_id 不在启用列表中则不显示
 * 3. 无 module_id 且无 roles 的菜单：始终显示（叶子菜单）或受子菜单控制（父菜单）
 * 4. 有 roles 的菜单：受角色控制
 */
function filterMenusByModule(menus, enabledModules, userRole, parentModuleId = null) {
  const result = [];

  for (const menu of menus) {
    // 子菜单继承父菜单的 module_id
    const effectiveModuleId = menu.module_id || parentModuleId;

    // 检查角色权限
    if (menu.roles && menu.roles.length > 0 && !menu.roles.includes(userRole)) {
      continue;
    }

    // 有 module_id 的菜单，受模块控制
    if (effectiveModuleId) {
      if (!enabledModules.has(effectiveModuleId)) {
        continue; // 模块未启用，跳过整个菜单树
      }
    }

    // 递归处理子菜单
    if (menu.children && menu.children.length > 0) {
      const filteredChildren = filterMenusByModule(menu.children, enabledModules, userRole, effectiveModuleId);
      // 只有当有可见子菜单时才添加父菜单
      if (filteredChildren.length > 0) {
        result.push({
          ...menu,
          module_id: effectiveModuleId, // 确保 module_id 被设置
          children: filteredChildren,
        });
      }
    } else {
      // 叶子菜单
      result.push({
        ...menu,
        module_id: effectiveModuleId,
      });
    }
  }

  return result;
}

/**
 * 获取租户的模块配置菜单（用于合并默认菜单和模块菜单）
 * @param {string|number} tenantId - 租户ID
 * @param {string} userRole - 用户角色
 * @returns {Promise<Object>} 包含默认菜单和模块菜单的对象
 */
async function getMergedMenusByModules(tenantId, userRole) {
  // 获取已启用的模块列表
  const enabledModules = await getEnabledModuleIds(tenantId);
  // 获取模块配置的菜单
  const moduleMenus = await getMenusByTenantModules(tenantId);

  // 根据模块配置和角色过滤完整菜单
  const filteredMenus = filterMenusByModule(ALL_MENUS, enabledModules, userRole);

  console.log('[菜单] 已启用模块:', Array.from(enabledModules));
  console.log('[菜单] 过滤后菜单数量:', filteredMenus.length);

  return {
    defaultMenus: filteredMenus,
    moduleMenus,
    source: moduleMenus ? 'modules' : 'builtin',
  };
}

function normalizeBuiltInTree(menus = [], parentModuleId = null) {
  const nodes = menus.map(menu => {
    // 子菜单继承父菜单的 module_id
    const moduleId = menu.module_id || parentModuleId;
    return {
      key: menu.menu_key || menu.key,
      label: menu.label || menu.menu_label,
      icon: menu.icon,
      order_index: menu.order_index,
      is_active: menu.is_active,
      module_id: moduleId,
      roles: menu.roles,
      ...(Array.isArray(menu.children) && menu.children.length > 0
        ? { children: normalizeBuiltInTree(menu.children, moduleId) }
        : {}),
    };
  });

  return nodes.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
}

router.get('/menus/menu-tree', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const userRole = req.user?.role;
    console.log('[菜单] /menus/menu-tree 被调用, tenantId:', tenantId, 'user role:', userRole);

    const mergedResult = await getMergedMenusByModules(tenantId, userRole);
    console.log('[菜单] mergedResult source:', mergedResult.source, 'moduleMenus count:', mergedResult.moduleMenus?.length);

    // 使用 ALL_MENUS 过滤后的结果作为基础菜单树
    let finalMenus = normalizeBuiltInTree(mergedResult.defaultMenus);

    // 如果有模块自定义菜单，合并到基础菜单树
    if (mergedResult.moduleMenus && mergedResult.moduleMenus.length > 0) {
      const moduleMenuTree = buildMenuTree(mergedResult.moduleMenus);
      finalMenus = mergeMenuTrees(finalMenus, moduleMenuTree);
      console.log('[菜单] 合并模块菜单后, finalMenus count:', finalMenus.length);
    }

    // 用 ALL_MENUS 的权威顺序，对一级菜单最终兜底排序一次
    const authoritativeOrder = new Map(ALL_MENUS.map((m, idx) => [m.menu_key, m.order_index || idx + 1]));
    finalMenus = finalMenus.slice().sort((a, b) => {
      const orderA = authoritativeOrder.has(a.key) ? authoritativeOrder.get(a.key) : 9999;
      const orderB = authoritativeOrder.has(b.key) ? authoritativeOrder.get(b.key) : 9999;
      if (orderA !== orderB) return orderA - orderB;
      return (a.order_index || 0) - (b.order_index || 0);
    });

    const allKeys = getAllMenuKeys(finalMenus);

    console.log('[菜单] finalMenus keys:', finalMenus.map(m => m.key + ':' + (m.label || '')).join(', '));

    res.json({
      success: true,
      data: {
        menus: finalMenus,
        allKeys,
        source: mergedResult.source,
        defaultMenus: ALL_MENUS.filter(m => !m.roles || m.roles.length === 0).map(m => m.menu_key),
      },
    });
  } catch (error) {
    console.error('获取菜单树失败:', error);
    res.status(500).json({
      success: false,
      message: error.message,
      data: {
        menus: normalizeBuiltInTree(ALL_MENUS),
        allKeys: getAllMenuKeys(normalizeBuiltInTree(ALL_MENUS)),
        source: 'builtin',
        defaultMenus: ALL_MENUS.filter(m => !m.roles || m.roles.length === 0).map(m => m.menu_key),
      },
    });
  }
});

router.get('/menus/menus', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const mergedResult = await getMergedMenusByModules(tenantId, req.user?.role);

    let finalMenus = normalizeBuiltInTree(mergedResult.defaultMenus);

    if (mergedResult.moduleMenus && mergedResult.moduleMenus.length > 0) {
      finalMenus = mergeMenuTrees(finalMenus, buildMenuTree(mergedResult.moduleMenus));
    }

    const authoritativeOrder = new Map(ALL_MENUS.map((m, idx) => [m.menu_key, m.order_index || idx + 1]));
    finalMenus = finalMenus.slice().sort((a, b) => {
      const orderA = authoritativeOrder.has(a.key) ? authoritativeOrder.get(a.key) : 9999;
      const orderB = authoritativeOrder.has(b.key) ? authoritativeOrder.get(b.key) : 9999;
      if (orderA !== orderB) return orderA - orderB;
      return (a.order_index || 0) - (b.order_index || 0);
    });

    const allKeys = getAllMenuKeys(finalMenus);

    res.json({
      success: true,
      data: {
        menus: finalMenus,
        allKeys,
        source: mergedResult.source,
        defaultMenus: ALL_MENUS.filter(m => !m.roles || m.roles.length === 0).map(m => m.menu_key),
      },
    });
  } catch (error) {
    console.error('获取菜单失败:', error);
    res.status(500).json({
      success: false,
      message: error.message,
      data: {
        menus: normalizeBuiltInTree(ALL_MENUS),
        allKeys: getAllMenuKeys(normalizeBuiltInTree(ALL_MENUS)),
        source: 'builtin',
        defaultMenus: ALL_MENUS.filter(m => !m.roles || m.roles.length === 0).map(m => m.menu_key),
      },
    });
  }
});

router.get('/menus/builtin-menus', (req, res) => {
  res.json({
    success: true,
    data: {
      defaultMenus: DEFAULT_MENUS,
      builtinMenus: BUILT_IN_MENUS,
    },
  });
});

router.get('/menus/default-menus', (req, res) => {
  res.json({
    success: true,
    data: DEFAULT_MENUS,
  });
});

module.exports = router;
