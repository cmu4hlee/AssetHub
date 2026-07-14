/**
 * 国际化路由
 * 提供语言相关接口
 */

const express = require('express');
const router = express.Router();
const i18nService = require('../services/i18n.service');
const { authenticate } = require('../middleware/auth');

/**
 * @swagger
 * /api/i18n/locales:
 *   get:
 *     summary: 获取支持的语言列表
 *     tags: [Internationalization]
 *     responses:
 *       200:
 *         description: 语言列表
 */
router.get('/locales', (req, res) => {
  const locales = i18nService.getSupportedLocales();
  res.json({
    success: true,
    data: locales,
    current: req.locale,
  });
});

/**
 * @swagger
 * /api/i18n/messages/{locale}:
 *   get:
 *     summary: 获取指定语言的翻译消息
 *     tags: [Internationalization]
 *     parameters:
 *       - in: path
 *         name: locale
 *         required: true
 *         schema:
 *           type: string
 *         description: 语言代码 (zh, en)
 *     responses:
 *       200:
 *         description: 翻译消息
 */
router.get('/messages/:locale', (req, res) => {
  const { locale } = req.params;
  const { namespace = 'common' } = req.query;

  if (!i18nService.isSupported(locale)) {
    return res.status(400).json({
      success: false,
      message: `不支持的语言: ${locale}`,
    });
  }

  const messages = i18nService.locales[locale]?.[namespace] || {};
  res.json({
    success: true,
    data: messages,
    locale,
    namespace,
  });
});

/**
 * @swagger
 * /api/i18n/translate:
 *   post:
 *     summary: 翻译文本
 *     tags: [Internationalization]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               key:
 *                 type: string
 *               locale:
 *                 type: string
 *               namespace:
 *                 type: string
 *               params:
 *                 type: object
 *     responses:
 *       200:
 *         description: 翻译结果
 */
router.post('/translate', (req, res) => {
  const { key, locale = req.locale, namespace = 'common', params = {} } = req.body;

  const translation = i18nService.t(key, { locale, namespace, ...params });

  res.json({
    success: true,
    data: {
      key,
      translation,
      locale,
    },
  });
});

/**
 * @swagger
 * /api/i18n/switch:
 *   post:
 *     summary: 切换用户语言偏好（需要登录）
 *     tags: [Internationalization]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               locale:
 *                 type: string
 *     responses:
 *       200:
 *         description: 切换成功
 */
router.post('/switch', authenticate, async (req, res) => {
  const { locale } = req.body;
  const userId = req.user.id;

  if (!i18nService.isSupported(locale)) {
    return res.status(400).json({
      success: false,
      message: req.t('error.invalid', { field: 'locale' }),
    });
  }

  try {
    // 更新用户语言偏好
    const db = require('../config/database');
    await db.execute(
      'UPDATE users SET preferred_language = ? WHERE id = ?',
      [locale, userId],
    );

    res.json({
      success: true,
      message: req.t('common.success'),
      data: { locale },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: req.t('error.internal'),
      error: error.message,
    });
  }
});

module.exports = router;
