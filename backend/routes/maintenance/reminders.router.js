const express = require('express');
const { authenticate, authorize } = require('../../middleware/auth');
const remindersService = require('../../services/maintenance/reminders.service');

const router = express.Router();

const MN_GET = ['maintenance.view', 'asset.view_all', 'asset.view_own_department'];
const MN_WRITE = ['maintenance.add', 'maintenance.edit', 'asset.edit_all', 'asset.edit_own_department'];
const MN_DEL = ['maintenance.delete', 'maintenance.edit', 'asset.delete_all', 'asset.delete_own_department'];

function sendResult(res, result) {
  if (result && result.statusCode && result.statusCode !== 200) {
    return res.status(result.statusCode).json(result.body);
  }

  if (result && result.body) {
    return res.json(result.body);
  }

  return res.json(result);
}

router.get('/reminders', authenticate, authorize(MN_GET), async (req, res) => {
  try {
    const result = await remindersService.getReminders(req.query, req);
    sendResult(res, result);
  } catch (error) {
    console.error('获取提醒列表失败:', error);
    res.status(500).json({ success: false, message: '获取提醒列表失败', error: error.message });
  }
});

router.post('/reminders/send', authenticate, authorize(MN_WRITE), async (req, res) => {
  try {
    const result = await remindersService.sendReminder(req.body, req);
    sendResult(res, result);
  } catch (error) {
    console.error('发送提醒失败:', error);
    res.status(500).json({ success: false, message: '发送提醒失败', error: error.message });
  }
});

router.post('/reminders/config', authenticate, authorize(MN_WRITE), async (req, res) => {
  try {
    const result = await remindersService.configReminder(req.body, req);
    sendResult(res, result);
  } catch (error) {
    console.error('配置提醒规则失败:', error);
    res.status(500).json({ success: false, message: '配置提醒规则失败', error: error.message });
  }
});

router.get('/reminders/check', authenticate, authorize(MN_GET), async (req, res) => {
  try {
    const result = await remindersService.checkReminders(req);
    sendResult(res, result);
  } catch (error) {
    console.error('检查到期维护计划失败:', error);
    res.status(500).json({ success: false, message: '检查到期维护计划失败', error: error.message });
  }
});

module.exports = router;
