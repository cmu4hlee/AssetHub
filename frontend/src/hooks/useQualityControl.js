import { useState, useCallback } from 'react';
import { message } from 'antd';
import { qualityControlAPI } from '../utils/api';
import { getApiErrorMessage } from '../api/client';

export const useMetrology = (options = {}) => {
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
  const [filters, setFilters] = useState({
    metrology_type: '',
    result: '',
    status: '',
    keyword: '',
    start_date: '',
    end_date: '',
  });

  const fetchData = useCallback(async (params = {}) => {
    setLoading(true);
    try {
      const response = await qualityControlAPI.getMetrologyRecords({
        page: pagination.current,
        pageSize,
        ...filters,
        ...params,
      });

      if (response.success) {
        setData(response.data || []);
        setPagination(prev => ({
          ...prev,
          total: response.pagination?.total || 0,
        }));

        if (onSuccess) {
          onSuccess(response);
        }
      } else {
        const errorMsg = getApiErrorMessage({ message: response.message });
        if (onError) {
          onError(errorMsg);
        }
        message.error(errorMsg);
      }
    } catch (error) {
      const errorMsg = getApiErrorMessage(error);
      if (onError) {
        onError(errorMsg);
      }
      message.error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pageSize, filters, onSuccess, onError]);

  const createRecord = useCallback(async (data) => {
    try {
      const response = await qualityControlAPI.createMetrologyRecord(data);
      if (response.success) {
        message.success('创建成功');
        fetchData();
        return response;
      } else {
        const errorMsg = getApiErrorMessage({ message: response.message });
        message.error(errorMsg);
        return response;
      }
    } catch (error) {
      const errorMsg = getApiErrorMessage(error, '创建失败');
      message.error(errorMsg);
      throw error;
    }
  }, [fetchData]);

  const updateRecord = useCallback(async (id, data) => {
    try {
      const response = await qualityControlAPI.updateMetrologyRecord(id, data);
      if (response.success) {
        message.success('更新成功');
        fetchData();
        return response;
      } else {
        const errorMsg = getApiErrorMessage({ message: response.message });
        message.error(errorMsg);
        return response;
      }
    } catch (error) {
      const errorMsg = getApiErrorMessage(error, '更新失败');
      message.error(errorMsg);
      throw error;
    }
  }, [fetchData]);

  const deleteRecord = useCallback(async (id) => {
    try {
      const response = await qualityControlAPI.deleteMetrologyRecord(id);
      if (response.success) {
        message.success('删除成功');
        fetchData();
        return response;
      } else {
        const errorMsg = getApiErrorMessage({ message: response.message });
        message.error(errorMsg);
        return response;
      }
    } catch (error) {
      const errorMsg = getApiErrorMessage(error, '删除失败');
      message.error(errorMsg);
      throw error;
    }
  }, [fetchData]);

  const handlePageChange = useCallback((page, size) => {
    setPagination(prev => ({
      ...prev,
      current: page,
      pageSize: size,
    }));
  }, []);

  const updateFilters = useCallback((newFilters) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters,
    }));
    setPagination(prev => ({
      ...prev,
      current: 1,
    }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({
      metrology_type: '',
      result: '',
      status: '',
      keyword: '',
      start_date: '',
      end_date: '',
    });
    setPagination(prev => ({
      ...prev,
      current: 1,
    }));
  }, []);

  return {
    data,
    setData,
    loading,
    pagination,
    filters,
    fetchData,
    createRecord,
    updateRecord,
    deleteRecord,
    handlePageChange,
    updateFilters,
    resetFilters,
  };
};

