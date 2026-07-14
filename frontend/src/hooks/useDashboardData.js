/**
 * useDashboardData - 仪表盘数据获取 hook
 * 将 Dashboard 页面的数据获取逻辑从组件中解耦
 */
import { useState, useCallback, useEffect } from 'react';
import { assetAPI, maintenanceAPI } from '../utils/api';
import api from '../api/client';

export const useDashboardData = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState(null);
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [monthlyTrend, setMonthlyTrend] = useState([]);
  const [expiringWarranties, setExpiringWarranties] = useState([]);
  const [maintenanceStats, setMaintenanceStats] = useState(null);
  const [recentAssets, setRecentAssets] = useState([]);
  const [realtime, setRealtime] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [maintenanceStatsLoading, setMaintenanceStatsLoading] = useState(false);

  const loadDashboardData = useCallback(async () => {
    setStatsLoading(true);
    try {
      const [statsRes, dashboardRes, warrantyRes, recentRes, realtimeRes] = await Promise.allSettled([
        assetAPI.getStatistics({}),
        assetAPI.getDashboardData(),
        assetAPI.getExpiringWarranties({ pageSize: 10 }),
        api.get('/assets', { params: { page: 1, pageSize: 6, sortBy: 'created_at', sortOrder: 'desc' } }),
        api.get('/dashboard/realtime'),
      ]);

      if (statsRes.status === 'fulfilled' && statsRes.value?.success) {
        const data = statsRes.value.data;
        setStats(data);
        setCategories(data.by_category || []);
        setDepartments(data.by_department || []);
        setMonthlyTrend(data.monthly_trend || []);
      }

      if (dashboardRes.status === 'fulfilled' && dashboardRes.value?.success) {
        setAlerts(dashboardRes.value.data.alerts || null);
        setRecentAssets(prev => prev.length ? prev : (dashboardRes.value.data.recent_assets || []));
      }

      if (warrantyRes.status === 'fulfilled' && warrantyRes.value?.data) {
        setExpiringWarranties(warrantyRes.value.data?.list || []);
      }

      if (recentRes.status === 'fulfilled' && recentRes.value?.success) {
        const list = recentRes.value.data?.list || recentRes.value.data?.assets || [];
        if (list.length) setRecentAssets(list);
      }

      if (realtimeRes.status === 'fulfilled' && realtimeRes.value?.success) {
        setRealtime(realtimeRes.value.data);
      }
    } catch (error) {
      console.error('加载仪表盘统计失败:', error);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadMaintenanceStats = useCallback(async () => {
    setMaintenanceStatsLoading(true);
    try {
      const result = await maintenanceAPI.getMaintenanceStatistics({});
      if (result.success) {
        setMaintenanceStats(result.data);
      }
    } catch (error) {
      console.error('加载维护统计失败:', error);
    } finally {
      setMaintenanceStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([loadDashboardData(), loadMaintenanceStats()]);
      setLoading(false);
    };
    loadAll();
  }, [loadDashboardData, loadMaintenanceStats]);

  const refresh = useCallback(async () => {
    await Promise.all([loadDashboardData(), loadMaintenanceStats()]);
  }, [loadDashboardData, loadMaintenanceStats]);

  return {
    loading,
    stats,
    alerts,
    categories,
    departments,
    monthlyTrend,
    expiringWarranties,
    maintenanceStats,
    recentAssets,
    realtime,
    statsLoading,
    maintenanceStatsLoading,
    refresh,
  };
};

export default useDashboardData;
