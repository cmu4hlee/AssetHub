/**
 * 飞书机器人 ↔ 资产 AI 助手 双向消息桥接服务
 *
 * 架构：
 *   1. 飞书用户通过机器人私聊/群@ 发送消息
 *   2. 飞书事件 webhook 推送到 /api/feishu/event
 *   3. 本服务解析消息体，提取文本和发送者 open_id
 *   4. 调用 assetAIAssistant.sendMessage() 拿到 AI 回复
 *   5. 通过 feishu-client.sendText() 把回复发回用户
 *
 * 特性：
 *   - 自动会话管理：同一用户同一天共享 session_id，跨天开启新会话
 *   - 降级容错：AI 失败时给用户友好提示，不暴露内部错误
 *   - 忽略机器人消息：避免循环调用
 *   - 私聊 + 群@ 都支持
 */

const logger = require('../../../config/logger');
const feishuClient = require('./feishu-client');
const assetAIAssistantService = require('../../asset-ai-assistant/services/asset-ai-assistant.service');

// 在内存中缓存每个用户的 session_id（避免每次 AI 助手都创建新会话）
const _sessionCache = new Map(); // key: open_id, value: { session_id, date }

const BOT_ID_CACHE = { value: null, ts: 0 };

/**
 * 获取/生成 session_id
 * 策略：同一用户同一天复用 session_id，跨天新会话
 */
function getOrCreateSessionId(openId) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const cached = _sessionCache.get(openId);

  if (cached && cached.date === today) {
    return cached.session_id;
  }

  // 新会话：session_id 用 feishu_{open_id}_{date}
  const sessionId = `feishu_${openId.replace(/[^a-zA-Z0-9_]/g, '_')}_${today}`;
  _sessionCache.set(openId, { session_id: sessionId, date: today });
  return sessionId;
}

/**
 * 从 message 事件中提取纯文本内容
 */
function extractTextFromMessage(message) {
  if (!message) return null;
  if (message.message_type === 'text' && message.content) {
    try {
      const parsed = typeof message.content === 'string' ? JSON.parse(message.content) : message.content;
      return (parsed.text || '').trim();
    } catch (e) {
      return null;
    }
  }
  return null;
}

/**
 * 判断消息是否 @ 了机器人
 */
function isMentionedBot(message, botOpenId) {
  if (!message?.mentions || !Array.isArray(message.mentions) || !botOpenId) return false;
  return message.mentions.some(m => m.id?.open_id === botOpenId);
}

/**
 * 主入口：处理飞书事件消息（从 controller 调用）
 *
 * @param {Object} eventData - 飞书消息事件数据
 * @param {Object} options - 额外配置 { tenantId, appId, appSecret, botOpenId }
 * @returns {Promise<Object>} 处理结果
 */
async function handleBotMessage(eventData, options = {}) {
  const { sender, message, chat_id, chat_type } = eventData;
  const { tenantId, botOpenId } = options;

  // 0. 忽略机器人自身发送的消息（防止循环）
  if (sender?.sender_type === 'app' || sender?.sender_id?.open_id === botOpenId) {
    logger.debug('[FeishuBotRelay] 忽略机器人自身消息');
    return { handled: false, reason: 'self_message' };
  }

  const openId = sender?.sender_id?.open_id;
  if (!openId) {
    logger.warn('[FeishuBotRelay] 消息缺少 sender.open_id');
    return { handled: false, reason: 'no_open_id' };
  }

  // 1. 提取文本
  const text = extractTextFromMessage(message);
  if (!text) {
    logger.debug('[FeishuBotRelay] 非文本消息或内容为空，忽略');
    return { handled: false, reason: 'non_text_or_empty' };
  }

  // 2. 群聊需要 @ 机器人才响应
  if (chat_type === 'group') {
    if (!isMentionedBot(message, botOpenId)) {
      logger.debug('[FeishuBotRelay] 群聊未 @ 机器人，忽略');
      return { handled: false, reason: 'group_not_mentioned' };
    }
    // 去掉 @ 机器人的部分
    const mentionRegex = /@_user_\d+\s*/g;
    const cleanedText = text.replace(mentionRegex, '').trim();
    if (!cleanedText) {
      await safeReply(openId, '您好，请问有什么可以帮您？', options);
      return { handled: true };
    }
    return await relayToAI(openId, cleanedText, tenantId, options);
  }

  // 3. 私聊直接转发
  return await relayToAI(openId, text, tenantId, options);
}

