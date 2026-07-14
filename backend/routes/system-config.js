const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const { authenticate, requireSuperAdmin, requireSystemAdmin } = require('../middleware/auth');
const { auditLogger } = require('../middleware/auditLogger');
const config = require('../config/app.config');
const tenantConfig = require('../services/tenant-config.service');
const emailService = require('../services/email.service');
const SYSTEM_CONFIG_TRACE_LOG_ENABLED = process.env.SYSTEM_CONFIG_TRACE_LOG_ENABLED === 'true';
const systemConfigTraceLog = (...args) => {
  if (SYSTEM_CONFIG_TRACE_LOG_ENABLED) {
    console.log(...args);
  }
};

// 根路由
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'System Config API',
    endpoints: {
      status: '/api/system-config/status',
      database: '/api/system-config/database',
      feishu: '/api/system-config/feishu',
      email: '/api/system-config/email',
    },
  });
});

/**
 * 更新 .env 文件中指定的环境变量
 * @param {Object} envVars - { KEY: value }
 */
function updateEnvFile(envVars) {
  const envPath = path.join(__dirname, '../../.env');
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }
  Object.keys(envVars).forEach(key => {
    const value = envVars[key];
    const regex = new RegExp(`^${key}=.*$`, 'm');
    const newLine = `${key}=${value}`;
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, newLine);
    } else {
      envContent += (envContent && !envContent.endsWith('\n') ? '\n' : '') + newLine;
    }
  });
  if (envContent && !envContent.endsWith('\n')) {
    envContent += '\n';
  }
  fs.writeFileSync(envPath, envContent, 'utf8');
}

/**
 * 获取数据库配置
 * 注意：不返回真实密码，只返回配置的掩码
 * 从当前实际使用的配置中读取（优先环境变量，然后配置文件）
 */
router.get('/database', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    // 从环境变量或配置文件读取当前实际使用的配置
    const dbConfig = {
      host: process.env.DB_HOST || config.database.host,
      port: parseInt(process.env.DB_PORT) || config.database.port,
      user: process.env.DB_USER || config.database.user,
      password: process.env.DB_PASSWORD || config.database.password,
      database: process.env.DB_NAME || config.database.database,
      connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || config.database.connectionLimit,
      connectTimeout: parseInt(process.env.DB_CONNECT_TIMEOUT) || config.database.connectTimeout,
      idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT) || config.database.idleTimeout,
      maxIdle: parseInt(process.env.DB_MAX_IDLE) || config.database.maxIdle,
      charset: config.database.charset,
      timezone: config.database.timezone,
    };

    systemConfigTraceLog('[数据库配置] 读取当前配置:', {
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      database: dbConfig.database,
      hasPassword: !!dbConfig.password,
      connectionLimit: dbConfig.connectionLimit,
      connectTimeout: dbConfig.connectTimeout,
    });

    // 返回配置，但密码字段显示为掩码
    res.json({
      success: true,
      data: {
        host: dbConfig.host,
        port: dbConfig.port,
        user: dbConfig.user,
        password: dbConfig.password ? '******' : '', // 不返回真实密码
        database: dbConfig.database,
        connectionLimit: dbConfig.connectionLimit,
        connectTimeout: dbConfig.connectTimeout,
        idleTimeout: dbConfig.idleTimeout,
        maxIdle: dbConfig.maxIdle,
        charset: dbConfig.charset,
        timezone: dbConfig.timezone,
      },
      message: '获取数据库配置成功',
    });
  } catch (error) {
    console.error('获取数据库配置失败:', error);
    res.status(500).json({
      success: false,
      message: '获取数据库配置失败',
      error: error.message,
    });
  }
});

/**
 * 测试数据库连接
 */
