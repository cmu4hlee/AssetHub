const express = require('express');
const router = express.Router();
const acceptanceRouter = require('./acceptance');

// 挂载验收管理路由
router.use('/', acceptanceRouter);

module.exports = router;
