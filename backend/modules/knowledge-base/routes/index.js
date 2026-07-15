/**
 * 知识库模块 - 路由总入口
 */

const express = require('express');
const router = express.Router();
const knowledgeBaseRouter = require('./knowledge-base');

router.use('/', knowledgeBaseRouter);

router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'knowledge-base module is running',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