router.post('/database/test', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { host, port, user, password, database } = req.body;

    if (!host || !port || !user || !database) {
      return res.status(400).json({
        success: false,
        message: '缺少必需的连接参数',
      });
    }

    // 如果没有提供密码，使用当前配置的密码（优先环境变量，然后配置文件）
    const testPassword = password || process.env.DB_PASSWORD || config.database.password;

    // 创建测试连接
    let connection;
    try {
      connection = await mysql.createConnection({
        host,
        port: parseInt(port),
        user,
        password: testPassword,
        database,
        connectTimeout: 5000, // 5秒超时
      });

      // 测试查询
      const [rows] = await connection.execute('SELECT 1 as test');

      // 获取数据库版本信息
      const [versionRows] = await connection.execute('SELECT VERSION() as version');
      const version = versionRows[0]?.version || 'Unknown';

      await connection.end();

      res.json({
        success: true,
        message: '数据库连接测试成功',
        data: {
          host,
          port,
          user,
          database,
          version,
          testQuery: rows[0]?.test === 1,
        },
      });
    } catch (dbError) {
      if (connection) {
        try {
          await connection.end();
        } catch (e) {
          // 忽略关闭连接的错误
        }
      }
      throw dbError;
    }
  } catch (error) {
    console.error('测试数据库连接失败:', error);

    let errorMessage = '数据库连接测试失败';
    if (error.code === 'ECONNREFUSED') {
      errorMessage = '无法连接到数据库服务器，请检查主机地址和端口';
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      errorMessage = '数据库访问被拒绝，请检查用户名和密码';
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      errorMessage = '数据库不存在，请检查数据库名称';
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
      errorMessage = '连接超时，请检查主机地址是否正确';
    } else {
      errorMessage = error.message || '数据库连接测试失败';
    }

    res.status(500).json({
      success: false,
      message: errorMessage,
      error: error.message,
      code: error.code,
    });
  }
});

/**
 * 更新数据库配置
 * 注意：配置会保存到环境变量文件或配置文件
 */
router.put(
  '/database',
  authenticate,
  requireSuperAdmin,
  auditLogger('update', 'system_config'),
  async (req, res) => {
    try {
      const {
        host,
        port,
        user,
        password,
        database,
        connectionLimit,
        connectTimeout,
        idleTimeout,
        maxIdle,
      } = req.body;

      // 验证必需参数
      if (!host || !port || !user || !database) {
        return res.status(400).json({
          success: false,
          message: '缺少必需的配置参数',
        });
      }

      // 验证端口范围
      const portNum = parseInt(port);
      if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
        return res.status(400).json({
          success: false,
          message: '端口号必须在 1-65535 之间',
        });
      }

      // 构建配置对象
      const newConfig = {
        host,
        port: portNum,
        user,
        database,
        connectionLimit: connectionLimit || config.database.connectionLimit,
        connectTimeout: connectTimeout || config.database.connectTimeout,
        idleTimeout: idleTimeout || config.database.idleTimeout,
        maxIdle: maxIdle || config.database.maxIdle,
      };

      // 如果提供了新密码，则更新
      if (password && password !== '******') {
        newConfig.password = password;
      } else {
        // 否则使用当前配置的密码（优先环境变量，然后配置文件）
        newConfig.password = process.env.DB_PASSWORD || config.database.password;
      }

      // 保存配置到 .env 文件
      const envVars = {
        DB_HOST: newConfig.host,
        DB_PORT: newConfig.port.toString(),
        DB_USER: newConfig.user,
        DB_PASSWORD: newConfig.password,
        DB_NAME: newConfig.database,
        DB_CONNECTION_LIMIT: newConfig.connectionLimit.toString(),
        DB_CONNECT_TIMEOUT: newConfig.connectTimeout.toString(),
        DB_IDLE_TIMEOUT: newConfig.idleTimeout.toString(),
        DB_MAX_IDLE: newConfig.maxIdle.toString(),
      };

      try {
        updateEnvFile(envVars);
      } catch (writeError) {
        console.error('写入 .env 文件失败:', writeError);
        return res.status(500).json({
          success: false,
          message: '保存配置失败：无法写入配置文件',
          error: writeError.message,
        });
      }

      res.json({
        success: true,
        message: '数据库配置已保存。请重启服务器使配置生效。',
        data: {
          ...newConfig,
          password: '******', // 不返回真实密码
        },
      });
    } catch (error) {
      console.error('更新数据库配置失败:', error);
      res.status(500).json({
        success: false,
        message: '更新数据库配置失败',
        error: error.message,
      });
    }
  },
);

/* ===================== 飞书配置 ===================== */

/**
 * 获取飞书配置（app_secret 掩码）—— 按当前租户读取
 */
