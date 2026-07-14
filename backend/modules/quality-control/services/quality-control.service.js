const db = require('../../../config/database');
const { redis } = require('../../../services/redis');
const logger = require('../../../config/logger');
const GlobalQualityControlService = require('../../../services/quality-control-service');

const CACHE_TTL = 300; // 缓存过期时间（秒）

const buildTenantScopedClause = (tenantId, alias = '') => {
  if (!tenantId) {
    return { clause: '', params: [] };
  }

  const prefix = alias ? `${alias}.` : '';
  return {
    clause: ` AND ${prefix}tenant_id = ?`,
    params: [tenantId],
  };
};

class QualityControlService {
  /**
   * 获取质量控制记录列表
   * @param {Object} params - 查询参数
   * @param {number} params.page - 页码
   * @param {number} params.pageSize - 每页大小
   * @param {string} params.keyword - 关键词
   * @param {string} params.qc_type - 质控类型
   * @param {string} params.result - 质控结果
   * @param {string} params.status - 状态
   * @param {string} params.start_date - 开始日期
   * @param {string} params.end_date - 结束日期
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Object>} 质量控制记录列表和分页信息
   */
  async getQualityControlRecords(params, tenantId) {
    const { page = 1, pageSize = 10, keyword, qc_type, result, status, start_date, end_date } = params;

    // 生成缓存键
    const cacheKey = `qc:${tenantId}:${page}:${pageSize}:${keyword || ''}:${qc_type || ''}:${result || ''}:${status || ''}:${start_date || ''}:${end_date || ''}`;

    try {
      const cachedData = await redis.get(cacheKey);
      if (cachedData) {
        return JSON.parse(cachedData);
      }
    } catch (error) {
      logger.warn('Redis缓存读取失败', { error: error.message, tenantId, cacheKey });
    }

    const tenantFilter = buildTenantScopedClause(tenantId);

    const resultData = await QualityControlService.getQualityControlRecords(
      { page, pageSize, keyword, qc_type, result, status, start_date, end_date },
      tenantFilter,
    );

    try {
      await redis.set(cacheKey, JSON.stringify(resultData), 'EX', CACHE_TTL);
    } catch (error) {
      logger.warn('Redis缓存写入失败', { error: error.message, tenantId, cacheKey });
    }

    return resultData;
  }

  /**
   * 获取质量控制记录详情
   * @param {number} id - 记录ID
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Object>} 记录详情
   */
  async getQualityControlRecordById(id, tenantId) {
    const tenantFilter = buildTenantScopedClause(tenantId);
    return await GlobalQualityControlService.getQualityControlRecordById(id, tenantFilter);
  }

  /**
   * 创建质量控制记录
   * @param {Object} recordData - 记录数据
   * @param {string} tenantId - 租户ID
   * @param {string} createdBy - 创建人
   * @returns {Promise<Object>} 创建结果
   */
  async createQualityControlRecord(recordData, tenantId, createdBy) {
    return await GlobalQualityControlService.createQualityControlRecord(recordData, tenantId, createdBy);
  }

  /**
   * 更新质量控制记录
   * @param {number} id - 记录ID
   * @param {Object} updateData - 更新数据
   * @param {string} tenantId - 租户ID
   * @param {string} updatedBy - 更新人
   * @returns {Promise<Object>} 更新结果
   */
  async updateQualityControlRecord(id, updateData, tenantId, updatedBy) {
    const tenantFilter = buildTenantScopedClause(tenantId);
    return await GlobalQualityControlService.updateQualityControlRecord(id, updateData, tenantFilter, updatedBy);
  }

  /**
   * 删除质量控制记录
   * @param {number} id - 记录ID
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Object>} 删除结果
   */
  async deleteQualityControlRecord(id, tenantId) {
    const tenantFilter = buildTenantScopedClause(tenantId);
    return await GlobalQualityControlService.deleteQualityControlRecord(id, tenantFilter);
  }

  /**
   * 获取质量控制统计
   * @param {Object} params - 查询参数
   * @param {string} params.start_date - 开始日期
   * @param {string} params.end_date - 结束日期
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Object>} 统计数据
   */
  async getQualityControlStatistics(params, tenantId) {
    const { start_date, end_date } = params;
    const tenantFilter = buildTenantScopedClause(tenantId);
    return await GlobalQualityControlService.getQualityControlStatistics({ start_date, end_date }, tenantFilter);
  }

  /**
   * 获取高级质量控制统计
   * @param {Object} params - 查询参数
   * @param {string} params.start_date - 开始日期
   * @param {string} params.end_date - 结束日期
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Object>} 高级统计数据
   */
  async getAdvancedQualityControlStatistics(params, tenantId) {
    const { start_date, end_date } = params;
    const tenantFilter = buildTenantScopedClause(tenantId);
    return await GlobalQualityControlService.getAdvancedQualityControlStatistics({ start_date, end_date }, tenantFilter);
  }

  /**
   * 获取即将到期质控记录
   * @param {Object} params - 查询参数
   * @param {number} params.days - 天数
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Array>} 即将到期记录
   */
  async getExpiringQualityControlRecords(params, tenantId) {
    const { days = 30 } = params;
    const tenantFilter = buildTenantScopedClause(tenantId);
    return await GlobalQualityControlService.getExpiringQualityControlRecords({ days }, tenantFilter);
  }

  /**
   * 获取资产质量管理历史
   * @param {string} assetCode - 资产编号
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Array>} 质量管理历史
   */
  async getAssetQualityHistory(assetCode, tenantId) {
    const tenantFilter = buildTenantScopedClause(tenantId);
    return await GlobalQualityControlService.getAssetQualityHistory(assetCode, tenantFilter);
  }
}

module.exports = new QualityControlService();
