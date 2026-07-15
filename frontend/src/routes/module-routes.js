import React, { Suspense, lazy } from 'react';

const lazyPage = importer => lazy(importer);

const assetRoutes = [
  { path: '/assets', component: lazyPage(() => import('../pages/AssetList')), key: 'asset-list' },
  { path: '/assets/new', component: lazyPage(() => import('../pages/AssetForm')), key: 'asset-new' },
  { path: '/assets/category-select', component: lazyPage(() => import('../pages/AssetCategorySelect')), key: 'asset-category' },
  { path: '/assets/:id', component: lazyPage(() => import('../pages/AssetDetail')), key: 'asset-detail' },
  { path: '/assets/:id/edit', component: lazyPage(() => import('../pages/AssetForm')), key: 'asset-edit' },
];

const inventoryRoutes = [
  { path: '/inventory', component: lazyPage(() => import('../pages/InventoryList')), key: 'inventory-list' },
  { path: '/inventory/new', component: lazyPage(() => import('../pages/InventoryForm')), key: 'inventory-new' },
  { path: '/inventory/self-check', component: lazyPage(() => import('../pages/InventorySelfCheck')), key: 'inventory-self-check' },
  { path: '/inventory/self', component: lazyPage(() => import('../pages/SelfInventory')), key: 'inventory-self' },
  { path: '/inventory/:id/scan', component: lazyPage(() => import('../pages/InventoryScanner')), key: 'inventory-scan' },
  { path: '/inventory/:id/edit', component: lazyPage(() => import('../pages/InventoryForm')), key: 'inventory-edit' },
  { path: '/inventory/:id', component: lazyPage(() => import('../pages/InventoryDetail')), key: 'inventory-detail' },
];

const transferRoutes = [
  { path: '/transfer', component: lazyPage(() => import('../pages/TransferList')), key: 'transfer-list' },
  { path: '/transfer/new', component: lazyPage(() => import('../pages/TransferForm')), key: 'transfer-new' },
  { path: '/transfer/requests', component: lazyPage(() => import('../pages/TransferRequestList')), key: 'transfer-requests' },
];

const idleRoutes = [
  { path: '/idle', component: lazyPage(() => import('../pages/IdleAssetList')), key: 'idle-list' },
  { path: '/idle/new', component: lazyPage(() => import('../pages/IdleAssetForm')), key: 'idle-new' },
  { path: '/idle/:id', component: lazyPage(() => import('../pages/IdleAssetDetail')), key: 'idle-detail' },
];

const dashboardRoutes = [
  { path: '/dashboard', component: lazyPage(() => import('../pages/Dashboard')), key: 'dashboard' },
  { path: '/dashboard-desktop', component: lazyPage(() => import('../pages/DashboardDesktop')), key: 'dashboard-desktop' },
  { path: '/module-selector', component: lazyPage(() => import('../pages/ModuleSelector')), key: 'module-selector' },
  { path: '/dashboard-config', component: lazyPage(() => import('../pages/DashboardConfigManager')), key: 'dashboard-config' },
  { path: '/asset-dashboard', component: lazyPage(() => import('../pages/AssetStatusDashboard')), key: 'asset-dashboard' },
];

const authRoutes = [
  { path: '/login', component: lazyPage(() => import('../pages/Login')), key: 'login', public: true },
  { path: '/register', component: lazyPage(() => import('../pages/Register')), key: 'register', public: true },
  { path: '/tenant-association', component: lazyPage(() => import('../pages/TenantAssociation')), key: 'tenant-association', public: true },
];

const userRoutes = [
  { path: '/users', component: lazyPage(() => import('../pages/UserList')), key: 'user-list' },
  { path: '/users/new', component: lazyPage(() => import('../pages/UserForm')), key: 'user-new' },
  { path: '/users/:id/edit', component: lazyPage(() => import('../pages/UserForm')), key: 'user-edit' },
  { path: '/roles-permissions', component: lazyPage(() => import('../pages/RolePermissionManagement')), key: 'roles-permissions' },
  { path: '/tenant-role-config', component: lazyPage(() => import('../pages/TenantRoleConfig')), key: 'tenant-role-config' },
];

