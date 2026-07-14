/**
 * 通知发送引擎
 * 订阅 EventBus 事件，根据 notification_rules 匹配规则并发送通知
 * 支持飞书、邮件、站内消息渠道，动态变量替换
 */
const db = require('../config/database');
const logger = require('../config/logger');
const { subscribe, getEventBus } = require('../core/EventBus');
const feishuClient = require('../modules/feishu-binding/services/feishu-client');
const tenantConfig = require('./tenant-config.service');
const emailService = require('./email.service');
const notificationConfig = require('./notification-config.service');
const recipientService = require('./notification-recipient.service');
const notificationLog = require('./notification-log.service');
const requestContext = require('../middleware/requestContext');

const NOTIFICATION_ENGINE_ENABLED = process.env.NOTIFICATION_ENGINE_ENABLED !== 'false';

/**
 * 从 payload 提取请求对象
 */
function extractReq(payload) {
  let req = null;
  if (payload) {
    req = payload._req || payload.req || (payload._meta && payload._meta.req);
  }
  if (!req) {
    try {
      req = requestContext.getRequest();
    } catch (_e) { /* ignore */ }
  }
  return req;
}

/**
 * 解析 tenantId
 */
function resolveTenantId(payload) {
  if (!payload) return null;
  return payload.tenantId || payload.tenant_id || null;
}

/**
 * 动态变量替换：{{key}} 或 {{key.subKey}}
 */
function replaceVariables(template, context) {
  if (!template || typeof template !== 'string') return template || '';
  return template.replace(/\{\{([\w.]+)\}\}/g, (match, path) => {
    const keys = path.split('.');
    let value = context;
    for (const key of keys) {
      if (value == null) return '-';
      value = value[key];
    }
    return value == null ? '-' : String(value);
  });
}

/**
 * 构造通知上下文：扁平化 payload，兼容 request、invoice 等嵌套对象
 */
function buildContext(payload) {
  const ctx = { ...(payload || {}) };
  // 展开嵌套对象
  const nested = ['request', 'invoice', 'payment', 'workOrder', 'asset'];
  for (const key of nested) {
    if (ctx[key] && typeof ctx[key] === 'object') {
      Object.assign(ctx, ctx[key]);
    }
  }
  // 常用别名映射
  if (!ctx.asset_code && ctx.assetCode) ctx.asset_code = ctx.assetCode;
  if (!ctx.asset_name && ctx.assetName) ctx.asset_name = ctx.assetName;
  if (!ctx.work_order_no && ctx.workOrderNo) ctx.work_order_no = ctx.workOrderNo;
  if (!ctx.request_no && ctx.requestNo) ctx.request_no = ctx.requestNo;
  if (!ctx.operator_name && ctx.operatorName) ctx.operator_name = ctx.operatorName;
  if (!ctx.created_by && ctx.createdBy) ctx.created_by = ctx.createdBy;
  if (!ctx.completed_by && ctx.completedBy) ctx.completed_by = ctx.completedBy;
  ctx.now = new Date().toLocaleString('zh-CN');
  return ctx;
}

/**
 * 评估触发条件
 * condition: { "field": "value", "field__in": ["a","b"], "field__ne": "x" }
 */
function evaluateCondition(condition, context) {
  if (!condition || typeof condition !== 'object') return true;
  for (const [rawKey, expected] of Object.entries(condition)) {
    const parts = rawKey.split('__');
    const key = parts[0];
    const op = parts[1] || 'eq';
    const keys = key.split('.');
    let value = context;
    for (const k of keys) {
      value = value?.[k];
    }

    switch (op) {
      case 'eq':
      case 'equals':
        if (value !== expected) return false;
        break;
      case 'ne':
      case 'not':
        if (value === expected) return false;
        break;
      case 'in':
        if (!Array.isArray(expected) || !expected.includes(value)) return false;
        break;
      case 'nin':
        if (Array.isArray(expected) && expected.includes(value)) return false;
        break;
      case 'gt':
        if (!(value > expected)) return false;
        break;
      case 'lt':
        if (!(value < expected)) return false;
        break;
      case 'contains':
        if (!String(value || '').includes(expected)) return false;
        break;
      default:
        if (value !== expected) return false;
    }
  }
  return true;
}

/**
 * 查询 open_ids
 */
async function getOpenIdsByUserIds(userIds) {
  if (!userIds.length) return [];
  const placeholders = userIds.map(() => '?').join(',');
  try {
    const [rows] = await db.execute(
      `SELECT user_id, open_id FROM feishu_bindings WHERE user_id IN (${placeholders}) AND open_id IS NOT NULL AND open_id <> ''`,
      userIds,
    );
    return rows.map(r => r.open_id);
  } catch (e) {
    logger.error('[NotificationEngine] 查询飞书绑定失败:', e.message);
    return [];
  }
}

