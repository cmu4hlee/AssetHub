/**
 * 模块上下文
 * 管理模块配置和状态
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { message } from 'antd';
import { buildApiUrl } from '../api/client';
import auth from '../utils/auth';

interface ModuleFeature {
  id: string;
  name: string;
  enabled: boolean;
  description?: string;
}

interface Module {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  features: ModuleFeature[];
}

interface ModuleContextType {
  modules: Module[];
  loading: boolean;
  refreshModules: () => Promise<void>;
  isModuleEnabled: (moduleId: string) => boolean;
  isFeatureEnabled: (moduleId: string, featureId: string) => boolean;
  getModuleConfig: (moduleId: string) => any;
}

const ModuleContext = createContext<ModuleContextType | null>(null);

export const ModuleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchModules = useCallback(async () => {
    try {
      const token = auth.getToken();
      const tenantId = auth.getEffectiveTenantId();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (tenantId) headers['X-Tenant-ID'] = String(tenantId);
      const response = await fetch(buildApiUrl('/system/modules'), { headers });
      const result = await response.json();
      if (result.success) {
        setModules(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch modules:', error);
      message.error('加载模块配置失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

  const isModuleEnabled = useCallback((moduleId: string) => {
    const module = modules.find(m => m.id === moduleId);
    return module?.enabled ?? false;
  }, [modules]);

  const isFeatureEnabled = useCallback((moduleId: string, featureId: string) => {
    const module = modules.find(m => m.id === moduleId);
    if (!module?.enabled) return false;
    const feature = module.features?.find(f => f.id === featureId);
    return feature?.enabled ?? false;
  }, [modules]);

  const getModuleConfig = useCallback((moduleId: string) => {
    return modules.find(m => m.id === moduleId);
  }, [modules]);

  return (
    <ModuleContext.Provider
      value={{
        modules,
        loading,
        refreshModules: fetchModules,
        isModuleEnabled,
        isFeatureEnabled,
        getModuleConfig
      }}
    >
      {children}
    </ModuleContext.Provider>
  );
};

export const useModule = () => {
  const context = useContext(ModuleContext);
  if (!context) {
    throw new Error('useModule must be used within ModuleProvider');
  }
  return context;
};

export default ModuleContext;
