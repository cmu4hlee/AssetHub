const express = require('express');
const router = express.Router();
const maintenanceRouter = require('./maintenance');

// 挂载维护管理路由
router.use('/', maintenanceRouter);

module.exports = router;
