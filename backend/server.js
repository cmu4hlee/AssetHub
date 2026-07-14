const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
require('dotenv').config();
const logger = require('./config/logger');
const smsEnvPath = require('path').resolve(__dirname, '.env.sms');
if (require('fs').existsSync(smsEnvPath)) {
  require('dotenv').config({ path: smsEnvPath, override: true });
  logger.info('短信配置已加载 (.env.sms)');
}

// 加载统一端口配置
const portConfigPath = path.resolve(__dirname, '../shared/port-config.js');
let portConfig;
try {
  portConfig = require(portConfigPath);
  logger.info('统一端口配置已加载');
} catch (error) {
  logger.warn('无法加载统一端口配置,使用环境变量');
  portConfig = {
    getBackendPort: () => parseInt(process.env.PORT) || 5174,
    validatePortConfig: () => {},
  };
}

// 调试：打印环境变量（隐藏敏感信息）
logger.debug('Server启动时的环境变量:');
logger.debug('DB_HOST:', process.env.DB_HOST);
logger.debug('DB_PORT:', process.env.DB_PORT);
logger.debug('DB_USER:', process.env.DB_USER ? '***' : '(未设置)');
logger.debug('DB_NAME:', process.env.DB_NAME);

const db = require('./config/database');
const config = require('./config/app.config');
const { highRiskActionGate } = require('./middleware/high-risk-action-gate');
const { apiLimiter, loginLimiter, registerLimiter } = require('./middleware/rate-limit');

// 数据库租户过滤守卫（非生产环境自动检测缺失 tenant_id 的查询）
const { wrapDatabase } = require('./middleware/db-tenant-guard');
wrapDatabase(db);

logger.debug('Server启动时的配置:');
logger.debug('config.database.master.host:', config.database.master.host);
logger.debug('config.database.master.port:', config.database.master.port);
logger.debug('config.database.master.user:', config.database.master.user ? '***' : '(未设置)');
logger.debug('config.database.master.database:', config.database.master.database);

// 优雅降级的Redis缓存服务
let cacheService;
let redis; // 保存到全局作用域

try {
  // 尝试加载Redis服务
  const { redis: redisClient, cacheService: realCacheService } = require('./services/redis');
  redis = redisClient;
  cacheService = realCacheService;
  logger.info('Redis服务已加载，将使用真实缓存');
} catch (error) {
  logger.warn('Redis服务加载失败，使用模拟缓存服务:', error.message);
  // 创建模拟缓存服务，所有操作都返回失败或null
  cacheService = {
    set: async () => false,
    get: async () => null,
    delete: async () => false,
    flushAll: async () => false,
    hset: async () => false,
    hget: async () => null,
    cache() {
      return function (target, propertyKey, descriptor) {
        return descriptor; // 不修改原始方法
      };
    },
    deleteByTags: async () => false,
    addDependency: async () => false,
    getDependencies: async () => [],
    removeDependency: async () => false,
    warmup: async () => ({ success: 0, failed: 0 }),
    refresh: async () => ({ success: 0, failed: 0 }),
  };
}

// ============================================
// 加载异步任务队列服务
// ============================================
let asyncQueueService;
let defaultQueue;

try {
  // 尝试加载异步任务队列服务
  const { defaultQueue: queue } = require('./services/async-queue');
  defaultQueue = queue;
  asyncQueueService = {
    defaultQueue,
    // 注册默认任务处理器示例
    registerHandler: (taskType, handler) => {
      defaultQueue.registerHandler(taskType, handler);
    },
    // 添加任务到默认队列
    addTask: (taskType, data, options) => {
      return defaultQueue.addTask(taskType, data, options);
    },
    // 获取队列长度
    getQueueLength: () => {
      return defaultQueue.getQueueLength();
    },
  };
  logger.info('异步任务队列服务已加载');
} catch (error) {
  logger.warn('异步任务队列服务加载失败:', error.message);
  // 创建模拟异步任务队列服务
  asyncQueueService = {
    defaultQueue: null,
    registerHandler: () => {},
    addTask: async () => `task:${Date.now()}`,
    getQueueLength: async () => 0,
  };
}

