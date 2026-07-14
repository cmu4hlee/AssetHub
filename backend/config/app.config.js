/**
 * 系统统一配置文件
 * 用于管理数据库、服务器、网络访问等所有配置
 * 支持通过环境变量覆盖配置值
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const CONFIG_BOOT_LOG_ENABLED = process.env.CONFIG_BOOT_LOG_ENABLED === 'true';
const configBootLog = (...args) => {
  if (CONFIG_BOOT_LOG_ENABLED) {
    console.log(...args);
  }
};

// 调试：按需打印环境变量
configBootLog('app.config.js 环境变量:');
configBootLog('DB_HOST:', process.env.DB_HOST);
configBootLog('DB_PASSWORD:', process.env.DB_PASSWORD ? '***' : '空');
configBootLog('DB_NAME:', process.env.DB_NAME);

// ============================================
// 环境配置
// ============================================
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';
const isDevelopment = NODE_ENV === 'development';

const parseCsv = value =>
  String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

const ERROR_CODES = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_ERROR: 500,
  UNAUTHORIZED_CODE: 1001,
  VALIDATION_ERROR_CODE: 1002,
  FORBIDDEN_CODE: 1003,
  NOT_FOUND_CODE: 1004,
  INTERNAL_ERROR_CODE: 1500,
};

// ============================================
// 数据库配置
// ============================================
const databaseConfig = {
  // 主数据库配置（用于写操作）
  master: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'zcgl',
    // 连接池配置
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 20,
    queueLimit: parseInt(process.env.DB_QUEUE_LIMIT) || 0,
    // 启动时需同步加载上万个模块 + 大量路由 require，事件循环会被阻塞十几到几十秒，
    // 导致首个连接的握手回调无法及时触发而误报 connect ETIMEDOUT（并连带跳过启动迁移）。
    // 提到 60s 留足余量（本地握手 1ms 即可完成，只要阻塞结束就立即成功，不会真等到 60s）。
    connectTimeout: parseInt(process.env.DB_CONNECT_TIMEOUT) || 60000,
    // 连接保持配置
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT) || 60000, // 空闲连接超时(ms)，60s 后回收
    // ⚠️ maxIdle 是「保留的最大空闲连接数量」(个数，非毫秒)。原值 60000 是把它误当成时间，
    // 会导致空闲连接不按数量回收、长期堆积。改为 10 让连接池及时收缩空闲连接。
    maxIdle: parseInt(process.env.DB_MAX_IDLE) || 10,
    // 字符集和时区
    charset: 'utf8mb4',
    timezone: '+08:00',
  },
  // 从数据库配置（用于读操作）
  slave: {
    host: process.env.DB_SLAVE_HOST || process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_SLAVE_PORT) || parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_SLAVE_USER || process.env.DB_USER || 'root',
    password: process.env.DB_SLAVE_PASSWORD || process.env.DB_PASSWORD || '',
    database: process.env.DB_SLAVE_NAME || process.env.DB_NAME || 'zcgl',
    // 连接池配置：读写分离默认关闭(readWriteSplit.enabled=false)，从库池几乎不承载查询，
    // 原默认 50 会与主库池叠加逼近 MySQL max_connections(默认 151)。降到 15 留足余量。
    connectionLimit: parseInt(process.env.DB_SLAVE_CONNECTION_LIMIT) || 15,
    queueLimit: parseInt(process.env.DB_SLAVE_QUEUE_LIMIT) || 0,
    connectTimeout: parseInt(process.env.DB_SLAVE_CONNECT_TIMEOUT) || 60000, // 同主库：避开启动期事件循环阻塞
    // 连接保持配置
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    idleTimeout: parseInt(process.env.DB_SLAVE_IDLE_TIMEOUT) || 60000, // 空闲连接超时(ms)，60s 后回收
    // maxIdle 为空闲连接数量上限(个数，非毫秒)。原值 60000 系误用，改为 5。
    maxIdle: parseInt(process.env.DB_SLAVE_MAX_IDLE) || 5,
    // 字符集和时区
    charset: 'utf8mb4',
    timezone: '+08:00',
  },
  // 读写分离配置
  readWriteSplit: {
    enabled: process.env.DB_READ_WRITE_SPLIT === 'true' || false,
    // 读操作路由规则：true表示使用从库，false表示使用主库
    useSlaveForReads: process.env.DB_USE_SLAVE_FOR_READS === 'true' || true,
    // 强制使用主库的SQL关键字列表
    forceMasterKeywords: ['INSERT', 'UPDATE', 'DELETE', 'ALTER', 'DROP', 'CREATE', 'TRUNCATE'],
  },
};

// ============================================
// 服务器配置
// ============================================
let backendPort;
let frontendPort;
let frontendUrl;
try {
  const portConfigPath = path.resolve(__dirname, '../../shared/port-config.js');
  const { getBackendPort, getFrontendPort, getFrontendUrl } = require(portConfigPath);
  backendPort = parseInt(process.env.PORT) || getBackendPort();
  frontendPort = parseInt(process.env.FRONTEND_PORT) || getFrontendPort();
  frontendUrl = process.env.FRONTEND_URL || getFrontendUrl();
} catch (error) {
  console.warn('⚠️  无法加载统一端口配置,使用默认值');
  backendPort = parseInt(process.env.PORT) || 5174;
  frontendPort = parseInt(process.env.FRONTEND_PORT) || 13579;
  frontendUrl = process.env.FRONTEND_URL || 'http://localhost:13579';
}

let frontendDomain = process.env.FRONTEND_DOMAIN;
if (!frontendDomain) {
  try {
    frontendDomain = new URL(frontendUrl).hostname;
  } catch (error) {
    frontendDomain = '';
  }
}

const serverConfig = {
  // 服务器端口(通过统一配置文件获取)
  port: backendPort,
  // 服务器主机（0.0.0.0 表示监听所有网络接口）
  host: process.env.SERVER_HOST || '0.0.0.0',
  // 服务器环境
  env: NODE_ENV,
  // 是否启用 HTTPS
  https: process.env.HTTPS === 'true' || false,
  // HTTPS 证书路径（如果启用 HTTPS）
  sslCert: process.env.SSL_CERT || null,
  sslKey: process.env.SSL_KEY || null,
};

// ============================================
// 前端配置
// ============================================
const frontendConfig = {
  // 前端访问地址
  url: frontendUrl,
  // 前端域名（用于 CORS 等）
  domain: frontendDomain,
  // 前端端口
  port: frontendPort,
};

// ============================================
// 外网访问配置
// ============================================
const networkConfig = {
  // 允许访问的外网 IP 列表（空数组表示允许所有 IP）
  // 格式: ['192.168.1.100', '10.0.0.0/8']
  allowedIPs: process.env.ALLOWED_IPS ? process.env.ALLOWED_IPS.split(',') : [],

  // 允许访问的域名列表（空数组表示允许所有域名）
  // 格式: ['example.com', '*.example.com']
  allowedDomains: process.env.ALLOWED_DOMAINS ? process.env.ALLOWED_DOMAINS.split(',') : [],

  // 是否启用 IP 白名单检查
  enableIPWhitelist: process.env.ENABLE_IP_WHITELIST === 'true' || false,

  // 是否启用域名白名单检查
  enableDomainWhitelist: process.env.ENABLE_DOMAIN_WHITELIST === 'true' || false,

  // 信任的代理（用于获取真实客户端 IP）
  // 如果使用 Nginx 等反向代理，需要设置此项
  trustProxy: process.env.TRUST_PROXY === 'true' || false,
  trustProxyIPs: process.env.TRUST_PROXY_IPS ? process.env.TRUST_PROXY_IPS.split(',') : [],
};

// ============================================
// CORS 配置
// ============================================
const resolveCorsOrigins = () => {
  // 显式配置的最高优先级
  if (process.env.CORS_ORIGIN) {
    const items = process.env.CORS_ORIGIN.split(',').map(s => s.trim()).filter(Boolean);
    if (items.length > 0) return items;
  }
  // 生产环境：兜底使用 frontend url，避免出现 localhost 跨域问题
  if (isProduction) {
    const feUrl = process.env.FRONTEND_URL || '';
    if (feUrl) {
      try {
        const u = new URL(feUrl);
        return [`${u.protocol}//${u.host}`];
      } catch (_e) { /* ignore */ }
    }
    // 没有任何外部域名时，强制开发默认值（防止静默通过跨域请求）
    console.warn('⚠️  生产环境未配置 CORS_ORIGIN / FRONTEND_URL，将仅允许默认开发源，请尽快配置。');
    return ['http://localhost:13579', 'http://127.0.0.1:13579'];
  }
  // 开发环境：默认允许 dev 端口
  const fePort = process.env.FRONTEND_PORT || '13579';
  return [
    'http://localhost:13579',
    'http://127.0.0.1:13579',
    `http://localhost:${fePort}`,
    `http://127.0.0.1:${fePort}`,
  ];
};

