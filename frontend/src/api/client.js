import axios from 'axios';
import { message } from 'antd';
import auth from '../utils/auth';
import crypto from '../utils/crypto';

const API_BASE_URL = '/api';
const AI_ASSISTANT_TIMEOUT_MS = 10 * 60 * 1000;
const AI_ASSISTANT_ENDPOINT_PREFIXES = [
  '/ai/chat/completions',
  '/maintenance/ai',
  '/asset-ai-analysis',
  '/technical-documents/ai',
];

const REQUEST_BATCH_CONFIG = {
  delay: 100,
  batchableEndpoints: ['/assets/departments/list', '/tenants', '/roles-permissions/user/menus', '/iot/devices'],
};

const REQUEST_RETRY_CONFIG = {
  maxRetries: 3,
  retryDelay: 1000,
  retryableStatusCodes: [429, 500, 502, 503, 504],
};

const requestQueue = new Map();

// 幂等性密钥种子：每个标签页使用独立的 seed，避免多标签页冲突
// 使用 sessionStorage 实现标签页隔离（标签页关闭后 seed 丢失）
const getIdempotencyKeySeed = () => {
  if (typeof window === 'undefined') {
    return `srv-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
  let seed = sessionStorage.getItem('api_idem_seed');
  if (!seed) {
    seed = `web-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem('api_idem_seed', seed);
  }
  return seed;
};