// ============================================
// 初始化数据库表结构
// ============================================
async function initDatabase() {
  try {
    logger.info('开始初始化数据库表结构...');

    // 检查 departments 表是否有 status 列，缺失则自动添加
    try {
      const conn = await db.getConnection();
      const [cols] = await conn.execute(
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'departments' AND COLUMN_NAME = 'status'",
      );
      if (cols.length === 0) {
        logger.warn('departments 表缺少 status 列，正在自动添加...');
        await conn.execute(
          "ALTER TABLE departments ADD COLUMN status VARCHAR(20) DEFAULT 'active' COMMENT '部门状态：active-启用，inactive-停用'",
        );
        logger.info('departments.status 列添加成功');
      }
      conn.release();
    } catch (migrateErr) {
      logger.warn('departments 表 status 列检查/迁移跳过:', migrateErr.message);
    }

    // 检查 maintenance_requests 表是否有 request_person_id / repair_person_id 列，缺失则自动添加
    // 这两个字段用于维修申请通知（飞书/WebSocket）精准送达申请人、维修工程师
    try {
      const conn = await db.getConnection();
      const [personIdCols] = await conn.execute(
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'maintenance_requests' AND COLUMN_NAME IN ('request_person_id', 'repair_person_id')",
      );
      const existingCols = personIdCols.map(r => r.COLUMN_NAME);
      if (!existingCols.includes('request_person_id')) {
        logger.warn('maintenance_requests 表缺少 request_person_id 列，正在自动添加...');
        await conn.execute(
          'ALTER TABLE maintenance_requests ADD COLUMN request_person_id INT NULL COMMENT \'申请人用户ID\' AFTER request_person',
        );
        logger.info('maintenance_requests.request_person_id 列添加成功');
      }
      if (!existingCols.includes('repair_person_id')) {
        logger.warn('maintenance_requests 表缺少 repair_person_id 列，正在自动添加...');
        await conn.execute(
          'ALTER TABLE maintenance_requests ADD COLUMN repair_person_id INT NULL COMMENT \'维修人员用户ID\' AFTER repair_person',
        );
        logger.info('maintenance_requests.repair_person_id 列添加成功');
      }
      conn.release();
    } catch (migrateErr) {
      logger.warn('maintenance_requests 表 person_id 列检查/迁移跳过:', migrateErr.message);
    }

    // 确保 metrology_record_sequence 表有 tenant_id 列（租户隔离）
    try {
      const conn = await db.getConnection();
      const [seqCols] = await conn.execute(
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'metrology_record_sequence' AND COLUMN_NAME = 'tenant_id'",
      );
      if (seqCols.length === 0) {
        logger.warn('metrology_record_sequence 表缺少 tenant_id 列，正在自动添加...');
        await conn.execute(
          "ALTER TABLE metrology_record_sequence ADD COLUMN tenant_id INT NOT NULL DEFAULT 0 COMMENT '租户ID' AFTER date_key",
        );
        // 重建唯一索引以包含 tenant_id
        try {
          await conn.execute("ALTER TABLE metrology_record_sequence DROP INDEX uk_date_key");
        } catch (_) { /* 索引可能不存在 */ }
        await conn.execute(
          "ALTER TABLE metrology_record_sequence ADD UNIQUE INDEX uk_date_tenant (date_key, tenant_id)",
        );
        logger.info('metrology_record_sequence.tenant_id 列及联合唯一索引添加成功');
      }
      conn.release();
    } catch (migrateErr) {
      logger.warn('metrology_record_sequence 表迁移跳过:', migrateErr.message);
    }

    // 确保 qc_record_sequence 表有 tenant_id 列（租户隔离）
    try {
      const conn = await db.getConnection();
      const [qcCols] = await conn.execute(
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'qc_record_sequence' AND COLUMN_NAME = 'tenant_id'",
      );
      if (qcCols.length === 0) {
        logger.warn('qc_record_sequence 表缺少 tenant_id 列，正在自动添加...');
        await conn.execute(
          "ALTER TABLE qc_record_sequence ADD COLUMN tenant_id INT NOT NULL DEFAULT 0 COMMENT '租户ID' AFTER date_key",
        );
        try {
          await conn.execute("ALTER TABLE qc_record_sequence DROP INDEX uk_date_key");
        } catch (_) { /* 索引可能不存在 */ }
        await conn.execute(
          "ALTER TABLE qc_record_sequence ADD UNIQUE INDEX uk_date_tenant (date_key, tenant_id)",
        );
        logger.info('qc_record_sequence.tenant_id 列及联合唯一索引添加成功');
      }
      conn.release();
    } catch (migrateErr) {
      logger.warn('qc_record_sequence 表迁移跳过:', migrateErr.message);
    }

    // 确保子表有 tenant_id 列（租户隔离防御纵深）
    // 虽然通过父表已做租户校验，但有 tenant_id 列为写入/查询提供额外防线
    const childTables = [
      { table: 'work_order_materials', afterCol: 'work_order_id' },
      { table: 'work_order_history', afterCol: 'work_order_id' },
      { table: 'maintenance_usage_triggered', afterCol: 'id' },
    ];
    for (const ct of childTables) {
      try {
        const conn = await db.getConnection();
        const [cols] = await conn.execute(
          `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'tenant_id'`,
          [ct.table],
        );
        if (cols.length === 0) {
          logger.warn(`${ct.table} 表缺少 tenant_id 列，正在自动添加...`);
          await conn.execute(
            `ALTER TABLE ${ct.table} ADD COLUMN tenant_id INT NOT NULL DEFAULT 0 COMMENT '租户ID' AFTER ${ct.afterCol}`,
          );
          logger.info(`${ct.table}.tenant_id 列添加成功`);
        }
        conn.release();
      } catch (migrateErr) {
        logger.warn(`${ct.table} 表迁移跳过:`, migrateErr.message);
      }
    }

    // 确保 public_page_views 表有 tenant_id 列（租户隔离）
    try {
      const conn = await db.getConnection();
      const [pvCols] = await conn.execute(
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'public_page_views' AND COLUMN_NAME = 'tenant_id'",
      );
      if (pvCols.length === 0) {
        logger.warn('public_page_views 表缺少 tenant_id 列，正在自动添加...');
        await conn.execute(
          "ALTER TABLE public_page_views ADD COLUMN tenant_id INT NOT NULL DEFAULT 0 COMMENT '租户ID' FIRST",
        );
        logger.info('public_page_views.tenant_id 列添加成功');
      }
      conn.release();
    } catch (migrateErr) {
      logger.warn('public_page_views 表迁移跳过:', migrateErr.message);
    }

    // 确保 audit_logs 表存在（审计日志核心表）
    try {
      const conn = await db.getConnection();
      const [auditTable] = await conn.execute(
        "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'audit_logs'",
      );
      if (auditTable.length === 0) {
        logger.warn('audit_logs 表不存在，正在自动创建...');
        await conn.execute(`CREATE TABLE IF NOT EXISTS audit_logs (
          id INT NOT NULL AUTO_INCREMENT,
          tenant_id INT DEFAULT NULL,
          user_id INT DEFAULT NULL COMMENT '用户ID',
          username VARCHAR(50) DEFAULT NULL COMMENT '用户名',
          real_name VARCHAR(50) DEFAULT NULL COMMENT '真实姓名',
          role VARCHAR(50) DEFAULT NULL COMMENT '用户角色',
          action_type VARCHAR(50) NOT NULL COMMENT '操作类型',
          module VARCHAR(50) NOT NULL COMMENT '操作模块',
          resource_type VARCHAR(50) DEFAULT NULL COMMENT '资源类型',
          resource_id INT DEFAULT NULL COMMENT '资源ID',
          resource_name VARCHAR(200) DEFAULT NULL COMMENT '资源名称',
          action_description TEXT COMMENT '操作描述',
          old_value TEXT COMMENT '修改前的值(JSON)',
          new_value TEXT COMMENT '修改后的值(JSON)',
          ip_address VARCHAR(50) DEFAULT NULL COMMENT 'IP地址',
          user_agent TEXT COMMENT '浏览器User Agent',
          request_method VARCHAR(10) DEFAULT NULL COMMENT 'HTTP方法',
          request_path VARCHAR(500) DEFAULT NULL COMMENT '请求路径',
          request_params TEXT COMMENT '请求参数(JSON)',
          response_status INT DEFAULT NULL COMMENT '响应状态码',
          error_message TEXT COMMENT '错误信息',
          execution_time INT DEFAULT NULL COMMENT '执行时间(毫秒)',
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
          PRIMARY KEY (id),
          KEY idx_username (username),
          KEY idx_action_type (action_type),
          KEY idx_module (module),
          KEY idx_resource_type (resource_type),
          KEY idx_resource_id (resource_id),
          KEY idx_audit_logs_tenant (tenant_id),
          KEY idx_audit_logs_user (user_id),
          KEY idx_audit_logs_created (created_at),
          KEY idx_audit_logs_time_user (tenant_id, created_at, user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='操作日志表（审计）'`);
        logger.info('audit_logs 表创建成功');
      }
      conn.release();
    } catch (auditTableErr) {
      logger.warn('audit_logs 表检查/创建跳过:', auditTableErr.message);
    }

    // 确保通知配置表存在
    try {
      const conn = await db.getConnection();
      const [notificationTables] = await conn.execute(
        `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('notification_templates', 'notification_rules', 'notification_recipients', 'notification_logs')`,
      );
      const existingTables = new Set(notificationTables.map(t => t.TABLE_NAME));
      if (!existingTables.has('notification_templates')) {
        await conn.execute(`CREATE TABLE notification_templates (
          id INT PRIMARY KEY AUTO_INCREMENT,
          tenant_id INT NOT NULL DEFAULT 0 COMMENT '租户ID',
          code VARCHAR(100) NOT NULL COMMENT '模板编码',
          name VARCHAR(200) NOT NULL COMMENT '模板名称',
          channel VARCHAR(50) NOT NULL DEFAULT 'feishu' COMMENT '通知渠道: feishu/email/socket',
          title_template VARCHAR(500) NOT NULL COMMENT '标题模板',
          content_template TEXT NOT NULL COMMENT '内容模板',
          variables_json TEXT COMMENT '变量说明 JSON',
          enabled TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NULL DEFAULT NULL,
          UNIQUE KEY uk_tenant_code (tenant_id, code),
          KEY idx_tenant_channel (tenant_id, channel)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='通知模板表'`);
        logger.info('notification_templates 表创建成功');
      }
      if (!existingTables.has('notification_rules')) {
        await conn.execute(`CREATE TABLE notification_rules (
          id INT PRIMARY KEY AUTO_INCREMENT,
          tenant_id INT NOT NULL DEFAULT 0 COMMENT '租户ID',
          process_type VARCHAR(50) NOT NULL COMMENT '流程类型',
          event_code VARCHAR(100) NOT NULL COMMENT '事件编码',
          rule_name VARCHAR(200) NOT NULL COMMENT '规则名称',
          node_code VARCHAR(100) DEFAULT NULL COMMENT '流程节点编码',
          template_id INT NOT NULL COMMENT '关联模板ID',
          trigger_condition TEXT COMMENT '触发条件 JSON',
          enabled TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用',
          priority INT NOT NULL DEFAULT 0 COMMENT '优先级',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NULL DEFAULT NULL,
          KEY idx_tenant_event (tenant_id, event_code),
          KEY idx_tenant_process (tenant_id, process_type),
          KEY idx_enabled (enabled)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='通知规则表'`);
        logger.info('notification_rules 表创建成功');
      }
      if (!existingTables.has('notification_recipients')) {
        await conn.execute(`CREATE TABLE notification_recipients (
          id INT PRIMARY KEY AUTO_INCREMENT,
          rule_id INT NOT NULL COMMENT '规则ID',
          recipient_type VARCHAR(50) NOT NULL COMMENT '接收人类型: role/department/user/node',
          recipient_value TEXT COMMENT '接收人值 JSON',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          KEY idx_rule_id (rule_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='通知接收人表'`);
        logger.info('notification_recipients 表创建成功');
      }
      if (!existingTables.has('notification_logs')) {
        await conn.execute(`CREATE TABLE notification_logs (
          id INT PRIMARY KEY AUTO_INCREMENT,
          tenant_id INT NOT NULL DEFAULT 0 COMMENT '租户ID',
          rule_id INT DEFAULT NULL COMMENT '规则ID',
          event_code VARCHAR(100) DEFAULT NULL COMMENT '事件编码',
          recipients TEXT COMMENT '接收人ID列表 JSON',
          channel VARCHAR(50) DEFAULT NULL COMMENT '发送渠道',
          title VARCHAR(500) DEFAULT NULL COMMENT '发送标题',
          content TEXT COMMENT '发送内容',
          status VARCHAR(50) NOT NULL COMMENT '状态: success/failed',
          error TEXT COMMENT '错误信息',
          sent_count INT DEFAULT 0 COMMENT '成功发送数',
          total_count INT DEFAULT 0 COMMENT '总接收人数',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          KEY idx_tenant_created (tenant_id, created_at),
          KEY idx_rule_id (rule_id),
          KEY idx_event_code (event_code),
          KEY idx_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='通知发送记录表'`);
        logger.info('notification_logs 表创建成功');
      }
      conn.release();
    } catch (notificationTableErr) {
      logger.warn('通知表检查/创建跳过:', notificationTableErr.message);
    }

    logger.info('assets表所有必要字段和索引已存在');

    logger.info('数据库表结构初始化完成');
  } catch (error) {
    logger.error('数据库表结构初始化失败:', error.message);
    logger.error('这可能是因为数据库连接问题');
  }
}