router.get('/feishu', authenticate, requireSystemAdmin, async (req, res) => {
  try {
    const tenantId = req.user.tenant_id || tenantConfig.DEFAULT_TENANT_ID;
    const { config: cfg, exists } = await tenantConfig.getTenantConfigRaw(tenantId, 'feishu');
    const data = {
      app_id: cfg.app_id || '',
      app_secret: cfg.app_secret ? '******' : '',
      redirect_uri: cfg.redirect_uri || '',
      host: cfg.host || 'https://open.feishu.cn',
      notification_enabled: cfg.notification_enabled !== false,
      scheduler_enabled: cfg.scheduler_enabled !== false,
      alert_scan_interval: cfg.alert_scan_interval || 3600000,
    };
    res.json({ success: true, data, message: exists ? '获取飞书配置成功' : '当前使用全局默认配置，可保存为租户专属配置' });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取飞书配置失败', error: error.message });
  }
});

/**
 * 测试飞书连接（使用请求体中的临时凭证，按当前租户回退）
 */
router.post('/feishu/test', authenticate, requireSystemAdmin, async (req, res) => {
  try {
    const feishuClient = require('../modules/feishu-binding/services/feishu-client');
    const tenantId = req.user.tenant_id || tenantConfig.DEFAULT_TENANT_ID;
    const { app_id, app_secret } = req.body;
    // 未提供新凭证时，用当前租户已保存的凭证测试
    const cfg = await tenantConfig.getFeishuConfig(tenantId);
    const options = {
      appId: app_id && app_id !== '******' ? app_id : cfg.app_id,
      appSecret: app_secret && app_secret !== '******' ? app_secret : cfg.app_secret,
      host: cfg.host,
      forceRefresh: true,
    };
    if (!options.appId || !options.appSecret) {
      return res.status(400).json({ success: false, message: '缺少飞书 App ID 或 App Secret' });
    }
    const result = await feishuClient.testConnection(options);
    res.json({ success: result.success, message: result.message, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || '飞书连接测试失败' });
  }
});

/**
 * 更新飞书配置（写入租户配置表，立即生效，无需重启）
 */
router.put(
  '/feishu',
  authenticate,
  requireSystemAdmin,
  auditLogger('update', 'system_config'),
  async (req, res) => {
    try {
      const tenantId = req.user.tenant_id || tenantConfig.DEFAULT_TENANT_ID;
      const { app_id, app_secret, redirect_uri, host, notification_enabled, scheduler_enabled, alert_scan_interval } = req.body;
      // 读取现有配置（用于保留未修改的 app_secret）
      const existing = await tenantConfig.getFeishuConfig(tenantId);
      const newConfig = {
        app_id: app_id !== undefined ? app_id : existing.app_id,
        app_secret: (app_secret !== undefined && app_secret !== '******' && app_secret !== '') ? app_secret : existing.app_secret,
        redirect_uri: redirect_uri !== undefined ? redirect_uri : existing.redirect_uri,
        host: host !== undefined ? host : existing.host,
        notification_enabled: notification_enabled !== undefined ? !!notification_enabled : existing.notification_enabled,
        scheduler_enabled: scheduler_enabled !== undefined ? !!scheduler_enabled : existing.scheduler_enabled,
        alert_scan_interval: alert_scan_interval !== undefined ? (parseInt(alert_scan_interval, 10) || 3600000) : existing.alert_scan_interval,
      };
      await tenantConfig.upsertTenantConfig(tenantId, 'feishu', newConfig, req.user.id);

      res.json({
        success: true,
        message: '飞书配置已保存并立即生效。',
        data: {
          app_id: newConfig.app_id,
          app_secret: '******',
          redirect_uri: newConfig.redirect_uri,
          host: newConfig.host,
          notification_enabled: newConfig.notification_enabled,
          scheduler_enabled: newConfig.scheduler_enabled,
          alert_scan_interval: newConfig.alert_scan_interval,
        },
      });
    } catch (error) {
      console.error('更新飞书配置失败:', error);
      res.status(500).json({ success: false, message: '更新飞书配置失败', error: error.message });
    }
  },
);

/* ===================== 邮件 SMTP 配置 ===================== */

/**
 * 获取邮件 SMTP 配置（密码掩码）—— 按当前租户读取
 */
router.get('/email', authenticate, requireSystemAdmin, async (req, res) => {
  try {
    const tenantId = req.user.tenant_id || tenantConfig.DEFAULT_TENANT_ID;
    const { config: cfg, exists } = await tenantConfig.getTenantConfigRaw(tenantId, 'email');
    const data = {
      host: cfg.host || '',
      port: cfg.port || 465,
      secure: cfg.secure !== false,
      user: cfg.user || '',
      pass: cfg.pass ? '******' : '',
      from: cfg.from || '',
    };
    res.json({ success: true, data, message: exists ? '获取邮件配置成功' : '当前使用全局默认配置，可保存为租户专属配置' });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取邮件配置失败', error: error.message });
  }
});

