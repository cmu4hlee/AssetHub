const inventoryService = require('../services/inventory.service');
const logger = require('../../../config/logger');

const ERROR_TYPES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE_ERROR: 'DUPLICATE_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};

class InventoryController {
  /**
   * 获取盘点记录列表
   */
  async listInventory(req, res) {
    try {
      const { page, pageSize, status } = req.query;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        logger.warn('获取盘点记录列表缺少租户ID', { path: req.path, method: req.method });
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const userContext = {
        role: req.user?.role,
        managed_departments: req.user?.managed_departments,
      };

      const result = await inventoryService.listInventoryRecords(
        tenantId,
        { page, pageSize, status },
        userContext,
      );

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error('获取盘点记录列表失败', {
        error: error.message,
        stack: error.stack,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(500).json({
        success: false,
        message: '获取盘点记录列表失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 获取盘点统计汇总
   */
  async getStatistics(req, res) {
    try {
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
      const result = await inventoryService.getStatistics(tenantId);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('获取盘点统计失败', {
        error: error.message,
        stack: error.stack,
      });
      res.status(500).json({
        success: false,
        message: '获取盘点统计失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 获取单个盘点记录详情
   */
  async getInventoryById(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      const record = await inventoryService.getInventoryById(id, tenantId);
      res.json({ success: true, data: record });
    } catch (error) {
      logger.error('获取盘点详情失败', {
        error: error.message,
        stack: error.stack,
        inventoryId: req.params.id,
      });
      if (error.code === 'INVENTORY_NOT_FOUND') {
        return res.status(404).json({ success: false, message: '盘点记录不存在' });
      }
      res.status(500).json({
        success: false,
        message: '获取盘点详情失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 创建盘点记录
   */
  async createInventory(req, res) {
    try {
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
      const result = await inventoryService.createInventory(tenantId, req.body);

      res.json({
        success: true,
        message: '盘点记录创建成功',
        data: result,
      });
    } catch (error) {
      logger.error('创建盘点记录失败', {
        error: error.message,
        stack: error.stack,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      if (error.code === 'VALIDATION_ERROR') {
        return res.status(400).json({
          success: false,
          message: error.message,
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }
      res.status(500).json({
        success: false,
        message: '创建盘点记录失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 更新盘点记录
   */
  async updateInventory(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      const success = await inventoryService.updateInventory(id, tenantId, req.body);

      if (!success) {
        return res.status(404).json({ success: false, message: '盘点记录不存在' });
      }

      res.json({ success: true, message: '盘点记录更新成功' });
    } catch (error) {
      logger.error('更新盘点记录失败', {
        error: error.message,
        stack: error.stack,
        inventoryId: req.params.id,
      });
      if (error.code === 'VALIDATION_ERROR') {
        return res.status(400).json({
          success: false,
          message: error.message,
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }
      res.status(500).json({
        success: false,
        message: '更新盘点记录失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 删除盘点记录
   */
  async deleteInventory(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      const success = await inventoryService.deleteInventory(id, tenantId);

      if (!success) {
        return res.status(404).json({ success: false, message: '盘点记录不存在' });
      }

      res.json({ success: true, message: '盘点记录删除成功' });
    } catch (error) {
      logger.error('删除盘点记录失败', {
        error: error.message,
        stack: error.stack,
        inventoryId: req.params.id,
      });
      if (error.code === 'INVALID_STATUS') {
        return res.status(400).json({
          success: false,
          message: error.message,
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }
      res.status(500).json({
        success: false,
        message: '删除盘点记录失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 更新盘点状态
   */
  async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      const result = await inventoryService.updateStatus(id, status, tenantId);
      res.json({ success: true, message: '盘点状态更新成功', data: result });
    } catch (error) {
      logger.error('更新盘点状态失败', {
        error: error.message,
        stack: error.stack,
        inventoryId: req.params.id,
      });
      if (error.code === 'INVALID_STATUS') {
        return res.status(400).json({
          success: false,
          message: error.message,
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }
      res.status(500).json({
        success: false,
        message: '更新盘点状态失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 启动盘点
   */
  async startInventory(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      const result = await inventoryService.startInventory(id, tenantId);
      res.json({ success: true, message: '盘点已启动', data: result });
    } catch (error) {
      logger.error('启动盘点失败', {
        error: error.message,
        stack: error.stack,
        inventoryId: req.params.id,
      });
      if (error.code === 'INVENTORY_NOT_FOUND') {
        return res.status(404).json({ success: false, message: '盘点记录不存在' });
      }
      if (error.code === 'INVALID_STATUS') {
        return res.status(400).json({
          success: false,
          message: error.message,
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }
      res.status(500).json({
        success: false,
        message: '启动盘点失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 完成盘点
   */
  async completeInventory(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      const result = await inventoryService.completeInventory(id, tenantId);
      res.json({ success: true, message: '盘点已完成', data: result });
    } catch (error) {
      logger.error('完成盘点失败', {
        error: error.message,
        stack: error.stack,
        inventoryId: req.params.id,
      });
      if (error.code === 'INVENTORY_NOT_FOUND') {
        return res.status(404).json({ success: false, message: '盘点记录不存在' });
      }
      if (error.code === 'INVALID_STATUS') {
        return res.status(400).json({
          success: false,
          message: error.message,
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }
      res.status(500).json({
        success: false,
        message: '完成盘点失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 获取盘点统计信息
   */
  async getInventoryStatistics(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      const result = await inventoryService.getInventoryStatistics(id, tenantId);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('获取盘点统计信息失败', {
        error: error.message,
        stack: error.stack,
        inventoryId: req.params.id,
      });
      res.status(500).json({
        success: false,
        message: '获取盘点统计信息失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 扫描资产（移动端扫码盘点）
   */
  async scanAsset(req, res) {
    try {
      const { id } = req.params;
      const { asset_code, scan_time, scan_type, location, status, photo } = req.body;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      const result = await inventoryService.scanAsset(id, tenantId, {
        asset_code,
        scan_time,
        scan_type,
        location,
        status,
        photo,
        username: req.user?.username,
      });

      res.json({ success: true, message: '盘点扫描成功', data: result });
    } catch (error) {
      logger.error('扫描资产失败', {
        error: error.message,
        stack: error.stack,
        inventoryId: req.params.id,
      });
      if (error.code === 'INVENTORY_NOT_FOUND' || error.code === 'ASSET_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          message: error.message,
          errorType: ERROR_TYPES.NOT_FOUND,
        });
      }
      res.status(500).json({
        success: false,
        message: '扫描处理失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 获取扫描历史
   */
  async getScanLogs(req, res) {
    try {
      const { id } = req.params;
      const { page, pageSize } = req.query;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      const result = await inventoryService.getScanLogs(id, tenantId, { page, pageSize });
      res.json({ success: true, data: result.data, pagination: result.pagination });
    } catch (error) {
      logger.error('获取扫描历史失败', {
        error: error.message,
        stack: error.stack,
        inventoryId: req.params.id,
      });
      res.status(500).json({
        success: false,
        message: '获取扫描历史失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 添加盘点明细
   */
  async addDetail(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      const result = await inventoryService.addDetail(id, tenantId, req.body);
      res.json({ success: true, message: '盘点明细添加成功', data: result });
    } catch (error) {
      logger.error('添加盘点明细失败', {
        error: error.message,
        stack: error.stack,
        inventoryId: req.params.id,
      });
      if (error.code === 'INVENTORY_NOT_FOUND' || error.code === 'ASSET_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          message: error.message,
          errorType: ERROR_TYPES.NOT_FOUND,
        });
      }
      res.status(500).json({
        success: false,
        message: '添加盘点明细失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 批量添加盘点明细
   */
  async batchAddDetails(req, res) {
    try {
      const { id } = req.params;
      const { details } = req.body;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      const count = await inventoryService.batchAddDetails(id, tenantId, details);
      res.json({ success: true, message: `成功添加 ${count} 条盘点明细` });
    } catch (error) {
      logger.error('批量添加盘点明细失败', {
        error: error.message,
        stack: error.stack,
        inventoryId: req.params.id,
      });
      if (error.code === 'INVENTORY_NOT_FOUND' || error.code === 'ASSET_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          message: error.message,
          errorType: ERROR_TYPES.NOT_FOUND,
        });
      }
      res.status(500).json({
        success: false,
        message: '批量添加盘点明细失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 更新盘点明细
   */
  async updateDetail(req, res) {
    try {
      const { id, detailId } = req.params;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      const success = await inventoryService.updateDetail(id, detailId, tenantId, req.body);
      if (!success) {
        return res.status(404).json({ success: false, message: '盘点明细不存在' });
      }
      res.json({ success: true, message: '盘点明细更新成功' });
    } catch (error) {
      logger.error('更新盘点明细失败', {
        error: error.message,
        stack: error.stack,
        inventoryId: req.params.id,
        detailId: req.params.detailId,
      });
      res.status(500).json({
        success: false,
        message: '更新盘点明细失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 删除盘点明细
   */
  async deleteDetail(req, res) {
    try {
      const { id, detailId } = req.params;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      const success = await inventoryService.deleteDetail(id, detailId, tenantId);
      if (!success) {
        return res.status(404).json({ success: false, message: '盘点明细不存在' });
      }
      res.json({ success: true, message: '盘点明细删除成功' });
    } catch (error) {
      logger.error('删除盘点明细失败', {
        error: error.message,
        stack: error.stack,
        inventoryId: req.params.id,
        detailId: req.params.detailId,
      });
      res.status(500).json({
        success: false,
        message: '删除盘点明细失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 获取自助盘点窗口
   */
  async getSelfCheckWindows(req, res) {
    try {
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
      const result = await inventoryService.getSelfCheckWindows(tenantId);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('获取自助盘点窗口失败', {
        error: error.message,
        stack: error.stack,
      });
      res.status(500).json({
        success: false,
        message: '获取自助盘点窗口失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 获取我的盘点资产
   */
  async getMyAssets(req, res) {
    try {
      const { inventory_id } = req.query;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
      const userContext = {
        username: req.user?.username,
        real_name: req.user?.real_name,
        department_code: req.user?.department_code,
      };

      const result = await inventoryService.getMyAssets(inventory_id, tenantId, userContext);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('获取我的盘点资产失败', {
        error: error.message,
        stack: error.stack,
      });
      res.status(500).json({
        success: false,
        message: '获取我的盘点资产失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 自助盘点确认
   */
  async confirmSelfCheck(req, res) {
    try {
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
      const userContext = {
        username: req.user?.username,
        real_name: req.user?.real_name,
        department_code: req.user?.department_code,
      };

      const result = await inventoryService.confirmSelfCheck(tenantId, req.body, userContext);
      res.json({ success: true, message: '盘点已提交', data: result });
    } catch (error) {
      logger.error('自助盘点确认失败', {
        error: error.message,
        stack: error.stack,
      });
      if (error.code === 'INVENTORY_NOT_FOUND' || error.code === 'ASSET_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          message: error.message,
          errorType: ERROR_TYPES.NOT_FOUND,
        });
      }
      res.status(500).json({
        success: false,
        message: '自助盘点确认失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }
}

module.exports = new InventoryController();