// 启动数据库初始化
// 用 setImmediate 延后到当前同步启动块（上万个模块 require + 几百个路由 app.use 注册）
// 执行完毕、事件循环空闲之后，再发起进程内首次 DB 连接。
// 否则首个 TCP 握手回调会被启动期的长同步阻塞挡住，撑不到 connectTimeout 就误报 ETIMEDOUT，
// 并连带导致 initDatabase 内部的迁移检查只试一次就"跳过"。
setImmediate(() => {
  initDatabase();
});

// ============================================
// 全局错误处理 - 严重错误时退出进程，让 nodemon/PM2 重启以恢复干净状态
// （继续运行只会让进程处于半残状态：Express router 加载失败但 HTTP server 还在跑，所有路由 404）
// ============================================
function flushAndExit(reason) {
  // 给 logger 一个 100ms 窗口把 buffer flush 到磁盘，再退出
  setTimeout(() => process.exit(1), 100);
}

process.on('uncaughtException', error => {
  logger.error('未捕获的异常:', error);
  logger.error('错误堆栈:', error.stack);
  flushAndExit('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('未处理的 Promise 拒绝:', reason);
  logger.error('Promise:', promise);
  flushAndExit('unhandledRejection');
});

// ============================================
// 配置multer中间件
// ============================================
const storage = multer.memoryStorage();
const upload = multer({ storage });

const app = express();

// Socket.IO 实时推送服务
const { initSocket: initSocketIO, getConnectionCount: getSocketConnectionCount } = require('./core/socket');

// ============================================
// 中间件
// ============================================
const _fePort = config.frontend.port || 13579;
const devOrigins = [
  'http://localhost:13579',
  'http://127.0.0.1:13579',
  `http://localhost:${_fePort}`,
  `http://127.0.0.1:${_fePort}`,
];

// 生产环境允许的 Origin 列表（合并 CORS_ORIGIN + FRONTEND_URL，支持配置同源反代场景）
const resolveProdOrigins = () => {
  const raw = config.cors.origin;
  const list = Array.isArray(raw) ? [...raw] : (raw === '*' ? ['*'] : [raw]);
  // 兜底：如果未配置或为空，注入当前已知的 frontend url（避免生产环境误判为跨域）
  const feUrl = (config.frontend && config.frontend.url) || '';
  if (feUrl) {
    try {
      const u = new URL(feUrl);
      const normalized = `${u.protocol}//${u.host}`;
      if (!list.includes(normalized) && !list.includes('*')) {
        list.push(normalized);
      }
    } catch (_e) { /* ignore */ }
  }
  return list;
};

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (config.env.isDevelopment) {
        const allowed = devOrigins.some(o => origin.startsWith(o));
        if (allowed) return callback(null, true);
        logger.warn(`CORS 拒绝来源: ${origin}`);
        return callback(null, false);
      }
      const prodOrigins = resolveProdOrigins();
      if (prodOrigins.includes('*') || prodOrigins.includes(origin)) {
        return callback(null, true);
      }
      logger.warn(`CORS 拒绝来源: ${origin}`);
      callback(null, false);
    },
    methods: config.cors.methods,
    allowedHeaders: config.cors.allowedHeaders,
    credentials: config.cors.credentials,
    maxAge: config.cors.maxAge,
  }),
);

