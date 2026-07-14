/**
 * 全局应用状态管理
 * 统一管理全局 Loading、错误提示、通知等状态
 */

import React, { createContext, useContext, useReducer, useCallback, useRef, useEffect } from 'react';
import { Spin, message, notification } from 'antd';

// Context
const AppStateContext = createContext(null);

// 初始状态
const initialState = {
  // 全局 Loading
  globalLoading: false,
  globalLoadingText: '加载中...',
  
  // 网络状态
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  lastOnlineTime: null,
  
  // 后端连接状态
  backendConnected: true,
  backendHealthChecking: false,
  
  // 通知队列
  notifications: [],
};

// Action Types
const ActionTypes = {
  SET_GLOBAL_LOADING: 'SET_GLOBAL_LOADING',
  SET_NETWORK_STATUS: 'SET_NETWORK_STATUS',
  SET_BACKEND_STATUS: 'SET_BACKEND_STATUS',
  ADD_NOTIFICATION: 'ADD_NOTIFICATION',
  REMOVE_NOTIFICATION: 'REMOVE_NOTIFICATION',
  CLEAR_ALL_NOTIFICATIONS: 'CLEAR_ALL_NOTIFICATIONS',
};

// Reducer
function appStateReducer(state, action) {
  switch (action.type) {
    case ActionTypes.SET_GLOBAL_LOADING:
      return {
        ...state,
        globalLoading: action.payload.loading,
        globalLoadingText: action.payload.text || '加载中...',
      };
    case ActionTypes.SET_NETWORK_STATUS:
      return {
        ...state,
        isOnline: action.payload.isOnline,
        lastOnlineTime: action.payload.isOnline ? new Date().toISOString() : state.lastOnlineTime,
      };
    case ActionTypes.SET_BACKEND_STATUS:
      return {
        ...state,
        backendConnected: action.payload.connected,
        backendHealthChecking: action.payload.checking || false,
      };
    case ActionTypes.ADD_NOTIFICATION:
      return {
        ...state,
        notifications: [...state.notifications, action.payload],
      };
    case ActionTypes.REMOVE_NOTIFICATION:
      return {
        ...state,
        notifications: state.notifications.filter(n => n.id !== action.payload),
      };
    case ActionTypes.CLEAR_ALL_NOTIFICATIONS:
      return {
        ...state,
        notifications: [],
      };
    default:
      return state;
  }
}

