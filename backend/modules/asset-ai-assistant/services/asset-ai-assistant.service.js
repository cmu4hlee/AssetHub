/**
 * 资产AI助手服务
 *
 * sendMessage 现在调用 gateway-ai-service 的 OpenClaw 后端，与项目内其他 AI 调用保持一致。
 *  - OpenClaw 启用条件：OPENCLAW_ENABLED=true 且 OPENCLAW_BASE_URL 已配置
 *  - 会话上下文：传入的 session_id 透传给 OpenClaw 作为 user 标识（OpenClaw 内部维护历史）
 *  - 降级：OpenClaw 未启用或调用失败 → 返回友好错误
 */
const logger = require('../../../config/logger');
let gatewayAIService = null;
try {
  gatewayAIService = require('../../../services/gateway-ai-service');
} catch (e) {
  logger.warn('[AssetAIAssistant] 无法加载 gateway-ai-service，将回退到模拟响应', { error: e.message });
}

class AssetAIAssistantService {
  /**
   * 获取AI助手配置
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Object>} 配置信息
   */
  async getAssistantConfig(tenantId) {
    const moduleConfig = require('../config/module.config');
    return {
      base_url: moduleConfig.default_config.base_url,
      open_mode: moduleConfig.default_config.open_mode,
      enabled_modes: moduleConfig.default_config.enabled_modes,
      default_mode: moduleConfig.default_config.default_mode,
      session_timeout_minutes: moduleConfig.default_config.session_timeout_minutes,
    };
  }

  /**
   * 更新AI助手配置
   * @param {Object} configData - 配置数据
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Object>} 更新结果
   */
  async updateAssistantConfig(configData, tenantId) {
    const { base_url, open_mode, enabled_modes, default_mode, session_timeout_minutes } = configData;

    // 配置更新逻辑（可以存储到数据库）
    const updatedConfig = {};

    if (base_url !== undefined) {
      updatedConfig.base_url = base_url;
    }
    if (open_mode !== undefined) {
      updatedConfig.open_mode = open_mode;
    }
    if (enabled_modes !== undefined) {
      updatedConfig.enabled_modes = enabled_modes;
    }
    if (default_mode !== undefined) {
      updatedConfig.default_mode = default_mode;
    }
    if (session_timeout_minutes !== undefined) {
      updatedConfig.session_timeout_minutes = session_timeout_minutes;
    }

    logger.info('更新AI助手配置', { tenantId, updatedConfig });

    return updatedConfig;
  }

  /**
   * 创建会话
   * @param {Object} sessionData - 会话数据
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Object>} 会话信息
   */
  async createSession(sessionData, tenantId) {
    const { mode = 'assistant', context } = sessionData;

    const sessionId = `SESSION_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    logger.info('创建AI助手会话', { tenantId, sessionId, mode });

    return {
      session_id: sessionId,
      mode,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30分钟后过期
    };
  }

  /**
   * 发送消息到AI助手（真实调用：gateway-ai-service → OpenClaw）
   *
   * @param {Object} messageData - { session_id, message, mode }
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Object>} AI响应 { session_id, message_id, response, mode, created_at }
   */
  async sendMessage(messageData, tenantId) {
    const { session_id, message, mode } = messageData || {};

    if (!message) {
      throw new Error('消息内容不能为空');
    }

    logger.info('发送消息到AI助手', { tenantId, session_id, mode, messageLength: message.length });

    // 1. 优先走 OpenClaw（与项目其他 AI 调用保持一致）
    if (gatewayAIService && gatewayAIService.sendMessage) {
      try {
        const result = await gatewayAIService.sendMessage(message, {
          provider: 'openclaw',
          sessionId: session_id,
          // 通过 metadata 把租户/上下文透传给 OpenClaw 内部 assethub MCP 工具
          metadata: {
            tenant_id: tenantId,
            source: 'feishu-bot-relay',
          },
        });

        const reply = result.reply || result.id ? '' : '';
        const responseText = result.reply || '（AI 未返回内容）';

        logger.info('OpenClaw 助手回复成功', {
          tenantId,
          session_id,
          replyLength: responseText.length,
          runId: result.runId || result.id,
        });

        return {
          session_id,
          message_id: result.id || `MSG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          response: responseText,
          mode: mode || 'assistant',
          provider: 'openclaw',
          run_id: result.runId || result.id || null,
          created_at: new Date().toISOString(),
        };
      } catch (err) {
        // OpenClaw 调用失败 → 记录错误并降级（不抛异常，让上层决定怎么处理）
        logger.error('OpenClaw 调用失败', {
          tenantId,
          session_id,
          error: err.message,
        });

        return {
          session_id,
          message_id: `MSG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          response: '抱歉，AI 助手暂时无法响应，请稍后再试。',
          mode: mode || 'assistant',
          provider: 'openclaw',
          error: err.message,
          created_at: new Date().toISOString(),
        };
      }
    }

    // 2. 降级：gateway-ai-service 未加载时的兜底（仅开发/测试）
    logger.warn('gateway-ai-service 未加载，返回模拟响应');
    return {
      session_id,
      message_id: `MSG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      response: '这是一个模拟的AI助手响应。请确认 gateway-ai-service 已正确配置。',
      mode: mode || 'assistant',
      provider: 'mock',
      created_at: new Date().toISOString(),
    };
  }

  /**
   * 获取会话历史
   * @param {string} sessionId - 会话ID
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Array>} 会话历史消息
   */
  async getSessionHistory(sessionId, tenantId) {
    logger.info('获取AI助手会话历史', { tenantId, sessionId });

    // 实际应用中应该从数据库或缓存中获取会话历史
    return [];
  }

  /**
   * 关闭会话
   * @param {string} sessionId - 会话ID
   * @param {string} tenantId - 租户ID
   * @returns {Promise<boolean>} 关闭结果
   */
  async closeSession(sessionId, tenantId) {
    logger.info('关闭AI助手会话', { tenantId, sessionId });
    return true;
  }

  /**
   * 获取助手状态
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Object>} 状态信息
   */
  async getAssistantStatus(tenantId) {
    const moduleConfig = require('../config/module.config');

    return {
      module_id: moduleConfig.id,
      name: moduleConfig.name,
      version: moduleConfig.version,
      status: 'online',
      base_url: moduleConfig.default_config.base_url,
      enabled_modes: moduleConfig.default_config.enabled_modes,
    };
  }
}

module.exports = new AssetAIAssistantService();
