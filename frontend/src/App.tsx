import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ModuleProvider } from './core/ModuleContext';
import MainLayout from './layouts/MainLayout';
import Loading from './components/Loading';

// 懒加载模块页面
const ComplianceDashboard = lazy(() => import('./modules/compliance/pages/Dashboard'));
const MaintenanceLevel = lazy(() => import('./modules/compliance/pages/MaintenanceLevel'));
const SpecialEquipment = lazy(() => import('./modules/compliance/pages/SpecialEquipment'));
const SafetyInspection = lazy(() => import('./modules/compliance/pages/SafetyInspection'));

const UptimeDashboard = lazy(() => import('./modules/uptime/pages/Dashboard'));
const OperationLogs = lazy(() => import('./modules/uptime/pages/OperationLogs'));
const UptimeStatistics = lazy(() => import('./modules/uptime/pages/Statistics'));

const StaffDashboard = lazy(() => import('./modules/staff/pages/Dashboard'));
const Qualifications = lazy(() => import('./modules/staff/pages/Qualifications'));
const Training = lazy(() => import('./modules/staff/pages/Training'));
const CompetencyAssessment = lazy(() => import('./modules/staff/pages/Assessments'));

const RiskDashboard = lazy(() => import('./modules/risk/pages/Dashboard'));
const RiskAssessment = lazy(() => import('./modules/risk/pages/Assessment'));

// 原有页面
const AssetList = lazy(() => import('./pages/AssetList'));
const MaintenanceList = lazy(() => import('./pages/MaintenanceList'));
const AssetStatusDashboard = lazy(() => import('./pages/AssetStatusDashboard'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5分钟
      retry: 2
    }
  }
});

const App: React.FC = () => {
  return (
    <ConfigProvider locale={zhCN}>
      <QueryClientProvider client={queryClient}>
        <ModuleProvider>
          <BrowserRouter>
            <Suspense fallback={<Loading fullScreen />}>
              <Routes>
                <Route path="/" element={<MainLayout />}>
                  {/* 原有路由 */}
                  <Route index element={<Navigate to="/dashboard" replace />} />
                  <Route path="dashboard" element={<AssetList />} />
                  <Route path="assets" element={<AssetList />} />
                  <Route path="maintenance" element={<MaintenanceList />} />
                  
                  {/* 合规性管理模块 */}
                  <Route path="compliance" element={<ComplianceDashboard />} />
                  <Route path="compliance/maintenance-level" element={<MaintenanceLevel />} />
                  <Route path="special-equipment" element={<SpecialEquipment />} />
                  <Route path="safety-inspection" element={<SafetyInspection />} />
                  <Route path="compliance/special-equipment" element={<Navigate to="/special-equipment" replace />} />
                  <Route path="compliance/safety-inspection" element={<Navigate to="/safety-inspection" replace />} />
                  
                  {/* 开机率管理模块 */}
                  <Route path="uptime" element={<UptimeDashboard />} />
                  <Route path="uptime/operation-logs" element={<OperationLogs />} />
                  <Route path="uptime/statistics" element={<UptimeStatistics />} />
                  
                  {/* 人员资质模块 */}
                  <Route path="staff" element={<StaffDashboard />} />
                  <Route path="staff/qualifications" element={<Qualifications />} />
                  <Route path="staff/training" element={<Training />} />
                  <Route path="staff/assessment" element={<CompetencyAssessment />} />
                  
                  {/* 风险管理模块 */}
                  <Route path="risk" element={<RiskDashboard />} />
                  <Route path="risk/assessment" element={<RiskAssessment />} />
                </Route>
                {/* 全屏大屏路由 */}
                <Route path="asset-dashboard" element={<AssetStatusDashboard />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </ModuleProvider>
      </QueryClientProvider>
    </ConfigProvider>
  );
};

export default App;
