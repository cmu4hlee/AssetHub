const path = require('path');
const fs = require('fs');
const db = require('../../config/database');
const { addTenantFilter, getTenantId } = require('../../middleware/tenant-filter');
const { decodeOriginalFileName } = require('../../utils/filename');
const workordersService = require('./workorders.service');
const { publishAsync } = require('../../core/EventBus');

// 维修申请生命周期事件名
const RQ_EVENTS = {
  CREATED: 'maintenance_request:created',
  APPROVED: 'maintenance_request:approved',
  REJECTED: 'maintenance_request:rejected',
  STARTED: 'maintenance_request:started',
  COMPLETED: 'maintenance_request:completed',
  CANCELLED: 'maintenance_request:cancelled',
};

// 工程师角色（与工单、飞书通知保持一致）
const ENGINEER_ROLES = ['maintenance_admin', 'maintenance_engineer'];

// 异步发布事件，失败不影响主流程
function emitEvent(event, payload) {
  publishAsync(event, payload).catch(err =>
    console.error(`[维修申请] 发布事件 ${event} 失败:`, err.message)
  );
}

const REQUEST_ATTACHMENT_DIR = path.join(__dirname, '../../uploads/maintenance-request-attachments');

function ensureRequestAttachmentDir() {
  if (!fs.existsSync(REQUEST_ATTACHMENT_DIR)) {
    fs.mkdirSync(REQUEST_ATTACHMENT_DIR, { recursive: true });
  }
  return REQUEST_ATTACHMENT_DIR;
}

function generateRequestNo() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0');
  return `WX${year}${month}${day}${random}`;
}

function pickFirstDefined(...values) {
  return values.find(value => value !== undefined);
}