// 请求上下文（AsyncLocalStorage）— 用于在事件回调/异步任务中获取原始 req
const requestContext = require('./middleware/requestContext');
app.use(requestContext.middleware());

// 安全 headers 中间件
const helmet = require('helmet');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
      imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
      fontSrc: ["'self'", 'https://cdn.jsdelivr.net'],
      connectSrc: ["'self'", 'wss:', 'https:'],
      mediaSrc: ["'self'", 'data:', 'blob:'],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// API响应压缩中间件
const compression = require('compression');
app.use(compression({
  filter: (req, res) => {
    // 不压缩小于1KB的响应
    if (res.get('Content-Length') && parseInt(res.get('Content-Length'), 10) < 1024) {
      return false;
    }
    // 只压缩API响应
    return req.url.startsWith('/api');
  },
  level: 6, // 压缩级别 1-9，6是速度和压缩比的平衡
}));

// 增加JSON请求体大小限制
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// 信任代理配置（用于获取真实客户端 IP）
if (config.network.trustProxy) {
  app.set(
    'trust proxy',
    config.network.trustProxyIPs.length > 0 ? config.network.trustProxyIPs : true,
  );
}

// 访问控制中间件（IP 和域名白名单）- 开发环境下不启用，避免本地拒绝访问
const { accessControlMiddleware } = require('./middleware/accessControl');
const isDev = config.env.NODE_ENV === 'development';
if (!isDev && (config.network.enableIPWhitelist || config.network.enableDomainWhitelist)) {
  app.use(accessControlMiddleware);
  logger.info('访问控制已启用');
  if (config.network.enableIPWhitelist) {
    logger.info(
      `   IP 白名单: ${config.network.allowedIPs.length > 0 ? config.network.allowedIPs.join(', ') : '未配置（将拒绝所有访问）'}`,
    );
  }
  if (config.network.enableDomainWhitelist) {
    logger.info(
      `   域名白名单: ${config.network.allowedDomains.length > 0 ? config.network.allowedDomains.join(', ') : '未配置（将拒绝所有访问）'}`,
    );
  }
} else if (isDev) {
  logger.info('开发环境：已跳过 IP/域名 访问控制，允许本地访问');
}

// 请求日志中间件 - 添加请求ID追踪
const { v4: uuidv4 } = require('uuid');
app.use((req, res, next) => {
  // 生成唯一请求ID
  req.id = req.headers['x-request-id'] || uuidv4();
  res.setHeader('X-Request-ID', req.id);

  const timestamp = new Date().toISOString();
  logger.debug(`[${req.id}] ${req.method} ${req.path}`);

  const startTime = Date.now();
  const origStatus = res.status.bind(res);
  res.status = function (code) {
    const duration = Date.now() - startTime;
    if (code >= 500) {
      logger.error(`[${req.id}] ${req.method} ${req.path} -> status ${code} (${duration}ms)`);
    } else if (code >= 400) {
      logger.warn(`[${req.id}] ${req.method} ${req.path} -> status ${code} (${duration}ms)`);
    } else {
      logger.debug(`[${req.id}] ${req.method} ${req.path} -> ${code} (${duration}ms)`);
    }
    return origStatus(code);
  };
  next();
});

// Redis缓存服务中间件 - 优雅降级
// 添加标志位，避免重复输出相同的日志
let redisMiddlewareLogEnabled = true;

// 增强的缓存服务包装器，自动处理租户隔离
const createEnhancedCacheService = (originalCacheService, tenantId) => {
  return {
    // 包装set方法，自动传递tenantId和options
    set: async (key, value, expire = 3600, options = {}) => {
      return originalCacheService.set(key, value, expire, tenantId, options);
    },
    // 包装get方法，自动传递tenantId
    get: async key => {
      return originalCacheService.get(key, tenantId);
    },
    // 包装delete方法，自动传递tenantId
    delete: async (key, cascade = true) => {
      return originalCacheService.delete(key, tenantId, cascade);
    },
    // 包装deleteByTags方法，自动传递tenantId
    deleteByTags: async tags => {
      return originalCacheService.deleteByTags(tags, tenantId);
    },
    // 包装flushAll方法，自动传递tenantId
    flushAll: async (flushAllTenants = false) => {
      return originalCacheService.flushAll(flushAllTenants ? null : tenantId);
    },
    // 包装hset方法，自动传递tenantId
    hset: async (key, field, value) => {
      return originalCacheService.hset(key, field, value, tenantId);
    },
    // 包装hget方法，自动传递tenantId
    hget: async (key, field) => {
      return originalCacheService.hget(key, field, tenantId);
    },
    // 包装hdel方法，自动传递tenantId
    hdel: async (key, field) => {
      return originalCacheService.hdel(key, field, tenantId);
    },
    // 包装getTenantKeys方法，自动传递tenantId
    getTenantKeys: async () => {
      return originalCacheService.getTenantKeys(tenantId);
    },
    // 包装缓存依赖管理方法
    addDependency: async (key, dependentKey) => {
      return originalCacheService.addDependency(key, dependentKey, tenantId);
    },
    getDependencies: async key => {
      return originalCacheService.getDependencies(key, tenantId);
    },
    removeDependency: async (key, dependentKey) => {
      return originalCacheService.removeDependency(key, dependentKey, tenantId);
    },
    // 包装缓存预热和刷新方法
    warmup: async cacheItems => {
      return originalCacheService.warmup(cacheItems, tenantId);
    },
    refresh: async (keys, loader) => {
      return originalCacheService.refresh(keys, tenantId, loader);
    },
    // 保留原始cache装饰器
    cache: originalCacheService.cache,
  };
};

