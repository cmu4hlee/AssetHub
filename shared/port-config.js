/**
 * 统一端口配置管理
 * 解决端口配置混乱问题
 */

const env = process.env.NODE_ENV || 'development';

const portConfig = {
  development: {
    frontend: 13579,
    backend: 5183,
    frontendUrl: 'http://localhost:13579',
    backendUrl: 'http://localhost:5183',
  },
  production: {
    frontend: 4000,
    backend: 4001,
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:4000',
    backendUrl: process.env.BACKEND_URL || 'http://localhost:4001',
  },
  test: {
    frontend: 5175,
    backend: 5176,
    frontendUrl: 'http://localhost:5175',
    backendUrl: 'http://localhost:5176',
  }
};

/**
 * 获取当前环境的端口配置
 */
function getPortConfig() {
  return portConfig[env] || portConfig.development;
}

/**
 * 获取前端端口
 */
function getFrontendPort() {
  return process.env.VITE_FRONTEND_PORT || getPortConfig().frontend;
}

/**
 * 获取后端端口
 */
function getBackendPort() {
  return process.env.PORT || getPortConfig().backend;
}

/**
 * 获取前端URL
 */
function getFrontendUrl() {
  return process.env.FRONTEND_URL || getPortConfig().frontendUrl;
}

/**
 * 获取后端URL
 */
function getBackendUrl() {
  return process.env.VITE_BACKEND_URL || process.env.BACKEND_URL || getPortConfig().backendUrl;
}

/**
 * 验证端口配置
 */
function validatePortConfig() {
  const frontendPort = getFrontendPort();
  const backendPort = getBackendPort();

  if (frontendPort === backendPort) {
    throw new Error(`前端端口(${frontendPort})和后端端口(${backendPort})不能相同`);
  }

  if (frontendPort < 1024 || frontendPort > 65535) {
    throw new Error(`前端端口${frontendPort}超出有效范围(1024-65535)`);
  }

  if (backendPort < 1024 || backendPort > 65535) {
    throw new Error(`后端端口${backendPort}超出有效范围(1024-65535)`);
  }

  console.log(`✅ 端口配置验证通过: 前端=${frontendPort}, 后端=${backendPort}`);
}

module.exports = {
  getPortConfig,
  getFrontendPort,
  getBackendPort,
  getFrontendUrl,
  getBackendUrl,
  validatePortConfig,
};
