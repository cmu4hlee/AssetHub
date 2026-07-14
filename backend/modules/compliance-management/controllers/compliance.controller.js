/**
 * 合规性管理控制器
 * 符合《医学装备整体运维管理服务规范》要求
 */

const complianceService = require('../services/compliance.service');
const logger = require('../../../config/logger');

const ERROR_TYPES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE_ERROR: 'DUPLICATE_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};

class ComplianceController {
  /**
   * 获取模块状态
   */
  async getStatus(req, res) {
    res.json({
      success: true,
      data: {
        module_id: 'compliance-management',
        name: '合规性管理',
        version: '1.0.0',
        features: [
          { id: 'maintenance_level', name: '分级保养', enabled: true },
        ],
      },
    });
  }

  /**
   * 获取仪表板统计数据
   */
  async getDashboardStats(req, res) {
    try {
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: req.user?.role === 'super_admin' ? '请先选择企业空间' : '当前用户未分配企业空间',
          code: 'REQUIRE_TENANT',
        });
      }

      const stats = await complianceService.getDashboardStats(tenantId);
      res.json({ success: true, data: stats });
    } catch (error) {
      logger.error('获取仪表板统计数据失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: '获取统计数据失败', error: error.message });
    }
  }

  /**
   * 获取分级保养模板列表
   */
  async getMaintenanceTemplates(req, res) {
    try {
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
      if (!tenantId) {
        return res.status(400).json({ success: false, message: '缺少租户ID' });
      }

      const { maintenance_level, asset_category, status, page, pageSize } = req.query;
      const result = await complianceService.getMaintenanceTemplates(
        { maintenance_level, asset_category, status, page, pageSize },
        tenantId,
      );

      res.json({ success: true, data: result.data, pagination: result.pagination });
    } catch (error) {
      logger.error('获取保养模板列表失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: '获取保养模板列表失败' });
    }
  }

  /**
   * 获取单个保养模板
   */
  async getMaintenanceTemplateById(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
      if (!tenantId) {
        return res.status(400).json({ success: false, message: '缺少租户ID' });
      }

      const template = await complianceService.getMaintenanceTemplateById(id, tenantId);
      if (!template) {
        return res.status(404).json({ success: false, message: '模板不存在' });
      }

      res.json({ success: true, data: template });
    } catch (error) {
      logger.error('获取保养模板失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: '获取保养模板失败' });
    }
  }

  /**
   * 创建分级保养模板
   */
  async createMaintenanceTemplate(req, res) {
    try {
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
      if (!tenantId) {
        return res.status(400).json({ success: false, message: '缺少租户ID' });
      }

      const { template_code, template_name, maintenance_level } = req.body;
      if (!template_code || !template_name || !maintenance_level) {
        return res.status(400).json({
          success: false,
          message: '模板编码、名称和维护等级不能为空',
        });
      }

      const result = await complianceService.createMaintenanceTemplate(req.body, tenantId, req.user.id);
      res.json({ success: true, message: '保养模板创建成功', data: result });
    } catch (error) {
      logger.error('创建保养模板失败', { error: error.message, stack: error.stack });
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ success: false, message: '模板编码已存在' });
      }
      res.status(500).json({ success: false, message: '创建保养模板失败', error: error.message });
    }
  }

  /**
   * 更新保养模板
   */
  async updateMaintenanceTemplate(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
      if (!tenantId) {
        return res.status(400).json({ success: false, message: '缺少租户ID' });
      }

      const success = await complianceService.updateMaintenanceTemplate(id, req.body, tenantId);
      if (!success) {
        return res.status(404).json({ success: false, message: '模板不存在' });
      }

      res.json({ success: true, message: '更新成功' });
    } catch (error) {
      logger.error('更新保养模板失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: '更新保养模板失败', error: error.message });
    }
  }

  /**
   * 删除保养模板
   */
  async deleteMaintenanceTemplate(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
      if (!tenantId) {
        return res.status(400).json({ success: false, message: '缺少租户ID' });
      }

      const success = await complianceService.deleteMaintenanceTemplate(id, tenantId);
      if (!success) {
        return res.status(404).json({ success: false, message: '模板不存在' });
      }

      res.json({ success: true, message: '删除成功' });
    } catch (error) {
      logger.error('删除保养模板失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: '删除保养模板失败', error: error.message });
    }
  }

  /**
   * 获取保养计划列表
   */
  async getMaintenancePlans(req, res) {
    try {
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
      if (!tenantId) {
        return res.status(400).json({ success: false, message: '缺少租户ID' });
      }

      const { page, pageSize, status, asset_id } = req.query;
      const result = await complianceService.getMaintenancePlans(
        { page, pageSize, status, asset_id },
        tenantId,
      );

      res.json({ success: true, data: result.data, pagination: result.pagination });
    } catch (error) {
      logger.error('获取保养计划列表失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: '获取保养计划列表失败' });
    }
  }

  /**
   * 生成分级保养计划
   */
  async generateMaintenancePlans(req, res) {
    try {
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
      if (!tenantId) {
        return res.status(400).json({ success: false, message: '缺少租户ID' });
      }

      const { asset_ids, start_date, months } = req.body;
      if (!asset_ids || !Array.isArray(asset_ids) || asset_ids.length === 0) {
        return res.status(400).json({ success: false, message: '资产ID列表不能为空' });
      }
      if (!start_date) {
        return res.status(400).json({ success: false, message: '开始日期不能为空' });
      }

      const generatedPlans = await complianceService.generateMaintenancePlans(
        asset_ids,
        start_date,
        months || 3,
        tenantId,
        req.user.id,
      );

      res.json({
        success: true,
        message: `成功生成 ${generatedPlans.length} 条保养计划`,
        data: generatedPlans,
      });
    } catch (error) {
      logger.error('生成保养计划失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: '生成保养计划失败', error: error.message });
    }
  }

}

module.exports = new ComplianceController();
