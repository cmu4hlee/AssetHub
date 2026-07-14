/**
 * 前端常量配置
 * 集中管理魔法字符串和魔法数字
 */

// ==================== API 相关 ====================
export const API_TIMEOUT = {
  NORMAL: 30000,      // 普通请求 30秒
  LONG: 600000,      // 长请求 10分钟 (AI分析等)
  UPLOAD: 120000,    // 上传文件 2分钟
};

export const API_ENDPOINTS = {
  ASSETS: '/api/assets',
  USERS: '/api/users',
  DEPARTMENTS: '/api/departments',
  MAINTENANCE: '/api/maintenance',
  INVENTORY: '/api/inventory',
  DASHBOARD: '/api/dashboard',
};

// ==================== 分页配置 ====================
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 10,
  PAGE_SIZE_OPTIONS: ['10', '20', '50', '100'],
};

// ==================== 存储 Key ====================
export const STORAGE_KEYS = {
  TOKEN: 'token',
  USER: 'user',
  TENANTS: 'tenants',
  SELECTED_TENANT: 'selectedEnterprise',
  SELECTED_DEPARTMENT: 'selectedDepartmentId',
  THEME: 'theme',
  LANGUAGE: 'language',
  DESKTOP_ICONS: 'fnos_desktop_icon_positions_v1',
};

// ==================== 资产状态 ====================
export const ASSET_STATUS = {
  IN_USE: '在用',
  IDLE: '闲置',
  MAINTENANCE: '维修',
  SCRAPPED: '报废',
  TRANSFERRING: '调配中',
};

export const ASSET_STATUS_COLORS = {
  '在用': 'green',
  '闲置': 'orange',
  '维修': 'red',
  '报废': 'default',
  '调配中': 'blue',
};

// ==================== 用户角色 ====================
// 角色字典已迁移到 utils/roleUtils.js (ROLE_DISPLAY_NAMES + ALL_SYSTEM_ROLES)
// 这里不再维护 — 避免与权威源冲突 + 命名漂移

// ==================== 用户角色 ====================
// 角色字典已迁移到 utils/roleUtils.js (ROLE_DISPLAY_NAMES + ALL_SYSTEM_ROLES)
// 这里不再维护 — 避免与权威源冲突 + 命名漂移

// ==================== 时间格式 ====================
export const DATE_FORMAT = {
  DATE: 'YYYY-MM-DD',
  TIME: 'HH:mm:ss',
  DATETIME: 'YYYY-MM-DD HH:mm:ss',
  DATETIME_COMPACT: 'YYYYMMDDHHmmss',
};

export const DAYJS_FORMAT = {
  DATE: 'YYYY-MM-DD',
  DATETIME: 'YYYY-MM-DD HH:mm:ss',
  TIME: 'HH:mm:ss',
  MONTH: 'YYYY-MM',
  YEAR: 'YYYY',
};

// ==================== 文件上传 ====================
export const FILE_UPLOAD = {
  MAX_SIZE: 10 * 1024 * 1024,  // 10MB
  ALLOWED_TYPES: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
};

// ==================== 缓存配置 ====================
export const CACHE_KEYS = {
  USER_MENUS: 'user_menus',
  TENANT_CONFIG: 'tenant_config',
  DEPARTMENTS: 'departments',
};

// ==================== 组件配置 ====================
export const COMPONENT_CONFIG = {
  // 图片画廊
  IMAGE_GALLERY: {
    PREVIEW_WIDTH: 800,
    PREVIEW_HEIGHT: 600,
    THUMB_SIZE: 100,
  },
  // 表格
  TABLE: {
    SCROLL_WIDTH: 1200,
    SCROLL_HEIGHT: 400,
  },
};

// ==================== 验证规则 ====================
export const VALIDATION_RULES = {
  ASSET_CODE: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 100,
    PATTERN: /^[A-Za-z0-9-_]+$/,
  },
  PHONE: {
    PATTERN: /^1[3-9]\d{9}$/,
  },
  EMAIL: {
    PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },
};

// ==================== 错误消息 ====================
export const ERROR_MESSAGES = {
  NETWORK_ERROR: '网络连接失败，请检查网络设置',
  TIMEOUT_ERROR: '请求超时，请稍后重试',
  AUTH_ERROR: '认证失败，请重新登录',
  PERMISSION_ERROR: '您没有权限执行此操作',
  VALIDATION_ERROR: '数据验证失败，请检查输入',
  SERVER_ERROR: '服务器错误，请联系技术支持',
  NOT_FOUND: '请求的资源不存在',
};

// ==================== 成功消息 ====================
export const SUCCESS_MESSAGES = {
  SAVE_SUCCESS: '保存成功',
  DELETE_SUCCESS: '删除成功',
  UPDATE_SUCCESS: '更新成功',
  CREATE_SUCCESS: '创建成功',
  UPLOAD_SUCCESS: '上传成功',
  SUBMIT_SUCCESS: '提交成功',
};
