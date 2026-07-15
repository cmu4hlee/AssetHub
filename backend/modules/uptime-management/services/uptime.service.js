const db = require('../../../config/database');
const logger = require('../../../config/logger');

const CACHE_TTL = 300; // 缓存过期时间（秒）

// 列是否存在缓存
const columnExistsCache = new Map();
// 表是否存在缓存
const tableExistsCache = new Map();

// ========== 辅助函数 ==========

const tableExists = async tableName => {
  if (tableExistsCache.has(tableName)) {
    return tableExistsCache.get(tableName);
  }

  const [rows] = await db.execute(
    `SELECT 1
     FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ?
     LIMIT 1`,
    [tableName],
  );
  const exists = rows.length > 0;
  tableExistsCache.set(tableName, exists);
  return exists;
};

const columnExists = async (tableName, columnName) => {
  const cacheKey = `${tableName}.${columnName}`;
  if (columnExistsCache.has(cacheKey)) {
    return columnExistsCache.get(cacheKey);
  }

  const [rows] = await db.execute(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?
     LIMIT 1`,
    [tableName, columnName],
  );
  const exists = rows.length > 0;
  columnExistsCache.set(cacheKey, exists);
  return exists;
};

const resolveAssetDepartmentColumn = async () => {
  const candidates = ['department_id', 'department', 'department_new', 'use_department'];
  for (const column of candidates) {
    // eslint-disable-next-line no-await-in-loop
    if (await columnExists('assets', column)) {
      return column;
    }
  }
  return null;
};

const resolveOperationLogTable = async () => {
  if (await tableExists('asset_operation_logs')) {
    return 'asset_operation_logs';
  }
  if (await tableExists('operation_logs')) {
    return 'operation_logs';
  }
  return null;
};

const toPeriod = statisticsDate => {
  if (!statisticsDate) {
    return null;
  }
  return String(statisticsDate).slice(0, 7);
};

const fromPeriodToDate = period => {
  if (!period) {
    return new Date().toISOString().slice(0, 10);
  }
  if (/^\d{4}-\d{2}$/.test(period)) {
    return `${period}-01`;
  }
  return period;
};

const deriveStatus = uptimeRate => {
  const rate = Number(uptimeRate || 0);
  if (rate >= 99) {
    return 'normal';
  }
  if (rate >= 90) {
    return 'warning';
  }
  return 'danger';
};

const parseHours = value => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

// ========== SQL JOIN 语句 ==========

const UPTIME_STATISTICS_ASSET_JOIN =
  'LEFT JOIN assets a ON a.id = us.asset_id AND a.tenant_id = us.tenant_id AND a.is_deleted = 0';
const ASSET_OPERATION_LOG_ASSET_JOIN =
  'LEFT JOIN assets a ON a.id = aol.asset_id AND a.tenant_id = aol.tenant_id AND a.is_deleted = 0';
const OPERATION_LOG_ASSET_JOIN =
  'LEFT JOIN assets a ON a.id = ol.asset_id AND a.tenant_id = ol.tenant_id AND a.is_deleted = 0';

// ========== 计算相关 ==========

const resolveCalculationPeriod = input => {
  const now = new Date();
  const year = Number.parseInt(input.year, 10) || now.getFullYear();
  const month = Number.parseInt(input.month, 10) || now.getMonth() + 1;
  return {
    year,
    month,
    period: `${year}-${String(month).padStart(2, '0')}`,
    statisticsDate: `${year}-${String(month).padStart(2, '0')}-01`,
  };
};

const upsertMonthlyStatistic = async (executor, tenantId, statisticsDate, row) => {
  const plannedHours = parseHours(row.planned_hours);
  const actualHours = parseHours(row.actual_hours);
  const downtimeHours = parseHours(row.downtime_hours);
  const uptimeRate =
    plannedHours > 0 ? Number(((actualHours / plannedHours) * 100).toFixed(2)) : 0;

  const [existingRows] = await executor.execute(
    `SELECT id
     FROM uptime_statistics
     WHERE tenant_id = ? AND asset_id = ? AND DATE_FORMAT(statistics_date, '%Y-%m') = ?
     LIMIT 1`,
    [tenantId, row.asset_id, statisticsDate.slice(0, 7)],
  );

  if (existingRows.length > 0) {
    await executor.execute(
      `UPDATE uptime_statistics
       SET planned_hours = ?, actual_hours = ?, downtime_hours = ?, uptime_rate = ?,
           downtime_reason = ?, device_type = ?, updated_at = NOW()
       WHERE id = ? AND tenant_id = ?`,
      [
        plannedHours,
        actualHours,
        downtimeHours,
        uptimeRate,
        row.downtime_reasons || null,
        row.device_type || 'regular_equipment',
        existingRows[0].id,
        tenantId,
      ],
    );

    return {
      id: existingRows[0].id,
      asset_id: row.asset_id,
      asset_code: row.asset_code || null,
      asset_name: row.asset_name || null,
      planned_hours: plannedHours,
      actual_hours: actualHours,
      downtime_hours: downtimeHours,
      uptime_rate: uptimeRate,
      action: 'updated',
    };
  }

  const [insertResult] = await executor.execute(
    `INSERT INTO uptime_statistics (
       tenant_id, asset_id, device_type, statistics_date,
       planned_hours, actual_hours, downtime_hours, uptime_rate, downtime_reason, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      tenantId,
      row.asset_id,
      row.device_type || 'regular_equipment',
      statisticsDate,
      plannedHours,
      actualHours,
      downtimeHours,
      uptimeRate,
      row.downtime_reasons || null,
    ],
  );

  return {
    id: insertResult.insertId,
    asset_id: row.asset_id,
    asset_code: row.asset_code || null,
    asset_name: row.asset_name || null,
    planned_hours: plannedHours,
    actual_hours: actualHours,
    downtime_hours: downtimeHours,
    uptime_rate: uptimeRate,
    action: 'created',
  };
};