export const useQualityControl = (options = {}) => {
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
  const [filters, setFilters] = useState({
    qc_type: '',
    result: '',
    status: '',
    keyword: '',
    start_date: '',
    end_date: '',
  });

  const fetchData = useCallback(async (params = {}) => {
    setLoading(true);
    try {
      const response = await qualityControlAPI.getQualityControlRecords({
        page: pagination.current,
        pageSize,
        ...filters,
        ...params,
      });

      if (response.success) {
        setData(response.data || []);
        setPagination(prev => ({
          ...prev,
          total: response.pagination?.total || 0,
        }));

        if (onSuccess) {
          onSuccess(response);
        }
      } else {
        const errorMsg = getApiErrorMessage({ message: response.message });
        if (onError) {
          onError(errorMsg);
        }
        message.error(errorMsg);
      }
    } catch (error) {
      const errorMsg = getApiErrorMessage(error);
      if (onError) {
        onError(errorMsg);
      }
      message.error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pageSize, filters, onSuccess, onError]);

  const createRecord = useCallback(async (data) => {
    try {
      const response = await qualityControlAPI.createQualityControlRecord(data);
      if (response.success) {
        message.success('创建成功');
        fetchData();
        return response;
      } else {
        const errorMsg = getApiErrorMessage({ message: response.message });
        message.error(errorMsg);
        return response;
      }
    } catch (error) {
      const errorMsg = getApiErrorMessage(error, '创建失败');
      message.error(errorMsg);
      throw error;
    }
  }, [fetchData]);

  const updateRecord = useCallback(async (id, data) => {
    try {
      const response = await qualityControlAPI.updateQualityControlRecord(id, data);
      if (response.success) {
        message.success('更新成功');
        fetchData();
        return response;
      } else {
        const errorMsg = getApiErrorMessage({ message: response.message });
        message.error(errorMsg);
        return response;
      }
    } catch (error) {
      const errorMsg = getApiErrorMessage(error, '更新失败');
      message.error(errorMsg);
      throw error;
    }
  }, [fetchData]);

  const deleteRecord = useCallback(async (id) => {
    try {
      const response = await qualityControlAPI.deleteQualityControlRecord(id);
      if (response.success) {
        message.success('删除成功');
        fetchData();
        return response;
      } else {
        const errorMsg = getApiErrorMessage({ message: response.message });
        message.error(errorMsg);
        return response;
      }
    } catch (error) {
      const errorMsg = getApiErrorMessage(error, '删除失败');
      message.error(errorMsg);
      throw error;
    }
  }, [fetchData]);

  const handlePageChange = useCallback((page, size) => {
    setPagination(prev => ({
      ...prev,
      current: page,
      pageSize: size,
    }));
  }, []);

  const updateFilters = useCallback((newFilters) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters,
    }));
    setPagination(prev => ({
      ...prev,
      current: 1,
    }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({
      qc_type: '',
      result: '',
      status: '',
      keyword: '',
      start_date: '',
      end_date: '',
    });
    setPagination(prev => ({
      ...prev,
      current: 1,
    }));
  }, []);

  return {
    data,
    setData,
    loading,
    pagination,
    filters,
    fetchData,
    createRecord,
    updateRecord,
    deleteRecord,
    handlePageChange,
    updateFilters,
    resetFilters,
  };
};

export const useMetrologyStatistics = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchStatistics = useCallback(async (params = {}) => {
    setLoading(true);
    setError(null);
    try {
      const response = await qualityControlAPI.getMetrologyStatistics(params);
      if (response.success) {
        setData(response);
        return response;
      } else {
        const errorMsg = getApiErrorMessage({ message: response.message });
        setError(errorMsg);
        message.error(errorMsg);
        return response;
      }
    } catch (error) {
      const errorMsg = getApiErrorMessage(error);
      setError(errorMsg);
      message.error(errorMsg);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    data,
    loading,
    error,
    fetchStatistics,
  };
};

export const useQualityControlStatistics = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchStatistics = useCallback(async (params = {}) => {
    setLoading(true);
    setError(null);
    try {
      const response = await qualityControlAPI.getQualityControlStatistics(params);
      if (response.success) {
        setData(response);
        return response;
      } else {
        const errorMsg = getApiErrorMessage({ message: response.message });
        setError(errorMsg);
        message.error(errorMsg);
        return response;
      }
    } catch (error) {
      const errorMsg = getApiErrorMessage(error);
      setError(errorMsg);
      message.error(errorMsg);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    data,
    loading,
    error,
    fetchStatistics,
  };
};
