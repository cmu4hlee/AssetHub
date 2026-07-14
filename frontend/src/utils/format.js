/**
 * 格式化工具函数
 * 统一管理日期、数字、文件大小等格式化逻辑
 */

import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import duration from 'dayjs/plugin/duration';
import 'dayjs/locale/zh-cn';

dayjs.extend(relativeTime);
dayjs.extend(duration);
dayjs.locale('zh-cn');

/**
 * 日期格式化
 * @param {string|Date|number} date - 日期
 * @param {string} format - 格式，默认 'YYYY-MM-DD HH:mm:ss'
 */
export const formatDate = (date, format = 'YYYY-MM-DD HH:mm:ss') => {
  if (!date) return '-';
  const d = dayjs(date);
  return d.isValid() ? d.format(format) : '-';
};

/**
 * 相对时间格式化
 * @param {string|Date|number} date - 日期
 */
export const formatRelativeTime = (date) => {
  if (!date) return '-';
  const d = dayjs(date);
  return d.isValid() ? d.fromNow() : '-';
};

/**
 * 日期范围格式化
 * @param {Array} range - [开始日期, 结束日期]
 * @param {string} format - 格式
 */
export const formatDateRange = (range, format = 'YYYY-MM-DD') => {
  if (!range || !Array.isArray(range)) return '-';
  const [start, end] = range;
  if (!start || !end) return '-';
  return `${formatDate(start, format)} ~ ${formatDate(end, format)}`;
};

/**
 * 数字格式化
 * @param {number} num - 数字
 * @param {Object} options - 配置选项
 */
export const formatNumber = (num, options = {}) => {
  if (num === null || num === undefined) return '-';
  if (typeof num !== 'number') {
    num = parseFloat(num);
    if (isNaN(num)) return '-';
  }

  const {
    decimals = 2,
    prefix = '',
    suffix = '',
    thousands = true,
  } = options;

  const fixed = num.toFixed(decimals);
  const parts = fixed.split('.');
  parts[0] = thousands ? parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') : parts[0];

  return `${prefix}${parts.join('.')}${suffix}`;
};

/**
 * 百分比格式化
 * @param {number} value - 数值 (0-1 或 0-100)
 * @param {Object} options - 配置选项
 */
export const formatPercent = (value, options = {}) => {
  if (value === null || value === undefined) return '-';

  const { decimals = 2, multiply = true } = options;

  let num = value;
  if (multiply && value <= 1) {
    num = value * 100;
  }

  return `${num.toFixed(decimals)}%`;
};

/**
 * 文件大小格式化
 * @param {number} bytes - 字节数
 * @param {Object} options - 配置选项
 */
