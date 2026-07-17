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
    menu_key: '/asset-dashboard',
    icon: 'MonitorOutlined',
    label: '资产状态监控平台',
    order_index: 2,
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
      { menu_key: '/clinical/dashboard', label: '临床平台', order_index: 7, is_active: 1 },
    ],
  },
  // 维修维护原统一父菜单 → 拆分为 5 个独立一级菜单（2026-07-16）
  //  1) 日常维修      /daily-maintenance-parent
  //  2) 预防性维护    /preventive-maintenance-parent
  //  3) 维修仪表盘    /maintenance-dashboard
  //  4) 备件库        /spare-parts-parent
  //  5) 应急调配      /emergency-parent
  {
    menu_key: '/daily-maintenance-parent',
    icon: 'ToolOutlined',
    label: '日常维修',
    order_index: 3,
    is_active: 1,
    module_id: 'maintenance-management',
    children: [
      { menu_key: '/maintenance/requests', label: '维修管理', order_index: 1, is_active: 1 },
      { menu_key: '/maintenance/workorder-management', label: '工单管理', order_index: 2, is_active: 1 },
      // 保修管理已拆分为独立一级菜单 /warranty-parent（2026-07-16）
      { menu_key: '/maintenance/temporary', label: '临时保养', order_index: 3, is_active: 1, module_id: 'maintenance-temporary-management' },
      { menu_key: '/maintenance/costs', label: '维护成本管理', order_index: 4, is_active: 1 },
      { menu_key: '/maintenance/evaluations', label: '维护效果评估', order_index: 5, is_active: 1 },
    ],
  },
  // 保修管理（独立模块，从日常维修中拆出，2026-07-16）
  {
    menu_key: '/warranty-parent',
    icon: 'SafetyCertificateOutlined',
    label: '保修管理',
    order_index: 4,
    is_active: 1,
    module_id: 'warranty-management',
    children: [
      { menu_key: '/warranty', label: '保修管理', order_index: 1, is_active: 1 },
    ],
  },
  {
    menu_key: '/preventive-maintenance-parent',
    icon: 'CalendarOutlined',
    label: '预防性维护',
    order_index: 4,
    is_active: 1,
    module_id: 'preventive-maintenance-management',
    children: [
      // 维护计划 + 维护模板 + 提醒管理 已合并到 /maintenance/plans（2026-07-16）
      { menu_key: '/maintenance/plans', label: '预防性维护', order_index: 1, is_active: 1 },
      { menu_key: '/maintenance/efficiency', label: '预防性维护效率', order_index: 2, is_active: 1 },
      { menu_key: '/maintenance/usage-triggers', label: '阈值触发管理', order_index: 3, is_active: 1 },
      { menu_key: '/maintenance/asset-usage', label: '资产使用量管理', order_index: 4, is_active: 1 },
    ],
  },
  {
    menu_key: '/maintenance-dashboard',
    icon: 'DashboardOutlined',
    label: '维修仪表盘',
    order_index: 5,
    is_active: 1,
  },
  {
    menu_key: '/spare-parts-parent',
    icon: 'AppstoreOutlined',
    label: '备件库',
    order_index: 6,
    is_active: 1,
    module_id: 'spare-parts-management',
    children: [
      { menu_key: '/spare-parts', label: '备件库', order_index: 1, is_active: 1 },
    ],
  },
  {
    menu_key: '/emergency-parent',
    icon: 'AlertOutlined',
    label: '应急调配',
    order_index: 7,
    is_active: 1,
    module_id: 'emergency-allocation-management',
    children: [
      { menu_key: '/emergency/allocation', label: '应急调配', order_index: 1, is_active: 1 },
    ],
  },
  {
    menu_key: '/event-reminder-parent',
    icon: 'CalendarOutlined',
    label: '事件提醒',
    order_index: 8,
    is_active: 1,
    module_id: 'event-reminder-management',
    children: [
      { menu_key: '/event-reminder', label: '事件提醒', order_index: 1, is_active: 1 },
    ],
  },
  {
    menu_key: '/pdca-parent',
    icon: 'RetweetOutlined',
    label: 'PDCA 管理',
    order_index: 9,
    is_active: 1,
    module_id: 'pdca-management',
    children: [
      { menu_key: '/pdca/records', label: 'PDCA 记录', order_index: 1, is_active: 1 },
      { menu_key: '/pdca/templates', label: 'PDCA 模板', order_index: 2, is_active: 1 },
    ],
  },
  {
    menu_key: '/platform-parent',
    icon: 'ApartmentOutlined',
    label: '业务定制',
    order_index: 9,
    is_active: 1,
    children: [
      { menu_key: '/form-customization', label: '表单定制', order_index: 1, is_active: 1, module_id: 'form-customization-management' },
      { menu_key: '/workflow', label: '流程定制', order_index: 2, is_active: 1, module_id: 'workflow-management' },
      { menu_key: '/collaboration/new', label: '新建协同', order_index: 3, is_active: 1 },
      { menu_key: '/collaboration/list', label: '我的协同', order_index: 4, is_active: 1 },
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
      { menu_key: '/inventory-plans', label: '盘点计划', order_index: 4, is_active: 1 },
      { menu_key: '/inventory-tasks', label: '盘点任务', order_index: 5, is_active: 1 },
      { menu_key: '/inventory-discrepancies', label: '盘点差异', order_index: 6, is_active: 1 },
      { menu_key: '/inventory-dashboard', label: '盘点仪表盘', order_index: 7, is_active: 1 },
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
      { menu_key: '/poct-quality-control', label: 'POCT 质控管理', order_index: 4, is_active: 1, module_id: 'poct-quality-control' },
      { menu_key: '/quality-control/statistics', label: '统计分析', order_index: 5, is_active: 1 },
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
      { menu_key: '/finance/costs', label: '费用管理', order_index: 5, is_active: 1 },
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
    menu_key: '/supplier/list',
    parent_key: '/supplier',
    icon: 'ShopOutlined',
    label: '供应商管理',
    order_index: 13,
    is_active: 1,
  },
  {
    menu_key: '/supplier',
    icon: 'ShopOutlined',
    label: '供应商中心',
    order_index: 13,
    is_active: 0, // 父级菜单不可单独点击，由子菜单提供入口
  },
  {
    menu_key: '/supplier/evaluation',
    parent_key: '/supplier',
    label: '供应商评价',
    order_index: 14,
    is_active: 1,
  },
  {
    menu_key: '/supplier/blacklist',
    parent_key: '/supplier',
    label: '黑名单管理',
    order_index: 15,
    is_active: 1,
  },
  {
    menu_key: '/supplier/statistics',
    parent_key: '/supplier',
    label: '供应商统计',
    order_index: 16,
    is_active: 1,
  },
  {
    menu_key: '/tendering/contracts',
    icon: 'FileProtectOutlined',
    label: '合同管理',
    order_index: 14,
    is_active: 1,
    children: [
      { menu_key: '/tendering/contracts', label: '招标合同', order_index: 1, is_active: 1 },
      { menu_key: '/contracts/asset', label: '资产合同', order_index: 2, is_active: 1 },
      { menu_key: '/contracts/maintenance', label: '维修服务合同', order_index: 3, is_active: 1 },
      { menu_key: '/contracts/parts', label: '配件合同', order_index: 4, is_active: 1 },
    ],
  },
  {
    menu_key: '/tendering-parent',
    icon: 'AuditOutlined',
    label: '采购中心',
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
      { menu_key: '/system/menu-order', label: '菜单顺序设置', order_index: 21, is_active: 1, roles: ['super_admin', 'system_admin'] },
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
      { menu_key: '/clinical/dashboard', label: '临床平台', order_index: 9, is_active: 1 },
    ],
  },
  {
    menu_key: '/supplier/list',
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
  // 维修维护原统一父菜单 → 拆分为 5 个独立一级菜单（2026-07-16）
  //  1) 日常维修      /daily-maintenance-parent
  //  2) 预防性维护    /preventive-maintenance-parent
  //  3) 维修仪表盘    /maintenance-dashboard
  //  4) 备件库        /spare-parts-parent
  //  5) 应急调配      /emergency-parent
  {
    menu_key: '/daily-maintenance-parent',
    icon: 'ToolOutlined',
    label: '日常维修',
    order_index: 5,
    is_active: 1,
    children: [
      { menu_key: '/maintenance/requests', label: '维修管理', order_index: 1, is_active: 1 },
      // BUILT_IN_MENUS 仅展示工单管理；其他子项保留在 DEFAULT_MENUS
      { menu_key: '/maintenance/workorder-management', label: '工单管理', order_index: 2, is_active: 1 },
    ],
  },
  // 保修管理（独立模块，2026-07-16 从日常维修中拆出）
  {
    menu_key: '/warranty-parent',
    icon: 'SafetyCertificateOutlined',
    label: '保修管理',
    order_index: 5.5,
    is_active: 1,
    module_id: 'warranty-management',
    children: [
      { menu_key: '/warranty', label: '保修管理', order_index: 1, is_active: 1 },
    ],
  },
  {
    menu_key: '/preventive-maintenance-parent',
    icon: 'CalendarOutlined',
    label: '预防性维护',
    order_index: 6,
    is_active: 1,
    children: [
      { menu_key: '/maintenance/plans', label: '预防性维护', order_index: 1, is_active: 1 },
      { menu_key: '/maintenance/efficiency', label: '预防性维护效率', order_index: 2, is_active: 1 },
      { menu_key: '/maintenance/usage-triggers', label: '阈值触发管理', order_index: 3, is_active: 1 },
      { menu_key: '/maintenance/asset-usage', label: '资产使用量管理', order_index: 4, is_active: 1 },
    ],
  },
  {
    menu_key: '/maintenance-dashboard',
    icon: 'DashboardOutlined',
    label: '维修仪表盘',
    order_index: 7,
    is_active: 1,
  },
  {
    menu_key: '/spare-parts-parent',
    icon: 'AppstoreOutlined',
    label: '备件库',
    order_index: 8,
    is_active: 1,
    children: [
      { menu_key: '/spare-parts', label: '备件库', order_index: 1, is_active: 1 },
    ],
  },
  {
    menu_key: '/emergency-parent',
    icon: 'AlertOutlined',
    label: '应急调配',
    order_index: 9,
    is_active: 1,
    children: [
      { menu_key: '/emergency/allocation', label: '应急调配', order_index: 1, is_active: 1, module_id: 'emergency-allocation-management' },
    ],
  },
  {
    menu_key: '/event-reminder-parent',
    icon: 'CalendarOutlined',
    label: '事件提醒',
    order_index: 10,
    is_active: 1,
    module_id: 'event-reminder-management',
    children: [
      { menu_key: '/event-reminder', label: '事件提醒', order_index: 1, is_active: 1 },
    ],
  },
  {
    menu_key: '/pdca-parent',
    icon: 'RetweetOutlined',
    label: 'PDCA 管理',
    order_index: 9,
    is_active: 1,
    module_id: 'pdca-management',
    children: [
      { menu_key: '/pdca/records', label: 'PDCA 记录', order_index: 1, is_active: 1 },
      { menu_key: '/pdca/templates', label: 'PDCA 模板', order_index: 2, is_active: 1 },
    ],
  },
  {
    menu_key: '/platform-parent',
    icon: 'ApartmentOutlined',
    label: '业务定制',
    order_index: 11,
    is_active: 1,
    children: [
      { menu_key: '/form-customization', label: '表单定制', order_index: 1, is_active: 1, module_id: 'form-customization-management' },
      { menu_key: '/workflow', label: '流程定制', order_index: 2, is_active: 1, module_id: 'workflow-management' },
      { menu_key: '/collaboration/new', label: '新建协同', order_index: 3, is_active: 1 },
      { menu_key: '/collaboration/list', label: '我的协同', order_index: 4, is_active: 1 },
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
      { menu_key: '/poct-quality-control', label: 'POCT 质控管理', order_index: 4, is_active: 1, module_id: 'poct-quality-control' },
      { menu_key: '/quality-control/statistics', label: '统计分析', order_index: 5, is_active: 1 },
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
 * → 供应商管理 → 合同管理 → 采购中心 → 合规模块 → 巡检管理 → 风险管理
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
    menu_key: '/asset-dashboard',
    icon: 'MonitorOutlined',
    label: '资产状态监控平台',
    order_index: 2,
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
      { menu_key: '/clinical/dashboard', label: '临床平台', order_index: 7, is_active: 1 },
    ],
  },
  // 维修维护原统一父菜单 → 拆分为 5 个独立一级菜单（2026-07-16）
  //  1) 日常维修      /daily-maintenance-parent
  //  2) 预防性维护    /preventive-maintenance-parent
  //  3) 维修仪表盘    /maintenance-dashboard
  //  4) 备件库        /spare-parts-parent
  //  5) 应急调配      /emergency-parent
  {
    menu_key: '/daily-maintenance-parent',
    icon: 'ToolOutlined',
    label: '日常维修',
    order_index: 3,
    is_active: 1,
    module_id: 'maintenance-management',
    children: [
      { menu_key: '/maintenance/requests', label: '维修管理', order_index: 1, is_active: 1 },
      { menu_key: '/maintenance/workorder-management', label: '工单管理', order_index: 2, is_active: 1 },
      // 保修管理已拆分为独立一级菜单 /warranty-parent（2026-07-16）
      { menu_key: '/maintenance/temporary', label: '临时保养', order_index: 3, is_active: 1, module_id: 'maintenance-temporary-management' },
      { menu_key: '/maintenance/costs', label: '维护成本管理', order_index: 4, is_active: 1 },
      { menu_key: '/maintenance/evaluations', label: '维护效果评估', order_index: 5, is_active: 1 },
    ],
  },
  // 保修管理（独立模块，从日常维修中拆出，2026-07-16）
  {
    menu_key: '/warranty-parent',
    icon: 'SafetyCertificateOutlined',
    label: '保修管理',
    order_index: 4,
    is_active: 1,
    module_id: 'warranty-management',
    children: [
      { menu_key: '/warranty', label: '保修管理', order_index: 1, is_active: 1 },
    ],
  },
  {
    menu_key: '/preventive-maintenance-parent',
    icon: 'CalendarOutlined',
    label: '预防性维护',
    order_index: 4,
    is_active: 1,
    module_id: 'preventive-maintenance-management',
    children: [
      // 维护计划 + 维护模板 + 提醒管理 已合并到 /maintenance/plans（2026-07-16）
      { menu_key: '/maintenance/plans', label: '预防性维护', order_index: 1, is_active: 1 },
      { menu_key: '/maintenance/efficiency', label: '预防性维护效率', order_index: 2, is_active: 1 },
      { menu_key: '/maintenance/usage-triggers', label: '阈值触发管理', order_index: 3, is_active: 1 },
      { menu_key: '/maintenance/asset-usage', label: '资产使用量管理', order_index: 4, is_active: 1 },
    ],
  },
  {
    menu_key: '/maintenance-dashboard',
    icon: 'DashboardOutlined',
    label: '维修仪表盘',
    order_index: 5,
    is_active: 1,
  },
  {
    menu_key: '/spare-parts-parent',
    icon: 'AppstoreOutlined',
    label: '备件库',
    order_index: 6,
    is_active: 1,
    module_id: 'spare-parts-management',
    children: [
      { menu_key: '/spare-parts', label: '备件库', order_index: 1, is_active: 1 },
    ],
  },
  {
    menu_key: '/emergency-parent',
    icon: 'AlertOutlined',
    label: '应急调配',
    order_index: 7,
    is_active: 1,
    module_id: 'emergency-allocation-management',
    children: [
      { menu_key: '/emergency/allocation', label: '应急调配', order_index: 1, is_active: 1 },
    ],
  },
  {
    menu_key: '/event-reminder-parent',
    icon: 'CalendarOutlined',
    label: '事件提醒',
    order_index: 8,
    is_active: 1,
    module_id: 'event-reminder-management',
    children: [
      { menu_key: '/event-reminder', label: '事件提醒', order_index: 1, is_active: 1 },
    ],
  },
  {
    menu_key: '/pdca-parent',
    icon: 'RetweetOutlined',
    label: 'PDCA 管理',
    order_index: 9,
    is_active: 1,
    module_id: 'pdca-management',
    children: [
      { menu_key: '/pdca/records', label: 'PDCA 记录', order_index: 1, is_active: 1 },
      { menu_key: '/pdca/templates', label: 'PDCA 模板', order_index: 2, is_active: 1 },
    ],
  },
  {
    menu_key: '/platform-parent',
    icon: 'ApartmentOutlined',
    label: '业务定制',
    order_index: 9,
    is_active: 1,
    children: [
      { menu_key: '/form-customization', label: '表单定制', order_index: 1, is_active: 1, module_id: 'form-customization-management' },
      { menu_key: '/workflow', label: '流程定制', order_index: 2, is_active: 1, module_id: 'workflow-management' },
      { menu_key: '/collaboration/new', label: '新建协同', order_index: 3, is_active: 1 },
      { menu_key: '/collaboration/list', label: '我的协同', order_index: 4, is_active: 1 },
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
      { menu_key: '/inventory-plans', label: '盘点计划', order_index: 4, is_active: 1 },
      { menu_key: '/inventory-tasks', label: '盘点任务', order_index: 5, is_active: 1 },
      { menu_key: '/inventory-discrepancies', label: '盘点差异', order_index: 6, is_active: 1 },
      { menu_key: '/inventory-dashboard', label: '盘点仪表盘', order_index: 7, is_active: 1 },
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
      { menu_key: '/poct-quality-control', label: 'POCT 质控管理', order_index: 4, is_active: 1, module_id: 'poct-quality-control' },
      { menu_key: '/quality-control/statistics', label: '统计分析', order_index: 5, is_active: 1 },
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
      { menu_key: '/finance/costs', label: '费用管理', order_index: 5, is_active: 1 },
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
    menu_key: '/supplier/list',
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
    children: [
      { menu_key: '/tendering/contracts', label: '招标合同', order_index: 1, is_active: 1 },
      { menu_key: '/contracts/asset', label: '资产合同', order_index: 2, is_active: 1 },
      { menu_key: '/contracts/maintenance', label: '维修服务合同', order_index: 3, is_active: 1 },
      { menu_key: '/contracts/parts', label: '配件合同', order_index: 4, is_active: 1 },
    ],
  },
  {
    menu_key: '/tendering-parent',
    icon: 'AuditOutlined',
    label: '采购中心',
    order_index: 14,
    is_active: 1,
    children: [
      { menu_key: '/tendering/dashboard', label: '统计概览', order_index: 1, is_active: 1 },
      { menu_key: '/tendering/projects', label: '招标项目管理', order_index: 2, is_active: 1 },
      { menu_key: '/tendering/bids', label: '投标管理', order_index: 3, is_active: 1 },
      { menu_key: '/tendering/evaluations', label: '评标管理', order_index: 4, is_active: 1 },
      { menu_key: '/tendering/statistics', label: '招标统计', order_index: 5, is_active: 1 },
      { menu_key: '/tendering/qrcodes', label: '二维码管理', order_index: 6, is_active: 1 },
      { menu_key: '/tendering/requests', label: '采购申请', order_index: 7, is_active: 1 },
      { menu_key: '/tendering/acceptances', label: '验收管理', order_index: 8, is_active: 1 },
      { menu_key: '/tendering/invoices', label: '发票管理', order_index: 9, is_active: 1 },
      { menu_key: '/tendering/payments', label: '付款管理', order_index: 10, is_active: 1 },
      { menu_key: '/tendering/audits', label: '审计管理', order_index: 11, is_active: 1 },
      { menu_key: '/tendering/approvals', label: '审批中心', order_index: 12, is_active: 1 },
    ],
  },
  {
    menu_key: '/special-equipment-parent',
    icon: 'AlertOutlined',
    label: '特种设备管理',
    order_index: 15,
    is_active: 1,
    module_id: 'special-equipment-management',
    children: [
      { menu_key: '/special-equipment', label: '特种设备', order_index: 1, is_active: 1 },
    ],
  },
  {
    menu_key: '/compliance-parent',
    icon: 'SafetyOutlined',
    label: '合规模块',
    order_index: 16,
    is_active: 1,
    module_id: 'compliance-management',
    children: [
      { menu_key: '/compliance', label: '合规仪表盘', order_index: 1, is_active: 1 },
      { menu_key: '/compliance/maintenance-level', label: '维护等级', order_index: 2, is_active: 1 },
      { menu_key: '/safety-inspection', label: '安全巡检', order_index: 3, is_active: 1 },
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
      { menu_key: '/inspection/calendar', label: '巡检日历', order_index: 6, is_active: 1 },
      { menu_key: '/inspection/plans', label: '巡检计划', order_index: 7, is_active: 1 },
      { menu_key: '/inspection/routes', label: '巡检路线', order_index: 8, is_active: 1 },
    ],
  },
  {
    menu_key: '/risk-parent',
    icon: 'WarningOutlined',
    label: '风险管理',
    order_index: 18,
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
    order_index: 19,
    is_active: 1,
    module_id: 'staff-qualification',
    children: [
      { menu_key: '/staff', label: '人员仪表盘', order_index: 1, is_active: 1 },
      { menu_key: '/staff/qualifications', label: '资质管理', order_index: 2, is_active: 1 },
      { menu_key: '/staff/training', label: '培训管理', order_index: 3, is_active: 1 },
      { menu_key: '/staff/assessments', label: '能力评估', order_index: 4, is_active: 1 },
      { menu_key: '/staff/engineers', label: '工程师档案', order_index: 5, is_active: 1 },
    ],
  },
  {
    menu_key: '/uptime-parent',
    icon: 'DashboardOutlined',
    label: '开机率管理',
    order_index: 20,
    is_active: 1,
    module_id: 'uptime-management',
    children: [
      { menu_key: '/uptime', label: '开机率仪表盘', order_index: 1, is_active: 1 },
      { menu_key: '/uptime/operation-logs', label: '运行日志', order_index: 2, is_active: 1 },
      { menu_key: '/uptime/statistics', label: '开机率统计', order_index: 3, is_active: 1 },
    ],
  },
  {
    menu_key: '/ai-assistant-parent',
    icon: 'RobotOutlined',
    label: 'AI模块',
    order_index: 21,
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
    order_index: 22,
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
      { menu_key: '/system/menu-order', label: '菜单顺序设置', order_index: 21, is_active: 1, roles: ['super_admin', 'system_admin'] },
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

    // 1) 收集 ALL_MENUS 中所有声明了 module_id 的模块
    const allDeclaredModules = new Set();
    ALL_MENUS.forEach(menu => menu.module_id && allDeclaredModules.add(menu.module_id));

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
      allDeclaredModules.forEach(m => enabledModules.add(m));
    } else {
      // 2) 对 ALL_MENUS 中声明但租户尚未在 tenant_module_configs 中显式配置的模块,
      //    默认启用 (新模块自动开放, 租户可在模块管理页手动禁用)
      //    显式禁用的 (enabled=0) 才会被排除
      try {
        const [allTenantConfigs] = await db.execute(
          'SELECT module_id, enabled FROM tenant_module_configs WHERE tenant_id = ?',
          [tenantId],
        );
        const explicitMap = new Map();
        allTenantConfigs.forEach(r => explicitMap.set(r.module_id, !!r.enabled));
        allDeclaredModules.forEach(mid => {
          if (!explicitMap.has(mid)) enabledModules.add(mid);
        });
      } catch (_) { /* ignore */ }
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

/**
 * 读取租户级菜单显示设置（顺序 + 顶层显隐）
 * 表不存在/查询失败时降级为「无覆盖」，不影响默认菜单。
 */
async function getDisplaySettings(tenantId) {
  try {
    const [rows] = await db.execute(
      'SELECT menu_key, order_index, is_visible FROM menu_display_settings WHERE tenant_id = ?',
      [tenantId]
    );
    const map = {};
    for (const r of rows) {
      map[r.menu_key] = { order_index: r.order_index, is_visible: r.is_visible };
    }
    return map;
  } catch (e) {
    return {};
  }
}

/**
 * 用显示设置「标注」菜单树（不改变显隐，仅给出当前有效顺序与 is_visible），
 * 用于设置页：被隐藏的顶层菜单仍列出（is_visible=0），方便管理员重新打开。
 */
function annotateWithSettings(menus, settingsMap) {
  return menus.map(m => {
    const s = settingsMap[m.key];
    const isVisible = s && s.is_visible != null ? s.is_visible : 1;
    const effOrder = s && s.order_index != null ? s.order_index : (m.order_index || 0);
    return {
      ...m,
      order_index: effOrder,
      is_visible: isVisible,
      children: (m.children || []).map(c => {
        const cs = settingsMap[c.key];
        const ceff = cs && cs.order_index != null ? cs.order_index : (c.order_index || 0);
        return { ...c, order_index: ceff };
      }).sort((a, b) => (a.order_index || 0) - (b.order_index || 0)),
    };
  }).sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
}

/**
 * 将显示设置应用到菜单树：
 * - 顶层 is_visible = 0 → 整项隐藏
 * - 顶层/二级 order_index 用设置值覆盖 ALL_MENUS 默认值
 * 无设置时退化为 ALL_MENUS 默认顺序，行为不变。
 */
function applyDisplaySettings(menus, settingsMap) {
  const result = [];
  for (const m of menus) {
    const s = settingsMap[m.key];
    if (s && s.is_visible === 0) continue; // 隐藏顶层菜单
    const effOrder = s && s.order_index != null ? s.order_index : (m.order_index || 0);
    let children = m.children;
    if (Array.isArray(children) && children.length) {
      children = children.map(c => {
        const cs = settingsMap[c.key];
        const ceff = cs && cs.order_index != null ? cs.order_index : (c.order_index || 0);
        return { ...c, order_index: ceff };
      }).sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
    }
    result.push({ ...m, order_index: effOrder, children });
  }
  result.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
  return result;
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

    // 应用租户级菜单显示设置（自定义顺序 + 顶层显隐），覆盖 ALL_MENUS 默认顺序
    const displaySettings = await getDisplaySettings(tenantId);
    finalMenus = applyDisplaySettings(finalMenus, displaySettings);

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

// ============================================
// 阶段4菜单权威源重构：删除以下两个纯硬编码端点
//  - /api/menus/builtin-menus  → 返回 DEFAULT_MENUS + BUILT_IN_MENUS 全量硬编码
//  - /api/menus/default-menus  → 返回 DEFAULT_MENUS 硬编码
// 权威源已切换到 system_modules.frontend_config.menu_routes（DB）
// menu-tree / menus 仍使用 ALL_MENUS 兜底（待下一阶段从 frontend_config 读完整菜单）
// ============================================
// router.get('/menus/builtin-menus', (req, res) => {  // 已废弃
//   res.json({
//     success: true,
//     data: {
//       defaultMenus: DEFAULT_MENUS,
//       builtinMenus: BUILT_IN_MENUS,
//     },
//   });
// });
//
// router.get('/menus/default-menus', (req, res) => {  // 已废弃
//   res.json({
//     success: true,
//     data: DEFAULT_MENUS,
//   });
// });

// 获取菜单显示设置（顺序 + 顶层显隐），用于「菜单顺序设置」页面
router.get('/menus/display-settings', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const settingsMap = await getDisplaySettings(tenantId);
    // 与实时菜单树同一来源（含租户模块菜单），保证可配置项与用户所见一致
    const mergedResult = await getMergedMenusByModules(tenantId, req.user && req.user.role);
    let tree = normalizeBuiltInTree(mergedResult.defaultMenus);
    if (mergedResult.moduleMenus && mergedResult.moduleMenus.length > 0) {
      tree = mergeMenuTrees(tree, buildMenuTree(mergedResult.moduleMenus));
    }
    // 标注当前有效顺序与显隐（被隐藏项仍列出，便于重新打开）
    const annotated = annotateWithSettings(tree, settingsMap);
    const mainMenus = annotated.map(m => ({
      menu_key: m.key,
      label: m.label,
      order_index: m.order_index || 0,
      is_visible: m.is_visible,
      subMenus: (m.children || []).map(c => ({
        menu_key: c.key,
        label: c.label,
        order_index: c.order_index || 0,
      })),
    }));
    res.json({ success: true, data: { mainMenus } });
  } catch (error) {
    console.error('获取菜单显示设置失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 保存菜单显示设置（顺序 + 顶层显隐），租户级隔离
router.put('/menus/display-settings', authenticate, async (req, res) => {
  try {
    const role = req.user && req.user.role;
    if (!['super_admin', 'system_admin'].includes(role)) {
      return res.status(403).json({ success: false, message: '无权限修改菜单顺序' });
    }
    const tenantId = getTenantId(req);
    const { mainMenus } = req.body || {};
    if (!Array.isArray(mainMenus)) {
      return res.status(400).json({ success: false, message: 'mainMenus 格式错误' });
    }
    for (const m of mainMenus) {
      if (!m.menu_key) continue;
      const orderIndex = Number.isFinite(m.order_index) ? m.order_index : null;
      const isVisible = (m.is_visible === 0 || m.is_visible === false) ? 0 : 1;
      await db.execute(
        `INSERT INTO menu_display_settings (tenant_id, menu_key, order_index, is_visible, updated_at)
         VALUES (?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE order_index = VALUES(order_index), is_visible = VALUES(is_visible), updated_at = NOW()`,
        [tenantId, m.menu_key, orderIndex, isVisible]
      );
      if (Array.isArray(m.subMenus)) {
        for (const c of m.subMenus) {
          if (!c.menu_key) continue;
          const cOrder = Number.isFinite(c.order_index) ? c.order_index : null;
          await db.execute(
            `INSERT INTO menu_display_settings (tenant_id, menu_key, order_index, is_visible, updated_at)
             VALUES (?, ?, ?, 1, NOW())
             ON DUPLICATE KEY UPDATE order_index = VALUES(order_index), updated_at = NOW()`,
            [tenantId, c.menu_key, cOrder]
          );
        }
      }
    }
    res.json({ success: true, message: '菜单顺序已保存' });
  } catch (error) {
    console.error('保存菜单显示设置失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
module.exports.ALL_MENUS = ALL_MENUS;
module.exports.DEFAULT_MENUS = DEFAULT_MENUS;
module.exports.BUILT_IN_MENUS = BUILT_IN_MENUS;
