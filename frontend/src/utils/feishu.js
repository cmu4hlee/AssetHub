/**
 * 飞书网页应用环境检测与适配工具
 *
 * 飞书网页应用通常通过 iframe 嵌入到飞书工作台/消息会话中,具有以下特征:
 * 1. window.self !== window.top(被嵌入在 iframe 中)
 * 2. User-Agent 包含 Lark/Feishu 关键字
 * 3. 注入全局对象 window.h5sdk / window.__FEISHU__ / window.lark
 * 4. 父页面通过 postMessage 与子页面通讯,可能下发 viewport/theme 信息
 * 5. 客户端受限的视口宽度(手机端通常 360-414px)
 */

const FEISHU_UA_PATTERNS = [
  /Lark\/[\d.]+/i,
  /Feishu\/[\d.]+/i,
  /\bLarkClient\b/i,
  /\bFeishuClient\b/i,
];

const isBrowser = () => typeof window !== 'undefined';

export const isInIframe = () => {
  if (!isBrowser()) return false;
  try {
    return window.self !== window.top;
  } catch (_e) {
    // 跨域 iframe 访问 top 会抛 SecurityError,这种场景同样视作被嵌入
    return true;
  }
};

export const getFeishuUserAgent = () => {
  if (!isBrowser()) return '';
  return String(navigator.userAgent || '');
};

export const matchFeishuUa = ua => {
  if (!ua) return false;
  return FEISHU_UA_PATTERNS.some(re => re.test(ua));
};

export const hasFeishuSdk = () => {
  if (!isBrowser()) return false;
  return Boolean(
    window.h5sdk ||
      window.__FEISHU__ ||
      window.lark ||
      window.Lark ||
      window.feishu ||
      window.FEISHU,
  );
};

export const isFeishuWebApp = () => {
  if (!isBrowser()) return false;
  const ua = getFeishuUserAgent();
  return isInIframe() && (matchFeishuUa(ua) || hasFeishuSdk());
};

/**
 * 当前是否运行在飞书窄视图(webview/移动端工作台)
 * 飞书移动工作台嵌套的网页应用宽度通常在 320-540 之间
 */
export const isFeishuNarrowViewport = (breakpoint = 540) => {
  if (!isBrowser()) return false;
  return window.innerWidth > 0 && window.innerWidth <= breakpoint;
};

/**
 * 当前是否运行在飞书桌面端工作台(>= 768px)
 */
export const isFeishuWideViewport = (breakpoint = 768) => {
  if (!isBrowser()) return false;
  return window.innerWidth >= breakpoint;
};

/**
 * 通用移动端检测(不依赖 React hook,可在路由/登录跳转时直接调用)
 * 综合判断:视口宽度 + UA + 飞书窄视图
 */
export const isMobileDevice = () => {
  if (!isBrowser()) return false;
  const width = window.innerWidth || 0;
  if (width > 0 && width < 768) return true;
  if (isFeishuWebApp() && isFeishuNarrowViewport()) return true;
  const ua = getFeishuUserAgent();
  if (/Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(ua) && width < 900) return true;
  return false;
};

/**
 * 获取首页路径:移动端与桌面端均返回 '/dashboard'（暂不使用模拟桌面）
 */
export const getHomePath = () => '/dashboard';

/**
 * 解析父页面通过 postMessage 下发的信息
 * 飞书宿主常见数据格式:
 *   { source: 'feishu-host', type: 'viewport', payload: { width, height, theme, scale } }
 */
const SAFE_MESSAGE_SOURCES = new Set(['feishu-host', 'lark-host', 'feishu', 'lark']);

export const parseFeishuHostMessage = event => {
  if (!event || typeof event.data !== 'object' || event.data === null) return null;
  const data = event.data;
  const source = data.source || data.from || data.origin;
  if (!source) return null;
  const sourceKey = String(source).toLowerCase();
  if (!SAFE_MESSAGE_SOURCES.has(sourceKey)) return null;
  return data;
};

/**
 * 安全的 postMessage 发送,只对父级窗口投递
 */