// 序列号持久化到 sessionStorage，避免页面刷新后序列号从 0 开始，
// 导致刷新前后第一个 POST 请求的 Idempotency-Key 完全相同，
// 触发后端 IDEMPOTENCY_KEY_CONFLICT（409 Conflict）。
const getIdempotencySequence = () => {
  if (typeof window === 'undefined') return 0;
  const stored = sessionStorage.getItem('api_idem_sequence');
  const parsed = Number.parseInt(stored || '0', 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

const setIdempotencySequence = value => {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem('api_idem_sequence', String(value));
  } catch {
    // 忽略存储错误（隐私模式等场景），使用模块级变量作为兜底
  }
};

let idempotencySequence = getIdempotencySequence();

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const buildApiUrl = url => {
  if (typeof url !== 'string' || url.length === 0) {
    return API_BASE_URL;
  }

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  return `${API_BASE_URL}${url.startsWith('/') ? url : `/${url}`}`;
};

const normalizeRequestPath = url => {
  if (typeof url !== 'string') {
    return '';
  }
  return url.startsWith('/') ? url : `/${url}`;
};

export const isCacheableRequest = config => {
  const method = String(config?.method || 'GET').toLowerCase();
  if (method !== 'get') {
    return false;
  }

  const normalizedPath = normalizeRequestPath(config?.url).toLowerCase();
  return REQUEST_BATCH_CONFIG.batchableEndpoints.some(endpoint =>
    normalizedPath.startsWith(endpoint.toLowerCase())
  );
};

const isAIAssistantRequest = url => {
  const normalizedPath = normalizeRequestPath(url).toLowerCase();
  return AI_ASSISTANT_ENDPOINT_PREFIXES.some(prefix => normalizedPath.startsWith(prefix));
};

const ensureIdempotencyKey = config => {
  const method = String(config?.method || 'get').toLowerCase();
  if (!['post', 'put', 'patch', 'delete'].includes(method)) {
    return;
  }

  config.headers = config.headers || {};
  if (config.headers['Idempotency-Key'] || config.headers['idempotency-key']) {
    return;
  }

  idempotencySequence += 1;
  setIdempotencySequence(idempotencySequence);
  // 在 key 中加入 Date.now() + 随机数，防止 HMR 模块重载或序列号重置后复用旧 key
  const nonce = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  config.headers['Idempotency-Key'] = `${getIdempotencyKeySeed()}-${idempotencySequence}-${nonce}`;
};

// 强制清除 config 中的 Idempotency-Key（兼容 axios v1 AxiosHeaders 实例和普通对象）
const forceDeleteHeader = (config, ...names) => {
  if (!config.headers) return;
  for (const name of names) {
    // axios v1 AxiosHeaders 实例有 delete 方法
    if (typeof config.headers.delete === 'function') {
      config.headers.delete(name);
    }
    // 同时用 delete 操作符兜底（普通对象）
    try { delete config.headers[name]; } catch { /* ignore */ }
    try { delete config.headers[name.toLowerCase()]; } catch { /* ignore */ }
  }
};

// ==================== Token 主动续期 ====================
// 后端 /api/users/refresh-token 要求当前 token 仍有效，因此在过期前主动续期，
// 避免使用过程中 token 过期导致 401 跳转登录页。

let tokenRefreshTimer = null;
const TOKEN_REFRESH_LEAD_MS = 5 * 60 * 1000; // 提前 5 分钟刷新

const decodeTokenExpiry = token => {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    // JWT payload 使用 base64url 编码，需转换为标准 base64 供 atob 解码
    let payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (payloadBase64.length % 4) {
      payloadBase64 += '=';
    }
    const payload = JSON.parse(atob(payloadBase64));
    return payload?.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
};

export const refreshToken = async () => {
  const token = auth.getToken();
  if (!token) return false;
  try {
    const response = await api.post('/users/refresh-token');
    if (response?.success && response?.data?.token) {
      await crypto.setItemAsync('token', response.data.token);
      return true;
    }
    return false;
  } catch (error) {
    console.warn('Token 刷新失败:', error?.response?.status);
    return false;
  }
};

export const scheduleTokenRefresh = (tokenArg) => {
  if (tokenRefreshTimer) {
    clearTimeout(tokenRefreshTimer);
    tokenRefreshTimer = null;
  }
  const token = typeof tokenArg === 'string' ? tokenArg : auth.getToken();
  if (!token) return;
  const expiryMs = decodeTokenExpiry(token);
  if (!expiryMs) return;
  const refreshDelay = expiryMs - Date.now() - TOKEN_REFRESH_LEAD_MS;
  if (refreshDelay <= 0) {
    // 已接近过期，立即尝试刷新
    refreshToken().then(success => {
      if (success) scheduleTokenRefresh();
    });
    return;
  }
  tokenRefreshTimer = setTimeout(() => {
    refreshToken()
      .then(success => {
        if (success) scheduleTokenRefresh();
      })
      .catch(() => {});
  }, refreshDelay);
};

export const getApiErrorMessage = (error, fallbackMessage = '请求失败') => {
  const backendMessage =
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.response?.data?.details;

  if (backendMessage) {
    if (typeof backendMessage === 'string' && backendMessage.includes(';')) {
      const messages = backendMessage.split(';').map(m => m.trim()).filter(Boolean);
      if (messages.length > 0) {
        return messages.join('\n');
      }
    }
    return backendMessage;
  }

  if (error?.response?.status) {
    const statusMessages = {
      400: '请求参数错误',
      401: '登录已过期，请重新登录',
      403: '没有访问权限',
      404: '请求的资源不存在',
      500: '服务器内部错误',
      502: '网关错误',
      503: '服务暂时不可用',
      504: '网关超时',
    };
    const statusMessage = statusMessages[error.response.status];
    if (statusMessage) {
      return statusMessage;
    }
  }

  if (error?.code === 'ECONNABORTED') {
    return '请求超时，请检查网络连接';
  }

  if (!navigator.onLine) {
    return '网络连接已断开，请检查网络';
  }

  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message;
  }

  return fallbackMessage;
};

export const normalizeApiMessage = (payload, fallbackMessage = '') => {
  if (typeof payload === 'string' && payload.trim()) {
    return payload.trim();
  }

  const messageText =
    payload?.messageText || payload?.message || payload?.error || payload?.details || '';
  if (typeof messageText === 'string' && messageText.trim()) {
    return messageText.trim();
  }

  return fallbackMessage;
};

const MAX_STATS_URLS = 50;

const performanceStats = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  totalDuration: 0,
  averageDuration: 0,
  slowRequests: 0,
  errorRate: 0,
  requestStats: new Map(),
};