const maintenanceRoutes = [
  { path: '/maintenance', component: lazyPage(() => import('../pages/MaintenanceWorkOrderList')), key: 'maintenance-list' },
  { path: '/maintenance/preventive', component: lazyPage(() => import('../pages/PreventiveMaintenanceList')), key: 'preventive-list' },
  { path: '/maintenance/preventive/new', component: lazyPage(() => import('../pages/PreventiveMaintenanceForm')), key: 'preventive-new' },
  { path: '/maintenance/preventive/edit/:id', component: lazyPage(() => import('../pages/PreventiveMaintenanceForm')), key: 'preventive-edit' },
  { path: '/maintenance/preventive/:id', component: lazyPage(() => import('../pages/PreventiveMaintenanceDetail')), key: 'preventive-detail' },
  { path: '/maintenance/plans', component: lazyPage(() => import('../pages/PreventiveMaintenanceList')), key: 'plans-list' },
  { path: '/maintenance/plans/new', component: lazyPage(() => import('../pages/PreventiveMaintenanceForm')), key: 'plans-new' },
  { path: '/maintenance/plans/edit/:id', component: lazyPage(() => import('../pages/PreventiveMaintenanceForm')), key: 'plans-edit' },
  { path: '/maintenance/plans/:id', component: lazyPage(() => import('../pages/PreventiveMaintenanceDetail')), key: 'plans-detail' },
  { path: '/maintenance/templates', component: lazyPage(() => import('../pages/MaintenanceTemplateList')), key: 'template-list' },
  { path: '/maintenance/templates/new', component: lazyPage(() => import('../pages/MaintenanceTemplateForm')), key: 'template-new' },
  { path: '/maintenance/templates/edit/:id', component: lazyPage(() => import('../pages/MaintenanceTemplateForm')), key: 'template-edit' },
  { path: '/maintenance/requests', component: lazyPage(() => import('../pages/MaintenanceRequestList')), key: 'request-list' },
  { path: '/maintenance/requests/new', component: lazyPage(() => import('../pages/MaintenanceRequestList')), key: 'request-new' },
  { path: '/maintenance/requests/edit/:id', component: lazyPage(() => import('../pages/MaintenanceRequestList')), key: 'request-edit' },
  { path: '/maintenance/requests/:id', component: lazyPage(() => import('../pages/MaintenanceRequestList')), key: 'request-detail' },
  { path: '/maintenance/requests/complete/:id', component: lazyPage(() => import('../pages/MaintenanceRequestList')), key: 'request-complete' },
  { path: '/maintenance/workorders', component: lazyPage(() => import('../pages/MaintenanceWorkOrderList')), key: 'workorder-list' },
  { path: '/maintenance/workorders/new', component: lazyPage(() => import('../pages/MaintenanceWorkOrderList')), key: 'workorder-new' },
  { path: '/maintenance/workorders/edit/:id', component: lazyPage(() => import('../pages/MaintenanceWorkOrderList')), key: 'workorder-edit' },
  { path: '/maintenance/workorders/:id', component: lazyPage(() => import('../pages/MaintenanceWorkOrderList')), key: 'workorder-detail' },
  { path: '/maintenance/work-orders', component: lazyPage(() => import('../pages/MaintenanceWorkOrderList')), key: 'work-order-list' },
  { path: '/maintenance/usage-triggers', component: lazyPage(() => import('../pages/MaintenanceUsageTriggerList')), key: 'usage-trigger-list' },
  { path: '/maintenance/asset-usage', component: lazyPage(() => import('../pages/MaintenanceAssetUsage')), key: 'asset-usage' },
  { path: '/maintenance/efficiency', component: lazyPage(() => import('../pages/MaintenanceEfficiencyDashboard')), key: 'efficiency' },
  { path: '/maintenance/reminders', component: lazyPage(() => import('../pages/MaintenanceReminderList')), key: 'reminder-list' },
  { path: '/maintenance/costs', component: lazyPage(() => import('../pages/MaintenanceCostList')), key: 'cost-list' },
  { path: '/maintenance/evaluations', component: lazyPage(() => import('../pages/MaintenanceEvaluationList')), key: 'evaluation-list' },
];

