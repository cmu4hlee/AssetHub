/**
 * 合规性管理服务层
 * 符合《医学装备整体运维管理服务规范》要求
 */

const db = require('../../../config/database');
const logger = require('../../../config/logger');

const TABLE_SCHEMA_CACHE_MS = 30 * 1000;
const tableSchemaCache = new Map();

const ERROR_TYPES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE_ERROR: 'DUPLICATE_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};

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

function getEnumValues(columnType = '') {
  const matched = columnType.match(/^enum\((.*)\)$/i);
  if (!matched) return [];
  return matched[1]
    .split(',')
    .map(v => v.trim().replace(/^'(.*)'$/, '$1'))
    .filter(Boolean);
}

async function getTableSchema(tableName, connection = db) {
  const cached = tableSchemaCache.get(tableName);
  if (cached && Date.now() - cached.fetchedAt < TABLE_SCHEMA_CACHE_MS) {
    return cached;
  }

  const [rows] = await connection.execute(
    `SELECT COLUMN_NAME, COLUMN_TYPE
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [tableName],
  );

  const schema = {
    columns: new Set(rows.map(row => row.COLUMN_NAME)),
    types: rows.reduce((acc, row) => {
      acc[row.COLUMN_NAME] = row.COLUMN_TYPE || '';
      return acc;
    }, {}),
    fetchedAt: Date.now(),
  };

  tableSchemaCache.set(tableName, schema);
  return schema;
}

async function hasTenantAsset(assetId, tenantId, executor = db) {
  if (!assetId) return false;
  const [rows] = await executor.execute(
    'SELECT id FROM assets WHERE id = ? AND tenant_id = ? LIMIT 1',
    [assetId, tenantId],
  );
  return rows.length > 0;
}

async function hasTenantUser(userId, tenantId, executor = db) {
  if (!userId) return false;
  const [rows] = await executor.execute(
    'SELECT id FROM users WHERE id = ? AND tenant_id = ? LIMIT 1',
    [userId, tenantId],
  );
  return rows.length > 0;
}

class ComplianceService {
  /**
   * 获取分级保养模板列表
   */
  async getMaintenanceTemplates(params, tenantId) {
    const { maintenance_level, asset_category, status, page = 1, pageSize = 20 } = params;
    const tenantScope = buildTenantScopedClause(tenantId, 'mlt');

    let sql = `
      SELECT mlt.*, u.username as created_by_name
      FROM maintenance_level_templates mlt
      LEFT JOIN users u ON mlt.created_by = u.id AND u.tenant_id = mlt.tenant_id
      WHERE mlt.tenant_id = ?
    `;
    const queryParams = [tenantId];

    if (maintenance_level) {
      sql += ' AND mlt.maintenance_level = ?';
      queryParams.push(maintenance_level);
    }
    if (asset_category) {
      sql += ' AND mlt.asset_category = ?';
      queryParams.push(asset_category);
    }
    if (status) {
      sql += ' AND mlt.status = ?';
      queryParams.push(status);
    }

    sql += ' ORDER BY mlt.maintenance_level, mlt.created_at DESC';

    const offset = (page - 1) * pageSize;
    sql += ' LIMIT ? OFFSET ?';
    queryParams.push(parseInt(pageSize), parseInt(offset));

    const [templates] = await db.execute(sql, queryParams);

    let countSql = 'SELECT COUNT(*) as total FROM maintenance_level_templates WHERE tenant_id = ?';
    const countParams = [tenantId];
    if (maintenance_level) {
      countSql += ' AND maintenance_level = ?';
      countParams.push(maintenance_level);
    }
    if (status) {
      countSql += ' AND status = ?';
      countParams.push(status);
    }
    const [countResult] = await db.execute(countSql, countParams);

    return {
      data: templates.map(t => ({
        ...t,
        maintenance_items: typeof t.maintenance_items === 'string' ? JSON.parse(t.maintenance_items) : t.maintenance_items,
      })),
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total: countResult[0].total,
      },
    };
  }

  /**
   * 获取单个保养模板
   */
  async getMaintenanceTemplateById(id, tenantId) {
    const [templates] = await db.execute(
      'SELECT * FROM maintenance_level_templates WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );

    if (templates.length === 0) {
      return null;
    }

    const template = templates[0];
    template.maintenance_items = typeof template.maintenance_items === 'string'
      ? JSON.parse(template.maintenance_items)
      : template.maintenance_items;

    return template;
  }

  /**
   * 创建分级保养模板
   */
  async createMaintenanceTemplate(templateData, tenantId, userId) {
    const {
      template_code,
      template_name,
      maintenance_level,
      asset_category,
      asset_type,
      risk_level,
      cycle_days,
      cycle_type,
      maintenance_items,
      required_tools,
      required_materials,
      estimated_hours,
      standards,
      safety_requirements,
    } = templateData;

    const [existing] = await db.execute(
      'SELECT id FROM maintenance_level_templates WHERE tenant_id = ? AND template_code = ?',
      [tenantId, template_code],
    );

    if (existing.length > 0) {
      const error = new Error('模板编码已存在');
      error.code = 'ER_DUP_ENTRY';
      throw error;
    }

    const [result] = await db.execute(
      `INSERT INTO maintenance_level_templates (
        tenant_id, template_code, template_name, maintenance_level,
        asset_category, asset_type, risk_level, cycle_days, cycle_type,
        maintenance_items, required_tools, required_materials, estimated_hours,
        standards, safety_requirements, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId, template_code, template_name, maintenance_level,
        asset_category, asset_type, risk_level, cycle_days, cycle_type,
        JSON.stringify(maintenance_items), required_tools, required_materials, estimated_hours,
        standards, safety_requirements, userId,
      ],
    );

    return { id: result.insertId };
  }

  /**
   * 更新保养模板
   */
  async updateMaintenanceTemplate(id, updates, tenantId) {
    const fields = [];
    const values = [];

    Object.keys(updates).forEach(key => {
      if (key !== 'id' && key !== 'tenant_id' && key !== 'created_at') {
        fields.push(`${key} = ?`);
        values.push(key === 'maintenance_items' ? JSON.stringify(updates[key]) : updates[key]);
      }
    });

    if (fields.length === 0) {
      const error = new Error('没有要更新的字段');
      error.errorType = ERROR_TYPES.VALIDATION_ERROR;
      throw error;
    }

    values.push(id, tenantId);

    const [result] = await db.execute(
      `UPDATE maintenance_level_templates SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
      values,
    );

    return result.affectedRows > 0;
  }

  /**
   * 删除保养模板
   */
  async deleteMaintenanceTemplate(id, tenantId) {
    const [result] = await db.execute(
      'DELETE FROM maintenance_level_templates WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );

    return result.affectedRows > 0;
  }

  /**
   * 获取保养计划列表
   */
  async getMaintenancePlans(params, tenantId) {
    const { page = 1, pageSize = 20, status, asset_id } = params;

    const planSchema = await getTableSchema('maintenance_level_plans');
    const statusEnumValues = getEnumValues(planSchema.types.status);
    const pendingStatusValue = statusEnumValues.includes('pending')
      ? 'pending'
      : (statusEnumValues.includes('planned') ? 'planned' : 'pending');

    const normalizedPage = Math.max(1, parseInt(page, 10) || 1);
    const normalizedPageSize = Math.min(200, Math.max(1, parseInt(pageSize, 10) || 20));

    const selectPlanNo = planSchema.columns.has('plan_no')
      ? 'mlp.plan_no'
      : (planSchema.columns.has('plan_code') ? 'mlp.plan_code AS plan_no' : "CONCAT('MLP-', mlp.id) AS plan_no");
    const selectPlanCode = planSchema.columns.has('plan_code')
      ? 'mlp.plan_code'
      : (planSchema.columns.has('plan_no') ? 'mlp.plan_no' : "CONCAT('MLP-', mlp.id)");
    const selectPlanDate = planSchema.columns.has('plan_date') ? 'mlp.plan_date' : 'NULL';
    const selectActualDate = planSchema.columns.has('actual_date') ? 'mlp.actual_date' : 'NULL';
    const selectStatus = planSchema.columns.has('status')
      ? "CASE WHEN mlp.status = 'planned' THEN 'pending' ELSE mlp.status END AS status"
      : "'pending' AS status";
    const selectAssignee = planSchema.columns.has('executor_name')
      ? 'mlp.executor_name AS assigned_to_name'
      : (planSchema.columns.has('executor_id') ? 'CAST(mlp.executor_id AS CHAR) AS assigned_to_name' : 'NULL AS assigned_to_name');
    const orderColumn = planSchema.columns.has('plan_date') ? 'mlp.plan_date' : 'mlp.id';
    const hasTemplateRef = planSchema.columns.has('template_id');

    let sql = `
      SELECT
        mlp.id,
        ${selectPlanNo},
        ${selectPlanCode} AS plan_code,
        mlp.asset_id,
        mlp.maintenance_level,
        ${selectPlanDate} AS plan_date,
        ${selectPlanDate} AS planned_date,
        ${selectActualDate} AS actual_date,
        ${selectStatus},
        ${selectAssignee},
        a.asset_name,
        a.asset_code,
        ${hasTemplateRef ? 'mlt.template_name' : 'NULL AS template_name'}
      FROM maintenance_level_plans mlp
      LEFT JOIN assets a ON mlp.asset_id = a.id AND a.tenant_id = mlp.tenant_id AND a.is_deleted = 0
      ${hasTemplateRef ? 'LEFT JOIN maintenance_level_templates mlt ON mlp.template_id = mlt.id AND mlt.tenant_id = mlp.tenant_id' : ''}
      WHERE 1 = 1
    `;
    const queryParams = [];

    if (planSchema.columns.has('tenant_id')) {
      sql += ' AND mlp.tenant_id = ?';
      queryParams.push(tenantId);
    }

    if (status && planSchema.columns.has('status')) {
      const normalizedStatus = status === 'pending' ? pendingStatusValue : status;
      sql += ' AND mlp.status = ?';
      queryParams.push(normalizedStatus);
    }

    if (asset_id && planSchema.columns.has('asset_id')) {
      sql += ' AND mlp.asset_id = ?';
      queryParams.push(asset_id);
    }

    sql += ` ORDER BY ${orderColumn} DESC`;
    sql += ' LIMIT ? OFFSET ?';
    queryParams.push(normalizedPageSize, (normalizedPage - 1) * normalizedPageSize);

    const [plans] = await db.execute(sql, queryParams);

    const countSql = 'SELECT COUNT(*) as total FROM maintenance_level_plans WHERE tenant_id = ?';
    const countParams = [tenantId];
    const [countResult] = await db.execute(countSql, countParams);

    return {
      data: plans,
      pagination: {
        page: normalizedPage,
        pageSize: normalizedPageSize,
        total: countResult[0].total,
      },
    };
  }

  /**
   * 生成分级保养计划
   */
  async generateMaintenancePlans(assetIds, startDate, months, tenantId, userId) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const planSchema = await getTableSchema('maintenance_level_plans', connection);
      const statusEnumValues = getEnumValues(planSchema.types.status);
      const defaultPlanStatus = statusEnumValues.includes('pending')
        ? 'pending'
        : (statusEnumValues.includes('planned') ? 'planned' : statusEnumValues[0]);
      const riskSchema = await getTableSchema('asset_risk_levels', connection);
      const hasRiskTable =
        riskSchema.columns.size > 0 &&
        riskSchema.columns.has('asset_id') &&
        riskSchema.columns.has('risk_level');

      const generatedPlans = [];

      for (const assetId of assetIds) {
        const [assets] = hasRiskTable
          ? await connection.execute(
              `SELECT a.*, arl.risk_level
               FROM assets a
               LEFT JOIN asset_risk_levels arl ON a.id = arl.asset_id AND arl.tenant_id = ?
               WHERE a.id = ? AND a.tenant_id = ? AND a.is_deleted = 0`,
              [tenantId, assetId, tenantId],
            )
          : await connection.execute(
              `SELECT a.*, NULL AS risk_level
               FROM assets a
               WHERE a.id = ? AND a.tenant_id = ? AND a.is_deleted = 0`,
              [assetId, tenantId],
            );

        if (assets.length === 0) continue;

        const asset = assets[0];
        const riskLevel = asset.risk_level || 'medium';

        const [templates] = await connection.execute(
          `SELECT * FROM maintenance_level_templates
           WHERE tenant_id = ? AND status = 'active'
           AND (risk_level IS NULL OR risk_level = ? OR risk_level = '')
           ORDER BY maintenance_level`,
          [tenantId, riskLevel],
        );

        const start = new Date(startDate);
        const end = new Date(start);
        end.setMonth(end.getMonth() + months);

        for (const template of templates) {
          const currentDate = new Date(start);

          while (currentDate < end) {
            const planDate = new Date(currentDate);
            const dueDate = new Date(planDate);
            dueDate.setDate(dueDate.getDate() + 3);

            const planNo = `MLP${Date.now()}${Math.floor(Math.random() * 1000)}`;

            const insertFields = ['tenant_id', 'asset_id', 'maintenance_level', 'plan_date'];
            const insertValues = [
              tenantId,
              assetId,
              template.maintenance_level,
              planDate.toISOString().split('T')[0],
            ];

            if (planSchema.columns.has('plan_no')) {
              insertFields.push('plan_no');
              insertValues.push(planNo);
            } else if (planSchema.columns.has('plan_code')) {
              insertFields.push('plan_code');
              insertValues.push(planNo);
            }

            if (planSchema.columns.has('template_id')) {
              insertFields.push('template_id');
              insertValues.push(template.id);
            }

            if (planSchema.columns.has('due_date')) {
              insertFields.push('due_date');
              insertValues.push(dueDate.toISOString().split('T')[0]);
            }

            if (planSchema.columns.has('status') && defaultPlanStatus) {
              insertFields.push('status');
              insertValues.push(defaultPlanStatus);
            }

            if (planSchema.columns.has('created_by')) {
              insertFields.push('created_by');
              insertValues.push(userId);
            }

            const [result] = await connection.execute(
              `INSERT INTO maintenance_level_plans (${insertFields.join(', ')})
               VALUES (${insertFields.map(() => '?').join(', ')})`,
              insertValues,
            );

            generatedPlans.push({
              id: result.insertId,
              plan_no: planNo,
              asset_id: assetId,
              asset_name: asset.asset_name,
              maintenance_level: template.maintenance_level,
              plan_date: planDate.toISOString().split('T')[0],
            });

            const cycleType = template.cycle_type || 'day';
            const cycleDays = Math.max(1, Number(template.cycle_days) || 30);

            switch (cycleType) {
              case 'day':
                currentDate.setDate(currentDate.getDate() + cycleDays);
                break;
              case 'week':
                currentDate.setDate(currentDate.getDate() + cycleDays);
                break;
              case 'month':
                currentDate.setMonth(currentDate.getMonth() + 1);
                break;
              case 'quarter':
                currentDate.setMonth(currentDate.getMonth() + 3);
                break;
              case 'year':
                currentDate.setFullYear(currentDate.getFullYear() + 1);
                break;
              default:
                currentDate.setDate(currentDate.getDate() + cycleDays);
                break;
            }
          }
        }
      }

      await connection.commit();
      return generatedPlans;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 获取仪表板统计数据
   */
  async getDashboardStats(tenantId) {
    const result = {
      maintenance: { total: 0, pending: 0, processing: 0, completed: 0 },
      specialEquipment: { total: 0, normal: 0, expiring: 0, expired: 0 },
    };

    try {
      const [maintenanceStats] = await db.execute(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status IN ('pending', 'planned') THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
        FROM maintenance_level_plans
        WHERE tenant_id = ?
      `, [tenantId]);

      if (maintenanceStats[0]) {
        result.maintenance = {
          total: Number(maintenanceStats[0].total || 0),
          pending: Number(maintenanceStats[0].pending || 0),
          processing: Number(maintenanceStats[0].processing || 0),
          completed: Number(maintenanceStats[0].completed || 0),
        };
      }
    } catch (e) {
      logger.warn('maintenance_level_plans table query failed:', e.message);
    }

    // 特种设备统计
    try {
      const [seStats] = await db.execute(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN next_inspection_date > DATE_ADD(CURDATE(), INTERVAL 90 DAY) OR next_inspection_date IS NULL THEN 1 ELSE 0 END) as normal,
          SUM(CASE WHEN next_inspection_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 90 DAY) THEN 1 ELSE 0 END) as expiring,
          SUM(CASE WHEN next_inspection_date < CURDATE() THEN 1 ELSE 0 END) as expired
        FROM special_equipment
        WHERE tenant_id = ?
      `, [tenantId]);

      if (seStats[0]) {
        result.specialEquipment = {
          total: Number(seStats[0].total || 0),
          normal: Number(seStats[0].normal || 0),
          expiring: Number(seStats[0].expiring || 0),
          expired: Number(seStats[0].expired || 0),
        };
      }
    } catch (e) {
      logger.warn('special_equipment stats query failed:', e.message);
    }

    return result;
  }
}

module.exports = new ComplianceService();