const recordPerformanceStats = (config, duration, success) => {
  const url = config.url;

  performanceStats.totalRequests++;
  if (success) {
    performanceStats.successfulRequests++;
  } else {
    performanceStats.failedRequests++;
  }
  performanceStats.totalDuration += duration;

  performanceStats.averageDuration = performanceStats.totalDuration / performanceStats.totalRequests;
  performanceStats.errorRate = performanceStats.failedRequests / performanceStats.totalRequests;

  if (duration > 1000) {
    performanceStats.slowRequests++;
  }

  if (!performanceStats.requestStats.has(url)) {
    // LRU 清理：当 URL 统计超过上限时，删除最早的条目
    if (performanceStats.requestStats.size >= MAX_STATS_URLS) {
      const firstKey = performanceStats.requestStats.keys().next().value;
      performanceStats.requestStats.delete(firstKey);
    }
    performanceStats.requestStats.set(url, {
      url,
      count: 0,
      successful: 0,
      failed: 0,
      totalDuration: 0,
      averageDuration: 0,
      slowRequests: 0,
    });
  }

  const urlStats = performanceStats.requestStats.get(url);
  urlStats.count++;
  if (success) {
    urlStats.successful++;
  } else {
    urlStats.failed++;
  }
  urlStats.totalDuration += duration;
  urlStats.averageDuration = urlStats.totalDuration / urlStats.count;
  if (duration > 1000) {
    urlStats.slowRequests++;
  }

  if (
    (performanceStats.totalRequests % 10 === 0 || duration > 1000) &&
    import.meta.env.MODE === 'development'
  ) {
    console.log('=== API 性能监控报告 ===');
    console.log(`总请求数: ${performanceStats.totalRequests}`);
    console.log(`成功请求: ${performanceStats.successfulRequests}`);
    console.log(`失败请求: ${performanceStats.failedRequests}`);
    console.log(`平均响应时间: ${performanceStats.averageDuration.toFixed(2)}ms`);
    console.log(`错误率: ${(performanceStats.errorRate * 100).toFixed(2)}%`);
    console.log(`慢请求数: ${performanceStats.slowRequests}`);
    console.log('\n按URL统计:');
    performanceStats.requestStats.forEach(stats => {
      console.log(`  ${stats.url}:`);
      console.log(`    次数: ${stats.count}, 成功: ${stats.successful}, 失败: ${stats.failed}`);
      console.log(
        `    平均响应时间: ${stats.averageDuration.toFixed(2)}ms, 慢请求: ${stats.slowRequests}`
      );
    });
    console.log('=========================');
  }
};

