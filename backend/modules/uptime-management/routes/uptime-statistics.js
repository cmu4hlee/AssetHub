/**
 * 设备开机率统计路由
 * 符合《医学装备整体运维管理服务规范》要求
 */

const express = require('express');
const router = express.Router();
const db = require('../../../config/database');
const { authenticate } = require('../../../middleware/auth');
const logger = require('../../config/logger');

/**
 * 记录设备运行数据
 */
router.post('/operation-logs', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const {
      asset_id,
      operation_date,
      planned_operating_hours,
      actual_operating_hours,
      downtime_hours,
      status_changes,
      downtime_reason,
      downtime_type,
      data_source,
      remarks,
    } = req.body;

    // 计算停机时长
    const calculatedDowntime = planned_operating_hours - actual_operating_hours;
    const finalDowntime = downtime_hours || (calculatedDowntime > 0 ? calculatedDowntime : 0);

    await db.execute(
      `INSERT INTO asset_operation_logs (
        tenant_id, asset_id, operation_date, planned_operating_hours,
        actual_operating_hours, downtime_hours, status_changes,
        downtime_reason, downtime_type, data_source, recorded_by, recorded_by_name, remarks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        planned_operating_hours = VALUES(planned_operating_hours),
        actual_operating_hours = VALUES(actual_operating_hours),
        downtime_hours = VALUES(downtime_hours),
        status_changes = VALUES(status_changes),
        downtime_reason = VALUES(downtime_reason),
        downtime_type = VALUES(downtime_type),
        recorded_by = VALUES(recorded_by),
        recorded_by_name = VALUES(recorded_by_name),
        remarks = VALUES(remarks),
        updated_at = CURRENT_TIMESTAMP`,
      [
        tenantId, asset_id, operation_date, planned_operating_hours,
        actual_operating_hours, finalDowntime, JSON.stringify(status_changes || []),
        downtime_reason, downtime_type, data_source || 'manual',
        req.user.id, req.user.username, remarks,
      ],
    );

    res.json({ success: true, message: '运行数据记录成功' });
  } catch (error) {
    logger.error('记录运行数据失败:', error);
    res.status(500).json({ success: false, message: '记录运行数据失败' });
  }
});

/**
 * 获取设备运行记录
 */
router.get('/operation-logs', authenticate, async (req, res) => {
  try {
    const { asset_id, start_date, end_date, page = 1, pageSize = 30 } = req.query;
    const tenantId = req.user.tenant_id;

    let sql = `
      SELECT 
        aol.*,
        a.asset_code,
        a.asset_name,
        a.asset_type,
        a.department
      FROM asset_operation_logs aol
      LEFT JOIN assets a ON aol.asset_id = a.id AND a.tenant_id = aol.tenant_id
      WHERE aol.tenant_id = ?
    `;
    const params = [tenantId];

    if (asset_id) {
      sql += ' AND aol.asset_id = ?';
      params.push(asset_id);
    }
    if (start_date) {
      sql += ' AND aol.operation_date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      sql += ' AND aol.operation_date <= ?';
      params.push(end_date);
    }

    sql += ' ORDER BY aol.operation_date DESC';

    const offset = (page - 1) * pageSize;
    sql += ' LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), parseInt(offset));

    const [logs] = await db.execute(sql, params);

    res.json({
      success: true,
      data: logs.map(l => ({
        ...l,
        status_changes: l.status_changes ? JSON.parse(l.status_changes) : null,
      })),
    });
  } catch (error) {
    logger.error('获取运行记录失败:', error);
    res.status(500).json({ success: false, message: '获取运行记录失败' });
  }
});

/**
 * 计算并更新开机率统计
 */
