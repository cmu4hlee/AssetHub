/**
 * API 请求 Hook - 封装常用请求模式
 * 自动处理 Loading、错误提示、重试等
 *
 * @description 增强版：添加防抖搜索、请求重试、批量操作等功能
 */

import { useCallback, useState, useRef, useEffect } from 'react';
import { message } from 'antd';
import { api, getApiErrorMessage } from '../api/client';
import { normalizeListResult } from '../api/normalizers';
import { useAppState } from '../contexts/AppStateContext';

/**
 * 基础 API 请求 Hook
 * 支持请求取消、自动错误处理
 */
export const useApiRequest = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);

  const execute = useCallback(async (apiCall, options = {}) => {
    const {
      showError = true,
      successMessage,
      errorMessage,
      onSuccess,
      onError,
      retryCount = 0,
      maxRetries = 0,
    } = options;

    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);

    const attemptRequest = async (attempt) => {
      try {
        // 将 signal 传递给 apiCall（如果 apiCall 支持）
        const result = await apiCall(abortControllerRef.current.signal);

        if (successMessage) {
          message.success(successMessage);
        }

        onSuccess?.(result);
        return result;
      } catch (err) {
        // 取消请求不视为错误
        if (err.name === 'CanceledError' || err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
          return null;
        }

        // 检查是否需要重试
        const shouldRetry = attempt < maxRetries && (
          err.code === 'ECONNABORTED' ||
          err.response?.status === 500 ||
          err.response?.status === 502 ||
          err.response?.status === 503
        );

        if (shouldRetry) {
          console.log(`请求失败，${attempt + 1}秒后重试...`);
          await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 1000));
          return attemptRequest(attempt + 1);
        }

        throw err;
      }
    };

    try {
      const result = await attemptRequest(0);
      return result;
    } catch (err) {
      const errorMsg = errorMessage || getApiErrorMessage(err, '操作失败');
      setError(err);

      if (showError) {
        message.error(errorMsg);
      }

      onError?.(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  // 组件卸载时自动取消请求
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return { loading, error, execute, cancel };
};

/**
 * 列表查询 Hook（带分页和请求取消支持）
 */
export const useListRequest = (apiUrl, _options = {}) => {
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const paginationRef = useRef(pagination);
  const abortControllerRef = useRef(null);
  const debounceTimerRef = useRef(null);

  useEffect(() => {
    paginationRef.current = pagination;
  }, [pagination]);

  const fetchList = useCallback(async (params = {}, options = {}) => {
    const { debounce = 0, signal } = options;
    const { current, pageSize, ...restParams } = params;
    const { current: currentPage, pageSize: currentPageSize } = paginationRef.current;

    // 防抖处理
    if (debounce > 0) {
      return new Promise((resolve, reject) => {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = setTimeout(async () => {
          try {
            const result = await executeListRequest(
              apiUrl,
              {
                page: current || currentPage,
                pageSize: pageSize || currentPageSize,
                ...restParams,
              },
              signal
            );
            resolve(result);
          } catch (err) {
            reject(err);
          }
        }, debounce);
      });
    }

    return executeListRequest(
      apiUrl,
      {
        page: current || currentPage,
        pageSize: pageSize || currentPageSize,
        ...restParams,
      },
      signal
    );
  }, [apiUrl]);

  const executeListRequest = async (url, params, signal) => {
    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const effectiveSignal = signal || abortControllerRef.current.signal;

    setLoading(true);
    setError(null);

    try {
      const result = await api.get(url, {
        params,
        signal: effectiveSignal,
      });

      if (result?.data) {
        const normalizedResult = normalizeListResult(result);

        setData(normalizedResult.data || []);
        setPagination({
          current: normalizedResult.pagination?.current || normalizedResult.pagination?.page || params.page || 1,
          pageSize: normalizedResult.pagination?.pageSize || params.pageSize || 10,
          total: normalizedResult.pagination?.total || 0,
        });
      }

      return result;
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
        return null;
      }
      const errorMsg = getApiErrorMessage(err, '加载数据失败');
      setError(err);
      message.error(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const cancel = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    abortControllerRef.current?.abort();
  }, []);

  // 清理
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const resetList = useCallback(() => {
    setData([]);
    setPagination({ current: 1, pageSize: 10, total: 0 });
    setError(null);
  }, []);

  return {
    data,
    setData,
    pagination,
    setPagination,
    loading,
    error,
    fetchList,
    cancel,
    resetList,
  };
};

/**
 * 防抖搜索 Hook
 * @param {Function} searchFn - 搜索函数
 * @param {number} delay - 防抖延迟（毫秒）
 */
export const useDebouncedSearch = (searchFn, delay = 300) => {
  const [searchValue, setSearchValue] = useState('');
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);

  const debouncedSearch = useCallback(async (value) => {
    setSearchValue(value);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    if (!value || value.trim() === '') {
      return;
    }

    setLoading(true);
    timerRef.current = setTimeout(async () => {
      try {
        await searchFn(value);
      } finally {
        setLoading(false);
      }
    }, delay);
  }, [searchFn, delay]);

  const clearSearch = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    setSearchValue('');
    setLoading(false);
  }, []);

  // 清理
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return {
    searchValue,
    setSearchValue: debouncedSearch,
    loading,
    clearSearch,
  };
};

