/**
 * API 响应规范化工具
 * 提供统一的响应格式处理和数据转换
 */

const LIST_KEYS = ['list', 'records', 'items', 'rows', 'data'];
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 1000;

/**
 * 判断是否是纯对象
 */
const isPlainObject = value =>
  Object.prototype.toString.call(value) === '[object Object]';

/**
 * 安全转换为有限数值
 */
const toFiniteNumber = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

/**
 * 安全获取字符串值
 */
const toSafeString = (value, defaultValue = '') => {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  return String(value);
};

/**
 * 安全获取布尔值
 */
const toSafeBoolean = (value, defaultValue = false) => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (value === 'true' || value === 1 || value === '1') {
    return true;
  }
  if (value === 'false' || value === 0 || value === '0') {
    return false;
  }
  return defaultValue;
};

/**
 * 提取列表数据
 */
const extractList = value => {
  if (Array.isArray(value)) {
    return value;
  }

  if (!isPlainObject(value)) {
    return null;
  }

  for (const key of LIST_KEYS) {
    if (Array.isArray(value[key])) {
      return value[key];
    }
  }

  return null;
};

/**
 * 提取分页信息
 */
const extractPagination = source => {
  if (!isPlainObject(source)) {
    return null;
  }

  if (isPlainObject(source.pagination)) {
    return source.pagination;
  }

  if (isPlainObject(source.pageInfo)) {
    return source.pageInfo;
  }

  if (isPlainObject(source.meta?.pagination)) {
    return source.meta.pagination;
  }

  const hasPaginationShape = ['page', 'current', 'pageSize', 'limit', 'total', 'totalPages'].some(
    key => source[key] !== undefined
  );

  return hasPaginationShape ? source : null;
};

/**
 * 规范化分页信息
 */
const normalizePagination = (pagination, totalFallback) => {
  const normalized = isPlainObject(pagination) ? { ...pagination } : {};

  const current = toFiniteNumber(normalized.current ?? normalized.page);
  const page = toFiniteNumber(normalized.page ?? normalized.current);
  const pageSize = Math.min(
    toFiniteNumber(normalized.pageSize ?? normalized.limit ?? normalized.size) || DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE
  );
  const total = toFiniteNumber(normalized.total ?? normalized.count) ?? totalFallback;
  const totalPages =
    toFiniteNumber(normalized.totalPages ?? normalized.pages) ??
    (pageSize > 0 && total ? Math.ceil(total / pageSize) : undefined);

  if (current !== undefined) {
    normalized.current = current;
  }
  if (page !== undefined) {
    normalized.page = page;
  }
  normalized.pageSize = pageSize;
  if (total !== undefined) {
    normalized.total = total;
  }
  if (totalPages !== undefined) {
    normalized.totalPages = totalPages;
  }

  return normalized;
};

/**
 * 规范化列表响应
 */
export const normalizeListResult = result => {
  if (!isPlainObject(result)) {
    return result;
  }

  const rawData = result.data;
  const list = extractList(rawData) ?? [];
  const paginationSource = extractPagination(rawData) ?? extractPagination(result);

  return {
    ...result,
    data: list,
    pagination: normalizePagination(paginationSource, list.length),
    rawData,
  };
};

/**
 * 规范化单个记录
 */
export const normalizeRecord = (record, schema = {}) => {
  if (!isPlainObject(record)) {
    return record;
  }

  const normalized = { ...record };

  // 根据 schema 进行类型转换
  for (const [key, type] of Object.entries(schema)) {
    if (normalized[key] === undefined) continue;

    switch (type) {
      case 'string':
        normalized[key] = toSafeString(normalized[key]);
        break;
      case 'number':
        normalized[key] = toFiniteNumber(normalized[key]);
        break;
      case 'boolean':
        normalized[key] = toSafeBoolean(normalized[key]);
        break;
      case 'date':
        normalized[key] = normalized[key] ? new Date(normalized[key]) : null;
        break;
      default:
        break;
    }
  }

  return normalized;
};

/**
 * 规范化错误响应
 */
export const normalizeError = error => {
  if (!error) {
    return { message: '未知错误', code: 'UNKNOWN_ERROR' };
  }

  // 已经是规范化格式
  if (error.message && error.code) {
    return error;
  }

  // 从 Axios 错误提取
  if (error.response) {
    const { data, status } = error.response;
    return {
      message: data?.message || data?.error || data?.details || error.message || '请求失败',
      code: data?.errorCode || `HTTP_${status}`,
      status,
      details: data?.details,
    };
  }

  // 网络错误
  if (error.code === 'ECONNABORTED') {
    return { message: '请求超时，请检查网络连接', code: 'TIMEOUT' };
  }

  if (!navigator.onLine) {
    return { message: '网络连接已断开', code: 'OFFLINE' };
  }

  // 其他错误
  return {
    message: error.message || '请求失败',
    code: error.code || 'UNKNOWN_ERROR',
  };
};

/**
 * 规范化日期字符串
 */
export const normalizeDate = (dateString, format = 'YYYY-MM-DD') => {
  if (!dateString) return null;

  const date = new Date(dateString);
  if (isNaN(date.getTime())) return null;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  switch (format) {
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`;
    case 'YYYY-MM-DD HH:mm:ss':
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    case 'YYYY-MM-DDTHH:mm:ss':
      return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
    case 'HH:mm:ss':
      return `${hours}:${minutes}:${seconds}`;
    default:
      return date.toISOString();
  }
};

/**
 * 转换金额显示
 */
export const formatCurrency = (value, options = {}) => {
  const { currency = '¥', decimals = 2, showSymbol = true } = options;

  const num = toFiniteNumber(value);
  if (num === undefined) return '-';

  const formatted = num.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return showSymbol ? `${currency}${formatted}` : formatted;
};

/**
 * 转换文件大小显示
 */
export const formatFileSize = bytes => {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

/**
 * 转换数字为百分比
 */
export const formatPercent = (value, decimals = 1) => {
  const num = toFiniteNumber(value);
  if (num === undefined) return '-';
  return `${(num * 100).toFixed(decimals)}%`;
};

/**
 * 规范化枚举值显示
 */
export const normalizeEnumLabel = (value, enumMap, defaultLabel = '-') => {
  if (value === undefined || value === null) {
    return defaultLabel;
  }
  return enumMap[value] || value;
};

/**
 * 批量规范化记录
 */
export const normalizeRecords = (records, schema = {}) => {
  if (!Array.isArray(records)) {
    return records;
  }
  return records.map(record => normalizeRecord(record, schema));
};

/**
 * 创建分页响应
 */
export const createPaginatedResponse = (data, pagination) => {
  return {
    data: Array.isArray(data) ? data : [],
    pagination: normalizePagination(pagination, Array.isArray(data) ? data.length : 0),
  };
};

export default {
  normalizeListResult,
  normalizeRecord,
  normalizeError,
  normalizeDate,
  formatCurrency,
  formatFileSize,
  formatPercent,
  normalizeEnumLabel,
  normalizeRecords,
  createPaginatedResponse,
};