router.post('/calculate', authenticate, async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const tenantId = req.user.tenant_id;
    const { year, month } = req.body;

    // 获取所有资产
    const [assets] = await connection.execute(
      'SELECT id, asset_code, asset_name FROM assets WHERE tenant_id = ? AND status != ?',
      [tenantId, '报废'],
    );

    const results = [];

    for (const asset of assets) {
      // 获取该资产当月的运行记录
      const [logs] = await connection.execute(
        `SELECT 
          COUNT(*) as record_days,
          SUM(planned_operating_hours) as total_planned_hours,
          SUM(actual_operating_hours) as total_actual_hours,
          SUM(downtime_hours) as total_downtime_hours,
          SUM(CASE WHEN downtime_type = 'maintenance' THEN 1 ELSE 0 END) as maintenance_count,
          SUM(CASE WHEN downtime_type = 'repair' THEN 1 ELSE 0 END) as repair_count,
          SUM(CASE WHEN downtime_type = 'fault' THEN 1 ELSE 0 END) as fault_count
        FROM asset_operation_logs
        WHERE tenant_id = ? AND asset_id = ? 
        AND YEAR(operation_date) = ? AND MONTH(operation_date) = ?`,
        [tenantId, asset.id, year, month],
      );

      const log = logs[0];
      const plannedDays = log.record_days || 0;
      const plannedHours = log.total_planned_hours || 0;
      const actualHours = log.total_actual_hours || 0;
      const downtimeHours = log.total_downtime_hours || 0;

      // 计算开机率
      const uptimeRate = plannedHours > 0 ? ((actualHours / plannedHours) * 100).toFixed(2) : 0;

      // 保存统计结果
      await connection.execute(
        `INSERT INTO asset_uptime_statistics (
          tenant_id, asset_id, stat_year, stat_month,
          planned_operating_days, actual_operating_days,
          total_planned_hours, total_actual_hours, total_downtime_hours,
          uptime_rate, maintenance_count, repair_count, fault_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          planned_operating_days = VALUES(planned_operating_days),
          actual_operating_days = VALUES(actual_operating_days),
          total_planned_hours = VALUES(total_planned_hours),
          total_actual_hours = VALUES(total_actual_hours),
          total_downtime_hours = VALUES(total_downtime_hours),
          uptime_rate = VALUES(uptime_rate),
          maintenance_count = VALUES(maintenance_count),
          repair_count = VALUES(repair_count),
          fault_count = VALUES(fault_count),
          updated_at = CURRENT_TIMESTAMP`,
        [
          tenantId, asset.id, year, month,
          plannedDays, plannedDays, // 实际运行天数这里用记录天数
          plannedHours, actualHours, downtimeHours,
          uptimeRate,
          log.maintenance_count || 0,
          log.repair_count || 0,
          log.fault_count || 0,
        ],
      );

      results.push({
        asset_id: asset.id,
        asset_name: asset.asset_name,
        uptime_rate: uptimeRate,
      });
    }

    await connection.commit();

    res.json({
      success: true,
      message: `已完成 ${year}年${month}月 开机率统计计算`,
      data: results,
    });
  } catch (error) {
    await connection.rollback();
    logger.error('计算开机率统计失败:', error);
    res.status(500).json({ success: false, message: '计算开机率统计失败' });
  } finally {
    connection.release();
  }
});

/**
 * 获取开机率统计
 */
router.get('/statistics', authenticate, async (req, res) => {
  try {
    const { asset_id, year, month, department, asset_type, page = 1, pageSize = 20 } = req.query;
    const tenantId = req.user.tenant_id;

    let sql = `
      SELECT 
        aus.*,
        a.asset_code,
        a.asset_name,
        a.asset_type,
        a.department,
        CASE 
          WHEN a.asset_type IN ('生命支持类', '急救类') THEN 'life_support'
          WHEN a.asset_type IN ('影像类', '放射类', '检验类') THEN 'large_equipment'
          ELSE 'regular'
        END as equipment_category
      FROM asset_uptime_statistics aus
      LEFT JOIN assets a ON aus.asset_id = a.id AND a.tenant_id = aus.tenant_id
      WHERE aus.tenant_id = ?
    `;
    const params = [tenantId];

    if (asset_id) {
      sql += ' AND aus.asset_id = ?';
      params.push(asset_id);
    }
    if (year) {
      sql += ' AND aus.stat_year = ?';
      params.push(year);
    }
    if (month) {
      sql += ' AND aus.stat_month = ?';
      params.push(month);
    }
    if (department) {
      sql += ' AND a.department = ?';
      params.push(department);
    }
    if (asset_type) {
      sql += ' AND a.asset_type = ?';
      params.push(asset_type);
    }

    sql += ' ORDER BY aus.stat_year DESC, aus.stat_month DESC, aus.uptime_rate ASC';

    const offset = (page - 1) * pageSize;
    sql += ' LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), parseInt(offset));

    const [statistics] = await db.execute(sql, params);

    res.json({ success: true, data: statistics });
  } catch (error) {
    logger.error('获取开机率统计失败:', error);
    res.status(500).json({ success: false, message: '获取开机率统计失败' });
  }
});

/**
 * 获取开机率概览（仪表盘数据）
 */
