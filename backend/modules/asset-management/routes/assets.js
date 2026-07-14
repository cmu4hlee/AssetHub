const { createModuleRouter, wrapAsync } = require('../../../core/module-router');
const assetController = require('../controllers/asset.controller');
const categoryController = require('../controllers/category.controller');
const imageRoutes = require('./images.routes');
const changeLogRoutes = require('./change-logs.routes');
const transitionRoutes = require('./transitions.routes');

// 注册资产 ↔ 发票事件订阅（load-time 副作用，可重复调用内部去重）
// 字段真主：本模块负责维护 assets.invoice_id / invoice_no / capitalized_at
try {
  const invoiceLinkSubscriber = require('../services/invoice-link.subscriber');
  invoiceLinkSubscriber.bind();
} catch (e) {
  // 失败不阻塞启动
}

module.exports = createModuleRouter('asset-management', (router) => {
  // ==================== 资产 CRUD ====================

  // 获取资产列表
  router.get('/', wrapAsync(assetController.getAssets));

  // 获取资产分类列表
  router.get('/categories', wrapAsync(assetController.getCategories));
  router.get('/categories/list', wrapAsync(categoryController.list));
  router.get('/categories/tree', wrapAsync(categoryController.tree));

  // 获取资产位置列表
  router.get('/locations', wrapAsync(assetController.getLocations));

  // 资产编号重复校验
  router.get('/duplicate-check', wrapAsync(assetController.checkAssetCodeDuplicate));

  // 资产图片子路由（必须在 /:id 之前，避免被参数路由吞掉）
  router.use(imageRoutes);

  // 资产变更日志子路由
  router.use(changeLogRoutes);

  // 资产状态迁移子路由
  router.use(transitionRoutes);

  // 获取资产详情
  router.get('/:id', wrapAsync(assetController.getAssetById));

  // 创建设备
  router.post('/', wrapAsync(assetController.createAsset));

  // 更新资产
  router.put('/:id', wrapAsync(assetController.updateAsset));

  // 删除资产
  router.delete('/:id', wrapAsync(assetController.deleteAsset));
});