async function getOpenIdsByPhones(phones) {
  if (!phones.length) return [];
  try {
    const r = await feishuClient.getUserIdByPhoneOrEmail(phones, []);
    return (r.users || []).map(u => u.openId);
  } catch (e) {
    logger.warn('[NotificationEngine] 通过手机号反查 open_id 失败:', e.message);
    return [];
  }
}

/**
 * 发送飞书卡片
 */
async function sendFeishu({ userIds, title, content, context, tenantId }) {
  if (!userIds.length) return { sent: 0, reason: 'no_recipients' };
  const openIds = await getOpenIdsByUserIds(userIds);
  let fallbackOpenIds = [];
  if (!openIds.length) {
    const phonesData = await recipientService.getUserPhones(userIds);
    const phones = phonesData.map(p => p.phone).filter(Boolean);
    if (phones.length) {
      fallbackOpenIds = await getOpenIdsByPhones(phones);
    }
  }
  const allOpenIds = [...new Set([...openIds, ...fallbackOpenIds])];
  if (!allOpenIds.length) return { sent: 0, reason: 'no_feishu_binding' };

  let options = {};
  if (tenantId) {
    try {
      const cfg = await tenantConfig.getFeishuConfig(tenantId);
      if (cfg && cfg.app_id) {
        options.appId = cfg.app_id;
        options.appSecret = cfg.app_secret;
        if (cfg.host) options.host = cfg.host;
      }
    } catch (e) {
      logger.warn(`[NotificationEngine] 读取租户 ${tenantId} 飞书配置失败:`, e.message);
    }
  }

  let sent = 0;
  for (const openId of allOpenIds) {
    try {
      const card = {
        config: { wide_screen_mode: true },
        header: {
          title: { tag: 'plain_text', content: replaceVariables(title, context) },
          template: 'blue',
        },
        elements: [
          {
            tag: 'div',
            text: { tag: 'lark_md', content: replaceVariables(content, context) },
          },
        ],
      };
      await feishuClient.sendCard('open_id', openId, card, options);
      sent++;
    } catch (e) {
      const apiCode = e.apiCode ? ` (apiCode=${e.apiCode})` : '';
      logger.error(`[NotificationEngine] 飞书发送给 ${openId} 失败: ${e.message}${apiCode}`);
    }
  }
  return { sent, channel: 'feishu', total: allOpenIds.length };
}

/**
 * 发送邮件
 */
async function sendEmail({ userIds, title, content, context }) {
  if (!userIds.length) return { sent: 0, reason: 'no_recipients' };
  const placeholders = userIds.map(() => '?').join(',');
  const [rows] = await db.execute(
    `SELECT id, email FROM users WHERE id IN (${placeholders}) AND email IS NOT NULL AND email <> ''`,
    userIds,
  );
  const emails = rows.map(r => r.email).filter(Boolean);
  if (!emails.length) return { sent: 0, reason: 'no_email' };

  let sent = 0;
  for (const to of emails) {
    try {
      await emailService.sendMail({ to, subject: replaceVariables(title, context), html: replaceVariables(content, context) });
      sent++;
    } catch (e) {
      logger.error('[NotificationEngine] 邮件发送失败:', e.message);
    }
  }
  return { sent, channel: 'email', total: emails.length };
}

/**
 * 发送站内消息（WebSocket）
 */
async function sendSocket({ userIds, title, content, context }) {
  try {
    const { pushToUsers } = require('../core/socket');
    pushToUsers(userIds, 'notification:system', {
      title: replaceVariables(title, context),
      content: replaceVariables(content, context),
      timestamp: new Date().toISOString(),
    });
    return { sent: userIds.length, channel: 'socket', total: userIds.length };
  } catch (e) {
    logger.warn('[NotificationEngine] 站内消息发送失败:', e.message);
    return { sent: 0, channel: 'socket', reason: e.message };
  }
}

/**
 * 根据 channel 发送通知
 */
async function sendByChannel(channel, params) {
  switch (channel) {
    case 'feishu':
      return sendFeishu(params);
    case 'email':
      return sendEmail(params);
    case 'socket':
      return sendSocket(params);
    default:
      return { sent: 0, reason: 'unsupported_channel' };
  }
}

/**
 * 处理事件：匹配规则并发送
 */