/**
 * 把用户消息转发给 AI 助手，把回复发回飞书用户
 */
async function relayToAI(openId, userMessage, tenantId, options) {
  const sessionId = getOrCreateSessionId(openId);

  logger.info(`[FeishuBotRelay] 收到飞书消息`, {
    openId,
    sessionId,
    textPreview: userMessage.slice(0, 50),
  });

  // 1. 先回一个"思考中"的提示，避免用户以为没响应
  //    （AI 同步调用通常 2-10s，给个反馈体验更好）
  let thinkingSent = false;
  try {
    await safeReply(openId, '🤔 正在思考...', { ...options, silentOnError: true });
    thinkingSent = true;
  } catch (e) {
    // 静默失败：思考提示不重要
  }

  // 2. 调用 AI 助手
  let aiResponse = null;
  let aiError = null;
  try {
    aiResponse = await assetAIAssistantService.sendMessage(
      {
        session_id: sessionId,
        message: userMessage,
        mode: 'chat',
      },
      tenantId || 0,
    );
  } catch (err) {
    aiError = err;
    logger.error('[FeishuBotRelay] 调用 AI 助手失败', { error: err.message });
  }

  // 3. 构造回复文本
  let replyText;
  if (aiError) {
    replyText = '抱歉，AI 助手暂时无法响应，请稍后再试。';
  } else {
    replyText = aiResponse?.response || '抱歉，未获取到 AI 回复。';
    // 飞书消息有长度限制（普通消息 4000 字），超长截断
    if (replyText.length > 3800) {
      replyText = replyText.slice(0, 3800) + '\n\n...(回复过长已截断)';
    }
  }

  // 4. 如果之前发了思考提示，且 AI 回复过长，发一个完整的新消息
  //    否则就更新原消息（飞书支持 PATCH，但实现复杂，这里用"再次发送"）
  if (thinkingSent && !aiError) {
    // 简单策略：直接发新的完整消息，用户会看到两条消息（思考提示+正式回复）
    await safeReply(openId, replyText, options);
  } else {
    await safeReply(openId, replyText, options);
  }

  return {
    handled: true,
    openId,
    sessionId,
    aiResponse: aiResponse ? {
      message_id: aiResponse.message_id,
      response_length: aiResponse.response?.length || 0,
    } : null,
    error: aiError?.message,
  };
}

/**
 * 发送回复（带异常隔离，避免 AI 调用失败后无法回复用户）
 */
async function safeReply(openId, text, options = {}) {
  const { silentOnError = false, host, appId, appSecret } = options;
  try {
    const sendOptions = { host };
    if (appId) sendOptions.appId = appId;
    if (appSecret) sendOptions.appSecret = appSecret;
    await feishuClient.sendText('open_id', openId, text, sendOptions);
    if (!silentOnError) {
      logger.info(`[FeishuBotRelay] ✅ 成功回复用户 ${openId}: ${text.slice(0, 50)}...`);
    }
  } catch (err) {
    if (!silentOnError) {
      // 详细记录错误细节（飞书 API 返回的 message/code）
      logger.error('[FeishuBotRelay] 回复飞书用户失败', {
        openId,
        error: err.message,
        code: err.code,
        apiCode: err.apiCode,
        apiMsg: err.apiMsg,
      });
    }
  }
}

/**
 * 清空会话缓存（用于测试或管理接口）
 */
function clearSessionCache() {
  _sessionCache.clear();
}

module.exports = {
  handleBotMessage,
  extractTextFromMessage,
  isMentionedBot,
  getOrCreateSessionId,
  clearSessionCache,
};