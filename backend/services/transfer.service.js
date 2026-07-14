const BaseService = require('../core/BaseService');
const { AppError } = require('../utils/error-handler');

// 复用统一的调配核心，保证 Service 层与路由层行为一致
const {
  createTransferRequest,
  approveTransferRequest,
} = require('./transfer-approval-service');

class TransferService extends BaseService {
  constructor(options = {}) {
    super({ name: 'TransferService', ...options });
  }

  async listTransfers(tenantId, { page = 1, pageSize = 20, status, applicant } = {}, userContext = {}) {
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    let whereClause = 'WHERE t.tenant_id = ?';
    const params = [tenantId];

    if (status) {
      const statusMap = { '待审批': 'pending', '已批准': 'approved', '已完成': 'completed', '已取消': 'rejected' };
      const dbStatus = statusMap[status] || status;
      whereClause += ' AND t.status = ?';
      params.push(dbStatus);
    }

    if (applicant) {
      whereClause += ' AND t.applicant = ?';
      params.push(applicant);
    }

    if (userContext.role !== 'super_admin' && userContext.role !== 'system_admin') {
      if (userContext.managed_departments && userContext.managed_departments.length > 0) {
        const managedDeptNames = await this._fetchManagedDepartmentNames(
          userContext.managed_departments,
          tenantId,
        );
        if (managedDeptNames.length > 0) {
          const deptPlaceholders = managedDeptNames.map(() => '?').join(',');
          whereClause += ` AND (t.applicant = ? OR t.current_department IN (${deptPlaceholders}) OR t.target_department IN (${deptPlaceholders}))`;
          params.push(userContext.real_name || userContext.username, ...managedDeptNames, ...managedDeptNames);
        } else {
          whereClause += ' AND t.applicant = ?';
          params.push(userContext.real_name || userContext.username);
        }
      } else {
        whereClause += ' AND t.applicant = ?';
        params.push(userContext.real_name || userContext.username);
      }
    }

    const countSql = `SELECT COUNT(*) as total FROM asset_transfer_requests t ${whereClause}`;
    const countResult = await this.findOne(countSql, params);
    const { total } = countResult;

    const dataSql = `SELECT t.* FROM asset_transfer_requests t ${whereClause} ORDER BY t.created_at DESC LIMIT ? OFFSET ?`;
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

  async getTransferById(id, tenantId) {
    const record = await this.findOne(
      'SELECT * FROM asset_transfer_requests WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );
    if (!record) {
      throw new AppError('调配记录不存在', 404, 'TRANSFER_NOT_FOUND');
    }
    return record;
  }

  /**
   * 创建调配申请
   * 注意：此处不再直接写库，而是委托给统一核心，
   * 由核心负责“资产存在性 / 在用状态 / 去重 / 置为调配中”的完整校验。
   */
  async createTransfer(tenantId, data, operator = {}) {
    const { asset_code, asset_name, current_department, target_department, applicant } = data;
    if (!asset_code || !target_department || !applicant) {
      throw new AppError('资产编码、目标科室和申请人不能为空', 400, 'MISSING_REQUIRED_FIELDS');
    }

    const approverName = operator.real_name || operator.username || applicant;
    let result;
    await this.transaction(async (connection) => {
      const r = await createTransferRequest(connection, {
        tenantId,
        assetCode: asset_code,
        assetId: null,
        assetName: asset_name,
        currentDepartment: current_department,
        targetDepartment,
        reason: data.transfer_reason || data.reason || null,
        applicant,
      });
      if (!r.success) {
        throw new AppError(r.message, r.code || 400, 'TRANSFER_CREATE_FAILED');
      }
      result = r;
    });

    this.emitEvent('transfer:created', { id: result.id, asset_code, tenantId });
    return { id: result.id, asset_code, asset_name: result.asset_name, status: result.status };
  }

  /**
   * 审批调配申请（批准即实际调拨）
   */
  async approveTransfer(id, tenantId, approver, opinion) {
    const record = await this.getTransferById(id, tenantId);
    if (record.status !== 'pending') {
      throw new AppError('只能审批待审批状态的调配申请', 400, 'INVALID_STATUS');
    }

    let result;
    await this.transaction(async (connection) => {
      const r = await approveTransferRequest(connection, {
        id,
        approved: true,
        approver,
        tenantId,
        comment: opinion,
      });
      if (!r.success) {
        throw new AppError(r.message, r.code || 400, 'TRANSFER_APPROVE_FAILED');
      }
      result = r;
    });

    this.emitEvent('transfer:approved', { id, tenantId, approver });
    return { id, status: 'approved' };
  }

  /**
   * 完成调配（幂等：已批准即已完成调拨；待审批则执行审批调拨）
   * 注：资产状态机不存在独立的 "completed" 状态，审批通过即代表调拨完成。
   */
  async completeTransfer(id, tenantId) {
    const record = await this.getTransferById(id, tenantId);
    if (record.status === 'approved') {
      return { id, status: 'approved' };
    }
    if (record.status !== 'pending') {
      throw new AppError('只能完成待审批或已审批的调配申请', 400, 'INVALID_STATUS');
    }

    await this.transaction(async (connection) => {
      const r = await approveTransferRequest(connection, {
        id,
        approved: true,
        approver: record.applicant,
        tenantId,
        comment: '完成调配',
      });
      if (!r.success) {
        throw new AppError(r.message, r.code || 400, 'TRANSFER_COMPLETE_FAILED');
      }
    });

    this.emitEvent('transfer:completed', { id, asset_code: record.asset_code, tenantId });
    return { id, status: 'approved' };
  }

  /**
   * 驳回调配申请
   */
  async rejectTransfer(id, tenantId, approver, opinion) {
    const record = await this.getTransferById(id, tenantId);
    if (record.status !== 'pending') {
      throw new AppError('只能驳回待审批状态的调配申请', 400, 'INVALID_STATUS');
    }

    await this.transaction(async (connection) => {
      const r = await approveTransferRequest(connection, {
        id,
        approved: false,
        approver,
        tenantId,
        comment: opinion,
      });
      if (!r.success) {
        throw new AppError(r.message, r.code || 400, 'TRANSFER_REJECT_FAILED');
      }
    });

    this.emitEvent('transfer:rejected', { id, tenantId, approver });
    return { id, status: 'rejected' };
  }

  async _fetchManagedDepartmentNames(departmentCodes, tenantId) {
    if (!Array.isArray(departmentCodes) || departmentCodes.length === 0) {
      return [];
    }
    const placeholders = departmentCodes.map(() => '?').join(',');
    const rows = await this.findMany(
      `SELECT department_name FROM departments WHERE tenant_id = ? AND department_code IN (${placeholders})`,
      [tenantId, ...departmentCodes],
    );
    return rows.map(row => row.department_name);
  }
}

module.exports = TransferService;