const documentRoutes = [
  { path: '/technical-documents', component: lazyPage(() => import('../pages/TechnicalDocumentsList')), key: 'doc-list' },
  { path: '/technical-documents/upload', component: lazyPage(() => import('../pages/TechnicalDocumentsUpload')), key: 'doc-upload' },
  { path: '/technical-documents/external-upload', component: lazyPage(() => import('../pages/TechnicalDocumentsExternalUpload')), key: 'doc-external' },
  { path: '/technical-documents/review', component: lazyPage(() => import('../pages/TechnicalDocumentsReview')), key: 'doc-review' },
  { path: '/technical-documents/ai', component: lazyPage(() => import('../pages/TechnicalDocumentsAI')), key: 'doc-ai' },
];

const knowledgeBaseRoutes = [
  { path: '/knowledge-base', component: lazyPage(() => import('../pages/KnowledgeBaseList')), key: 'knowledge-base-list' },
  { path: '/knowledge-base/qa', component: lazyPage(() => import('../pages/KnowledgeBaseQA')), key: 'knowledge-base-qa' },
];

const qualityRoutes = [
  { path: '/quality-control', component: lazyPage(() => import('../pages/QualityControlList')), key: 'qc-list' },
  { path: '/quality-control/new', component: lazyPage(() => import('../pages/QualityControlForm')), key: 'qc-new' },
  { path: '/quality-control/metrology', component: lazyPage(() => import('../pages/MetrologyList')), key: 'metrology-list' },
  { path: '/quality-control/metrology/new', component: lazyPage(() => import('../pages/MetrologyForm')), key: 'metrology-new' },
  { path: '/quality-control/metrology/edit/:id', component: lazyPage(() => import('../pages/MetrologyForm')), key: 'metrology-edit' },
  { path: '/quality-control/metrology/:id', component: lazyPage(() => import('../pages/MetrologyDetail')), key: 'metrology-detail' },
  { path: '/quality-control/metrology-upload', component: lazyPage(() => import('../pages/quality-control/MetrologyUploadPage')), key: 'metrology-upload' },
  { path: '/quality-control/metrology-page', component: lazyPage(() => import('../pages/quality-control/MetrologyPage')), key: 'metrology-page' },
  { path: '/quality-control/inspections', component: lazyPage(() => import('../pages/quality-control/QualityControlPage')), key: 'qc-inspections' },
  { path: '/quality-control/statistics', component: lazyPage(() => import('../pages/quality-control/StatisticsPage')), key: 'qc-statistics' },
];

const iotRoutes = [
  { path: '/asset-location', component: lazyPage(() => import('../pages/AssetLocationMap')), key: 'asset-location' },
  { path: '/iot-devices', component: lazyPage(() => import('../pages/IoTDeviceManagement')), key: 'iot-devices' },
  { path: '/beacon-location', component: lazyPage(() => import('../pages/BeaconLocation')), key: 'beacon-location' },
];

const aiRoutes = [
  { path: '/ai-assistant', component: lazyPage(() => import('../pages/AIAssistant')), key: 'ai-assistant' },
  { path: '/ai-question-records', component: lazyPage(() => import('../pages/AIQuestionRecords')), key: 'ai-records' },
];

