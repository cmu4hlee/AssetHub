/**
 * 微信小程序云数据库路由
 */

const express = require('express');
const router = express.Router();
const wxCloudDB = require('../services/wx-cloud-db.service');
const logger = require('../config/logger');

// 中间件：检查微信云开发是否已配置
function requireWxCloudConfig(req, res, next) {
  if (!wxCloudDB.isConfigured()) {
    return res.status(503).json({
      success: false,
      message: '微信云开发未配置，请在 .env 中设置 WX_CLOUD_APP_ID、WX_CLOUD_APP_SECRET、WX_CLOUD_ENV_ID',
    });
  }
  next();
}

/**
 * @swagger
 * /api/wx-cloud/status:
 *   get:
 *     tags:
 *       - 微信云数据库
 *     summary: 获取微信云开发连接状态
 *     security: []
 *     responses:
 *       200:
 *         description: 连接状态
 */
router.get('/status', async (req, res) => {
  try {
    const configured = wxCloudDB.isConfigured();
    let connected = false;

    if (configured) {
      try {
        await wxCloudDB.getAccessToken();
        connected = true;
      } catch {
        connected = false;
      }
    }

    res.json({
      success: true,
      data: {
        configured,
        connected,
        appId: wxCloudDB.appId ? `${wxCloudDB.appId.slice(0, 4)}****` : '',
        envId: wxCloudDB.envId || '',
      },
    });
  } catch (error) {
    logger.error('微信云开发状态检查失败:', error.message);
    res.json({
      success: true,
      data: { configured: false, connected: false },
    });
  }
});

/**
 * @swagger
 * /api/wx-cloud/collections:
 *   get:
 *     tags:
 *       - 微信云数据库
 *     summary: 获取集合列表
 *     responses:
 *       200:
 *         description: 集合列表
 */
router.get('/collections', requireWxCloudConfig, async (req, res) => {
  try {
    const result = await wxCloudDB.listCollections();
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('获取集合列表失败:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/wx-cloud/query:
 *   post:
 *     tags:
 *       - 微信云数据库
 *     summary: 查询记录
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - collection
 *             properties:
 *               collection:
 *                 type: string
 *                 description: 集合名称
 *               query:
 *                 type: object
 *                 description: 查询条件
 *               limit:
 *                 type: number
 *                 description: 返回数量限制
 *               offset:
 *                 type: number
 *                 description: 偏移量
 *               order:
 *                 type: object
 *                 properties:
 *                   field:
 *                     type: string
 *                   direction:
 *                     type: string
 *                     enum: [asc, desc]
 *     responses:
 *       200:
 *         description: 查询结果
 */
router.post('/query', requireWxCloudConfig, async (req, res) => {
  try {
    const { collection, query = {}, limit, offset, order } = req.body;

    if (!collection) {
      return res.status(400).json({ success: false, message: '缺少 collection 参数' });
    }

    const options = {};
    if (limit !== undefined) options.limit = limit;
    if (offset !== undefined) options.offset = offset;
    if (order) options.order = order;

    const result = await wxCloudDB.query(collection, query, options);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('查询记录失败:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/wx-cloud/add:
 *   post:
 *     tags:
 *       - 微信云数据库
 *     summary: 新增记录
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - collection
 *               - data
 *             properties:
 *               collection:
 *                 type: string
 *               data:
 *                 type: object
 *     responses:
 *       200:
 *         description: 新增结果
 */
router.post('/add', requireWxCloudConfig, async (req, res) => {
  try {
    const { collection, data } = req.body;

    if (!collection || !data) {
      return res.status(400).json({ success: false, message: '缺少 collection 或 data 参数' });
    }

    const result = await wxCloudDB.add(collection, data);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('新增记录失败:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/wx-cloud/update:
 *   post:
 *     tags:
 *       - 微信云数据库
 *     summary: 更新记录
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - collection
 *               - docId
 *               - data
 *             properties:
 *               collection:
 *                 type: string
 *               docId:
 *                 type: string
 *               data:
 *                 type: object
 *     responses:
 *       200:
 *         description: 更新结果
 */
router.post('/update', requireWxCloudConfig, async (req, res) => {
  try {
    const { collection, docId, data } = req.body;

    if (!collection || !docId || !data) {
      return res.status(400).json({ success: false, message: '缺少 collection、docId 或 data 参数' });
    }

    const result = await wxCloudDB.update(collection, docId, data);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('更新记录失败:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/wx-cloud/remove:
 *   post:
 *     tags:
 *       - 微信云数据库
 *     summary: 删除记录
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - collection
 *               - docId
 *             properties:
 *               collection:
 *                 type: string
 *               docId:
 *                 type: string
 *     responses:
 *       200:
 *         description: 删除结果
 */
router.post('/remove', requireWxCloudConfig, async (req, res) => {
  try {
    const { collection, docId } = req.body;

    if (!collection || !docId) {
      return res.status(400).json({ success: false, message: '缺少 collection 或 docId 参数' });
    }

    const result = await wxCloudDB.remove(collection, docId);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('删除记录失败:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/wx-cloud/count:
 *   post:
 *     tags:
 *       - 微信云数据库
 *     summary: 统计记录数
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - collection
 *             properties:
 *               collection:
 *                 type: string
 *               query:
 *                 type: object
 *     responses:
 *       200:
 *         description: 统计结果
 */
router.post('/count', requireWxCloudConfig, async (req, res) => {
  try {
    const { collection, query = {} } = req.body;

    if (!collection) {
      return res.status(400).json({ success: false, message: '缺少 collection 参数' });
    }

    const result = await wxCloudDB.count(collection, query);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('统计记录数失败:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/wx-cloud/aggregate:
 *   post:
 *     tags:
 *       - 微信云数据库
 *     summary: 聚合查询
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - collection
 *               - pipeline
 *             properties:
 *               collection:
 *                 type: string
 *               pipeline:
 *                 type: string
 *                 description: 聚合管道语句，如 .match({}).group({})
 *     responses:
 *       200:
 *         description: 聚合结果
 */
router.post('/aggregate', requireWxCloudConfig, async (req, res) => {
  try {
    const { collection, pipeline } = req.body;

    if (!collection || !pipeline) {
      return res.status(400).json({ success: false, message: '缺少 collection 或 pipeline 参数' });
    }

    const result = await wxCloudDB.aggregate(collection, pipeline);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('聚合查询失败:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