app.use((req, res, next) => {
  try {
    // 获取当前请求的租户ID（从auth中间件设置的req.user中获取）
    const tenantId = req.user && req.user.tenant_id ? req.user.tenant_id : 0;

    // 注入异步任务队列服务
    req.asyncQueueService = asyncQueueService;

    // 检查Redis是否可用
    if (redis && (redis.status === 'connecting' || redis.status === 'ready')) {
      // 创建增强的缓存服务，自动处理租户隔离
      req.cacheService = createEnhancedCacheService(cacheService, tenantId);
      // 只在第一次启用Redis服务时输出日志
      if (redisMiddlewareLogEnabled) {
        logger.info('Redis缓存服务已启用，支持租户级缓存隔离');
        redisMiddlewareLogEnabled = false;
      }
    } else {
      // Redis不可用，提供一个模拟的缓存服务，所有方法都返回null或false
      const mockCacheService = {
        set: async () => false,
        get: async () => null,
        delete: async () => false,
        flushAll: async () => false,
        hset: async () => false,
        hget: async () => null,
        hdel: async () => false,
        getTenantKeys: async () => [],
        cache() {
          return function (target, propertyKey, descriptor) {
            return descriptor; // 装饰器直接返回原方法
          };
        },
      };
      req.cacheService = mockCacheService;
      // 只在第一次降级为模拟服务时输出日志
      if (redisMiddlewareLogEnabled) {
        logger.warn('Redis服务不可用，已启用模拟缓存服务');
        redisMiddlewareLogEnabled = false;
      }
    }
  } catch (error) {
    // 发生任何错误，都提供模拟缓存服务
    const mockCacheService = {
      set: async () => false,
      get: async () => null,
      delete: async () => false,
      flushAll: async () => false,
      hset: async () => false,
      hget: async () => null,
      hdel: async () => false,
      getTenantKeys: async () => [],
      cache() {
        return function (target, propertyKey, descriptor) {
          return descriptor;
        };
      },
    };
    req.cacheService = mockCacheService;
    // 注入异步任务队列服务
    req.asyncQueueService = asyncQueueService;
    // 错误日志总是输出
    logger.error('Redis服务初始化失败，已启用模拟缓存服务:', error.message);
    redisMiddlewareLogEnabled = false;
  }
  next();
});

app.use('/api', highRiskActionGate);

// 静态文件服务
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 前端静态文件服务（生产环境）
// 如果存在前端 dist 目录，则提供静态文件服务
const frontendDistPath = path.join(__dirname, '../frontend/dist');
const fs = require('fs');
if (fs.existsSync(frontendDistPath)) {
  // 提供前端静态文件
  app.use(express.static(frontendDistPath));
  // 前端路由回退到 index.html（支持 React Router）
  app.get('*', (req, res, next) => {
    // 排除 API 路由和上传文件路由
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
  logger.info('前端静态文件服务已启用:', frontendDistPath);
}

// ============================================
// Swagger API 文档
// ============================================
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const { authenticate, requireSystemAdmin } = require('./middleware/auth');

const swaggerAuthMiddleware = (req, res, next) => {
  if (config.env.isDevelopment) {
    return next();
  }

  authenticate(req, res, err => {
    if (err) return next(err);
    requireSystemAdmin(req, res, next);
  });
};

app.use(
  '/api-docs',
  swaggerAuthMiddleware,
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'AssetHub API 文档',
  }),
);