const systemRoutes = [
  { path: '/system-settings', component: lazyPage(() => import('../pages/SystemSettings')), key: 'system-settings' },
  { path: '/audit-logs', component: lazyPage(() => import('../pages/AuditLogsList')), key: 'audit-logs' },
  { path: '/audit-management', component: lazyPage(() => import('../pages/AuditLogManagement')), key: 'audit-management' },
  { path: '/backup', component: lazyPage(() => import('../pages/BackupManagement')), key: 'backup' },
  { path: '/database', component: lazyPage(() => import('../pages/DatabaseConnectionManagement')), key: 'database' },
  { path: '/api-docs', component: lazyPage(() => import('../pages/ApiDocs')), key: 'api-docs' },
  { path: '/api-documentation', component: lazyPage(() => import('../pages/APIDocumentation')), key: 'api-documentation' },
];

const complianceRoutes = [
  { path: '/compliance', component: lazyPage(() => import('../pages/compliance/Dashboard')), key: 'compliance' },
  { path: '/special-equipment', component: lazyPage(() => import('../pages/compliance/SpecialEquipment')), key: 'special-equipment' },
  { path: '/safety-inspection', component: lazyPage(() => import('../pages/compliance/SafetyInspection')), key: 'safety-inspection' },
];

const riskRoutes = [
  { path: '/risk', component: lazyPage(() => import('../modules/risk/pages/Dashboard')), key: 'risk' },
  { path: '/risk/assessment', component: lazyPage(() => import('../modules/risk/pages/Assessment')), key: 'risk-assessment' },
  { path: '/risk/reports', component: lazyPage(() => import('../modules/risk/pages/Reports')), key: 'risk-reports' },
];

const staffRoutes = [
  { path: '/staff', component: lazyPage(() => import('../modules/staff/pages/Dashboard')), key: 'staff' },
  { path: '/staff/qualifications', component: lazyPage(() => import('../modules/staff/pages/Qualifications')), key: 'staff-qualifications' },
  { path: '/staff/training', component: lazyPage(() => import('../modules/staff/pages/Training')), key: 'staff-training' },
  { path: '/staff/certifications', component: lazyPage(() => import('../modules/staff/pages/Certifications')), key: 'staff-certifications' },
];

const uptimeRoutes = [
  { path: '/uptime', component: lazyPage(() => import('../modules/uptime/pages/Dashboard')), key: 'uptime' },
  { path: '/uptime/records', component: lazyPage(() => import('../modules/uptime/pages/Records')), key: 'uptime-records' },
  { path: '/uptime/reports', component: lazyPage(() => import('../modules/uptime/pages/Reports')), key: 'uptime-reports' },
  { path: '/uptime/alerts', component: lazyPage(() => import('../modules/uptime/pages/Alerts')), key: 'uptime-alerts' },
];

const otherRoutes = [
  { path: '/acceptance', component: lazyPage(() => import('../pages/AcceptanceList')), key: 'acceptance-list' },
  { path: '/acceptance/new', component: lazyPage(() => import('../pages/AcceptanceForm')), key: 'acceptance-new' },
  { path: '/acceptance/edit/:id', component: lazyPage(() => import('../pages/AcceptanceForm')), key: 'acceptance-edit' },
  { path: '/acceptance/:id', component: lazyPage(() => import('../pages/AcceptanceDetail')), key: 'acceptance-detail' },
  { path: '/asset-share/:token', component: lazyPage(() => import('../pages/AssetShareUpload')), key: 'asset-share', public: true },
  { path: '/introduction', component: lazyPage(() => import('../pages/Introduction')), key: 'introduction' },
];