export const postMessageToFeishuHost = (type, payload) => {
  if (!isBrowser() || !isInIframe()) return false;
  try {
    const target = window.parent || window.top;
    if (!target || target === window.self) return false;
    target.postMessage(
      {
        source: 'assethub-feishu',
        type,
        payload,
        ts: Date.now(),
      },
      '*',
    );
    return true;
  } catch (_e) {
    return false;
  }
};

/**
 * 飞书 JSAPI 调用桥接
 *
 * 飞书网页应用通过 window.h5sdk 暴露 invoke 方法,这里做一个轻量封装,
 * 在没有 SDK 的环境下保持静默,避免阻塞业务代码。
 */
const FEISHU_BROWSER_API = ['requestAuthCode', 'getUserInfo', 'getTenantAccessToken'];

export const invokeFeishuApi = (api, params = {}, options = {}) => {
  if (!isBrowser()) return Promise.reject(new Error('No window'));
  const timeout = options.timeout || 4000;
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (ok, value) => {
      if (settled) return;
      settled = true;
      ok ? resolve(value) : reject(value);
    };

    if (typeof window.h5sdk?.invoke === 'function') {
      try {
        window.h5sdk.invoke(api, params).then(
          res => finish(true, res),
          err => finish(false, err),
        );
      } catch (e) {
        finish(false, e);
      }
    } else if (FEISHU_BROWSER_API.includes(api) && typeof window?.[api] === 'function') {
      try {
        Promise.resolve(window[api](params)).then(
          res => finish(true, res),
          err => finish(false, err),
        );
      } catch (e) {
        finish(false, e);
      }
    } else {
      finish(false, new Error(`Feishu SDK not available for ${api}`));
    }

    if (timeout > 0) {
      setTimeout(() => finish(false, new Error(`Feishu API ${api} timeout`)), timeout);
    }
  });
};

/**
 * 关闭当前飞书网页应用(浏览器场景下等价于 history.back())
 */
export const closeFeishuWebApp = () => {
  if (!isBrowser()) return false;
  if (isFeishuWebApp()) {
    const sent = postMessageToFeishuHost('close', {});
    if (sent) return true;
  }
  if (window.history.length > 1) {
    window.history.back();
    return true;
  }
  return false;
};

/**
 * 在飞书环境中打开外部浏览器
 * @param {string} url - 要打开的URL
 * @returns {boolean} - 是否成功发起跳转
 */
export const openInExternalBrowser = (url) => {
  if (!isBrowser() || !url) return false;

  if (isFeishuWebApp() && typeof window.h5sdk?.invoke === 'function') {
    window.h5sdk.invoke('router.push', {
      actionType: 'open_external_url',
      url: url,
    }).then(() => true).catch(() => {
      window.location.href = url;
    });
    return true;
  }

  window.location.href = url;
  return true;
};

/**
 * 在移动端（飞书内）打开指定路径，支持外部浏览器
 * @param {string} path - 路由路径，如 /inventory/self
 * @param {object} options - 配置选项
 * @param {boolean} options.external - 是否强制使用外部浏览器
 */
export const openPathInExternalBrowser = (path, options = {}) => {
  if (!isBrowser()) return false;

  const baseUrl = window.location.origin;
  const fullUrl = baseUrl + path;

  if (options.external !== false) {
    return openInExternalBrowser(fullUrl);
  }

  return false;
};

/**
 * 飞书主题枚举
 */
export const FEISHU_THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
};

export const normalizeFeishuTheme = theme => {
  if (!theme) return '';
  const t = String(theme).toLowerCase();
  if (t.includes('dark')) return FEISHU_THEMES.DARK;
  if (t.includes('light')) return FEISHU_THEMES.LIGHT;
  return '';
};

export default {
  isInIframe,
  isFeishuWebApp,
  isFeishuNarrowViewport,
  isFeishuWideViewport,
  hasFeishuSdk,
  matchFeishuUa,
  postMessageToFeishuHost,
  parseFeishuHostMessage,
  invokeFeishuApi,
  closeFeishuWebApp,
  normalizeFeishuTheme,
  FEISHU_THEMES,
  openInExternalBrowser,
  openPathInExternalBrowser,
};
