/**
 * 安全配置
 * 定义系统的安全策略和参数
 */

module.exports = {
  // JWT安全配置
  jwt: {
    // 强制要求生产环境设置安全的JWT密钥
    requireSecureSecret: true,
    // Token过期时间（秒）
    defaultExpiresIn: 24 * 60 * 60, // 24小时
    // 刷新Token过期时间（秒）
    refreshExpiresIn: 7 * 24 * 60 * 60, // 7天
    // 算法
    algorithm: 'HS256',
  },

  // 认证安全配置
  auth: {
    // 是否禁用默认测试用户
    disableDefaultTestUser: true,
    // 是否强制要求认证
    requireAuthentication: true,
    // 数据库错误时的行为
    dbErrorBehavior: 'DENY_ACCESS', // DENY_ACCESS | ALLOW_DEFAULT_ADMIN
    // 密码最小长度
    minPasswordLength: 8,
    // 密码复杂度要求
    passwordComplexity: {
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
    },
  },

  // 租户隔离配置
  tenant: {
    // 是否强制租户隔离
    enforceTenantIsolation: true,
    // 租户ID验证
    validateTenantId: true,
    // 租户ID格式验证
    tenantIdPattern: /^\d+$/,
    // 是否允许动态租户切换
    allowDynamicTenantSwitch: false,
    // 超级管理员动态租户切换
    superAdminDynamicSwitch: true,
  },

  // 访问控制配置
  access: {
    // IP白名单
    ipWhitelist: {
      enabled: false, // 默认禁用IP白名单，由环境变量控制启用
      defaultAllow: true, // 默认允许所有IP
      allowedIPs: [], // 由环境变量配置
    },
    // 域名白名单
    domainWhitelist: {
      enabled: false, // 默认禁用域名白名单，由环境变量控制启用
      defaultAllow: true,
      allowedDomains: [], // 由环境变量配置
    },
    // CORS配置
    cors: {
      enabled: true,
      allowedOrigins: [], // 由环境变量配置
      allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      credentials: true,
      maxAge: 86400,
    },
  },

  // 频率限制配置
  rateLimit: {
    // 用户级别限制
    byUser: {
      enabled: true,
      maxRequests: 100, // 每15分钟最多100次请求
      windowMs: 15 * 60 * 1000, // 15分钟
    },
    // IP级别限制
    byIP: {
      enabled: true,
      maxRequests: 1000, // 每小时最多1000次请求
      windowMs: 60 * 60 * 1000, // 1小时
    },
    // 登录尝试限制
    loginAttempts: {
      enabled: true,
      maxAttempts: 5, // 最多5次失败尝试
      windowMs: 15 * 60 * 1000, // 15分钟
      lockoutDuration: 30 * 60 * 1000, // 锁定30分钟
    },
  },

  // 文件上传安全配置
  upload: {
    // 最大文件大小（字节）
    maxFileSize: 10 * 1024 * 1024, // 10MB
    // 允许的文件类型
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ],
    // 是否启用文件类型检查
    enableMimeTypeCheck: true,
    // 是否启用文件名清理
    sanitizeFilename: true,
    // 是否扫描病毒（需要集成杀毒软件）
    enableVirusScan: false,
  },

  // 日志和安全审计配置
  security: {
    // 安全事件日志
    securityEvents: {
      enabled: true,
      logLevel: 'info', // error | warn | info | debug
      includeUserAgent: true,
      includeIP: true,
    },
    // 审计日志
    auditLog: {
      enabled: true,
      logAllRequests: false, // 只记录重要操作
      logAuthAttempts: true,
      logPermissionDenials: true,
      logDataAccess: true,
    },
    // 异常检测
    anomalyDetection: {
      enabled: true,
      unusualLoginPatterns: true,
      excessiveRequests: true,
      offHoursAccess: true,
    },
  },

  // 数据库安全配置
  database: {
    // 连接池配置
    pool: {
      minConnections: 5,
      maxConnections: 20,
      acquireTimeout: 60000,
      createTimeout: 30000,
      destroyTimeout: 5000,
      idleTimeout: 30000,
      reapInterval: 1000,
      createRetryInterval: 100,
    },
    // 查询安全
    querySecurity: {
      enableSQLInjectionProtection: true,
      enableParameterValidation: true,
      maxQueryLength: 10000,
    },
  },

  // 缓存安全配置
  cache: {
    // Redis配置
    redis: {
      enabled: true,
      host: 'localhost',
      port: 6379,
      password: '', // 应该从环境变量获取
      db: 0,
      keyPrefix: 'assetmgmt:',
      ttl: 3600, // 默认TTL 1小时
    },
    // 缓存安全
    security: {
      encryptSensitiveData: true,
      validateCacheKeys: true,
      maxCacheSize: 1000, // MB
    },
  },

  // 环境特定配置
  environment: {
    development: {
      security: {
        strictMode: false,
        enableDebugLogs: true,
        allowTestUsers: false, // 即使在开发环境也不允许测试用户
      },
    },
    production: {
      security: {
        strictMode: true,
        enableDebugLogs: false,
        requireHTTPS: true,
        secureCookies: true,
      },
    },
  },
};
