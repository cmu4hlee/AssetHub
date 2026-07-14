/**
 * 模块级 API 工厂
 *
 * 为每个业务模块创建独立的 axios 实例，实现错误隔离：
 * - 一个模块的 401 不会强制踢出整个会话（仅记录，由调用方决定如何处理）
 * - 一个模块的 5xx 不会全局弹窗遮罩（仅 console.error，由页面自行提示）
 * - 一个模块的网络错误不会显示全局诊断信息
 *
 * 全局 `api` 实例（client.js）仍用于认证/基础设施端点（登录、注册、token 刷新）。
 * 业务模块应使用 `createModuleApi(moduleId)` 创建独立实例。
 */

import axios from 'axios';
import auth from '../utils/auth';
import crypto from '../utils/crypto';

const API_BASE_URL = '/api';

// 各模块已创建的实例缓存
const moduleApiCache = new Map();

// 模块级错误事件总线：允许页面订阅自己模块的错误事件
const moduleErrorListeners = new Map(); // moduleId -> Set<callback>

/**
 * 订阅模块错误事件
 * @param {string} moduleId - 模块ID
 * @param {Function} callback - 错误回调 (error) => void
 * @returns {Function} 取消订阅函数
 */
export const subscribeModuleError = (moduleId, callback) => {
  if (!moduleErrorListeners.has(moduleId)) {
    moduleErrorListeners.set(moduleId, new Set());
  }
  moduleErrorListeners.get(moduleId).add(callback);
  return () => {
    const listeners = moduleErrorListeners.get(moduleId);
    if (listeners) listeners.delete(callback);
  };
};

/**
 * 派发模块错误事件
 */
const emitModuleError = (moduleId, error) => {
  const listeners = moduleErrorListeners.get(moduleId);
  if (listeners) {
    listeners.forEach(cb => {
      try { cb(error); } catch (e) { /* 忽略监听器错误 */ }
    });
  }
};

// 请求拦截器共享逻辑（与全局 api 一致，但不包含全局副作用）
const applyRequestInterceptors = (instance) => {
  instance.interceptors.request.use(
    config => {
      // 注入 token
      const token = auth.getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      // 注入租户头（与全局 api 逻辑一致）
      let tenantId = null;
      let user = null;
      let selectedEnterprise = null;

      user = auth.getUser();
      selectedEnterprise = auth.getSelectedEnterprise();

      if (user?.role === 'super_admin') {
        if (selectedEnterprise?.id) {
          tenantId = selectedEnterprise.id;
        } else {
          const enterprises = crypto.getItem('enterprises');
          if (enterprises && Array.isArray(enterprises) && enterprises.length > 0 && enterprises[0]?.id) {
            tenantId = enterprises[0].id;
            crypto.setItem('selectedEnterprise', enterprises[0]);
          }
        }
      } else if (user?.tenant_id) {
        tenantId = user.tenant_id;
        if (selectedEnterprise?.id && Number(selectedEnterprise.id) !== Number(user.tenant_id)) {
          localStorage.removeItem('selectedEnterprise');
        }
      } else if (selectedEnterprise?.id) {
        tenantId = selectedEnterprise.id;
      }

      const parsedTenantId = Number(tenantId);
      if (Number.isInteger(parsedTenantId) && parsedTenantId > 0) {
        config.headers['X-Tenant-ID'] = parsedTenantId;
      }

      config.startTime = Date.now();
      return config;
    },
    error => Promise.reject(error)
  );
};

// 响应拦截器：模块级错误隔离（无全局副作用）
const applyResponseInterceptors = (instance, moduleId) => {
  instance.interceptors.response.use(
    response => {
      if (response.config.responseType === 'blob') {
        return response;
      }
      return response.data;
    },
    error => {
      // 仅在 console 记录，不触发全局 message.error 或跳转
      const reqUrl = (error.config?.baseURL || '') + (error.config?.url || '');
      const status = error.response?.status;

      if (error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED') {
        console.error(`[${moduleId}] 网络错误:`, error.code, reqUrl);
      } else if (error.response) {
        if (status === 401) {
          // 模块级 401：不强制踢出，仅派发事件让页面自行处理
          // 全局认证端点（/api/auth/*）的 401 仍由全局 api 实例处理
          console.warn(`[${moduleId}] 认证失败（模块级，未触发全局跳转）`);
        } else if (status === 503) {
          // 模块级熔断/限流：派发事件，让页面显示友好提示
          const payload = error.response?.data || {};
          if (payload?.code === 'MODULE_POOL_EXHAUSTED' || payload?.code === 'MODULE_CIRCUIT_OPEN') {
            console.warn(`[${moduleId}] 模块过载:`, payload.message || payload.code);
          }
        } else if (status >= 500) {
          console.error(`[${moduleId}] 服务器错误 (${status}):`, reqUrl, error.response?.data?.message || '');
        }
      } else if (error.request) {
        console.error(`[${moduleId}] 无响应:`, reqUrl);
      }

      // 派发模块错误事件，让页面自行决定 UI 反馈
      emitModuleError(moduleId, error);

      return Promise.reject(error);
    }
  );
};

/**
 * 创建模块级 API 实例
 * @param {string} moduleId - 模块ID（如 'acceptance-management'）
 * @param {Object} [options] - 配置
 * @param {number} [options.timeout=15000] - 超时时间
 * @returns {import('axios').AxiosInstance} 模块级 axios 实例
 */
export const createModuleApi = (moduleId, options = {}) => {
  if (moduleApiCache.has(moduleId)) {
    return moduleApiCache.get(moduleId);
  }

  const instance = axios.create({
    baseURL: API_BASE_URL,
    timeout: options.timeout || 15000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  applyRequestInterceptors(instance);
  applyResponseInterceptors(instance, moduleId);

  moduleApiCache.set(moduleId, instance);
  return instance;
};

/**
 * 获取模块错误摘要（用于页面统一展示）
 * @param {Error} error - axios 错误对象
 * @returns {{ status: number|null, message: string, isModuleOverload: boolean }}
 */
export const getModuleErrorInfo = (error) => {
  const status = error?.response?.status || null;
  const data = error?.response?.data || {};

  // 模块过载（熔断/限流）
  if (status === 503 && (data?.code === 'MODULE_POOL_EXHAUSTED' || data?.code === 'MODULE_CIRCUIT_OPEN')) {
    return {
      status,
      message: data?.message || '该模块当前繁忙，请稍后重试',
      isModuleOverload: true,
    };
  }

  if (status === 401) {
    return { status, message: '认证已过期，请重新登录', isModuleOverload: false };
  }
  if (status === 403) {
    return { status, message: '没有访问权限', isModuleOverload: false };
  }
  if (status === 404) {
    return { status, message: '请求的资源不存在', isModuleOverload: false };
  }
  if (status && status >= 500) {
    return { status, message: data?.message || `服务器错误 (${status})`, isModuleOverload: false };
  }
  if (error?.code === 'ECONNABORTED') {
    return { status, message: '请求超时，请检查网络连接', isModuleOverload: false };
  }
  if (error?.code === 'ERR_NETWORK') {
    return { status, message: '网络连接失败', isModuleOverload: false };
  }

  return { status, message: data?.message || error?.message || '请求失败', isModuleOverload: false };
};

export default createModuleApi;
