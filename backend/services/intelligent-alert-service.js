/**
 * 智能预警服务
 * 统一处理各类预警：保养到期、资质到期、检验到期、开机率异常等
 */

const db = require('../config/database');
const logger = require('../config/logger');
const INTELLIGENT_ALERT_TRACE_LOG_ENABLED =
  process.env.INTELLIGENT_ALERT_TRACE_LOG_ENABLED === 'true';
const alertTraceLog = (...args) => {
  if (INTELLIGENT_ALERT_TRACE_LOG_ENABLED) {
    console.warn(...args);
  }
};
const logIntelligentAlertError = (message, error, context = {}) => {
  logger.error(message, {
    error: error?.message || String(error || ''),
    code: error?.code || undefined,
    ...context,
  });
  if (INTELLIGENT_ALERT_TRACE_LOG_ENABLED && error?.stack) {
    alertTraceLog(`${message} stack:`, error.stack);
  }
};

class IntelligentAlertService {
  constructor() {
    this.alertTypes = {
      MAINTENANCE_DUE: 'maintenance_due',      // 保养到期
      QUALIFICATION_EXPIRE: 'qualification_expire', // 资质到期
      INSPECTION_DUE: 'inspection_due',        // 检验到期
      UPTIME_LOW: 'uptime_low',                // 开机率异常
      SAFETY_EXPIRE: 'safety_expire',          // 安全检测到期
    };

    // 默认预警阈值配置
    this.defaultThresholds = {
      maintenance: { days: [7, 3, 1] },        // 保养提前7/3/1天提醒
      qualification: { days: [90, 30, 7] },    // 资质提前90/30/7天提醒
      inspection: { days: [90, 30, 7] },       // 检验提前90/30/7天提醒
      safety: { days: [30, 7, 1] },            // 安全检测提前30/7/1天提醒
      uptime: { threshold: 95 },               // 开机率低于95%预警
    };

    this.alertTypeAliases = {
      maintenance: this.alertTypes.MAINTENANCE_DUE,
      maintenance_due: this.alertTypes.MAINTENANCE_DUE,
      qualification: this.alertTypes.QUALIFICATION_EXPIRE,
      qualification_expire: this.alertTypes.QUALIFICATION_EXPIRE,
      inspection: this.alertTypes.INSPECTION_DUE,
      inspection_due: this.alertTypes.INSPECTION_DUE,
      safety: this.alertTypes.SAFETY_EXPIRE,
      safety_expire: this.alertTypes.SAFETY_EXPIRE,
      uptime: this.alertTypes.UPTIME_LOW,
      uptime_low: this.alertTypes.UPTIME_LOW,
    };

    this.readStateReadyPromise = null;
  }

  normalizeAlertType(type) {
    if (type === undefined || type === null || type === '') return null;
    return this.alertTypeAliases[String(type).trim()] || null;
  }

  normalizeBoolean(value) {
    if (value === true || value === 1) return true;
    if (value === false || value === 0 || value === undefined || value === null) return false;
    const normalized = String(value).trim().toLowerCase();
    return ['true', '1', 'yes', 'on'].includes(normalized);
  }

  getRelatedIdFromAlertId(alertId) {
    const match = String(alertId || '').match(/_(\d+)$/);
    if (!match) return null;
    const relatedId = Number.parseInt(match[1], 10);
    return Number.isInteger(relatedId) ? relatedId : null;
  }

