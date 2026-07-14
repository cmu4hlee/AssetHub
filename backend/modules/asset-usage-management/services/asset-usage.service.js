/**
 * 资产使用管理服务
 */
const db = require('../../../config/database');
const logger = require('../../../config/logger');
const { publishAsync } = require('../../../core/EventBus');

class AssetUsageService {
  /**
   * 获取资产使用记录列表
   * @param {Object} params - 查询参数
   * @returns {Promise<Object>} 使用记录列表和分页信息
   */
  async getUsageRecords(params) {
    const { page = 1, pageSize = 20, keyword, assetCode, tenantId } = params;
    const offset = (page - 1) * pageSize;

    let whereClause = 'WHERE aur.tenant_id = ?';
    const queryParams = [tenantId];

    if (keyword) {
      whereClause += ' AND (a.asset_name LIKE ? OR a.asset_code LIKE ? OR aur.user_name LIKE ?)';
      queryParams.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    if (assetCode) {
      whereClause += ' AND aur.asset_code = ?';
      queryParams.push(assetCode);
    }

    const [countRows] = await db.execute(
      `SELECT COUNT(*) as total FROM asset_usage_records aur
       LEFT JOIN assets a ON aur.asset_code = a.asset_code AND a.tenant_id = aur.tenant_id
       ${whereClause}`,
      queryParams,
    );
    const { total } = countRows[0];

    const [rows] = await db.execute(
      `SELECT aur.*, a.asset_name
       FROM asset_usage_records aur
       LEFT JOIN assets a ON aur.asset_code = a.asset_code AND a.tenant_id = aur.tenant_id
       ${whereClause}
       ORDER BY aur.created_at DESC
       LIMIT ? OFFSET ?`,
      [...queryParams, parseInt(pageSize), offset],
    );

    return {
      data: rows,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * 获取使用记录详情
   * @param {number} id - 记录ID
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Object>} 使用记录详情
   */
  async getUsageRecordById(id, tenantId) {
    const [rows] = await db.execute(
      `SELECT aur.*, a.asset_name
       FROM asset_usage_records aur
       LEFT JOIN assets a ON aur.asset_code = a.asset_code AND a.tenant_id = aur.tenant_id
       WHERE aur.id = ? AND aur.tenant_id = ?`,
      [id, tenantId],
    );
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * 借出资产
   * @param {Object} usageData - 使用数据
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Object>} 创建结果
   */
  async checkoutAsset(usageData, tenantId) {
    const { asset_code, user_id, user_name, department, expected_return_date, purpose } = usageData;

    if (!asset_code) {
      throw new Error('资产编码不能为空');
    }

    // 检查资产是否已被借出
    const [existing] = await db.execute(
      `SELECT id FROM asset_usage_records
       WHERE asset_code = ? AND tenant_id = ? AND status = 'in_use'
       AND (return_date IS NULL OR return_date = '')`,
      [asset_code, tenantId],
    );

    if (existing.length > 0) {
      throw new Error('该资产已被借出');
    }

    const [result] = await db.execute(
      `INSERT INTO asset_usage_records
       (tenant_id, asset_code, user_id, user_name, department, checkout_date, expected_return_date, purpose, status)
       VALUES (?, ?, ?, ?, ?, NOW(), ?, ?, 'in_use')`,
      [
        tenantId,
        asset_code,
        user_id || null,
        user_name || null,
        department || null,
        expected_return_date || null,
        purpose || null,
      ],
    );

    // 发出资产领用事件（飞书通知订阅）
    publishAsync('asset_usage:checkout', {
      id: result.insertId,
      asset_code,
      user_id,
      user_name,
      department,
      expected_return_date,
      purpose,
      tenantId,
    }).catch(e => logger.warn('发布 asset_usage:checkout 事件失败:', e.message));

    return { id: result.insertId };
  }

  /**
   * 归还资产
   * @param {number} id - 记录ID
   * @param {Object} returnData - 归还数据
   * @param {string} tenantId - 租户ID
   * @returns {Promise<boolean>} 归还结果
   */
  async returnAsset(id, returnData, tenantId) {
    const { actual_condition, remarks } = returnData;

    const [result] = await db.execute(
      `UPDATE asset_usage_records
       SET status = 'returned', actual_condition = ?, remarks = ?, return_date = NOW(), updated_at = NOW()
       WHERE id = ? AND tenant_id = ?`,
      [actual_condition || null, remarks || null, id, tenantId],
    );

    if (result.affectedRows > 0) {
      // 查一下记录用于通知
      let record = null;
      try {
        const [rows] = await db.execute(
          'SELECT asset_code, user_id, user_name FROM asset_usage_records WHERE id = ? AND tenant_id = ?',
          [id, tenantId],
        );
        record = rows?.[0];
      } catch (_) {}

      // 发出资产归还事件（飞书通知订阅）
      publishAsync('asset_usage:return', {
        id,
        asset_code: record?.asset_code,
        user_id: record?.user_id,
        user_name: record?.user_name,
        actual_condition,
        tenantId,
      }).catch(e => logger.warn('发布 asset_usage:return 事件失败:', e.message));
    }

    return result.affectedRows > 0;
  }

  /**
   * 获取资产的当前使用状态
   * @param {string} assetCode - 资产编码
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Object>} 当前使用状态
   */
  async getAssetUsageStatus(assetCode, tenantId) {
    const [rows] = await db.execute(
      `SELECT aur.*, u.user_name as current_user
       FROM asset_usage_records aur
       LEFT JOIN users u ON aur.user_id = u.id
       WHERE aur.asset_code = ? AND aur.tenant_id = ? AND aur.status = 'in_use'
       ORDER BY aur.checkout_date DESC
       LIMIT 1`,
      [assetCode, tenantId],
    );

    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * 获取使用统计
   * @param {Object} params - 统计参数
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Object>} 统计数据
   */
  async getUsageStatistics(params, tenantId) {
    const { startDate, endDate } = params;

    let whereClause = 'WHERE tenant_id = ?';
    const queryParams = [tenantId];

    if (startDate) {
      whereClause += ' AND checkout_date >= ?';
      queryParams.push(startDate);
    }

    if (endDate) {
      whereClause += ' AND checkout_date <= ?';
      queryParams.push(endDate);
    }

    const [rows] = await db.execute(
      `SELECT
        COUNT(*) as total_checkouts,
        SUM(CASE WHEN status = 'in_use' THEN 1 ELSE 0 END) as currently_in_use,
        SUM(CASE WHEN status = 'returned' THEN 1 ELSE 0 END) as returned,
        COUNT(DISTINCT asset_code) as unique_assets
       FROM asset_usage_records ${whereClause}`,
      queryParams,
    );

    return rows[0];
  }

  /**
   * 获取用户的使用记录
   * @param {string} userId - 用户ID
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Array>} 使用记录列表
   */
  async getUserUsageRecords(userId, tenantId) {
    const [rows] = await db.execute(
      `SELECT aur.*, a.asset_name
       FROM asset_usage_records aur
       LEFT JOIN assets a ON aur.asset_code = a.asset_code AND a.tenant_id = aur.tenant_id
       WHERE aur.user_id = ? AND aur.tenant_id = ?
       ORDER BY aur.checkout_date DESC`,
      [userId, tenantId],
    );
    return rows;
  }
}

module.exports = new AssetUsageService();
