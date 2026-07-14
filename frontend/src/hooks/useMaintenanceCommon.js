import { useState, useCallback } from 'react';
import { message } from 'antd';
import { getApiErrorMessage } from '../api/client';

export const useMaintenanceCommon = (options = {}) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const {
    successMessage = '操作成功',
    errorMessage = '操作失败',
    showSuccessMessage = true,
    showErrorMessage = true,
  } = options;

  const withLoading = useCallback(async (asyncFn) => {
    setLoading(true);
    setError(null);

    try {
      const result = await asyncFn();
      setData(result);
      setLoading(false);
      return result;
    } catch (err) {
      const errorMsg = getApiErrorMessage(err, errorMessage);
      setError(errorMsg);

      if (showErrorMessage) {
        message.error(errorMsg);
      }

      setLoading(false);
      throw err;
    }
  }, [errorMessage, showErrorMessage]);

  const withSuccess = useCallback(async (asyncFn, successText = successMessage) => {
    const result = await withLoading(asyncFn);

    if (showSuccessMessage && successText) {
      message.success(successText);
    }

    return result;
  }, [withLoading, successMessage, showSuccessMessage]);

  const reset = useCallback(() => {
    setLoading(false);
    setData(null);
    setError(null);
  }, []);

  return {
    loading,
    data,
    error,
    withLoading,
    withSuccess,
    reset,
  };
};

export const useTableData = (fetchFn, options = {}) => {
  const {
    pageSize = 20,
    onSuccess,
    onError,
  } = options;

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize,
    total: 0,
  });

  const fetchData = useCallback(async (params = {}) => {
    setLoading(true);

    try {
      const response = await fetchFn({
        page: params.page || pagination.current,
        pageSize: params.pageSize || pageSize,
        ...params,
      });

      if (response.success) {
        setData(response.data || []);
        setPagination(prev => ({
          ...prev,
          ...response.pagination,
        }));

        if (onSuccess) {
          onSuccess(response);
        }
      } else {
        const errorMsg = getApiErrorMessage({ message: response.message });
        if (onError) {
          onError(errorMsg);
        }
      }
    } catch (err) {
      const errorMsg = getApiErrorMessage(err);
      if (onError) {
        onError(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  }, [fetchFn, pageSize, pagination.current, onSuccess, onError]);

  const handlePageChange = useCallback((page, size) => {
    setPagination(prev => ({
      ...prev,
      current: page,
      pageSize: size,
    }));
    fetchData({ page, pageSize: size });
  }, [fetchData]);

  const refresh = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    setData,
    loading,
    pagination,
    fetchData,
    handlePageChange,
    refresh,
  };
};

export const useFormValidation = (rules) => {
  const validate = useCallback((values) => {
    const errors = {};

    Object.entries(rules).forEach(([field, rule]) => {
      const value = values[field];

      if (rule.required && (value === undefined || value === null || value === '')) {
        errors[field] = rule.message || `${field}不能为空`;
        return;
      }

      if (value !== undefined && value !== null && value !== '') {
        if (rule.type === 'string') {
          if (typeof value !== 'string') {
            errors[field] = rule.message || `${field}必须是字符串`;
          } else if (rule.maxLength && value.length > rule.maxLength) {
            errors[field] = rule.message || `${field}长度不能超过${rule.maxLength}个字符`;
          } else if (rule.minLength && value.length < rule.minLength) {
            errors[field] = rule.message || `${field}长度不能少于${rule.minLength}个字符`;
          }
        }

        if (rule.type === 'number') {
          if (typeof value !== 'number' || isNaN(value)) {
            errors[field] = rule.message || `${field}必须是数字`;
          } else if (rule.min !== undefined && value < rule.min) {
            errors[field] = rule.message || `${field}不能小于${rule.min}`;
          } else if (rule.max !== undefined && value > rule.max) {
            errors[field] = rule.message || `${field}不能大于${rule.max}`;
          }
        }

        if (rule.pattern && !rule.pattern.test(value)) {
          errors[field] = rule.message || `${field}格式不正确`;
        }
      }
    });

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }, [rules]);

  return { validate };
};
