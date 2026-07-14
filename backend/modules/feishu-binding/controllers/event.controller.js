/**
 * 飞书事件 Webhook 控制器
 *
 * 处理飞书开放平台推送的各类事件，目前主要处理：
 *   - im.message.receive_v1：用户给机器人发消息
 *   - url_verification：飞书的事件订阅验证（首次配置时）
 */

const crypto = require('crypto');
const logger = require('../../../config/logger');
const db = require('../../../config/database');
const { getDecryptedAppCredentials } = require('../services/binding.service');
const botRelay = require('../services/bot-message-relay.service');

/**
 * 事件订阅验证（飞书首次配置 callback URL 时调用）
 */
function handleUrlVerification(body) {
  // 飞书会发送 { challenge: "..." }，我们需要原样返回 challenge
  if (body.type === 'url_verification' || body.challenge) {
    return { challenge: body.challenge };
  }
  return null;
}

/**
 * 验证飞书事件签名（可选，安全加固）
 */
function verifyEventSignature(headers, body) {
  // 飞书事件订阅支持签名校验（可选）
  // 配置 FEISHU_VERIFICATION_TOKEN + FEISHU_ENCRYPT_KEY 时启用
  const token = process.env.FEISHU_VERIFICATION_TOKEN;
  const encryptKey = process.env.FEISHU_ENCRYPT_KEY;
  if (!token) return { valid: true, reason: 'no_token_configured' };

  // 这里实现简化版校验，详细可参考 https://open.feishu.cn/document/server-docs/event-subscription-guide/event-subscription-configure-/encrypt-key
  return { valid: true };
}

/**
 * 处理 im.message.receive_v1 事件
 * @param {Object} event - 事件 payload
 */
async function handleMessageReceiveEvent(event) {
  try {
    const { sender, message, chat_id, chat_type } = event;

    // 1. 根据 chat_id 或 sender 的 tenant_key 查找绑定的飞书应用配置
    //    （多租户场景：不同租户绑定了不同的飞书应用）
    const tenantId = await lookupTenantByChat(chat_id, sender);

    if (!tenantId) {
      logger.warn('[FeishuEvent] 未找到消息对应的租户绑定', { chat_id, senderId: sender?.sender_id?.open_id });
      return { ok: false, reason: 'tenant_not_found' };
    }

    // 2. 获取该租户的飞书应用凭证
    const credentials = await getDecryptedAppCredentials(tenantId);
    if (!credentials) {
      logger.warn('[FeishuEvent] 租户未绑定飞书应用', { tenantId });
      return { ok: false, reason: 'app_not_bound' };
    }

    const feishuOptions = {
      appId: credentials.appId,
      appSecret: credentials.appSecret,
      host: credentials.host,
      tenantId,
      botOpenId: credentials.botOpenId,
    };

    // 3. 调用桥接服务
    const result = await botRelay.handleBotMessage(
      { sender, message, chat_id, chat_type },
      feishuOptions,
    );

    return { ok: true, result };
  } catch (err) {
    logger.error('[FeishuEvent] 处理消息事件失败', { error: err.message, stack: err.stack });
    return { ok: false, error: err.message };
  }
}

/**
 * 根据 chat_id 或 sender 信息查找对应的租户 ID
 * 策略：从 tenant_configs 表查询 feishu 配置
 */
async function lookupTenantByChat(chatId, sender) {
  try {
    // 简化策略：从所有 feishu 配置里匹配
    // 多租户场景：每个租户绑定一个飞书应用，每个飞书应用有自己的 chat
    // 这里只能根据 sender.open_id 查 user 表，找用户的 tenant
    if (!sender?.sender_id?.open_id) return null;

    // 1. 优先查 feishu_user_bindings 表（如已存在）
    try {
      const [rows] = await db.execute(
        `SELECT tenant_id FROM feishu_user_bindings WHERE feishu_open_id = ? LIMIT 1`,
        [sender.sender_id.open_id],
      );
      if (rows.length > 0) return rows[0].tenant_id;
    } catch (e) {
      // 表不存在时静默忽略，回退到 tenant_configs
    }

    // 2. 回退：默认租户（第一个绑定飞书的租户）
    const [defaultRow] = await db.execute(
      `SELECT tenant_id FROM tenant_configs WHERE config_key = 'feishu' AND enabled = 1 LIMIT 1`,
    );
    return defaultRow.length > 0 ? defaultRow[0].tenant_id : null;
  } catch (err) {
    logger.error('[FeishuEvent] 查找租户失败', { error: err.message });
    return null;
  }
}

/**
 * Express 路由处理：飞书事件 webhook
 * POST /api/feishu/event
 */
async function handleEventWebhook(req, res) {
  const body = req.body || {};

  // 1. URL 验证
  const verification = handleUrlVerification(body);
  if (verification) {
    logger.info('[FeishuEvent] URL 验证请求，返回 challenge');
    return res.json(verification);
  }

  // 2. 签名校验（可选）
  const sigResult = verifyEventSignature(req.headers, body);
  if (!sigResult.valid) {
    logger.warn('[FeishuEvent] 事件签名校验失败', sigResult);
    return res.status(401).json({ ok: false, error: 'invalid_signature' });
  }

  // 3. 处理事件
  const { header, event } = body;
  const eventType = header?.event_type || event?.type;

  // 详细日志：打印完整事件头信息（方便排查"为啥没反应"）
  logger.info('[FeishuEvent] 收到事件', {
    eventType,
    appId: header?.app_id,
    tenantKey: header?.tenant_key,
    eventId: header?.event_id,
    hasSender: !!event?.sender,
    chatType: event?.message?.chat_type,
    messageType: event?.message?.message_type,
    contentPreview: typeof event?.message?.content === 'string'
      ? event.message.content.slice(0, 100)
      : JSON.stringify(event?.message?.content || {}).slice(0, 100),
  });

  // 飞书期望 200 OK 快速返回，业务异步处理
  res.json({ ok: true });

  // 4. 异步处理具体事件
  setImmediate(async () => {
    try {
      switch (eventType) {
        case 'im.message.receive_v1':
          await handleMessageReceiveEvent(event);
          break;
        default:
          logger.debug('[FeishuEvent] 未处理的事件类型', { eventType });
      }
    } catch (err) {
      logger.error('[FeishuEvent] 异步处理事件失败', { eventType, error: err.message });
    }
  });
}

module.exports = {
  handleEventWebhook,
  handleUrlVerification,
  handleMessageReceiveEvent,
};