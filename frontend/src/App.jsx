import React, { Suspense, lazy, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import { DepartmentProvider } from './contexts/DepartmentContext';
import { isAdminRole } from './utils/roleUtils';
import crypto from './utils/crypto';
import { scheduleTokenRefresh } from './api/client';
import { getHomePath } from './utils/feishu';
import ErrorBoundary from './components/ErrorBoundary';
import './App.css';
import './styles/responsive.css';

// Initialize encryption cache on app load (important for popup windows)
// 缓存就绪后调度 Token 主动续期，避免使用过程中突然过期跳转登录页
crypto.initCache().then(() => scheduleTokenRefresh()).catch(() => {});

// 模块级错误边界工厂：每个懒加载页面拥有独立的 ErrorBoundary 实例。
// - 页面渲染崩溃时，仅该页面显示错误 UI，应用外壳（侧边栏/顶部栏）保持可用
// - 动态导入失败（chunk load error）自动刷新页面恢复
// - 导航到其他页面时，旧 ErrorBoundary 卸载、新实例挂载，错误状态互不影响
const lazyPage = importer => {
  const LazyComp = lazy(importer);
  const WrappedPage = props => (
    <ErrorBoundary showDetails={import.meta.env.DEV} maxErrors={3}>
      <LazyComp {...props} />
    </ErrorBoundary>
  );
  WrappedPage.displayName = `lazyPage(${LazyComp.displayName || LazyComp.name || 'Page'})`;
  return WrappedPage;
};

const AppLayout = lazyPage(() => import('./components/Layout'));
const AssetList = lazyPage(() => import('./pages/AssetList'));
const AssetForm = lazyPage(() => import('./pages/AssetForm'));
const AssetCategorySelect = lazyPage(() => import('./pages/AssetCategorySelect'));
const AssetDetail = lazyPage(() => import('./pages/AssetDetail'));
const InventoryList = lazyPage(() => import('./pages/InventoryList'));
const InventoryForm = lazyPage(() => import('./pages/InventoryForm'));
const InventoryDetail = lazyPage(() => import('./pages/InventoryDetail'));
const InventorySelfCheck = lazyPage(() => import('./pages/InventorySelfCheck'));
const TransferList = lazyPage(() => import('./pages/TransferList'));
const TransferForm = lazyPage(() => import('./pages/TransferForm'));
const ScrappingList = lazyPage(() => import('./pages/ScrappingList'));
const ScrappingForm = lazyPage(() => import('./pages/ScrappingForm'));
const ScrappingDetail = lazyPage(() => import('./pages/ScrappingDetail'));
const TransferRequestList = lazyPage(() => import('./pages/TransferRequestList'));
const IdleAssetList = lazyPage(() => import('./pages/IdleAssetList'));
const IdleAssetForm = lazyPage(() => import('./pages/IdleAssetForm'));
const IdleAssetDetail = lazyPage(() => import('./pages/IdleAssetDetail'));
const Dashboard = lazyPage(() => import('./pages/Dashboard'));
const DashboardDesktop = lazyPage(() => import('./pages/DashboardDesktop'));
const DashboardConfigManager = lazyPage(() => import('./pages/DashboardConfigManager'));
const Login = lazyPage(() => import('./pages/Login'));
const Register = lazyPage(() => import('./pages/Register'));
const TenantAssociation = lazyPage(() => import('./pages/TenantAssociation'));
const UserList = lazyPage(() => import('./pages/UserList'));
const UserForm = lazyPage(() => import('./pages/UserForm'));
const RolePermissionManagement = lazyPage(() => import('./pages/RolePermissionManagement'));
const TenantRoleConfig = lazyPage(() => import('./pages/TenantRoleConfig'));
const EnhancedPermissionManagement = lazyPage(() => import('./pages/EnhancedPermissionManagement'));
const UserRoleManagement = lazyPage(() => import('./pages/UserRoleManagement'));
const DataScopeManagement = lazyPage(() => import('./pages/DataScopeManagement'));
const TenantManagement = lazyPage(() => import('./pages/TenantManagement'));
const TemporaryMaintenanceList = lazyPage(() => import('./pages/TemporaryMaintenanceList'));
const TemporaryMaintenanceForm = lazyPage(() => import('./pages/TemporaryMaintenanceForm'));
const PreventiveMaintenanceList = lazyPage(() => import('./pages/PreventiveMaintenanceList'));
const PreventiveMaintenanceForm = lazyPage(() => import('./pages/PreventiveMaintenanceForm'));
const PreventiveMaintenanceDetail = lazyPage(() => import('./pages/PreventiveMaintenanceDetail'));
const MaintenanceTemplateList = lazyPage(() => import('./pages/MaintenanceTemplateList'));
const MaintenanceTemplateForm = lazyPage(() => import('./pages/MaintenanceTemplateForm'));
const MaintenanceRequestList = lazyPage(() => import('./pages/MaintenanceRequestList'));
const MaintenanceWorkOrderList = lazyPage(() => import('./pages/MaintenanceWorkOrderList'));
const MaintenanceUsageTriggerList = lazyPage(() => import('./pages/MaintenanceUsageTriggerList'));
const MaintenanceAssetUsage = lazyPage(() => import('./pages/MaintenanceAssetUsage'));
const MaintenanceEfficiencyDashboard = lazyPage(
  () => import('./pages/MaintenanceEfficiencyDashboard'),
);
const MaintenanceReminderList = lazyPage(() => import('./pages/MaintenanceReminderList'));
const WarrantyManagement = lazyPage(() => import('./pages/WarrantyManagement'));
const WarrantyContractManagement = lazyPage(() => import('./pages/WarrantyContractManagement'));
const WarrantyReminderManagement = lazyPage(() => import('./pages/WarrantyReminderManagement'));
const AssetLocationMap = lazyPage(() => import('./pages/AssetLocationMap'));
const TechnicalDocumentsList = lazyPage(() => import('./pages/TechnicalDocumentsList'));
const TechnicalDocumentsUpload = lazyPage(() => import('./pages/TechnicalDocumentsUpload'));
const TechnicalDocumentsExternalUpload = lazyPage(
  () => import('./pages/TechnicalDocumentsExternalUpload'),
);
const TechnicalDocumentsReview = lazyPage(() => import('./pages/TechnicalDocumentsReview'));
const TechnicalDocumentsAI = lazyPage(() => import('./pages/TechnicalDocumentsAI'));
const KnowledgeBaseList = lazyPage(() => import('./pages/KnowledgeBaseList'));
const KnowledgeBaseQA = lazyPage(() => import('./pages/KnowledgeBaseQA'));
const AssetShareUpload = lazyPage(() => import('./pages/AssetShareUpload'));
const AuditLogsList = lazyPage(() => import('./pages/AuditLogsList'));
const AuditLogManagement = lazyPage(() => import('./pages/AuditLogManagement'));
const BackupManagement = lazyPage(() => import('./pages/BackupManagement'));
const DatabaseConnectionManagement = lazyPage(() => import('./pages/DatabaseConnectionManagement'));
const FeishuConfigManagement = lazyPage(() => import('./pages/FeishuConfigManagement'));
const EmailConfigManagement = lazyPage(() => import('./pages/EmailConfigManagement'));
const NotificationManagement = lazyPage(() => import('./pages/NotificationManagement'));
const NotificationPreferences = lazyPage(() => import('./pages/NotificationPreferences'));
const ApiDocs = lazyPage(() => import('./pages/ApiDocs'));
const APIDocumentation = lazyPage(() => import('./pages/APIDocumentation'));
const AcceptanceList = lazyPage(() => import('./pages/AcceptanceList'));
const AcceptanceForm = lazyPage(() => import('./pages/AcceptanceForm'));
const AcceptanceDetail = lazyPage(() => import('./pages/AcceptanceDetail'));
const AcceptanceApplicationList = lazyPage(() => import('./pages/AcceptanceApplicationList'));
const AcceptanceApplicationForm = lazyPage(() => import('./pages/AcceptanceApplicationForm'));
const AcceptanceTemplateList = lazyPage(() => import('./pages/AcceptanceTemplateList'));
const AcceptanceStatistics = lazyPage(() => import('./pages/AcceptanceStatistics'));
const AcceptanceReminders = lazyPage(() => import('./pages/AcceptanceReminders'));
const AcceptanceReport = lazyPage(() => import('./pages/AcceptanceReport'));
const AcceptanceTeam = lazyPage(() => import('./pages/AcceptanceTeam'));
const IoTDeviceManagement = lazyPage(() => import('./pages/IoTDeviceManagement'));
const AIAssistant = lazyPage(() => import('./pages/AIAssistant'));
const AIQuestionRecords = lazyPage(() => import('./pages/AIQuestionRecords'));
const BeaconLocation = lazyPage(() => import('./pages/BeaconLocation'));
const Introduction = lazyPage(() => import('./pages/Introduction'));
const MetrologyList = lazyPage(() => import('./pages/MetrologyList'));
const MetrologyForm = lazyPage(() => import('./pages/MetrologyForm'));
const MetrologyDetail = lazyPage(() => import('./pages/MetrologyDetail'));
const MetrologyUploadPage = lazyPage(() => import('./pages/quality-control/MetrologyUploadPage'));
const MetrologyPage = lazyPage(() => import('./pages/quality-control/MetrologyPage'));
const QualityControlPage = lazyPage(() => import('./pages/quality-control/QualityControlPage'));
const StatisticsPage = lazyPage(() => import('./pages/quality-control/StatisticsPage'));
const QualityControlList = lazyPage(() => import('./pages/QualityControlList'));
const QualityControlForm = lazyPage(() => import('./pages/QualityControlForm'));
const QualityControlDetail = lazyPage(() => import('./pages/QualityControlDetail'));
const InventoryScanner = lazyPage(() => import('./pages/InventoryScanner'));
const BatchUploadPage = lazyPage(() => import('./pages/BatchUploadPage'));
const AdverseReactionList = lazyPage(() => import('./pages/AdverseReactionList'));
const AdverseReactionForm = lazyPage(() => import('./pages/AdverseReactionForm'));
const AdverseReactionDetail = lazyPage(() => import('./pages/AdverseReactionDetail'));
const AdverseReactionStatistics = lazyPage(() => import('./pages/AdverseReactionStatistics'));
const SystemSettings = lazyPage(() => import('./pages/SystemSettings'));
const TenantList = lazyPage(() => import('./pages/TenantList'));
const TenantForm = lazyPage(() => import('./pages/TenantForm'));
const TenantDetail = lazyPage(() => import('./pages/TenantDetail'));
const TenantAccessUrlManagement = lazyPage(() => import('./pages/TenantAccessUrlManagement'));
const DepartmentList = lazyPage(() => import('./pages/DepartmentList'));
const DepartmentForm = lazyPage(() => import('./pages/DepartmentForm'));
const DepartmentDetail = lazyPage(() => import('./pages/DepartmentDetail'));
const TenderProjectList = lazyPage(() => import('./pages/tendering/TenderProjectList'));
const TenderProjectForm = lazyPage(() => import('./pages/tendering/TenderProjectForm'));
const TenderProjectDetail = lazyPage(() => import('./pages/tendering/TenderProjectDetail'));
const TenderDocumentEditor = lazyPage(() => import('./pages/tendering/TenderDocumentEditor'));
const SupplierList = lazyPage(() => import('./pages/tendering/SupplierList'));
const SupplierQualificationUpload = lazyPage(() => import('./pages/tendering/SupplierQualificationUpload'));
const BidList = lazyPage(() => import('./pages/tendering/BidList'));
const BidOverview = lazyPage(() => import('./pages/tendering/BidOverview'));
const BidDetail = lazyPage(() => import('./pages/tendering/BidDetail'));
const BidEvaluation = lazyPage(() => import('./pages/tendering/BidEvaluation'));
const EvaluationOverview = lazyPage(() => import('./pages/tendering/EvaluationOverview'));
const TenderingDashboard = lazyPage(() => import('./pages/tendering/TenderingDashboard'));
const TenderStatistics = lazyPage(() => import('./pages/tendering/TenderStatistics'));
const TenderRequestList = lazyPage(() => import('./pages/tendering/TenderRequestList'));
const TenderRequestForm = lazyPage(() => import('./pages/tendering/TenderRequestForm'));
const TenderRequestDetail = lazyPage(() => import('./pages/tendering/TenderRequestDetail'));
const TenderInvoiceList = lazyPage(() => import('./pages/tendering/TenderInvoiceList'));
const TenderInvoiceForm = lazyPage(() => import('./pages/tendering/TenderInvoiceForm'));
const TenderInvoiceDetail = lazyPage(() => import('./pages/tendering/TenderInvoiceDetail'));
const AssetInvoiceForm = lazyPage(() => import('./pages/tendering/AssetInvoiceForm'));
const TenderPaymentList = lazyPage(() => import('./pages/tendering/TenderPaymentList'));
const TenderPaymentForm = lazyPage(() => import('./pages/tendering/TenderPaymentForm'));
const TenderPaymentDetail = lazyPage(() => import('./pages/tendering/TenderPaymentDetail'));
const TenderAcceptanceList = lazyPage(() => import('./pages/tendering/TenderAcceptanceList'));
const TenderAcceptanceForm = lazyPage(() => import('./pages/tendering/TenderAcceptanceForm'));
const TenderAcceptanceDetail = lazyPage(() => import('./pages/tendering/TenderAcceptanceDetail'));
const TenderAuditList = lazyPage(() => import('./pages/tendering/TenderAuditList'));
const TenderApprovalTodo = lazyPage(() => import('./pages/tendering/TenderApprovalTodo'));
const TenderApprovalFlows = lazyPage(() => import('./pages/tendering/TenderApprovalFlows'));
const TenderApprovalAICenter = lazyPage(() => import('./pages/tendering/TenderApprovalAICenter'));
const TenderApprovalAIHealth = lazyPage(() => import('./pages/tendering/TenderApprovalAIHealth'));
const TendererPreview = lazyPage(() => import('./pages/tendering/TendererPreview'));
const ContractList = lazyPage(() => import('./pages/tendering/ContractList'));
const ContractForm = lazyPage(() => import('./pages/tendering/ContractForm'));
const ContractDetail = lazyPage(() => import('./pages/tendering/ContractDetail'));
const EnterpriseSelect = lazyPage(() => import('./pages/EnterpriseSelect'));
const AssetLabelTemplateList = lazyPage(() => import('./pages/AssetLabelTemplateList'));
const AssetLabelPrint = lazyPage(() => import('./pages/AssetLabelPrint'));
const ReportPrint = lazyPage(() => import('./pages/ReportPrint'));
const AssetDepreciation = lazyPage(() => import('./pages/AssetDepreciation'));
const FinanceBudget = lazyPage(() => import('./pages/FinanceBudget'));
const FinanceTransactions = lazyPage(() => import('./pages/FinanceTransactions'));
const FinanceReports = lazyPage(() => import('./pages/FinanceReports'));
const TempAssetList = lazyPage(() => import('./pages/TempAssetList'));
const ModuleManagement = lazyPage(() => import('./pages/ModuleManagement'));
const TenantModuleConfig = lazyPage(() => import('./pages/TenantModuleConfig'));
const CloudSyncManagement = lazyPage(() => import('./pages/CloudSyncManagement'));
const AssetMonitoring = lazyPage(() => import('./pages/AssetMonitoring'));
const EnvironmentMonitoring = lazyPage(() => import('./pages/EnvironmentMonitoring'));
const TokenManagement = lazyPage(() => import('./pages/TokenManagement'));
const Profile = lazyPage(() => import('./pages/Profile'));
const ChangePassword = lazyPage(() => import('./pages/ChangePassword'));
const Preferences = lazyPage(() => import('./pages/Preferences'));
const ComplianceDashboard = lazyPage(() => import('./pages/compliance/Dashboard'));
const ComplianceMaintenanceLevel = lazyPage(() => import('./pages/compliance/MaintenanceLevel'));
const SpecialEquipment = lazyPage(() => import('./pages/compliance/SpecialEquipment'));
const SafetyInspection = lazyPage(() => import('./pages/compliance/SafetyInspection'));
const RiskDashboard = lazyPage(() => import('./pages/risk/Dashboard'));
const RiskAssessmentPage = lazyPage(() => import('./pages/risk/RiskAssessment'));
const RiskClassificationPage = lazyPage(() => import('./pages/risk/RiskClassification'));
const RiskControlPage = lazyPage(() => import('./pages/risk/RiskControl'));
const StaffDashboard = lazyPage(() => import('./modules/staff/pages/Dashboard'));
const QualificationManagement = lazyPage(() => import('./modules/staff/pages/Qualifications'));
const TrainingManagement = lazyPage(() => import('./modules/staff/pages/Training'));
const CompetencyAssessment = lazyPage(() => import('./modules/staff/pages/Assessments'));
const UptimeDashboard = lazyPage(() => import('./pages/uptime/Dashboard'));
const UptimeOverview = lazyPage(() => import('./pages/uptime/UptimeOverview'));
const OperationLogManagement = lazyPage(() => import('./pages/uptime/OperationLogManagement'));
const UptimeStatistics = lazyPage(() => import('./pages/uptime/UptimeStatistics'));
// 公开扫码页（供应商扫码访问，无鉴权）
const TendererPortal = lazyPage(() => import('./pages/public/TendererPortal'));

// 巡检管理模块
const InspectionList = lazyPage(() => import('./pages/inspection/InspectionList'));
const InspectionRecordList = lazyPage(() => import('./pages/inspection/InspectionRecordList'));
const InspectionRecordForm = lazyPage(() => import('./pages/inspection/InspectionRecordForm'));
const InspectionRecordDetail = lazyPage(() => import('./pages/inspection/InspectionRecordDetail'));
const InspectionTemplateList = lazyPage(() => import('./pages/inspection/InspectionTemplateList'));
const InspectionTemplateForm = lazyPage(() => import('./pages/inspection/InspectionTemplateForm'));
const InspectionStatistics = lazyPage(() => import('./pages/inspection/InspectionStatistics'));
const InspectionIssues = lazyPage(() => import('./pages/inspection/InspectionIssues'));
const InspectionCalendar = lazyPage(() => import('./pages/inspection/InspectionCalendar'));
const InspectionPlans = lazyPage(() => import('./pages/inspection/InspectionPlans'));
const InspectionRoutes = lazyPage(() => import('./pages/inspection/InspectionRoutes'));

const AdminOnly = ({ children }) => {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      let userData = crypto.getItem('user');
      if (!userData) {
        userData = await crypto.getItemAsync('user');
      }
      setUser(userData);
      setReady(true);
    };
    loadUser();
  }, []);

  if (!ready) {
    return <div style={{ padding: '40px 16px', textAlign: 'center', color: '#64748b' }}>加载中...</div>;
  }

  if (!user) {
    return <Navigate to={getHomePath()} replace />;
  }
  if (isAdminRole(user?.role)) {
    return children;
  }
  return <Navigate to={getHomePath()} replace />;
};

