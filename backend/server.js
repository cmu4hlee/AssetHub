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
        `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('notification_templates', 'notification_rules', 'notification_recipients', 'notification_logs', 'in_app_notifications', 'recipient_strategies', 'notification_preferences')`,
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
      if (!existingTables.has('in_app_notifications')) {
        await conn.execute(`CREATE TABLE in_app_notifications (
          id INT PRIMARY KEY AUTO_INCREMENT,
          tenant_id INT NOT NULL DEFAULT 0 COMMENT '租户ID',
          user_id INT NOT NULL COMMENT '接收用户ID',
          event_code VARCHAR(100) NOT NULL COMMENT '事件编码',
          category VARCHAR(50) DEFAULT 'system' COMMENT '分类: maintenance/scrapping/transfer/...',
          title VARCHAR(500) NOT NULL COMMENT '通知标题',
          content TEXT COMMENT '通知内容',
          urgency VARCHAR(20) DEFAULT 'medium' COMMENT '紧急度: high/medium/low',
          source_payload TEXT COMMENT '事件原始数据 JSON',
          action_url VARCHAR(500) DEFAULT NULL COMMENT '跳转链接',
          action_text VARCHAR(100) DEFAULT '查看详情' COMMENT '按钮文案',
          is_read TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否已读',
          read_at TIMESTAMP NULL DEFAULT NULL COMMENT '读取时间',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP NULL DEFAULT NULL COMMENT '过期时间（可选）',
          KEY idx_user_read (user_id, is_read, created_at),
          KEY idx_tenant (tenant_id),
          KEY idx_event (event_code),
          KEY idx_category (category)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='站内消息表'`);
        logger.info('in_app_notifications 表创建成功');
      }
      if (!existingTables.has('recipient_strategies')) {
        await conn.execute(`CREATE TABLE recipient_strategies (
          id INT PRIMARY KEY AUTO_INCREMENT,
          tenant_id INT NOT NULL DEFAULT 0 COMMENT '租户ID（0=全局默认）',
          event_code VARCHAR(100) NOT NULL COMMENT '事件编码',
          strategy_type VARCHAR(50) NOT NULL COMMENT '策略类型: user/role/applicant/approver/assignee/requester/operator/tenant_admin/engineer/department',
          strategy_value TEXT COMMENT '策略值 JSON（user 列表 / role 名称 / department_code 等）',
          priority INT NOT NULL DEFAULT 0 COMMENT '优先级（数字越大越靠前）',
          enabled TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用',
          remark VARCHAR(200) DEFAULT NULL COMMENT '备注',
          created_by INT DEFAULT NULL COMMENT '创建人',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NULL DEFAULT NULL,
          KEY idx_tenant_event (tenant_id, event_code, enabled),
          KEY idx_event (event_code),
          KEY idx_enabled (enabled)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='通知接收人策略表'`);
        logger.info('recipient_strategies 表创建成功');
      }
      if (!existingTables.has('notification_preferences')) {
        await conn.execute(`CREATE TABLE notification_preferences (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL COMMENT '用户ID',
          tenant_id INT NOT NULL DEFAULT 0 COMMENT '租户ID',
          event_code VARCHAR(100) DEFAULT NULL COMMENT 'NULL=全局偏好，specific=仅该事件',
          enabled TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用通知（0=彻底关闭）',
          urgency_threshold VARCHAR(20) NOT NULL DEFAULT 'low' COMMENT '紧急度阈值 low/medium/high（低于此值不通知）',
          dnd_enabled TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否启用勿扰模式',
          dnd_start_time TIME DEFAULT NULL COMMENT '勿扰开始时间（HH:MM）',
          dnd_end_time TIME DEFAULT NULL COMMENT '勿扰结束时间（HH:MM，可跨午夜）',
          dnd_days VARCHAR(50) DEFAULT '1,2,3,4,5,6,7' COMMENT '勿扰生效日（1=周一，7=周日）',
          dnd_override_urgency VARCHAR(20) NOT NULL DEFAULT 'high' COMMENT '紧急度达到此值时突破勿扰',
          desktop_enabled TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用桌面通知（仅站内）',
          toast_enabled TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用顶部气泡（仅站内）',
          remark VARCHAR(200) DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NULL DEFAULT NULL,
          UNIQUE KEY uk_user_event (user_id, event_code),
          KEY idx_tenant (tenant_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户通知偏好表'`);
        logger.info('notification_preferences 表创建成功');
      }
      conn.release();
    } catch (notificationTableErr) {
      logger.warn('通知表检查/创建跳过:', notificationTableErr.message);
    }

    logger.info('assets表所有必要字段和索引已存在');

    // 确保 system_configs 表存在（系统配置/凭据存储）
    try {
      const conn = await db.getConnection();
      const [scTable] = await conn.execute(
        "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'system_configs'",
      );
      if (scTable.length === 0) {
        logger.warn('system_configs 表不存在，正在自动创建...');
        await conn.execute(`CREATE TABLE IF NOT EXISTS system_configs (
          id INT NOT NULL AUTO_INCREMENT,
          tenant_id INT NOT NULL DEFAULT 0 COMMENT '租户ID',
          config_key VARCHAR(100) NOT NULL COMMENT '配置键',
          config_value TEXT COMMENT '配置值（AES加密存储）',
          description VARCHAR(500) DEFAULT NULL COMMENT '配置描述',
          is_encrypted TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否加密存储',
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
          updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
          updated_by VARCHAR(50) DEFAULT NULL COMMENT '更新人',
          PRIMARY KEY (id),
          UNIQUE KEY uk_tenant_key (tenant_id, config_key),
          KEY idx_tenant_config (tenant_id, config_key)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='系统配置表（敏感凭证存储）'`);
        logger.info('system_configs 表创建成功');

        // 从环境变量迁移阿里云 SMS 配置到数据库
        if (process.env.ALIYUN_ACCESS_KEY_ID) {
          await conn.execute(
            'INSERT INTO system_configs (tenant_id, config_key, config_value, description, is_encrypted) VALUES (0, ?, ?, ?, 1)',
            ['aliyun.access_key_id', process.env.ALIYUN_ACCESS_KEY_ID, '阿里云 AccessKey ID（SMS 短信服务）']
          );
        }
        if (process.env.ALIYUN_ACCESS_KEY_SECRET) {
          await conn.execute(
            'INSERT INTO system_configs (tenant_id, config_key, config_value, description, is_encrypted) VALUES (0, ?, ?, ?, 1)',
            ['aliyun.access_key_secret', process.env.ALIYUN_ACCESS_KEY_SECRET, '阿里云 AccessKey Secret（SMS 短信服务）']
          );
        }
        if (process.env.ALIYUN_SMS_SIGN_NAME) {
          await conn.execute(
            'INSERT INTO system_configs (tenant_id, config_key, config_value, description, is_encrypted) VALUES (0, ?, ?, ?, 0)',
            ['aliyun.sms_sign_name', process.env.ALIYUN_SMS_SIGN_NAME, '阿里云短信签名名称']
          );
        }
        if (process.env.ALIYUN_SMS_TEMPLATE_CODE) {
          await conn.execute(
            'INSERT INTO system_configs (tenant_id, config_key, config_value, description, is_encrypted) VALUES (0, ?, ?, ?, 0)',
            ['aliyun.sms_template_code', process.env.ALIYUN_SMS_TEMPLATE_CODE, '阿里云短信模板代码']
          );
        }
        logger.info('阿里云 SMS 配置已从环境变量迁移到 system_configs 表');
      }
      conn.release();
    } catch (scTableErr) {
      logger.warn('system_configs 表检查/创建跳过:', scTableErr.message);
    }

    // ========== 特种设备表补全列迁移 ==========
    try {
      const conn = await db.getConnection();
      const [seCols] = await conn.execute(
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'special_equipment'",
      );
      const existing = new Set(seCols.map(r => r.COLUMN_NAME));

      const newColumns = [
        { name: 'manufacturer', type: "VARCHAR(200) DEFAULT NULL COMMENT '制造商'", after: 'equipment_type' },
        { name: 'model_spec', type: "VARCHAR(100) DEFAULT NULL COMMENT '型号规格'", after: 'manufacturer' },
        { name: 'serial_number', type: "VARCHAR(100) DEFAULT NULL COMMENT '出厂编号'", after: 'model_spec' },
        { name: 'manufacturing_date', type: "DATE DEFAULT NULL COMMENT '制造日期'", after: 'serial_number' },
        { name: 'department', type: "VARCHAR(100) DEFAULT NULL COMMENT '所属部门'", after: 'manufacturing_date' },
        { name: 'use_certificate_no', type: "VARCHAR(100) DEFAULT NULL COMMENT '使用登记证编号'", after: 'department' },
        { name: 'registration_date', type: "DATE DEFAULT NULL COMMENT '注册登记日期'", after: 'use_certificate_no' },
        { name: 'safety_manager', type: "VARCHAR(50) DEFAULT NULL COMMENT '安全管理员'", after: 'registration_date' },
        { name: 'first_inspection_date', type: "DATE DEFAULT NULL COMMENT '首次检验日期'", after: 'safety_manager' },
        { name: 'inspection_cycle_months', type: "INT DEFAULT NULL COMMENT '检验周期(月)'", after: 'first_inspection_date' },
        { name: 'location', type: "VARCHAR(200) DEFAULT NULL COMMENT '安装位置'", after: 'inspection_cycle_months' },
        { name: 'registrant', type: "VARCHAR(50) DEFAULT NULL COMMENT '登记人'", after: 'location' },
        { name: 'safety_notes', type: "TEXT DEFAULT NULL COMMENT '安全注意事项'", after: 'registrant' },
        { name: 'equipment_category', type: "VARCHAR(30) DEFAULT NULL COMMENT '设备细分分类：special_regulatory/large/life_support/radiation'", after: 'safety_notes' },
        { name: 'use_status', type: "VARCHAR(30) DEFAULT 'in_use' COMMENT '使用状态：in_use/out_of_service/scrapped/suspended/transferred'", after: 'equipment_category' },
        { name: 'remark', type: "TEXT DEFAULT NULL COMMENT '备注'", after: 'use_status' },
        { name: 'updated_at', type: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'", after: 'remark' },
      ];

      let addedCount = 0;
      for (const col of newColumns) {
        if (!existing.has(col.name)) {
          logger.warn(`special_equipment 表缺少 ${col.name} 列，正在自动添加...`);
          await conn.execute(`ALTER TABLE special_equipment ADD COLUMN ${col.name} ${col.type}`);
          addedCount++;
        }
      }
      if (addedCount > 0) {
        logger.info(`special_equipment 表迁移完成：新增 ${addedCount} 列`);
      } else {
        logger.info('special_equipment 表列完整性检查通过');
      }
      conn.release();
    } catch (seMigrateErr) {
      logger.warn('special_equipment 表迁移跳过:', seMigrateErr.message);
    }

    // ========== 特种设备证件表（special_equipment_cert）==========
    try {
      const certConn = await db.getConnection();
      const [certTbl] = await certConn.execute(
        "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'special_equipment_cert'",
      );
      if (certTbl.length === 0) {
        await certConn.execute(`
          CREATE TABLE special_equipment_cert (
            id INT AUTO_INCREMENT PRIMARY KEY,
            tenant_id INT NOT NULL,
            equipment_id INT NOT NULL COMMENT '关联 special_equipment.id',
            cert_type VARCHAR(50) NOT NULL COMMENT '证件类型：使用登记证/检验合格证/注册证/计量证/辐射安全证/其他',
            cert_no VARCHAR(100) DEFAULT NULL COMMENT '证件编号',
            attachment_url VARCHAR(500) DEFAULT NULL COMMENT '附件URL',
            issue_date DATE DEFAULT NULL COMMENT '发证日期',
            expiry_date DATE DEFAULT NULL COMMENT '有效期至',
            remark TEXT DEFAULT NULL COMMENT '备注',
            created_by VARCHAR(50) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            is_deleted TINYINT(1) NOT NULL DEFAULT 0,
            deleted_at DATETIME DEFAULT NULL,
            INDEX idx_se_cert_tenant (tenant_id),
            INDEX idx_se_cert_equipment (equipment_id)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='特种设备证件管理'
        `);
        logger.info('special_equipment_cert 表创建完成');
      } else {
        logger.info('special_equipment_cert 表已存在，跳过创建');
      }
      certConn.release();
    } catch (certErr) {
      logger.warn('special_equipment_cert 表创建跳过:', certErr.message);
    }

    // ========== 工程师档案扩展表（staff_skill / staff_schedule）==========
    try {
      const skConn = await db.getConnection();
      const [skTbl] = await skConn.execute(
        "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'staff_skill'",
      );
      if (skTbl.length === 0) {
        await skConn.execute(`
          CREATE TABLE staff_skill (
            id INT AUTO_INCREMENT PRIMARY KEY,
            tenant_id INT NOT NULL,
            user_id INT NOT NULL,
            skill_name VARCHAR(100) NOT NULL COMMENT '技能名称',
            skill_level VARCHAR(50) DEFAULT NULL COMMENT '熟练/精通/专家',
            years_experience INT DEFAULT NULL COMMENT '从业年限',
            remark TEXT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            is_deleted TINYINT(1) NOT NULL DEFAULT 0,
            deleted_at DATETIME DEFAULT NULL,
            INDEX idx_ss_tenant (tenant_id),
            INDEX idx_ss_user (user_id)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工程师技能'
        `);
        logger.info('staff_skill 表创建完成');
      } else {
        logger.info('staff_skill 表已存在，跳过创建');
      }

      const [scTbl] = await skConn.execute(
        "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'staff_schedule'",
      );
      if (scTbl.length === 0) {
        await skConn.execute(`
          CREATE TABLE staff_schedule (
            id INT AUTO_INCREMENT PRIMARY KEY,
            tenant_id INT NOT NULL,
            user_id INT NOT NULL,
            schedule_date DATE NOT NULL COMMENT '排班日期',
            shift_type VARCHAR(20) NOT NULL COMMENT 'day/night/rest',
            shift_start VARCHAR(10) DEFAULT NULL COMMENT '上班时间 HH:mm',
            shift_end VARCHAR(10) DEFAULT NULL COMMENT '下班时间 HH:mm',
            remark TEXT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            is_deleted TINYINT(1) NOT NULL DEFAULT 0,
            deleted_at DATETIME DEFAULT NULL,
            INDEX idx_sc_tenant (tenant_id),
            INDEX idx_sc_user (user_id),
            INDEX idx_sc_date (schedule_date)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工程师排班'
        `);
        logger.info('staff_schedule 表创建完成');
      } else {
        logger.info('staff_schedule 表已存在，跳过创建');
      }
      skConn.release();
    } catch (skErr) {
      logger.warn('staff_skill/staff_schedule 表创建跳过:', skErr.message);
    }

    // ========== 风险评估标准库（risk_assessment_standards）==========
    try {
      const rasConn = await db.getConnection();
      const [rasTbl] = await rasConn.execute(
        "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'risk_assessment_standards'",
      );
      if (rasTbl.length === 0) {
        await rasConn.execute(`
          CREATE TABLE risk_assessment_standards (
            id INT AUTO_INCREMENT PRIMARY KEY,
            tenant_id INT NOT NULL,
            code VARCHAR(50) NOT NULL COMMENT '标准编号',
            name VARCHAR(120) NOT NULL COMMENT '标准条目名称',
            category VARCHAR(50) DEFAULT NULL COMMENT '标准类别(临床风险/技术风险/管理风险/使用风险)',
            dimension VARCHAR(120) DEFAULT NULL COMMENT '评分维度说明',
            weight INT DEFAULT 0 COMMENT '权重(%)',
            max_score INT DEFAULT 100 COMMENT '该维度满分',
            description TEXT DEFAULT NULL COMMENT '说明',
            is_active TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用',
            sort_order INT DEFAULT 0 COMMENT '排序',
            created_by INT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uk_ras_tenant_code (tenant_id, code),
            INDEX idx_ras_tenant (tenant_id)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='风险评估标准库'
        `);
        logger.info('risk_assessment_standards 表创建完成');
      } else {
        logger.info('risk_assessment_standards 表已存在，跳过创建');
      }
      rasConn.release();
    } catch (rasErr) {
      logger.warn('risk_assessment_standards 表创建跳过:', rasErr.message);
    }

    // ========== 应急设备调配 / 租借计费（shared_equipment_pool / equipment_rental_orders）==========
    try {
      const eaConn = await db.getConnection();

      const [sepTbl] = await eaConn.execute(
        "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shared_equipment_pool'",
      );
      if (sepTbl.length === 0) {
        await eaConn.execute(`
          CREATE TABLE shared_equipment_pool (
            id INT AUTO_INCREMENT PRIMARY KEY,
            tenant_id INT NOT NULL,
            asset_code VARCHAR(50) DEFAULT NULL COMMENT '关联资产编码(可选)',
            equipment_name VARCHAR(120) NOT NULL COMMENT '设备名称',
            equipment_type VARCHAR(60) DEFAULT NULL COMMENT '设备类别',
            model VARCHAR(80) DEFAULT NULL COMMENT '型号',
            location VARCHAR(120) DEFAULT NULL COMMENT '存放位置',
            manager_id INT DEFAULT NULL COMMENT '管理人员用户ID',
            manager_name VARCHAR(60) DEFAULT NULL,
            is_rentable TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否可租借',
            charge_type VARCHAR(20) DEFAULT 'free' COMMENT 'free/per_hour/per_day/per_use',
            charge_standard DECIMAL(10,2) DEFAULT 0.00 COMMENT '收费标准(元/单位)',
            total_quantity INT DEFAULT 1 COMMENT '总数量',
            available_quantity INT DEFAULT 1 COMMENT '可用数量',
            borrowable_period VARCHAR(60) DEFAULT NULL COMMENT '可借时段 如 08:00-18:00',
            status VARCHAR(20) DEFAULT 'available' COMMENT 'available/in_use/maintenance',
            remark TEXT DEFAULT NULL,
            created_by INT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            is_deleted TINYINT(1) NOT NULL DEFAULT 0,
            deleted_at DATETIME DEFAULT NULL,
            INDEX idx_sep_tenant (tenant_id),
            INDEX idx_sep_rentable (tenant_id, is_rentable)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='共用设备池'
        `);
        logger.info('shared_equipment_pool 表创建完成');
      } else {
        logger.info('shared_equipment_pool 表已存在，跳过创建');
        // 兼容旧表：补齐 asset_id 字段
        try {
          const [sepCols] = await eaConn.execute(
            "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shared_equipment_pool' AND COLUMN_NAME = 'asset_id'",
          );
          if (sepCols.length === 0) {
            await eaConn.execute(
              "ALTER TABLE shared_equipment_pool ADD COLUMN asset_id INT DEFAULT NULL COMMENT '关联实际资产ID' AFTER asset_code",
            );
            await eaConn.execute(
              "CREATE INDEX idx_sep_asset ON shared_equipment_pool (tenant_id, asset_id)",
            );
            logger.info('shared_equipment_pool 已补齐 asset_id 字段');
          }
        } catch (sepAlterErr) {
          logger.warn('shared_equipment_pool 补齐 asset_id 字段失败:', sepAlterErr.message);
        }
      }

      const [eroTbl] = await eaConn.execute(
        "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'equipment_rental_orders'",
      );
      if (eroTbl.length === 0) {
        await eaConn.execute(`
          CREATE TABLE equipment_rental_orders (
            id INT AUTO_INCREMENT PRIMARY KEY,
            tenant_id INT NOT NULL,
            order_no VARCHAR(40) NOT NULL COMMENT '租借单号',
            pool_id INT DEFAULT NULL COMMENT '设备池ID',
            equipment_name VARCHAR(120) DEFAULT NULL,
            applicant_id INT DEFAULT NULL,
            applicant_name VARCHAR(60) DEFAULT NULL,
            applicant_department VARCHAR(80) DEFAULT NULL,
            purpose VARCHAR(255) DEFAULT NULL COMMENT '用途',
            expected_borrow_time DATETIME DEFAULT NULL,
            expected_return_time DATETIME DEFAULT NULL,
            actual_borrow_time DATETIME DEFAULT NULL,
            actual_return_time DATETIME DEFAULT NULL,
            quantity INT DEFAULT 1,
            charge_type VARCHAR(20) DEFAULT 'free',
            charge_standard DECIMAL(10,2) DEFAULT 0.00,
            duration_hours DECIMAL(10,2) DEFAULT 0 COMMENT '实际时长(小时)',
            amount DECIMAL(10,2) DEFAULT 0.00 COMMENT '计费金额',
            status VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT 'pending/approved/rejected/borrowed/returned/cancelled',
            approver_id INT DEFAULT NULL,
            approver_name VARCHAR(60) DEFAULT NULL,
            approve_remark VARCHAR(255) DEFAULT NULL,
            settled TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否已结算',
            settlement_remark VARCHAR(255) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            is_deleted TINYINT(1) NOT NULL DEFAULT 0,
            deleted_at DATETIME DEFAULT NULL,
            INDEX idx_ero_tenant (tenant_id),
            INDEX idx_ero_status (tenant_id, status),
            INDEX idx_ero_dept (tenant_id, applicant_department)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='设备租借订单'
        `);
        logger.info('equipment_rental_orders 表创建完成');
      } else {
        logger.info('equipment_rental_orders 表已存在，跳过创建');
      }
      eaConn.release();
    } catch (eaErr) {
      logger.warn('应急调配表创建跳过:', eaErr.message);
    }

    // ========== 通用事件提醒（event_types / events）==========
    try {
      const erConn = await db.getConnection();

      const [etTbl] = await erConn.execute(
        "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'event_types'",
      );
      if (etTbl.length === 0) {
        await erConn.execute(`
          CREATE TABLE event_types (
            id INT AUTO_INCREMENT PRIMARY KEY,
            tenant_id INT NOT NULL,
            name VARCHAR(60) NOT NULL COMMENT '类型名称',
            color VARCHAR(20) DEFAULT '#1677ff' COMMENT '展示颜色',
            icon VARCHAR(40) DEFAULT NULL COMMENT '图标名',
            description VARCHAR(255) DEFAULT NULL,
            is_active TINYINT(1) NOT NULL DEFAULT 1,
            sort_order INT DEFAULT 0,
            created_by INT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            is_deleted TINYINT(1) NOT NULL DEFAULT 0,
            deleted_at DATETIME DEFAULT NULL,
            INDEX idx_et_tenant (tenant_id),
            INDEX idx_et_active (tenant_id, is_active)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='事件类型（租户级自定义）'
        `);
        logger.info('event_types 表创建完成');
      } else {
        logger.info('event_types 表已存在，跳过创建');
      }

      const [evTbl] = await erConn.execute(
        "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'events'",
      );
      if (evTbl.length === 0) {
        await erConn.execute(`
          CREATE TABLE events (
            id INT AUTO_INCREMENT PRIMARY KEY,
            tenant_id INT NOT NULL,
            title VARCHAR(200) NOT NULL COMMENT '事件标题',
            content TEXT DEFAULT NULL COMMENT '事件内容',
            type_id INT DEFAULT NULL COMMENT 'event_types.id',
            event_type VARCHAR(40) DEFAULT NULL COMMENT '冗余类型名/自定义类型标识',
            due_at DATETIME DEFAULT NULL COMMENT '到期时间',
            remind_channels JSON DEFAULT NULL COMMENT '提醒渠道 ["in_app","feishu","sms"]',
            assignee_id INT DEFAULT NULL COMMENT '负责人用户ID',
            assignee_name VARCHAR(60) DEFAULT NULL,
            priority VARCHAR(20) DEFAULT 'normal' COMMENT 'low/normal/high/urgent',
            location VARCHAR(120) DEFAULT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT 'pending/completed/cancelled',
            notify_status VARCHAR(20) DEFAULT 'pending' COMMENT 'pending/sent/failed/skipped',
            notify_sent_at DATETIME DEFAULT NULL,
            created_by INT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            is_deleted TINYINT(1) NOT NULL DEFAULT 0,
            deleted_at DATETIME DEFAULT NULL,
            INDEX idx_ev_tenant (tenant_id),
            INDEX idx_ev_status (tenant_id, status),
            INDEX idx_ev_due (tenant_id, due_at),
            INDEX idx_ev_notify (tenant_id, notify_status)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='通用事件'
        `);
        logger.info('events 表创建完成');
      } else {
        logger.info('events 表已存在，跳过创建');
      }
      erConn.release();
    } catch (erErr) {
      logger.warn('事件提醒表创建跳过:', erErr.message);
    }

    // ========== 表单 / 流程定制（form_schemas / workflow_definitions / workflow_instances / workflow_instance_nodes）==========
    try {
      const fcConn = await db.getConnection();

      const [fsTbl] = await fcConn.execute(
        "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'form_schemas'",
      );
      if (fsTbl.length === 0) {
        await fcConn.execute(`
          CREATE TABLE form_schemas (
            id INT AUTO_INCREMENT PRIMARY KEY,
            tenant_id INT NOT NULL,
            name VARCHAR(120) NOT NULL,
            code VARCHAR(80) NOT NULL COMMENT '业务标识，如 purchase_request',
            entity_type VARCHAR(60) DEFAULT NULL COMMENT '关联业务类型',
            description VARCHAR(255) DEFAULT NULL,
            schema_json JSON DEFAULT NULL COMMENT '字段定义数组',
            version INT DEFAULT 1,
            status VARCHAR(20) DEFAULT 'enabled' COMMENT 'enabled/draft/disabled',
            created_by INT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            is_deleted TINYINT(1) NOT NULL DEFAULT 0,
            deleted_at DATETIME DEFAULT NULL,
            UNIQUE KEY uk_tenant_code (tenant_id, code),
            INDEX idx_fs_tenant (tenant_id)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='表单定义(schema 驱动)'
        `);
        logger.info('form_schemas 表创建完成');
      } else {
        logger.info('form_schemas 表已存在，跳过创建');
      }

      const [wdTbl] = await fcConn.execute(
        "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wf_definitions'",
      );
      if (wdTbl.length === 0) {
        await fcConn.execute(`
          CREATE TABLE wf_definitions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            tenant_id INT NOT NULL,
            name VARCHAR(120) NOT NULL,
            code VARCHAR(80) NOT NULL COMMENT '流程标识',
            description VARCHAR(255) DEFAULT NULL,
            entity_type VARCHAR(60) DEFAULT NULL COMMENT '关联业务/表单 code',
            nodes_json JSON DEFAULT NULL COMMENT '节点定义数组',
            version INT DEFAULT 1,
            status VARCHAR(20) DEFAULT 'enabled' COMMENT 'enabled/disabled',
            created_by INT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            is_deleted TINYINT(1) NOT NULL DEFAULT 0,
            deleted_at DATETIME DEFAULT NULL,
            UNIQUE KEY uk_wf_tenant_code (tenant_id, code),
            INDEX idx_wf_tenant (tenant_id)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='流程定义(通用审批引擎)'
        `);
        logger.info('wf_definitions 表创建完成');
      } else {
        logger.info('wf_definitions 表已存在，跳过创建');
      }

      // 补列：流程定义绑定表单（form_schema_code）
      try {
        const [fcCol] = await fcConn.execute(
          "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wf_definitions' AND COLUMN_NAME = 'form_schema_code'",
        );
        if (fcCol.length === 0) {
          await fcConn.execute(
            "ALTER TABLE wf_definitions ADD COLUMN form_schema_code VARCHAR(60) DEFAULT NULL COMMENT '绑定的表单 code（发起时自动渲染）' AFTER entity_type",
          );
          logger.info('wf_definitions.form_schema_code 列已添加');
        }
      } catch (fcErr) {
        logger.warn('wf_definitions 补列 form_schema_code 跳过:', fcErr.message);
      }

      const [wiTbl] = await fcConn.execute(
        "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'workflow_instances'",
      );
      if (wiTbl.length === 0) {
        await fcConn.execute(`
          CREATE TABLE workflow_instances (
            id INT AUTO_INCREMENT PRIMARY KEY,
            tenant_id INT NOT NULL,
            definition_id INT DEFAULT NULL,
            definition_code VARCHAR(80) DEFAULT NULL,
            entity_type VARCHAR(60) DEFAULT NULL,
            entity_id VARCHAR(60) DEFAULT NULL COMMENT '业务单据ID',
            title VARCHAR(200) DEFAULT NULL,
            data_json JSON DEFAULT NULL COMMENT '提交的表单数据',
            status VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT 'pending/approved/rejected/cancelled',
            current_node_seq INT DEFAULT 0,
            total_nodes INT DEFAULT 0,
            initiator_id INT DEFAULT NULL,
            initiator_name VARCHAR(60) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            finished_at DATETIME DEFAULT NULL,
            INDEX idx_wi_tenant (tenant_id),
            INDEX idx_wi_status (tenant_id, status)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='流程实例'
        `);
        logger.info('workflow_instances 表创建完成');
      } else {
        logger.info('workflow_instances 表已存在，跳过创建');
      }

      const [winTbl] = await fcConn.execute(
        "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'workflow_instance_nodes'",
      );
      if (winTbl.length === 0) {
        await fcConn.execute(`
          CREATE TABLE workflow_instance_nodes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            tenant_id INT NOT NULL,
            instance_id INT NOT NULL,
            node_seq INT NOT NULL,
            node_name VARCHAR(120) DEFAULT NULL,
            mode VARCHAR(10) DEFAULT 'or' COMMENT 'or/and(会签)',
            approver_type VARCHAR(20) DEFAULT 'role' COMMENT 'role/user',
            approver_role VARCHAR(40) DEFAULT NULL,
            approver_user_id INT DEFAULT NULL,
            decision VARCHAR(20) DEFAULT 'pending' COMMENT 'pending/approved/rejected/skipped',
            opinion VARCHAR(500) DEFAULT NULL,
            approver_id INT DEFAULT NULL,
            approver_name VARCHAR(60) DEFAULT NULL,
            acted_at DATETIME DEFAULT NULL,
            INDEX idx_win_instance (instance_id),
            INDEX idx_win_todo (tenant_id, approver_user_id, decision)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='流程实例节点(审批人)'
        `);
        logger.info('workflow_instance_nodes 表创建完成');
      } else {
        logger.info('workflow_instance_nodes 表已存在，跳过创建');
      }
      fcConn.release();
    } catch (fcErr) {
      logger.warn('表单/流程定制表创建跳过:', fcErr.message);
    }

    // ========== 知识库模块表（kb_bases / kb_documents / kb_chunks / kb_qa_records / kb_settings）==========
    try {
      const conn = await db.getConnection();

      const [kbTables] = await conn.execute(
        `SELECT TABLE_NAME FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME IN ('knowledge_bases','knowledge_documents','knowledge_chunks','knowledge_qa_records','knowledge_settings')`,
      );
      const existingKb = new Set(kbTables.map(r => r.TABLE_NAME));

      if (!existingKb.has('knowledge_bases')) {
        await conn.execute(`CREATE TABLE IF NOT EXISTS knowledge_bases (
          id INT NOT NULL AUTO_INCREMENT,
          tenant_id INT NOT NULL DEFAULT 0 COMMENT '租户ID',
          kb_code VARCHAR(64) NOT NULL COMMENT '知识库编码',
          kb_name VARCHAR(200) NOT NULL COMMENT '知识库名称',
          description TEXT DEFAULT NULL COMMENT '描述',
          scope VARCHAR(50) NOT NULL DEFAULT 'general' COMMENT '用途: general/asset/maintenance/sop/policy',
          icon VARCHAR(50) DEFAULT 'book' COMMENT '图标',
          sort_order INT NOT NULL DEFAULT 0 COMMENT '排序',
          doc_count INT NOT NULL DEFAULT 0 COMMENT '文档数',
          chunk_count INT NOT NULL DEFAULT 0 COMMENT '分块数',
          status VARCHAR(20) NOT NULL DEFAULT 'active' COMMENT '状态: active/archived',
          created_by VARCHAR(50) DEFAULT NULL COMMENT '创建人',
          created_by_id INT DEFAULT NULL COMMENT '创建人ID',
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
          updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
          PRIMARY KEY (id),
          UNIQUE KEY uk_tenant_code (tenant_id, kb_code),
          KEY idx_kb_tenant_status (tenant_id, status),
          KEY idx_kb_tenant_scope (tenant_id, scope)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='知识库表'`);
        logger.info('knowledge_bases 表创建成功');
      }

      if (!existingKb.has('knowledge_documents')) {
        await conn.execute(`CREATE TABLE IF NOT EXISTS knowledge_documents (
          id INT NOT NULL AUTO_INCREMENT,
          tenant_id INT NOT NULL DEFAULT 0 COMMENT '租户ID',
          kb_id INT NOT NULL COMMENT '所属知识库ID',
          title VARCHAR(500) NOT NULL COMMENT '文档标题',
          description TEXT DEFAULT NULL COMMENT '描述',
          file_name VARCHAR(500) NOT NULL COMMENT '原始文件名',
          file_path VARCHAR(1000) NOT NULL COMMENT '存储路径',
          file_size BIGINT NOT NULL DEFAULT 0 COMMENT '文件字节数',
          file_ext VARCHAR(20) DEFAULT NULL COMMENT '文件扩展名',
          mime_type VARCHAR(100) DEFAULT NULL COMMENT 'MIME',
          file_hash VARCHAR(64) DEFAULT NULL COMMENT 'SHA256',
          parse_status VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT '解析状态: pending/parsing/ready/failed',
          parse_error TEXT DEFAULT NULL COMMENT '解析错误信息',
          char_count INT NOT NULL DEFAULT 0 COMMENT '提取的字符数',
          chunk_count INT NOT NULL DEFAULT 0 COMMENT '分块数',
          parsed_at TIMESTAMP NULL DEFAULT NULL COMMENT '解析完成时间',
          uploaded_by VARCHAR(50) DEFAULT NULL COMMENT '上传人',
          uploaded_by_id INT DEFAULT NULL COMMENT '上传人ID',
          uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '上传时间',
          status VARCHAR(20) NOT NULL DEFAULT 'active' COMMENT '状态: active/deleted',
          PRIMARY KEY (id),
          KEY idx_kb_doc_tenant_kb (tenant_id, kb_id, status),
          KEY idx_kb_doc_tenant_status (tenant_id, status),
          KEY idx_kb_doc_tenant_parse (tenant_id, parse_status),
          KEY idx_kb_doc_hash (tenant_id, file_hash)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='知识库文档表'`);
        logger.info('knowledge_documents 表创建成功');
      }

      if (!existingKb.has('knowledge_chunks')) {
        await conn.execute(`CREATE TABLE IF NOT EXISTS knowledge_chunks (
          id INT NOT NULL AUTO_INCREMENT,
          tenant_id INT NOT NULL DEFAULT 0 COMMENT '租户ID',
          doc_id INT NOT NULL COMMENT '所属文档ID',
          kb_id INT NOT NULL COMMENT '所属知识库ID(冗余便于检索)',
          chunk_index INT NOT NULL DEFAULT 0 COMMENT '块序号',
          content MEDIUMTEXT NOT NULL COMMENT '块内容',
          content_length INT NOT NULL DEFAULT 0 COMMENT '块字符数',
          keywords TEXT DEFAULT NULL COMMENT '关键词JSON数组',
          tokens_estimate INT NOT NULL DEFAULT 0 COMMENT '估算 token 数',
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
          PRIMARY KEY (id),
          KEY idx_kb_chunk_tenant_kb (tenant_id, kb_id),
          KEY idx_kb_chunk_tenant_doc (tenant_id, doc_id),
          KEY idx_kb_chunk_doc_idx (doc_id, chunk_index)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='知识库分块表'`);
        logger.info('knowledge_chunks 表创建成功');
      }

      if (!existingKb.has('knowledge_qa_records')) {
        await conn.execute(`CREATE TABLE IF NOT EXISTS knowledge_qa_records (
          id INT NOT NULL AUTO_INCREMENT,
          tenant_id INT NOT NULL DEFAULT 0 COMMENT '租户ID',
          kb_id INT DEFAULT NULL COMMENT '知识库ID(可空表示全租户检索)',
          session_id VARCHAR(128) DEFAULT NULL COMMENT '会话ID',
          user_id INT DEFAULT NULL COMMENT '用户ID',
          user_name VARCHAR(50) DEFAULT NULL COMMENT '用户名',
          question TEXT NOT NULL COMMENT '问题',
          answer MEDIUMTEXT DEFAULT NULL COMMENT '回答',
          retrieved_chunks MEDIUMTEXT DEFAULT NULL COMMENT '检索到的分块JSON',
          citations MEDIUMTEXT DEFAULT NULL COMMENT '引用列表JSON',
          provider VARCHAR(50) DEFAULT NULL COMMENT 'AI provider',
          model VARCHAR(100) DEFAULT NULL COMMENT 'AI 模型',
          latency_ms INT NOT NULL DEFAULT 0 COMMENT '耗时毫秒',
          status VARCHAR(20) NOT NULL DEFAULT 'success' COMMENT '状态: success/failed',
          error_message TEXT DEFAULT NULL COMMENT '失败原因',
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
          PRIMARY KEY (id),
          KEY idx_kb_qa_tenant_created (tenant_id, created_at),
          KEY idx_kb_qa_tenant_kb (tenant_id, kb_id),
          KEY idx_kb_qa_tenant_user (tenant_id, user_id),
          KEY idx_kb_qa_tenant_session (tenant_id, session_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='知识库问答记录'`);
        logger.info('knowledge_qa_records 表创建成功');
      }

      if (!existingKb.has('knowledge_settings')) {
        await conn.execute(`CREATE TABLE IF NOT EXISTS knowledge_settings (
          id INT NOT NULL AUTO_INCREMENT,
          tenant_id INT NOT NULL DEFAULT 0 COMMENT '租户ID',
          chunk_size INT NOT NULL DEFAULT 600 COMMENT '分块大小(字符)',
          chunk_overlap INT NOT NULL DEFAULT 80 COMMENT '分块重叠(字符)',
          top_k INT NOT NULL DEFAULT 5 COMMENT '检索 topK',
          min_score DECIMAL(4,3) NOT NULL DEFAULT 0.020 COMMENT '最低分阈值',
          ai_enabled TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用 AI 问答',
          ai_provider VARCHAR(50) NOT NULL DEFAULT 'openclaw' COMMENT 'AI provider',
          ai_model VARCHAR(100) NOT NULL DEFAULT 'openclaw' COMMENT 'AI 模型',
          max_context_chars INT NOT NULL DEFAULT 6000 COMMENT '上下文最大字符数',
          system_prompt TEXT DEFAULT NULL COMMENT '系统提示(留空用默认)',
          updated_by INT DEFAULT NULL COMMENT '最后更新人ID',
          updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
          PRIMARY KEY (id),
          UNIQUE KEY uk_tenant (tenant_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='知识库租户设置'`);
        logger.info('knowledge_settings 表创建成功');
      }

      conn.release();
    } catch (kbMigrateErr) {
      logger.warn('知识库表检查/创建跳过:', kbMigrateErr.message);
    }

    try {
      const mdsConn = await db.getConnection();
      await mdsConn.execute(`CREATE TABLE IF NOT EXISTS menu_display_settings (
        id INT NOT NULL AUTO_INCREMENT,
        tenant_id INT NOT NULL DEFAULT 0 COMMENT '租户ID',
        menu_key VARCHAR(100) NOT NULL COMMENT '菜单key',
        order_index INT DEFAULT NULL COMMENT '自定义排序(覆盖ALL_MENUS)',
        is_visible TINYINT(1) NOT NULL DEFAULT 1 COMMENT '顶层是否显示 1显示0隐藏',
        updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
        PRIMARY KEY (id),
        UNIQUE KEY uk_tenant_menu (tenant_id, menu_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='菜单显示设置(顺序与显隐)'`);
      logger.info('menu_display_settings 表检查/创建成功');
      mdsConn.release();
    } catch (mdsErr) {
      logger.warn('menu_display_settings 表检查/创建跳过:', mdsErr.message);
    }

    // 备件台账
    try {
      const spConn = await db.getConnection();
      await spConn.execute(`CREATE TABLE IF NOT EXISTS spare_parts (
        id INT NOT NULL AUTO_INCREMENT,
        tenant_id INT NOT NULL COMMENT '租户ID',
        part_code VARCHAR(100) NOT NULL COMMENT '备件编码',
        part_name VARCHAR(200) NOT NULL COMMENT '备件名称',
        specification VARCHAR(200) DEFAULT NULL COMMENT '规格型号',
        unit VARCHAR(50) DEFAULT NULL COMMENT '单位',
        category VARCHAR(100) DEFAULT NULL COMMENT '分类',
        location VARCHAR(200) DEFAULT NULL COMMENT '存放位置',
        stock_quantity INT NOT NULL DEFAULT 0 COMMENT '库存数量',
        safety_stock INT NOT NULL DEFAULT 0 COMMENT '安全库存',
        unit_price DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '单价',
        supplier VARCHAR(200) DEFAULT NULL COMMENT '供应商',
        remark VARCHAR(500) DEFAULT NULL COMMENT '备注',
        image_url VARCHAR(500) DEFAULT NULL COMMENT '备件图片URL',
        manufacturer VARCHAR(200) DEFAULT NULL COMMENT '制造商',
        brand VARCHAR(200) DEFAULT NULL COMMENT '品牌',
        model_number VARCHAR(200) DEFAULT NULL COMMENT '型号(厂家型号)',
        batch_no VARCHAR(100) DEFAULT NULL COMMENT '批次号',
        serial_number VARCHAR(100) DEFAULT NULL COMMENT '序列号',
        production_date DATE DEFAULT NULL COMMENT '出厂日期',
        expiry_date DATE DEFAULT NULL COMMENT '过期日期',
        warranty_until DATE DEFAULT NULL COMMENT '保修期至',
        last_inbound_at TIMESTAMP NULL DEFAULT NULL COMMENT '最后入库时间',
        last_outbound_at TIMESTAMP NULL DEFAULT NULL COMMENT '最后出库时间',
        status VARCHAR(20) NOT NULL DEFAULT 'active' COMMENT '状态 active/deleted',
        created_by_id INT DEFAULT NULL COMMENT '创建人',
        created_by_name VARCHAR(100) DEFAULT NULL COMMENT '创建人姓名',
        updated_by_id INT DEFAULT NULL COMMENT '更新人',
        updated_by_name VARCHAR(100) DEFAULT NULL COMMENT '更新人姓名',
        created_at TIMESTAMP NULL DEFAULT NULL COMMENT '创建时间',
        updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
        PRIMARY KEY (id),
        UNIQUE KEY uk_tenant_code (tenant_id, part_code),
        KEY idx_tenant_status (tenant_id, status),
        KEY idx_tenant_category (tenant_id, category),
        KEY idx_tenant_low_stock (tenant_id, stock_quantity, safety_stock)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='备件台账'`);
      logger.info('spare_parts 表检查/创建成功');
      spConn.release();
    } catch (spErr) {
      logger.warn('spare_parts 表检查/创建跳过:', spErr.message);
    }

    // 备件出入库流水
    try {
      const sptConn = await db.getConnection();
      await sptConn.execute(`CREATE TABLE IF NOT EXISTS spare_part_transactions (
        id INT NOT NULL AUTO_INCREMENT,
        tenant_id INT NOT NULL COMMENT '租户ID',
        part_id INT NOT NULL COMMENT '备件ID',
        transaction_no VARCHAR(50) DEFAULT NULL COMMENT '流水号 TXN-YYYYMMDD-NNNN',
        transaction_type VARCHAR(20) NOT NULL COMMENT 'inbound/outbound/adjust',
        quantity INT NOT NULL DEFAULT 0 COMMENT '数量(正数)',
        before_quantity INT NOT NULL DEFAULT 0 COMMENT '操作前库存',
        after_quantity INT NOT NULL DEFAULT 0 COMMENT '操作后库存',
        unit_price_at_tx DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '操作时单价',
        total_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00 COMMENT '操作总金额',
        related_order_type VARCHAR(50) DEFAULT NULL COMMENT '关联业务类型 maintenance/acceptance/...',
        related_order_id VARCHAR(100) DEFAULT NULL COMMENT '关联业务单号',
        operator_id INT DEFAULT NULL COMMENT '操作人ID',
        operator_name VARCHAR(100) DEFAULT NULL COMMENT '操作人姓名',
        operator_ip VARCHAR(64) DEFAULT NULL COMMENT '操作人IP',
        remark VARCHAR(500) DEFAULT NULL COMMENT '备注',
        transaction_time TIMESTAMP NULL DEFAULT NULL COMMENT '发生时间',
        PRIMARY KEY (id),
        UNIQUE KEY uk_txn_no (tenant_id, transaction_no),
        KEY idx_tenant_part (tenant_id, part_id),
        KEY idx_tenant_type (tenant_id, transaction_type),
        KEY idx_tenant_time (tenant_id, transaction_time),
        KEY idx_tenant_order (tenant_id, related_order_type, related_order_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='备件出入库流水'`);
      logger.info('spare_part_transactions 表检查/创建成功');
      sptConn.release();
    } catch (sptErr) {
      logger.warn('spare_part_transactions 表检查/创建跳过:', sptErr.message);
    }

    // 备件库存盘点调整记录（独立于出入库流水）
    try {
      const spaConn = await db.getConnection();
      await spaConn.execute(`CREATE TABLE IF NOT EXISTS spare_part_stock_adjustments (
        id INT NOT NULL AUTO_INCREMENT,
        tenant_id INT NOT NULL COMMENT '租户ID',
        part_id INT NOT NULL COMMENT '备件ID',
        adjustment_type VARCHAR(20) NOT NULL COMMENT 'increase/decrease 盘盈/盘亏',
        quantity INT NOT NULL DEFAULT 0 COMMENT '调整数量(正数)',
        before_quantity INT NOT NULL DEFAULT 0 COMMENT '调整前库存',
        after_quantity INT NOT NULL DEFAULT 0 COMMENT '调整后库存',
        reason VARCHAR(500) DEFAULT NULL COMMENT '原因(盘盈/盘亏/损坏/过期/...',
        operator_id INT DEFAULT NULL COMMENT '操作人ID',
        operator_name VARCHAR(100) DEFAULT NULL COMMENT '操作人姓名',
        remark VARCHAR(500) DEFAULT NULL COMMENT '备注',
        created_at TIMESTAMP NULL DEFAULT NULL COMMENT '创建时间',
        PRIMARY KEY (id),
        KEY idx_tenant_part (tenant_id, part_id),
        KEY idx_tenant_type (tenant_id, adjustment_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='备件库存调整记录'`);
      logger.info('spare_part_stock_adjustments 表检查/创建成功');
      spaConn.release();
    } catch (spaErr) {
      logger.warn('spare_part_stock_adjustments 表检查/创建跳过:', spaErr.message);
    }

    // 备件-适用设备多对多关联表
    try {
      const spadConn = await db.getConnection();
      await spadConn.execute(`CREATE TABLE IF NOT EXISTS spare_part_apply_devices (
        id INT NOT NULL AUTO_INCREMENT,
        tenant_id INT NOT NULL COMMENT '租户ID',
        part_id INT NOT NULL COMMENT '备件ID',
        device_id INT NOT NULL COMMENT '资产ID',
        device_code VARCHAR(100) DEFAULT NULL COMMENT '资产编码(冗余)',
        device_name VARCHAR(200) DEFAULT NULL COMMENT '资产名称(冗余)',
        remark VARCHAR(200) DEFAULT NULL COMMENT '备注',
        created_at TIMESTAMP NULL DEFAULT NULL COMMENT '创建时间',
        PRIMARY KEY (id),
        UNIQUE KEY uk_tenant_part_device (tenant_id, part_id, device_id),
        KEY idx_tenant_part (tenant_id, part_id),
        KEY idx_tenant_device (tenant_id, device_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='备件-适用设备关联'`);
      logger.info('spare_part_apply_devices 表检查/创建成功');
      spadConn.release();
    } catch (spadErr) {
      logger.warn('spare_part_apply_devices 表检查/创建跳过:', spadErr.message);
    }

    // 备件流水号序列表（按天递增，保证流水号唯一）
    try {
      const sptxConn = await db.getConnection();
      await sptxConn.execute(`CREATE TABLE IF NOT EXISTS spare_part_txn_sequence (
        id INT PRIMARY KEY AUTO_INCREMENT,
        tenant_id INT NOT NULL COMMENT '租户ID',
        date_key VARCHAR(8) NOT NULL COMMENT '日期键 YYYYMMDD',
        sequence_value BIGINT NOT NULL DEFAULT 1 COMMENT '当日序号',
        UNIQUE KEY uk_tenant_date (tenant_id, date_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='备件流水号序列表'`);
      logger.info('spare_part_txn_sequence 表检查/创建成功');
      sptxConn.release();
    } catch (sptxErr) {
      logger.warn('spare_part_txn_sequence 表检查/创建跳过:', sptxErr.message);
    }

    // 备件出库/调整审批表（2026-07-17 配件库完善-Phase C）
    try {
      const apprConn = await db.getConnection();
      await apprConn.execute(`CREATE TABLE IF NOT EXISTS spare_part_approvals (
        id INT NOT NULL AUTO_INCREMENT,
        tenant_id INT NOT NULL COMMENT '租户ID',
        part_id INT NOT NULL COMMENT '备件ID',
        action_type VARCHAR(20) NOT NULL COMMENT 'stock_out / adjust',
        quantity INT NOT NULL DEFAULT 0 COMMENT '数量(出库为正数,调整可为正/负)',
        adjustment_type VARCHAR(20) DEFAULT NULL COMMENT 'adjust时:increase/decrease',
        before_quantity INT NOT NULL DEFAULT 0 COMMENT '请求时库存(冻结快照)',
        reason VARCHAR(500) DEFAULT NULL COMMENT '申请原因',
        related_order_type VARCHAR(50) DEFAULT NULL COMMENT '关联业务类型(maintenance...)',
        related_order_id INT DEFAULT NULL COMMENT '关联业务ID(如工单ID)',
        requester_id INT DEFAULT NULL COMMENT '申请人ID',
        requester_name VARCHAR(100) DEFAULT NULL COMMENT '申请人姓名',
        approver_id INT DEFAULT NULL COMMENT '审批人ID',
        approver_name VARCHAR(100) DEFAULT NULL COMMENT '审批人姓名',
        status VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT 'pending/approved/rejected/cancelled',
        approved_quantity INT DEFAULT NULL COMMENT '实际批准数量(可与申请不同)',
        process_remark VARCHAR(500) DEFAULT NULL COMMENT '审批意见',
        processed_at TIMESTAMP NULL DEFAULT NULL COMMENT '审批时间',
        operator_ip VARCHAR(64) DEFAULT NULL COMMENT '申请人IP',
        created_at TIMESTAMP NULL DEFAULT NULL COMMENT '创建时间',
        updated_at TIMESTAMP NULL DEFAULT NULL COMMENT '更新时间',
        PRIMARY KEY (id),
        KEY idx_tenant_status (tenant_id, status),
        KEY idx_tenant_part (tenant_id, part_id),
        KEY idx_tenant_requester (tenant_id, requester_id),
        KEY idx_tenant_order (tenant_id, related_order_type, related_order_id),
        KEY idx_tenant_created (tenant_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='备件出库/调整审批记录'`);
      logger.info('spare_part_approvals 表检查/创建成功');
      apprConn.release();
    } catch (apprErr) {
      logger.warn('spare_part_approvals 表检查/创建跳过:', apprErr.message);
    }

    // 2026-07-17 配件库完善-Phase A: work_order_materials 关联备件字段
    // 表初始建表不在 server.js,这里幂等加列(若已存在则跳过)
    const workOrderMaterialColumns = [
      { name: 'part_id', sql: "ALTER TABLE work_order_materials ADD COLUMN part_id INT DEFAULT NULL COMMENT '关联备件ID(NULL=手填材料)' AFTER work_order_id" },
      { name: 'part_code', sql: "ALTER TABLE work_order_materials ADD COLUMN part_code VARCHAR(100) DEFAULT NULL COMMENT '备件编码(冗余)' AFTER part_id" },
      { name: 'part_name', sql: "ALTER TABLE work_order_materials ADD COLUMN part_name VARCHAR(200) DEFAULT NULL COMMENT '备件名称(冗余)' AFTER part_code" },
    ];
    for (const col of workOrderMaterialColumns) {
      try {
        const wmConn = await db.getConnection();
        const [exists] = await wmConn.execute(
          "SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'work_order_materials' AND column_name = ?",
          [col.name],
        );
        if (exists.length === 0) {
          await wmConn.execute(col.sql);
          logger.info(`work_order_materials.${col.name} 列添加成功`);
        }
        wmConn.release();
      } catch (wmErr) {
        logger.warn(`work_order_materials.${col.name} 跳过:`, wmErr.message);
      }
    }
    // 索引单独加
    const workOrderMaterialIndexes = [
      'idx_tenant_part',
      'idx_workorder_part',
    ];
    for (const idx of workOrderMaterialIndexes) {
      try {
        const wmiConn = await db.getConnection();
        const [idxExists] = await wmiConn.execute(
          "SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'work_order_materials' AND index_name = ?",
          [idx],
        );
        if (idxExists.length === 0) {
          const idxCols = idx === 'idx_tenant_part' ? '(tenant_id, part_id)' : '(work_order_id, part_id)';
          await wmiConn.execute(`ALTER TABLE work_order_materials ADD INDEX ${idx} ${idxCols}`);
          logger.info(`work_order_materials.${idx} 索引添加成功`);
        }
        wmiConn.release();
      } catch (idxErr) {
        logger.warn(`work_order_materials.${idx} 索引跳过:`, idxErr.message);
      }
    }

    // 临时保养记录
    try {
      const mtConn = await db.getConnection();
      await mtConn.execute(`CREATE TABLE IF NOT EXISTS maintenance_temporary_records (
        id INT NOT NULL AUTO_INCREMENT,
        tenant_id INT NOT NULL COMMENT '租户ID',
        asset_code VARCHAR(100) NOT NULL COMMENT '资产编码',
        asset_name VARCHAR(200) NOT NULL COMMENT '资产名称',
        department VARCHAR(100) DEFAULT NULL COMMENT '使用科室',
        maintenance_type VARCHAR(50) NOT NULL COMMENT '保养类型 清洁/紧固/润滑/调试/巡检保养/其他',
        maintenance_content TEXT DEFAULT NULL COMMENT '保养内容',
        maintenance_person VARCHAR(50) NOT NULL COMMENT '保养人',
        maintenance_person_id INT DEFAULT NULL COMMENT '保养人ID',
        maintenance_date DATE NOT NULL COMMENT '保养日期',
        maintenance_duration INT DEFAULT NULL COMMENT '耗时(分钟)',
        status VARCHAR(20) NOT NULL DEFAULT '已完成' COMMENT '已完成/进行中/已取消',
        result VARCHAR(20) NOT NULL DEFAULT '正常' COMMENT '正常/异常/待观察',
        next_maintenance_date DATE DEFAULT NULL COMMENT '下次保养日期',
        remark TEXT DEFAULT NULL COMMENT '备注',
        created_by VARCHAR(50) DEFAULT NULL COMMENT '创建人',
        created_at TIMESTAMP NULL DEFAULT NULL COMMENT '创建时间',
        updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
        PRIMARY KEY (id),
        KEY idx_tenant_asset (tenant_id, asset_code),
        KEY idx_tenant_date (tenant_id, maintenance_date),
        KEY idx_tenant_status (tenant_id, status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='临时保养记录'`);
      logger.info('maintenance_temporary_records 表检查/创建成功');
      mtConn.release();
    } catch (mtErr) {
      logger.warn('maintenance_temporary_records 表检查/创建跳过:', mtErr.message);
    }

    // PDCA 模板（pdca_templates）
    try {
      const pdcaTplConn = await db.getConnection();
      const [pdcaTplTbl] = await pdcaTplConn.execute(
        "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pdca_templates'",
      );
      if (pdcaTplTbl.length === 0) {
        await pdcaTplConn.execute(`
          CREATE TABLE pdca_templates (
            id INT AUTO_INCREMENT PRIMARY KEY,
            tenant_id INT NOT NULL COMMENT '租户ID',
            name VARCHAR(120) NOT NULL COMMENT '模板名称',
            code VARCHAR(80) NOT NULL COMMENT '模板编码(租户内唯一)',
            description VARCHAR(500) DEFAULT NULL COMMENT '描述',
            is_active TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用',
            sort_order INT NOT NULL DEFAULT 0 COMMENT '排序',
            is_default TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否默认模板',
            plan_schema JSON DEFAULT NULL COMMENT 'Plan 阶段字段定义',
            do_schema JSON DEFAULT NULL COMMENT 'Do 阶段字段定义',
            check_schema JSON DEFAULT NULL COMMENT 'Check 阶段字段定义',
            act_schema JSON DEFAULT NULL COMMENT 'Act 阶段字段定义',
            created_by INT DEFAULT NULL,
            created_at TIMESTAMP NULL DEFAULT NULL,
            updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
            is_deleted TINYINT(1) NOT NULL DEFAULT 0,
            deleted_at DATETIME DEFAULT NULL,
            UNIQUE KEY uk_tenant_code (tenant_id, code),
            KEY idx_pdca_tpl_tenant (tenant_id),
            KEY idx_pdca_tpl_active (tenant_id, is_active)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='PDCA 模板'
        `);
        logger.info('pdca_templates 表创建完成');
      } else {
        logger.info('pdca_templates 表已存在，跳过创建');
      }
      pdcaTplConn.release();
    } catch (pdcaTplErr) {
      logger.warn('pdca_templates 表创建跳过:', pdcaTplErr.message);
    }

    // PDCA 记录（pdca_records）
    try {
      const pdcaRecConn = await db.getConnection();
      const [pdcaRecTbl] = await pdcaRecConn.execute(
        "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pdca_records'",
      );
      if (pdcaRecTbl.length === 0) {
        await pdcaRecConn.execute(`
          CREATE TABLE pdca_records (
            id INT AUTO_INCREMENT PRIMARY KEY,
            tenant_id INT NOT NULL COMMENT '租户ID',
            template_id INT NOT NULL COMMENT 'pdca_templates.id',
            title VARCHAR(200) NOT NULL COMMENT 'PDCA 主题',
            asset_code VARCHAR(100) DEFAULT NULL COMMENT '关联资产编码(可选)',
            asset_name VARCHAR(200) DEFAULT NULL COMMENT '关联资产名称',
            cycle_no INT NOT NULL DEFAULT 1 COMMENT '循环编号(同一主题多轮改进)',
            start_date DATE DEFAULT NULL COMMENT '起始日期',
            end_date DATE DEFAULT NULL COMMENT '结束日期',
            plan_content JSON DEFAULT NULL COMMENT 'Plan 阶段实际录入数据',
            do_content JSON DEFAULT NULL COMMENT 'Do 阶段实际录入数据',
            check_content JSON DEFAULT NULL COMMENT 'Check 阶段实际录入数据',
            act_content JSON DEFAULT NULL COMMENT 'Act 阶段实际录入数据',
            conclusion TEXT DEFAULT NULL COMMENT '总体结论',
            status VARCHAR(20) NOT NULL DEFAULT 'draft' COMMENT 'draft/in_progress/completed/archived',
            is_closed TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否关闭当前循环',
            closed_at DATETIME DEFAULT NULL,
            closed_by INT DEFAULT NULL,
            parent_record_id INT DEFAULT NULL COMMENT '上一轮记录ID(用于多轮追溯)',
            source_type VARCHAR(40) DEFAULT NULL COMMENT '业务源类型(workorder/adverse_event/...)',
            source_id INT DEFAULT NULL COMMENT '业务源ID',
            created_by INT DEFAULT NULL,
            created_at TIMESTAMP NULL DEFAULT NULL,
            updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
            is_deleted TINYINT(1) NOT NULL DEFAULT 0,
            deleted_at DATETIME DEFAULT NULL,
            KEY idx_pdca_rec_tenant (tenant_id),
            KEY idx_pdca_rec_template (tenant_id, template_id),
            KEY idx_pdca_rec_status (tenant_id, status),
            KEY idx_pdca_rec_updated (tenant_id, updated_at)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='PDCA 记录'
        `);
        logger.info('pdca_records 表创建完成');
      } else {
        logger.info('pdca_records 表已存在，跳过创建');
      }
      // 幂等补列: parent_record_id (下一轮追溯)
      try {
        const [colExists] = await pdcaRecConn.execute(
          "SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'pdca_records' AND column_name = 'parent_record_id'",
        );
        if (colExists.length === 0) {
          await pdcaRecConn.execute(
            "ALTER TABLE pdca_records ADD COLUMN parent_record_id INT DEFAULT NULL COMMENT '上一轮记录ID' AFTER closed_by",
          );
          await pdcaRecConn.execute(
            "ALTER TABLE pdca_records ADD INDEX idx_pdca_rec_parent (tenant_id, parent_record_id)",
          );
          logger.info('pdca_records.parent_record_id 列添加成功');
        }
      } catch (prColErr) {
        logger.warn('pdca_records.parent_record_id 跳过:', prColErr.message);
      }
      pdcaRecConn.release();
    } catch (pdcaRecErr) {
      logger.warn('pdca_records 表创建跳过:', pdcaRecErr.message);
    }
    // 幂等补列: source_type / source_id (业务源关联)
    try {
      const pdcaSrcConn = await db.getConnection();
      for (const col of ['source_type', 'source_id']) {
        const [ex] = await pdcaSrcConn.execute(
          "SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'pdca_records' AND column_name = ?",
          [col],
        );
        if (ex.length === 0) {
          const def = col === 'source_type'
            ? "VARCHAR(40) DEFAULT NULL COMMENT '业务源类型'"
            : "INT DEFAULT NULL COMMENT '业务源ID'";
          await pdcaSrcConn.execute(`ALTER TABLE pdca_records ADD COLUMN ${col} ${def}`);
          logger.info(`pdca_records.${col} 列添加成功`);
        }
      }
      await pdcaSrcConn.execute(
        "ALTER TABLE pdca_records ADD INDEX idx_pdca_rec_source (tenant_id, source_type, source_id)",
      );
      pdcaSrcConn.release();
    } catch (srcErr) {
      logger.warn('pdca_records.source_* 列跳过:', srcErr.message);
    }

    // 幂等补列: auditor_signature / auditor_name / audited_at (审核留痕)
    try {
      const pdcaAudConn = await db.getConnection();
      for (const col of [
        { name: 'auditor_signature', def: "MEDIUMTEXT DEFAULT NULL COMMENT '审核人手写签名(Canvas base64 PNG)'" },
        { name: 'auditor_name', def: "VARCHAR(100) DEFAULT NULL COMMENT '审核人姓名'" },
        { name: 'audited_at', def: "DATETIME DEFAULT NULL COMMENT '审核时间'" },
      ]) {
        const [ex] = await pdcaAudConn.execute(
          "SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'pdca_records' AND column_name = ?",
          [col.name],
        );
        if (ex.length === 0) {
          await pdcaAudConn.execute(`ALTER TABLE pdca_records ADD COLUMN ${col.name} ${col.def}`);
          logger.info(`pdca_records.${col.name} 列添加成功`);
        }
      }
      pdcaAudConn.release();
    } catch (audErr) {
      logger.warn('pdca_records.auditor_* 跳过:', audErr.message);
    }

    // PDCA 模板版本快照 (pdca_template_versions) - 每次 updateTemplate 写一份历史
    try {
      const pdcaVerConn = await db.getConnection();
      const [verTbl] = await pdcaVerConn.execute(
        "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pdca_template_versions'",
      );
      if (verTbl.length === 0) {
        await pdcaVerConn.execute(`
          CREATE TABLE pdca_template_versions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            tenant_id INT NOT NULL,
            template_id INT NOT NULL,
            version_no INT NOT NULL DEFAULT 1 COMMENT '版本号(同 template 内递增)',
            name VARCHAR(120) NOT NULL,
            code VARCHAR(80) NOT NULL,
            description VARCHAR(500) DEFAULT NULL,
            is_active TINYINT(1) NOT NULL DEFAULT 1,
            plan_schema JSON DEFAULT NULL,
            do_schema JSON DEFAULT NULL,
            check_schema JSON DEFAULT NULL,
            act_schema JSON DEFAULT NULL,
            change_note VARCHAR(500) DEFAULT NULL COMMENT '本次变更说明',
            created_by INT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            KEY idx_pdca_ver_tenant (tenant_id),
            KEY idx_pdca_ver_tpl (template_id, version_no)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='PDCA 模板版本快照'
        `);
        logger.info('pdca_template_versions 表创建完成');
      } else {
        logger.info('pdca_template_versions 表已存在，跳过创建');
      }
      pdcaVerConn.release();
    } catch (pdcaVerErr) {
      logger.warn('pdca_template_versions 表创建跳过:', pdcaVerErr.message);
    }

    // 分级保养模板表：补齐 service 写入但建表时缺失的列（幂等，逐列探测后 ALTER）
    try {
      const mltConn = await db.getConnection();
      const mltAdds = [
        ['asset_type', 'VARCHAR(100) DEFAULT NULL COMMENT \'适用资产类型\''],
        ['risk_level', 'VARCHAR(50) DEFAULT NULL COMMENT \'风险等级\''],
        ['cycle_type', 'VARCHAR(20) DEFAULT NULL COMMENT \'周期类型 day/week/month/quarter/year\''],
        ['required_tools', 'TEXT DEFAULT NULL COMMENT \'所需工具\''],
        ['required_materials', 'TEXT DEFAULT NULL COMMENT \'所需物料\''],
        ['estimated_hours', 'DECIMAL(8,2) DEFAULT NULL COMMENT \'预计工时(小时)\''],
        ['standards', 'TEXT DEFAULT NULL COMMENT \'执行标准\''],
        ['safety_requirements', 'TEXT DEFAULT NULL COMMENT \'安全要求\''],
      ];
      for (const [colName, colDef] of mltAdds) {
        try {
          const [exist] = await mltConn.execute(
            `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'maintenance_level_templates' AND COLUMN_NAME = ?`,
            [colName],
          );
          if (Number(exist[0].c) === 0) {
            await mltConn.execute(`ALTER TABLE maintenance_level_templates ADD COLUMN ${colName} ${colDef}`);
            logger.info(`maintenance_level_templates 新增列 ${colName}`);
          }
        } catch (colErr) {
          logger.warn('maintenance_level_templates 列补齐跳过:', colErr.message);
        }
      }
      mltConn.release();
      logger.info('maintenance_level_templates 列补齐完成');
    } catch (mltErr) {
      logger.warn('maintenance_level_templates 列补齐跳过:', mltErr.message);
    }

    // 验收记录：预验收状态 + 供应商协同字段（幂等，INFORMATION_SCHEMA 探测后变更）
    try {
      const accConn = await db.getConnection();
      const [statusCol] = await accConn.execute(
        `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asset_acceptance_records' AND COLUMN_NAME = 'status'`,
      );
      const statusType = statusCol[0]?.COLUMN_TYPE || '';
      if (statusType && !statusType.includes('预验收')) {
        await accConn.execute(
          `ALTER TABLE asset_acceptance_records MODIFY COLUMN status
           ENUM('待验收','验收中','已验收','验收不合格','预验收') NULL DEFAULT '待验收'
           COMMENT '待验收/验收中/已验收/验收不合格/预验收'`,
        );
        logger.info('asset_acceptance_records.status 枚举已加入 预验收');
      }
      const accAdds = [
        ['asset_id', 'INT NULL COMMENT \'关联资产ID\''],
        ['supplier_collaboration', 'TINYINT(1) NOT NULL DEFAULT 0 COMMENT \'是否供应商协同填写\''],
        ['supplier_token', 'VARCHAR(120) DEFAULT NULL COMMENT \'供应商协同填写令牌\''],
        ['supplier_filled_at', 'DATETIME DEFAULT NULL COMMENT \'供应商回填时间\''],
      ];
      for (const [col, def] of accAdds) {
        const [ex] = await accConn.execute(
          `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'asset_acceptance_records' AND COLUMN_NAME = ?`,
          [col],
        );
        if (Number(ex[0].c) === 0) {
          await accConn.execute(`ALTER TABLE asset_acceptance_records ADD COLUMN ${col} ${def}`);
          logger.info(`asset_acceptance_records 新增列 ${col}`);
        }
      }
      accConn.release();
      logger.info('asset_acceptance_records 预验收/供应商协同字段补齐完成');
    } catch (accErr) {
      logger.warn('asset_acceptance_records 字段补齐跳过:', accErr.message);
    }

    // =====================================================
    // 保修管理与保修合同联动 (2026-07-16) - 资产/申请/工单 双向打通
    // =====================================================
    try {
      const wConn = await db.getConnection();

      // 1. 建 warranty_claims 表 (工单完成时自动记录保修索赔)
      await wConn.execute(`
        CREATE TABLE IF NOT EXISTS warranty_claims (
          id INT NOT NULL AUTO_INCREMENT,
          tenant_id INT NOT NULL COMMENT '租户ID',
          claim_no VARCHAR(100) NOT NULL COMMENT '索赔单号',
          contract_id INT DEFAULT NULL COMMENT '关联合同ID',
          warranty_info_id INT DEFAULT NULL COMMENT '关联保修信息ID',
          work_order_id INT DEFAULT NULL COMMENT '关联工单ID',
          request_id INT DEFAULT NULL COMMENT '关联申请ID',
          asset_code VARCHAR(100) NOT NULL COMMENT '资产编号',
          asset_name VARCHAR(200) DEFAULT NULL COMMENT '资产名称',
          claim_type ENUM('保修维修','零件更换','现场服务','送修服务','其他') DEFAULT '保修维修' COMMENT '索赔类型',
          claim_amount DECIMAL(12,2) DEFAULT 0.00 COMMENT '索赔金额',
          claim_date DATE NOT NULL COMMENT '索赔日期',
          description TEXT DEFAULT NULL COMMENT '故障/索赔描述',
          status ENUM('待审核','已审核','已结算','已驳回') DEFAULT '待审核' COMMENT '索赔状态',
          supplier_name VARCHAR(200) DEFAULT NULL COMMENT '供应商/服务商',
          created_by VARCHAR(100) DEFAULT NULL COMMENT '创建人',
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uk_claim_no_tenant (claim_no, tenant_id),
          KEY idx_tenant (tenant_id),
          KEY idx_contract (contract_id),
          KEY idx_work_order (work_order_id),
          KEY idx_asset_code (asset_code),
          KEY idx_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='保修索赔记录表'
      `);
      logger.info('warranty_claims 表检查/创建成功');

      // 2. warranty_contracts 加统计字段
      const wcAdds = [
        ['used_repair_count', 'INT NOT NULL DEFAULT 0 COMMENT \'已用维修次数\''],
        ['total_claim_amount', 'DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT \'累计索赔金额\''],
        ['last_claim_date', 'DATE DEFAULT NULL COMMENT \'最近索赔日期\''],
      ];
      for (const [col, def] of wcAdds) {
        const [ex] = await wConn.execute(
          `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'warranty_contracts' AND COLUMN_NAME = ?`,
          [col],
        );
        if (Number(ex[0].c) === 0) {
          await wConn.execute(`ALTER TABLE warranty_contracts ADD COLUMN ${col} ${def}`);
          logger.info(`warranty_contracts 新增列 ${col}`);
        }
      }

      // 3. warranty_info 加统计字段
      const wiAdds = [
        ['used_repair_count', 'INT NOT NULL DEFAULT 0 COMMENT \'已用维修次数\''],
        ['last_repair_date', 'DATE DEFAULT NULL COMMENT \'最近维修日期\''],
      ];
      for (const [col, def] of wiAdds) {
        const [ex] = await wConn.execute(
          `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'warranty_info' AND COLUMN_NAME = ?`,
          [col],
        );
        if (Number(ex[0].c) === 0) {
          await wConn.execute(`ALTER TABLE warranty_info ADD COLUMN ${col} ${def}`);
          logger.info(`warranty_info 新增列 ${col}`);
        }
      }

      // 4. assets 加 warranty 状态字段 (assets 已有 warranty_period / warranty_end_date, 补 status + contract_id)
      const assetAdds = [
        ['warranty_status', 'VARCHAR(20) DEFAULT \'无\' COMMENT \'保修状态: 在保/即将到期/过保/待确认/无\''],
        ['warranty_contract_id', 'INT DEFAULT NULL COMMENT \'当前生效合同ID\''],
      ];
      for (const [col, def] of assetAdds) {
        const [ex] = await wConn.execute(
          `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assets' AND COLUMN_NAME = ?`,
          [col],
        );
        if (Number(ex[0].c) === 0) {
          await wConn.execute(`ALTER TABLE assets ADD COLUMN ${col} ${def}`);
          logger.info(`assets 新增列 ${col}`);
        }
      }

      // 5. maintenance_requests 加 in_warranty + warranty_contract_id
      const rqAdds = [
        ['in_warranty', 'TINYINT(1) NOT NULL DEFAULT 0 COMMENT \'是否在保 (0=否, 1=是)\''],
        ['warranty_contract_id', 'INT DEFAULT NULL COMMENT \'保修合同ID\''],
      ];
      for (const [col, def] of rqAdds) {
        const [ex] = await wConn.execute(
          `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'maintenance_requests' AND COLUMN_NAME = ?`,
          [col],
        );
        if (Number(ex[0].c) === 0) {
          await wConn.execute(`ALTER TABLE maintenance_requests ADD COLUMN ${col} ${def}`);
          logger.info(`maintenance_requests 新增列 ${col}`);
        }
      }

      // 6. work_orders 加 in_warranty + warranty_contract_id
      const woAdds = [
        ['in_warranty', 'TINYINT(1) NOT NULL DEFAULT 0 COMMENT \'是否在保 (0=否, 1=是)\''],
        ['warranty_contract_id', 'INT DEFAULT NULL COMMENT \'保修合同ID\''],
      ];
      for (const [col, def] of woAdds) {
        const [ex] = await wConn.execute(
          `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'work_orders' AND COLUMN_NAME = ?`,
          [col],
        );
        if (Number(ex[0].c) === 0) {
          await wConn.execute(`ALTER TABLE work_orders ADD COLUMN ${col} ${def}`);
          logger.info(`work_orders 新增列 ${col}`);
        }
      }

      wConn.release();
      logger.info('保修联动字段补齐完成 (warranty_claims + 5 张表)');
    } catch (wErr) {
      logger.warn('保修联动字段补齐跳过:', wErr.message);
    }

    // ========== 统一合同管理模块 ==========
    // 1. 资产合同表
    try {
      const acConn = await db.getConnection();
      await acConn.execute(`CREATE TABLE IF NOT EXISTS asset_contracts (
        id INT NOT NULL AUTO_INCREMENT,
        tenant_id INT NOT NULL COMMENT '租户ID',
        contract_no VARCHAR(100) NOT NULL COMMENT '合同编号',
        contract_name VARCHAR(255) NOT NULL COMMENT '合同名称',
        contract_type VARCHAR(50) NOT NULL DEFAULT 'purchase' COMMENT '合同类型: purchase(采购)/lease(租赁)/donation(捐赠)/transfer(调拨)/other',
        supplier_name VARCHAR(200) DEFAULT NULL COMMENT '供应商名称',
        supplier_contact VARCHAR(200) DEFAULT NULL COMMENT '供应商联系方式',
        contract_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00 COMMENT '合同金额',
        currency VARCHAR(10) DEFAULT 'CNY' COMMENT '币种',
        sign_date DATE DEFAULT NULL COMMENT '签订日期',
        start_date DATE DEFAULT NULL COMMENT '开始日期',
        end_date DATE DEFAULT NULL COMMENT '结束日期',
        department VARCHAR(100) DEFAULT NULL COMMENT '所属部门',
        contact_person VARCHAR(100) DEFAULT NULL COMMENT '联系人',
        contact_phone VARCHAR(50) DEFAULT NULL COMMENT '联系电话',
        payment_terms TEXT COMMENT '付款条款',
        coverage_scope TEXT COMMENT '合同范围描述',
        file_path VARCHAR(1000) DEFAULT NULL COMMENT '合同文件路径',
        status VARCHAR(30) NOT NULL DEFAULT 'draft' COMMENT '状态: draft/signed/executing/expired/terminated/archived',
        remark TEXT COMMENT '备注',
        created_by INT DEFAULT NULL COMMENT '创建人ID',
        created_by_name VARCHAR(100) DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL DEFAULT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uk_contract_no_tenant (tenant_id, contract_no),
        KEY idx_tenant_status (tenant_id, status),
        KEY idx_tenant_type (tenant_id, contract_type),
        KEY idx_tenant_supplier (tenant_id, supplier_name),
        KEY idx_tenant_date (tenant_id, end_date),
        KEY idx_deleted (deleted_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='资产合同表'`);
      logger.info('asset_contracts 表检查/创建成功');
      acConn.release();
    } catch (acErr) {
      logger.warn('asset_contracts 表检查/创建跳过:', acErr.message);
    }

    // 2. 维修服务合同表
    try {
      const mscConn = await db.getConnection();
      await mscConn.execute(`CREATE TABLE IF NOT EXISTS maintenance_service_contracts (
        id INT NOT NULL AUTO_INCREMENT,
        tenant_id INT NOT NULL COMMENT '租户ID',
        contract_no VARCHAR(100) NOT NULL COMMENT '合同编号',
        contract_name VARCHAR(255) NOT NULL COMMENT '合同名称',
        service_type VARCHAR(50) NOT NULL DEFAULT 'comprehensive' COMMENT '服务类型: preventive(预防性)/corrective(纠正性)/comprehensive(综合)/emergency(应急)/other',
        supplier_name VARCHAR(200) DEFAULT NULL COMMENT '服务商名称',
        supplier_contact VARCHAR(200) DEFAULT NULL COMMENT '服务商联系方式',
        contract_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00 COMMENT '合同金额',
        currency VARCHAR(10) DEFAULT 'CNY' COMMENT '币种',
        sign_date DATE DEFAULT NULL COMMENT '签订日期',
        start_date DATE DEFAULT NULL COMMENT '开始日期',
        end_date DATE DEFAULT NULL COMMENT '结束日期',
        department VARCHAR(100) DEFAULT NULL COMMENT '所属部门',
        contact_person VARCHAR(100) DEFAULT NULL COMMENT '联系人',
        contact_phone VARCHAR(50) DEFAULT NULL COMMENT '联系电话',
        service_scope TEXT COMMENT '服务范围',
        service_level VARCHAR(200) DEFAULT NULL COMMENT '服务级别(SLA)',
        response_time VARCHAR(100) DEFAULT NULL COMMENT '响应时间要求',
        payment_terms TEXT COMMENT '付款条款',
        file_path VARCHAR(1000) DEFAULT NULL COMMENT '合同文件路径',
        status VARCHAR(30) NOT NULL DEFAULT 'draft' COMMENT '状态: draft/signed/executing/expired/terminated/archived',
        remark TEXT COMMENT '备注',
        created_by INT DEFAULT NULL COMMENT '创建人ID',
        created_by_name VARCHAR(100) DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL DEFAULT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uk_contract_no_tenant (tenant_id, contract_no),
        KEY idx_tenant_status (tenant_id, status),
        KEY idx_tenant_type (tenant_id, service_type),
        KEY idx_tenant_supplier (tenant_id, supplier_name),
        KEY idx_tenant_date (tenant_id, end_date),
        KEY idx_deleted (deleted_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='维修服务合同表'`);
      logger.info('maintenance_service_contracts 表检查/创建成功');
      mscConn.release();
    } catch (mscErr) {
      logger.warn('maintenance_service_contracts 表检查/创建跳过:', mscErr.message);
    }

    // 3. 配件合同表
    try {
      const pcConn = await db.getConnection();
      await pcConn.execute(`CREATE TABLE IF NOT EXISTS parts_contracts (
        id INT NOT NULL AUTO_INCREMENT,
        tenant_id INT NOT NULL COMMENT '租户ID',
        contract_no VARCHAR(100) NOT NULL COMMENT '合同编号',
        contract_name VARCHAR(255) NOT NULL COMMENT '合同名称',
        contract_type VARCHAR(50) NOT NULL DEFAULT 'supply' COMMENT '合同类型: supply(供货)/framework(框架)/single(单次)/other',
        supplier_name VARCHAR(200) DEFAULT NULL COMMENT '供应商名称',
        supplier_contact VARCHAR(200) DEFAULT NULL COMMENT '供应商联系方式',
        contract_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00 COMMENT '合同金额',
        currency VARCHAR(10) DEFAULT 'CNY' COMMENT '币种',
        sign_date DATE DEFAULT NULL COMMENT '签订日期',
        start_date DATE DEFAULT NULL COMMENT '开始日期',
        end_date DATE DEFAULT NULL COMMENT '结束日期',
        department VARCHAR(100) DEFAULT NULL COMMENT '所属部门',
        contact_person VARCHAR(100) DEFAULT NULL COMMENT '联系人',
        contact_phone VARCHAR(50) DEFAULT NULL COMMENT '联系电话',
        parts_scope TEXT COMMENT '配件范围描述',
        payment_terms TEXT COMMENT '付款条款',
        file_path VARCHAR(1000) DEFAULT NULL COMMENT '合同文件路径',
        status VARCHAR(30) NOT NULL DEFAULT 'draft' COMMENT '状态: draft/signed/executing/expired/terminated/archived',
        remark TEXT COMMENT '备注',
        created_by INT DEFAULT NULL COMMENT '创建人ID',
        created_by_name VARCHAR(100) DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL DEFAULT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uk_contract_no_tenant (tenant_id, contract_no),
        KEY idx_tenant_status (tenant_id, status),
        KEY idx_tenant_type (tenant_id, contract_type),
        KEY idx_tenant_supplier (tenant_id, supplier_name),
        KEY idx_tenant_date (tenant_id, end_date),
        KEY idx_deleted (deleted_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='配件合同表'`);
      logger.info('parts_contracts 表检查/创建成功');
      pcConn.release();
    } catch (pcErr) {
      logger.warn('parts_contracts 表检查/创建跳过:', pcErr.message);
    }

    // 4. 合同-资产关联表 (多对多)
    try {
      const calConn = await db.getConnection();
      await calConn.execute(`CREATE TABLE IF NOT EXISTS contract_asset_links (
        id INT NOT NULL AUTO_INCREMENT,
        tenant_id INT NOT NULL COMMENT '租户ID',
        contract_type VARCHAR(50) NOT NULL COMMENT '合同类型: asset_contract/maintenance_service/parts/tender/warranty',
        contract_id INT NOT NULL COMMENT '合同ID',
        asset_code VARCHAR(100) NOT NULL COMMENT '资产编号',
        asset_name VARCHAR(200) DEFAULT NULL COMMENT '资产名称',
        link_type VARCHAR(50) NOT NULL DEFAULT 'covered' COMMENT '关联类型: covered(覆盖)/purchased(采购)/related(相关)',
        created_by INT DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_link (tenant_id, contract_type, contract_id, asset_code),
        KEY idx_tenant_contract (tenant_id, contract_type, contract_id),
        KEY idx_tenant_asset (tenant_id, asset_code),
        KEY idx_contract_type_id (contract_type, contract_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='合同-资产关联表'`);
      logger.info('contract_asset_links 表检查/创建成功');
      calConn.release();
    } catch (calErr) {
      logger.warn('contract_asset_links 表检查/创建跳过:', calErr.message);
    }

    // 5. 合同全局关联表
    try {
      const caConn = await db.getConnection();
      await caConn.execute(`CREATE TABLE IF NOT EXISTS contract_associations (
        id INT NOT NULL AUTO_INCREMENT,
        tenant_id INT NOT NULL COMMENT '租户ID',
        source_contract_type VARCHAR(50) NOT NULL COMMENT '源合同类型: asset_contract/maintenance_service/parts/tender/warranty',
        source_contract_id INT NOT NULL COMMENT '源合同ID',
        target_contract_type VARCHAR(50) NOT NULL COMMENT '目标合同类型',
        target_contract_id INT NOT NULL COMMENT '目标合同ID',
        association_type VARCHAR(50) NOT NULL DEFAULT 'related' COMMENT '关联类型: parent_child(父子)/related(关联)/depends_on(依赖)/supersedes(替代)/bundled(捆绑)',
        remark VARCHAR(500) DEFAULT NULL COMMENT '关联说明',
        created_by INT DEFAULT NULL,
        created_by_name VARCHAR(100) DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_association (tenant_id, source_contract_type, source_contract_id, target_contract_type, target_contract_id),
        KEY idx_tenant_source (tenant_id, source_contract_type, source_contract_id),
        KEY idx_tenant_target (tenant_id, target_contract_type, target_contract_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='合同全局关联表'`);
      logger.info('contract_associations 表检查/创建成功');

      // 补齐 updated_at 列（历史表缺失该列，导致关联反向插入 ON DUPLICATE KEY UPDATE updated_at 失败）
      const [uaCol] = await caConn.execute(
        `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'contract_associations' AND COLUMN_NAME = 'updated_at'`,
      );
      if (Number(uaCol[0].c) === 0) {
        await caConn.execute(`ALTER TABLE contract_associations ADD COLUMN updated_at DATETIME DEFAULT NULL COMMENT '更新时间'`);
        logger.info('contract_associations 补齐 updated_at 列');
      }
      caConn.release();
    } catch (caErr) {
      logger.warn('contract_associations 表检查/创建跳过:', caErr.message);
    }

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
  initDatabase().then(() => {
    // 数据库初始化完成后，预加载系统配置到内存缓存
    const sysConfig = require('./services/system-config.service');
    sysConfig.loadAllConfigs().then(() => {
      logger.info('系统配置已加载到内存缓存');
      // 预加载 SMS 配置（供后续短信服务使用）
      const smsService = require('./services/sms-code-service');
      smsService.loadSmsConfig().catch(() => {});
    }).catch(err => {
      logger.warn('系统配置缓存预加载失败:', err.message);
    });

    // 启动时同步菜单定义(幂等: 已存在则 ON DUPLICATE KEY UPDATE, 新增则 INSERT)
    // 避免新增菜单项后必须人工触发 /api/roles-permissions/menus/force-update
    try {
      const rolesPermsRouter = require('./routes/roles-permissions');
      if (typeof rolesPermsRouter.forceUpdateMenus === 'function') {
        rolesPermsRouter
          .forceUpdateMenus()
          .then(() => logger.info('菜单定义启动同步完成'))
          .catch(err => logger.warn('菜单定义启动同步失败:', err.message));
      }
    } catch (menuErr) {
      logger.warn('菜单同步初始化失败:', menuErr.message);
    }
  });
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
  // 仅记录，不退出进程：未处理的 Promise 拒绝通常是非致命的（fire-and-forget 异步、Socket.IO 回调等），
  // 直接退出会导致整个后端因单个漏网 rejection 而宕机。进程状态仍然可控，继续运行更安全。
  logger.error('未处理的 Promise 拒绝(已忽略, 进程继续运行):', reason);
  logger.error('Promise:', promise);
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
app.use('/api/in-app-notifications', require('./routes/in-app-notifications'));
app.use('/api/recipient-strategies', require('./routes/recipient-strategies'));
app.use('/api/notification-preferences', require('./routes/notification-preferences'));
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
// 资产调拨 (transfer-requests 等) - 已统一迁移到 /api/asset-allocation（routes/asset-allocation.js）
// 老路由 /api/assets/transfer-requests、/api/assets/:id/transfer-apply 已下线，避免双数据源风险
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
// 微信公众号绑定（与飞书二选一）
app.use('/api/wechat-mp', ...moduleRoute('/api/wechat-mp', 'wechat-mp-binding', require('./modules/wechat-mp-binding/routes/index')));
// IoT管理
app.use('/api/iot', ...moduleRoute('/api/iot', 'iot-management', require('./modules/iot-management/routes/index.js')));
// 技术文档
app.use('/api/technical-documents', ...moduleRoute('/api/technical-documents', 'technical-documents', require('./modules/technical-documents/routes/index')));
// 资产使用
app.use('/api/asset-usage', ...moduleRoute('/api/asset-usage', 'asset-usage-management', require('./modules/asset-usage-management/routes/index')));
app.use('/api/idle', ...moduleRoute('/api/idle', 'idle-asset-management', require('./modules/idle-asset-management/routes/index')));
// 预防性维护
app.use('/api/preventive-maintenance', ...moduleRoute('/api/preventive-maintenance', 'preventive-maintenance-management', require('./modules/preventive-maintenance-management/routes/index')));
// 日常维修（新模块化路由，前端仍使用 /api/maintenance 旧版路由，此路径供后续迁移使用）
app.use('/api/maintenance-management', ...moduleRoute('/api/maintenance-management', 'maintenance-management', require('./modules/maintenance-management/routes/index')));
// 保修管理（独立模块，从日常维修中拆出：合同/发票/付款/档案/保修信息/在保清单/提醒/统计）
app.use('/api/warranty', ...moduleRoute('/api/warranty', 'warranty-management', require('./modules/warranty-management/routes/index')));

// 统一合同管理（资产合同、维修服务合同、配件合同、全局关联）
app.use('/api/contracts', ...moduleRoute('/api/contracts', 'contract-management', require('./modules/contract-management/routes/index')));
// 验收管理（新模块化路由：验收申请工作流、模板CRUD、报告、统计扩展、提醒）
app.use('/api/acceptance-management', ...moduleRoute('/api/acceptance-management', 'acceptance-management', require('./modules/acceptance-management/routes/index')));
// 质量保证
app.use('/api/quality-assurance', ...moduleRoute('/api/quality-assurance', 'quality-assurance-management', require('./modules/quality-assurance-management/routes/index')));
// 阶段1质量重构：质控管理 模块 ID 统一为 quality-control（与菜单/API 路径一致）
app.use('/api/quality-control', ...moduleRoute('/api/quality-control', 'quality-control', require('./modules/quality-assurance-management/routes/index')));
// POCT 临床科室日常质控管理（早中晚班 + 手写签名 + 移动端 + 提醒通知）
app.use('/api/poct-quality-control', ...moduleRoute('/api/poct-quality-control', 'poct-quality-control', require('./modules/poct-quality-control/routes/index')));
// 不良事件管理（模块化路由：CRUD/审批/工作流/统计/根因分析/预防措施/监管上报）
app.use('/api/adverse-reaction', ...moduleRoute('/api/adverse-reaction', 'adverse-event', require('./modules/adverse-event/routes/index')));
// 阶段1质量重构：计量管理 模块 ID 统一为 metrology，路径 /api/metrology（替换原 /api/metrology-management）
app.use('/api/metrology', ...moduleRoute('/api/metrology', 'metrology', require('./modules/metrology-management/routes/index')));
// AI资产助手
app.use('/api/asset-ai-assistant', ...moduleRoute('/api/asset-ai-assistant', 'asset-ai-assistant', require('./modules/asset-ai-assistant/routes/index')));
// 招标采购管理（资产购置招标文件制作 / 配件维修服务招标 / 供应商扫码上传资质）
app.use('/api/tendering', ...moduleRoute('/api/tendering', 'tendering-management', require('./modules/tendering-management/routes/index')));
// 供应商中心（独立模块：从 tendering 拆出，/api/supplier/*）
app.use('/api/supplier', ...moduleRoute('/api/supplier', 'supplier-management', require('./modules/supplier-management/routes/index')));
// 巡检管理（巡检模板/任务/规范巡检记录单/异常问题整改跟踪）
app.use('/api/inspection', ...moduleRoute('/api/inspection', 'inspection-management', require('./modules/inspection-management/routes/index')));
// 知识库管理（知识库 CRUD / 文档上传 / 解析 / 检索 / OpenClaw AI 问答）
app.use('/api/knowledge-base', ...moduleRoute('/api/knowledge-base', 'knowledge-base-management', require('./modules/knowledge-base/routes/index')));
// 备件库管理（备件台账 / 入库 / 出库 / 统计，支撑招标要求 11 与 5.3）
app.use('/api/spare-parts', ...moduleRoute('/api/spare-parts', 'spare-parts-management', require('./modules/spare-parts-management/routes/index')));
// 阶段3工单重构：临时保养 API 已并入 /api/preventive-maintenance/temporary（双写模式，表不动）
// 旧路径 /api/maintenance-temporary 保留 deprecation，引导前端迁移
app.use(
  '/api/maintenance-temporary',
  ...deprecatedRoute(
    '/api/maintenance-temporary',
    require('./modules/preventive-maintenance-management/routes/index'),
    '/api/preventive-maintenance/temporary',
  ),
);
// 应急设备调配 / 租借计费（共用设备池、科室租借申请、审核、借出/归还、计费、结算报表）
app.use('/api/emergency-allocation', ...moduleRoute('/api/emergency-allocation', 'emergency-allocation-management', require('./modules/emergency-allocation-management/routes/index')));
// 通用事件提醒（事件类型自定义、事件、到期提醒调度、H5 提交）
app.use('/api/event-reminder', ...moduleRoute('/api/event-reminder', 'event-reminder-management', require('./modules/event-reminder-management/routes/index')));
// PDCA 管理（模板 + 记录 + 报告打印）
app.use('/api/pdca', ...moduleRoute('/api/pdca', 'pdca-management', require('./modules/pdca-management/routes/index')));
// 表单定制（schema 驱动表单设计器）
app.use('/api/form-customization', ...moduleRoute('/api/form-customization', 'form-customization-management', require('./modules/form-customization-management/routes/index')));
// 流程定制（通用审批引擎：节点/角色/条件/会签，可绑定业务表单）
app.use('/api/workflow', ...moduleRoute('/api/workflow', 'workflow-management', require('./modules/workflow-management/routes/index')));

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

// 资产调配 - 阶段2重构：routes/transfer.js → routes/asset-allocation.js，挂到 /api/asset-allocation
// 旧 /api/transfer 路径已废弃（前端 100% 切到新路径，保留期到下版本）
app.use('/api/asset-allocation', require('./routes/asset-allocation'));
app.use(
  '/api/transfer',
  ...deprecatedRoute('/api/transfer', require('./routes/asset-allocation'), '/api/asset-allocation'),
);
app.use('/api/idle', ...deprecatedRoute('/api/idle', require('./routes/idle'), '/api/idle'));
app.use('/api/scrapping', ...deprecatedRoute('/api/scrapping', require('./routes/scrapping'), null));

// 维修旧路由
app.use('/api/maintenance', ...deprecatedRoute('/api/maintenance', require('./routes/maintenance'), null));
app.use('/api/maintenance/ai', ...deprecatedRoute('/api/maintenance/ai', require('./routes/maintenance-ai'), null));

// IoT旧路由
app.use('/api/asset-location', ...deprecatedRoute('/api/asset-location', require('./routes/asset-location'), '/api/iot/locations'));
app.use('/api/iot-devices', ...deprecatedRoute('/api/iot-devices', require('./routes/iot-devices'), '/api/iot/devices'));
app.use('/api/location-codes', ...deprecatedRoute('/api/location-codes', require('./routes/location-codes'), null));
app.use('/api/location-alerts', ...deprecatedRoute('/api/location-alerts', require('./routes/location-alerts'), null));

// 采购/验收旧路由
// 采购申请统一收敛到 /api/tendering/procurement-requests；旧 API 跳转提示
app.use('/api/procurement', ...deprecatedRoute('/api/procurement', require('./routes/procurement'), '/api/tendering/procurement-requests'));
app.use('/api/acceptance', ...deprecatedRoute('/api/acceptance', require('./routes/acceptance'), '/api/acceptance-management'));

// 不良反应旧路由 - 已统一迁移到 /api/adverse-reaction（modules/adverse-event/）
// 以下 deprecated 引导仅作历史兼容保留，新代码请直接访问 /api/adverse-reaction
// 注意：上方已使用 moduleRoute 真实注册 /api/adverse-reaction；以下 deprecated 行不会接管请求
// 保留仅为说明，如需彻底下线可移除以下两行
// app.use('/api/adverse-reaction', ...deprecatedRoute('/api/adverse-reaction', require('./routes/adverse-reaction.deprecated'), '/api/adverse-reaction'));
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

  // 启动 POCT 提醒调度器（班前 N 分钟 → 站内 + 飞书/微信/短信）
  try {
    const poctReminderScheduler = require('./modules/poct-quality-control/scheduler/poct-reminder.scheduler');
    if (process.env.POCT_REMINDER_SCHEDULER_DISABLED !== 'true') {
      poctReminderScheduler.start();
    }
  } catch (schedErr) {
    logger.error('[poct-reminder] 调度器启动失败:', schedErr.message);
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

  // 初始化微信公众号通知（确保表存在；通道派发由 feishu-notification 在发送时检查）
  try {
    const { initWechatMpNotification } = require('./services/wechat-mp-notification.service');
    initWechatMpNotification();
  } catch (wechatErr) {
    logger.error('微信公众号通知初始化失败:', wechatErr.message);
  }

  // 初始化站内消息订阅（与飞书并列，事件同步推 Socket + 落库 in_app_notifications）
  try {
    const { initInAppNotification } = require('./services/in-app-notification.service');
    initInAppNotification();
  } catch (inAppErr) {
    logger.error('站内通知订阅初始化失败:', inAppErr.message);
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

  // 启动站内消息清理调度器（每日清理过期消息 + 每周清理 N 天前已读）
  try {
    const inAppScheduler = require('./services/in-app-notification.scheduler');
    if (process.env.IN_APP_NOTIFICATION_SCHEDULER_DISABLED !== 'true') {
      inAppScheduler.start();
    }
  } catch (schedErr) {
    logger.error('站内消息清理调度器启动失败:', schedErr.message);
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

  // 停止站内消息清理调度器
  try {
    const inAppScheduler = require('./services/in-app-notification.scheduler');
    inAppScheduler.stop();
  } catch (e) {
    // 调度器可能未启动，忽略错误
  }

  // 停止站内消息清理调度器
  try {
    const inAppScheduler = require('./services/in-app-notification.scheduler');
    inAppScheduler.stop();
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
