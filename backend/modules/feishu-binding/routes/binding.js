/**
 * 飞书绑定模块 - 绑定路由
 */
const express = require('express');
const router = express.Router();
const bindingController = require('../controllers/binding.controller');
const { authenticate } = require('../../../middleware/auth');

// 获取绑定状态
router.get('/status', authenticate, bindingController.getBindingStatus);

// 获取授权URL
router.get('/auth-url', authenticate, bindingController.getAuthUrl);

// 处理回调
router.get('/callback', bindingController.handleCallback);

// 绑定用户
router.post('/bind', authenticate, bindingController.bindUser);

// 解绑
router.post('/unbind', authenticate, bindingController.unbindUser);

// 获取用户信息
router.get('/user-info', authenticate, bindingController.getUserInfo);

// 发送消息
router.post('/send-message', authenticate, bindingController.sendMessage);

// 获取绑定列表
router.get('/list', authenticate, bindingController.getBindingList);

module.exports = router;