// Provider Component
export const AppStateProvider = ({ children }) => {
  const [state, dispatch] = useReducer(appStateReducer, initialState);
  const loadingCountRef = useRef(0);
  const backendCheckIntervalRef = useRef(null);
  const backendConnectedRef = useRef(initialState.backendConnected);
  const backendHealthCheckingRef = useRef(false);

  // 设置全局 Loading
  const setGlobalLoading = useCallback((loading, text = '加载中...') => {
    dispatch({
      type: ActionTypes.SET_GLOBAL_LOADING,
      payload: { loading, text },
    });
  }, []);

  // 增加 Loading 计数（支持并发请求）
  const incrementLoading = useCallback((text = '加载中...') => {
    loadingCountRef.current += 1;
    if (loadingCountRef.current === 1) {
      setGlobalLoading(true, text);
    }
  }, [setGlobalLoading]);

  // 减少 Loading 计数
  const decrementLoading = useCallback(() => {
    loadingCountRef.current = Math.max(0, loadingCountRef.current - 1);
    if (loadingCountRef.current === 0) {
      setGlobalLoading(false);
    }
  }, [setGlobalLoading]);

  // 网络状态监听
  useEffect(() => {
    const handleOnline = () => {
      dispatch({
        type: ActionTypes.SET_NETWORK_STATUS,
        payload: { isOnline: true },
      });
      message.success('网络已恢复');
    };

    const handleOffline = () => {
      dispatch({
        type: ActionTypes.SET_NETWORK_STATUS,
        payload: { isOnline: false },
      });
      message.error('网络已断开，请检查网络连接');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 后端健康检查
  const checkBackendHealth = useCallback(async () => {
    if (backendHealthCheckingRef.current) return;

    backendHealthCheckingRef.current = true;
    dispatch({
      type: ActionTypes.SET_BACKEND_STATUS,
      payload: { connected: backendConnectedRef.current, checking: true },
    });

    try {
      const response = await fetch('/api/health', {
        method: 'GET',
        cache: 'no-cache',
        signal: AbortSignal.timeout(5000),
      });
      
      const isConnected = response.ok;
      const wasConnected = backendConnectedRef.current;

      if (!wasConnected && isConnected) {
        message.success('服务器连接已恢复');
      } else if (wasConnected && !isConnected) {
        message.error('无法连接到服务器');
      }

      backendConnectedRef.current = isConnected;
      dispatch({
        type: ActionTypes.SET_BACKEND_STATUS,
        payload: { connected: isConnected, checking: false },
      });
    } catch (_error) {
      const wasConnected = backendConnectedRef.current;
      if (wasConnected) {
        message.error('无法连接到服务器');
      }
      backendConnectedRef.current = false;
      dispatch({
        type: ActionTypes.SET_BACKEND_STATUS,
        payload: { connected: false, checking: false },
      });
    } finally {
      backendHealthCheckingRef.current = false;
    }
  }, []);

  // 定时健康检查
  useEffect(() => {
    backendCheckIntervalRef.current = setInterval(() => {
      void checkBackendHealth();
    }, 30000);

    // 页面可见时立即检查
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void checkBackendHealth();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 初始检查
    void checkBackendHealth();

    return () => {
      clearInterval(backendCheckIntervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkBackendHealth]);

  // 全局通知
  const showNotification = useCallback((config) => {
    const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
    
    dispatch({
      type: ActionTypes.ADD_NOTIFICATION,
      payload: { id, ...config },
    });
    
    notification[config.type || 'info']({
      ...config,
      key: id,
      onClose: () => {
        dispatch({
          type: ActionTypes.REMOVE_NOTIFICATION,
          payload: id,
        });
      },
    });
    
    return id;
  }, []);

  const value = {
    state,
    setGlobalLoading,
    incrementLoading,
    decrementLoading,
    checkBackendHealth,
    showNotification,
  };

  return (
    <AppStateContext.Provider value={value}>
      {children}
      {/* 全局 Loading 遮罩 */}
      {state.globalLoading && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(255, 255, 255, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            backdropFilter: 'blur(2px)',
          }}
        >
          <Spin size="large" description={state.globalLoadingText} />
        </div>
      )}
      {/* 离线提示 */}
      {!state.isOnline && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            padding: '8px 16px',
            background: '#ff4d4f',
            color: '#fff',
            textAlign: 'center',
            zIndex: 10000,
            fontSize: 14,
          }}
        >
          ⚠️ 网络已断开，请检查网络连接
        </div>
      )}
      {/* 后端断开提示 */}
      {state.isOnline && !state.backendConnected && (
        <div
          style={{
            position: 'fixed',
            top: state.isOnline ? 0 : 36,
            left: 0,
            right: 0,
            padding: '8px 16px',
            background: '#faad14',
            color: '#fff',
            textAlign: 'center',
            zIndex: 9999,
            fontSize: 14,
            cursor: 'pointer',
          }}
          onClick={checkBackendHealth}
        >
          ⚠️ 无法连接到服务器，点击重试
        </div>
      )}
    </AppStateContext.Provider>
  );
};

// Hook
// eslint-disable-next-line react-refresh/only-export-components
export const useAppState = () => {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within AppStateProvider');
  }
  return context;
};

// Hook: 使用 Loading 包装异步函数
// eslint-disable-next-line react-refresh/only-export-components
export const useLoading = () => {
  const { incrementLoading, decrementLoading } = useAppState();
  
  return useCallback(async (asyncFunction, text = '加载中...') => {
    incrementLoading(text);
    try {
      const result = await asyncFunction();
      return result;
    } finally {
      decrementLoading();
    }
  }, [incrementLoading, decrementLoading]);
};

export default AppStateContext;