app.get('/api-docs.json', swaggerAuthMiddleware, (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// ============================================
// 路由注册中心与弃用中间件
// ============================================
const { deprecatedRoute, moduleRoute } = require('./middleware/route-deprecation');

// ============================================
// 路由
// ============================================
// 应用全局 API 限流（对 /api 路径生效）
app.use('/api', apiLimiter);

// ============================================
// 系统级路由（无模块归属）
// ============================================
app.use('/api', require('./routes/health'));
app.use('/api', require('./routes/menus'));
app.use('/api/roles-permissions', require('./routes/roles-permissions'));
app.use('/api/enhanced-permissions', require('./routes/enhanced-permissions'));
app.use('/api/system-config', require('./routes/system-config'));
app.use('/api/tenants', require('./routes/tenants'));
app.use('/api/tenant-access-url', require('./routes/tenant-access-url'));
app.use('/api/tenant-association', require('./routes/tenant-association'));
app.use('/api/tenant-module-config', require('./routes/tenant-module-config'));
app.use('/api/tenant-role-config', require('./routes/tenant-role-config'));
app.use('/api/modules', require('./routes/modules'));
app.use('/api/module-configs', require('./routes/module-configs'));
// 增强版审计日志路由（必须在基础路由之前，避免 /enhanced 等被 :id 通配符抢匹配）
app.use('/api/audit-logs', require('./routes/audit-logs-enhanced'));
app.use('/api/audit-logs', require('./routes/audit-logs'));
app.use('/api/backup', require('./routes/backup'));
app.use('/api/workflow', require('./routes/workflow'));
app.use('/api/i18n', require('./routes/i18n.routes'));
app.use('/api/api-documentation', require('./routes/api-documentation'));
app.use('/api/agent-mesh', require('./routes/agent-mesh'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/dashboard-configs', require('./routes/dashboard-configs'));
app.use('/api/desktop-preferences', require('./routes/desktop-preferences'));
app.use('/api/page-views', require('./routes/page-views'));
app.use('/api/analysis', require('./routes/analysis'));
// 通知配置与发送记录
app.use('/api/notifications', require('./routes/notification'));
// 微信小程序云数据库
app.use('/api/wx-cloud', require('./routes/wx-cloud'));

// ============================================
// 登录/注册接口限流（需在用户路由之前）
// ============================================
app.use('/api/users/login', loginLimiter);
app.use('/api/users/register', registerLimiter);

// ============================================
// 模块路由（推荐）- 使用 moduleRoute 注册
// ============================================
// 用户管理
app.use('/api/users', ...moduleRoute('/api/users', 'user-management', require('./modules/user-management/routes/index')));
// 部门管理
app.use('/api/departments', ...moduleRoute('/api/departments', 'department-management', require('./modules/department-management/routes/index')));
// 资产管理（优先注册特定子路由确保不被拦截）
app.use('/api/assets/statistics', require('./routes/assets/asset.statistics'));
// 资产调拨 (transfer-requests 等) - 必须在模块 /:id 拦截前
app.use('/api/assets', require('./routes/assets/asset.transfer'));
// 模块路由（包含 /categories、/locations 等子路径）必须在查询路由之前注册，避免被 /:id 拦截
app.use('/api/assets', ...moduleRoute('/api/assets', 'asset-management', require('./modules/asset-management/routes/assets')));
// 导入导出路由必须在查询路由之前注册，避免 /export 被当成 :id
app.use('/api/assets', require('./routes/assets/asset.import-export'));
app.use('/api/assets', require('./routes/assets/asset.query'));
// 资产分享路由（/:id/share, /:id/shares, /shares/:share_id）
app.use('/api/assets', require('./routes/assets/asset.share'));
// 合规管理
app.use('/api/compliance', ...moduleRoute('/api/compliance', 'compliance-management', require('./modules/compliance-management/routes/index')));
// 安全检查
app.use('/api/safety-inspection', ...moduleRoute('/api/safety-inspection', 'safety-inspection-management', require('./modules/safety-inspection-management/routes/index')));
// 特种设备
app.use('/api/special-equipment', ...moduleRoute('/api/special-equipment', 'special-equipment-management', require('./modules/special-equipment-management/routes/index')));
// 风险管理
app.use('/api/risk', ...moduleRoute('/api/risk', 'asset-risk-management', require('./modules/asset-risk-management/routes/index')));
// 员工资质
app.use('/api/staff', ...moduleRoute('/api/staff', 'staff-qualification', require('./modules/staff-qualification/routes/index')));
// 运行时间
app.use('/api/uptime', ...moduleRoute('/api/uptime', 'uptime-management', require('./modules/uptime-management/routes/index')));
// 飞书绑定（通知服务使用）
app.use('/api/feishu', ...moduleRoute('/api/feishu', 'feishu-binding', require('./modules/feishu-binding/routes/index')));
// IoT管理
app.use('/api/iot', ...moduleRoute('/api/iot', 'iot-management', require('./modules/iot-management/routes/index.js')));
// 技术文档
app.use('/api/technical-documents', ...moduleRoute('/api/technical-documents', 'technical-documents', require('./modules/technical-documents/routes/index')));
// 资产使用
app.use('/api/asset-usage', ...moduleRoute('/api/asset-usage', 'asset-usage-management', require('./modules/asset-usage-management/routes/index')));
// 预防性维护
app.use('/api/preventive-maintenance', ...moduleRoute('/api/preventive-maintenance', 'preventive-maintenance-management', require('./modules/preventive-maintenance-management/routes/index')));
// 日常维修（新模块化路由，前端仍使用 /api/maintenance 旧版路由，此路径供后续迁移使用）
app.use('/api/maintenance-management', ...moduleRoute('/api/maintenance-management', 'maintenance-management', require('./modules/maintenance-management/routes/index')));
// 验收管理（新模块化路由：验收申请工作流、模板CRUD、报告、统计扩展、提醒）
app.use('/api/acceptance-management', ...moduleRoute('/api/acceptance-management', 'acceptance-management', require('./modules/acceptance-management/routes/index')));
// 质量保证
app.use('/api/quality-assurance', ...moduleRoute('/api/quality-assurance', 'quality-assurance-management', require('./modules/quality-assurance-management/routes/index')));
// AI资产助手
app.use('/api/asset-ai-assistant', ...moduleRoute('/api/asset-ai-assistant', 'asset-ai-assistant', require('./modules/asset-ai-assistant/routes/index')));
// 招标采购管理（资产购置招标文件制作 / 配件维修服务招标 / 供应商扫码上传资质）
app.use('/api/tendering', ...moduleRoute('/api/tendering', 'tendering-management', require('./modules/tendering-management/routes/index')));
// 巡检管理（巡检模板/任务/规范巡检记录单/异常问题整改跟踪）
app.use('/api/inspection', ...moduleRoute('/api/inspection', 'inspection-management', require('./modules/inspection-management/routes/index')));

// ============================================
// 旧版路由（已弃用）- 使用 deprecatedRoute 注册
// 这些路由将在未来版本中移除，请迁移到对应的模块路由
// ============================================
// 资产相关旧路由
app.use('/api/asset-images', ...deprecatedRoute('/api/asset-images', require('./routes/asset-images'), '/api/assets/images'));
app.use('/api/asset-labels', ...deprecatedRoute('/api/asset-labels', require('./routes/asset-labels'), '/api/assets/labels'));
app.use('/api/temp-assets', ...deprecatedRoute('/api/temp-assets', require('./routes/temp-assets'), '/api/assets/temp'));
app.use('/api/barcode-scan', ...deprecatedRoute('/api/barcode-scan', require('./routes/barcode-scan'), '/api/assets/scan'));
app.use('/api/cloud-sync', ...deprecatedRoute('/api/cloud-sync', require('./routes/cloud-sync'), null));

// 库存旧路由
app.use('/api/inventory', ...deprecatedRoute('/api/inventory', require('./routes/inventory'), null));
app.use('/api/inventory-plans', ...deprecatedRoute('/api/inventory-plans', require('./routes/inventory-plans'), null));
app.use('/api/inventory-tasks', ...deprecatedRoute('/api/inventory-tasks', require('./routes/inventory-tasks'), null));
app.use('/api/inventory-reports', ...deprecatedRoute('/api/inventory-reports', require('./routes/inventory-reports'), null));
app.use('/api/inventory-discrepancies', ...deprecatedRoute('/api/inventory-discrepancies', require('./routes/inventory-discrepancies'), null));

// 调配/闲置/报废旧路由
app.use('/api/transfer', ...deprecatedRoute('/api/transfer', require('./routes/transfer'), null));
app.use('/api/idle', ...deprecatedRoute('/api/idle', require('./routes/idle'), null));
app.use('/api/scrapping', ...deprecatedRoute('/api/scrapping', require('./routes/scrapping'), null));

// 维修旧路由
app.use('/api/maintenance', ...deprecatedRoute('/api/maintenance', require('./routes/maintenance'), null));
app.use('/api/maintenance/ai', ...deprecatedRoute('/api/maintenance/ai', require('./routes/maintenance-ai'), null));

// IoT旧路由
app.use('/api/asset-location', ...deprecatedRoute('/api/asset-location', require('./routes/asset-location'), '/api/iot/locations'));
app.use('/api/iot-devices', ...deprecatedRoute('/api/iot-devices', require('./routes/iot-devices'), '/api/iot/devices'));
app.use('/api/location-codes', ...deprecatedRoute('/api/location-codes', require('./routes/location-codes'), null));
app.use('/api/location-alerts', ...deprecatedRoute('/api/location-alerts', require('./routes/location-alerts'), null));

// 质量旧路由
app.use('/api/quality-control', ...deprecatedRoute('/api/quality-control', require('./routes/quality-control'), null));

// 采购/验收旧路由
// 采购申请统一收敛到 /api/tendering/procurement-requests；旧 API 跳转提示
app.use('/api/procurement', ...deprecatedRoute('/api/procurement', require('./routes/procurement'), '/api/tendering/procurement-requests'));
app.use('/api/acceptance', ...deprecatedRoute('/api/acceptance', require('./routes/acceptance'), '/api/acceptance-management'));

// 不良反应旧路由
app.use('/api/adverse-reaction', ...deprecatedRoute('/api/adverse-reaction', require('./routes/adverse-reaction'), null));
app.use('/api/adverse-events', ...deprecatedRoute('/api/adverse-events', require('./routes/adverse-reaction'), null));
app.use('/api/intelligent-alerts', ...deprecatedRoute('/api/intelligent-alerts', require('./routes/intelligent-alerts'), null));

// 折旧旧路由
app.use('/api/depreciation', ...deprecatedRoute('/api/depreciation', require('./routes/depreciation'), null));
app.use('/api/asset-depreciation', ...deprecatedRoute('/api/asset-depreciation', require('./routes/asset-depreciation'), null));

// 财务管理路由（预算管理、收支记录、财务报表）
app.use('/api/finance', require('./routes/finance'));

// AI旧路由
app.use('/api/ai', ...deprecatedRoute('/api/ai', require('./routes/ai'), null));
app.use('/api/chat', ...deprecatedRoute('/api/chat', require('./routes/ai'), null));
app.use('/chat', ...deprecatedRoute('/chat', require('./routes/ai'), null));
app.use('/api/ai-assistant', ...deprecatedRoute('/api/ai-assistant', require('./routes/ai-assistant'), null));
app.use('/api/asset-ai-analysis', ...deprecatedRoute('/api/asset-ai-analysis', require('./routes/asset-ai-analysis'), null));

// 技术文档旧路由
app.use('/api/technical-documents/enhanced', ...deprecatedRoute('/api/technical-documents/enhanced', require('./routes/technical-documents-enhanced'), null));
app.use('/api/technical-documents/ai', ...deprecatedRoute('/api/technical-documents/ai', require('./routes/technical-documents-ai'), null));

// 物料旧路由
app.use('/api/materials', ...deprecatedRoute('/api/materials', require('./routes/materials'), null));
app.use('/api/sms-verification', ...deprecatedRoute('/api/sms-verification', require('./routes/sms-verification'), null));

// 动态模块元数据：/api/system/modules（供前端 ModuleContext 等使用）
// 注意：业务 API 仍在上方显式挂载；此处仅注册模块扫描结果与管理接口，避免重复挂载各模块 router
const moduleLoader = require('./core/module-loader').getInstance();
moduleLoader.registerModuleManagementRoutes(app);
moduleLoader
  .loadAllModules()
  .then(() => {
    logger.info(`动态模块目录已扫描，共 ${moduleLoader.getAllModules().length} 个模块（/api/system/modules）`);
  })
  .catch(err => {
    logger.error('动态模块目录扫描失败:', err.message);
  });

// ============================================
// 健康检查（包含数据库连接检查）
// ============================================
/**
 * @swagger
 * /api/health:
 *   get:
 *     tags:
 *       - 系统
 *     summary: 健康检查
 *     description: 检查服务器、数据库和Redis连接状态
 *     security: []
 *     responses:
 *       200:
 *         description: 服务正常
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 message:
 *                   type: string
 *                   example: 资产管理服务运行正常
 *                 database:
 *                   type: string
 *                   example: connected
 *                 redis:
 *                   type: string
 *                   example: connected
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       503:
 *         description: 服务异常（数据库连接失败）
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: error
 *                 message:
 *                   type: string
 *                   example: 服务异常
 *                 database:
 *                   type: string
 *                   example: disconnected
 *                 redis:
 *                   type: string
 *                   example: disconnected
 *                 error:
 *                   type: string
 */
// 健康检查：先立即返回 200，避免前端/代理因等待 DB 而一直转圈；后台再检查 DB/Redis
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: '资产管理服务运行正常',
    timestamp: new Date().toISOString(),
  });

  // 后台检查 DB/Redis（不阻塞响应），仅用于日志
  setImmediate(async () => {
    try {
      const connection = await Promise.race([
        db.getConnection(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('db_timeout')), 3000)),
      ]);
      if (connection) {
        await connection.ping();
        connection.release();
        logger.debug('健康检查后台: 数据库连接正常');
      }
    } catch (err) {
      if (err.message !== 'db_timeout') logger.error('健康检查后台: 数据库', err.message);
    }
    try {
      if (redis && (redis.status === 'ready' || redis.status === 'connecting')) {
        await redis.ping();
        logger.debug('健康检查后台: Redis 正常');
      }
    } catch (e) {
      // Redis 可选，不打印
    }
  });
});

