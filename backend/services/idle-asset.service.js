const BaseService = require('../core/BaseService');
const { AppError } = require('../utils/error-handler');

class IdleAssetService extends BaseService {
  constructor(options = {}) {
    super({ name: 'IdleAssetService', ...options });
  }

  async listIdleAssets(tenantId, { page = 1, pageSize = 20, status } = {}, userContext = {}) {
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    let whereClause = 'WHERE ia.tenant_id = ?';
    const params = [tenantId];

    if (status) {
      whereClause += ' AND ia.status = ?';
      params.push(status);
    }

    if (userContext.role !== 'system_admin' && userContext.role !== 'super_admin') {
      if (userContext.managed_departments && userContext.managed_departments.length > 0) {
        const placeholders = userContext.managed_departments.map(() => '?').join(',');
        whereClause += ` AND (
          EXISTS (
            SELECT 1 FROM assets a
            WHERE a.id = ia.asset_id AND a.tenant_id = ia.tenant_id AND a.is_deleted = 0
            AND (a.department IN (
              SELECT department_name FROM departments WHERE tenant_id = ia.tenant_id AND department_code IN (${placeholders})
            ) OR a.department_new IN (${placeholders}))
          ) OR EXISTS (
            SELECT 1 FROM temp_assets t
            WHERE t.id = ia.asset_id AND t.tenant_id = ia.tenant_id
            AND t.department IN (
              SELECT department_name FROM departments WHERE tenant_id = ia.tenant_id AND department_code IN (${placeholders})
            )
          )
        )`;
        params.push(
          ...userContext.managed_departments,
          ...userContext.managed_departments,
          ...userContext.managed_departments,
        );
      } else {
        return {
          data: [],
          pagination: { page: parseInt(page), pageSize: parseInt(pageSize), total: 0, totalPages: 0 },
        };
      }
    }

    const countSql = `SELECT COUNT(*) as total FROM idle_assets ia ${whereClause}`;
    const countResult = await this.findOne(countSql, params);
    const {total} = countResult;

    const dataSql = `SELECT ia.* FROM idle_assets ia ${whereClause} ORDER BY ia.created_at DESC LIMIT ? OFFSET ?`;
    const records = await this.findMany(dataSql, [...params, parseInt(pageSize), offset]);

    return {
      data: records,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total,
        totalPages: Math.ceil(total / parseInt(pageSize)),
      },
    };
  }

  async getIdleAssetById(id, tenantId) {
    const record = await this.findOne(
      'SELECT * FROM idle_assets WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );
    if (!record) {
      throw new AppError('闲置资产记录不存在', 404, 'IDLE_ASSET_NOT_FOUND');
    }
    return record;
  }

  async createIdleAsset(tenantId, data) {
    const { asset_id, asset_name, department } = data;
    if (!asset_id || !asset_name) {
      throw new AppError('资产ID和资产名称不能为空', 400, 'MISSING_REQUIRED_FIELDS');
    }

    const [result] = await this.execute(
      `INSERT INTO idle_assets (asset_id, asset_name, asset_model, department, idle_reason, status, remark, tenant_id, created_at)
       VALUES (?, ?, ?, ?, ?, 'published', ?, ?, NOW())`,
      [
        asset_id,
        asset_name,
        data.asset_model ?? null,
        department ?? null,
        data.idle_reason ?? null,
        data.remark ?? null,
        tenantId,
      ],
    );

    this.emitEvent('idle:published', { id: result.insertId, tenantId });
    return { id: result.insertId, asset_name, status: 'published' };
  }

  async claimIdleAsset(id, tenantId, claimInfo) {
    const record = await this.getIdleAssetById(id, tenantId);
    if (record.status !== 'published') {
      throw new AppError('只能认领已发布的闲置资产', 400, 'INVALID_STATUS');
    }

    const [result] = await this.execute(
      'UPDATE idle_assets SET status = \'claimed\', claimed_by = ?, claimed_department = ?, claimed_at = NOW(), updated_at = NOW() WHERE id = ? AND tenant_id = ?',
      [claimInfo.claimed_by ?? null, claimInfo.claimed_department ?? null, id, tenantId],
    );

    if (result.affectedRows === 0) {
      throw new AppError('闲置资产认领失败', 500, 'UPDATE_FAILED');
    }

    this.emitEvent('idle:claimed', { id, tenantId });
    return { id, status: 'claimed' };
  }

  async deleteIdleAsset(id, tenantId) {
    const record = await this.getIdleAssetById(id, tenantId);
    if (record.status === 'claimed') {
      throw new AppError('不能删除已认领的闲置资产', 400, 'INVALID_STATUS');
    }

    const [result] = await this.execute(
      'DELETE FROM idle_assets WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );

    if (result.affectedRows === 0) {
      throw new AppError('闲置资产删除失败', 500, 'DELETE_FAILED');
    }

    this.emitEvent('idle:deleted', { id, tenantId });
    return { id };
  }
}

module.exports = IdleAssetService;