// ========== 服务类 ==========

class UptimeService {
  /**
   * 获取开机率统计列表
   * @param {Object} params - 查询参数
   * @param {string} params.tenantId - 租户ID
   * @param {number} params.page - 页码
   * @param {number} params.pageSize - 每页大小
   * @param {string} params.period - 统计周期 (YYYY-MM)
   * @returns {Promise<Object>} 统计数据列表和分页信息
   */
  async getUptimeStatisticsList(params) {
    const { tenantId, page = 1, pageSize = 20, period } = params;
    const departmentColumn = await resolveAssetDepartmentColumn();
    const departmentSelect = departmentColumn
      ? `CAST(a.${departmentColumn} AS CHAR) AS department`
      : 'NULL AS department';

    let sql = `
      SELECT
        us.*,
        a.asset_code,
        a.asset_name,
        ${departmentSelect}
      FROM uptime_statistics us
      ${UPTIME_STATISTICS_ASSET_JOIN}
      WHERE us.tenant_id = ?
    `;
    const queryParams = [tenantId];

    if (period) {
      sql += ' AND DATE_FORMAT(us.statistics_date, "%Y-%m") = ?';
      queryParams.push(period);
    }

    sql += ' ORDER BY us.statistics_date DESC, us.id DESC LIMIT ? OFFSET ?';
    queryParams.push(
      parseInt(pageSize, 10),
      (parseInt(page, 10) - 1) * parseInt(pageSize, 10),
    );

    const [rows] = await db.execute(sql, queryParams);

    let countSql = 'SELECT COUNT(*) AS total FROM uptime_statistics WHERE tenant_id = ?';
    const countParams = [tenantId];
    if (period) {
      countSql += ' AND DATE_FORMAT(statistics_date, "%Y-%m") = ?';
      countParams.push(period);
    }
    const [countRows] = await db.execute(countSql, countParams);

    const [summaryRows] = await db.execute(
      `SELECT
         AVG(uptime_rate) AS avg_rate,
         SUM(planned_hours) AS total_hours,
         SUM(actual_hours) AS running_hours
       FROM uptime_statistics
       WHERE tenant_id = ?`,
      [tenantId],
    );

    return {
      data: rows.map(item => ({
        ...item,
        period: toPeriod(item.statistics_date),
        total_hours: item.planned_hours,
        running_hours: item.actual_hours,
        downtime_reasons: item.downtime_reason,
        status: item.status || deriveStatus(item.uptime_rate),
      })),
      summary: summaryRows[0] || { avg_rate: 0, total_hours: 0, running_hours: 0 },
      pagination: {
        page: parseInt(page, 10),
        pageSize: parseInt(pageSize, 10),
        total: countRows[0]?.total || 0,
      },
    };
  }

