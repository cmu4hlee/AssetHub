/**
 * @swagger
 * /api/page-views/{pageKey}:
 *   get:
 *     summary: 获取页面访问量
 *     description: 获取指定页面的访问次数
 *     tags: [页面访问]
 *     parameters:
 *       - in: path
 *         name: pageKey
 *         required: true
 *         schema:
 *           type: string
 *         description: 页面标识
 *     responses:
 *       200:
 *         description: 成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     pageKey:
 *                       type: string
 *                     viewCount:
 *                       type: integer
 *       400:
 *         description: 无效的页面标识
 *       500:
 *         description: 服务器错误
 *   post:
 *     summary: 增加页面访问量
 *     description: 为指定页面增加一次访问
 *     tags: [页面访问]
 *     parameters:
 *       - in: path
 *         name: pageKey
 *         required: true
 *         schema:
 *           type: string
 *         description: 页面标识
 *     responses:
 *       200:
 *         description: 成功
 *       400:
 *         description: 无效的页面标识
 *       500:
 *         description: 服务器错误
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');

let ensureTablePromise = null;

async function ensurePageViewsTable() {
  if (!ensureTablePromise) {
    ensureTablePromise = db.execute(`
      CREATE TABLE IF NOT EXISTS public_page_views (
        page_key VARCHAR(100) NOT NULL PRIMARY KEY,
        view_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).catch(error => {
      ensureTablePromise = null;
      throw error;
    });
  }

  return ensureTablePromise;
}

const normalizePageKey = value => {
  const pageKey = String(value || '').trim().toLowerCase();
  return /^[a-z0-9_-]{1,100}$/.test(pageKey) ? pageKey : '';
};

async function readViewCount(pageKey) {
  const [rows] = await db.execute(
    'SELECT view_count FROM public_page_views WHERE page_key = ? LIMIT 1',
    [pageKey],
  );
  return Number.parseInt(String(rows?.[0]?.view_count ?? 0), 10) || 0;
}

router.get('/:pageKey', async (req, res) => {
  try {
    const pageKey = normalizePageKey(req.params.pageKey);
    if (!pageKey) {
      return res.status(400).json({ success: false, message: '无效的页面标识' });
    }

    await ensurePageViewsTable();
    const viewCount = await readViewCount(pageKey);

    res.json({
      success: true,
      data: {
        pageKey,
        viewCount,
      },
    });
  } catch (error) {
    console.error('读取页面访问量失败:', error);
    res.status(500).json({ success: false, message: '读取页面访问量失败' });
  }
});

router.post('/:pageKey', async (req, res) => {
  try {
    const pageKey = normalizePageKey(req.params.pageKey);
    if (!pageKey) {
      return res.status(400).json({ success: false, message: '无效的页面标识' });
    }

    await ensurePageViewsTable();
    await db.execute(
      `INSERT INTO public_page_views (page_key, view_count)
       VALUES (?, 1)
       ON DUPLICATE KEY UPDATE view_count = view_count + 1`,
      [pageKey],
    );

    const viewCount = await readViewCount(pageKey);

    res.json({
      success: true,
      data: {
        pageKey,
        viewCount,
      },
    });
  } catch (error) {
    console.error('记录页面访问量失败:', error);
    res.status(500).json({ success: false, message: '记录页面访问量失败' });
  }
});

module.exports = router;