async function getRequests(query, req) {
  const {
    page = 1,
    pageSize = 20,
    asset_code,
    status,
    fault_level,
    start_date,
    end_date,
    keyword,
  } = query;
  const offset = (page - 1) * pageSize;

  let whereClause = 'WHERE 1=1';
  const params = [];

  const tenantFilter = addTenantFilter(req, 'mr');
  whereClause += tenantFilter.whereClause;
  params.push(...tenantFilter.params);

  if (req.user.role !== 'super_admin' && req.user.role !== 'system_admin') {
    if (
      req.user.managed_departments &&
      Array.isArray(req.user.managed_departments) &&
      req.user.managed_departments.length > 0
    ) {
      try {
        if (!req.user.managed_departments.includes('*')) {
          const placeholders = req.user.managed_departments.map(() => '?').join(',');
          const [deptRows] = await db.execute(
            `SELECT department_name FROM departments WHERE department_code IN (${placeholders})`,
            req.user.managed_departments
          );

          const deptNames = deptRows.map(row => row.department_name);

          if (deptNames.length > 0) {
            const deptPlaceholders = deptNames.map(() => '?').join(',');
            whereClause += ` AND EXISTS (
              SELECT 1 FROM assets a
              WHERE a.asset_code = mr.asset_code
              AND (a.department IN (${deptPlaceholders}) OR a.department_new IN (${deptPlaceholders}))
            )`;
            params.push(...deptNames, ...deptNames);
          }
        }
      } catch (deptError) {
        console.error('查询管理科室失败:', deptError);
      }
    }
  }

  if (asset_code) {
    whereClause += ' AND mr.asset_code LIKE ?';
    params.push(`%${asset_code}%`);
  }
  if (status) {
    whereClause += ' AND mr.status = ?';
    params.push(status);
  }
  if (fault_level) {
    whereClause += ' AND mr.fault_level = ?';
    params.push(fault_level);
  }
  if (start_date) {
    whereClause += ' AND mr.request_date >= ?';
    params.push(start_date);
  }
  if (end_date) {
    whereClause += ' AND mr.request_date <= ?';
    params.push(end_date);
  }
  if (keyword) {
    whereClause +=
      ' AND (mr.request_no LIKE ? OR mr.asset_code LIKE ? OR mr.asset_name LIKE ? OR mr.request_person LIKE ?)';
    const keywordParam = `%${keyword}%`;
    params.push(keywordParam, keywordParam, keywordParam, keywordParam);
  }

  const [countResult] = await db.execute(
    `SELECT COUNT(*) as total FROM maintenance_requests mr ${whereClause}`,
    params
  );
  const total = countResult[0].total;

  const [rows] = await db.execute(
    `SELECT mr.*, a.department, a.location
     FROM maintenance_requests mr
     LEFT JOIN assets a ON mr.asset_code = a.asset_code
     ${whereClause}
     ORDER BY mr.request_date DESC, mr.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, parseInt(pageSize, 10), offset]
  );

  return {
    success: true,
    data: rows,
    pagination: {
      page: parseInt(page, 10),
      pageSize: parseInt(pageSize, 10),
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

async function getRequest(id, req) {
  const tenantFilter = addTenantFilter(req, 'mr');
  const [rows] = await db.execute(
    `SELECT mr.*, a.department, a.location, a.brand, a.model
     FROM maintenance_requests mr
     LEFT JOIN assets a ON mr.asset_code = a.asset_code
     WHERE mr.id = ? ${tenantFilter.whereClause}`,
    [id, ...tenantFilter.params]
  );

  if (rows.length === 0) {
    return {
      statusCode: 404,
      body: { success: false, message: '故障维修申请不存在' },
    };
  }

  return {
    statusCode: 200,
    body: { success: true, data: rows[0] },
  };
}

async function createRequest(body, req) {
  const assetCode = body.asset_code;
  const faultDescription = pickFirstDefined(body.fault_description, body.description);
  const faultLevel = body.fault_level;
  const requestDate = body.request_date;
  const requestDepartment = pickFirstDefined(body.request_department, body.department);
  const contactPhone = body.contact_phone;
  const expectedRepairDate = pickFirstDefined(body.expected_repair_date, body.expected_completion);
  const remark = body.remark;

  if (!assetCode || !faultDescription) {
    return {
      statusCode: 400,
      body: { success: false, message: '资产编号和故障描述不能为空' },
    };
  }

  const assetTenantFilter = addTenantFilter(req, 'a');
  const [assets] = await db.execute(
    `SELECT a.id, a.asset_code, a.asset_name FROM assets a WHERE a.asset_code = ? ${assetTenantFilter.whereClause}`,
    [assetCode, ...assetTenantFilter.params]
  );

  if (assets.length === 0) {
    return {
      statusCode: 404,
      body: { success: false, message: '资产不存在' },
    };
  }

  const asset = assets[0];
  const tenantId = getTenantId(req);

  // 检查同一资产是否已有进行中的维修申请，防止重复报修
  const [pendingRequests] = await db.execute(
    `SELECT id, request_no, status FROM maintenance_requests
     WHERE asset_code = ? AND status IN (?, ?, ?) AND tenant_id = ?
     ORDER BY id DESC LIMIT 1`,
    [asset.asset_code, '待审批', '已批准', '维修中', tenantId]
  );
  if (pendingRequests.length > 0) {
    const pending = pendingRequests[0];
    return {
      statusCode: 409,
      body: {
        success: false,
        message: `资产「${asset.asset_code}」已有进行中的维修申请（${pending.request_no}，状态：${pending.status}），请勿重复报修`,
        data: { existing_request_id: pending.id, existing_request_no: pending.request_no, status: pending.status },
      },
    };
  }

  const requestNo = generateRequestNo();
  const requestPerson = req.user.real_name || req.user.username || '系统管理员';
  const requestPersonId = req.user.id || null;
  const createdBy = requestPerson;

  const [result] = await db.execute(
    `INSERT INTO maintenance_requests (
      tenant_id, request_no, asset_code, asset_name, fault_description,
      fault_level, request_date, request_person, request_person_id, request_department,
      contact_phone, expected_repair_date, status, remark, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tenantId,
      requestNo,
      asset.asset_code,
      asset.asset_name,
      faultDescription,
      faultLevel || '一般',
      requestDate || new Date().toISOString().split('T')[0],
      requestPerson,
      requestPersonId,
      requestDepartment || null,
      contactPhone || null,
      expectedRepairDate || null,
      '待审批',
      remark || null,
      createdBy,
    ]
  );

  // 发布「维修申请创建」事件 → 飞书/WebSocket 通知审批人
  emitEvent(RQ_EVENTS.CREATED, {
    id: result.insertId,
    requestNo,
    asset_code: asset.asset_code,
    asset_name: asset.asset_name,
    fault_level: faultLevel || '一般',
    fault_description: faultDescription,
    request_person: requestPerson,
    request_person_id: requestPersonId,
    tenantId,
  });

  return {
    statusCode: 200,
    body: {
      success: true,
      message: '故障维修申请创建成功',
      data: { id: result.insertId, request_no: requestNo },
    },
  };
}

