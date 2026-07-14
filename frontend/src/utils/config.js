/**
 * 应用配置管理
 * 统一管理前端和后端的URL配置
 */

// 去除字符串末尾的斜杠
const trimTrailingSlash = url => String(url || '').replace(/\/+$/, '');

// 检查是否为旧硬编码 localhost URL（开发环境），需要剥离域名保留路径
const LEGACY_LOCALHOST_PATTERNS = [
  /^https?:\/\/localhost:4000/,
  /^https?:\/\/localhost:4001/,
  /^https?:\/\/localhost:13579/,
  /^https?:\/\/localhost:5183/,
  /^https?:\/\/127\.0\.0\.1:4000/,
  /^https?:\/\/127\.0\.0\.1:4001/,
  /^https?:\/\/127\.0\.0\.1:13579/,
  /^https?:\/\/127\.0\.0\.1:5183/,
];

// 判断 URL 是否在生产环境配置中（开发环境视为 localhost，生产环境必须是真实域名）
const isLikelyLocalhostUrl = url => {
  if (!url) return false;
  return LEGACY_LOCALHOST_PATTERNS.some(re => re.test(url));
};

// 解析环境变量中以逗号分隔的列表
const parseListEnv = value =>
  String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

// 解析备用前端 host 列表
const getFrontendFallbackHosts = () =>
  parseListEnv(import.meta.env.VITE_FRONTEND_FALLBACK_HOSTS).filter(Boolean);

// 获取后端API基础URL
// 优先级：VITE_BACKEND_URL > VITE_API_BASE_URL（去掉 /api）> 当前页面 origin
export const getBackendUrl = () => {
  const envBackend = import.meta.env.VITE_BACKEND_URL;
  if (envBackend) {
    const url = trimTrailingSlash(envBackend);
    if (isLikelyLocalhostUrl(url) && import.meta.env.PROD) {
      // eslint-disable-next-line no-console
      console.warn(
        `[config] VITE_BACKEND_URL 指向了 localhost (${url})，生产环境将忽略此值，回退到当前域名。`,
      );
    } else {
      return url;
    }
  }
  if (import.meta.env.VITE_API_BASE_URL) {
    return trimTrailingSlash(import.meta.env.VITE_API_BASE_URL.replace(/\/api\/?$/, ''));
  }
  // 开发环境默认值
  if (import.meta.env.DEV) {
    return 'http://localhost:5183';
  }
  // 生产环境：使用相对路径或当前域名
  return window.location.origin;
};

// 获取前端URL（用于构造绝对链接，例如飞书回调、分享链接等）
export const getFrontendUrl = () => {
  const envFrontend = import.meta.env.VITE_FRONTEND_URL;
  if (envFrontend) {
    const url = trimTrailingSlash(envFrontend);
    if (isLikelyLocalhostUrl(url) && import.meta.env.PROD) {
      // eslint-disable-next-line no-console
      console.warn(
        `[config] VITE_FRONTEND_URL 指向了 localhost (${url})，生产环境将忽略此值，回退到当前域名。`,
      );
    } else {
      return url;
    }
  }
  // 开发环境默认值
  if (import.meta.env.DEV) {
    return 'http://localhost:13579';
  }
  // 生产环境：使用当前域名
  return window.location.origin;
};

// 获取API基础URL（用于 axios 请求 baseURL）
export const getApiBaseUrl = () => {
  // 同源部署：通过反代访问后端 API（推荐），直接用相对路径
  // 跨域部署：通过 VITE_BACKEND_URL 指定完整后端地址
  const backend = getBackendUrl();
  const isSameOrigin = !backend || backend === window.location.origin;
  if (import.meta.env.DEV) {
    return '/api';
  }
  return isSameOrigin ? '/api' : `${backend}/api`;
};

// 获取文件URL（处理相对路径和绝对路径）
// 关键修复：剥离旧的 localhost URL 中的域名，避免生产环境出现 localhost 链接
export const getFileUrl = filePath => {
  if (!filePath) return '';

  // 如果已经是完整的URL，判断是否需要剥离为相对路径
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    // 剥离旧的开发环境 localhost 硬编码域名，避免生产环境出现 localhost 链接
    if (isLikelyLocalhostUrl(filePath)) {
      return filePath.replace(/^https?:\/\/[^/]+/, '');
    }
    // 检查是否是其他不可达的本地域名（开发环境遗留）
    try {
      const parsed = new URL(filePath);
      if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
        // 生产环境下，剥离本地域名为相对路径（反代会处理）
        return parsed.pathname + parsed.search + parsed.hash;
      }
    } catch (_e) { /* ignore */ }
    return filePath;
  }

  // 相对路径，直接返回（浏览器会自动使用当前域名）
  return filePath.startsWith('/') ? filePath : `/${filePath}`;
};

// 获取当前环境下的"显示用"前端地址（用于页面 footer、配置页等）
// 始终返回绝对 URL，避免在生产环境出现相对路径导致分享链接错误
export const getPublicFrontendUrl = () => getFrontendUrl();

// 允许的前端备用 host（用于 allowedHosts 校验、跨域跳转白名单等）
export const getAllowedFrontendHosts = () => {
  const hosts = new Set();
  const origin = (() => {
    try {
      return window.location.host;
    } catch (_e) {
      return '';
    }
  })();
  if (origin) hosts.add(origin);
  hosts.add('localhost');
  hosts.add('127.0.0.1');
  getFrontendFallbackHosts().forEach(h => hosts.add(h));
  try {
    const fe = new URL(getFrontendUrl());
    hosts.add(fe.host);
  } catch (_e) { /* ignore */ }
  return Array.from(hosts).filter(Boolean);
};

// 配置对象
export const config = {
  backendUrl: getBackendUrl(),
  frontendUrl: getFrontendUrl(),
  publicFrontendUrl: getPublicFrontendUrl(),
  apiBaseUrl: getApiBaseUrl(),
  getFileUrl,
  getAllowedFrontendHosts,
  isProduction: import.meta.env.PROD === true,
};

export default config;
