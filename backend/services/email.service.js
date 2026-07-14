// 邮件发送服务（基于 nodemailer）
// 支持租户级 SMTP 配置隔离，未配置租户则回退全局 .env
const nodemailer = require('nodemailer');
const logger = require('../config/logger');
const tenantConfig = require('./tenant-config.service');

// 全局 transporter（基于 .env，作为无 tenantId 时的回退）
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT, 10) || 465;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || 'noreply@assethub.com';
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';

let globalTransporter = null;
let globalTransporterReady = false;

if (SMTP_HOST) {
  try {
    globalTransporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
    });
    globalTransporterReady = true;
    logger.info('全局邮件 transporter 已初始化（.env 回退）', {
      host: SMTP_HOST, port: SMTP_PORT, secure: SMTP_SECURE,
    });
  } catch (error) {
    logger.error('全局邮件 transporter 初始化失败', { error: error.message });
  }
} else {
  logger.warn('未配置 SMTP_HOST，无 tenantId 时邮件将跳过发送');
}

// 租户级 transporter 缓存：tenantId → { transporter, ready, host }
const tenantTransporters = new Map();

/**
 * 获取租户级 transporter（按租户配置创建，带缓存）
 * @param {number} tenantId
 * @returns {Promise<{transporter, host, from}|null>}
 */
async function getTenantTransporter(tenantId) {
  if (!tenantId) {
    // 无 tenantId，回退全局
    return globalTransporterReady
      ? { transporter: globalTransporter, host: SMTP_HOST, from: SMTP_FROM }
      : null;
  }

  // 命中缓存
  const cached = tenantTransporters.get(tenantId);
  if (cached) return cached;

  // 从数据库读取租户邮件配置（内部已带 env 回退）
  const cfg = await tenantConfig.getEmailConfig(tenantId);
  if (!cfg || !cfg.host) {
    // 租户未配置邮件，回退全局
    return globalTransporterReady
      ? { transporter: globalTransporter, host: SMTP_HOST, from: SMTP_FROM }
      : null;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: parseInt(cfg.port, 10) || 465,
      secure: !!cfg.secure,
      auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
    });
    const entry = { transporter, host: cfg.host, from: cfg.from || cfg.user };
    tenantTransporters.set(tenantId, entry);
    logger.info(`租户 ${tenantId} 邮件 transporter 已初始化`, { host: cfg.host });
    return entry;
  } catch (e) {
    logger.error(`租户 ${tenantId} 邮件 transporter 初始化失败:`, e.message);
    return globalTransporterReady
      ? { transporter: globalTransporter, host: SMTP_HOST, from: SMTP_FROM }
      : null;
  }
}

/**
 * 清除租户 transporter 缓存（配置更新后调用）
 */
function clearTransporterCache(tenantId) {
  if (tenantId) {
    const entry = tenantTransporters.get(tenantId);
    if (entry && entry.transporter) {
      try { entry.transporter.close(); } catch (e) {}
    }
    tenantTransporters.delete(tenantId);
  } else {
    for (const [, entry] of tenantTransporters) {
      try { entry.transporter && entry.transporter.close(); } catch (e) {}
    }
    tenantTransporters.clear();
  }
}

/**
 * 发送单封邮件
 * @param {Object} params - 邮件参数
 * @param {string} params.to - 收件人地址（多个用逗号分隔）
 * @param {string} params.subject - 邮件主题
 * @param {string} [params.html] - HTML 内容
 * @param {string} [params.text] - 纯文本内容（兜底）
 * @param {number} [params.tenantId] - 租户ID（用于读取租户级 SMTP 配置）
 * @returns {Promise<Object>} 发送结果
 */
async function sendMail({ to, subject, html, text, tenantId } = {}) {
  const entry = await getTenantTransporter(tenantId);

  // SMTP 未配置时跳过发送，不抛错
  if (!entry || !entry.transporter) {
    logger.warn('邮件发送被跳过：SMTP 未配置', { to, subject, tenantId });
    return { sent: 0, reason: 'not_configured' };
  }

  // 基础参数校验
  if (!to || !subject) {
    logger.warn('邮件发送被跳过：缺少必填参数', { to, subject });
    return { sent: 0, reason: 'invalid_params' };
  }

  const mailOptions = {
    from: entry.from,
    to,
    subject,
  };
  if (html) mailOptions.html = html;
  if (text) mailOptions.text = text;

  try {
    const info = await entry.transporter.sendMail(mailOptions);
    logger.info('邮件发送成功', { to, subject, messageId: info.messageId, tenantId });
    return { sent: 1, messageId: info.messageId };
  } catch (error) {
    logger.error('邮件发送失败', {
      to, subject, tenantId,
      error: error.message, stack: error.stack,
    });
    return { sent: 0, reason: 'send_failed', error: error.message };
  }
}

/**
 * 批量发送邮件（逐个发送以隔离错误，并支持个性化内容）
 * @param {Array<string|Object>} recipients - 收件人列表
 * @param {string} subject - 邮件主题（统一）
 * @param {string} [html] - 默认 HTML 内容（recipients 为字符串数组时使用）
 * @param {number} [tenantId] - 租户ID
 * @returns {Promise<Object>} 汇总结果 { total, sent, failed, details }
 */
async function sendMailToMany(recipients, subject, html, tenantId) {
  const entry = await getTenantTransporter(tenantId);
  if (!entry || !entry.transporter) {
    logger.warn('批量邮件发送被跳过：SMTP 未配置', { subject, count: Array.isArray(recipients) ? recipients.length : 0, tenantId });
    return { sent: 0, reason: 'not_configured' };
  }

  if (!Array.isArray(recipients) || recipients.length === 0) {
    logger.warn('批量邮件发送被跳过：收件人列表为空', { subject });
    return { total: 0, sent: 0, failed: 0, details: [] };
  }

  const total = recipients.length;
  let sent = 0;
  let failed = 0;
  const details = [];

  for (const recipient of recipients) {
    const item = typeof recipient === 'string'
      ? { to: recipient, html }
      : { to: recipient.to, html: recipient.html || html, text: recipient.text };

    const result = await sendMail({
      to: item.to, subject, html: item.html, text: item.text, tenantId,
    });

    if (result.sent === 1) {
      sent += 1;
      details.push({ to: item.to, status: 'sent', messageId: result.messageId });
    } else {
      failed += 1;
      details.push({ to: item.to, status: 'failed', reason: result.reason, error: result.error });
    }
  }

  logger.info('批量邮件发送完成', { total, sent, failed, subject, tenantId });
  return { total, sent, failed, details };
}

module.exports = {
  sendMail,
  sendMailToMany,
  clearTransporterCache,
  // 兼容：暴露全局 transporter 状态（供测试/调试）
  _globalReady: () => globalTransporterReady,
};
