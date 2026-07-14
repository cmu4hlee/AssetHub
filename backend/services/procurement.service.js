const BaseService = require('../core/BaseService');
const { AppError } = require('../utils/error-handler');

class ProcurementService extends BaseService {
  constructor(options = {}) {
    super({ name: 'ProcurementService', ...options });
  }

  async listProcurements(tenantId, { page = 1, pageSize = 20, status, keyword, department, start_date, end_date } = {}) {
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    let whereClause = 'WHERE tenant_id = ?';
    const params = [tenantId];

    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    if (keyword) {
      whereClause += ' AND (title LIKE ? OR asset_name LIKE ? OR requester LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    if (department) {
      whereClause += ' AND department = ?';
      params.push(department);
    }

    if (start_date) {
      whereClause += ' AND created_at >= ?';
      params.push(start_date);
    }

    if (end_date) {
      whereClause += ' AND created_at <= ?';
      params.push(end_date);
    }

    const countSql = `SELECT COUNT(*) as total FROM procurement_requests ${whereClause}`;
    const countResult = await this.findOne(countSql, params);
    const {total} = countResult;

    const dataSql = `SELECT * FROM procurement_requests ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
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

  async getProcurementById(id, tenantId) {
    const record = await this.findOne(
      'SELECT * FROM procurement_requests WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );
    if (!record) {
      throw new AppError('采购申请不存在', 404, 'PROCUREMENT_NOT_FOUND');
    }
    return record;
  }

  async createProcurement(tenantId, data) {
    const { title } = data;
    if (!title) {
      throw new AppError('采购标题不能为空', 400, 'MISSING_TITLE');
    }

    const [result] = await this.execute(
      `INSERT INTO procurement_requests (
        title, asset_name, department, request_type, quantity, estimated_budget,
        specification, reason, expected_date, requester, requester_id, status, remark, tenant_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
      [
        title,
        data.asset_name ?? null,
        data.department ?? null,
        data.request_type ?? null,
        data.quantity ?? null,
        data.estimated_budget ?? null,
        data.specification ?? null,
        data.reason ?? null,
        data.expected_date ?? null,
        data.requester ?? null,
        data.requester_id ?? null,
        data.remark ?? null,
        tenantId,
      ],
    );

    this.emitEvent('procurement:created', { id: result.insertId, tenantId });
    return { id: result.insertId, title, status: 'draft' };
  }

  async updateProcurement(id, tenantId, data) {
    const record = await this.getProcurementById(id, tenantId);
    if (record.status !== 'draft') {
      throw new AppError('只能修改草稿状态的采购申请', 400, 'INVALID_STATUS');
    }

    const fields = [];
    const values = [];
    const allowedFields = ['title', 'asset_name', 'department', 'request_type', 'quantity', 'estimated_budget', 'specification', 'reason', 'expected_date', 'remark'];

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(data[field]);
      }
    }

    if (fields.length === 0) {
      throw new AppError('没有需要更新的字段', 400, 'NO_FIELDS_TO_UPDATE');
    }

    values.push(id, tenantId);
    const [result] = await this.execute(
      `UPDATE procurement_requests SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
      values,
    );

    if (result.affectedRows === 0) {
      throw new AppError('采购申请更新失败', 500, 'UPDATE_FAILED');
    }

    this.emitEvent('procurement:updated', { id, tenantId });
    return { id };
  }

  async submitProcurement(id, tenantId) {
    const record = await this.getProcurementById(id, tenantId);
    if (record.status !== 'draft') {
      throw new AppError('只能提交草稿状态的采购申请', 400, 'INVALID_STATUS');
    }

    const [result] = await this.execute(
      'UPDATE procurement_requests SET status = \'pending\', submitted_at = NOW(), updated_at = NOW() WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );

    if (result.affectedRows === 0) {
      throw new AppError('采购申请提交失败', 500, 'UPDATE_FAILED');
    }

    this.emitEvent('procurement:submitted', { id, tenantId });
    return { id, status: 'pending' };
  }

  async approveProcurement(id, tenantId, approver, opinion) {
    const record = await this.getProcurementById(id, tenantId);
    if (record.status !== 'pending') {
      throw new AppError('只能审批待审批状态的采购申请', 400, 'INVALID_STATUS');
    }

    const [result] = await this.execute(
      'UPDATE procurement_requests SET status = \'approved\', approver = ?, approval_date = NOW(), approval_opinion = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?',
      [approver, opinion ?? null, id, tenantId],
    );

    if (result.affectedRows === 0) {
      throw new AppError('采购申请审批失败', 500, 'UPDATE_FAILED');
    }

    this.emitEvent('procurement:approved', { id, tenantId, approver });
    return { id, status: 'approved' };
  }

  async rejectProcurement(id, tenantId, approver, opinion) {
    const record = await this.getProcurementById(id, tenantId);
    if (record.status !== 'pending') {
      throw new AppError('只能驳回待审批状态的采购申请', 400, 'INVALID_STATUS');
    }

    const [result] = await this.execute(
      'UPDATE procurement_requests SET status = \'rejected\', approver = ?, approval_date = NOW(), approval_opinion = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?',
      [approver, opinion ?? null, id, tenantId],
    );

    if (result.affectedRows === 0) {
      throw new AppError('采购申请驳回失败', 500, 'UPDATE_FAILED');
    }

    this.emitEvent('procurement:rejected', { id, tenantId, approver });
    return { id, status: 'rejected' };
  }

  async deleteProcurement(id, tenantId) {
    const record = await this.getProcurementById(id, tenantId);
    if (record.status !== 'draft') {
      throw new AppError('只能删除草稿状态的采购申请', 400, 'INVALID_STATUS');
    }

    const [result] = await this.execute(
      'DELETE FROM procurement_requests WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );

    if (result.affectedRows === 0) {
      throw new AppError('采购申请删除失败', 500, 'DELETE_FAILED');
    }

    this.emitEvent('procurement:deleted', { id, tenantId });
    return { id };
  }
}

module.exports = ProcurementService;