/**
 * 测试邮件发送（使用请求体中的临时配置，按当前租户回退，发到指定收件人）
 */
router.post('/email/test', authenticate, requireSystemAdmin, async (req, res) => {
  try {
    const tenantId = req.user.tenant_id || tenantConfig.DEFAULT_TENANT_ID;
    const { host, port, secure, user, pass, from, to } = req.body;
    // 未提供新凭证时，用当前租户已保存的凭证
    const cfg = await tenantConfig.getEmailConfig(tenantId);
    const testHost = host || cfg.host;
    const testPort = parseInt(port, 10) || cfg.port || 465;
    const testSecure = secure !== undefined ? !!secure : cfg.secure;
    const testUser = user || cfg.user;
    const testPass = pass && pass !== '******' ? pass : cfg.pass;
    const testFrom = from || cfg.from || testUser;
    const testTo = to || testUser;

    if (!testHost) {
      return res.status(400).json({ success: false, message: '缺少 SMTP 服务器地址' });
    }
    if (!testTo) {
      return res.status(400).json({ success: false, message: '请填写测试收件人邮箱' });
    }

    const transporter = nodemailer.createTransport({
      host: testHost,
      port: testPort,
      secure: testSecure,
      auth: testUser ? { user: testUser, pass: testPass } : undefined,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });

    const info = await transporter.sendMail({
      from: testFrom,
      to: testTo,
      subject: '【AssetHub 测试】SMTP 邮件配置测试',
      html: `<h2>SMTP 邮件配置测试</h2><p>这是来自 AssetHub 系统设置页面的测试邮件，收到说明 SMTP 配置正常。</p><p>发送时间：${new Date().toLocaleString('zh-CN')}</p>`,
    });

    try { transporter.close(); } catch (e) {}

    res.json({
      success: true,
      message: `测试邮件已发送至 ${testTo}`,
      data: { messageId: info.messageId, to: testTo },
    });
  } catch (error) {
    let msg = error.message || '邮件测试失败';
    if (error.code === 'EAUTH') msg = '认证失败：请检查用户名与授权码（不是登录密码）';
    else if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') msg = '无法连接 SMTP 服务器，请检查地址与端口';
    res.status(500).json({ success: false, message: msg, error: error.message, code: error.code });
  }
});

/**
 * 更新邮件 SMTP 配置（写入租户配置表，立即生效，无需重启）
 */
router.put(
  '/email',
  authenticate,
  requireSystemAdmin,
  auditLogger('update', 'system_config'),
  async (req, res) => {
    try {
      const tenantId = req.user.tenant_id || tenantConfig.DEFAULT_TENANT_ID;
      const { host, port, secure, user, pass, from } = req.body;
      // 读取现有配置（用于保留未修改的 pass）
      const existing = await tenantConfig.getEmailConfig(tenantId);
      const newConfig = {
        host: host !== undefined ? host : existing.host,
        port: port !== undefined ? (parseInt(port, 10) || 465) : existing.port,
        secure: secure !== undefined ? !!secure : existing.secure,
        user: user !== undefined ? user : existing.user,
        pass: (pass !== undefined && pass !== '******' && pass !== '') ? pass : existing.pass,
        from: from !== undefined ? from : existing.from,
      };
      await tenantConfig.upsertTenantConfig(tenantId, 'email', newConfig, req.user.id);
      // 清除该租户的 transporter 缓存，使新配置立即生效
      emailService.clearTransporterCache(tenantId);

      res.json({
        success: true,
        message: '邮件配置已保存并立即生效。',
        data: {
          host: newConfig.host,
          port: newConfig.port,
          secure: newConfig.secure,
          user: newConfig.user,
          pass: '******',
          from: newConfig.from,
        },
      });
    } catch (error) {
      console.error('更新邮件配置失败:', error);
      res.status(500).json({ success: false, message: '更新邮件配置失败', error: error.message });
    }
  },
);

/**
 * GET /api/system-config/status
 * 系统状态概览 - 供系统设置中心首页展示
 * 返回系统版本、数据库状态、各模块统计等关键指标
 */
