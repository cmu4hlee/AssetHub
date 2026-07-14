import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  isFeishuWebApp,
  isFeishuNarrowViewport,
  isFeishuWideViewport,
  isInIframe,
  hasFeishuSdk,
  postMessageToFeishuHost,
  parseFeishuHostMessage,
  invokeFeishuApi,
  closeFeishuWebApp,
  normalizeFeishuTheme,
  FEISHU_THEMES,
} from '../utils/feishu';

const VIEWPORT_NARROW_BREAKPOINT = 540;
const VIEWPORT_WIDE_BREAKPOINT = 768;

const getInitialState = () => {
  if (typeof window === 'undefined') {
    return {
      isFeishu: false,
      isIframe: false,
      isNarrow: false,
      isWide: true,
      hasSdk: false,
      theme: '',
      viewportWidth: 0,
      viewportHeight: 0,
    };
  }
  const width = window.innerWidth || 0;
  const height = window.innerHeight || 0;
  return {
    isFeishu: isFeishuWebApp(),
    isIframe: isInIframe(),
    isNarrow: isFeishuNarrowViewport(VIEWPORT_NARROW_BREAKPOINT),
    isWide: isFeishuWideViewport(VIEWPORT_WIDE_BREAKPOINT),
    hasSdk: hasFeishuSdk(),
    theme: '',
    viewportWidth: width,
    viewportHeight: height,
  };
};

/**
 * useFeishu - 在飞书网页应用环境中为组件提供统一上下文。
 *
 * 返回:
 *   isFeishu         - 是否运行在飞书网页应用(嵌套 iframe + UA/SDK)
 *   isIframe         - 是否处于任意 iframe 嵌入(包含非飞书场景)
 *   isNarrow         - 视口宽度 ≤ 540(常见飞书手机端工作台)
 *   isWide           - 视口宽度 ≥ 768(飞书桌面工作台)
 *   hasSdk           - 是否检测到飞书 JSAPI SDK
 *   theme            - 飞书宿主下发的 'light' / 'dark',空字符串表示未提供
 *   viewport         - { width, height } 当前视口尺寸
 *   isReady          - 视口/环境状态完成初始化
 *   sendMessage      - 向飞书宿主投递 postMessage
 *   invoke           - 调用飞书 JSAPI,失败时返回 reject
 *   close            - 请求关闭当前飞书网页应用
 *   on               - 订阅飞书宿主下发的指定 type 消息(返回取消订阅函数)
 */
const useFeishu = () => {
  const [state, setState] = useState(getInitialState);
  const [isReady, setIsReady] = useState(() => typeof window !== 'undefined');

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const updateViewport = () => {
      const width = window.innerWidth || 0;
      const height = window.innerHeight || 0;
      setState(prev => ({
        ...prev,
        viewportWidth: width,
        viewportHeight: height,
        isNarrow: isFeishuNarrowViewport(VIEWPORT_NARROW_BREAKPOINT),
        isWide: isFeishuWideViewport(VIEWPORT_WIDE_BREAKPOINT),
      }));
    };

    updateViewport();
    setIsReady(true);

    window.addEventListener('resize', updateViewport, { passive: true });
    window.addEventListener('orientationchange', updateViewport, { passive: true });

    const handleMessage = event => {
      const data = parseFeishuHostMessage(event);
      if (!data) return;
      const type = data.type || data.action;
      const payload = data.payload || data.data || {};
      if (!type) return;

      if (
        type === 'viewport' ||
        type === 'resize' ||
        type === 'theme' ||
        type === 'themeChanged'
      ) {
        setState(prev => {
          const next = { ...prev };
          if (payload.width || payload.height) {
            next.viewportWidth = payload.width || prev.viewportWidth;
            next.viewportHeight = payload.height || prev.viewportHeight;
          }
          if (type === 'theme' || type === 'themeChanged' || payload.theme !== undefined) {
            next.theme = normalizeFeishuTheme(payload.theme || data.theme);
          }
          if (next.viewportWidth > 0) {
            next.isNarrow = next.viewportWidth <= VIEWPORT_NARROW_BREAKPOINT;
            next.isWide = next.viewportWidth >= VIEWPORT_WIDE_BREAKPOINT;
          }
          return next;
        });
      }
    };

    window.addEventListener('message', handleMessage);

    // 主动告知宿主页面已就绪,部分飞书宿主会在收到 ready 后下发 theme/viewport
    postMessageToFeishuHost('ready', {
      ua: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
    });

    return () => {
      window.removeEventListener('resize', updateViewport);
      window.removeEventListener('orientationchange', updateViewport);
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  // 同步主题到根元素,供全局 CSS 切换
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (state.theme) {
      document.documentElement.setAttribute('data-feishu-theme', state.theme);
      document.body?.setAttribute('data-feishu-theme', state.theme);
    } else {
      document.documentElement.removeAttribute('data-feishu-theme');
      document.body?.removeAttribute('data-feishu-theme');
    }
  }, [state.theme]);

  const sendMessage = useCallback((type, payload) => {
    return postMessageToFeishuHost(type, payload);
  }, []);

  const invoke = useCallback((api, params, options) => {
    return invokeFeishuApi(api, params, options);
  }, []);

  const close = useCallback(() => {
    return closeFeishuWebApp();
  }, []);

  const on = useCallback((type, handler) => {
    if (typeof window === 'undefined' || typeof handler !== 'function') {
      return () => {};
    }
    const listener = event => {
      const data = parseFeishuHostMessage(event);
      if (!data) return;
      if ((data.type || data.action) === type) {
        handler(data.payload || data.data || {}, data);
      }
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, []);

  return useMemo(
    () => ({
      ...state,
      isReady,
      sendMessage,
      invoke,
      close,
      on,
      themes: FEISHU_THEMES,
    }),
    [state, isReady, sendMessage, invoke, close, on],
  );
};

export default useFeishu;