  async ensureReadStateTable() {
    if (this.readStateReadyPromise) return this.readStateReadyPromise;

    this.readStateReadyPromise = (async () => {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS alert_read_states (
          id BIGINT AUTO_INCREMENT PRIMARY KEY,
          tenant_id INT NOT NULL,
          user_id INT NOT NULL,
          alert_id VARCHAR(100) NOT NULL,
          alert_type VARCHAR(64) NOT NULL,
          related_id INT NULL,
          read_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          handled_at TIMESTAMP NULL DEFAULT NULL,
          handled_by INT NULL,
          handler_notes TEXT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uk_alert_read_states_tenant_user_alert (tenant_id, user_id, alert_id),
          INDEX idx_alert_read_states_tenant_user (tenant_id, user_id),
          INDEX idx_alert_read_states_tenant_type (tenant_id, alert_type),
          INDEX idx_alert_read_states_read_at (read_at),
          INDEX idx_alert_read_states_handled_at (handled_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      const [columns] = await db.execute(
        `SELECT COLUMN_NAME
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'alert_read_states'
           AND COLUMN_NAME IN ('handled_at', 'handled_by', 'handler_notes')`,
      );
      const existingColumns = new Set(columns.map(item => item.COLUMN_NAME));
      const alters = [];

      if (!existingColumns.has('handled_at')) {
        alters.push('ADD COLUMN handled_at TIMESTAMP NULL DEFAULT NULL AFTER read_at');
      }
      if (!existingColumns.has('handled_by')) {
        alters.push('ADD COLUMN handled_by INT NULL AFTER handled_at');
      }
      if (!existingColumns.has('handler_notes')) {
        alters.push('ADD COLUMN handler_notes TEXT NULL AFTER handled_by');
      }

      if (alters.length > 0) {
        await db.execute(`ALTER TABLE alert_read_states ${alters.join(', ')}`);
      }
    })().catch(error => {
      this.readStateReadyPromise = null;
      throw error;
    });

    return this.readStateReadyPromise;
  }

  async getReadStateMap(tenantId, userId, alertIds) {
    const normalizedUserId = Number.parseInt(String(userId ?? ''), 10);
    if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
      return new Map();
    }
    if (!Array.isArray(alertIds) || alertIds.length === 0) {
      return new Map();
    }

    await this.ensureReadStateTable();

    const map = new Map();
    const chunkSize = 500;
    for (let index = 0; index < alertIds.length; index += chunkSize) {
      const chunk = alertIds.slice(index, index + chunkSize);
      const placeholders = chunk.map(() => '?').join(', ');
      const [rows] = await db.execute(
        `
        SELECT
          ars.alert_id,
          ars.read_at,
          ars.handled_at,
          ars.handled_by,
          ars.handler_notes,
          COALESCE(u.real_name, u.username) AS handled_by_name
        FROM alert_read_states ars
        LEFT JOIN users u ON u.id = ars.handled_by
        WHERE ars.tenant_id = ?
          AND ars.user_id = ?
          AND ars.alert_id IN (${placeholders})
        `,
        [tenantId, normalizedUserId, ...chunk],
      );

      rows.forEach(row => {
        map.set(row.alert_id, {
          read_at: row.read_at,
          handled_at: row.handled_at,
          handled_by: row.handled_by,
          handler_notes: row.handler_notes || null,
          handled_by_name: row.handled_by_name || null,
        });
      });
    }

    return map;
  }

  withReadStatus(alerts, readStateMap) {
    if (!(readStateMap instanceof Map) || readStateMap.size === 0) {
      return alerts.map(alert => ({
        ...alert,
        is_read: false,
        read_at: null,
        is_handled: false,
        handled_at: null,
        handled_by: null,
        handled_by_name: null,
        handler_notes: null,
      }));
    }

    return alerts.map(alert => {
      const state = readStateMap.get(alert.id) || null;
      const readAt = state?.read_at || null;
      const handledAt = state?.handled_at || null;
      return {
        ...alert,
        is_read: Boolean(readAt),
        read_at: readAt,
        is_handled: Boolean(handledAt),
        handled_at: handledAt,
        handled_by: state?.handled_by || null,
        handled_by_name: state?.handled_by_name || null,
        handler_notes: state?.handler_notes || null,
      };
    });
  }

  /**
   * 获取预警统计概览
   */
  async getAlertOverview(tenantId) {
    try {
      const overview = {
        total: 0,
        maintenance: { total: 0, urgent: 0 },
        qualification: { total: 0, urgent: 0 },
        inspection: { total: 0, urgent: 0 },
        safety: { total: 0, urgent: 0 },
        uptime: { total: 0, urgent: 0 },
      };

      const errors = [];
      const runCheck = async (check, fn) => {
        try {
          return await fn();
        } catch (error) {
          alertTraceLog(`预警检查失败(${check}):`, error);
          errors.push({ check, message: error.message });
          return [];
        }
      };

      // 1. 检查保养到期
      const maintenanceAlerts = await runCheck('maintenance_due', () =>
        this.checkMaintenanceDue(tenantId),
      );
      overview.maintenance.total = maintenanceAlerts.length;
      overview.maintenance.urgent = maintenanceAlerts.filter(a => a.urgency === 'high').length;

      // 2. 检查资质到期
      const qualificationAlerts = await runCheck('qualification_expire', () =>
        this.checkQualificationExpire(tenantId),
      );
      overview.qualification.total = qualificationAlerts.length;
      overview.qualification.urgent = qualificationAlerts.filter(a => a.urgency === 'high').length;

      // 3. 检查特种设备检验到期
      const inspectionAlerts = await runCheck('inspection_due', () => this.checkInspectionDue(tenantId));
      overview.inspection.total = inspectionAlerts.length;
      overview.inspection.urgent = inspectionAlerts.filter(a => a.urgency === 'high').length;

      // 4. 检查安全检测到期
      const safetyAlerts = await runCheck('safety_expire', () => this.checkSafetyExpire(tenantId));
      overview.safety.total = safetyAlerts.length;
      overview.safety.urgent = safetyAlerts.filter(a => a.urgency === 'high').length;

      // 5. 检查开机率异常
      const uptimeAlerts = await runCheck('uptime_low', () => this.checkUptimeLow(tenantId));
      overview.uptime.total = uptimeAlerts.length;
      overview.uptime.urgent = uptimeAlerts.filter(a => a.urgency === 'high').length;

      overview.total =
        overview.maintenance.total +
        overview.qualification.total +
        overview.inspection.total +
        overview.safety.total +
        overview.uptime.total;

      if (errors.length > 0) {
        return {
          success: false,
          partial_failure: true,
          message: '部分预警检查失败，请查看 errors 字段',
          data: overview,
          errors,
        };
      }

      return {
        success: true,
        data: overview,
      };
    } catch (error) {
      logIntelligentAlertError('获取预警概览失败', error, { tenantId });
      return {
        success: false,
        message: '获取预警概览失败',
        error: error.message,
      };
    }
  }

  /**
   * 检查保养到期预警
   */
  async checkMaintenanceDue(tenantId, days = 7) {
    try {
      const today = new Date();
      const futureDate = new Date();
      futureDate.setDate(today.getDate() + days);
      const generatedAt = new Date().toISOString();

      const todayStr = today.toISOString().split('T')[0];
      const futureDateStr = futureDate.toISOString().split('T')[0];

      const [plans] = await db.execute(
        `
        SELECT 
          pmp.id,
          pmp.asset_code,
          pmp.asset_name,
          pmp.plan_name,
          pmp.next_maintenance_date,
          pmp.maintenance_type,
          pmp.responsible_person,
          DATEDIFF(pmp.next_maintenance_date, ?) as days_remaining
        FROM preventive_maintenance_plans pmp
        WHERE pmp.tenant_id = ?
          AND pmp.status = '启用'
          AND pmp.next_maintenance_date BETWEEN ? AND ?
        ORDER BY pmp.next_maintenance_date ASC
        `,
        [todayStr, tenantId, todayStr, futureDateStr],
      );

      return plans.map(plan => ({
        id: `maintenance_${plan.id}`,
        type: this.alertTypes.MAINTENANCE_DUE,
        title: '保养计划即将到期',
        content: `${plan.asset_name}(${plan.asset_code})的${plan.plan_name}将在${plan.days_remaining}天后到期`,
        urgency: plan.days_remaining <= 1 ? 'high' : plan.days_remaining <= 3 ? 'medium' : 'low',
        data: plan,
        actionUrl: `/maintenance/plans/${plan.id}`,
        created_at: generatedAt,
      }));
    } catch (error) {
      alertTraceLog('检查保养到期预警失败:', error);
      throw new Error(`检查保养到期预警失败: ${error.message}`);
    }
  }

  /**
   * 检查资质到期预警
   */
  async checkQualificationExpire(tenantId, days = 90) {
    try {
      const today = new Date();
      const futureDate = new Date();
      futureDate.setDate(today.getDate() + days);
      const generatedAt = new Date().toISOString();

      const todayStr = today.toISOString().split('T')[0];
      const futureDateStr = futureDate.toISOString().split('T')[0];

      const [qualifications] = await db.execute(
        `
        SELECT
          sq.id,
          COALESCE(u.real_name, u.username, CONCAT('用户#', sq.user_id)) AS staff_name,
          sq.qualification_type,
          sq.qualification_name AS certificate_name,
          sq.certificate_no,
          sq.expiry_date,
          DATEDIFF(sq.expiry_date, ?) as days_remaining
        FROM staff_qualifications sq
        LEFT JOIN users u ON u.id = sq.user_id
        WHERE sq.tenant_id = ?
          AND sq.status = 'active'
          AND sq.expiry_date BETWEEN ? AND ?
        ORDER BY sq.expiry_date ASC
        `,
        [todayStr, tenantId, todayStr, futureDateStr],
      );

      return qualifications.map(q => ({
        id: `qualification_${q.id}`,
        type: this.alertTypes.QUALIFICATION_EXPIRE,
        title: '资质证书即将到期',
        content: `${q.staff_name}的${q.certificate_name}将在${q.days_remaining}天后到期`,
        urgency: q.days_remaining <= 7 ? 'high' : q.days_remaining <= 30 ? 'medium' : 'low',
        data: q,
        actionUrl: '/staff/qualifications',
        created_at: generatedAt,
      }));
    } catch (error) {
      alertTraceLog('检查资质到期预警失败:', error);
      throw new Error(`检查资质到期预警失败: ${error.message}`);
    }
  }

  /**
   * 检查特种设备检验到期预警
   */
  async checkInspectionDue(tenantId, days = 90) {
    try {
      const today = new Date();
      const futureDate = new Date();
      futureDate.setDate(today.getDate() + days);
      const generatedAt = new Date().toISOString();

      const todayStr = today.toISOString().split('T')[0];
      const futureDateStr = futureDate.toISOString().split('T')[0];

      const [equipment] = await db.execute(
        `
        SELECT 
          se.id,
          COALESCE(se.equipment_code, a.asset_code) AS equipment_code,
          COALESCE(se.equipment_name, a.asset_name) AS equipment_name,
          se.equipment_type,
          se.next_inspection_date,
          se.registration_code AS registration_no,
          DATEDIFF(se.next_inspection_date, ?) as days_remaining
        FROM special_equipment se
        LEFT JOIN assets a ON a.id = se.asset_id AND a.tenant_id = se.tenant_id
        WHERE se.tenant_id = ?
          AND se.next_inspection_date IS NOT NULL
          AND se.next_inspection_date BETWEEN ? AND ?
        ORDER BY se.next_inspection_date ASC
        `,
        [todayStr, tenantId, todayStr, futureDateStr],
      );

      return equipment.map(eq => ({
        id: `inspection_${eq.id}`,
        type: this.alertTypes.INSPECTION_DUE,
        title: '特种设备检验即将到期',
        content: `${eq.equipment_name}(${eq.equipment_code})的定期检验将在${eq.days_remaining}天后到期`,
        urgency: eq.days_remaining <= 7 ? 'high' : eq.days_remaining <= 30 ? 'medium' : 'low',
        data: eq,
        actionUrl: '/special-equipment',
        created_at: generatedAt,
      }));
    } catch (error) {
      alertTraceLog('检查检验到期预警失败:', error);
      throw new Error(`检查检验到期预警失败: ${error.message}`);
    }
  }

  /**
   * 检查安全检测到期预警
   */
  async checkSafetyExpire(tenantId, days = 30) {
    try {
      const today = new Date();
      const futureDate = new Date();
      futureDate.setDate(today.getDate() + days);
      const generatedAt = new Date().toISOString();

      const todayStr = today.toISOString().split('T')[0];
      const futureDateStr = futureDate.toISOString().split('T')[0];

      const [inspections] = await db.execute(
        `
        SELECT 
          si.id,
          si.inspection_code,
          si.inspection_name,
          si.inspection_type,
          a.asset_name,
          a.asset_code,
          si.next_inspection_date,
          DATEDIFF(si.next_inspection_date, ?) as days_remaining
        FROM safety_inspections si
        LEFT JOIN assets a ON a.id = si.asset_id AND a.tenant_id = si.tenant_id
        WHERE si.tenant_id = ?
          AND si.status != 'expired'
          AND si.next_inspection_date IS NOT NULL
          AND si.next_inspection_date BETWEEN ? AND ?
        ORDER BY si.next_inspection_date ASC
        `,
        [todayStr, tenantId, todayStr, futureDateStr],
      );

      return inspections.map(i => ({
        id: `safety_${i.id}`,
        type: this.alertTypes.SAFETY_EXPIRE,
        title: '安全检测即将到期',
        content: `${i.asset_name}的${i.inspection_name}将在${i.days_remaining}天后到期`,
        urgency: i.days_remaining <= 1 ? 'high' : i.days_remaining <= 7 ? 'medium' : 'low',
        data: i,
        actionUrl: '/safety-inspection',
        created_at: generatedAt,
      }));
    } catch (error) {
      alertTraceLog('检查安全检测到期预警失败:', error);
      throw new Error(`检查安全检测到期预警失败: ${error.message}`);
    }
  }

  /**
   * 检查开机率异常预警
   */
  async checkUptimeLow(tenantId, threshold = 95) {
    try {
      // 获取上月开机率低于阈值的设备
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      const year = lastMonth.getFullYear();
      const month = lastMonth.getMonth() + 1;
      const period = `${year}-${String(month).padStart(2, '0')}`;
      const generatedAt = new Date().toISOString();

      const [statistics] = await db.execute(
        `
        SELECT 
          us.id,
          a.asset_code,
          a.asset_name,
          YEAR(us.statistics_date) AS stat_year,
          MONTH(us.statistics_date) AS stat_month,
          us.uptime_rate,
          us.planned_hours AS total_planned_hours,
          us.actual_hours AS total_actual_hours
        FROM uptime_statistics us
        LEFT JOIN assets a ON a.id = us.asset_id AND a.tenant_id = us.tenant_id
        WHERE us.tenant_id = ?
          AND DATE_FORMAT(us.statistics_date, '%Y-%m') = ?
          AND us.uptime_rate < ?
        ORDER BY us.uptime_rate ASC
        `,
        [tenantId, period, threshold],
      );

      return statistics.map(s => ({
        id: `uptime_${s.id}`,
        type: this.alertTypes.UPTIME_LOW,
        title: '设备开机率异常',
        content: `${s.asset_name}(${s.asset_code})上月开机率为${s.uptime_rate}%，低于${threshold}%的标准`,
        urgency: s.uptime_rate < 80 ? 'high' : s.uptime_rate < 90 ? 'medium' : 'low',
        data: s,
        actionUrl: '/uptime/statistics',
        created_at: generatedAt,
      }));
    } catch (error) {
      alertTraceLog('检查开机率异常预警失败:', error);
      throw new Error(`检查开机率异常预警失败: ${error.message}`);
    }
  }

  /**
   * 获取所有预警列表
   */
  async getAllAlerts(tenantId, options = {}) {
    const {
      type,
      urgency,
      status,
      unreadOnly = false,
      page = 1,
      pageSize = 20,
      userId,
    } = options;
    const currentPage = Number(page) > 0 ? Number(page) : 1;
    const currentPageSize = Number(pageSize) > 0 ? Number(pageSize) : 20;
    const normalizedType = this.normalizeAlertType(type);
    const normalizedStatus = String(status || '').trim().toLowerCase();
    const unreadOnlyEnabled = this.normalizeBoolean(unreadOnly);
    const normalizedUserId = Number.parseInt(String(userId ?? ''), 10);

    try {
      if (type && !normalizedType) {
        return {
          success: true,
          data: [],
          pagination: {
            total: 0,
            page: currentPage,
            pageSize: currentPageSize,
            totalPages: 0,
          },
        };
      }

      let allAlerts = [];
      const errors = [];
      const runCheck = async (check, fn) => {
        try {
          return await fn();
        } catch (error) {
          alertTraceLog(`预警检查失败(${check}):`, error);
          errors.push({ check, message: error.message });
          return [];
        }
      };

      // 根据类型筛选获取预警
      if (!normalizedType || normalizedType === this.alertTypes.MAINTENANCE_DUE) {
        const maintenanceAlerts = await runCheck('maintenance_due', () =>
          this.checkMaintenanceDue(tenantId),
        );
        allAlerts = allAlerts.concat(maintenanceAlerts);
      }

      if (!normalizedType || normalizedType === this.alertTypes.QUALIFICATION_EXPIRE) {
        const qualificationAlerts = await runCheck('qualification_expire', () =>
          this.checkQualificationExpire(tenantId),
        );
        allAlerts = allAlerts.concat(qualificationAlerts);
      }

      if (!normalizedType || normalizedType === this.alertTypes.INSPECTION_DUE) {
        const inspectionAlerts = await runCheck('inspection_due', () => this.checkInspectionDue(tenantId));
        allAlerts = allAlerts.concat(inspectionAlerts);
      }

      if (!normalizedType || normalizedType === this.alertTypes.SAFETY_EXPIRE) {
        const safetyAlerts = await runCheck('safety_expire', () => this.checkSafetyExpire(tenantId));
        allAlerts = allAlerts.concat(safetyAlerts);
      }

      if (!normalizedType || normalizedType === this.alertTypes.UPTIME_LOW) {
        const uptimeAlerts = await runCheck('uptime_low', () => this.checkUptimeLow(tenantId));
        allAlerts = allAlerts.concat(uptimeAlerts);
      }

      // 按紧急程度筛选
      if (urgency) {
        allAlerts = allAlerts.filter(a => a.urgency === urgency);
      }

      if (Number.isInteger(normalizedUserId) && normalizedUserId > 0 && allAlerts.length > 0) {
        const readStateMap = await this.getReadStateMap(
          tenantId,
          normalizedUserId,
          allAlerts.map(alert => alert.id),
        );
        allAlerts = this.withReadStatus(allAlerts, readStateMap);
      } else {
        allAlerts = this.withReadStatus(allAlerts, new Map());
      }

      if (unreadOnlyEnabled) {
        allAlerts = allAlerts.filter(alert => !alert.is_read);
      }

      if (normalizedStatus === 'unread') {
        allAlerts = allAlerts.filter(alert => !alert.is_read);
      } else if (normalizedStatus === 'read') {
        allAlerts = allAlerts.filter(alert => alert.is_read && !alert.is_handled);
      } else if (normalizedStatus === 'handled') {
        allAlerts = allAlerts.filter(alert => alert.is_handled);
      } else if (normalizedStatus === 'pending' || normalizedStatus === 'unhandled') {
        allAlerts = allAlerts.filter(alert => !alert.is_handled);
      }

      // 已处理放后面，其次未读在前，再按紧急程度排序
      const urgencyOrder = { high: 0, medium: 1, low: 2 };
      allAlerts.sort((a, b) => {
        if (Boolean(a.is_handled) !== Boolean(b.is_handled)) {
          return Number(Boolean(a.is_handled)) - Number(Boolean(b.is_handled));
        }
        if (Boolean(a.is_read) !== Boolean(b.is_read)) {
          return Number(Boolean(a.is_read)) - Number(Boolean(b.is_read));
        }
        const urgencyDiff = (urgencyOrder[a.urgency] ?? 99) - (urgencyOrder[b.urgency] ?? 99);
        if (urgencyDiff !== 0) return urgencyDiff;
        const aTime = new Date(a.created_at || 0).getTime();
        const bTime = new Date(b.created_at || 0).getTime();
        return bTime - aTime;
      });

      // 分页
      const total = allAlerts.length;
      const start = (currentPage - 1) * currentPageSize;
      const end = start + currentPageSize;
      const paginatedAlerts = allAlerts.slice(start, end);

      if (errors.length > 0) {
        return {
          success: false,
          partial_failure: true,
          message: '部分预警检查失败，请查看 errors 字段',
          data: paginatedAlerts,
          errors,
          pagination: {
            total,
            page: currentPage,
            pageSize: currentPageSize,
            totalPages: Math.ceil(total / currentPageSize),
          },
        };
      }

      return {
        success: true,
        data: paginatedAlerts,
        pagination: {
          total,
          page: currentPage,
          pageSize: currentPageSize,
          totalPages: Math.ceil(total / currentPageSize),
        },
      };
    } catch (error) {
      logIntelligentAlertError('获取预警列表失败', error, {
        tenantId,
        type: type || null,
        urgency: urgency || null,
        status: status || null,
        unreadOnly: unreadOnlyEnabled,
        page: currentPage,
        pageSize: currentPageSize,
        userId: Number.isInteger(normalizedUserId) ? normalizedUserId : null,
      });
      return {
        success: false,
        message: '获取预警列表失败',
        error: error.message,
      };
    }
  }

  async markAlertAsRead(tenantId, userId, payload = {}) {
    try {
      const alertId = String(payload.alertId || '').trim();
      if (!alertId) {
        return {
          success: false,
          message: 'alertId 不能为空',
        };
      }

      const normalizedUserId = Number.parseInt(String(userId ?? ''), 10);
      if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
        return {
          success: false,
          message: '无效的用户信息',
        };
      }

      await this.ensureReadStateTable();

      const inferredType = this.normalizeAlertType(payload.type || alertId.split('_').slice(0, -1).join('_'));
      const relatedId = this.getRelatedIdFromAlertId(alertId);

      await db.execute(
        `
        INSERT INTO alert_read_states (
          tenant_id,
          user_id,
          alert_id,
          alert_type,
          related_id,
          read_at,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, NOW(), NOW(), NOW())
        ON DUPLICATE KEY UPDATE
          alert_type = VALUES(alert_type),
          related_id = VALUES(related_id),
          read_at = VALUES(read_at),
          updated_at = NOW()
        `,
        [tenantId, normalizedUserId, alertId, inferredType || 'unknown', relatedId],
      );

      return {
        success: true,
        message: '标记已读成功',
      };
    } catch (error) {
      logIntelligentAlertError('标记预警已读失败', error, {
        tenantId,
        userId,
        alertId: payload?.alertId || null,
      });
      return {
        success: false,
        message: '标记预警已读失败',
        error: error.message,
      };
    }
  }