const corsConfig = {
  // 允许的源（生产环境必须通过环境变量配置）
  origin: resolveCorsOrigins(),
  // 允许的 HTTP 方法
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  // 允许的请求头
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Tenant-ID'],
  // 是否允许携带凭证
  credentials: process.env.CORS_CREDENTIALS !== 'false',
  // 预检请求缓存时间（秒）
  maxAge: parseInt(process.env.CORS_MAX_AGE) || 86400, // 24小时
};

// ============================================
// 文件上传配置
// ============================================
const uploadConfig = {
  // 上传文件存储目录
  uploadDir: process.env.UPLOAD_DIR || path.join(__dirname, '../uploads'),
  // 最大文件大小（字节）
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
  // 允许的文件类型
  allowedMimeTypes: process.env.ALLOWED_MIME_TYPES
    ? process.env.ALLOWED_MIME_TYPES.split(',')
    : [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ],
  // 是否启用文件类型检查
  enableMimeTypeCheck: process.env.ENABLE_MIME_TYPE_CHECK !== 'false',
};

// ============================================
// JWT 配置
// ============================================
const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (isProduction) {
      throw new Error('FATAL: 生产环境必须设置 JWT_SECRET 环境变量');
    }
    console.warn('⚠️  警告: 使用默认JWT密钥，请勿在生产环境使用');
    return 'development-secret-key-do-not-use-in-production';
  }
  if (secret === 'development-secret-key-change-in-production') {
    if (isProduction) {
      throw new Error('FATAL: JWT_SECRET 不能使用默认开发密钥，请设置强随机密钥');
    }
    console.warn('⚠️  警告: 使用默认JWT开发密钥');
  }
  return secret;
};