router.get('/overview', authenticate, async (req, res) => {
  try {
    const { year, month } = req.query;
    const tenantId = req.user.tenant_id;

    const targetYear = year || new Date().getFullYear();
    const targetMonth = month || (new Date().getMonth() + 1);

    // 各类设备开机率统计
    const [categoryStats] = await db.execute(
      `SELECT 
        CASE 
          WHEN a.asset_type IN ('生命支持类', '急救类') THEN 'life_support'
          WHEN a.asset_type IN ('影像类', '放射类', '检验类') THEN 'large_equipment'
          ELSE 'regular'
        END as equipment_category,
        COUNT(*) as total_count,
        AVG(aus.uptime_rate) as avg_uptime_rate,
        SUM(CASE WHEN aus.uptime_rate >= 95 THEN 1 ELSE 0 END) as qualified_count,
        SUM(CASE WHEN aus.uptime_rate < 95 THEN 1 ELSE 0 END) as unqualified_count
      FROM asset_uptime_statistics aus
      LEFT JOIN assets a ON aus.asset_id = a.id AND a.tenant_id = aus.tenant_id
      WHERE aus.tenant_id = ? AND aus.stat_year = ? AND aus.stat_month = ?
      GROUP BY equipment_category`,
      [tenantId, targetYear, targetMonth],
    );

    // 部门开机率排名
    const [departmentStats] = await db.execute(
      `SELECT 
        a.department,
        COUNT(*) as equipment_count,
        AVG(aus.uptime_rate) as avg_uptime_rate
      FROM asset_uptime_statistics aus
      LEFT JOIN assets a ON aus.asset_id = a.id AND a.tenant_id = aus.tenant_id
      WHERE aus.tenant_id = ? AND aus.stat_year = ? AND aus.stat_month = ?
      GROUP BY a.department
      ORDER BY avg_uptime_rate DESC
      LIMIT 10`,
      [tenantId, targetYear, targetMonth],
    );

    // 低开机率设备（需要关注的）
    const [lowUptimeEquipment] = await db.execute(
      `SELECT 
        a.asset_code,
        a.asset_name,
        a.department,
        a.asset_type,
        aus.uptime_rate,
        aus.total_downtime_hours
      FROM asset_uptime_statistics aus
      LEFT JOIN assets a ON aus.asset_id = a.id AND a.tenant_id = aus.tenant_id
      WHERE aus.tenant_id = ? AND aus.stat_year = ? AND aus.stat_month = ?
      AND aus.uptime_rate < 95
      ORDER BY aus.uptime_rate ASC
      LIMIT 10`,
      [tenantId, targetYear, targetMonth],
    );

    // 停机原因统计
    const [downtimeStats] = await db.execute(
      `SELECT 
        SUM(aus.maintenance_count) as maintenance_count,
        SUM(aus.repair_count) as repair_count,
        SUM(aus.fault_count) as fault_count
      FROM asset_uptime_statistics aus
      WHERE aus.tenant_id = ? AND aus.stat_year = ? AND aus.stat_month = ?`,
      [tenantId, targetYear, targetMonth],
    );

    res.json({
      success: true,
      data: {
        period: `${targetYear}年${targetMonth}月`,
        category_statistics: categoryStats,
        department_ranking: departmentStats,
        low_uptime_equipment: lowUptimeEquipment,
        downtime_statistics: downtimeStats[0],
      },
    });
  } catch (error) {
    logger.error('获取开机率概览失败:', error);
    res.status(500).json({ success: false, message: '获取开机率概览失败' });
  }
});

/**
 * 批量录入运行数据
 */
router.post('/batch-operation-logs', authenticate, async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const tenantId = req.user.tenant_id;
    const { logs } = req.body;

    for (const log of logs) {
      const calculatedDowntime = log.planned_operating_hours - log.actual_operating_hours;
      const finalDowntime = log.downtime_hours || (calculatedDowntime > 0 ? calculatedDowntime : 0);

      await connection.execute(
        `INSERT INTO asset_operation_logs (
          tenant_id, asset_id, operation_date, planned_operating_hours,
          actual_operating_hours, downtime_hours, downtime_reason,
          downtime_type, recorded_by, recorded_by_name, remarks
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          planned_operating_hours = VALUES(planned_operating_hours),
          actual_operating_hours = VALUES(actual_operating_hours),
          downtime_hours = VALUES(downtime_hours),
          downtime_reason = VALUES(downtime_reason),
          downtime_type = VALUES(downtime_type),
          recorded_by = VALUES(recorded_by),
          recorded_by_name = VALUES(recorded_by_name),
          remarks = VALUES(remarks),
          updated_at = CURRENT_TIMESTAMP`,
        [
          tenantId, log.asset_id, log.operation_date, log.planned_operating_hours,
          log.actual_operating_hours, finalDowntime, log.downtime_reason,
          log.downtime_type, req.user.id, req.user.username, log.remarks || '',
        ],
      );
    }

    await connection.commit();

    res.json({ success: true, message: `成功录入 ${logs.length} 条运行数据` });
  } catch (error) {
    await connection.rollback();
    logger.error('批量录入运行数据失败:', error);
    res.status(500).json({ success: false, message: '批量录入运行数据失败' });
  } finally {
    connection.release();
  }
});

module.exports = router;
