/**
 * 表单验证工具
 * 集中管理验证规则，与 constants/VALIDATION_RULES 配合使用
 */

import { VALIDATION_RULES } from '../constants';

/**
 * 创建必填验证规则
 * @param {string} message - 自定义错误消息
 */
export const required = (message = '此字段为必填项') => ({
  required: true,
  message,
});

/**
 * 创建最小长度验证规则
 * @param {number} min - 最小长度
 * @param {string} [message] - 自定义错误消息
 */
export const minLength = (min, message) => ({
  min,
  message: message || `至少 ${min} 个字符`,
});

/**
 * 创建最大长度验证规则
 * @param {number} max - 最大长度
 * @param {string} [message] - 自定义错误消息
 */
export const maxLength = (max, message) => ({
  max,
  message: message || `最多 ${max} 个字符`,
});

/**
 * 创建长度范围验证规则
 * @param {number} min - 最小长度
 * @param {number} max - 最大长度
 * @param {string} [message] - 自定义错误消息
 */
export const lengthRange = (min, max, message) => ({
  min,
  max,
  message: message || `长度应在 ${min} 到 ${max} 个字符之间`,
});

/**
 * 创建邮箱验证规则
 * @param {string} [message] - 自定义错误消息
 */
export const email = (message) => ({
  type: 'email',
  message: message || VALIDATION_RULES.EMAIL?.PATTERN ? '请输入有效的邮箱地址' : '请输入有效的邮箱地址',
});

/**
 * 创建手机号验证规则（中国大陆）
 * @param {string} [message] - 自定义错误消息
 */
export const phone = (message) => ({
  pattern: VALIDATION_RULES.PHONE?.PATTERN || /^1[3-9]\d{9}$/,
  message: message || '请输入有效的手机号码',
});

/**
 * 创建电话号码验证规则（支持手机号和座机）
 * @param {string} [message] - 自定义错误消息
 */
export const telephone = (message) => ({
  pattern: /^1[3-9]\d{9}$|^0\d{2,3}-?\d{7,8}$/,
  message: message || '请输入有效的电话号码',
});

/**
 * 创建数字验证规则
 * @param {number} [min] - 最小值
 * @param {number} [max] - 最大值
 * @param {string} [message] - 自定义错误消息
 */
export const number = (min, max, message) => {
  const rule = { type: 'number', message: message || '请输入有效的数字' };
  if (min !== undefined) rule.min = min;
  if (max !== undefined) rule.max = max;
  return rule;
};

/**
 * 创建正则表达式验证规则
 * @param {RegExp} pattern - 正则表达式
 * @param {string} [message] - 自定义错误消息
 */
export const pattern = (pattern, message = '格式不正确') => ({
  pattern,
  message,
});

/**
 * 创建资产编码验证规则
 * @param {string} [message] - 自定义错误消息
 */
export const assetCode = (message) => ({
  pattern: VALIDATION_RULES.ASSET_CODE?.PATTERN || /^[A-Za-z0-9-_]+$/,
  message: message || VALIDATION_RULES.ASSET_CODE?.PATTERN ? '只能包含字母、数字、- 和 _' : '只能包含字母、数字、- 和 _',
});

/**
 * 创建 MAC 地址验证规则
 * @param {string} [message] - 自定义错误消息
 */
export const macAddress = (message) => ({
  pattern: /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/,
  message: message || '请输入有效的MAC地址格式',
});

/**
 * 创建 IP 地址验证规则
 * @param {string} [message] - 自定义错误消息
 */
export const ipAddress = (message) => ({
  pattern: /^((25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(25[0-5]|2[0-4]\d|[01]?\d\d?)$/,
  message: message || '请输入有效的IP地址',
});

/**
 * 创建 URL 验证规则
 * @param {string} [message] - 自定义错误消息
 */
export const url = (message) => ({
  type: 'url',
  message: message || '请输入有效的URL地址',
});

/**
 * 创建自定义验证器
 * @param {Function} validator - 验证函数 (rule, value) => Promise | boolean
 * @param {string} [message] - 自定义错误消息
 */
export const custom = (validator, message) => ({
  validator,
  message: message || '验证失败',
});

/**
 * 验证器组合函数（用于需要多个验证规则的字段）
 * @param  {...(Object|Array)} rules - 验证规则
 * @returns {Array} 合并后的验证规则数组
 */
export const combine = (...rules) => {
  return rules.flat().filter(Boolean);
};

/**
 * 创建确认密码验证规则
 * @param {Function} getValue - 获取原密码值的函数 () => string
 * @param {string} [message] - 自定义错误消息
 */
export const confirmPassword = (getValue, message) => ({
  validator: (_, value) => {
    if (!value) {
      return Promise.reject(message || '请确认密码');
    }
    if (value !== getValue()) {
      return Promise.reject(message || '两次输入的密码不一致');
    }
    return Promise.resolve();
  },
});

/**
 * 常用字段验证规则预设
 */
export const fieldRules = {
  /** 用户名 */
  username: combine(
    required('请输入用户名'),
    lengthRange(3, 20, '用户名长度在 3 到 20 个字符之间'),
    pattern(/^[a-zA-Z0-9_-]+$/, '只能包含字母、数字、- 和 _')
  ),

  /** 密码 */
  password: combine(
    required('请输入密码'),
    minLength(6, '密码至少 6 个字符'),
    maxLength(32, '密码最多 32 个字符')
  ),

  /** 邮箱 */
  email: combine(
    required('请输入邮箱'),
    email()
  ),

  /** 手机号 */
  phone: combine(
    required('请输入手机号'),
    phone()
  ),

  /** 部门编码 */
  departmentCode: combine(
    required('请输入部门编码'),
    lengthRange(2, 20, '部门编码长度在 2 到 20 个字符之间'),
    pattern(/^[a-zA-Z0-9-_]+$/, '只能包含字母、数字、- 和 _')
  ),

  /** 部门名称 */
  departmentName: combine(
    required('请输入部门名称'),
    lengthRange(2, 50, '部门名称长度在 2 到 50 个字符之间')
  ),

  /** 资产名称 */
  assetName: combine(
    required('请输入资产名称'),
    lengthRange(1, 100, '资产名称长度在 1 到 100 个字符之间')
  ),

  /** 资产编码 */
  assetCode: combine(
    required('请输入资产编码'),
    assetCode()
  ),
};

export default {
  required,
  minLength,
  maxLength,
  lengthRange,
  email,
  phone,
  telephone,
  number,
  pattern,
  assetCode,
  macAddress,
  ipAddress,
  url,
  custom,
  combine,
  confirmPassword,
  fieldRules,
};