// 资产分享链接重定向（如果用户直接访问后端端口）
app.get('/asset-share/:token', (req, res) => {
  const { token } = req.params;
  // 重定向到前端
  const frontendUrl = config.frontend.url;
  res.redirect(`${frontendUrl}/asset-share/${token}`);
});

// 404处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在',
    path: req.path,
  });
});

// 全局错误处理中间件（必须放在所有路由之后）
const { errorHandler } = require('./middleware/errorHandler');
app.use(errorHandler);


// ============================================
// 启动服务器
// ============================================
const PORT = config.server.port;
const HOST = config.server.host;
let server;

// 聊天室服务已删除

// 服务器启动成功后的回调函数
const onServerStart = () => {
  logger.info(`服务器运行在端口 ${PORT}`);
  logger.info(`健康检查: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/api/health`);
  logger.info(`启动时间: ${new Date().toISOString()}`);

  // 启动巡检模块调度器（逾期标记 / 到期提醒 / 整改超期 / 计划派发）
  try {
    const inspectionScheduler = require('./modules/inspection-management/scheduler/inspection.scheduler');
    if (process.env.INSPECTION_SCHEDULER_DISABLED !== 'true') {
      inspectionScheduler.start();
    }
  } catch (schedErr) {
    logger.error('[inspection] 调度器启动失败:', schedErr.message);
  }

  // 启动预防性维护调度器（自动派发 / 逾期标记 / 到期提醒）
  try {
    const pmScheduler = require('./services/maintenance/preventive-maintenance.scheduler');
    if (process.env.PM_SCHEDULER_DISABLED !== 'true') {
      pmScheduler.start();
    }
  } catch (schedErr) {
    logger.error('[pm-scheduler] 调度器启动失败:', schedErr.message);
  }

  // 启动验收模块调度器（到期/超期/待审批提醒扫描 → 落库 + 飞书推送）
  try {
    const acceptanceScheduler = require('./modules/acceptance-management/scheduler/acceptance.scheduler');
    if (process.env.ACCEPTANCE_SCHEDULER_DISABLED !== 'true') {
      acceptanceScheduler.start();
    }
  } catch (schedErr) {
    logger.error('[acceptance] 调度器启动失败:', schedErr.message);
  }

  // 初始化 Socket.IO 实时推送
  try {
    initSocketIO(server, {
      origin: config.env.isDevelopment
        ? true
        : (Array.isArray(config.cors.origin) ? config.cors.origin : [config.cors.origin]),
    });
    logger.info('[Socket.IO] 实时推送服务已启动');
  } catch (socketErr) {
    logger.error('[Socket.IO] 初始化失败:', socketErr.message);
  }

  // 初始化维修审批通知订阅（WebSocket only — 业务流程已移除 SMS）
  try {
    const { initMaintenanceNotification } = require('./services/maintenance/notification.service');
    initMaintenanceNotification();
  } catch (notifyErr) {
    logger.error('维修通知订阅初始化失败:', notifyErr.message);
  }

  // 初始化飞书业务通知订阅（报废/调配/维修/盘点事件 → 飞书卡片）
  try {
    const { initFeishuNotification } = require('./services/feishu-notification.service');
    initFeishuNotification();
  } catch (feishuErr) {
    logger.error('飞书业务通知订阅初始化失败:', feishuErr.message);
  }

  // 初始化可配置通知引擎（基于 notification_rules 动态匹配规则并发送）
  try {
    const { initNotificationEngine } = require('./services/notification-send.service');
    initNotificationEngine();
  } catch (engineErr) {
    logger.error('可配置通知引擎初始化失败:', engineErr.message);
  }

  // 初始化租户级配置（把当前 .env 中的飞书/SMTP 配置作为默认值赋给中国医科大学附属第四医院）
  try {
    const tenantConfig = require('./services/tenant-config.service');
    tenantConfig.seedDefaultTenantConfig();
  } catch (tcErr) {
    logger.warn('租户级配置初始化失败（可忽略）:', tcErr.message);
  }

  // 启动飞书定时推送调度器（智能预警扫描 + 每日数据报表推送）
  try {
    const { startScheduler } = require('./services/feishu-scheduler.service');
    startScheduler();
  } catch (schedulerErr) {
    logger.error('飞书定时推送调度器启动失败:', schedulerErr.message);
  }

  if (defaultQueue) {
    defaultQueue.start(5).catch(err => {
      logger.error('异步任务队列启动失败:', err.message);
    });
  }
};

