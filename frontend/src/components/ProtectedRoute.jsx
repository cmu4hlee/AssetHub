import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { hasModuleAccess, resolveModuleByPath } from '../utils/module-access';
import { checkRouteAccess } from '../core/module-route-guard';
import { isSuperAdmin, isAdminRole } from '../utils/roleUtils';
import crypto from '../utils/crypto';

let cacheInitialized = false;
let cacheInitPromise = null;

const initCacheIfNotDone = () => {
  if (cacheInitialized) return Promise.resolve();
  if (!cacheInitPromise) {
    cacheInitPromise = crypto.initCache().then(() => {
      cacheInitialized = true;
    }).catch(() => {
      cacheInitialized = true;
    });
  }
  return cacheInitPromise;
};

const ProtectedRoute = ({ children }) => {
  const location = useLocation();
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    (async () => {
      await initCacheIfNotDone();

      // 先尝试同步读取
      let token = crypto.getItem('token');
      let user = crypto.getItem('user');

      // 同步读取失败则使用异步解密
      if (!token) {
        token = await crypto.getItemAsync('token');
      }
      if (!user) {
        user = await crypto.getItemAsync('user');
      }

      if (token && user) {
        setAuthenticated(true);
      }
      setReady(true);
    })();
  }, []);

  if (!ready) {
    return <div style={{ padding: '40px 16px', textAlign: 'center', color: '#64748b' }}>加载中...</div>;
  }

  if (!authenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  const token = crypto.getItem('token') || '';
  const user = crypto.getItem('user');
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (isSuperAdmin(user) || isAdminRole(user?.role)) {
    return children;
  }

  const enabledModules = Array.isArray(user?.enabled_modules) ? user.enabled_modules : [];

  // 使用新的模块路由守卫检查
  const routeCheck = checkRouteAccess(location.pathname, enabledModules);
  if (!routeCheck.accessible) {
    return (
      <Navigate
        to={routeCheck.redirect || '/dashboard'}
        replace
        state={{ moduleBlocked: true, reason: routeCheck.reason, from: location.pathname }}
      />
    );
  }

  // 保留原有的模块访问检查作为后备
  const requiredModuleId = resolveModuleByPath(location.pathname);
  if (requiredModuleId && enabledModules.length > 0) {
    if (!hasModuleAccess(requiredModuleId, enabledModules)) {
      return (
        <Navigate
          to="/dashboard"
          replace
          state={{ moduleBlocked: requiredModuleId, from: location.pathname }}
        />
      );
    }
  }

  return children;
};

export default ProtectedRoute;
