/**
 * 审计日志增强路由
 * 提供审计日志的查询、统计、导出等功能
 */

const express = require('express');
const { authenticate } = require('../middleware/auth');
const { getTenantId } = require('../middleware/tenant-filter');
const auditLoggerService = require('../services/audit-logger.service');
const logger = require('../config/logger');

const router = express.Router();

/**
 * 查询审计日志
 * GET /api/audit-logs/enhanced
 */
router.get('/enhanced', authenticate, async (req, res) => {
  try {
    const {
      operation,
      resourceType,
      resourceId,
      status,
      startDate,
      endDate,
      keyword,
      page = 1,
      pageSize = 20,
    } = req.query;

    const tenantId = getTenantId(req);
    const userId = req.user.role === 'super_admin' ? null : req.user.id;

    const result = await auditLoggerService.query({
      tenantId,
      userId,
      operation,
      resourceType,
      resourceId,
      status,
      startDate,
      endDate,
      keyword,
      page: parseInt(page),
      pageSize: parseInt(pageSize),
    });

    res.json(result);
  } catch (error) {
    logger.error('Query audit logs error:', error);
    res.status(500).json({
      success: false,
      message: '查询审计日志失败',
      error: error.message,
    });
  }
});

/**
 * 获取审计统计
 * GET /api/audit-logs/statistics
 */
router.get('/statistics', authenticate, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const tenantId = getTenantId(req);

    const result = await auditLoggerService.getStatistics({
      tenantId,
      startDate,
      endDate,
    });

    res.json(result);
  } catch (error) {
    logger.error('Get audit statistics error:', error);
    res.status(500).json({
      success: false,
      message: '获取审计统计失败',
      error: error.message,
    });
  }
});

/**
 * 导出审计日志
 * GET /api/audit-logs/export
 */
router.get('/export', authenticate, async (req, res) => {
  try {
    const { startDate, endDate, format = 'csv' } = req.query;
    const tenantId = getTenantId(req);

    const result = await auditLoggerService.export({
      tenantId,
      startDate,
      endDate,
      format,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    if (format === 'csv') {
      // 生成CSV内容
      const csvContent = [
        result.headers.join(','),
        ...result.rows.map(row => row.map(cell => `"${cell}"`).join(',')),
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=audit-logs-${Date.now()}.csv`);
      res.send(`\uFEFF${  csvContent}`); // BOM for Excel
    } else {
      res.json(result);
    }
  } catch (error) {
    logger.error('Export audit logs error:', error);
    res.status(500).json({
      success: false,
      message: '导出审计日志失败',
      error: error.message,
    });
  }
});

/**
 * 清理过期日志（仅超级管理员）
 * POST /api/audit-logs/cleanup
 */
router.post('/cleanup', authenticate, async (req, res) => {
  try {
    // 检查权限
    if (req.user.role !== 'super_admin' && req.user.role !== 'system_admin') {
      return res.status(403).json({
        success: false,
        message: '权限不足',
      });
    }

    const { retentionDays = 365 } = req.body;

    const result = await auditLoggerService.cleanup(retentionDays);

    res.json(result);
  } catch (error) {
    logger.error('Cleanup audit logs error:', error);
    res.status(500).json({
      success: false,
      message: '清理审计日志失败',
      error: error.message,
    });
  }
});

/**
 * 获取操作类型列表
 * GET /api/audit-logs/operations
 */
router.get('/operations', authenticate, async (req, res) => {
  try {
    const operations = [
      { value: 'create', label: '创建', color: 'green' },
      { value: 'update', label: '更新', color: 'blue' },
      { value: 'delete', label: '删除', color: 'red' },
      { value: 'view', label: '查看', color: 'default' },
      { value: 'export', label: '导出', color: 'purple' },
      { value: 'import', label: '导入', color: 'orange' },
      { value: 'login', label: '登录', color: 'cyan' },
      { value: 'logout', label: '登出', color: 'default' },
      { value: 'approve', label: '审批', color: 'success' },
      { value: 'reject', label: '拒绝', color: 'error' },
      { value: 'transfer', label: '调拨', color: 'processing' },
      { value: 'assign', label: '分配', color: 'warning' },
    ];

    res.json({
      success: true,
      data: operations,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取操作类型失败',
      error: error.message,
    });
  }
});

/**
 * 获取资源类型列表
 * GET /api/audit-logs/resource-types
 */
router.get('/resource-types', authenticate, async (req, res) => {
  try {
    const resourceTypes = [
      { value: 'asset', label: '资产' },
      { value: 'user', label: '用户' },
      { value: 'department', label: '部门' },
      { value: 'maintenance', label: '维修' },
      { value: 'quality_control', label: '质控' },
      { value: 'inventory', label: '盘点' },
      { value: 'transfer', label: '调拨' },
      { value: 'tenant', label: '租户' },
      { value: 'role', label: '角色' },
      { value: 'permission', label: '权限' },
      { value: 'system_config', label: '系统配置' },
      { value: 'backup', label: '备份' },
      { value: 'audit_log', label: '审计日志' },
    ];

    res.json({
      success: true,
      data: resourceTypes,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取资源类型失败',
      error: error.message,
    });
  }
});

module.exports = router;