const jwtConfig = {
  // JWT 密钥（生产环境必须设置）
  secret: getJwtSecret(),
  // Token 过期时间（秒）
  expiresIn: parseInt(process.env.JWT_EXPIRES_IN) || 1 * 24 * 60 * 60, // 1天
  // Token 刷新时间（秒）
  refreshExpiresIn: parseInt(process.env.JWT_REFRESH_EXPIRES_IN) || 7 * 24 * 60 * 60, // 7天
};

// ============================================
// 日志配置
// ============================================
const logConfig = {
  // 日志级别: 'error', 'warn', 'info', 'debug'
  level: process.env.LOG_LEVEL || (isProduction ? 'warn' : 'debug'),
  // 日志文件目录
  logDir: process.env.LOG_DIR || path.join(__dirname, '../logs'),
  // 是否启用文件日志
  enableFileLog: process.env.ENABLE_FILE_LOG === 'true' || isProduction,
  // 是否启用控制台日志
  enableConsoleLog: process.env.ENABLE_CONSOLE_LOG !== 'false',
  // 日志文件最大大小（字节）
  maxLogFileSize: parseInt(process.env.MAX_LOG_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
  // 保留的日志文件数量
  maxLogFiles: parseInt(process.env.MAX_LOG_FILES) || 10,
};

// ============================================
// 备份配置
// ============================================
const backupConfig = {
  // 备份文件存储目录
  backupDir: process.env.BACKUP_DIR || path.join(__dirname, '../backups'),
  // 自动备份间隔（小时，0 表示禁用自动备份）
  autoBackupInterval: parseInt(process.env.AUTO_BACKUP_INTERVAL) || 0,
  // 保留的备份文件数量
  maxBackupFiles: parseInt(process.env.MAX_BACKUP_FILES) || 30,
  // 备份文件压缩
  compressBackup: process.env.COMPRESS_BACKUP !== 'false',
};

// ============================================
// StatsD 配置（仪表盘指标可选上报）
// ============================================
const statsdConfig = {
  enabled: process.env.STATSD_ENABLED === 'true' || false,
  host: process.env.STATSD_HOST || '127.0.0.1',
  port: parseInt(process.env.STATSD_PORT) || 8125,
  prefix: process.env.STATSD_PREFIX || 'assethub',
};

// ============================================
// MiniMax AI 配置（用于图像识别）
// ============================================
const minimaxConfig = {
  // API 密钥（从 MiniMax 开放平台获取）
  apiKey: process.env.MINIMAX_API_KEY || '',
  // API 基础地址
  apiBaseUrl: process.env.MINIMAX_API_BASE_URL || 'https://api.minimax.io',
  // 使用的模型（支持多模态的模型）
  model: process.env.MINIMAX_MODEL || 'MiniMax-M3',
  // 请求超时时间（毫秒）
  timeout: parseInt(process.env.MINIMAX_TIMEOUT) || 180000,
  // 是否启用 MiniMax（false 时使用本地 LM Studio）
  enabled: process.env.MINIMAX_ENABLED === 'true' || false,
};

// ============================================
// Redis配置
// ============================================
const redisConfig = {
  // Redis主机地址
  host: process.env.REDIS_HOST || 'localhost',
  // Redis端口
  port: parseInt(process.env.REDIS_PORT) || 6379,
  // Redis密码
  password: process.env.REDIS_PASSWORD || '',
  // Redis数据库编号
  db: parseInt(process.env.REDIS_DB) || 0,
  // 连接超时时间（毫秒）
  connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT) || 5000,
  // 最大连接数
  maxConnections: parseInt(process.env.REDIS_MAX_CONNECTIONS) || 10,
  // 启用缓存
  enabled: false,
  // 缓存默认过期时间（秒）
  defaultExpire: parseInt(process.env.REDIS_DEFAULT_EXPIRE) || 3600,
};

