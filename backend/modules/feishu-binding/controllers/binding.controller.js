/**
 * 飞书绑定模块 - 控制器
 * 处理飞书平台绑定相关的HTTP请求
 */
const bindingService = require('../services/binding.service');

/**
 * 获取绑定状态
 * GET /api/binding/feishu/status
 */
const getBindingStatus = async (req, res, next) => {
  try {
    const result = await bindingService.getBindingStatus(req.user);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * 获取授权URL
 * GET /api/binding/feishu/auth-url
 */
const getAuthUrl = async (req, res, next) => {
  try {
    const result = await bindingService.getAuthUrl(req.user);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * 处理飞书回调
 * GET /api/binding/feishu/callback
 */
const handleCallback = async (req, res, next) => {
  try {
    const { code } = req.query;
    const result = await bindingService.handleCallback(code, req.user);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * 绑定飞书用户
 * POST /api/binding/feishu/bind
 * 支持：
 *   1) OAuth 回调后绑定：body 透传 openId/accessToken/refreshToken/expiresIn/unionId 等
 *   2) 管理员手动绑定：body 传 feishuUserId + employeeNo（可选 name 等）
 */
const bindUser = async (req, res, next) => {
  try {
    const {
      feishuUserId, employeeNo,
      openId, accessToken, refreshToken, expiresIn,
      unionId, name, avatarUrl, email, mobile,
    } = req.body;
    const result = await bindingService.bindUser(req.user, {
      feishuUserId, employeeNo,
      openId, accessToken, refreshToken, expiresIn,
      unionId, name, avatarUrl, email, mobile,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * 解绑飞书
 * POST /api/binding/feishu/unbind
 */
const unbindUser = async (req, res, next) => {
  try {
    const result = await bindingService.unbindUser(req.user);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * 获取飞书用户信息
 * GET /api/binding/feishu/user-info?refresh=true
 */
const getUserInfo = async (req, res, next) => {
  try {
    const refresh = req.query.refresh === 'true' || req.query.refresh === '1';
    const result = await bindingService.getUserInfo(req.user, { refresh });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * 发送飞书消息
 * POST /api/binding/feishu/send-message
 * body: { toUserId?, openId?, receiveIdType?, messageType?, content }
 */
const sendMessage = async (req, res, next) => {
  try {
    const { toUserId, openId, receiveIdType, messageType, content } = req.body;
    const result = await bindingService.sendMessage(req.user, {
      toUserId, openId, receiveIdType, messageType, content,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * 获取绑定列表
 * GET /api/binding/feishu/list?page=1&pageSize=20&tenantId=
 */
const getBindingList = async (req, res, next) => {
  try {
    const { page = 1, pageSize = 20, tenantId } = req.query;
    const filters = {};
    if (tenantId) filters.tenantId = parseInt(tenantId);
    // 默认按当前用户租户过滤
    if (!filters.tenantId && req.user?.tenant_id) {
      filters.tenantId = req.user.tenant_id;
    }
    const result = await bindingService.getBindingList({ page, pageSize }, filters);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getBindingStatus,
  getAuthUrl,
  handleCallback,
  bindUser,
  unbindUser,
  getUserInfo,
  sendMessage,
  getBindingList,
};