  /**
   * 创建开机率统计
   * @param {Object} data - 统计数据
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Object>} 创建结果
   */
  async createUptimeStatistic(data, tenantId) {
    const {
      asset_id,
      period,
      total_hours,
      running_hours,
      uptime_rate,
      downtime_reasons,
      device_type,
    } = data;

    const plannedHours = parseHours(total_hours);
    const actualHours = parseHours(running_hours);
    const calculatedRate =
      plannedHours > 0
        ? Number(((actualHours / plannedHours) * 100).toFixed(2))
        : Number(uptime_rate || 0);
    const downtimeHours = Math.max(plannedHours - actualHours, 0);

    const [result] = await db.execute(
      `INSERT INTO uptime_statistics (
         tenant_id, asset_id, device_type, statistics_date,
         planned_hours, actual_hours, downtime_hours, uptime_rate, downtime_reason, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        tenantId,
        asset_id,
        device_type || 'regular_equipment',
        fromPeriodToDate(period),
        plannedHours,
        actualHours,
        downtimeHours,
        calculatedRate,
        downtime_reasons || null,
      ],
    );

    return { id: result.insertId };
  }

  /**
   * 更新开机率统计
   * @param {number} id - 记录ID
   * @param {Object} data - 更新数据
   * @param {string} tenantId - 租户ID
   * @returns {Promise<boolean>} 更新结果
   */
  async updateUptimeStatistic(id, data, tenantId) {
    const {
      asset_id,
      period,
      total_hours,
      running_hours,
      uptime_rate,
      downtime_reasons,
      device_type,
    } = data;

    const updates = [];
    const values = [];

    if (asset_id !== undefined) {
      updates.push('asset_id = ?');
      values.push(asset_id);
    }

    if (device_type !== undefined) {
      updates.push('device_type = ?');
      values.push(device_type || 'regular_equipment');
    }

    if (period !== undefined) {
      updates.push('statistics_date = ?');
      values.push(fromPeriodToDate(period));
    }

    if (
      total_hours !== undefined ||
      running_hours !== undefined ||
      uptime_rate !== undefined
    ) {
      const [existingRows] = await db.execute(
        `SELECT planned_hours, actual_hours, uptime_rate
         FROM uptime_statistics
         WHERE id = ? AND tenant_id = ?
         LIMIT 1`,
        [id, tenantId],
      );
      if (!existingRows.length) {
        return { success: false, message: '记录不存在' };
      }

      const existing = existingRows[0];
      const plannedHours =
        total_hours !== undefined ? parseHours(total_hours) : parseHours(existing.planned_hours);
      const actualHours =
        running_hours !== undefined ? parseHours(running_hours) : parseHours(existing.actual_hours);
      const calculatedRate =
        total_hours !== undefined || running_hours !== undefined
          ? (plannedHours > 0
              ? Number(((actualHours / plannedHours) * 100).toFixed(2))
              : Number(uptime_rate || 0))
          : Number(uptime_rate || existing.uptime_rate || 0);
      const downtimeHours = Math.max(plannedHours - actualHours, 0);

      updates.push('planned_hours = ?');
      values.push(plannedHours);
      updates.push('actual_hours = ?');
      values.push(actualHours);
      updates.push('downtime_hours = ?');
      values.push(downtimeHours);
      updates.push('uptime_rate = ?');
      values.push(calculatedRate);
    }

    if (downtime_reasons !== undefined) {
      updates.push('downtime_reason = ?');
      values.push(downtime_reasons || null);
    }

    if (updates.length === 0) {
      return { success: false, message: '没有可更新的字段' };
    }

    updates.push('updated_at = NOW()');
    values.push(id, tenantId);
    const [result] = await db.execute(
      `UPDATE uptime_statistics
       SET ${updates.join(', ')}
       WHERE id = ? AND tenant_id = ?`,
      values,
    );

    if (result.affectedRows === 0) {
      return { success: false, message: '记录不存在' };
    }
    return { success: true, message: '更新成功' };
  }

  /**
   * 删除开机率统计
   * @param {number} id - 记录ID
   * @param {string} tenantId - 租户ID
   * @returns {Promise<boolean>} 删除结果
   */
  async deleteUptimeStatistic(id, tenantId) {
    const [result] = await db.execute(
      'DELETE FROM uptime_statistics WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );

    if (result.affectedRows === 0) {
      return { success: false, message: '记录不存在' };
    }
    return { success: true, message: '删除成功' };
  }

  /**
   * 根据运行日志计算月度开机率
   * @param {Object} params - 计算参数 { year, month }
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Object>} 计算结果
   */
  async calculateFromOperationLogs(params, tenantId) {
    const period = resolveCalculationPeriod(params);
    const sourceTable = await resolveOperationLogTable();

    if (!sourceTable) {
      return {
        success: false,
        message: '未找到可用于自动计算的运行日志表',
      };
    }

    let rows = [];
    let warning = null;

    if (sourceTable === 'asset_operation_logs') {
      const [resultRows] = await db.execute(
        `SELECT
           aol.asset_id,
           a.asset_code,
           a.asset_name,
           'regular_equipment' AS device_type,
           SUM(COALESCE(aol.planned_operating_hours, 0)) AS planned_hours,
           SUM(COALESCE(aol.actual_operating_hours, 0)) AS actual_hours,
           SUM(COALESCE(aol.downtime_hours, 0)) AS downtime_hours,
         GROUP_CONCAT(DISTINCT NULLIF(aol.downtime_reason, '') SEPARATOR '; ') AS downtime_reasons
         FROM asset_operation_logs aol
         ${ASSET_OPERATION_LOG_ASSET_JOIN}
         WHERE aol.tenant_id = ?
           AND DATE_FORMAT(aol.operation_date, '%Y-%m') = ?
         GROUP BY aol.asset_id, a.asset_code, a.asset_name`,
        [tenantId, period.period],
      );
      rows = resultRows;
    } else {
      const [resultRows] = await db.execute(
        `SELECT
           ol.asset_id,
           a.asset_code,
           a.asset_name,
           'regular_equipment' AS device_type,
           ROUND(
             COALESCE(
               SUM(
                 COALESCE(
                   ol.duration_minutes,
                   TIMESTAMPDIFF(MINUTE, ol.start_time, ol.end_time),
                   0
                 )
               ) / 60,
               0
             ),
             2
           ) AS duration_hours,
           COUNT(DISTINCT DATE(ol.operation_time)) * 24 AS planned_hours,
           COUNT(
             DISTINCT CASE
               WHEN ol.operation_type = 'start' THEN DATE(ol.operation_time)
               ELSE NULL
           END
         ) * 24 AS inferred_running_hours,
         GROUP_CONCAT(DISTINCT NULLIF(ol.notes, '') SEPARATOR '; ') AS downtime_reasons
         FROM operation_logs ol
         ${OPERATION_LOG_ASSET_JOIN}
         WHERE ol.tenant_id = ?
           AND DATE_FORMAT(ol.operation_time, '%Y-%m') = ?
         GROUP BY ol.asset_id, a.asset_code, a.asset_name`,
        [tenantId, period.period],
      );

      rows = resultRows.map(item => ({
        ...item,
        actual_hours: Math.max(parseHours(item.duration_hours), parseHours(item.inferred_running_hours)),
        downtime_hours: Math.max(
          parseHours(item.planned_hours) -
            Math.max(parseHours(item.duration_hours), parseHours(item.inferred_running_hours)),
          0,
        ),
      }));
      warning =
        '当前基于 operation_logs 做估算计算，建议补充 duration_minutes 或使用 asset_operation_logs 提高准确度。';
    }

    if (rows.length === 0) {
      return {
        success: true,
        message: `${period.year}年${period.month}月没有可计算的运行日志数据`,
        data: [],
        source_table: sourceTable,
        warning,
      };
    }

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const results = [];
      for (const row of rows) {
        // eslint-disable-next-line no-await-in-loop
        results.push(await upsertMonthlyStatistic(connection, tenantId, period.statisticsDate, row));
      }
      await connection.commit();

      return {
        success: true,
        message: `已完成 ${period.year}年${period.month}月开机率统计计算`,
        data: results,
        source_table: sourceTable,
        warning,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 获取仪表盘数据
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Object>} 仪表盘数据
   */
  async getDashboard(tenantId) {
    const departmentColumn = await resolveAssetDepartmentColumn();
    const departmentExpr = departmentColumn
      ? `CAST(a.${departmentColumn} AS CHAR)`
      : '\'未分配\'';

    const [overallRows] = await db.execute(
      `SELECT
         AVG(us.uptime_rate) AS avg_rate,
         COUNT(DISTINCT us.asset_id) AS total_assets,
         SUM(us.actual_hours) AS total_running_hours
       FROM uptime_statistics us
       WHERE us.tenant_id = ?
         AND DATE_FORMAT(us.statistics_date, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')`,
      [tenantId],
    );

    const [deptRows] = await db.execute(
      `SELECT
         ${departmentExpr} AS department,
         COUNT(DISTINCT us.asset_id) AS asset_count,
         AVG(us.uptime_rate) AS rate
       FROM uptime_statistics us
       ${UPTIME_STATISTICS_ASSET_JOIN}
       WHERE us.tenant_id = ?
         AND DATE_FORMAT(us.statistics_date, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')
       GROUP BY ${departmentExpr}
       ORDER BY rate DESC`,
      [tenantId],
    );

    const [trendRows] = await db.execute(
      `SELECT
         DATE_FORMAT(statistics_date, '%Y-%m') AS period,
         AVG(uptime_rate) AS rate
       FROM uptime_statistics
       WHERE tenant_id = ?
       GROUP BY DATE_FORMAT(statistics_date, '%Y-%m')
       ORDER BY period DESC
       LIMIT 12`,
      [tenantId],
    );

    const [lowRows] = await db.execute(
      `SELECT
         us.asset_id,
         us.uptime_rate,
         us.downtime_reason,
         a.asset_code,
         a.asset_name,
         ${departmentExpr} AS department
       FROM uptime_statistics us
       ${UPTIME_STATISTICS_ASSET_JOIN}
       WHERE us.tenant_id = ?
         AND DATE_FORMAT(us.statistics_date, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')
         AND us.uptime_rate < 90
       ORDER BY us.uptime_rate ASC
       LIMIT 20`,
      [tenantId],
    );

    return {
      overall: overallRows[0] || { avg_rate: 0, total_assets: 0, total_running_hours: 0 },
      byDepartment: deptRows,
      byCategory: [],
      trend: trendRows.reverse(),
      lowUptimeAssets: lowRows,
    };
  }

  /**
   * 获取开机率概览
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Object>} 概览数据
   */
  async getOverview(tenantId) {
    const year = new Date().getFullYear();
    const month = new Date().getMonth() + 1;

    const [stats] = await db.execute(
      `SELECT
        AVG(uptime_rate) as avg_uptime,
        COUNT(*) as total_assets
       FROM uptime_statistics
       WHERE tenant_id = ? AND stat_year = ? AND stat_month = ?`,
      [tenantId, year, month],
    );

    return {
      period: `${year}年${month}月`,
      avg_uptime: stats[0]?.avg_uptime || 0,
      total_assets: stats[0]?.total_assets || 0,
    };
  }
}

module.exports = new UptimeService();