// ============================================
// 授权与角色访问矩阵配置
// ============================================
const defaultSystemAdminScopes = ['tenants.read', 'tenants.update'];
const envSystemAdminScopes = parseCsv(process.env.SYSTEM_ADMIN_ALLOWED_SCOPES);

const authorizationConfig = {
  roleAccessMatrix: {
    super_admin: {
      allowAll: true,
      allowedScopes: ['*'],
    },
    system_admin: {
      allowAll: false,
      allowedScopes:
        envSystemAdminScopes.length > 0 ? envSystemAdminScopes : defaultSystemAdminScopes,
    },
  },
};

// ============================================
// 导出统一配置对象
// ============================================
const config = {
  env: {
    NODE_ENV,
    isProduction,
    isDevelopment,
  },
  database: databaseConfig,
  server: serverConfig,
  frontend: frontendConfig,
  network: networkConfig,
  cors: corsConfig,
  upload: uploadConfig,
  jwt: jwtConfig,
  log: logConfig,
  backup: backupConfig,
  statsd: statsdConfig,
  redis: redisConfig,
  authorization: authorizationConfig,
  minimax: minimaxConfig,
};

// ============================================
// 配置验证
// ============================================
function validateConfig() {
  const errors = [];

  // 生产环境必须配置数据库密码
  if (isProduction && !process.env.DB_PASSWORD) {
    errors.push('⚠️  生产环境建议通过环境变量设置数据库密码');
  }

  // 验证数据库配置
  if (!databaseConfig.master.host || !databaseConfig.master.database) {
    errors.push('❌ 数据库配置不完整');
  }

  // 验证服务器配置
  if (!serverConfig.port || serverConfig.port < 1 || serverConfig.port > 65535) {
    errors.push('❌ 服务器端口配置无效');
  }

  if (errors.length > 0) {
    console.warn('配置验证警告:');
    errors.forEach(error => console.warn(error));
  }

  return errors.length === 0;
}

// 启动时验证配置
if (require.main === module) {
  validateConfig();
  configBootLog('✅ 配置加载完成');
  configBootLog('📋 当前配置:');
  configBootLog(`   环境: ${config.env.NODE_ENV}`);
  configBootLog(`   服务器端口: ${config.server.port}`);
  configBootLog(
    `   数据库: ${config.database.master.host}:${config.database.master.port}/${config.database.master.database}`
  );
  configBootLog(`   Redis: ${config.redis.host}:${config.redis.port}/${config.redis.db}`);
  configBootLog(`   前端地址: ${config.frontend.url}`);
}

module.exports = {
  ...config,
  CORS: corsConfig,
  ERROR_CODES,
  validateConfig,
};