// 招标采购模块路由
const tenderingRoutes = [
  { path: '/tendering', component: lazyPage(() => import('../pages/tendering/TenderingDashboard')), key: 'tendering-dashboard' },
  { path: '/tendering/dashboard', component: lazyPage(() => import('../pages/tendering/TenderingDashboard')), key: 'tendering-dashboard-2' },
  { path: '/tendering/projects', component: lazyPage(() => import('../pages/tendering/TenderProjectList')), key: 'tendering-projects' },
  { path: '/tendering/projects/new', component: lazyPage(() => import('../pages/tendering/TenderProjectForm')), key: 'tendering-project-new' },
  { path: '/tendering/projects/edit/:id', component: lazyPage(() => import('../pages/tendering/TenderProjectForm')), key: 'tendering-project-edit' },
  { path: '/tendering/projects/:id', component: lazyPage(() => import('../pages/tendering/TenderProjectDetail')), key: 'tendering-project-detail' },
  { path: '/tendering/projects/:id/document', component: lazyPage(() => import('../pages/tendering/TenderDocumentEditor')), key: 'tendering-project-doc' },
  { path: '/tendering/projects/:id/bids', component: lazyPage(() => import('../pages/tendering/BidList')), key: 'tendering-bids' },
  { path: '/tendering/projects/:id/evaluations', component: lazyPage(() => import('../pages/tendering/BidEvaluation')), key: 'tendering-evaluations' },
  { path: '/tendering/suppliers', component: lazyPage(() => import('../pages/tendering/SupplierList')), key: 'tendering-suppliers' },
  { path: '/tendering/contracts', component: lazyPage(() => import('../pages/tendering/ContractList')), key: 'tendering-contracts' },
  { path: '/tendering/contracts/new', component: lazyPage(() => import('../pages/tendering/ContractForm')), key: 'tendering-contract-new' },
  { path: '/tendering/contracts/edit/:id', component: lazyPage(() => import('../pages/tendering/ContractForm')), key: 'tendering-contract-edit' },
  { path: '/tendering/contracts/:id', component: lazyPage(() => import('../pages/tendering/ContractDetail')), key: 'tendering-contract-detail' },
  { path: '/tendering/bids', component: lazyPage(() => import('../pages/tendering/BidOverview')), key: 'tendering-bids-overview' },
  { path: '/tendering/bids/:bidId', component: lazyPage(() => import('../pages/tendering/BidDetail')), key: 'tendering-bid-detail' },
  { path: '/tendering/evaluations', component: lazyPage(() => import('../pages/tendering/EvaluationOverview')), key: 'tendering-evaluation-overview' },
  { path: '/tendering/statistics', component: lazyPage(() => import('../pages/tendering/TenderStatistics')), key: 'tendering-statistics' },
  { path: '/tendering/qrcodes', component: lazyPage(() => import('../pages/tendering/TendererPreview')), key: 'tendering-qrcodes' },
  // 公开页面：供应商扫码上传资质 / 项目级扫码门户
  { path: '/supplier-upload/:token', component: lazyPage(() => import('../pages/tendering/SupplierQualificationUpload')), key: 'supplier-upload', public: true },
  { path: '/tenderer/:token', component: lazyPage(() => import('../pages/public/TendererPortal')), key: 'tenderer-portal', public: true },
];

const moduleRouteMap = {
  assets: assetRoutes,
  inventory: inventoryRoutes,
  transfer: transferRoutes,
  idle: idleRoutes,
  dashboard: dashboardRoutes,
  auth: authRoutes,
  users: userRoutes,
  maintenance: maintenanceRoutes,
  documents: documentRoutes,
  knowledgeBase: knowledgeBaseRoutes,
  quality: qualityRoutes,
  iot: iotRoutes,
  ai: aiRoutes,
  system: systemRoutes,
  compliance: complianceRoutes,
  risk: riskRoutes,
  staff: staffRoutes,
  uptime: uptimeRoutes,
  tendering: tenderingRoutes,
  other: otherRoutes,
};

function getAllRoutes() {
  return Object.values(moduleRouteMap).flat();
}

function getRoutesByModule(moduleName) {
  return moduleRouteMap[moduleName] || [];
}

function getPublicRoutes() {
  return getAllRoutes().filter(route => route.public);
}

function getProtectedRoutes() {
  return getAllRoutes().filter(route => !route.public);
}

export {
  moduleRouteMap,
  getAllRoutes,
  getRoutesByModule,
  getPublicRoutes,
  getProtectedRoutes,
};

export default moduleRouteMap;