export const formatFileSize = (bytes, options = {}) => {
  if (bytes === null || bytes === undefined || bytes === 0) return '-';
  if (typeof bytes !== 'number') {
    bytes = parseFloat(bytes);
    if (isNaN(bytes)) return '-';
  }

  const { decimals = 2 } = options;

  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let unitIndex = 0;
  let size = bytes;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(decimals)} ${units[unitIndex]}`;
};

/**
 * 手机号格式化
 * @param {string} phone - 手机号
 * @param {string} mask - 脱敏字符
 */
export const formatPhone = (phone, mask = '****') => {
  if (!phone) return '-';
  const str = String(phone);
  if (str.length !== 11) return str;
  return `${str.slice(0, 3)} ${mask} ${str.slice(-4)}`;
};

/**
 * 银行卡号格式化
 * @param {string} cardNo - 银行卡号
 * @param {string} mask - 脱敏字符
 */
export const formatBankCard = (cardNo, mask = '****') => {
  if (!cardNo) return '-';
  const str = String(cardNo).replace(/\s/g, '');
  if (str.length < 8) return str;
  return `${str.slice(0, 4)} ${mask} ${str.slice(-4)}`;
};

/**
 * 身份证号格式化
 * @param {string} idCard - 身份证号
 * @param {string} mask - 脱敏字符
 */
export const formatIdCard = (idCard, mask = '********') => {
  if (!idCard) return '-';
  const str = String(idCard);
  if (str.length !== 18) return str;
  return `${str.slice(0, 6)} ${mask} ${str.slice(-4)}`;
};

/**
 * 脱敏处理
 * @param {string} str - 字符串
 * @param {number} start - 开头保留字符数
 * @param {number} end - 结尾保留字符数
 * @param {string} mask - 脱敏字符
 */
export const maskString = (str, start = 3, end = 4, mask = '*') => {
  if (!str) return '-';
  const string = String(str);
  if (string.length <= start + end) return string;
  const maskLength = string.length - start - end;
  return `${string.slice(0, start)}${mask.repeat(Math.min(maskLength, 8))}${string.slice(-end)}`;
};

/**
 * 货币格式化
 * @param {number} amount - 金额
 * @param {string} currency - 货币符号
 * @param {Object} options - 配置选项
 */
export const formatCurrency = (amount, currency = '¥', options = {}) => {
  if (amount === null || amount === undefined) return '-';
  return `${currency}${formatNumber(amount, { decimals: 2, ...options })}`;
};

/**
 * 时长格式化（秒转为时分秒）
 * @param {number} seconds - 秒数
 */
export const formatDuration = (seconds) => {
  if (seconds === null || seconds === undefined || seconds < 0) return '-';

  const d = dayjs.duration(seconds, 'seconds');
  const hours = d.hours();
  const minutes = d.minutes();
  const secs = d.seconds();

  if (hours > 0) {
    return `${hours}小时${minutes}分${secs}秒`;
  }
  if (minutes > 0) {
    return `${minutes}分${secs}秒`;
  }
  return `${secs}秒`;
};

/**
 * 时长格式化（毫秒转为人类可读）
 * @param {number} ms - 毫秒数
 */
export const formatMilliseconds = (ms) => {
  if (ms === null || ms === undefined || ms < 0) return '-';

  const d = dayjs.duration(ms);
  const hours = d.hours();
  const minutes = d.minutes();
  const seconds = d.seconds();

  if (hours > 0) {
    return `${hours}小时${minutes}分${seconds}秒`;
  }
  if (minutes > 0) {
    return `${minutes}分${seconds}秒`;
  }
  return `${seconds}.${String(d.milliseconds()).padStart(3, '0')}秒`;
};

/**
 * 字符串截断
 * @param {string} str - 字符串
 * @param {number} maxLength - 最大长度
 * @param {string} suffix - 后缀
 */
export const truncate = (str, maxLength = 50, suffix = '...') => {
  if (!str) return '-';
  const string = String(str);
  if (string.length <= maxLength) return string;
  return `${string.slice(0, maxLength)}${suffix}`;
};

/**
 * 首字母大写
 * @param {string} str - 字符串
 */
export const capitalize = (str) => {
  if (!str) return '';
  return String(str).charAt(0).toUpperCase() + String(str).slice(1).toLowerCase();
};

/**
 * 驼峰转短横线
 * @param {string} str - 字符串
 */
export const camelToKebab = (str) => {
  if (!str) return '';
  return String(str).replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
};

/**
 * 短横线转驼峰
 * @param {string} str - 字符串
 */
export const kebabToCamel = (str) => {
  if (!str) return '';
  return String(str).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
};

/**
 * 换行符转 <br>
 * @param {string} str - 字符串
 */
export const nl2br = (str) => {
  if (!str) return '';
  return String(str).replace(/\n/g, '<br>');
};

/**
 * HTML标签转义
 * @param {string} str - 字符串
 */
export const escapeHtml = (str) => {
  if (!str) return '';
  const htmlEscapes = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return String(str).replace(/[&<>"']/g, (char) => htmlEscapes[char]);
};

/**
 * URL参数序列化
 * @param {Object} params - 参数对象
 */
export const serializeParams = (params) => {
  if (!params) return '';
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => {
      if (typeof value === 'object') {
        return `${encodeURIComponent(key)}=${encodeURIComponent(JSON.stringify(value))}`;
      }
      return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
    })
    .join('&');
};

export default {
  formatDate,
  formatRelativeTime,
  formatDateRange,
  formatNumber,
  formatPercent,
  formatFileSize,
  formatPhone,
  formatBankCard,
  formatIdCard,
  maskString,
  formatCurrency,
  formatDuration,
  formatMilliseconds,
  truncate,
  capitalize,
  camelToKebab,
  kebabToCamel,
  nl2br,
  escapeHtml,
  serializeParams,
};
