'use strict';

/**
 * 角色菜单可见性映射（基于实际工作岗位，领域驱动）。
 *
 * 设计要点：
 *  - 覆盖 menu_definitions 全量菜单（当前 103 个），新增菜单按领域自动归类，
 *    不再依赖手工白名单，避免“漏配/多配”。
 *  - super_admin 全可见；system_admin 全可见但排除跨机构/高敏感菜单。
 *  - 其余业务角色按“工作域”判定（查看型做收窄：不含新增/导入/配置类）。
 *  - 本文件为单一逻辑源：routes/roles-permissions.js（种子）与
 *    scripts/apply-role-menu-config.js（一次性落地）共用，避免漂移。
 */

// 敏感菜单：仅超级管理员可见
const SENSITIVE_SYSTEM_MENUS = new Set([
  '/tenants',             // 跨机构企业管理
  '/database-connection', // 数据库连接管理
  '/cloud-sync',          // 云/IoT 同步（若启用）
]);

// ===== 领域判定（覆盖 menu_definitions 全量菜单）=====
const isDashboard = (k) => k === '/dashboard';

const isAsset = (k) =>
  k === '/assets' || k === '/assets-parent' || k === '/assets/add' || k === '/assets/import' ||
  k === '/asset-query' || k === '/asset-workflows' || k === '/temp-assets' ||
  k === '/label-management-parent' || k.startsWith('/asset-labels') ||
  k === '/scrapping' || k === '/special-equipment';

const isDepreciation = (k) => k.startsWith('/depreciation') || k === '/asset-depreciation';
const isIdle = (k) => k.startsWith('/idle');
const isAcceptance = (k) => k.startsWith('/acceptance') || k.startsWith('/asset-acceptance');
const isProcurement = (k) => k.startsWith('/procurement') || k.startsWith('/tendering');
const isMaintenance = (k) => k.startsWith('/maintenance');
const isMonitoring = (k) =>
  k.startsWith('/asset-monitoring') || k === '/asset-location' || k === '/beacon-location' ||
  k.startsWith('/iot') || k === '/environment-monitoring';
const isMonitoringConfig = (k) => k === '/iot-devices' || k.startsWith('/iot-management');
const isTechDocs = (k) => k.startsWith('/technical-documents');
const isQuality = (k) =>
  k.startsWith('/quality-control') || k === '/adverse-reaction' || k.startsWith('/adverse-event') ||
  k.startsWith('/quality-assurance') || k.startsWith('/compliance') || k === '/safety-inspection';
const isTransfer = (k) => k.startsWith('/transfer');
const isInventory = (k) => k.startsWith('/inventory');
const isInspection = (k) => k.startsWith('/inspection');
const isAI = (k) => k.startsWith('/ai-');
const isSystem = (k) =>
  k.startsWith('/system') || k === '/tenants' || k === '/users' || k === '/departments' ||
  k === '/roles-permissions' || k === '/modules' || k === '/audit-logs' || k === '/backup' ||
  k === '/database-connection' || k === '/api-docs' || k === '/api-documentation';

// ---- 查看型收窄（不含新增/导入/配置类）----
const ASSET_WRITE = new Set([
  '/assets/add', '/assets/import', '/asset-labels/print', '/asset-labels/templates',
  '/label-management-parent', '/scrapping', '/special-equipment',
]);
const isAssetView = (k) => isAsset(k) && !ASSET_WRITE.has(k);
const isMonitoringView = (k) => isMonitoring(k) && !isMonitoringConfig(k);
const isTechDocsView = (k) => k === '/technical-documents' || k === '/technical-documents-parent';
const isQualityView = (k) => k === '/quality-control/qc' || k === '/adverse-reaction';
const isMaintenanceView = (k) => k === '/maintenance/requests' || k === '/maintenance/logs';
const isAcceptanceView = (k) =>
  k === '/acceptance' || k === '/acceptance-parent' ||
  k === '/acceptance-application' || k === '/acceptance-applications';
const isTransferApply = (k) => k === '/transfer/new';
const isInventorySelf = (k) => k === '/inventory/self';

