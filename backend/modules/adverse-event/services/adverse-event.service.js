const db = require('../../../config/database');
const logger = require('../../../config/logger');

// 错误类型定义
const ERROR_TYPES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE_ERROR: 'DUPLICATE_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};

// 生成报告编号
function generateReportNo() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0');
  return `BLFY${year}${month}${day}${random}`;
}

// 自动判断事件等级
function calculateEventLevel(severity, eventConsequence, isSerious) {
  if (isSerious || eventConsequence === '死亡') {
    return 'I级';
  }
  if (eventConsequence === '重度伤害' || severity === '重大') {
    return 'II级';
  }
  if (eventConsequence === '中度伤害' || severity === '严重') {
    return 'III级';
  }
  return 'IV级';
}

// 计算处理时限（根据严重程度）
function calculateHandleDeadline(severity, eventLevel) {
  if (eventLevel === 'I级' || severity === '重大') {
    return 2; // 2小时
  }
  if (eventLevel === 'II级' || severity === '严重') {
    return 24; // 24小时
  }
  if (eventLevel === 'III级' || severity === '一般') {
    return 72; // 72小时
  }
  return 168; // 7天
}

class AdverseEventService {
  /**
   * 获取不良事件记录列表
   * @param {Object} params - 查询参数
   * @param {number} params.page - 页码
   * @param {number} params.pageSize - 每页大小
   * @param {string} params.report_type - 报告类型
   * @param {string} params.severity - 严重程度
   * @param {string} params.status - 状态
   * @param {string} params.reporter - 上报人
   * @param {string} params.start_date - 开始日期
   * @param {string} params.end_date - 结束日期
   * @param {string} params.keyword - 关键词
   * @param {string} params.tenantId - 租户ID
   * @param {Object} params.user - 用户对象
   * @returns {Promise<Object>} 记录列表和分页信息
   */
  async getAdverseEvents(params) {
    const {
      page = 1,
      pageSize = 20,
      report_type,
      severity,
      event_level,
      status,
      reporter,
      start_date,
      end_date,
      keyword,
      tenantId,
      user,
    } = params;

    const offset = (page - 1) * pageSize;

    let whereClause = 'WHERE ar.tenant_id = ?';
    const queryParams = [tenantId];

    // 应用部门权限过滤
    const scoped = this._applyManagedDepartmentScope(user, tenantId, whereClause, queryParams);
    whereClause = scoped.whereClause;
    queryParams.push(...scoped.additionalParams);

    if (report_type) {
      whereClause += ' AND ar.report_type = ?';
      queryParams.push(report_type);
    }

    if (severity) {
      whereClause += ' AND ar.severity = ?';
      queryParams.push(severity);
    }

    if (event_level) {
      whereClause += ' AND ar.event_level = ?';
      queryParams.push(event_level);
    }

    if (status) {
      whereClause += ' AND ar.status = ?';
      queryParams.push(status);
    }

    if (reporter) {
      whereClause += ' AND ar.reporter LIKE ?';
      queryParams.push(`%${reporter}%`);
    }

    if (start_date) {
      whereClause += ' AND ar.occurrence_date >= ?';
      queryParams.push(start_date);
    }

    if (end_date) {
      whereClause += ' AND ar.occurrence_date <= ?';
      queryParams.push(end_date);
    }

    if (keyword) {
      whereClause += ' AND (ar.report_no LIKE ? OR ar.asset_name LIKE ? OR ar.description LIKE ?)';
      const keywordParam = `%${keyword}%`;
      queryParams.push(keywordParam, keywordParam, keywordParam);
    }

    // 获取总数
    const [countResult] = await db.execute(
      `SELECT COUNT(DISTINCT ar.id) as total
       FROM adverse_reaction_records ar
       LEFT JOIN assets a ON a.asset_code = ar.asset_code AND a.tenant_id = ar.tenant_id AND a.is_deleted = 0
       ${whereClause}`,
      queryParams,
    );
    const { total } = countResult[0];

    // 获取数据
    const [rows] = await db.execute(
      `SELECT ar.*, a.department, a.department_new
       FROM adverse_reaction_records ar
       LEFT JOIN assets a ON a.asset_code = ar.asset_code AND a.tenant_id = ar.tenant_id AND a.is_deleted = 0
       ${whereClause}
       ORDER BY ar.occurrence_date DESC, ar.created_at DESC
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
   * 获取单个不良事件记录详情
   * @param {number} id - 记录ID
   * @param {string} tenantId - 租户ID
   * @param {Object} user - 用户对象
   * @returns {Promise<Object>} 记录详情
   */
  async getAdverseEventById(id, tenantId, user) {
    const scoped = this._buildScopedRecordFilter(user, tenantId, id);

    const [records] = await db.execute(
      `SELECT ar.*, a.department, a.department_new, a.brand, a.model, a.specification
       FROM adverse_reaction_records ar
       LEFT JOIN assets a ON a.asset_code = ar.asset_code AND a.tenant_id = ar.tenant_id AND a.is_deleted = 0
       ${scoped.whereClause}`,
      scoped.params,
    );

    if (records.length === 0) {
      return null;
    }

    // 获取附件
    const [attachments] = await db.execute(
      'SELECT * FROM adverse_reaction_attachments WHERE record_id = ? AND tenant_id = ? ORDER BY upload_time DESC',
      [id, tenantId],
    );

    return {
      ...records[0],
      attachments,
    };
  }

  /**
   * 创建不良事件记录
   * @param {Object} data - 记录数据
   * @param {string} tenantId - 租户ID
   * @param {Object} user - 用户对象
   * @returns {Promise<Object>} 创建结果
   */
  async createAdverseEvent(data, tenantId, user) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const {
        report_no,
        asset_id,
        report_type,
        event_category,
        severity,
        event_consequence,
        occurrence_date,
        discovery_date,
        location,
        department,
        reporter,
        reporter_phone,
        report_source,
        involved_persons,
        description,
        cause_analysis,
        cause_category,
        impact_assessment,
        handling_measures,
        prevention_measures,
        improvement_suggestions,
        status,
        is_serious,
        related_assets,
        remark,
      } = data;

      // 验证必填字段
      if (!report_type) {
        throw { status: 400, message: '报告类型不能为空', errorType: ERROR_TYPES.VALIDATION_ERROR };
      }
      if (!occurrence_date) {
        throw { status: 400, message: '发生时间不能为空', errorType: ERROR_TYPES.VALIDATION_ERROR };
      }
      if (!reporter) {
        throw { status: 400, message: '上报人不能为空', errorType: ERROR_TYPES.VALIDATION_ERROR };
      }
      if (!description) {
        throw { status: 400, message: '事件描述不能为空', errorType: ERROR_TYPES.VALIDATION_ERROR };
      }

      // 部门权限检查
      if (department) {
        const canAccess = await this._canAccessManagedDepartment(connection, user, tenantId, department);
        if (!canAccess) {
          throw {
            status: 403,
            message: '无权操作该科室的不良事件记录',
            errorType: ERROR_TYPES.VALIDATION_ERROR,
          };
        }
      }

      // 生成报告编号
      let finalReportNo = report_no;
      if (!finalReportNo) {
        finalReportNo = generateReportNo();
        let [existing] = await connection.execute(
          'SELECT id FROM adverse_reaction_records WHERE report_no = ? AND tenant_id = ?',
          [finalReportNo, tenantId],
        );
        while (existing.length > 0) {
          finalReportNo = generateReportNo();
          [existing] = await connection.execute(
            'SELECT id FROM adverse_reaction_records WHERE report_no = ? AND tenant_id = ?',
            [finalReportNo, tenantId],
          );
        }
      } else {
        const [existing] = await connection.execute(
          'SELECT id FROM adverse_reaction_records WHERE report_no = ? AND tenant_id = ?',
          [finalReportNo, tenantId],
        );
        if (existing.length > 0) {
          throw {
            status: 400,
            message: '报告编号已存在',
            errorType: ERROR_TYPES.DUPLICATE_ERROR,
          };
        }
      }

      // 获取资产信息
      let asset_code = null;
      let asset_name = null;
      if (asset_id) {
        const assetScope = this._buildScopedAssetFilter(user, tenantId, asset_id);
        const [assets] = await connection.execute(
          `SELECT a.asset_code, a.asset_name FROM assets a ${assetScope.whereClause}`,
          assetScope.params,
        );
        if (assets.length === 0) {
          throw { status: 404, message: '关联资产不存在或无权访问' };
        }
        asset_code = assets[0].asset_code;
        asset_name = assets[0].asset_name;
      }

      // 处理JSON字段
      let relatedAssetsJson = null;
      if (related_assets) {
        relatedAssetsJson =
          typeof related_assets === 'string' ? related_assets : JSON.stringify(related_assets);
      }

      let involvedPersonsJson = null;
      if (involved_persons) {
        involvedPersonsJson =
          typeof involved_persons === 'string' ? involved_persons : JSON.stringify(involved_persons);
      }

      // 自动计算事件等级和处理时限
      const finalSeverity = severity || '一般';
      const finalEventConsequence = event_consequence || '无伤害';
      const finalIsSerious = is_serious ? 1 : 0;
      const eventLevel = calculateEventLevel(finalSeverity, finalEventConsequence, finalIsSerious === 1);
      const handleDeadline = calculateHandleDeadline(finalSeverity, eventLevel);

      const createdBy = user.real_name || user.username || '系统管理员';

      const [insertResult] = await connection.execute(
        `INSERT INTO adverse_reaction_records (
          tenant_id, report_no, asset_id, asset_code, asset_name, report_type, event_category, severity,
          event_level, event_consequence, occurrence_date, discovery_date, location, department,
          reporter, reporter_phone, report_source, involved_persons, description, cause_analysis,
          cause_category, impact_assessment, handling_measures, prevention_measures,
          improvement_suggestions, status, is_serious, related_assets, handle_deadline,
          remark, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tenantId,
          finalReportNo,
          asset_id || null,
          asset_code,
          asset_name,
          report_type,
          event_category || null,
          finalSeverity,
          eventLevel,
          finalEventConsequence,
          occurrence_date,
          discovery_date || null,
          location || null,
          department || null,
          reporter,
          reporter_phone || null,
          report_source || '系统上报',
          involvedPersonsJson,
          description,
          cause_analysis || null,
          cause_category || null,
          impact_assessment || null,
          handling_measures || null,
          prevention_measures || null,
          improvement_suggestions || null,
          status || '待处理',
          finalIsSerious,
          relatedAssetsJson,
          handleDeadline,
          remark || null,
          createdBy,
        ],
      );

      // 记录工作流
      await connection.execute(
        `INSERT INTO adverse_reaction_workflow
         (tenant_id, record_id, step_name, step_type, operator, operation_time, operation_result, comment)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tenantId,
          insertResult.insertId,
          '事件上报',
          '上报',
          reporter,
          new Date(),
          '通过',
          '事件已上报，等待处理',
        ],
      );

      await connection.commit();

      return { id: insertResult.insertId, report_no: finalReportNo };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 更新不良事件记录
   * @param {number} id - 记录ID
   * @param {Object} data - 更新数据
   * @param {string} tenantId - 租户ID
   * @param {Object} user - 用户对象
   * @returns {Promise<boolean>} 更新结果
   */
  async updateAdverseEvent(id, data, tenantId, user) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const scopedRecord = this._buildScopedRecordFilter(user, tenantId, id);
      const [existing] = await connection.execute(
        `SELECT id, event_level, severity, event_consequence, is_serious, handle_deadline, status
         FROM adverse_reaction_records ar
         LEFT JOIN assets a ON a.asset_code = ar.asset_code AND a.tenant_id = ar.tenant_id AND a.is_deleted = 0
         ${scopedRecord.whereClause}`,
        scopedRecord.params,
      );

      if (existing.length === 0) {
        throw { status: 404, message: '不良事件记录不存在' };
      }

      const {
        report_no,
        asset_id,
        report_type,
        event_category,
        severity,
        event_consequence,
        occurrence_date,
        discovery_date,
        location,
        department,
        reporter,
        reporter_phone,
        report_source,
        involved_persons,
        description,
        cause_analysis,
        cause_category,
        impact_assessment,
        handling_measures,
        prevention_measures,
        improvement_suggestions,
        status,
        handler,
        handle_date,
        handle_result,
        reviewer,
        review_date,
        review_comment,
        is_serious,
        related_assets,
        remark,
      } = data;

      // 检查报告编号唯一性
      if (report_no) {
        const [sameNo] = await connection.execute(
          'SELECT id FROM adverse_reaction_records WHERE report_no = ? AND id != ? AND tenant_id = ?',
          [report_no, id, tenantId],
        );
        if (sameNo.length > 0) {
          throw { status: 400, message: '报告编号已被其他记录使用' };
        }
      }

      // 部门权限检查
      if (department !== undefined) {
        const nextDepartment = department === '' ? null : department;
        const canAccess = await this._canAccessManagedDepartment(connection, user, tenantId, nextDepartment);
        if (!canAccess) {
          throw {
            status: 403,
            message: '无权操作该科室的不良事件记录',
            errorType: ERROR_TYPES.VALIDATION_ERROR,
          };
        }
      }

      // 获取资产信息
      let asset_code = null;
      let asset_name = null;
      if (asset_id) {
        const assetScope = this._buildScopedAssetFilter(user, tenantId, asset_id);
        const [assets] = await connection.execute(
          `SELECT a.asset_code, a.asset_name FROM assets a ${assetScope.whereClause}`,
          assetScope.params,
        );
        if (assets.length === 0) {
          throw { status: 404, message: '关联资产不存在或无权访问' };
        }
        asset_code = assets[0].asset_code;
        asset_name = assets[0].asset_name;
      }

      // 处理JSON字段
      let relatedAssetsJson = null;
      if (related_assets !== undefined) {
        relatedAssetsJson =
          related_assets === null || related_assets === ''
            ? null
            : typeof related_assets === 'string'
              ? related_assets
              : JSON.stringify(related_assets);
      }

      let involvedPersonsJson = null;
      if (involved_persons !== undefined) {
        involvedPersonsJson =
          involved_persons === null || involved_persons === ''
            ? null
            : typeof involved_persons === 'string'
              ? involved_persons
              : JSON.stringify(involved_persons);
      }

      // 自动计算事件等级
      let eventLevel = existing[0].event_level;
      if (severity || event_consequence !== undefined || is_serious !== undefined) {
        const finalSeverity = severity || existing[0].severity || '一般';
        const finalEventConsequence =
          event_consequence !== undefined ? event_consequence : existing[0].event_consequence || '无伤害';
        const finalIsSerious = is_serious !== undefined ? (is_serious ? 1 : 0) : existing[0].is_serious;
        eventLevel = calculateEventLevel(finalSeverity, finalEventConsequence, finalIsSerious === 1);
      }

      // 自动计算处理时限
      let handleDeadline = existing[0].handle_deadline;
      if (severity || eventLevel !== existing[0].event_level) {
        const finalSeverity = severity || existing[0].severity || '一般';
        handleDeadline = calculateHandleDeadline(finalSeverity, eventLevel);
      }

      // 检查是否超时
      let isOverdue = 0;
      if (handleDeadline && occurrence_date) {
        const hoursPassed = Math.floor((new Date() - new Date(occurrence_date)) / (1000 * 60 * 60));
        if (
          hoursPassed > handleDeadline &&
          ['待处理', '处理中'].includes(status || existing[0].status)
        ) {
          isOverdue = 1;
        }
      }

      await connection.execute(
        `UPDATE adverse_reaction_records SET
          report_no = COALESCE(?, report_no),
          asset_id = ?,
          asset_code = ?,
          asset_name = ?,
          report_type = COALESCE(?, report_type),
          event_category = ?,
          severity = COALESCE(?, severity),
          event_level = ?,
          event_consequence = COALESCE(?, event_consequence),
          occurrence_date = COALESCE(?, occurrence_date),
          discovery_date = ?,
          location = ?,
          department = ?,
          reporter = COALESCE(?, reporter),
          reporter_phone = ?,
          report_source = COALESCE(?, report_source),
          involved_persons = ?,
          description = COALESCE(?, description),
          cause_analysis = ?,
          cause_category = ?,
          impact_assessment = ?,
          handling_measures = ?,
          prevention_measures = ?,
          improvement_suggestions = ?,
          status = COALESCE(?, status),
          handler = ?,
          handle_date = ?,
          handle_result = ?,
          reviewer = ?,
          review_date = ?,
          review_comment = ?,
          is_serious = ?,
          related_assets = ?,
          handle_deadline = ?,
          is_overdue = ?,
          remark = ?,
          updated_at = NOW()
        WHERE id = ? AND tenant_id = ?`,
        [
          report_no,
          asset_id || null,
          asset_code,
          asset_name,
          report_type,
          event_category !== undefined ? event_category : null,
          severity,
          eventLevel,
          event_consequence !== undefined ? event_consequence : null,
          occurrence_date,
          discovery_date || null,
          location || null,
          department || null,
          reporter,
          reporter_phone || null,
          report_source !== undefined ? report_source : null,
          involvedPersonsJson,
          description,
          cause_analysis || null,
          cause_category !== undefined ? cause_category : null,
          impact_assessment || null,
          handling_measures || null,
          prevention_measures || null,
          improvement_suggestions !== undefined ? improvement_suggestions : null,
          status,
          handler || null,
          handle_date || null,
          handle_result || null,
          reviewer || null,
          review_date || null,
          review_comment || null,
          is_serious !== undefined ? (is_serious ? 1 : 0) : undefined,
          relatedAssetsJson,
          handleDeadline !== undefined ? handleDeadline : null,
          isOverdue,
          remark || null,
          id,
          tenantId,
        ],
      );

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 删除不良事件记录
   * @param {number} id - 记录ID
   * @param {string} tenantId - 租户ID
   * @param {Object} user - 用户对象
   * @returns {Promise<boolean>} 删除结果
   */
  async deleteAdverseEvent(id, tenantId, user) {
    const connection = await db.getConnection();
    const fs = require('fs');
    const path = require('path');
    try {
      await connection.beginTransaction();

      const scopedRecord = this._buildScopedRecordFilter(user, tenantId, id);
      const [existing] = await connection.execute(
        `SELECT ar.id
         FROM adverse_reaction_records ar
         LEFT JOIN assets a ON a.asset_code = ar.asset_code AND a.tenant_id = ar.tenant_id AND a.is_deleted = 0
         ${scopedRecord.whereClause}`,
        scopedRecord.params,
      );

      if (existing.length === 0) {
        throw { status: 404, message: '不良事件记录不存在' };
      }

      // 删除附件文件
      const [attachments] = await connection.execute(
        'SELECT file_path FROM adverse_reaction_attachments WHERE record_id = ? AND tenant_id = ?',
        [id, tenantId],
      );
      for (const attachment of attachments) {
        const filePath = path.join(__dirname, '../../..', attachment.file_path.replace('/uploads/', 'uploads/'));
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      // 删除记录
      await connection.execute('DELETE FROM adverse_reaction_records WHERE id = ? AND tenant_id = ?', [
        id,
        tenantId,
      ]);

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 审批不良事件
   * @param {number} id - 记录ID
   * @param {Object} data - 审批数据
   * @param {string} tenantId - 租户ID
   * @param {Object} user - 用户对象
   * @returns {Promise<Object>} 审批结果
   */
  async approveAdverseEvent(id, data, tenantId, user) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const { approved, comment, next_handler } = data;

      const scopedRecord = this._buildScopedRecordFilter(user, tenantId, id);
      const [records] = await connection.execute(
        `SELECT ar.*
         FROM adverse_reaction_records ar
         LEFT JOIN assets a ON a.asset_code = ar.asset_code AND a.tenant_id = ar.tenant_id AND a.is_deleted = 0
         ${scopedRecord.whereClause}`,
        scopedRecord.params,
      );

      if (records.length === 0) {
        throw { status: 404, message: '不良事件记录不存在' };
      }

      const record = records[0];

      if (!['待处理', '处理中'].includes(record.status)) {
        throw {
          status: 400,
          message: `该记录已处理，当前状态：${record.status}`,
        };
      }

      const operator = user.real_name || user.username || '系统管理员';
      const operationTime = new Date();

      let newStatus = record.status;
      let operationResult = '通过';

      if (approved === false) {
        operationResult = '拒绝';
        newStatus = '待处理';
      } else if (record.status === '待处理') {
        newStatus = '处理中';
      } else if (record.status === '处理中') {
        newStatus = '已处理';
      }

      await connection.execute(
        `UPDATE adverse_reaction_records SET
          status = ?,
          reviewer = ?,
          review_date = ?,
          review_comment = ?,
          handler = COALESCE(?, handler),
          updated_at = NOW()
        WHERE id = ? AND tenant_id = ?`,
        [newStatus, operator, operationTime, comment || null, next_handler || null, id, tenantId],
      );

      // 记录工作流
      await connection.execute(
        `INSERT INTO adverse_reaction_workflow
         (tenant_id, record_id, step_name, step_type, operator, operation_time, operation_result, comment, next_handler)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tenantId,
          id,
          approved ? '审批通过' : '审批拒绝',
          '审核',
          operator,
          operationTime,
          operationResult,
          comment || null,
          next_handler || null,
        ],
      );