async function processEvent(event, payload) {
  if (!NOTIFICATION_ENGINE_ENABLED) return;
  const tenantId = resolveTenantId(payload);
  if (!tenantId) return;

  const context = buildContext(payload);

  // 查询该租户下该事件的所有启用规则
  let rules;
  try {
    const result = await notificationConfig.listRules({
      tenantId,
      eventCode: event,
      enabled: 1,
      pageSize: 1000,
    });
    rules = result.list;
  } catch (e) {
    logger.error('[NotificationEngine] 查询通知规则失败:', e.message);
    return;
  }

  if (!rules.length) return;

  for (const rule of rules) {
    try {
      // 节点匹配：如果规则设置了 node_code，且 payload 中有 node_code，需一致
      if (rule.node_code && payload.node_code && rule.node_code !== payload.node_code) continue;

      // 触发条件评估
      if (!evaluateCondition(rule.trigger_condition, context)) continue;

      // 获取模板
      const template = await notificationConfig.getTemplateById(rule.template_id, tenantId);
      if (!template) {
        logger.warn(`[NotificationEngine] 规则 ${rule.id} 引用的模板 ${rule.template_id} 不存在`);
        continue;
      }

      // 解析接收人
      const userIds = await recipientService.resolveRuleRecipients(rule.recipients, payload, tenantId);
      if (!userIds.length) {
        logger.info(`[NotificationEngine] 规则 ${rule.id} 无接收人，跳过`);
        continue;
      }

      const sendParams = {
        userIds,
        title: template.title_template,
        content: template.content_template,
        context,
        tenantId,
      };

      const result = await sendByChannel(template.channel, sendParams);

      // 记录发送日志
      await notificationLog.addLog({
        tenantId,
        ruleId: rule.id,
        eventCode: event,
        recipients: userIds,
        channel: template.channel,
        title: replaceVariables(template.title_template, context),
        content: replaceVariables(template.content_template, context),
        status: result.sent > 0 ? 'success' : 'failed',
        error: result.reason || null,
        sentCount: result.sent,
        totalCount: result.total,
      });

      logger.info(
        `[NotificationEngine] 事件 ${event} 规则 ${rule.id} 发送完成: channel=${template.channel}, sent=${result.sent}/${result.total || userIds.length}`,
      );
    } catch (e) {
      logger.error(`[NotificationEngine] 处理规则 ${rule.id} 失败:`, e.message);
      await notificationLog.addLog({
        tenantId,
        ruleId: rule.id,
        eventCode: event,
        recipients: [],
        channel: 'unknown',
        title: '',
        content: '',
        status: 'failed',
        error: e.message,
      }).catch(() => {});
    }
  }
}

/**
 * 手动发送测试通知
 */
async function sendTestNotification({ tenantId, ruleId, payload }) {
  const rule = await notificationConfig.getRuleById(ruleId, tenantId);
  if (!rule) throw new Error('规则不存在');
  if (!rule.enabled) throw new Error('规则已禁用');

  const context = buildContext(payload);
  const userIds = await recipientService.resolveRuleRecipients(rule.recipients, payload, tenantId);
  if (!userIds.length) throw new Error('未解析到接收人');

  const template = await notificationConfig.getTemplateById(rule.template_id, tenantId);
  if (!template) throw new Error('模板不存在');

  const result = await sendByChannel(template.channel, {
    userIds,
    title: template.title_template,
    content: template.content_template,
    context,
    tenantId,
  });

  await notificationLog.addLog({
    tenantId,
    ruleId: rule.id,
    eventCode: rule.event_code,
    recipients: userIds,
    channel: template.channel,
    title: replaceVariables(template.title_template, context),
    content: replaceVariables(template.content_template, context),
    status: result.sent > 0 ? 'success' : 'failed',
    error: result.reason || null,
    sentCount: result.sent,
    totalCount: result.total,
  });

  return result;
}

/**
 * 初始化事件监听
 */
function initNotificationEngine() {
  if (!NOTIFICATION_ENGINE_ENABLED) {
    logger.info('[NotificationEngine] 通知引擎已通过环境变量关闭');
    return;
  }

  const eventBus = getEventBus();
  eventBus.onAny(async (eventData) => {
    const { event, data } = eventData;
    try {
      await processEvent(event, data);
    } catch (e) {
      logger.error(`[NotificationEngine] 事件 ${event} 处理失败:`, e.message);
    }
  });

  logger.info('[NotificationEngine] 通知引擎已注册');
}

module.exports = {
  initNotificationEngine,
  processEvent,
  sendTestNotification,
  replaceVariables,
  buildContext,
  evaluateCondition,
  sendByChannel,
};