// ===== 角色可见性（基于实际工作岗位）=====
const ROLE_VISIBILITY = {
  // 资产管理员：资产台账/标签/折旧/技术资料/定位查看/闲置/AI/操作日志
  asset_admin: (k) =>
    isDashboard(k) || isAsset(k) || isDepreciation(k) || isTechDocs(k) ||
    isMonitoringView(k) || isIdle(k) || isAI(k) || k === '/audit-logs',

  // 科室管理员：本科室查看 + 发起申请/上报（不含管理配置）
  department_admin: (k) =>
    isDashboard(k) || isAssetView(k) || isDepreciation(k) || isIdle(k) ||
    isMaintenanceView(k) || isTransferApply(k) || isQualityView(k) || isAcceptanceView(k) ||
    isTechDocsView(k) || isInventorySelf(k) || isAI(k) || isInspection(k) || isMonitoringView(k),

  // 验收管理员：验收 + 采购验收 + 资产查看 + 技术资料 + 质控查看
  acceptance_admin: (k) =>
    isDashboard(k) || isAcceptance(k) || isProcurement(k) || isAssetView(k) ||
    isDepreciation(k) || isTechDocs(k) || isQualityView(k) || isAI(k),

  // 维修工程师：维修（不含效率/成本分析）+ 资产查看 + 技术资料查看 + 质控上报 + 定位查看
  maintenance_engineer: (k) =>
    isDashboard(k) ||
    (isMaintenance(k) && k !== '/maintenance/efficiency' && k !== '/maintenance/costs') ||
    isAssetView(k) || isDepreciation(k) || isTechDocsView(k) || isQualityView(k) || isAI(k) || isMonitoringView(k),

  // 维护管理员：全维修域 + 资产查看 + 技术资料 + 质控查看 + 定位（含配置）
  maintenance_admin: (k) =>
    isDashboard(k) || isMaintenance(k) || isAssetView(k) || isDepreciation(k) ||
    isTechDocs(k) || isQualityView(k) || isAI(k) || isMonitoring(k),

  // 计量管理员：质控/计量/质保/合规/安全 + 资产查看 + 技术资料 + 折旧
  metrology_admin: (k) =>
    isDashboard(k) || isQuality(k) || isAssetView(k) || isDepreciation(k) ||
    isTechDocs(k) || isAI(k),

  // 质量管理员：质控/质保/合规/安全/巡检 + 资产查看 + 技术资料 + 折旧
  quality_admin: (k) =>
    isDashboard(k) || isQuality(k) || isInspection(k) || isAssetView(k) ||
    isDepreciation(k) || isTechDocs(k) || isAI(k),

  // 调配管理员：资产调配 + 资产查看 + 闲置 + 技术资料 + 折旧
  transfer_admin: (k) =>
    isDashboard(k) || isTransfer(k) || isAssetView(k) || isIdle(k) ||
    isDepreciation(k) || isTechDocs(k) || isAI(k),

  // 盘点管理员：盘点 + 资产全量（含标签/导入/报废/特殊设备）+ 闲置 + 技术资料 + 折旧
  inventory_admin: (k) =>
    isDashboard(k) || isInventory(k) || isAsset(k) || isIdle(k) ||
    isDepreciation(k) || isTechDocs(k) || isAI(k),

  // 普通用户：本科室查看 + 发起维修/调配申请 + 不良事件上报 + 我的盘点
  user: (k) =>
    isDashboard(k) || isAssetView(k) || isDepreciation(k) || isIdle(k) ||
    isMaintenanceView(k) || isTransferApply(k) || isQualityView(k) || isAcceptanceView(k) ||
    isTechDocsView(k) || isInventorySelf(k) || isAI(k) || isInspection(k) || isMonitoringView(k),
};

/**
 * 构建角色→菜单可见性映射。
 * 返回对象：键为 role_code，值为 (menuKey) => 1 | 0。
 */
function buildRoleMenuPermissions() {
  const map = {
    // 超级管理员：跨租户，全部菜单可见
    super_admin: () => 1,
    // 系统管理员：本机构全可见，但排除跨机构/高敏感菜单
    system_admin: (menuKey) => (SENSITIVE_SYSTEM_MENUS.has(menuKey) ? 0 : 1),
  };
  for (const [role, fn] of Object.entries(ROLE_VISIBILITY)) {
    map[role] = (menuKey) => (fn(menuKey) ? 1 : 0);
  }
  return map;
}

module.exports = { buildRoleMenuPermissions, SENSITIVE_SYSTEM_MENUS, ROLE_VISIBILITY };
