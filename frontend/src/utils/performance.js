/**
 * 性能优化工具
 * 提供防抖、节流、缓存等工具函数
 */

/**
 * 防抖函数
 * 在事件触发 n 秒后才执行，如果 n 秒内再次触发，则重新计时
 *
 * @param {Function} fn - 要执行的函数
 * @param {number} delay - 延迟时间（毫秒）
 * @param {boolean} immediate - 是否立即执行
 * @returns {Function} 防抖处理后的函数
 */
export function debounce(fn, delay = 300, immediate = false) {
  let timeoutId = null;

  const debounced = function (...args) {
    const context = this;

    const doLater = () => {
      timeoutId = null;
      if (!immediate) {
        fn.apply(context, args);
      }
    };

    const callNow = immediate && timeoutId === null;

    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(doLater, delay);

    if (callNow) {
      fn.apply(context, args);
    }
  };

  debounced.cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced;
}

/**
 * 节流函数
 * 规定时间内只执行一次，如果 n 秒内多次触发，也只执行一次
 *
 * @param {Function} fn - 要执行的函数
 * @param {number} wait - 间隔时间（毫秒）
 * @param {Object} options - 配置选项
 * @param {boolean} options.leading - 是否在开始时执行
 * @param {boolean} options.trailing - 是否在结束时执行
 * @returns {Function} 节流处理后的函数
 */
export function throttle(fn, wait = 300, options = {}) {
  const { leading = true, trailing = true } = options;
  let timeoutId = null;
  let lastArgs = null;
  let lastTime = 0;

  const throttled = function (...args) {
    const context = this;
    const now = Date.now();

    if (!lastTime && !leading) {
      lastTime = now;
    }

    const remaining = wait - (now - lastTime);

    if (remaining <= 0 || remaining > wait) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      lastTime = now;
      fn.apply(context, args);
      lastTime = now;
      lastArgs = null;
    } else if (!timeoutId && trailing) {
      lastArgs = args;
      timeoutId = setTimeout(() => {
        lastTime = leading ? Date.now() : 0;
        timeoutId = null;
        if (lastArgs) {
          fn.apply(context, lastArgs);
          lastArgs = null;
        }
      }, remaining);
    }
  };

  throttled.cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    lastTime = 0;
    lastArgs = null;
  };

  return throttled;
}

/**
 * 节流函数（别名）
 */
export const throttleRAF = (fn, wait = 300) => {
  let lastTime = 0;
  let timeoutId = null;

  const throttled = function (...args) {
    const context = this;
    const now = Date.now();

    const doLater = () => {
      lastTime = Date.now();
      timeoutId = null;
      fn.apply(context, args);
    };

    const remaining = wait - (now - lastTime);

    if (remaining <= 0 || remaining > wait) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      lastTime = now;
      fn.apply(context, args);
    } else if (!timeoutId) {
      timeoutId = setTimeout(doLater, remaining);
    }
  };

  throttled.cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    lastTime = 0;
  };

  return throttled;
};

/**
 * 记忆化函数
 * 缓存函数结果，避免重复计算
 *
 * @param {Function} fn - 要记忆化的函数
 * @param {Function} resolver - 缓存 key 的解析函数
 * @returns {Function} 记忆化后的函数
 */
export function memo(fn, resolver) {
  const cache = new Map();

  const memoized = function (...args) {
    const key = resolver ? resolver.apply(this, args) : args[0];

    if (cache.has(key)) {
      return cache.get(key);
    }

    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };

  memoized.cache = cache;
  memoized.clearCache = () => cache.clear();

  return memoized;
}

/**
 * once 函数
 * 确保函数只执行一次
 *
 * @param {Function} fn - 要执行的函数
 * @returns {Function} 只执行一次的函数
 */
export function once(fn) {
  let called = false;
  let result;

  const onceFn = function (...args) {
    if (!called) {
      called = true;
      result = fn.apply(this, args);
    }
    return result;
  };

  onceFn.reset = () => {
    called = false;
    result = undefined;
  };

  return onceFn;
}

/**
 * 批量执行函数
 * 将多个函数调用合并为一次执行
 *
 * @param {Function} fn - 要执行的函数
 * @param {number} wait - 等待时间（毫秒）
 * @returns {Function} 批量处理函数
 */
export function batch(fn, wait = 100) {
  let timeoutId = null;
  let lastArgs = null;

  const batched = function (...args) {
    lastArgs = args;

    if (timeoutId === null) {
      timeoutId = setTimeout(() => {
        fn.apply(this, lastArgs);
        timeoutId = null;
        lastArgs = null;
      }, wait);
    }
  };

  batched.cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
      lastArgs = null;
    }
  };

  return batched;
}

/**
 * 异步任务池
 * 限制并发数量的异步任务执行器
 *
 * @param {number} concurrency - 最大并发数
 * @returns {Object} 任务池控制器
 */
export function taskPool(concurrency = 3) {
  let running = 0;
  const queue = [];

  const runTask = async (task) => {
    running++;
    try {
      const result = await task();
      return result;
    } finally {
      running--;
      if (queue.length > 0) {
        const next = queue.shift();
        runTask(next);
      }
    }
  };

  const addTask = (task) => {
    if (running < concurrency) {
      runTask(task);
    } else {
      queue.push(task);
    }
  };

  const clear = () => {
    queue.length = 0;
  };

  return {
    addTask,
    clear,
    getPendingCount: () => queue.length,
    getRunningCount: () => running,
  };
}

/**
 * 等待指定时间
 *
 * @param {number} ms - 等待时间（毫秒）
 * @returns {Promise}
 */
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 延迟执行
 *
 * @param {Function} fn - 要执行的函数
 * @param {number} delay - 延迟时间（毫秒）
 * @returns {number} setTimeout 的 ID
 */
export const delay = (fn, delay = 0) => setTimeout(fn, delay);

export default {
  debounce,
  throttle,
  throttleRAF,
  memo,
  once,
  batch,
  taskPool,
  sleep,
  delay,
};