async function approveRequest(id, body, req) {
  const { approved, comment, assigned_to } = body;

  if (approved === undefined) {
    return {
      statusCode: 400,
      body: { success: false, message: '审批结果不能为空' },
    };
  }

  const tenantId = getTenantId(req);
  const tenantFilter = addTenantFilter(req, 'mr');
  const [requests] = await db.execute(
    `SELECT mr.* FROM maintenance_requests mr WHERE mr.id = ? ${tenantFilter.whereClause}`,
    [id, ...tenantFilter.params]
  );

  if (requests.length === 0) {
    return {
      statusCode: 404,
      body: { success: false, message: '故障维修申请不存在' },
    };
  }

  const request = requests[0];

  if (request.status !== '待审批') {
    return {
      statusCode: 400,
      body: { success: false, message: '该申请已处理，无法重复审批' },
    };
  }

  const approver = req.user.real_name || req.user.username || '系统管理员';
  const status = approved ? '已批准' : '已拒绝';

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    await connection.execute(
      `UPDATE maintenance_requests mr SET
        mr.status = ?,
        mr.approver = ?,
        mr.approve_date = ?,
        mr.approve_comment = ?,
        mr.updated_at = NOW()
      WHERE mr.id = ? ${tenantFilter.whereClause.replace('WHERE', 'AND')}`,
      [status, approver, new Date().toISOString().split('T')[0], comment || null, id, ...tenantFilter.params]
    );

    if (approved) {
      const assetTenantFilter = addTenantFilter(req, 'a');
      await connection.execute(
        `UPDATE assets a SET a.status = ? WHERE a.asset_code = ? ${assetTenantFilter.whereClause.replace('WHERE', 'AND')}`,
        ['维修', request.asset_code, ...assetTenantFilter.params]
      );
    }

    await connection.commit();

    // 审批通过：自动生成对应的维修工单（source_type='fault'），并与申请双向关联
    if (approved && !request.work_order_id) {
      try {
        const priorityMap = { '一般': 'normal', '紧急': 'high', '严重': 'urgent' };
        // 审批时直接派工: assigned_to 工程师, 工单状态从 'pending' 跳过 'assigned' 直接到 'in_progress'
        // 用户期望审批 + 派工合二为一, 不再分两步
        const workOrderPayload = {
          asset_code: request.asset_code,
          asset_name: request.asset_name,
          source_type: 'fault',
          title: `维修申请-${request.request_no}`,
          description: request.fault_description || null,
          priority: priorityMap[request.fault_level] || 'normal',
          maintenance_request_id: request.id,
          created_by: request.request_person,
        };
        if (assigned_to && typeof assigned_to === 'string' && assigned_to.trim()) {
          workOrderPayload.assigned_to = assigned_to.trim();
        }
        const woResult = await workordersService.createWorkOrder(workOrderPayload, req);
        const woId = woResult && woResult.data && woResult.data.id;
        if (woId) {
          // 若审批即派工，直接把工单推进到 in_progress（跳开 assigned）
          if (assigned_to && assigned_to.trim()) {
            await db.execute(
              "UPDATE work_orders SET status = 'in_progress', started_at = ? WHERE id = ? AND tenant_id = ?",
              [new Date(), woId, tenantId]
            );
            await db.execute(
              `INSERT INTO work_order_history (work_order_id, action_type, action_description, action_by, action_at)
               VALUES (?, ?, ?, ?, ?)`,
              [woId, 'start', '审批通过并开工', approver, new Date()]
            );
          }

          // 派了工单的, 申请直接进入 '维修中' (跳过中间 '已批准' 状态)
          // 没派工的, 保持 '已批准' 等后续手动派工
          const newRequestStatus = assigned_to ? '维修中' : '已批准';
          await db.execute(
            'UPDATE maintenance_requests SET work_order_id = ?, status = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?',
            [woId, newRequestStatus, request.id, tenantId],
          );
        }
      } catch (woErr) {
        console.error('[维修申请] 审批通过自动生成工单失败:', woErr.message);
      }
    }

    // 发布审批事件 → 飞书/WebSocket 通知申请人
    const eventPayload = {
      request: {
        id: request.id,
        request_no: request.request_no,
        asset_code: request.asset_code,
        asset_name: request.asset_name,
        fault_level: request.fault_level,
        fault_description: request.fault_description,
        request_person_id: request.request_person_id,
        request_person: request.request_person,
      },
      approver,
      comment: comment || null,
      tenantId,
    };
    emitEvent(approved ? RQ_EVENTS.APPROVED : RQ_EVENTS.REJECTED, eventPayload);

    return {
      statusCode: 200,
      body: { success: true, message: `故障维修申请已${approved ? '批准' : '拒绝'}` },
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function startRequest(id, body, req) {
  const repairPersonName = pickFirstDefined(body.repair_person, body.maintenance_person);
  const repairPersonId = body.repair_person_id || null;
  const repairStartDate = pickFirstDefined(
    body.repair_start_date,
    body.maintenance_start_date,
    body.start_date
  );

  if (!repairPersonName && !repairPersonId) {
    return {
      statusCode: 400,
      body: { success: false, message: '维修人员不能为空' },
    };
  }

  const tenantFilter = addTenantFilter(req, 'mr');
  const [requests] = await db.execute(
    `SELECT mr.* FROM maintenance_requests mr WHERE mr.id = ? ${tenantFilter.whereClause}`,
    [id, ...tenantFilter.params]
  );

  if (requests.length === 0) {
    return {
      statusCode: 404,
      body: { success: false, message: '故障维修申请不存在' },
    };
  }

  const request = requests[0];
  const createdBy = req.user.real_name || req.user.username || '系统管理员';

  if (request.status !== '已批准' && request.status !== '维修中') {
    return {
      statusCode: 400,
      body: { success: false, message: '只能开始已批准的维修申请' },
    };
  }

  // 校验并执行人是否为合法工程师（与工单 assignWorkOrder 保持一致）
  let resolvedId = repairPersonId;
  let resolvedName = repairPersonName;
  try {
    const tenantId = getTenantId(req);
    const [engineerUsers] = await db.execute(
      `SELECT u.id, u.username, u.real_name, utr.role
       FROM users u
       LEFT JOIN user_tenant_roles utr ON u.id = utr.user_id AND utr.tenant_id = ?
       WHERE (u.id = ? OR u.username = ? OR u.real_name = ?)
         AND utr.role IN (${ENGINEER_ROLES.map(() => '?').join(',')})
         AND utr.status = 'active'
       LIMIT 1`,
      [tenantId, resolvedId || 0, repairPersonName || '', repairPersonName || '', ...ENGINEER_ROLES]
    );
    if (engineerUsers.length === 0) {
      return {
        statusCode: 400,
        body: { success: false, message: `未找到维修人员「${repairPersonName || repairPersonId}」` },
      };
    }
    const engineer = engineerUsers[0];
    if (!ENGINEER_ROLES.includes(engineer.role)) {
      return {
        statusCode: 400,
        body: {
          success: false,
          message: `用户「${engineer.real_name || engineer.username}」不是有效的工程师角色，无法分配维修`,
        },
      };
    }
    resolvedId = engineer.id;
    resolvedName = engineer.real_name || engineer.username;
  } catch (lookupErr) {
    console.error('校验维修人员失败:', lookupErr);
    return {
      statusCode: 400,
      body: { success: false, message: '维修人员校验失败，请稍后重试' },
    };
  }

  await db.execute(
    `UPDATE maintenance_requests mr SET
      mr.status = ?,
      mr.repair_person = ?,
      mr.repair_person_id = ?,
      mr.repair_start_date = ?,
      mr.updated_at = NOW()
    WHERE mr.id = ? ${tenantFilter.whereClause.replace('WHERE', 'AND')}`,
    [
      '维修中',
      resolvedName,
      resolvedId,
      repairStartDate || new Date().toISOString().split('T')[0],
      id,
      ...tenantFilter.params,
    ]
  );

  // 若申请已关联工单，同步把工单执行人/状态推进到 in_progress
  if (request.work_order_id) {
    try {
      const tenantId = getTenantId(req);
      await db.execute(
        `UPDATE work_orders SET
          assigned_to = ?,
          status = 'in_progress',
          assigned_at = COALESCE(assigned_at, ?),
          started_at = COALESCE(started_at, ?),
          updated_at = NOW()
         WHERE id = ? AND tenant_id = ?`,
        [resolvedName, new Date(), new Date(), request.work_order_id, tenantId]
      );
      await db.execute(
        `INSERT INTO work_order_history (work_order_id, action_type, action_description, action_by, action_at)
         VALUES (?, ?, ?, ?, ?)`,
        [request.work_order_id, 'assign', `工单执行人更新为 ${resolvedName}`, createdBy, new Date()]
      );
    } catch (woErr) {
      console.error('[维修申请] 同步更新工单执行人失败:', woErr.message);
      // 不影响主流程
    }
  }

  // 发布「维修开始」事件 → 飞书/WebSocket 通知申请人 + 被指派工程师
  emitEvent(RQ_EVENTS.STARTED, {
    id: request.id,
    requestNo: request.request_no,
    asset_code: request.asset_code,
    asset_name: request.asset_name,
    fault_level: request.fault_level,
    fault_description: request.fault_description,
    request_person: request.request_person,
    request_person_id: request.request_person_id,
    repair_person: resolvedName,
    repair_person_id: resolvedId,
    tenantId: getTenantId(req),
  });

  return {
    statusCode: 200,
    body: { success: true, message: '维修已开始' },
  };
}

async function completeRequest(id, body, req) {
  const repairEndDate = pickFirstDefined(body.repair_end_date, body.maintenance_date);
  const repairCost = pickFirstDefined(body.repair_cost, body.maintenance_cost);
  const repairContent = pickFirstDefined(body.repair_content, body.maintenance_content);
  const partsReplaced = body.parts_replaced;
  const remark = body.remark;

  const tenantFilter = addTenantFilter(req, 'mr');
  const [requests] = await db.execute(
    `SELECT mr.* FROM maintenance_requests mr WHERE mr.id = ? ${tenantFilter.whereClause}`,
    [id, ...tenantFilter.params]
  );

  if (requests.length === 0) {
    return {
      statusCode: 404,
      body: { success: false, message: '故障维修申请不存在' },
    };
  }

  const request = requests[0];

  // 放宽：允许「已批准」/「维修中」/「已完成」状态完成维修
  // 终态（已拒绝/已取消）和「待审批」状态不能完成
  // 「已完成」是修订场景：更新之前的维护日志，不重复建日志
  if (!['已批准', '维修中', '已完成'].includes(request.status)) {
    return {
      statusCode: 400,
      body: {
        success: false,
        message: `当前申请状态为「${request.status}」，无法完成（仅已批准/维修中/已完成可完成）`,
      },
    };
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    await connection.execute(
      `UPDATE maintenance_requests mr SET
        mr.status = ?,
        mr.repair_end_date = ?,
        mr.repair_cost = ?,
        mr.repair_content = ?,
        mr.parts_replaced = ?,
        mr.remark = ?,
        mr.updated_at = NOW()
      WHERE mr.id = ? ${tenantFilter.whereClause.replace('WHERE', 'AND')}`,
      [
        '已完成',
        repairEndDate || new Date().toISOString().split('T')[0],
        repairCost || 0,
        repairContent || null,
        partsReplaced || null,
        remark || null,
        id,
        ...tenantFilter.params,
      ]
    );

    const createdBy = req.user.real_name || req.user.username || '系统管理员';
    const tenantId = getTenantId(req);
    // BUG-XXX 修复：request.repair_person 可能为 null，但 maintenance_logs.maintenance_person 是 NOT NULL
    // fallback 顺序：申请单的维修人 → 当前操作用户
    const maintenancePerson = request.repair_person || createdBy;
    const logDate = repairEndDate || new Date().toISOString().split('T')[0];

    // 查找之前由本申请产生的维护日志（修订场景：找到则更新而不是新建）
    const [existingLogs] = await connection.execute(
      `SELECT id FROM maintenance_logs
        WHERE source_type = 'request' AND source_id = ? AND tenant_id = ?
        ORDER BY id DESC LIMIT 1`,
      [id, tenantId]
    );

    if (existingLogs.length > 0) {
      // 修订：更新原日志的内容
      await connection.execute(
        `UPDATE maintenance_logs SET
          maintenance_date = ?,
          maintenance_person = ?,
          maintenance_content = ?,
          maintenance_cost = ?,
          parts_replaced = ?,
          remark = ?,
          updated_at = NOW()
        WHERE id = ? AND tenant_id = ?`,
        [
          logDate,
          maintenancePerson,
          repairContent || request.fault_description,
          repairCost || 0,
          partsReplaced || null,
          remark || null,
          existingLogs[0].id,
          tenantId,
        ]
      );
    } else {
      // 首次：插入新日志（同时修复 source_type/source_id 关联 bug）
      await connection.execute(
        `INSERT INTO maintenance_logs (
          tenant_id, asset_code, asset_name, maintenance_type, maintenance_date,
          maintenance_person, maintenance_content, maintenance_cost, parts_replaced,
          status, remark, source_type, source_id, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tenantId,
          request.asset_code,
          request.asset_name,
          '故障维修',
          logDate,
          maintenancePerson,
          repairContent || request.fault_description,
          repairCost || 0,
          partsReplaced || null,
          '已完成',
          remark || null,
          'request',
          id,
          createdBy,
        ]
      );
    }

    // 「已完成」状态再 complete 是修订场景：不动资产（资产早就是"在用"了）
    if (request.status === '已完成') {
      // 跳过资产状态校验和变更
    } else {
      const [assets] = await connection.execute(
        'SELECT * FROM assets WHERE asset_code = ? AND tenant_id = ? FOR UPDATE',
        [request.asset_code, tenantId]
      );

      if (assets.length === 0) {
        await connection.rollback();
        return {
          statusCode: 404,
          body: { success: false, message: '资产不存在' },
        };
      }

      const currentStatus = assets[0].status;
      // 放宽：已「报废」资产不能完成维修 (真正不可逆)；其他状态 (在用/闲置/维修/维修中/调配中) 都允许
      // 业务场景: 资产可能因 admin 手动改状态 / 多模块并发操作 / 工单跨租户 / 已完成后再修订
      // 而漂移到非"维修中"状态. 只要不是报废, 完成维修合理, 直接转回 在用.
      if (currentStatus === '报废') {
        await connection.rollback();
        return {
          statusCode: 400,
          body: {
            success: false,
            message: `资产当前状态为「报废」，无法完成维修。报废资产需先恢复在用状态。`,
          },
        };
      }

      // 维修中/维修 → 在用; 其他状态 (在用/闲置/调配中) 也允许并直接转 在用
      await connection.execute(
        'UPDATE assets SET status = ?, updated_at = NOW() WHERE asset_code = ? AND tenant_id = ?',
        ['在用', request.asset_code, tenantId]
      );
    }

    // 维修申请完成后，同步完成关联的工单（如果存在且尚未完成）
    if (request.work_order_id) {
      try {
        const [woRows] = await connection.execute(
          'SELECT id, status FROM work_orders WHERE id = ? AND tenant_id = ? FOR UPDATE',
          [request.work_order_id, tenantId]
        );
        if (woRows.length > 0 && !['completed', 'closed', 'cancelled'].includes(woRows[0].status)) {
          const completedAt = new Date();
          await connection.execute(
            `UPDATE work_orders SET
              status = 'completed',
              completed_at = ?,
              actual_hours = TIMESTAMPDIFF(HOUR, started_at, ?),
              updated_at = NOW()
             WHERE id = ? AND tenant_id = ?`,
            [completedAt, completedAt, request.work_order_id, tenantId]
          );
          await connection.execute(
            `INSERT INTO work_order_history (work_order_id, action_type, action_description, action_by, action_at)
             VALUES (?, ?, ?, ?, ?)`,
            [request.work_order_id, 'complete', '维修申请完成，自动关闭工单', createdBy, completedAt]
          );
        }
      } catch (woErr) {
        console.error('[维修申请] 同步完成工单失败:', woErr.message);
        // 工单同步失败不影响申请完成主流程
      }
    }

    await connection.commit();

    // 发布「维修完成」事件 → 飞书/WebSocket 通知
    emitEvent(RQ_EVENTS.COMPLETED, {
      id: request.id,
      requestNo: request.request_no,
      asset_code: request.asset_code,
      asset_name: request.asset_name,
      fault_level: request.fault_level,
      fault_description: request.fault_description,
      repair_content: repairContent || request.fault_description,
      completedBy: req.user.real_name || req.user.username || '系统管理员',
      tenantId: getTenantId(req),
    });

    return {
      statusCode: 200,
      body: { success: true, message: '维修已完成，已创建维护日志' },
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateRequest(id, body, req) {
  const faultDescription = pickFirstDefined(body.fault_description, body.description);
  const faultLevel = body.fault_level;
  const requestDepartment = pickFirstDefined(body.request_department, body.department);
  const contactPhone = body.contact_phone;
  const expectedRepairDate = pickFirstDefined(body.expected_repair_date, body.expected_completion);
  const remark = body.remark;

  const tenantFilter = addTenantFilter(req, 'mr');
  const [requests] = await db.execute(
    `SELECT mr.status FROM maintenance_requests mr WHERE mr.id = ? ${tenantFilter.whereClause}`,
    [id, ...tenantFilter.params]
  );

  if (requests.length === 0) {
    return {
      statusCode: 404,
      body: { success: false, message: '故障维修申请不存在' },
    };
  }

  const request = requests[0];
  if (request.status !== '待审批') {
    return {
      statusCode: 400,
      body: { success: false, message: '只能更新待审批状态的申请' },
    };
  }

  const updateFields = [];
  const updateValues = [];

  if (faultDescription !== undefined) {
    updateFields.push('fault_description = ?');
    updateValues.push(faultDescription);
  }
  if (faultLevel !== undefined) {
    updateFields.push('fault_level = ?');
    updateValues.push(faultLevel);
  }
  if (requestDepartment !== undefined) {
    updateFields.push('request_department = ?');
    updateValues.push(requestDepartment);
  }
  if (contactPhone !== undefined) {
    updateFields.push('contact_phone = ?');
    updateValues.push(contactPhone);
  }
  if (expectedRepairDate !== undefined) {
    updateFields.push('expected_repair_date = ?');
    updateValues.push(expectedRepairDate);
  }
  if (remark !== undefined) {
    updateFields.push('remark = ?');
    updateValues.push(remark);
  }

  if (updateFields.length === 0) {
    return {
      statusCode: 400,
      body: { success: false, message: '没有要更新的字段' },
    };
  }

  updateFields.push('updated_at = NOW()');
  updateValues.push(id);

  await db.execute(
    `UPDATE maintenance_requests mr SET ${updateFields.join(', ')} WHERE mr.id = ? ${tenantFilter.whereClause.replace('WHERE', 'AND')}`,
    [...updateValues, ...tenantFilter.params]
  );

  return {
    statusCode: 200,
    body: { success: true, message: '故障维修申请更新成功' },
  };
}

async function cancelRequest(id, req) {
  const tenantFilter = addTenantFilter(req, 'mr');
  const [requests] = await db.execute(
    `SELECT mr.status, mr.asset_code FROM maintenance_requests mr WHERE mr.id = ? ${tenantFilter.whereClause}`,
    [id, ...tenantFilter.params]
  );

  if (requests.length === 0) {
    return {
      statusCode: 404,
      body: { success: false, message: '故障维修申请不存在' },
    };
  }

  const request = requests[0];
  if (['已完成', '已取消'].includes(request.status)) {
    return {
      statusCode: 400,
      body: { success: false, message: '该申请无法取消' },
    };
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    await connection.execute(
      `UPDATE maintenance_requests mr SET
        mr.status = ?,
        mr.updated_at = NOW()
      WHERE mr.id = ? ${tenantFilter.whereClause.replace('WHERE', 'AND')}`,
      ['已取消', id, ...tenantFilter.params]
    );

    const assetTenantFilter = addTenantFilter(req, 'a');
    const [assets] = await connection.execute(
      `SELECT a.status FROM assets a WHERE a.asset_code = ? ${assetTenantFilter.whereClause}`,
      [request.asset_code, ...assetTenantFilter.params]
    );

    if (assets.length > 0 && assets[0].status === '维修') {
      const [otherRequests] = await connection.execute(
        `SELECT id FROM maintenance_requests mr
         WHERE mr.asset_code = ? AND mr.id != ? AND mr.status IN (?, ?, ?) ${tenantFilter.whereClause.replace('WHERE', 'AND')}`,
        [request.asset_code, id, '待审批', '已批准', '维修中', ...tenantFilter.params]
      );

      if (otherRequests.length === 0) {
        await connection.execute(
          `UPDATE assets a SET a.status = ? WHERE a.asset_code = ? ${assetTenantFilter.whereClause.replace('WHERE', 'AND')}`,
          ['在用', request.asset_code, ...assetTenantFilter.params]
        );
      }
    }

    await connection.commit();

    // 发布「维修取消」事件 → 飞书/WebSocket 通知
    emitEvent(RQ_EVENTS.CANCELLED, {
      id: request.id,
      requestNo: request.request_no,
      asset_code: request.asset_code,
      asset_name: request.asset_name,
      cancelledBy: req.user.real_name || req.user.username || '系统管理员',
      tenantId: getTenantId(req),
    });

    return {
      statusCode: 200,
      body: { success: true, message: '故障维修申请已取消' },
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function deleteRequest(id, req) {
  const tenantFilter = addTenantFilter(req, 'mr');
  const [requests] = await db.execute(
    `SELECT mr.status FROM maintenance_requests mr WHERE mr.id = ? ${tenantFilter.whereClause}`,
    [id, ...tenantFilter.params]
  );

  if (requests.length === 0) {
    return {
      statusCode: 404,
      body: { success: false, message: '故障维修申请不存在' },
    };
  }

  if (!['已取消', '已拒绝'].includes(requests[0].status)) {
    return {
      statusCode: 400,
      body: { success: false, message: '只能删除已取消或已拒绝的申请' },
    };
  }

  const [result] = await db.execute(
    `DELETE mr FROM maintenance_requests mr WHERE mr.id = ? ${tenantFilter.whereClause.replace('WHERE', 'AND')}`,
    [id, ...tenantFilter.params]
  );

  if (result.affectedRows === 0) {
    return {
      statusCode: 404,
      body: { success: false, message: '故障维修申请不存在' },
    };
  }

  return {
    statusCode: 200,
    body: { success: true, message: '故障维修申请删除成功' },
  };
}

// ==================== 附件管理 ====================

async function getRequestAttachments(requestId, req) {
  const tenantFilter = addTenantFilter(req, 'mra');
  const [rows] = await db.execute(
    `SELECT mra.id, mra.request_id, mra.file_name, mra.file_path, mra.file_type, mra.file_size,
            mra.uploaded_by, mra.description, mra.upload_date
     FROM maintenance_request_attachments mra
     WHERE mra.request_id = ? ${tenantFilter.whereClause}
     ORDER BY mra.upload_date DESC, mra.id DESC`,
    [requestId, ...tenantFilter.params],
  );

  const attachments = rows.map(att => ({
    ...att,
    file_url: `${req.protocol}://${req.get('host')}/api/maintenance/requests/${requestId}/attachments/${att.id}`,
  }));

  return { success: true, data: attachments };
}

async function getRequestAttachment(requestId, attachmentId, req) {
  const tenantFilter = addTenantFilter(req, 'mra');
  const [rows] = await db.execute(
    `SELECT mra.* FROM maintenance_request_attachments mra
     WHERE mra.id = ? AND mra.request_id = ? ${tenantFilter.whereClause}`,
    [attachmentId, requestId, ...tenantFilter.params],
  );
  if (rows.length === 0) {
    return {
      statusCode: 404,
      body: { success: false, message: '附件不存在或无权限访问' },
    };
  }
  const attachment = rows[0];
  const filePath = path.join(__dirname, '../..', attachment.file_path);
  return { success: true, data: { attachment, filePath } };
}

async function uploadRequestAttachment(requestId, req) {
  const tenantFilter = addTenantFilter(req, 'mr');
  const [reqs] = await db.execute(
    `SELECT id FROM maintenance_requests mr WHERE id = ? ${tenantFilter.whereClause}`,
    [requestId, ...tenantFilter.params],
  );
  if (reqs.length === 0) {
    return { statusCode: 404, body: { success: false, message: '维修申请不存在' } };
  }

  if (!req.file) {
    return { statusCode: 400, body: { success: false, message: '请选择要上传的文件' } };
  }

  const { file } = req;
  let fileName = null;
  if (req.parsedFileName) {
    fileName = req.parsedFileName;
  } else {
    fileName = decodeOriginalFileName(file);
  }

  const uploadedBy = req.user?.real_name || req.user?.username || '系统用户';
  const filePath = `/uploads/maintenance-request-attachments/${file.filename}`;
  const fileUrl = `${req.protocol}://${req.get('host')}${filePath}`;

  const tenantId = getTenantId(req);

  const [result] = await db.execute(
    `INSERT INTO maintenance_request_attachments
      (tenant_id, request_id, file_name, file_path, file_type, file_size, uploaded_by, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [tenantId, requestId, fileName, filePath, file.mimetype, file.size, uploadedBy, null],
  );

  return {
    statusCode: 200,
    body: {
      success: true,
      message: '附件上传成功',
      data: {
        id: result.insertId,
        file_name: fileName,
        file_path: filePath,
        file_url: fileUrl,
        file_type: file.mimetype,
        file_size: file.size,
        uploaded_by: uploadedBy,
        upload_date: new Date().toISOString(),
      },
    },
  };
}

async function deleteRequestAttachment(requestId, attachmentId, req) {
  const tenantFilter = addTenantFilter(req, 'mra');
  const [rows] = await db.execute(
    `SELECT mra.file_path FROM maintenance_request_attachments mra
     WHERE mra.id = ? AND mra.request_id = ? ${tenantFilter.whereClause}`,
    [attachmentId, requestId, ...tenantFilter.params],
  );
  if (rows.length === 0) {
    return { statusCode: 404, body: { success: false, message: '附件不存在' } };
  }

  await db.execute(
    `DELETE mra FROM maintenance_request_attachments mra
     WHERE mra.id = ? AND mra.request_id = ? ${tenantFilter.whereClause}`,
    [attachmentId, requestId, ...tenantFilter.params],
  );

  const filePath = rows[0].file_path;
  if (filePath && filePath.startsWith('/uploads/')) {
    try {
      const absolutePath = path.join(__dirname, '../..', filePath);
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
      }
    } catch (_) {
      // 记录但不抛
    }
  }

  return { success: true, message: '附件已删除' };
}

module.exports = {
  getRequests,
  getRequest,
  createRequest,
  approveRequest,
  startRequest,
  completeRequest,
  updateRequest,
  cancelRequest,
  deleteRequest,
  getRequestAttachments,
  getRequestAttachment,
  uploadRequestAttachment,
  deleteRequestAttachment,
};
