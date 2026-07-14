const BaseService = require('../core/BaseService');
const { AppError } = require('../utils/error-handler');

class ScrappingService extends BaseService {
  constructor(options = {}) {
    super({ name: 'ScrappingService', ...options });
  }

  async listScrappingRecords(tenantId, { page = 1, pageSize = 20, status, keyword } = {}) {
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    let whereClause = 'WHERE tenant_id = ?';
    const params = [tenantId];

    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    if (keyword) {
      whereClause += ' AND (asset_code LIKE ? OR asset_name LIKE ? OR applicant LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    const countSql = `SELECT COUNT(*) as total FROM asset_scrapping ${whereClause}`;
    const countResult = await this.findOne(countSql, params);
    const {total} = countResult;

    const dataSql = `SELECT * FROM asset_scrapping ${whereClause} ORDER BY apply_date DESC LIMIT ? OFFSET ?`;
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

  async getScrappingById(id, tenantId) {
    const record = await this.findOne(
      'SELECT * FROM asset_scrapping WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );
    if (!record) {
      throw new AppError('报废记录不存在', 404, 'SCRAPPING_NOT_FOUND');
    }
    return record;
  }

  async createScrappingRequest(tenantId, data) {
    const { asset_code, asset_name, applicant, scrapping_reason } = data;
    if (!asset_code || !asset_name || !applicant || !scrapping_reason) {
      throw new AppError('资产编码、资产名称、申请人和报废原因不能为空', 400, 'MISSING_REQUIRED_FIELDS');
    }

    const applyDate = new Date();
    const [result] = await this.execute(
      `INSERT INTO asset_scrapping (
        asset_code, asset_name, asset_model, department, applicant, applicant_id,
        apply_date, scrapping_reason, estimated_value, status, remark, tenant_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
      [
        asset_code,
        asset_name,
        data.asset_model ?? null,
        data.department ?? null,
        applicant,
        data.applicant_id ?? null,
        applyDate,
        scrapping_reason,
        data.estimated_value ?? null,
        data.remark ?? null,
        tenantId,
        applyDate,
      ],
    );

    this.emitEvent('scrapping:created', {
      id: result.insertId,
      asset_code,
      tenantId,
    });

    return { id: result.insertId, asset_code, asset_name, status: 'pending' };
  }

  async approveScrapping(id, tenantId, approver, opinion) {
    const record = await this.getScrappingById(id, tenantId);
    if (record.status !== 'pending') {
      throw new AppError('只能审批待审批状态的报废申请', 400, 'INVALID_STATUS');
    }

    const [result] = await this.execute(
      'UPDATE asset_scrapping SET status = \'approved\', approver = ?, approval_date = NOW(), approval_opinion = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?',
      [approver, opinion ?? null, id, tenantId],
    );

    if (result.affectedRows === 0) {
      throw new AppError('报废记录更新失败', 500, 'UPDATE_FAILED');
    }

    this.emitEvent('scrapping:approved', { id, tenantId, approver });
    return { id, status: 'approved' };
  }

  async rejectScrapping(id, tenantId, approver, opinion) {
    const record = await this.getScrappingById(id, tenantId);
    if (record.status !== 'pending') {
      throw new AppError('只能驳回待审批状态的报废申请', 400, 'INVALID_STATUS');
    }

    const [result] = await this.execute(
      'UPDATE asset_scrapping SET status = \'rejected\', approver = ?, approval_date = NOW(), approval_opinion = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?',
      [approver, opinion ?? null, id, tenantId],
    );

    if (result.affectedRows === 0) {
      throw new AppError('报废记录更新失败', 500, 'UPDATE_FAILED');
    }

    this.emitEvent('scrapping:rejected', { id, tenantId, approver });
    return { id, status: 'rejected' };
  }

  async completeScrapping(id, tenantId) {
    const record = await this.getScrappingById(id, tenantId);
    if (record.status !== 'approved') {
      throw new AppError('只能完成已审批的报废申请', 400, 'INVALID_STATUS');
    }

    await this.transaction(async (connection) => {
      await connection.execute(
        'UPDATE asset_scrapping SET status = \'completed\', completed_date = NOW(), updated_at = NOW() WHERE id = ? AND tenant_id = ?',
        [id, tenantId],
      );

      await connection.execute(
        'UPDATE assets SET status = \'scrapped\', updated_at = NOW() WHERE asset_code = ? AND tenant_id = ?',
        [record.asset_code, tenantId],
      );
    });

    this.emitEvent('scrapping:completed', { id, asset_code: record.asset_code, tenantId });
    return { id, status: 'completed' };
  }

  async deleteScrapping(id, tenantId) {
    const record = await this.getScrappingById(id, tenantId);
    if (record.status !== 'pending') {
      throw new AppError('只能删除待审批状态的报废申请', 400, 'INVALID_STATUS');
    }

    const [result] = await this.execute(
      'DELETE FROM asset_scrapping WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );

    if (result.affectedRows === 0) {
      throw new AppError('报废记录删除失败', 500, 'DELETE_FAILED');
    }

    this.emitEvent('scrapping:deleted', { id, tenantId });
    return { id };
  }

  async getScrappingStats(tenantId) {
    const stats = await this.findOne(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_count,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_count,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_count
      FROM asset_scrapping WHERE tenant_id = ?`,
      [tenantId],
    );
    return stats;
  }
}

module.exports = ScrappingService;