const RouteLoadingFallback = () => (
  <div style={{ padding: '40px 16px', textAlign: 'center', color: '#64748b' }}>页面加载中...</div>
);

function App() {
  // 启动时不再调用网络诊断，避免 /api 请求导致页面一直转圈
  return (
    <DepartmentProvider>
      <Router>
        <Suspense fallback={<RouteLoadingFallback />}>
          <Routes>
            <Route path="/" element={<Introduction />} />
            <Route path="/intro" element={<Introduction />} />
            <Route path="/login" element={<Login />} />
            <Route path="/tenant-association" element={<TenantAssociation />} />
            <Route path="/register" element={<Register />} />
            <Route path="/enterprise-select" element={<EnterpriseSelect />} />

            {/* 弹窗路由 - 不需要侧边栏和顶部栏，直接渲染页面内容 */}
            {/* 弹窗从主窗口打开，已通过主窗口认证，不需再次验证 */}
            <Route path="/popup/*" element={
                <Routes>
                  <Route path="assets" element={<AssetList />} />
                  <Route path="assets/import" element={<AssetList />} />
                  <Route path="assets/:id" element={<AssetDetail />} />
                  <Route path="assets/add" element={<AssetCategorySelect />} />
                  <Route path="assets/new" element={<AssetForm />} />
                  <Route path="assets/edit/:id" element={<AssetForm />} />
                  <Route path="inventory" element={<InventoryList />} />
                  <Route path="inventory/self" element={<InventorySelfCheck />} />
                  <Route path="inventory/new" element={<InventoryForm />} />
                  <Route path="inventory/edit/:id" element={<InventoryForm />} />
                  <Route path="inventory/:id" element={<InventoryDetail />} />
                  <Route path="inventory/:id/scan" element={<InventoryScanner />} />
                  <Route path="transfer" element={<TransferList />} />
                  <Route path="transfer/new" element={<TransferForm />} />
                  <Route path="transfer/requests" element={<TransferRequestList />} />
                  <Route path="idle" element={<IdleAssetList />} />
                  <Route path="idle/new" element={<IdleAssetForm />} />
                  <Route path="idle/:id" element={<IdleAssetDetail />} />
                  <Route path="scrapping" element={<ScrappingList />} />
                  <Route path="scrapping/new" element={<ScrappingForm />} />
                  <Route path="scrapping/:id" element={<ScrappingDetail />} />
                  <Route path="scrapping/:id/edit" element={<ScrappingForm />} />
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="dashboard-desktop" element={<DashboardDesktop />} />
                  <Route path="depreciation" element={<AssetDepreciation />} />
                  <Route path="maintenance/temporary" element={<TemporaryMaintenanceList />} />
                  <Route path="maintenance/temporary/new" element={<TemporaryMaintenanceForm />} />
                  <Route path="maintenance/temporary/edit/:id" element={<TemporaryMaintenanceForm />} />
                  <Route path="maintenance/plans" element={<PreventiveMaintenanceList />} />
                  <Route path="maintenance/plans/new" element={<PreventiveMaintenanceForm />} />
                  <Route path="maintenance/plans/edit/:id" element={<PreventiveMaintenanceForm />} />
                  <Route path="maintenance/plans/:id" element={<PreventiveMaintenanceDetail />} />
                  <Route path="maintenance/templates" element={<MaintenanceTemplateList />} />
                  <Route path="maintenance/templates/new" element={<MaintenanceTemplateForm />} />
                  <Route path="maintenance/templates/edit/:id" element={<MaintenanceTemplateForm />} />
                  <Route path="maintenance/requests" element={<MaintenanceRequestList />} />
                  <Route path="maintenance/workorders" element={<MaintenanceWorkOrderList />} />
                  <Route path="maintenance/efficiency" element={<MaintenanceEfficiencyDashboard />} />
                  <Route path="maintenance/reminders" element={<MaintenanceReminderList />} />
                  <Route path="maintenance/warranty" element={<WarrantyManagement />} />
                  <Route path="maintenance/warranty-contracts" element={<WarrantyContractManagement />} />
                  <Route path="maintenance/warranty-reminders" element={<WarrantyReminderManagement />} />
                  <Route path="maintenance/usage-triggers" element={<MaintenanceUsageTriggerList />} />
                  <Route path="maintenance/asset-usage" element={<MaintenanceAssetUsage />} />
                  <Route path="asset-location" element={<AssetLocationMap />} />
                  <Route path="ai-assistant" element={<AIAssistant />} />
                  <Route path="ai-question-records" element={<AIQuestionRecords />} />
                  <Route path="technical-documents" element={<TechnicalDocumentsList />} />
                  <Route path="technical-documents/ai" element={<TechnicalDocumentsAI />} />
                  <Route path="technical-documents/upload" element={<TechnicalDocumentsUpload />} />
                  <Route path="technical-documents/review" element={<TechnicalDocumentsReview />} />
                  <Route path="knowledge-base" element={<KnowledgeBaseList />} />
                  <Route path="knowledge-base/qa" element={<KnowledgeBaseQA />} />
                  <Route path="acceptance" element={<AcceptanceList />} />
                  <Route path="acceptance/create" element={<AcceptanceForm />} />
                  <Route path="acceptance/edit/:id" element={<AcceptanceForm />} />
                  <Route path="acceptance/reminders" element={<AcceptanceReminders />} />
                  <Route path="acceptance/teams/:id" element={<AcceptanceTeam />} />
                  <Route path="acceptance/report/:id" element={<AcceptanceReport />} />
                  <Route path="acceptance/:id" element={<AcceptanceDetail />} />
                  <Route path="quality-control/metrology" element={<MetrologyList />} />
                  <Route path="quality-control/metrology/new" element={<MetrologyForm />} />
                  <Route path="quality-control/metrology/edit/:id" element={<MetrologyForm />} />
                  <Route path="quality-control/metrology/:id" element={<MetrologyDetail />} />
                  <Route path="quality-control/metrology/upload" element={<MetrologyUploadPage />} />
                  <Route path="quality-control/metrology/management" element={<MetrologyPage />} />
                  <Route path="quality-control/management" element={<QualityControlPage />} />
                  <Route path="quality-control/statistics" element={<StatisticsPage />} />
                  <Route path="quality-control/qc" element={<QualityControlList />} />
                  <Route path="quality-control/qc/new" element={<QualityControlForm />} />
                  <Route path="quality-control/qc/edit/:id" element={<QualityControlForm />} />
                  <Route path="quality-control/qc/:id" element={<QualityControlDetail />} />
                  <Route path="adverse-reaction" element={<AdverseReactionList />} />
                  <Route path="adverse-reaction/new" element={<AdverseReactionForm />} />
                  <Route path="adverse-reaction/edit/:id" element={<AdverseReactionForm />} />
                  <Route path="adverse-reaction/statistics" element={<AdverseReactionStatistics />} />
                  <Route path="adverse-reaction/:id" element={<AdverseReactionDetail />} />
                  <Route path="asset-monitoring" element={<AssetMonitoring />} />
                  <Route path="environment-monitoring" element={<EnvironmentMonitoring />} />
                  <Route path="compliance" element={<ComplianceDashboard />} />
                  <Route path="compliance/maintenance-level" element={<ComplianceMaintenanceLevel />} />
                  <Route path="special-equipment" element={<SpecialEquipment />} />
                  <Route path="safety-inspection" element={<SafetyInspection />} />
                  <Route path="inspection" element={<InspectionList />} />
                  <Route path="inspection/records" element={<InspectionRecordList />} />
                  <Route path="inspection/records/new" element={<InspectionRecordForm />} />
                  <Route path="inspection/records/:id" element={<InspectionRecordDetail />} />
                  <Route path="inspection/templates" element={<InspectionTemplateList />} />
                  <Route path="inspection/templates/new" element={<InspectionTemplateForm />} />
                  <Route path="inspection/templates/:id" element={<InspectionTemplateForm />} />
                  <Route path="inspection/templates/:id/edit" element={<InspectionTemplateForm />} />
                  <Route path="inspection/statistics" element={<InspectionStatistics />} />
                  <Route path="inspection/issues" element={<InspectionIssues />} />
                  <Route path="inspection/calendar" element={<InspectionCalendar />} />
                  <Route path="inspection/plans" element={<InspectionPlans />} />
                  <Route path="inspection/routes" element={<InspectionRoutes />} />
                  <Route path="risk" element={<Navigate to="risk/dashboard" replace />} />
                  <Route path="risk/dashboard" element={<RiskDashboard />} />
                  <Route path="risk/assessment" element={<RiskAssessmentPage />} />
                  <Route path="risk/classification" element={<RiskClassificationPage />} />
                  <Route path="risk/control" element={<RiskControlPage />} />
                  <Route path="staff" element={<Navigate to="staff/dashboard" replace />} />
                  <Route path="staff/dashboard" element={<StaffDashboard />} />
                  <Route path="staff/qualifications" element={<QualificationManagement />} />
                  <Route path="staff/training" element={<TrainingManagement />} />
                  <Route path="staff/assessments" element={<CompetencyAssessment />} />
                  <Route path="uptime" element={<Navigate to="uptime/dashboard" replace />} />
                  <Route path="uptime/dashboard" element={<UptimeDashboard />} />
                  <Route path="uptime/overview" element={<UptimeOverview />} />
                  <Route path="uptime/operation-logs" element={<OperationLogManagement />} />
                  <Route path="uptime/statistics" element={<UptimeStatistics />} />
                  <Route path="users" element={<AdminOnly><UserList /></AdminOnly>} />
                  <Route path="users/new" element={<AdminOnly><UserForm /></AdminOnly>} />
                  <Route path="users/edit/:id" element={<AdminOnly><UserForm /></AdminOnly>} />
                  <Route path="roles-permissions" element={<AdminOnly><RolePermissionManagement /></AdminOnly>} />
                  <Route path="tenant-role-config" element={<AdminOnly><TenantRoleConfig /></AdminOnly>} />
                  <Route path="enhanced-permissions" element={<AdminOnly><EnhancedPermissionManagement /></AdminOnly>} />
                  <Route path="user-roles" element={<AdminOnly><UserRoleManagement /></AdminOnly>} />
                  <Route path="data-scope" element={<AdminOnly><DataScopeManagement /></AdminOnly>} />
                  <Route path="tenant-management" element={<AdminOnly><TenantManagement /></AdminOnly>} />
                  <Route path="system-settings" element={<AdminOnly><SystemSettings /></AdminOnly>} />
                  <Route path="modules" element={<AdminOnly><ModuleManagement /></AdminOnly>} />
                  <Route path="departments" element={<AdminOnly><DepartmentList /></AdminOnly>} />
                  <Route path="departments/new" element={<AdminOnly><DepartmentForm /></AdminOnly>} />
                  <Route path="departments/edit/:id" element={<AdminOnly><DepartmentForm /></AdminOnly>} />
                  <Route path="departments/:id" element={<AdminOnly><DepartmentDetail /></AdminOnly>} />
                  <Route path="temp-assets" element={<TempAssetList />} />
                  <Route path="asset-labels/templates" element={<AdminOnly><AssetLabelTemplateList /></AdminOnly>} />
                  <Route path="asset-labels/print" element={<AdminOnly><AssetLabelPrint /></AdminOnly>} />
                  <Route path="report-print" element={<ReportPrint />} />
                  {/* Missing routes from desktopMenuItems */}
                  <Route path="beacon-location" element={<BeaconLocation />} />
                  <Route path="iot-devices" element={<IoTDeviceManagement />} />
                  <Route path="technical-documents/batch-upload" element={<BatchUploadPage />} />
                  <Route path="cloud-sync" element={<CloudSyncManagement />} />
                  <Route path="audit-logs" element={<AuditLogsList />} />
                  <Route path="backup" element={<BackupManagement />} />
                  <Route path="database-connection" element={<AdminOnly><DatabaseConnectionManagement /></AdminOnly>} />
                  <Route path="feishu-config" element={<AdminOnly><FeishuConfigManagement /></AdminOnly>} />
                  <Route path="email-config" element={<AdminOnly><EmailConfigManagement /></AdminOnly>} />
                  <Route path="notification-config" element={<AdminOnly><NotificationManagement /></AdminOnly>} />
                  <Route path="notification-preferences" element={<NotificationPreferences />} />
                  <Route path="api-docs" element={<AdminOnly><ApiDocs /></AdminOnly>} />
                  <Route path="api-documentation" element={<AdminOnly><APIDocumentation /></AdminOnly>} />
                  <Route path="dashboard-configs" element={<DashboardConfigManager />} />
                  <Route path="tenant-module-config" element={<TenantModuleConfig />} />
                  <Route path="system/token-management" element={<TokenManagement />} />
                  {/* Catch-all for unmatched popup routes */}
                  <Route path="*" element={<div style={{ padding: '40px 16px', textAlign: 'center', color: '#64748b' }}>页面不存在或无法加载</div>} />
                </Routes>
            } />

            <Route
              path="/technical-documents/upload/:token"
              element={<TechnicalDocumentsExternalUpload />}
            />
            <Route path="/asset-share/:token" element={<AssetShareUpload />} />
            {/* 供应商扫码上传资质（免登录公开页） */}
            <Route path="/supplier-upload/:token" element={<SupplierQualificationUpload />} />
            {/* 招标项目共享二维码（任何供应商扫码即可访问） */}
            <Route path="/tenderer/:token" element={<TendererPortal />} />

            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Routes>
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/dashboard-desktop" element={<DashboardDesktop />} />
                    <Route
                      path="/dashboard-configs"
                      element={
                        <AdminOnly>
                          <DashboardConfigManager />
                        </AdminOnly>
                      }
                    />
                    <Route path="/assets" element={<AssetList />} />
                    <Route path="/assets/import" element={<AssetList />} />
                    <Route path="/assets/:id" element={<AssetDetail />} />
                    <Route path="/assets/add" element={<AssetCategorySelect />} />
                    <Route path="/assets/new" element={<AssetForm />} />
                    <Route path="/assets/edit/:id" element={<AssetForm />} />
                    <Route path="/inventory" element={<InventoryList />} />
                    <Route path="/inventory/self" element={<InventorySelfCheck />} />
                    <Route path="/inventory/new" element={<InventoryForm />} />
                    <Route path="/inventory/edit/:id" element={<InventoryForm />} />
                    <Route path="/inventory/:id" element={<InventoryDetail />} />
                    <Route path="/inventory/:id/scan" element={<InventoryScanner />} />
                    <Route path="/transfer" element={<TransferList />} />
                    <Route path="/transfer/new" element={<TransferForm />} />
                    <Route path="/transfer/requests" element={<TransferRequestList />} />
                    <Route path="/idle" element={<IdleAssetList />} />
                    <Route path="/idle/new" element={<IdleAssetForm />} />
                    <Route path="/idle/:id" element={<IdleAssetDetail />} />
                    <Route path="/scrapping" element={<ScrappingList />} />
                    <Route path="/scrapping/new" element={<ScrappingForm />} />
                    <Route path="/scrapping/:id" element={<ScrappingDetail />} />
                    <Route path="/scrapping/:id/edit" element={<ScrappingForm />} />
                    <Route path="/tenants" element={<AdminOnly><TenantList /></AdminOnly>} />
                    <Route path="/tenants/new" element={<AdminOnly><TenantForm /></AdminOnly>} />
                    <Route path="/tenants/edit/:id" element={<AdminOnly><TenantForm /></AdminOnly>} />
                    <Route path="/tenants/:id" element={<AdminOnly><TenantDetail /></AdminOnly>} />
                    <Route path="/tenant-access-url" element={<AdminOnly><TenantAccessUrlManagement /></AdminOnly>} />
                    <Route path="/users" element={<AdminOnly><UserList /></AdminOnly>} />
                    <Route path="/users/new" element={<AdminOnly><UserForm /></AdminOnly>} />
                    <Route path="/users/edit/:id" element={<AdminOnly><UserForm /></AdminOnly>} />
                    <Route path="/roles-permissions" element={<AdminOnly><RolePermissionManagement /></AdminOnly>} />
                    <Route path="/tenant-role-config" element={<AdminOnly><TenantRoleConfig /></AdminOnly>} />
                    <Route path="/enhanced-permissions" element={<AdminOnly><EnhancedPermissionManagement /></AdminOnly>} />
                    <Route path="/user-roles" element={<AdminOnly><UserRoleManagement /></AdminOnly>} />
                    <Route path="/data-scope" element={<AdminOnly><DataScopeManagement /></AdminOnly>} />
                    <Route path="/tenant-management" element={<AdminOnly><TenantManagement /></AdminOnly>} />
                    <Route path="/system-settings" element={<AdminOnly><SystemSettings /></AdminOnly>} />
                    <Route path="/audit-logs" element={<AdminOnly><AuditLogsList /></AdminOnly>} />
                    <Route path="/audit-management" element={<AdminOnly><AuditLogManagement /></AdminOnly>} />
                    <Route path="/backup" element={<AdminOnly><BackupManagement /></AdminOnly>} />
                    <Route path="/database-connection" element={<AdminOnly><DatabaseConnectionManagement /></AdminOnly>} />
                    <Route path="/feishu-config" element={<AdminOnly><FeishuConfigManagement /></AdminOnly>} />
                    <Route path="/email-config" element={<AdminOnly><EmailConfigManagement /></AdminOnly>} />
                    <Route path="/notification-config" element={<AdminOnly><NotificationManagement /></AdminOnly>} />
                    <Route path="/notification-preferences" element={<NotificationPreferences />} />
                    <Route path="/api-docs" element={<AdminOnly><ApiDocs /></AdminOnly>} />
                    <Route path="/api-documentation" element={<AdminOnly><APIDocumentation /></AdminOnly>} />
                    <Route path="/maintenance/temporary" element={<TemporaryMaintenanceList />} />
                    <Route path="/maintenance/temporary/new" element={<TemporaryMaintenanceForm />} />
                    <Route path="/maintenance/temporary/edit/:id" element={<TemporaryMaintenanceForm />} />
                    <Route path="/maintenance/plans" element={<PreventiveMaintenanceList />} />
                    <Route path="/maintenance/plans/new" element={<PreventiveMaintenanceForm />} />
                    <Route
                      path="/maintenance/plans/edit/:id"
                      element={<PreventiveMaintenanceForm />}
                    />
                    <Route
                      path="/maintenance/plans/:id"
                      element={<PreventiveMaintenanceDetail />}
                    />
                    <Route path="/maintenance/templates" element={<MaintenanceTemplateList />} />
                    <Route
                      path="/maintenance/templates/new"
                      element={<MaintenanceTemplateForm />}
                    />
                    <Route
                      path="/maintenance/templates/edit/:id"
                      element={<MaintenanceTemplateForm />}
                    />
                    <Route path="/maintenance/requests" element={<MaintenanceRequestList />} />
                    <Route path="/maintenance/requests/new" element={<MaintenanceRequestList />} />
                    <Route
                      path="/maintenance/requests/edit/:id"
                      element={<MaintenanceRequestList />}
                    />
                    <Route path="/maintenance/requests/:id" element={<MaintenanceRequestList />} />
                    <Route
                      path="/maintenance/requests/complete/:id"
                      element={<MaintenanceRequestList />}
                    />
                    <Route path="/maintenance/workorders" element={<MaintenanceWorkOrderList />} />
                    <Route
                      path="/maintenance/workorders/new"
                      element={<MaintenanceWorkOrderList />}
                    />
                    <Route
                      path="/maintenance/workorders/edit/:id"
                      element={<MaintenanceWorkOrderList />}
                    />
                    <Route
                      path="/maintenance/workorders/:id"
                      element={<MaintenanceWorkOrderList />}
                    />
                    <Route
                      path="/maintenance/efficiency"
                      element={<MaintenanceEfficiencyDashboard />}
                    />
                    <Route path="/maintenance/reminders" element={<MaintenanceReminderList />} />
                    <Route path="/maintenance/warranty" element={<WarrantyManagement />} />
                    <Route path="/maintenance/warranty-contracts" element={<WarrantyContractManagement />} />
                    <Route path="/maintenance/warranty-reminders" element={<WarrantyReminderManagement />} />
                    <Route
                      path="/maintenance/usage-triggers"
                      element={<MaintenanceUsageTriggerList />}
                    />
                    <Route path="/maintenance/asset-usage" element={<MaintenanceAssetUsage />} />
                    <Route path="/asset-location" element={<AssetLocationMap />} />
                    <Route path="/beacon-location" element={<BeaconLocation />} />
                    <Route path="/iot-devices" element={<IoTDeviceManagement />} />
                    <Route path="/ai-assistant" element={<AIAssistant />} />
                    <Route path="/ai-assistant-hub" element={<Navigate to="/ai-assistant" replace />} />
                    <Route
                      path="/ai-assistant/ct-maintenance"
                      element={<Navigate to="/ai-assistant" replace />}
                    />
                    <Route path="/asset-query" element={<Navigate to="/ai-assistant" replace />} />
                    <Route path="/asset-ai-analysis" element={<Navigate to="/ai-assistant" replace />} />
                    <Route path="/ai-maintenance" element={<Navigate to="/ai-assistant" replace />} />
                    <Route path="/ai-question-records" element={<AIQuestionRecords />} />
                    <Route path="/compliance" element={<ComplianceDashboard />} />
                    <Route
                      path="/compliance/maintenance-level"
                      element={<ComplianceMaintenanceLevel />}
                    />
                    <Route path="/special-equipment" element={<SpecialEquipment />} />
                    <Route path="/safety-inspection" element={<SafetyInspection />} />
                    <Route path="/inspection" element={<InspectionList />} />
                    <Route path="/inspection/records" element={<InspectionRecordList />} />
                    <Route path="/inspection/records/new" element={<InspectionRecordForm />} />
                    <Route path="/inspection/records/:id" element={<InspectionRecordDetail />} />
                    <Route path="/inspection/templates" element={<InspectionTemplateList />} />
                    <Route path="/inspection/templates/new" element={<InspectionTemplateForm />} />
                    <Route path="/inspection/templates/:id" element={<InspectionTemplateForm />} />
                    <Route path="/inspection/templates/:id/edit" element={<InspectionTemplateForm />} />
                    <Route path="/inspection/statistics" element={<InspectionStatistics />} />
                    <Route path="/inspection/issues" element={<InspectionIssues />} />
                    <Route path="/inspection/calendar" element={<InspectionCalendar />} />
                    <Route path="/inspection/plans" element={<InspectionPlans />} />
                    <Route path="/inspection/routes" element={<InspectionRoutes />} />
                    <Route
                      path="/compliance/special-equipment"
                      element={<Navigate to="/special-equipment" replace />}
                    />
                    <Route
                      path="/compliance/safety-inspection"
                      element={<Navigate to="/safety-inspection" replace />}
                    />
                    <Route path="/risk" element={<Navigate to="/risk/dashboard" replace />} />
                    <Route path="/risk/dashboard" element={<RiskDashboard />} />
                    <Route path="/risk/assessment" element={<RiskAssessmentPage />} />
                    <Route path="/risk/classification" element={<RiskClassificationPage />} />
                    <Route path="/risk/control" element={<RiskControlPage />} />
                    <Route path="/staff" element={<Navigate to="/staff/dashboard" replace />} />
                    <Route path="/staff/dashboard" element={<StaffDashboard />} />
                    <Route
                      path="/staff/qualifications"
                      element={<QualificationManagement />}
                    />
                    <Route path="/staff/training" element={<TrainingManagement />} />
                    <Route path="/staff/assessments" element={<CompetencyAssessment />} />
                    <Route path="/uptime" element={<Navigate to="/uptime/dashboard" replace />} />
                    <Route path="/uptime/dashboard" element={<UptimeDashboard />} />
                    <Route path="/uptime/overview" element={<UptimeOverview />} />
                    <Route
                      path="/uptime/operation-logs"
                      element={<OperationLogManagement />}
                    />
                    <Route path="/uptime/statistics" element={<UptimeStatistics />} />
                    <Route path="/technical-documents" element={<TechnicalDocumentsList />} />
                    <Route path="/technical-documents/ai" element={<TechnicalDocumentsAI />} />
                    <Route
                      path="/technical-documents/upload"
                      element={<TechnicalDocumentsUpload />}
                    />
                    <Route
                      path="/technical-documents/review"
                      element={<TechnicalDocumentsReview />}
                    />
                    <Route path="/knowledge-base" element={<KnowledgeBaseList />} />
                    <Route path="/knowledge-base/qa" element={<KnowledgeBaseQA />} />
                    <Route path="/acceptance" element={<AcceptanceList />} />
                    <Route path="/acceptance/create" element={<AcceptanceForm />} />
                    <Route path="/acceptance/edit/:id" element={<AcceptanceForm />} />
                    <Route path="/acceptance/applications" element={<AcceptanceApplicationList />} />
                    <Route path="/acceptance/applications/create" element={<AcceptanceApplicationForm />} />
                    <Route path="/acceptance/applications/edit/:id" element={<AcceptanceApplicationForm />} />
                    <Route path="/acceptance/templates" element={<AcceptanceTemplateList />} />
                    <Route path="/acceptance/statistics" element={<AcceptanceStatistics />} />
                    <Route path="/acceptance/reminders" element={<AcceptanceReminders />} />
                    <Route path="/acceptance/report/:id" element={<AcceptanceReport />} />
                    <Route path="/acceptance/teams/:id" element={<AcceptanceTeam />} />
                    <Route path="/acceptance/:id" element={<AcceptanceDetail />} />
                    <Route path="/quality-control/metrology" element={<MetrologyList />} />
                    <Route path="/quality-control/metrology/new" element={<MetrologyForm />} />
                    <Route path="/quality-control/metrology/edit/:id" element={<MetrologyForm />} />
                    <Route path="/quality-control/metrology/:id" element={<MetrologyDetail />} />
                    <Route
                      path="/quality-control/metrology/upload"
                      element={<MetrologyUploadPage />}
                    />
                    <Route
                      path="/quality-control/metrology/management"
                      element={<MetrologyPage />}
                    />
                    <Route path="/quality-control/management" element={<QualityControlPage />} />
                    <Route path="/quality-control/statistics" element={<StatisticsPage />} />
                    <Route path="/quality-control/qc" element={<QualityControlList />} />
                    <Route path="/quality-control/qc/new" element={<QualityControlForm />} />
                    <Route path="/quality-control/qc/edit/:id" element={<QualityControlForm />} />
                    <Route path="/quality-control/qc/:id" element={<QualityControlDetail />} />
                    <Route
                      path="/adverse-events"
                      element={<Navigate to="/adverse-reaction" replace />}
                    />
                    <Route
                      path="/adverse-events/new"
                      element={<Navigate to="/adverse-reaction/new" replace />}
                    />
                    <Route
                      path="/adverse-events/statistics"
                      element={<Navigate to="/adverse-reaction/statistics" replace />}
                    />
                    <Route path="/adverse-events/edit/:id" element={<AdverseReactionForm />} />
                    <Route path="/adverse-events/:id" element={<AdverseReactionDetail />} />
                    <Route path="/adverse-reaction" element={<AdverseReactionList />} />
                    <Route path="/adverse-reaction/new" element={<AdverseReactionForm />} />
                    <Route path="/adverse-reaction/edit/:id" element={<AdverseReactionForm />} />
                    <Route path="/adverse-reaction/statistics" element={<AdverseReactionStatistics />} />
                    <Route path="/adverse-reaction/:id" element={<AdverseReactionDetail />} />
                    <Route path="/iot/devices" element={<Navigate to="/iot-devices" replace />} />
                    <Route path="/asset-monitoring" element={<AssetMonitoring />} />
                    <Route
                      path="/environment-monitoring"
                      element={<EnvironmentMonitoring />}
                    />
                    <Route
                      path="/system/token-management"
                      element={
                        <AdminOnly>
                          <TokenManagement />
                        </AdminOnly>
                      }
                    />
                    {/* 资产标签相关路由 */}
                    <Route path="/asset-labels/templates" element={<AdminOnly><AssetLabelTemplateList /></AdminOnly>} />
                    <Route path="/asset-labels/print" element={<AdminOnly><AssetLabelPrint /></AdminOnly>} />
                    <Route path="/report-print" element={<ReportPrint />} />

                    {/* 折旧管理（保留旧路径兼容） */}
                    <Route path="/depreciation" element={<AssetDepreciation />} />
                    <Route
                      path="/asset-depreciation"
                      element={<Navigate to="/depreciation" replace />}
                    />

                    {/* 财务管理 - 新增子模块 */}
                    <Route path="/finance/budget" element={<FinanceBudget />} />
                    <Route path="/finance/transactions" element={<FinanceTransactions />} />
                    <Route path="/finance/reports" element={<FinanceReports />} />

                    {/* 部门管理相关路由 */}
                    <Route path="/departments" element={<AdminOnly><DepartmentList /></AdminOnly>} />
                    <Route path="/departments/new" element={<AdminOnly><DepartmentForm /></AdminOnly>} />
                    <Route path="/departments/edit/:id" element={<AdminOnly><DepartmentForm /></AdminOnly>} />
                    <Route path="/departments/:id" element={<AdminOnly><DepartmentDetail /></AdminOnly>} />

                    {/* 临时资产管理路由 */}
                    <Route path="/temp-assets" element={<TempAssetList />} />
                    {/* 模块管理路由 */}
                    <Route
                      path="/modules"
                      element={
                        <AdminOnly>
                          <ModuleManagement />
                        </AdminOnly>
                      }
                    />
                    {/* 企业空间模块配置路由 */}
                    <Route
                      path="/tenant-module-config"
                      element={
                        <AdminOnly>
                          <TenantModuleConfig />
                        </AdminOnly>
                      }
                    />
                    <Route
                      path="/cloud-sync"
                      element={
                        <AdminOnly>
                          <CloudSyncManagement />
                        </AdminOnly>
                      }
                    />
                    {/* 技术资料批量上传路由（保留旧路径兼容） */}
                    <Route path="/technical-documents/batch-upload" element={<BatchUploadPage />} />
                    <Route
                      path="/batch-upload"
                      element={<Navigate to="/technical-documents/batch-upload" replace />}
                    />
                    {/* 招标采购管理路由 */}
                    <Route path="/tendering" element={<Navigate to="/tendering/dashboard" replace />} />
                    <Route path="/tendering/dashboard" element={<TenderingDashboard />} />

                    {/* 采购申请（前置于招标流程，合并自 procurement-management） */}
                    <Route path="/tendering/requests" element={<TenderRequestList />} />
                    <Route path="/tendering/requests/new" element={<TenderRequestForm />} />
                    <Route path="/tendering/requests/edit/:id" element={<TenderRequestForm />} />
                    <Route path="/tendering/requests/:id" element={<TenderRequestDetail />} />

                    <Route path="/tendering/projects" element={<TenderProjectList />} />
                    <Route path="/tendering/projects/new" element={<TenderProjectForm />} />
                    <Route path="/tendering/projects/edit/:id" element={<TenderProjectForm />} />
                    <Route path="/tendering/projects/:id" element={<TenderProjectDetail />} />
                    <Route path="/tendering/projects/:id/document" element={<TenderDocumentEditor />} />
                    <Route path="/tendering/projects/:id/bids" element={<BidList />} />
                    <Route path="/tendering/projects/:id/evaluations" element={<BidEvaluation />} />
                    <Route path="/tendering/bids" element={<BidOverview />} />
                    <Route path="/tendering/evaluations" element={<EvaluationOverview />} />
                    <Route path="/tendering/statistics" element={<TenderStatistics />} />
                    <Route path="/tendering/qrcodes" element={<TendererPreview />} />
                    <Route path="/tendering/bids/:bidId" element={<BidDetail />} />
                    <Route path="/tendering/suppliers" element={<SupplierList />} />
                    <Route path="/tendering/contracts" element={<ContractList />} />
                    <Route path="/tendering/contracts/new" element={<ContractForm />} />
                    <Route path="/tendering/contracts/edit/:id" element={<ContractForm />} />
                    <Route path="/tendering/contracts/:id" element={<ContractDetail />} />

                    {/* 发票管理 */}
                    <Route path="/tendering/invoices" element={<TenderInvoiceList />} />
                    <Route path="/tendering/invoices/new" element={<TenderInvoiceForm />} />
                    <Route path="/tendering/invoices/edit/:id" element={<TenderInvoiceForm />} />
                    <Route path="/tendering/invoices/:id" element={<TenderInvoiceDetail />} />
                    <Route path="/tendering/invoices/statistics" element={<TenderInvoiceList />} />
                    <Route path="/tendering/assets/:assetId/invoice" element={<AssetInvoiceForm />} />

                    {/* 付款管理 */}
                    <Route path="/tendering/payments" element={<TenderPaymentList />} />
                    <Route path="/tendering/payments/new" element={<TenderPaymentForm />} />
                    <Route path="/tendering/payments/edit/:id" element={<TenderPaymentForm />} />
                    <Route path="/tendering/payments/:id" element={<TenderPaymentDetail />} />

                    {/* 验收管理 */}
                    <Route path="/tendering/acceptances" element={<TenderAcceptanceList />} />
                    <Route path="/tendering/acceptances/new" element={<TenderAcceptanceForm />} />
                    <Route path="/tendering/acceptances/edit/:id" element={<TenderAcceptanceForm />} />
                    <Route path="/tendering/acceptances/:id" element={<TenderAcceptanceDetail />} />

                    {/* 审计日志 */}
                    <Route path="/tendering/audits" element={<TenderAuditList />} />

                    {/* 审批引擎 */}
                    <Route path="/tendering/approvals" element={<TenderApprovalTodo />} />
                    <Route path="/tendering/approvals/flows" element={<TenderApprovalFlows />} />
                    <Route path="/tendering/approvals/ai" element={<TenderApprovalAICenter />} />

                    {/* 个人中心 / 修改密码 / 偏好设置（用户下拉菜单入口） */}
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/change-password" element={<ChangePassword />} />
                    <Route path="/preferences" element={<Preferences />} />

                    {/* 旧「采购管理」路由全部重定向到新采购与招标统一菜单 */}
                    <Route path="/procurement/*" element={<Navigate to="/tendering/requests" replace />} />
                    <Route path="/procurement" element={<Navigate to="/tendering/requests" replace />} />
                    </Routes>
                  </AppLayout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </Suspense>
      </Router>
    </DepartmentProvider>
  );
}

export default App;