      await connection.commit();

      return { status: newStatus };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 关闭不良事件
   * @param {number} id - 记录ID
   * @param {string} closeReason - 关闭原因
   * @param {string} tenantId - 租户ID
   * @param {Object} user - 用户对象
   * @returns {Promise<boolean>} 关闭结果
   */
  async closeAdverseEvent(id, closeReason, tenantId, user) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const scopedRecord = this._buildScopedRecordFilter(user, tenantId, id);
      const [records] = await connection.execute(
        `SELECT ar.*
         FROM adverse_reaction_records ar
         LEFT JOIN assets a ON a.asset_code = ar.asset_code AND a.tenant_id = ar.tenant_id AND a.is_deleted = 0
         ${scopedRecord.whereClause}`,
        scopedRecord.params,
      );

      if (records.length === 0) {
        throw { status: 404, message: '不良事件记录不存在' };
      }

      const operator = user.real_name || user.username || '系统管理员';
      const operationTime = new Date();

      await connection.execute(
        `UPDATE adverse_reaction_records SET
          status = '已关闭',
          close_reason = ?,
          updated_at = NOW()
        WHERE id = ? AND tenant_id = ?`,
        [closeReason || null, id, tenantId],
      );

      // 记录工作流
      await connection.execute(
        `INSERT INTO adverse_reaction_workflow
         (tenant_id, record_id, step_name, step_type, operator, operation_time, operation_result, comment)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [tenantId, id, '关闭事件', '关闭', operator, operationTime, '完成', closeReason || null],
      );

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 获取工作流记录
   * @param {number} id - 记录ID
   * @param {string} tenantId - 租户ID
   * @param {Object} user - 用户对象
   * @returns {Promise<Array>} 工作流记录列表
   */
  async getWorkflow(id, tenantId, user) {
    const scopedRecord = this._buildScopedRecordFilter(user, tenantId, id);
    const [records] = await db.execute(
      `SELECT ar.id
       FROM adverse_reaction_records ar
       LEFT JOIN assets a ON a.asset_code = ar.asset_code AND a.tenant_id = ar.tenant_id AND a.is_deleted = 0
       ${scopedRecord.whereClause}`,
      scopedRecord.params,
    );

    if (records.length === 0) {
      throw { status: 404, message: '不良事件记录不存在' };
    }

    const [workflow] = await db.execute(
      `SELECT * FROM adverse_reaction_workflow
       WHERE record_id = ? AND tenant_id = ?
       ORDER BY operation_time ASC`,
      [id, tenantId],
    );

    return workflow;
  }

  /**
   * 获取统计数据
   * @param {Object} params - 查询参数
   * @param {string} params.start_date - 开始日期
   * @param {string} params.end_date - 结束日期
   * @param {string} params.tenantId - 租户ID
   * @param {Object} params.user - 用户对象
   * @returns {Promise<Object>} 统计数据
   */
  async getStatistics(params) {
    const { start_date, end_date, tenantId, user } = params;

    let whereClause = 'WHERE ar.tenant_id = ?';
    const queryParams = [tenantId];

    const scoped = this._applyManagedDepartmentScope(user, tenantId, whereClause, queryParams);
    whereClause = scoped.whereClause;
    queryParams.push(...scoped.additionalParams);

    if (start_date) {
      whereClause += ' AND occurrence_date >= ?';
      queryParams.push(start_date);
    }

    if (end_date) {
      whereClause += ' AND occurrence_date <= ?';
      queryParams.push(end_date);
    }

    // 总体统计
    const [totalStats] = await db.execute(
      `SELECT
        COUNT(*) as total_count,
        SUM(CASE WHEN is_serious = 1 THEN 1 ELSE 0 END) as serious_count,
        SUM(CASE WHEN is_overdue = 1 THEN 1 ELSE 0 END) as overdue_count,
        SUM(CASE WHEN status = '待处理' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN status = '处理中' THEN 1 ELSE 0 END) as processing_count,
        SUM(CASE WHEN status = '已处理' THEN 1 ELSE 0 END) as handled_count,
        SUM(CASE WHEN status = '已关闭' THEN 1 ELSE 0 END) as closed_count
       FROM adverse_reaction_records ar
       ${whereClause}`,
      queryParams,
    );

    // 按类型统计
    const [typeStats] = await db.execute(
      `SELECT
        report_type,
        COUNT(*) as count
       FROM adverse_reaction_records ar
       ${whereClause}
       GROUP BY report_type`,
      queryParams,
    );

    // 按严重程度统计
    const [severityStats] = await db.execute(
      `SELECT
        severity,
        COUNT(*) as count
       FROM adverse_reaction_records ar
       ${whereClause}
       GROUP BY severity`,
      queryParams,
    );

    // 按事件等级统计
    const [levelStats] = await db.execute(
      `SELECT
        event_level,
        COUNT(*) as count
       FROM adverse_reaction_records ar
       ${whereClause}
       GROUP BY event_level`,
      queryParams,
    );

    // 按月统计趋势
    const [monthlyStats] = await db.execute(
      `SELECT
        DATE_FORMAT(occurrence_date, '%Y-%m') as month,
        COUNT(*) as count
       FROM adverse_reaction_records ar
       ${whereClause}
       GROUP BY month
       ORDER BY month DESC
       LIMIT 12`,
      queryParams,
    );

    return {
      total: totalStats[0],
      byType: typeStats,
      bySeverity: severityStats,
      byLevel: levelStats,
      monthly: monthlyStats,
    };
  }

  /**
   * 获取按科室统计
   */
  async getStatisticsByDepartment(params) {
    const { start_date, end_date, tenantId, user } = params;
    let whereClause = 'WHERE ar.tenant_id = ?';
    const queryParams = [tenantId];
    const scoped = this._applyManagedDepartmentScope(user, tenantId, whereClause, queryParams);
    whereClause = scoped.whereClause;
    queryParams.push(...scoped.additionalParams);

    if (start_date) {
      whereClause += ' AND occurrence_date >= ?';
      queryParams.push(start_date);
    }
    if (end_date) {
      whereClause += ' AND occurrence_date <= ?';
      queryParams.push(end_date);
    }

    const [rows] = await db.execute(
      `SELECT
        COALESCE(ar.department, '未知') as department,
        COUNT(*) as count,
        SUM(CASE WHEN is_serious = 1 THEN 1 ELSE 0 END) as serious_count,
        SUM(CASE WHEN status = '待处理' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN status IN ('已处理','已关闭') THEN 1 ELSE 0 END) as handled_count
       FROM adverse_reaction_records ar
       ${whereClause}
       GROUP BY ar.department
       ORDER BY count DESC`,
      queryParams,
    );
    return rows;
  }

  /**
   * 获取按资产统计 TOP N
   */
  async getStatisticsByAsset(params) {
    const { start_date, end_date, limit = 10, tenantId, user } = params;
    let whereClause = 'WHERE ar.tenant_id = ? AND ar.asset_code IS NOT NULL';
    const queryParams = [tenantId];
    const scoped = this._applyManagedDepartmentScope(user, tenantId, whereClause, queryParams);
    whereClause = scoped.whereClause;
    queryParams.push(...scoped.additionalParams);

    if (start_date) {
      whereClause += ' AND occurrence_date >= ?';
      queryParams.push(start_date);
    }
    if (end_date) {
      whereClause += ' AND occurrence_date <= ?';
      queryParams.push(end_date);
    }

    const [rows] = await db.execute(
      `SELECT
        ar.asset_id, ar.asset_code, ar.asset_name,
        COUNT(*) as count,
        SUM(CASE WHEN ar.is_serious = 1 THEN 1 ELSE 0 END) as serious_count,
        MAX(ar.occurrence_date) as last_occurrence
       FROM adverse_reaction_records ar
       ${whereClause}
       GROUP BY ar.asset_id, ar.asset_code, ar.asset_name
       ORDER BY count DESC
       LIMIT ?`,
      [...queryParams, parseInt(limit)],
    );
    return rows;
  }

  /**
   * 获取处理效率统计
   */
  async getHandleEfficiency(params) {
    const { start_date, end_date, tenantId, user } = params;
    let whereClause = 'WHERE ar.tenant_id = ?';
    const queryParams = [tenantId];
    const scoped = this._applyManagedDepartmentScope(user, tenantId, whereClause, queryParams);
    whereClause = scoped.whereClause;
    queryParams.push(...scoped.additionalParams);

    if (start_date) {
      whereClause += ' AND ar.occurrence_date >= ?';
      queryParams.push(start_date);
    }
    if (end_date) {
      whereClause += ' AND ar.occurrence_date <= ?';
      queryParams.push(end_date);
    }

    const [stats] = await db.execute(
      `SELECT
        COUNT(*) as total_handled,
        AVG(
          CASE
            WHEN ar.handle_date IS NOT NULL AND ar.occurrence_date IS NOT NULL
            THEN TIMESTAMPDIFF(HOUR, ar.occurrence_date, ar.handle_date)
            ELSE NULL
          END
        ) as avg_handle_hours,
        SUM(CASE WHEN ar.is_overdue = 1 THEN 1 ELSE 0 END) as overdue_count,
        SUM(CASE WHEN ar.status = '待处理' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN ar.status = '处理中' THEN 1 ELSE 0 END) as processing_count,
        SUM(CASE WHEN ar.status IN ('已处理','已关闭') THEN 1 ELSE 0 END) as completed_count
       FROM adverse_reaction_records ar
       ${whereClause}
       AND (ar.handle_date IS NOT NULL OR ar.status IN ('已处理','已关闭'))`,
      queryParams,
    );
    return stats[0] || {};
  }

  /**
   * 获取超时提醒列表
   * @param {string} tenantId - 租户ID
   * @param {Object} user - 用户对象
   * @returns {Promise<Array>} 超时记录列表
   */
  async getOverdueAlerts(tenantId, user) {
    let whereClause = `WHERE ar.tenant_id = ?
       AND ar.status IN ('待处理', '处理中')
       AND (
         (handle_deadline IS NOT NULL AND TIMESTAMPDIFF(HOUR, occurrence_date, NOW()) > handle_deadline)
         OR (handle_deadline IS NULL AND TIMESTAMPDIFF(HOUR, occurrence_date, NOW()) > 72)
       )`;
    const queryParams = [tenantId];

    const scoped = this._applyManagedDepartmentScope(user, tenantId, whereClause, queryParams);
    whereClause = scoped.whereClause;
    queryParams.push(...scoped.additionalParams);

    const [overdue] = await db.execute(
      `SELECT ar.*,
        TIMESTAMPDIFF(HOUR, occurrence_date, NOW()) as hours_passed,
        handle_deadline
       FROM adverse_reaction_records ar
       ${whereClause}
       ORDER BY occurrence_date ASC
       LIMIT 50`,
      queryParams,
    );

    return overdue;
  }

  // ==================== 私有辅助方法 ====================

  _hasTenantWideAccess(user) {
    return (
      user?.role === 'super_admin' ||
      user?.role === 'system_admin' ||
      user?.has_all_departments === true ||
      (Array.isArray(user?.managed_departments) && user.managed_departments.includes('*'))
    );
  }

  _getManagedDepartmentCodes(user) {
    return Array.isArray(user?.managed_departments)
      ? user.managed_departments.filter(code => code && code !== '*')
      : [];
  }

  _applyManagedDepartmentScope(user, tenantId, whereClause, params) {
    if (this._hasTenantWideAccess(user)) {
      return { whereClause, additionalParams: [] };
    }

    const managedDepartments = this._getManagedDepartmentCodes(user);

    if (managedDepartments.length === 0) {
      return {
        whereClause: `${whereClause} AND 1 = 0`,
        additionalParams: [],
      };
    }

    const placeholders = managedDepartments.map(() => '?').join(',');
    let scopedWhereClause = `${whereClause} AND (`;
    const additionalParams = [];

    scopedWhereClause += `ar.department IN (
      SELECT department_name FROM departments
      WHERE tenant_id = ? AND department_code IN (${placeholders})
    ) OR ar.department IN (${placeholders})`;
    additionalParams.push(tenantId, ...managedDepartments, ...managedDepartments);

    scopedWhereClause += ')';
    return { whereClause: scopedWhereClause, additionalParams };
  }

  _buildScopedRecordFilter(user, tenantId, recordId) {
    const whereClause = 'WHERE ar.id = ? AND ar.tenant_id = ?';
    const params = [recordId, tenantId];
    const scoped = this._applyManagedDepartmentScope(user, tenantId, whereClause, params);
    return { whereClause: scoped.whereClause, params: [...params, ...scoped.additionalParams] };
  }

  _buildScopedAssetFilter(user, tenantId, assetCode, assetAlias = 'a') {
    const whereClause = `WHERE ${assetAlias}.asset_code = ? AND ${assetAlias}.tenant_id = ? AND ${assetAlias}.is_deleted = 0`;
    const params = [assetCode, tenantId];
    const scoped = this._applyManagedDepartmentScope(user, tenantId, whereClause, params);
    return { whereClause: scoped.whereClause, params: [...params, ...scoped.additionalParams] };
  }

  async _canAccessManagedDepartment(executor, user, tenantId, department) {
    if (!department || this._hasTenantWideAccess(user)) {
      return true;
    }

    const managedDepartments = this._getManagedDepartmentCodes(user);
    if (managedDepartments.length === 0) {
      return false;
    }

    if (managedDepartments.includes(department)) {
      return true;
    }

    const placeholders = managedDepartments.map(() => '?').join(',');
    const [rows] = await executor.execute(
      `SELECT 1
       FROM departments
       WHERE tenant_id = ? AND department_name = ? AND department_code IN (${placeholders})
       LIMIT 1`,
      [tenantId, department, ...managedDepartments],
    );

    return rows.length > 0;
  }
}

module.exports = new AdverseEventService();