api.interceptors.request.use(
  config => {
    if (isAIAssistantRequest(config.url)) {
      const currentTimeout =
        typeof config.timeout === 'number' && Number.isFinite(config.timeout) ? config.timeout : 0;
      config.timeout = Math.max(currentTimeout, AI_ASSISTANT_TIMEOUT_MS);
    }

    // [DEBUG] Log FormData requests
    if (config.data instanceof FormData) {
      // 关键修复：data 是 FormData 时，删除默认的 Content-Type，
      // 让浏览器自动加上 `multipart/form-data; boundary=...`
      // 否则后端 multer 解析不到 file，会返回 400 "请选择要上传的图片"
      if (config.headers && typeof config.headers.delete === 'function') {
        config.headers.delete('Content-Type');
        config.headers.delete('content-type');
      } else if (config.headers) {
        delete config.headers['Content-Type'];
        delete config.headers['content-type'];
      }
      // 不要设置超时 - 文件上传可能很久
      if (!config.timeout || config.timeout < 60000) {
        config.timeout = 60000;
      }
      // 调试用 console.log — 生产环境可移除
      if (process.env.NODE_ENV !== 'production') {
        console.log('[axios FormData fix]', { url: config.url, entries: Array.from(config.data.entries()).map(([k, v]) => `${k}: ${v && v.name ? 'FILE:' + v.name : typeof v}`).join('|') });
      }
    }

    const token = auth.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    ensureIdempotencyKey(config);

    let tenantId = null;
    let user = null;
    let selectedEnterprise = null;

    user = auth.getUser();
    selectedEnterprise = auth.getSelectedEnterprise();
    const enterprises = crypto.getItem('enterprises');
    const entList = Array.isArray(enterprises) ? enterprises : [];
    const accessibleIds = entList.map(e => Number(e.id)).filter(Boolean);

    if (user?.role === 'super_admin') {
      // 超级管理员：用选中的企业，或回退第一个
      if (selectedEnterprise?.id) {
        tenantId = selectedEnterprise.id;
      } else if (entList.length > 0 && entList[0]?.id) {
        tenantId = entList[0].id;
        crypto.setItem('selectedEnterprise', entList[0]);
      }
    } else {
      // 普通用户：若选中的企业在本人可访问企业列表内，则用它（支持多租户切换）
      if (selectedEnterprise?.id && accessibleIds.includes(Number(selectedEnterprise.id))) {
        tenantId = selectedEnterprise.id;
      } else if (user?.tenant_id) {
        tenantId = user.tenant_id;
        // 残留的 selectedEnterprise 不在可访问列表则清除
        if (selectedEnterprise?.id && Number(selectedEnterprise.id) !== Number(user.tenant_id)) {
          localStorage.removeItem('selectedEnterprise');
        }
      } else if (selectedEnterprise?.id) {
        tenantId = selectedEnterprise.id;
      }
    }

    const parsedTenantId = Number(tenantId);
    if (Number.isInteger(parsedTenantId) && parsedTenantId > 0) {
      config.headers['X-Tenant-ID'] = parsedTenantId;
    }

    config.startTime = Date.now();

    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  response => {
    const duration = Date.now() - response.config.startTime;

    recordPerformanceStats(response.config, duration, true);

    if (response.config.responseType === 'blob') {
      return response;
    }

    // 登录/刷新成功后调度主动续期（直接传入响应中的新 token，避免存储时序问题）
    const reqUrl = normalizeRequestPath(response.config.url).toLowerCase();
    if (
      (reqUrl.includes('/users/login') || reqUrl.includes('/users/refresh-token')) &&
      response.data?.data?.token
    ) {
      scheduleTokenRefresh(response.data.data.token);
    }

    return response.data;
  },
  async error => {
    if (error.config && error.config.startTime) {
      const duration = Date.now() - error.config.startTime;
      recordPerformanceStats(error.config, duration, false);
    }

    const payload = error?.response?.data || {};
    const originalRequest = error?.config;

    if (payload?.code === 'IDEMPOTENCY_KEY_REQUIRED' && originalRequest && !originalRequest.__idempotencyRetried) {
      originalRequest.__idempotencyRetried = true;
      ensureIdempotencyKey(originalRequest);
      return api.request(originalRequest);
    }

    if (
      originalRequest &&
      !originalRequest.__riskConfirmed &&
      payload?.requiresConfirmation &&
      payload?.confirmToken
    ) {
      originalRequest.__riskConfirmed = true;
      originalRequest.headers = originalRequest.headers || {};
      originalRequest.headers[payload.confirmTokenHeader || 'X-Risk-Confirm-Token'] = payload.confirmToken;
      ensureIdempotencyKey(originalRequest);
      return api.request(originalRequest);
    }

    // 处理 Idempotency-Key 冲突（409 IDEMPOTENCY_KEY_CONFLICT）：
    // 通常是因为刷新页面后序列号从 0 重新开始，导致与上一次相同 key 但不同 body。
    // 自动重新生成新的 Idempotency-Key 重试一次：
    //  - 如果是普通写操作，直接用新 key 重试
    //  - 如果是高风险操作已带 X-Risk-Confirm-Token（标志位 __riskConfirmed=true），
    //    同时清除 confirmToken 头，让后端重新生成新的 confirmToken
    if (
      originalRequest &&
      !originalRequest.__idempotencyConflictRetried &&
      payload?.code === 'IDEMPOTENCY_KEY_CONFLICT'
    ) {
      originalRequest.__idempotencyConflictRetried = true;
      originalRequest.headers = originalRequest.headers || {};
      // 使用 forceDeleteHeader 确保兼容 axios v1 AxiosHeaders 实例
      forceDeleteHeader(originalRequest, 'Idempotency-Key', 'X-Risk-Confirm-Token');
      originalRequest.__riskConfirmed = false;
      ensureIdempotencyKey(originalRequest);
      return api.request(originalRequest);
    }

    const reqUrl = (error.config?.baseURL || '') + (error.config?.url || '');
    console.error(
      'API Error:',
      error.message,
      '| URL:',
      reqUrl,
      '| Status:',
      error.response?.status,
      '| Data:',
      error.response?.data
    );

    if (error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED') {
      const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
      const errorDetails = {
        code: error.code,
        message: error.message,
        url: error.config?.url,
        baseURL: error.config?.baseURL,
        fullURL: error.config?.baseURL + error.config?.url,
      };

      console.error('网络连接错误:', errorDetails);
      const backendUrl = import.meta.env.VITE_BACKEND_URL || currentOrigin;

      console.error('诊断信息:', {
        后端服务地址: backendUrl,
        前端代理配置: '/api -> 后端服务',
        建议检查: [
          `1. 后端服务是否可达: ${currentOrigin}/api/health`,
          '2. 前端开发服务器是否运行: npm run dev',
          '3. 浏览器控制台 Network 标签查看请求详情',
        ],
      });

      message.error({
        content: `网络连接失败\n\n错误代码: ${error.code}\n请求URL: ${errorDetails.fullURL || errorDetails.url}\n\n请检查：\n1. ${currentOrigin}/api/health 是否可访问\n2. 前端开发服务器是否正常运行\n3. 查看浏览器 Network 标签获取详细信息`,
        duration: 10,
      });
    } else if (error.response) {
      const status = error.response.status;

      // 调用方已自行处理过错误（如 catch 里 message.error(getApiErrorMessage(error))），
      // 通过 config.__suppressErrorToast = true 抑制 interceptor 重复 toast。
      const suppressToast = Boolean(error.config?.__suppressErrorToast);

      if (status === 401) {
        crypto.removeItem('token');
        crypto.removeItem('user');
        auth.clearOpenClawCredentials();
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        console.warn('认证失败，请重新登录');
      } else if (status === 403) {
        if (!suppressToast) {
          const msg =
            error.response?.data?.message ||
            error.response?.data?.error ||
            '没有访问权限';
          message.error({ content: msg, duration: 5 });
        }
      } else if (status === 400) {
        // 400 是最常见的业务校验错误（资产编号已存在、参数缺失、必填项不通过等），
        // 之前 interceptor 完全没分支，导致用户看不到任何提示，
        // 误以为"没反应"。现在显式弹后端 message。
        if (!suppressToast) {
          const backendMessage =
            error.response?.data?.message || error.response?.data?.error;
          if (backendMessage) {
            message.error({ content: backendMessage, duration: 5 });
          } else {
            console.warn('400 错误但后端未返回 message:', error.response?.data);
          }
        }
      } else if (status === 404) {
        console.error('API接口不存在:', error.config?.url);
        if (!suppressToast) {
          // 404 资源不存在往往也是业务场景（如 asset_code 查不到），让用户看到
          const msg =
            error.response?.data?.message || error.response?.data?.error || '请求的资源不存在';
          message.warning({ content: msg, duration: 4 });
        }
      } else if (status === 409) {
        // 409 业务冲突（如 Idempotency-Key 冲突、版本冲突等），显示后端 message
        if (!suppressToast) {
          const msg =
            error.response?.data?.message || error.response?.data?.error || '操作冲突，请重试';
          message.warning({ content: msg, duration: 5 });
        }
      } else if (status >= 500) {
        const url = (error.config?.baseURL || '') + (error.config?.url || '');
        const errMsg =
          error.response?.data?.message ||
          error.response?.data?.error ||
          (typeof error.response?.data === 'string'
            ? error.response.data
            : JSON.stringify(error.response?.data));
        console.error('服务器内部错误 URL:', url, 'Message:', errMsg);
        if (!suppressToast) {
          message.error({
            content: `服务器错误 (${status}): ${url}\n${errMsg || ''}`,
            duration: 8,
          });
        }
      }
    } else if (error.request) {
      console.error('请求超时或服务器无响应:', {
        url: error.config?.url,
        timeout: error.config?.timeout,
      });

      message.error({
        content: '服务器无响应，请检查后端服务是否运行',
        duration: 5,
      });
    }

    return Promise.reject(error);
  }
);

if (typeof window !== 'undefined') {
  window.apiPerformanceStats = performanceStats;
}

const MAX_QUEUE_SIZE = 100;

const requestWithBatchingAndRetry = async (config, retryCount = 0) => {
  const { url, method, params, data } = config;

  const requestKey = `${method}:${url}:${JSON.stringify(params || {})}:${JSON.stringify(data || {})}`;

  if (requestQueue.has(requestKey)) {
    return requestQueue.get(requestKey);
  }

  // LRU 清理：当队列大小超过上限时，删除最早的条目
  if (requestQueue.size >= MAX_QUEUE_SIZE) {
    const firstKey = requestQueue.keys().next().value;
    requestQueue.delete(firstKey);
  }

  const isBatchable = isCacheableRequest({ method, url });

  const requestPromise = new Promise((resolve, reject) => {
    const executeRequest = async () => {
      try {
        const response = await api(config);
        resolve(response);
      } catch (error) {
        if (
          retryCount < REQUEST_RETRY_CONFIG.maxRetries &&
          error.response &&
          REQUEST_RETRY_CONFIG.retryableStatusCodes.includes(error.response.status)
        ) {
          const delay = REQUEST_RETRY_CONFIG.retryDelay * Math.pow(2, retryCount);
          console.log(
            `请求失败，${delay}ms后重试 (${retryCount + 1}/${REQUEST_RETRY_CONFIG.maxRetries})`,
            error.config.url
          );

          setTimeout(async () => {
            try {
              const retryResponse = await requestWithBatchingAndRetry(config, retryCount + 1);
              resolve(retryResponse);
            } catch (retryError) {
              reject(retryError);
            }
          }, delay);
        } else {
          reject(error);
        }
      } finally {
        requestQueue.delete(requestKey);
      }
    };

    if (isBatchable) {
      setTimeout(executeRequest, REQUEST_BATCH_CONFIG.delay);
    } else {
      executeRequest();
    }
  });

  requestQueue.set(requestKey, requestPromise);

  return requestPromise;
};

export const apiWithBatching = {
  get: (url, config = {}) => requestWithBatchingAndRetry({ ...config, url, method: 'GET' }),
  post: (url, data, config = {}) =>
    requestWithBatchingAndRetry({ ...config, url, method: 'POST', data }),
  put: (url, data, config = {}) => requestWithBatchingAndRetry({ ...config, url, method: 'PUT', data }),
  delete: (url, config = {}) => requestWithBatchingAndRetry({ ...config, url, method: 'DELETE' }),
};

export const getApiPerformanceStats = () => performanceStats;

const SMART_BATCHABLE_ENDPOINTS = [
  '/assets/departments/list',
  '/tenants',
  '/roles-permissions/user/menus',
  '/iot/devices',
  '/departments',
];

const isSmartBatchable = (url, method) => {
  if (method !== 'GET') return false;
  const normalizedPath = normalizeRequestPath(url).toLowerCase();
  return SMART_BATCHABLE_ENDPOINTS.some(endpoint =>
    normalizedPath.includes(endpoint.toLowerCase())
  );
};

export const smartApi = {
  get: (url, config = {}) => {
    if (isSmartBatchable(url, 'GET')) {
      return requestWithBatchingAndRetry({ ...config, url, method: 'GET' });
    }
    return api.get(url, config);
  },
  post: (url, data, config = {}) => api.post(url, data, config),
  put: (url, data, config = {}) => api.put(url, data, config),
  delete: (url, config = {}) => api.delete(url, config),
};

export default api;