// 检查是否启用HTTPS
if (config.server.https && config.server.sslCert && config.server.sslKey) {
  // 启用HTTPS
  const https = require('https');
  const fs = require('fs');

  try {
    // 读取SSL证书和私钥
    const sslOptions = {
      cert: fs.readFileSync(config.server.sslCert),
      key: fs.readFileSync(config.server.sslKey),
    };

    // 创建HTTPS服务器
    server = https.createServer(sslOptions, app);

    // 监听HTTPS端口
    server.listen(PORT, HOST, () => {
      logger.info('HTTPS服务器已启动');
      onServerStart();
    });
  } catch (error) {
    logger.error('HTTPS服务器启动失败:', error.message);
    logger.error('将回退到HTTP模式');

    server = app.listen(PORT, HOST, () => {
      onServerStart();
    });
  }
} else {
  server = app.listen(PORT, HOST, () => {
    onServerStart();
    if (!config.server.https) {
      logger.info('HTTPS未启用，配置项https为false');
    } else if (!config.server.sslCert || !config.server.sslKey) {
      logger.info('HTTPS未启用，缺少SSL证书或私钥配置');
    }
  });
}

// ============================================
// 优雅关闭机制
const gracefulShutdown = signal => {
  logger.info(`收到 ${signal} 信号，开始优雅关闭...`);

  // 停止飞书定时推送调度器，释放 setInterval 句柄
  try {
    const { stopScheduler } = require('./services/feishu-scheduler.service');
    stopScheduler();
  } catch (e) {
    // 调度器可能未启动，忽略错误
  }

  // 停止验收模块调度器，释放 cron 句柄
  try {
    const acceptanceScheduler = require('./modules/acceptance-management/scheduler/acceptance.scheduler');
    acceptanceScheduler.stop();
  } catch (e) {
    // 调度器可能未启动，忽略错误
  }

  server.close(() => {
    logger.info('HTTP 服务器已关闭');

    if (db && typeof db.end === 'function') {
      try {
        db.end()
          .then(() => {
            logger.info('数据库连接池已关闭');
            logger.info('服务器已完全关闭');
            process.exit(0);
          })
          .catch(err => {
            logger.error('关闭数据库连接池时出错:', err);
            logger.info('服务器已完全关闭');
            process.exit(0);
          });
      } catch (error) {
        logger.error('关闭数据库连接池时发生异常:', error);
        logger.info('服务器已完全关闭');
        process.exit(0);
      }
    } else {
      logger.info('数据库连接池未初始化，跳过关闭');
      logger.info('服务器已完全关闭');
      process.exit(0);
    }
  });

  setTimeout(() => {
    logger.error('强制退出进程');
    process.exit(1);
  }, 10000);
};

// 监听关闭信号
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// 处理服务器错误
server.on('error', error => {
  if (error.code === 'EADDRINUSE') {
    logger.error(`端口 ${PORT} 已被占用`);
  } else {
    logger.error('服务器错误:', error);
  }
  process.exit(1);
});
