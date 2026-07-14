/**
 * 资产管理路由 - 重构后入口
 * 将原有的4460行代码拆分为多个模块
 *
 * @version 2.0.0
 * @author AssetHub Team
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');

// 导入子路由模块
const queryRoutes = require('./asset.query');
const mutationRoutes = require('./asset.mutation');
const importExportRoutes = require('./asset.import-export');
const categoryRoutes = require('./asset.category');
const statisticsRoutes = require('./asset.statistics');
const transferRoutes = require('./asset.transfer');
const shareRoutes = require('./asset.share');

// 注册子路由 - 注意：具体路径路由必须在参数路由之前注册
// 1. 首先注册具体路径路由（防止被 /:id 拦截）
router.use('/categories', categoryRoutes);  // 分类管理路由 /categories, /categories/tree
router.use('/statistics', statisticsRoutes); // 统计路由 /statistics/overview
router.use('/', importExportRoutes);    // 导入导出路由 /import, /export, /download-template
router.use('/', transferRoutes);        // 调拨路由 /transfer-requests, /:id/transfer-apply
router.use('/', shareRoutes);           // 分享路由 /:id/share, /share/verify

// 2. 最后注册查询路由（包含 /:id 参数路由）
router.use('/', queryRoutes);           // GET /, GET /:id, /:id/change-logs 等查询路由
router.use('/', mutationRoutes);        // POST, PUT, DELETE 等变更路由

// 暴露导入模块测试钩子，兼容历史单测
router.__testables = importExportRoutes.__testables;

module.exports = router;
