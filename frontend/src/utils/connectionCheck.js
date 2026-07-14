/**
 * 后端连接检测工具
 * 用于检测后端服务是否可用
 */

import axios from 'axios';

const healthApi = axios.create({
  baseURL: '/api',
  timeout: 5000,
  validateStatus: status => status < 500,
});

/**
 * 检查后端服务连接状态
 * @returns {Promise<{connected: boolean, message: string, details?: any}>}
 */
export async function checkBackendConnection() {
  try {
    const response = await healthApi.get('/health');

    if (response.status === 200 && response.data?.status === 'ok') {
      return {
        connected: true,
        message: '后端服务连接正常',
        details: response.data,
      };
    } else {
      return {
        connected: false,
        message: `后端服务异常: ${response.data?.message || '未知错误'}`,
        details: response.data,
      };
    }
  } catch (error) {
    let message = '无法连接到后端服务';

    if (error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED') {
      const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
      const backendUrl = import.meta.env.VITE_BACKEND_URL || currentOrigin;
      message = `网络连接失败，请检查：\n1. 后端服务是否运行在 ${backendUrl}\n2. 前端代理配置是否正确\n3. 防火墙是否阻止连接`;
    } else if (error.code === 'ECONNREFUSED') {
      message = '连接被拒绝，后端服务可能未运行';
    } else if (error.response) {
      message = `后端服务返回错误: ${error.response.status} ${error.response.statusText}`;
    } else if (error.request) {
      message = '请求超时，后端服务无响应';
    }

    return {
      connected: false,
      message,
      error: {
        code: error.code,
        message: error.message,
        config: error.config,
      },
    };
  }
}

/**
 * 在应用启动时检查连接
 * @param {Function} onError - 错误回调函数
 */
export async function checkConnectionOnStartup(onError) {
  const result = await checkBackendConnection();

  if (!result.connected) {
    console.error('❌ 后端服务连接失败:', result.message);
    if (onError) {
      onError(result);
    }
  } else {
    console.log('✅ 后端服务连接正常:', result.details);
  }

  return result;
}