/**
 * 批量操作 Hook
 * @param {Function} apiFn - API函数
 */
export const useBatchOperation = (apiFn) => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const executeBatch = useCallback(async (items, options = {}) => {
    const { batchSize = 10, onItemSuccess, onItemError, onBatchComplete } = options;

    if (!items || items.length === 0) {
      return { success: 0, failed: 0, results: [] };
    }

    setLoading(true);
    setProgress({ current: 0, total: items.length });

    const results = [];
    let successCount = 0;
    let failedCount = 0;

    // 分批处理
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (item, index) => {
          const globalIndex = i + index;
          try {
            const result = await apiFn(item, globalIndex);
            results.push({ item, result, success: true });
            successCount++;
            onItemSuccess?.(item, result, globalIndex);
          } catch (err) {
            results.push({ item, error: err, success: false });
            failedCount++;
            onItemError?.(item, err, globalIndex);
          }
        })
      );

      setProgress({ current: Math.min(i + batchSize, items.length), total: items.length });

      // 批次间延迟（避免请求过快）
      if (i + batchSize < items.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    setLoading(false);
    onBatchComplete?.(results);

    return { success: successCount, failed: failedCount, results };
  }, [apiFn]);

  return { loading, progress, executeBatch };
};

/**
 * 表单提交 Hook（支持请求取消）
 */
export const useFormSubmit = (apiUrl, options = {}) => {
  const { method = 'post', successMessage = '操作成功', onSuccess } = options;
  const { loading, error, execute } = useApiRequest();
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const submit = useCallback(async (values, id = null, signal) => {
    const url = id ? `${apiUrl}/${id}` : apiUrl;
    const apiMethod = id && method === 'post' ? 'put' : method;

    const result = await execute(
      (cancelSignal) => api[apiMethod](url, values, { signal: cancelSignal || signal }),
      {
        successMessage,
        onSuccess: (data) => {
          if (isMountedRef.current) {
            onSuccess?.(data);
          }
        },
      }
    );

    return result;
  }, [apiUrl, method, successMessage, onSuccess, execute]);

  return { loading, error, submit };
};

/**
 * 自动刷新 Hook
 */
export const useAutoRefresh = (fetchFn, options = {}) => {
  const { interval = 30000, immediate = true } = options;
  const intervalRef = useRef(null);
  const { state } = useAppState();

  const start = useCallback(() => {
    if (intervalRef.current) return;

    intervalRef.current = setInterval(() => {
      // 页面可见且在线时才刷新
      if (document.visibilityState === 'visible' && state.isOnline) {
        fetchFn();
      }
    }, interval);
  }, [fetchFn, interval, state.isOnline]);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const refresh = useCallback(() => {
    fetchFn();
  }, [fetchFn]);

  // 组件卸载时清理
  useEffect(() => {
    if (immediate) {
      fetchFn();
      start();
    }

    return () => stop();
  }, [immediate, fetchFn, start, stop]);

  return { start, stop, refresh };
};

export default {
  useApiRequest,
  useListRequest,
  useFormSubmit,
  useAutoRefresh,
  useDebouncedSearch,
  useBatchOperation,
};