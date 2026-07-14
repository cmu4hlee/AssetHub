/**
 * 全局错误监控和上报
 * 捕获并上报未处理的错误
 */

// 错误上报队列
const errorQueue = [];
const MAX_QUEUE_SIZE = 50;
const BATCH_REPORT_INTERVAL = 30000; // 30秒批量上报

// 错误去重 Map（防止同个错误重复上报）
const errorDedupMap = new Map();
const DEDUP_WINDOW = 5 * 60 * 1000; // 5分钟去重窗口

/**
 * 生成错误指纹（用于去重）
 */
const generateErrorFingerprint = (error) => {
  const { message, stack, filename, lineno } = error;
  const stackSnippet = stack ? stack.split('\n').slice(0, 3).join('|') : '';
  return btoa(`${message}|${filename}|${lineno}|${stackSnippet}`.slice(0, 200));
};

/**
 * 检查是否应该上报（去重）
 */
const shouldReport = (fingerprint) => {
  const now = Date.now();
  const lastReported = errorDedupMap.get(fingerprint);
  
  if (lastReported && now - lastReported < DEDUP_WINDOW) {
    return false;
  }
  
  errorDedupMap.set(fingerprint, now);
  
  // 清理过期的去重记录
  errorDedupMap.forEach((timestamp, key) => {
    if (now - timestamp > DEDUP_WINDOW) {
      errorDedupMap.delete(key);
    }
  });
  
  return true;
};

/**
 * 收集错误上下文信息
 */
const collectContext = () => {
  if (typeof window === 'undefined') return {};
  
  return {
    url: window.location.href,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString(),
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    performance: {
      memory: performance.memory ? {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
      } : null,
      navigation: performance.getEntriesByType('navigation')[0] ? {
        domComplete: Math.round(performance.getEntriesByType('navigation')[0].domComplete),
        loadEventEnd: Math.round(performance.getEntriesByType('navigation')[0].loadEventEnd),
      } : null,
    },
  };
};

/**
 * 添加上报队列
 */
const queueError = (errorInfo) => {
  const fingerprint = generateErrorFingerprint(errorInfo);
  
  if (!shouldReport(fingerprint)) {
    console.warn('[ErrorMonitor] 重复错误，跳过上报:', errorInfo.message);
    return;
  }
  
  const enrichedError = {
    ...errorInfo,
    fingerprint,
    context: collectContext(),
  };
  
  errorQueue.push(enrichedError);
  
  // 限制队列大小
  if (errorQueue.length > MAX_QUEUE_SIZE) {
    errorQueue.shift();
  }
  
  // 开发环境直接打印
  if (import.meta.env.DEV) {
    console.error('[ErrorMonitor] 捕获错误:', enrichedError);
  }
};

/**
 * 批量上报错误
 */
const reportErrors = async () => {
  if (errorQueue.length === 0) return;
  
  const errorsToReport = [...errorQueue];
  errorQueue.length = 0;
  
  try {
    // 优先使用 Beacon API（页面关闭时也能发送）
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify({ errors: errorsToReport })], {
        type: 'application/json',
      });
      navigator.sendBeacon('/api/client-errors', blob);
    } else {
      // 降级使用 fetch
      await fetch('/api/client-errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ errors: errorsToReport }),
        keepalive: true,
      });
    }
  } catch (e) {
    // 上报失败，恢复队列
    errorQueue.unshift(...errorsToReport);
    console.error('[ErrorMonitor] 上报失败:', e);
  }
};

/**
 * 初始化全局错误监控
 */
export const initErrorMonitor = () => {
  if (typeof window === 'undefined') return;
  
  // 已经初始化过
  if (window.__ERROR_MONITOR_INITIALIZED__) return;
  window.__ERROR_MONITOR_INITIALIZED__ = true;
  
  // 1. 监控 JS 运行时错误
  window.addEventListener('error', (event) => {
    queueError({
      type: 'js_error',
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack || '',
      timestamp: Date.now(),
    });
  });
  
  // 2. 监控未处理的 Promise 错误
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    queueError({
      type: 'unhandledrejection',
      message: reason?.message || String(reason),
      stack: reason?.stack || '',
      timestamp: Date.now(),
    });
  });
  
  // 3. 监控资源加载错误
  window.addEventListener('error', (event) => {
    if (event.target && event.target !== window) {
      const target = event.target;
      queueError({
        type: 'resource_error',
        message: `Failed to load ${target.tagName}`,
        filename: target.src || target.href,
        timestamp: Date.now(),
      });
    }
  }, true);
  
  // 4. 监控 Vue/React 组件错误（需手动调用 reportComponentError）
  
  // 5. 定时批量上报
  const batchReportInterval = setInterval(reportErrors, BATCH_REPORT_INTERVAL);

  // 6. 页面卸载前上报
  window.addEventListener('beforeunload', reportErrors);

  // 7. 页面可见性变化时上报
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      reportErrors();
    }
  });

  console.warn('[ErrorMonitor] 错误监控已初始化');

  // 返回清理函数
  return () => {
    clearInterval(batchReportInterval);
    window.removeEventListener('beforeunload', reportErrors);
    document.removeEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        reportErrors();
      }
    });
  };
};

/**
 * 手动上报组件错误
 */
export const reportComponentError = (error, errorInfo) => {
  queueError({
    type: 'component_error',
    message: error?.message || String(error),
    stack: error?.stack || '',
    componentStack: errorInfo?.componentStack || '',
    timestamp: Date.now(),
  });
};

/**
 * 手动上报自定义错误
 */
export const reportCustomError = (message, extra = {}) => {
  queueError({
    type: 'custom_error',
    message,
    ...extra,
    timestamp: Date.now(),
  });
};

/**
 * 获取当前错误统计
 */
export const getErrorStats = () => ({
  queueSize: errorQueue.length,
  dedupMapSize: errorDedupMap.size,
});

export default {
  initErrorMonitor,
  reportComponentError,
  reportCustomError,
  getErrorStats,
};