router.get('/status', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const pool = require('../config/database');

    const stats = {};

    // 1. 系统版本信息
    try {
      const pkg = require('../../package.json');
      stats.version = pkg.version || '1.0.0';
      stats.nodeVersion = process.version;
    } catch {
      stats.version = '1.0.0';
      stats.nodeVersion = process.version;
    }
    stats.platform = process.platform;
    stats.uptime = Math.floor(process.uptime()); // 秒
    stats.startTime = new Date(Date.now() - process.uptime() * 1000).toISOString();
    stats.env = process.env.NODE_ENV || 'development';

    // 2. 数据库连接状态
    try {
      const [dbResult] = await pool.query('SELECT 1 AS alive, VERSION() AS version, NOW() AS server_time');
      stats.database = {
        connected: true,
        version: dbResult[0]?.version || 'unknown',
        serverTime: dbResult[0]?.server_time || null,
      };
    } catch (dbErr) {
      stats.database = { connected: false, error: dbErr.message };
    }

    // 3. 租户统计
    try {
      const [tenantRows] = await pool.query(
        'SELECT COUNT(*) AS total FROM tenants WHERE deleted_at IS NULL'
      );
      stats.tenants = { total: tenantRows[0]?.total || 0 };
    } catch {
      stats.tenants = { total: 0, error: '查询失败' };
    }

    // 4. 用户统计
    try {
      const [userRows] = await pool.query(
        'SELECT COUNT(*) AS total FROM users WHERE deleted_at IS NULL'
      );
      const [activeUserRows] = await pool.query(
        'SELECT COUNT(*) AS total FROM users WHERE status = "active" AND deleted_at IS NULL'
      );
      stats.users = {
        total: userRows[0]?.total || 0,
        active: activeUserRows[0]?.total || 0,
      };
    } catch {
      stats.users = { total: 0, active: 0 };
    }

    // 5. 资产统计
    try {
      const [assetRows] = await pool.query(
        'SELECT COUNT(*) AS total FROM assets WHERE deleted_at IS NULL'
      );
      const [assetStatusRows] = await pool.query(
        `SELECT status, COUNT(*) AS cnt FROM assets WHERE deleted_at IS NULL GROUP BY status`
      );
      stats.assets = {
        total: assetRows[0]?.total || 0,
        byStatus: Object.fromEntries(assetStatusRows.map(r => [r.status, r.cnt])),
      };
    } catch {
      stats.assets = { total: 0, byStatus: {} };
    }

    // 6. 模块统计
    try {
      const [modRows] = await pool.query(
        'SELECT COUNT(*) AS total, COUNT(CASE WHEN status="active" THEN 1 END) AS active FROM system_modules'
      );
      stats.modules = {
        total: modRows[0]?.total || 0,
        active: modRows[0]?.active || 0,
      };
    } catch {
      stats.modules = { total: 0, active: 0 };
    }

    // 7. 部门统计
    try {
      const [deptRows] = await pool.query(
        'SELECT COUNT(*) AS total FROM departments WHERE deleted_at IS NULL'
      );
      stats.departments = { total: deptRows[0]?.total || 0 };
    } catch {
      stats.departments = { total: 0 };
    }

    // 8. 角色统计
    try {
      const [roleRows] = await pool.query('SELECT COUNT(*) AS total FROM roles');
      stats.roles = { total: roleRows[0]?.total || 0 };
    } catch {
      stats.roles = { total: 0 };
    }

    // 9. 审计日志统计（最近7天）
    try {
      const [logRows] = await pool.query(
        'SELECT COUNT(*) AS total FROM audit_logs WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)'
      );
      stats.auditLogs = { recent7Days: logRows[0]?.total || 0 };
    } catch {
      stats.auditLogs = { recent7Days: 0 };
    }

    // 10. 连接池状态
    try {
      const db = require('../config/database');
      if (typeof db.getPoolStats === 'function') {
        stats.poolStats = db.getPoolStats();
      }
    } catch {
      stats.poolStats = null;
    }

    // 11. 内存使用
    stats.memory = {
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
    };

    res.json({
      success: true,
      data: stats,
      message: '系统状态查询成功',
    });
  } catch (error) {
    console.error('获取系统状态失败:', error);
    res.status(500).json({
      success: false,
      message: '获取系统状态失败',
      error: error.message,
    });
  }
});

module.exports = router;