  async markAlertAsHandled(tenantId, userId, payload = {}) {
    try {
      const alertId = String(payload.alertId || '').trim();
      if (!alertId) {
        return {
          success: false,
          message: 'alertId 不能为空',
        };
      }

      const normalizedUserId = Number.parseInt(String(userId ?? ''), 10);
      if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
        return {
          success: false,
          message: '无效的用户信息',
        };
      }

      await this.ensureReadStateTable();

      const inferredType = this.normalizeAlertType(payload.type || alertId.split('_').slice(0, -1).join('_'));
      const relatedId = this.getRelatedIdFromAlertId(alertId);
      const handlerNotes = payload.handlerNotes ? String(payload.handlerNotes).slice(0, 1000) : null;

      await db.execute(
        `
        INSERT INTO alert_read_states (
          tenant_id,
          user_id,
          alert_id,
          alert_type,
          related_id,
          read_at,
          handled_at,
          handled_by,
          handler_notes,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, NOW(), NOW(), ?, ?, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
          alert_type = VALUES(alert_type),
          related_id = VALUES(related_id),
          read_at = IFNULL(read_at, VALUES(read_at)),
          handled_at = VALUES(handled_at),
          handled_by = VALUES(handled_by),
          handler_notes = VALUES(handler_notes),
          updated_at = NOW()
        `,
        [
          tenantId,
          normalizedUserId,
          alertId,
          inferredType || 'unknown',
          relatedId,
          normalizedUserId,
          handlerNotes,
        ],
      );

      return {
        success: true,
        message: '标记已处理成功',
      };
    } catch (error) {
      logIntelligentAlertError('标记预警已处理失败', error, {
        tenantId,
        userId,
        alertId: payload?.alertId || null,
      });
      return {
        success: false,
        message: '标记预警已处理失败',
        error: error.message,
      };
    }
  }

  async markAlertAsUnhandled(tenantId, userId, payload = {}) {
    try {
      const alertId = String(payload.alertId || '').trim();
      if (!alertId) {
        return {
          success: false,
          message: 'alertId 不能为空',
        };
      }

      const normalizedUserId = Number.parseInt(String(userId ?? ''), 10);
      if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
        return {
          success: false,
          message: '无效的用户信息',
        };
      }

      await this.ensureReadStateTable();

      await db.execute(
        `
        UPDATE alert_read_states
        SET handled_at = NULL,
            handled_by = NULL,
            handler_notes = NULL,
            updated_at = NOW()
        WHERE tenant_id = ?
          AND user_id = ?
          AND alert_id = ?
        `,
        [tenantId, normalizedUserId, alertId],
      );

      return {
        success: true,
        message: '已撤销处理状态',
      };
    } catch (error) {
      logIntelligentAlertError('撤销预警处理状态失败', error, {
        tenantId,
        userId,
        alertId: payload?.alertId || null,
      });
      return {
        success: false,
        message: '撤销预警处理状态失败',
        error: error.message,
      };
    }
  }

  async markAllAlertsAsRead(tenantId, userId, options = {}) {
    try {
      const normalizedUserId = Number.parseInt(String(userId ?? ''), 10);
      if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
        return {
          success: false,
          message: '无效的用户信息',
        };
      }

      const normalizedOptions = {
        ...options,
        unreadOnly: options.unreadOnly === undefined ? true : options.unreadOnly,
      };

      const listResult = await this.getAllAlerts(tenantId, {
        ...normalizedOptions,
        userId: normalizedUserId,
        page: 1,
        pageSize: Number.MAX_SAFE_INTEGER,
      });

      if (!listResult.success && !listResult.partial_failure) {
        return listResult;
      }

      const alerts = Array.isArray(listResult.data) ? listResult.data : [];
      if (alerts.length === 0) {
        return {
          success: true,
          message: '当前筛选条件下无可标记预警',
          data: { count: 0 },
        };
      }

      await this.ensureReadStateTable();

      const sqlPlaceholders = alerts.map(() => '(?, ?, ?, ?, ?, NOW(), NOW(), NOW())').join(', ');
      const params = [];
      alerts.forEach(alert => {
        params.push(
          tenantId,
          normalizedUserId,
          alert.id,
          this.normalizeAlertType(alert.type) || 'unknown',
          this.getRelatedIdFromAlertId(alert.id),
        );
      });

      await db.execute(
        `
        INSERT INTO alert_read_states (
          tenant_id,
          user_id,
          alert_id,
          alert_type,
          related_id,
          read_at,
          created_at,
          updated_at
        ) VALUES ${sqlPlaceholders}
        ON DUPLICATE KEY UPDATE
          alert_type = VALUES(alert_type),
          related_id = VALUES(related_id),
          read_at = VALUES(read_at),
          updated_at = NOW()
        `,
        params,
      );

      return {
        success: true,
        message: `已标记 ${alerts.length} 条预警为已读`,
        data: { count: alerts.length },
      };
    } catch (error) {
      logIntelligentAlertError('批量标记预警已读失败', error, {
        tenantId,
        userId,
      });
      return {
        success: false,
        message: '批量标记预警已读失败',
        error: error.message,
      };
    }
  }

  async markAllAlertsAsHandled(tenantId, userId, options = {}) {
    try {
      const normalizedUserId = Number.parseInt(String(userId ?? ''), 10);
      if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
        return {
          success: false,
          message: '无效的用户信息',
        };
      }

      const normalizedOptions = {
        ...options,
      };
      if (!normalizedOptions.status && normalizedOptions.unreadOnly === undefined) {
        normalizedOptions.status = 'unhandled';
      }

      const handlerNotes = options.handlerNotes ? String(options.handlerNotes).slice(0, 1000) : null;

      const listResult = await this.getAllAlerts(tenantId, {
        ...normalizedOptions,
        userId: normalizedUserId,
        page: 1,
        pageSize: Number.MAX_SAFE_INTEGER,
      });

      if (!listResult.success && !listResult.partial_failure) {
        return listResult;
      }

      const alerts = Array.isArray(listResult.data) ? listResult.data : [];
      if (alerts.length === 0) {
        return {
          success: true,
          message: '当前筛选条件下无可处理预警',
          data: { count: 0 },
        };
      }

      await this.ensureReadStateTable();

      const batchSize = 500;
      for (let index = 0; index < alerts.length; index += batchSize) {
        const batch = alerts.slice(index, index + batchSize);
        const sqlPlaceholders = batch.map(() => '(?, ?, ?, ?, ?, NOW(), NOW(), ?, ?, NOW(), NOW())').join(', ');
        const params = [];

        batch.forEach(alert => {
          params.push(
            tenantId,
            normalizedUserId,
            alert.id,
            this.normalizeAlertType(alert.type) || 'unknown',
            this.getRelatedIdFromAlertId(alert.id),
            normalizedUserId,
            handlerNotes,
          );
        });

        await db.execute(
          `
          INSERT INTO alert_read_states (
            tenant_id,
            user_id,
            alert_id,
            alert_type,
            related_id,
            read_at,
            handled_at,
            handled_by,
            handler_notes,
            created_at,
            updated_at
          ) VALUES ${sqlPlaceholders}
          ON DUPLICATE KEY UPDATE
            alert_type = VALUES(alert_type),
            related_id = VALUES(related_id),
            read_at = IFNULL(read_at, VALUES(read_at)),
            handled_at = VALUES(handled_at),
            handled_by = VALUES(handled_by),
            handler_notes = VALUES(handler_notes),
            updated_at = NOW()
          `,
          params,
        );
      }

      return {
        success: true,
        message: `已标记 ${alerts.length} 条预警为已处理`,
        data: { count: alerts.length },
      };
    } catch (error) {
      logIntelligentAlertError('批量标记预警已处理失败', error, {
        tenantId,
        userId,
      });
      return {
        success: false,
        message: '批量标记预警已处理失败',
        error: error.message,
      };
    }
  }

  /**
   * 保存用户预警设置
   */
  async saveAlertSettings(tenantId, userId, settings) {
    try {
      const { maintenance, qualification, inspection, safety, uptime } = settings;

      await db.execute(
        `
        INSERT INTO alert_settings 
          (tenant_id, user_id, maintenance_threshold, qualification_threshold, 
           inspection_threshold, safety_threshold, uptime_threshold, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          maintenance_threshold = VALUES(maintenance_threshold),
          qualification_threshold = VALUES(qualification_threshold),
          inspection_threshold = VALUES(inspection_threshold),
          safety_threshold = VALUES(safety_threshold),
          uptime_threshold = VALUES(uptime_threshold),
          updated_at = VALUES(updated_at)
        `,
        [
          tenantId,
          userId,
          JSON.stringify(maintenance || this.defaultThresholds.maintenance),
          JSON.stringify(qualification || this.defaultThresholds.qualification),
          JSON.stringify(inspection || this.defaultThresholds.inspection),
          JSON.stringify(safety || this.defaultThresholds.safety),
          JSON.stringify(uptime || this.defaultThresholds.uptime),
        ],
      );

      return {
        success: true,
        message: '预警设置保存成功',
      };
    } catch (error) {
      logIntelligentAlertError('保存预警设置失败', error, { tenantId, userId });
      return {
        success: false,
        message: '保存预警设置失败',
        error: error.message,
      };
    }
  }

  /**
   * 获取用户预警设置
   */
  async getAlertSettings(tenantId, userId) {
    try {
      const [settings] = await db.execute(
        'SELECT * FROM alert_settings WHERE tenant_id = ? AND user_id = ?',
        [tenantId, userId],
      );

      if (settings.length === 0) {
        return {
          success: true,
          data: this.defaultThresholds,
        };
      }

      const s = settings[0];
      return {
        success: true,
        data: {
          maintenance: JSON.parse(s.maintenance_threshold || '{}'),
          qualification: JSON.parse(s.qualification_threshold || '{}'),
          inspection: JSON.parse(s.inspection_threshold || '{}'),
          safety: JSON.parse(s.safety_threshold || '{}'),
          uptime: JSON.parse(s.uptime_threshold || '{}'),
        },
      };
    } catch (error) {
      logIntelligentAlertError('获取预警设置失败', error, { tenantId, userId });
      return {
        success: true,
        data: this.defaultThresholds,
      };
    }
  }
}

module.exports = new IntelligentAlertService();
