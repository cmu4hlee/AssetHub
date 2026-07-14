const db = require('../../config/database');
const { addTenantFilter, getTenantId } = require('../../middleware/tenant-filter');

async function getPlans(query, req) {
  const { page = 1, pageSize = 20, asset_code, status, keyword } = query;
  const offset = (page - 1) * pageSize;

  let whereClause = 'WHERE 1=1';
  const params = [];

  const tenantFilter = addTenantFilter(req, 'pmp');
  whereClause += tenantFilter.whereClause;
  params.push(...tenantFilter.params);

  if (req.user.role !== 'super_admin' && req.user.role !== 'system_admin') {
    if (
      req.user.managed_departments &&
      Array.isArray(req.user.managed_departments) &&
      req.user.managed_departments.length > 0
    ) {
      try {
        const placeholders = req.user.managed_departments.map(() => '?').join(',');
        const [deptRows] = await db.execute(
          `SELECT department_name FROM departments WHERE id IN (${placeholders}) AND tenant_id = ?`,
          [...req.user.managed_departments, req.user.tenant_id],
        );

        if (deptRows.length > 0) {
          const deptNames = deptRows.map(row => row.department_name);
          const deptPlaceholders = deptNames.map(() => '?').join(',');
          whereClause += ` AND EXISTS (
            SELECT 1 FROM assets a
            WHERE a.asset_code = pmp.asset_code
            AND a.tenant_id = pmp.tenant_id
            AND (a.department IN (${deptPlaceholders}) OR a.department_new IN (${deptPlaceholders}))
          )`;
          params.push(...deptNames, ...deptNames);
        } else {
          whereClause += ' AND 1=0';
        }
      } catch (deptError) {
        console.error('查询管理科室失败:', deptError);
        whereClause += ' AND 1=0';
      }
    } else {
      whereClause += ' AND 1=0';
    }
  }

  if (asset_code) {
    whereClause += ' AND pmp.asset_code LIKE ?';
    params.push(`%${asset_code}%`);
  }
  if (status) {
    whereClause += ' AND pmp.status = ?';
    params.push(status);
  }
  if (keyword) {
    whereClause += ' AND (pmp.asset_code LIKE ? OR pmp.asset_name LIKE ? OR pmp.plan_name LIKE ?)';
    const keywordParam = `%${keyword}%`;
    params.push(keywordParam, keywordParam, keywordParam);
  }

  const [countResult] = await db.execute(
    `SELECT COUNT(*) as total FROM preventive_maintenance_plans pmp ${whereClause}`,
    params,
  );
  const {total} = countResult[0];

  const [rows] = await db.execute(
    `SELECT pmp.*, a.department, a.location
     FROM preventive_maintenance_plans pmp
     LEFT JOIN assets a ON pmp.asset_code = a.asset_code AND a.tenant_id = pmp.tenant_id
     ${whereClause}
     ORDER BY pmp.next_maintenance_date ASC, pmp.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, parseInt(pageSize, 10), offset],
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

async function getPlan(id, req) {
  const tenantFilter = addTenantFilter(req, 'pmp');
  const [rows] = await db.execute(
    `SELECT pmp.*, a.department, a.location, a.brand, a.model
     FROM preventive_maintenance_plans pmp
     LEFT JOIN assets a ON pmp.asset_code = a.asset_code AND a.tenant_id = pmp.tenant_id
     WHERE pmp.id = ? ${tenantFilter.whereClause}`,
    [id, ...tenantFilter.params],
  );

  if (rows.length === 0) {
    return {
      statusCode: 404,
      body: { success: false, message: '预防性维护计划不存在' },
    };
  }

  const plan = rows[0];

  if (plan.maintenance_items) {
    try {
      plan.maintenance_items = JSON.parse(plan.maintenance_items);
    } catch (error) {
      plan.maintenance_items = null;
    }
  }

  if (plan.required_materials) {
    try {
      plan.required_materials = JSON.parse(plan.required_materials);
    } catch (error) {
      plan.required_materials = null;
    }
  }

  if (plan.auto_generate_workorder !== undefined) {
    plan.auto_generate_workorder = Boolean(plan.auto_generate_workorder);
  }

  return {
    statusCode: 200,
    body: { success: true, data: plan },
  };
}

async function createPlan(body, req) {
  const {
    asset_code,
    plan_name,
    maintenance_type,
    cycle_type,
    cycle_value,
    next_maintenance_date,
    maintenance_content,
    responsible_person,
    remark,
    template_id,
    trigger_type,
    maintenance_items,
    required_materials,
    estimated_hours,
    auto_generate_workorder,
    current_usage,
    usage_threshold,
  } = body;

  if (!asset_code || !plan_name || !maintenance_type || !cycle_type || !cycle_value) {
    return {
      statusCode: 400,
      body: { success: false, message: '必填字段不能为空' },
    };
  }

  const assetTenantFilter = addTenantFilter(req, 'a');
  const [assets] = await db.execute(
    `SELECT a.id, a.asset_code, a.asset_name, a.tenant_id FROM assets a WHERE a.asset_code = ? ${assetTenantFilter.whereClause}`,
    [asset_code, ...assetTenantFilter.params],
  );

  if (assets.length === 0) {
    return {
      statusCode: 404,
      body: { success: false, message: '资产不存在' },
    };
  }

  const asset = assets[0];
  const createdBy = req.user.real_name || req.user.username || '系统管理员';
  const tenantId =
    req.user.role === 'super_admin' ? asset.tenant_id || getTenantId(req) : getTenantId(req);

  let calculatedNextDate = next_maintenance_date;
  if (!calculatedNextDate) {
    const today = new Date();
    const cycleValue = parseInt(cycle_value, 10) || 1;

    switch (cycle_type) {
      case '按天':
        today.setDate(today.getDate() + cycleValue);
        break;
      case '按周':
        today.setDate(today.getDate() + cycleValue * 7);
        break;
      case '按月':
        today.setMonth(today.getMonth() + cycleValue);
        break;
      case '按季度':
        today.setMonth(today.getMonth() + cycleValue * 3);
        break;
      case '按年':
        today.setFullYear(today.getFullYear() + cycleValue);
        break;
      default:
        break;
    }
    calculatedNextDate = today.toISOString().split('T')[0];
  }

  const insertFields = [
    'tenant_id',
    'asset_code',
    'asset_name',
    'plan_name',
    'maintenance_type',
    'cycle_type',
    'cycle_value',
    'next_maintenance_date',
    'maintenance_content',
    'responsible_person',
    'status',
    'remark',
    'created_by',
  ];

  const insertValues = [
    tenantId,
    asset.asset_code,
    asset.asset_name,
    plan_name,
    maintenance_type,
    cycle_type,
    cycle_value,
    calculatedNextDate,
    maintenance_content || null,
    responsible_person || null,
    '启用',
    remark || null,
    createdBy,
  ];

  try {
    const [columns] = await db.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'preventive_maintenance_plans'`,
    );
    const columnNames = columns.map(col => col.COLUMN_NAME);

    if (template_id !== undefined && columnNames.includes('template_id')) {
      insertFields.push('template_id');
      insertValues.push(template_id);
    }
    if (trigger_type !== undefined && columnNames.includes('trigger_type')) {
      insertFields.push('trigger_type');
      insertValues.push(trigger_type || 'time');
    }
    if (maintenance_items !== undefined && columnNames.includes('maintenance_items')) {
      insertFields.push('maintenance_items');
      insertValues.push(maintenance_items ? JSON.stringify(maintenance_items) : null);
    }
    if (required_materials !== undefined && columnNames.includes('required_materials')) {
      insertFields.push('required_materials');
      insertValues.push(required_materials ? JSON.stringify(required_materials) : null);
    }
    if (estimated_hours !== undefined && columnNames.includes('estimated_hours')) {
      insertFields.push('estimated_hours');
      insertValues.push(estimated_hours);
    }
    if (auto_generate_workorder !== undefined && columnNames.includes('auto_generate_workorder')) {
      insertFields.push('auto_generate_workorder');
      insertValues.push(auto_generate_workorder ? 1 : 0);
    }
    if (current_usage !== undefined && columnNames.includes('current_usage')) {
      insertFields.push('current_usage');
      insertValues.push(current_usage || 0);
    }
    if (usage_threshold !== undefined && columnNames.includes('usage_threshold')) {
      insertFields.push('usage_threshold');
      insertValues.push(usage_threshold);
    }
  } catch (error) {
    console.warn('检查表结构失败，使用基础字段:', error.message);
  }

  const placeholders = insertFields.map(() => '?').join(', ');

  const [result] = await db.execute(
    `INSERT INTO preventive_maintenance_plans (${insertFields.join(', ')}) VALUES (${placeholders})`,
    insertValues,
  );

  return {
    statusCode: 200,
    body: {
      success: true,
      message: '预防性维护计划创建成功',
      data: { id: result.insertId },
    },
  };
}

/**
 * 归一化批量入参：把任意入参形态展开成 [{ asset_code, ... }] 列表
 *
 * 支持 5 种入参模式：
 *  - plans:                  [{ asset_code, ... }, ...]                 逐条模式
 *  - asset_codes + template: { asset_codes: [...], template: {...} }   粘贴模板
 *  - category_ids + template:多选资产种类 → 自动取该类下所有资产
 *  - department_codes + template:多选部门 → 自动取该部门下所有资产
 *  - category_ids + department_codes + template:同时筛选（多选 IN）
 *
 * 返回 { planList } 或 { error: { statusCode, body } }
 */
function normalizeBatchInput(body) {
  const hasPlans = Array.isArray(body.plans) && body.plans.length > 0;
  const hasAssetCodes = Array.isArray(body.asset_codes) && body.asset_codes.length > 0;
  const hasCategoryIds = Array.isArray(body.category_ids) && body.category_ids.length > 0;
  const hasDepartmentCodes =
    Array.isArray(body.department_codes) && body.department_codes.length > 0;

  if (hasPlans) {
    return { planList: body.plans };
  }

  // 任何"按 X 选资产"模式都需要 template
  if (!body.template || typeof body.template !== 'object') {
    return {
      error: {
        statusCode: 400,
        body: { success: false, message: '请提供 plans 数组 或 asset_codes/category_ids/department_codes + template' },
      },
    };
  }

  if (!(hasAssetCodes || hasCategoryIds || hasDepartmentCodes)) {
    return {
      error: {
        statusCode: 400,
        body: { success: false, message: '请提供 plans 数组 或 asset_codes/category_ids/department_codes + template' },
      },
    };
  }

  // 资产编号模板模式（直接给 codes）
  if (hasAssetCodes && !hasCategoryIds && !hasDepartmentCodes) {
    const tpl = body.template;
    const planList = body.asset_codes
      .filter(code => typeof code === 'string' && code.trim().length > 0)
      .map(code => ({
        ...tpl,
        asset_code: code.trim(),
        plan_name: tpl.plan_name ? tpl.plan_name.replace(/\{asset_code\}/g, code.trim()) : '',
      }));
    return { planList };
  }

  // 按种类/部门筛选：planList 由调用方先展开 codes 再传入。这里只返回标记。
  return { expandFromFilters: true, hasCategoryIds, hasDepartmentCodes };
}

/**
 * 根据 category_ids / department_codes 从 assets 表查 asset_code 列表
 *
 * @param {Object} body
 * @param {Object} req
 * @returns {Promise<{ asset_codes: string[], total: number, by_category: number, by_department: number }>}
 */
async function resolveAssetCodesFromFilters(body, req) {
  const tenantFilter = addTenantFilter(req, 'a');
  const whereParts = ['a.is_deleted = 0', 'a.asset_code IS NOT NULL'];
  const params = [];

  let byCategory = 0;
  let byDepartment = 0;

  if (Array.isArray(body.category_ids) && body.category_ids.length > 0) {
    const catIds = body.category_ids
      .map(id => Number(id))
      .filter(id => Number.isFinite(id) && id > 0);
    if (catIds.length > 0) {
      const ph = catIds.map(() => '?').join(',');
      whereParts.push(`a.category_id IN (${ph})`);
      params.push(...catIds);
      byCategory = catIds.length;
    }
  }

  if (Array.isArray(body.department_codes) && body.department_codes.length > 0) {
    const codes = body.department_codes
      .map(c => String(c).trim())
      .filter(c => c.length > 0);
    if (codes.length > 0) {
      // 部门主数据以 department_code 为键，而 assets.department 存的是部门「名称」、
      // assets.department_new 在真实数据中大多为 NULL。若仍按 department_new 精确匹配，
      // 按部门批量创建会匹配到 0 条。因此先把 codes 解析成 department_name，
      // 再用 (department_new IN codes) OR (department IN names) 兜底匹配。
      let names = [];
      try {
        const tenantId = getTenantId(req);
        const codePh = codes.map(() => '?').join(',');
        const [deptRows] = await db.execute(
          `SELECT department_name FROM departments WHERE tenant_id = ? AND department_code IN (${codePh})`,
          [tenantId, ...codes],
        );
        names = deptRows.map(r => r.department_name).filter(Boolean);
      } catch (deptErr) {
        console.warn('解析部门名称失败，仅按 department_new 匹配:', deptErr.message);
      }

      const condParts = [`a.department_new IN (${codes.map(() => '?').join(',')})`];
      params.push(...codes);
      if (names.length > 0) {
        const namePh = names.map(() => '?').join(',');
        condParts.push(`a.department IN (${namePh})`);
        params.push(...names);
      }
      whereParts.push(`(${condParts.join(' OR ')})`);
      byDepartment = codes.length;
    }
  }

  // 没有任何业务筛选条件时（既没选种类也没选部门），避免全表扫描
  if (byCategory === 0 && byDepartment === 0) {
    return { asset_codes: [], total: 0, by_category: byCategory, by_department: byDepartment };
  }

  // 拼接 tenant filter 自身的 whereClause + params（顺序对齐 SQL 里的位置）
  const tenantClause = (tenantFilter.whereClause || '').trim();
  const tenantParams = tenantFilter.params || [];

  // 把 tenant 条件里 "AND ..." 的 "AND" 拼进 whereParts，保持 SQL 里的 ? 顺序与 params 一致
  let sql;
  if (tenantClause) {
    // tenantClause 一般是 "AND pmp.tenant_id = ?" 这种形式
    // 直接附加：whereParts 顺序 = is_deleted, asset_code, category, department, tenant
    // params 顺序 = category, department, tenant
    const cleanedTenant = tenantClause.replace(/^AND\s+/i, '').trim();
    whereParts.push(cleanedTenant);
    params.push(...tenantParams);
    sql = `SELECT a.asset_code
           FROM assets a
           WHERE ${whereParts.join(' AND ')}
           ORDER BY a.asset_code`;
  } else {
    sql = `SELECT a.asset_code
           FROM assets a
           WHERE ${whereParts.join(' AND ')}
           ORDER BY a.asset_code`;
  }

  const [rows] = await db.execute(sql, params);
  return {
    asset_codes: rows.map(r => r.asset_code).filter(Boolean),
    total: rows.length,
    by_category: byCategory,
    by_department: byDepartment,
  };
}

/**
 * 预览批量创建会匹配到的资产（不实际插入）
 * 用于前端在用户选完种类/部门后，先告诉他会创建多少条
 */
async function previewBatchAssets(body, req) {
  if (
    !Array.isArray(body.category_ids) &&
    !Array.isArray(body.department_codes)
  ) {
    return {
      statusCode: 400,
      body: { success: false, message: '请提供 category_ids 或 department_codes' },
    };
  }
  const resolved = await resolveAssetCodesFromFilters(body, req);
  return {
    statusCode: 200,
    body: {
      success: true,
      data: {
        total: resolved.total,
        sample: resolved.asset_codes.slice(0, 10),
        asset_codes: resolved.asset_codes,
        by_category: resolved.by_category,
        by_department: resolved.by_department,
      },
    },
  };
}

/**
 * 批量创建预防性维护计划
 *
 * 支持 4 种入参模式：
 *  - 多计划模式：      { plans: [{ asset_code, plan_name, ... }, ...] }
 *  - 模板模式（粘贴）：{ asset_codes: ['A001','A002'], template: { plan_name, ... } }
 *  - 按资产种类：      { category_ids: [1,2,3], template: {...} }
 *  - 按部门：          { department_codes: ['DEP001','DEP002'], template: {...} }
 *  - 组合：            { category_ids: [...], department_codes: [...], template: {...} }
 *
 * 返回结果：
 *  - 整体成功：{ success: true, data: { created: N, ids: [...] } }
 *  - 部分失败：{ success: false, data: { created: M, failed: [{ asset_code, error }] } }
 *  - 整体失败：{ statusCode: 400/500, body: { success: false, message } }
 *
 * 事务行为：单个资产失败不影响其他资产；任一成功即视为部分成功。
 */
async function createPlansBatch(body, req) {
  let planList = [];

  // 1. 归一化入参
  const normalized = normalizeBatchInput(body);
  if (normalized.error) {
    return normalized.error;
  }

  if (normalized.expandFromFilters) {
    // 按种类/部门筛选，先解析出 asset_codes
    const resolved = await resolveAssetCodesFromFilters(body, req);
    if (resolved.asset_codes.length === 0) {
      return {
        statusCode: 400,
        body: {
          success: false,
          message: '所选范围内没有匹配的资产，请调整筛选条件',
          data: { created: 0, failed: [], ids: [] },
        },
      };
    }
    const tpl = body.template;
    planList = resolved.asset_codes.map(code => ({
      ...tpl,
      asset_code: code,
      plan_name: tpl.plan_name ? tpl.plan_name.replace(/\{asset_code\}/g, code) : '',
    }));
  } else {
    planList = normalized.planList;
  }

  if (planList.length === 0) {
    return {
      statusCode: 400,
      body: { success: false, message: '没有可创建的记录' },
    };
  }

  // 支持大范围批量创建：移除原先「单次最多 500 条」的硬限制。
  // 底层为逐条独立插入（单条失败不影响其它），因此可处理整类上万资产；
  // 当范围超过 500 条时打印告警，便于运维观察长任务进度。
  if (planList.length > 500) {
    console.warn(
      `批量创建：本次范围较大，共 ${planList.length} 条，将逐条顺序插入（单条失败不影响其它）`,
    );
  }

  // 2. 预校验：必填字段
  const requiredFields = ['asset_code', 'plan_name', 'maintenance_type', 'cycle_type', 'cycle_value'];
  const preCheckErrors = [];
  planList.forEach((item, idx) => {
    for (const f of requiredFields) {
      if (item[f] === undefined || item[f] === null || item[f] === '') {
        preCheckErrors.push({
          index: idx,
          asset_code: item.asset_code || null,
          error: `字段 ${f} 不能为空`,
        });
        return;
      }
    }
  });

  if (preCheckErrors.length === planList.length) {
    // 全部都缺必填，直接返回
    return {
      statusCode: 400,
      body: {
        success: false,
        message: '所有记录都缺少必填字段',
        data: { failed: preCheckErrors, created: 0 },
      },
    };
  }

  // 3. 一次性查出所有相关资产
  const assetCodes = [...new Set(planList.map(p => p.asset_code).filter(Boolean))];
  const assetTenantFilter = addTenantFilter(req, 'a');
  const placeholders = assetCodes.map(() => '?').join(',');
  const [assetRows] = await db.execute(
    `SELECT a.id, a.asset_code, a.asset_name, a.tenant_id
     FROM assets a
     WHERE a.asset_code IN (${placeholders}) ${assetTenantFilter.whereClause}`,
    [...assetCodes, ...assetTenantFilter.params],
  );
  const assetMap = new Map(assetRows.map(a => [a.asset_code, a]));

  // 4. 检测表结构（一次）
  let columnNames = [];
  try {
    const [columns] = await db.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'preventive_maintenance_plans'`,
    );
    columnNames = columns.map(col => col.COLUMN_NAME);
  } catch (error) {
    console.warn('批量创建：检查表结构失败，使用基础字段:', error.message);
  }

  // 5. 逐条插入（不强制单事务：单条失败不影响其他）
  const createdIds = [];
  const failed = [...preCheckErrors];
  const createdBy = req.user.real_name || req.user.username || '系统管理员';
  const defaultTenantId = getTenantId(req);

  for (let i = 0; i < planList.length; i++) {
    const item = planList[i];
    try {
      // 跳过预校验已失败的
      if (preCheckErrors.find(e => e.index === i)) continue;

      const asset = assetMap.get(item.asset_code);
      if (!asset) {
        failed.push({
          index: i,
          asset_code: item.asset_code,
          error: '资产不存在或无权限',
        });
        continue;
      }

      const tenantId =
        req.user.role === 'super_admin' ? asset.tenant_id || defaultTenantId : defaultTenantId;

      // 计算下次维护日期
      let calculatedNextDate = item.next_maintenance_date;
      if (!calculatedNextDate) {
        const today = new Date();
        const cv = parseInt(item.cycle_value, 10) || 1;
        switch (item.cycle_type) {
          case '按天':
            today.setDate(today.getDate() + cv);
            break;
          case '按周':
            today.setDate(today.getDate() + cv * 7);
            break;
          case '按月':
            today.setMonth(today.getMonth() + cv);
            break;
          case '按季度':
            today.setMonth(today.getMonth() + cv * 3);
            break;
          case '按年':
            today.setFullYear(today.getFullYear() + cv);
            break;
          default:
            break;
        }
        calculatedNextDate = today.toISOString().split('T')[0];
      }

      // 构建 insert
      const insertFields = [
        'tenant_id',
        'asset_code',
        'asset_name',
        'plan_name',
        'maintenance_type',
        'cycle_type',
        'cycle_value',
        'next_maintenance_date',
        'maintenance_content',
        'responsible_person',
        'status',
        'remark',
        'created_by',
      ];
      const insertValues = [
        tenantId,
        asset.asset_code,
        asset.asset_name,
        item.plan_name,
        item.maintenance_type,
        item.cycle_type,
        item.cycle_value,
        calculatedNextDate,
        item.maintenance_content || null,
        item.responsible_person || null,
        '启用',
        item.remark || null,
        createdBy,
      ];

      if (columnNames.includes('template_id') && item.template_id !== undefined) {
        insertFields.push('template_id');
        insertValues.push(item.template_id);
      }
      if (columnNames.includes('trigger_type') && item.trigger_type !== undefined) {
        insertFields.push('trigger_type');
        insertValues.push(item.trigger_type || 'time');
      }
      if (columnNames.includes('maintenance_items') && item.maintenance_items !== undefined) {
        insertFields.push('maintenance_items');
        insertValues.push(item.maintenance_items ? JSON.stringify(item.maintenance_items) : null);
      }
      if (columnNames.includes('required_materials') && item.required_materials !== undefined) {
        insertFields.push('required_materials');
        insertValues.push(item.required_materials ? JSON.stringify(item.required_materials) : null);
      }
      if (columnNames.includes('estimated_hours') && item.estimated_hours !== undefined) {
        insertFields.push('estimated_hours');
        insertValues.push(item.estimated_hours);
      }
      if (
        columnNames.includes('auto_generate_workorder') &&
        item.auto_generate_workorder !== undefined
      ) {
        insertFields.push('auto_generate_workorder');
        insertValues.push(item.auto_generate_workorder ? 1 : 0);
      }
      if (columnNames.includes('current_usage') && item.current_usage !== undefined) {
        insertFields.push('current_usage');
        insertValues.push(item.current_usage || 0);
      }
      if (columnNames.includes('usage_threshold') && item.usage_threshold !== undefined) {
        insertFields.push('usage_threshold');
        insertValues.push(item.usage_threshold);
      }

      const ph = insertFields.map(() => '?').join(', ');
      const [result] = await db.execute(
        `INSERT INTO preventive_maintenance_plans (${insertFields.join(', ')}) VALUES (${ph})`,
        insertValues,
      );
      createdIds.push(result.insertId);
    } catch (err) {
      console.error(`批量创建第 ${i} 条失败:`, err.message);
      failed.push({
        index: i,
        asset_code: item.asset_code,
        error: err.message || '未知错误',
      });
    }
  }

  // 6. 返回结果
  if (createdIds.length === 0) {
    return {
      statusCode: 400,
      body: {
        success: false,
        message: '批量创建全部失败',
        data: { created: 0, failed, ids: [] },
      },
    };
  }

  if (failed.length > 0) {
    return {
      statusCode: 200,
      body: {
        success: true,
        message: `批量创建完成：成功 ${createdIds.length} 条，失败 ${failed.length} 条`,
        data: {
          created: createdIds.length,
          failed,
          ids: createdIds,
        },
      },
    };
  }

  return {
    statusCode: 200,
    body: {
      success: true,
      message: `批量创建成功，共 ${createdIds.length} 条`,
      data: { created: createdIds.length, failed: [], ids: createdIds },
    },
  };
}

async function updatePlan(id, body, req) {
  const {
    plan_name,
    maintenance_type,
    cycle_type,
    cycle_value,
    next_maintenance_date,
    maintenance_content,
    responsible_person,
    status,
    remark,
    template_id,
    trigger_type,
    maintenance_items,
    required_materials,
    estimated_hours,
    auto_generate_workorder,
    current_usage,
    usage_threshold,
  } = body;

  let columnNames = [];
  try {
    const [columns] = await db.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'preventive_maintenance_plans'`,
    );
    columnNames = columns.map(col => col.COLUMN_NAME);
  } catch (error) {
    console.warn('检查表结构失败:', error.message);
  }

  const updateFields = [];
  const updateValues = [];

  if (plan_name !== undefined) {
    updateFields.push('plan_name = ?');
    updateValues.push(plan_name);
  }
  if (maintenance_type !== undefined) {
    updateFields.push('maintenance_type = ?');
    updateValues.push(maintenance_type);
  }
  if (cycle_type !== undefined) {
    updateFields.push('cycle_type = ?');
    updateValues.push(cycle_type);
  }
  if (cycle_value !== undefined) {
    updateFields.push('cycle_value = ?');
    updateValues.push(cycle_value);
  }
  if (next_maintenance_date !== undefined) {
    updateFields.push('next_maintenance_date = ?');
    updateValues.push(next_maintenance_date);
  }
  if (maintenance_content !== undefined) {
    updateFields.push('maintenance_content = ?');
    updateValues.push(maintenance_content);
  }
  if (responsible_person !== undefined) {
    updateFields.push('responsible_person = ?');
    updateValues.push(responsible_person);
  }
  if (status !== undefined) {
    updateFields.push('status = ?');
    updateValues.push(status);
  }
  if (remark !== undefined) {
    updateFields.push('remark = ?');
    updateValues.push(remark);
  }

  if (columnNames.length > 0) {
    if (template_id !== undefined && columnNames.includes('template_id')) {
      updateFields.push('template_id = ?');
      updateValues.push(template_id);
    }
    if (trigger_type !== undefined && columnNames.includes('trigger_type')) {
      updateFields.push('trigger_type = ?');
      updateValues.push(trigger_type);
    }
    if (maintenance_items !== undefined && columnNames.includes('maintenance_items')) {
      updateFields.push('maintenance_items = ?');
      updateValues.push(maintenance_items ? JSON.stringify(maintenance_items) : null);
    }
    if (required_materials !== undefined && columnNames.includes('required_materials')) {
      updateFields.push('required_materials = ?');
      updateValues.push(required_materials ? JSON.stringify(required_materials) : null);
    }
    if (estimated_hours !== undefined && columnNames.includes('estimated_hours')) {
      updateFields.push('estimated_hours = ?');
      updateValues.push(estimated_hours);
    }
    if (auto_generate_workorder !== undefined && columnNames.includes('auto_generate_workorder')) {
      updateFields.push('auto_generate_workorder = ?');
      updateValues.push(auto_generate_workorder ? 1 : 0);
    }
    if (current_usage !== undefined && columnNames.includes('current_usage')) {
      updateFields.push('current_usage = ?');
      updateValues.push(current_usage);
    }
    if (usage_threshold !== undefined && columnNames.includes('usage_threshold')) {
      updateFields.push('usage_threshold = ?');
      updateValues.push(usage_threshold);
    }
  }

  if (updateFields.length === 0) {
    return {
      statusCode: 400,
      body: { success: false, message: '没有要更新的字段' },
    };
  }

  const tenantFilter = addTenantFilter(req, 'pmp');
  const [existing] = await db.execute(
    `SELECT id FROM preventive_maintenance_plans pmp WHERE pmp.id = ? ${tenantFilter.whereClause}`,
    [id, ...tenantFilter.params],
  );

  if (existing.length === 0) {
    return {
      statusCode: 404,
      body: { success: false, message: '预防性维护计划不存在' },
    };
  }

  updateFields.push('updated_at = NOW()');
  updateValues.push(id);

  await db.execute(
    `UPDATE preventive_maintenance_plans pmp SET ${updateFields.join(', ')} WHERE pmp.id = ? ${tenantFilter.whereClause.replace('WHERE', 'AND')}`,
    [...updateValues, ...tenantFilter.params],
  );

  return {
    statusCode: 200,
    body: { success: true, message: '预防性维护计划更新成功' },
  };
}

async function completePlan(id, body, req) {
  const {
    maintenance_date,
    maintenance_person,
    maintenance_content,
    maintenance_cost,
    parts_replaced,
    remark,
    actual_hours,
    maintenance_result,
  } = body;

  const tenantFilter = addTenantFilter(req, 'pmp');
  const [plans] = await db.execute(
    `SELECT pmp.* FROM preventive_maintenance_plans pmp WHERE pmp.id = ? ${tenantFilter.whereClause}`,
    [id, ...tenantFilter.params],
  );

  if (plans.length === 0) {
    return {
      statusCode: 404,
      body: { success: false, message: '预防性维护计划不存在' },
    };
  }

  const plan = plans[0];

  if (plan.status !== '启用') {
    return {
      statusCode: 400,
      body: { success: false, message: '只能完成启用状态的计划' },
    };
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const createdBy = req.user.real_name || req.user.username || '系统管理员';
    // BUG-P3 修复：使用 plan.tenant_id 而非 req.user.tenant_id，确保超管跨租户操作正确
    const tenantId = plan.tenant_id;
    let maintenanceDateStr = maintenance_date || new Date().toISOString().split('T')[0];

    if (maintenanceDateStr instanceof Date) {
      maintenanceDateStr = maintenanceDateStr.toISOString().split('T')[0];
    } else if (typeof maintenanceDateStr === 'string' && maintenanceDateStr.includes('T')) {
      maintenanceDateStr = maintenanceDateStr.split('T')[0];
    }

    await connection.execute(
      `INSERT INTO maintenance_logs (
        tenant_id, asset_code, asset_name, maintenance_type, maintenance_date,
        maintenance_person, maintenance_content, maintenance_cost, parts_replaced,
        status, remark, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        plan.asset_code,
        plan.asset_name,
        '预防性维护',
        maintenanceDateStr,
        maintenance_person || plan.responsible_person,
        maintenance_content || plan.maintenance_content,
        maintenance_cost || 0,
        parts_replaced || null,
        '已完成',
        remark || null,
        createdBy,
      ],
    );

    let maintenanceDateValue = maintenance_date || new Date().toISOString().split('T')[0];
    if (maintenanceDateValue instanceof Date) {
      maintenanceDateValue = maintenanceDateValue.toISOString().split('T')[0];
    } else if (typeof maintenanceDateValue === 'string' && maintenanceDateValue.includes('T')) {
      maintenanceDateValue = maintenanceDateValue.split('T')[0];
    }

    let nextDate = new Date(maintenanceDateValue);
    const cycleValue = parseInt(plan.cycle_value, 10) || 1;
    const cycleType = plan.cycle_type || '按月';

    if (isNaN(nextDate.getTime())) {
      nextDate = new Date();
    }

    switch (cycleType) {
      case '按天':
        nextDate.setDate(nextDate.getDate() + cycleValue);
        break;
      case '按周':
        nextDate.setDate(nextDate.getDate() + cycleValue * 7);
        break;
      case '按月':
        nextDate.setMonth(nextDate.getMonth() + cycleValue);
        break;
      case '按季度':
        nextDate.setMonth(nextDate.getMonth() + cycleValue * 3);
        break;
      case '按年':
        nextDate.setFullYear(nextDate.getFullYear() + cycleValue);
        break;
      default:
        nextDate.setMonth(nextDate.getMonth() + cycleValue);
        break;
    }

    const lastMaintenanceDate = maintenanceDateValue;
    const nextMaintenanceDate = nextDate.toISOString().split('T')[0];

    await connection.execute(
      `UPDATE preventive_maintenance_plans SET
        last_maintenance_date = ?,
        next_maintenance_date = ?,
        updated_at = NOW()
      WHERE id = ? AND tenant_id = ?`,
      [lastMaintenanceDate, nextMaintenanceDate, id, tenantId],
    );

    try {
      const [historyTables] = await connection.execute(
        `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
         WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'maintenance_plan_history'`,
      );

      if (historyTables.length > 0) {
        // 动态检测表字段，避免字段不匹配导致 INSERT 失败
        const [historyCols] = await connection.execute(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'maintenance_plan_history'`,
        );
        const historyColNames = historyCols.map(c => c.COLUMN_NAME);

        const histInsertCols = [];
        const histInsertVals = [];

        // 拼接备注信息（maintenance_notes 字段）
        const notesParts = [];
        if (maintenance_content || plan.maintenance_content) notesParts.push(maintenance_content || plan.maintenance_content);
        if (parts_replaced) notesParts.push(`更换部件: ${parts_replaced}`);
        if (remark) notesParts.push(`备注: ${remark}`);

        const fieldMappings = {
          plan_id: id,
          maintenance_date: lastMaintenanceDate,
          maintenance_person: maintenance_person || plan.responsible_person,
          actual_hours: actual_hours || null,
          maintenance_result: maintenance_result || '正常',
          // 兼容不同字段名：maintenance_notes（实际表）或 maintenance_content（旧代码）
          maintenance_notes: notesParts.join('\n'),
          maintenance_content: maintenance_content || plan.maintenance_content,
          maintenance_cost: maintenance_cost || null,
          parts_replaced: parts_replaced || null,
          remark: remark || null,
        };

        for (const [col, val] of Object.entries(fieldMappings)) {
          if (historyColNames.includes(col)) {
            histInsertCols.push(col);
            histInsertVals.push(val);
          }
        }

        if (histInsertCols.length > 0) {
          const histPlaceholders = histInsertCols.map(() => '?').join(', ');
          await connection.execute(
            `INSERT INTO maintenance_plan_history (${histInsertCols.join(', ')}) VALUES (${histPlaceholders})`,
            histInsertVals,
          );
        }
      }
    } catch (historyError) {
      console.warn('记录维护历史失败:', historyError.message);
    }

    // 自动生成工单（如果计划开启了自动生成工单）
    await autoGenerateWorkOrder(connection, plan, {
      tenantId,
      maintenanceDateStr,
      createdBy,
      planId: id,
    });

    await connection.commit();

    return {
      statusCode: 200,
      body: { success: true, message: '预防性维护计划完成，已创建维护日志' },
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function deletePlan(id, req) {
  const tenantFilter = addTenantFilter(req, 'pmp');
  const [existing] = await db.execute(
    `SELECT id FROM preventive_maintenance_plans pmp WHERE pmp.id = ? ${tenantFilter.whereClause}`,
    [id, ...tenantFilter.params],
  );

  if (existing.length === 0) {
    return {
      statusCode: 404,
      body: { success: false, message: '预防性维护计划不存在' },
    };
  }

  await db.execute(
    `DELETE pmp FROM preventive_maintenance_plans pmp WHERE pmp.id = ? ${tenantFilter.whereClause.replace('WHERE', 'AND')}`,
    [id, ...tenantFilter.params],
  );

  return {
    statusCode: 200,
    body: { success: true, message: '预防性维护计划删除成功' },
  };
}

// 触发维护计划（用于使用量触发场景）：生成维护日志并标记触发记录为已处理
async function triggerPlan(id, body, req) {
  const { trigger_type, current_usage, remark } = body;

  const tenantFilter = addTenantFilter(req, 'pmp');
  const [plans] = await db.execute(
    `SELECT pmp.* FROM preventive_maintenance_plans pmp WHERE pmp.id = ? ${tenantFilter.whereClause}`,
    [id, ...tenantFilter.params],
  );

  if (plans.length === 0) {
    return {
      statusCode: 404,
      body: { success: false, message: '预防性维护计划不存在' },
    };
  }

  const plan = plans[0];

  if (plan.status !== '启用') {
    return {
      statusCode: 400,
      body: { success: false, message: '只能触发启用状态的计划' },
    };
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const createdBy = req.user.real_name || req.user.username || '系统管理员';
    // BUG-P3 修复：使用 plan.tenant_id 而非 req.user.tenant_id，确保超管跨租户操作正确
    const tenantId = plan.tenant_id;
    const maintenanceDateStr = new Date().toISOString().split('T')[0];

    // 1. 创建维护日志
    await connection.execute(
      `INSERT INTO maintenance_logs (
        tenant_id, asset_code, asset_name, maintenance_type, maintenance_date,
        maintenance_person, maintenance_content, maintenance_cost, parts_replaced,
        status, remark, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        plan.asset_code,
        plan.asset_name,
        '预防性维护',
        maintenanceDateStr,
        plan.responsible_person,
        plan.maintenance_content,
        0,
        null,
        '已完成',
        remark || (trigger_type === 'usage' ? '使用量触发维护' : '手动触发维护'),
        createdBy,
      ],
    );

    // 2. 更新计划的最后维护日期、下次维护日期；使用量触发时重置当前使用量
    let nextDate = new Date();
    const cycleValue = parseInt(plan.cycle_value, 10) || 1;
    const cycleType = plan.cycle_type || '按月';

    switch (cycleType) {
      case '按天':
        nextDate.setDate(nextDate.getDate() + cycleValue);
        break;
      case '按周':
        nextDate.setDate(nextDate.getDate() + cycleValue * 7);
        break;
      case '按月':
        nextDate.setMonth(nextDate.getMonth() + cycleValue);
        break;
      case '按季度':
        nextDate.setMonth(nextDate.getMonth() + cycleValue * 3);
        break;
      case '按年':
        nextDate.setFullYear(nextDate.getFullYear() + cycleValue);
        break;
      default:
        nextDate.setMonth(nextDate.getMonth() + cycleValue);
        break;
    }

    const nextMaintenanceDate = nextDate.toISOString().split('T')[0];

    if (trigger_type === 'usage') {
      // BUG-P1 修复：preventive_maintenance_plans 表无 last_usage_date 列，移除该字段
      await connection.execute(
        `UPDATE preventive_maintenance_plans SET
          last_maintenance_date = ?,
          next_maintenance_date = ?,
          current_usage = 0,
          updated_at = NOW()
        WHERE id = ? AND tenant_id = ?`,
        [maintenanceDateStr, nextMaintenanceDate, id, tenantId],
      );
    } else {
      await connection.execute(
        `UPDATE preventive_maintenance_plans SET
          last_maintenance_date = ?,
          next_maintenance_date = ?,
          updated_at = NOW()
        WHERE id = ? AND tenant_id = ?`,
        [maintenanceDateStr, nextMaintenanceDate, id, tenantId],
      );
    }

    // 3. 自动生成工单（如果计划开启了自动生成工单）
    await autoGenerateWorkOrder(connection, plan, {
      tenantId,
      maintenanceDateStr,
      createdBy,
      planId: id,
    });

    // 4. 标记 maintenance_usage_triggered 表中该计划的触发记录为已处理
    try {
      const [triggerTables] = await connection.execute(
        `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
         WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'maintenance_usage_triggered'`,
      );

      if (triggerTables.length > 0) {
        // 动态检测 updated_at 列是否存在
        let setClause = "status = 'processed', processed_at = NOW()";
        try {
          const [cols] = await connection.execute(
            `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
             AND TABLE_NAME = 'maintenance_usage_triggered'`,
          );
          const colNames = cols.map(c => c.COLUMN_NAME);
          if (colNames.includes('updated_at')) {
            setClause += ', updated_at = NOW()';
          }
        } catch (e) {
          // 检测失败时使用基础字段
        }

        await connection.execute(
          `UPDATE maintenance_usage_triggered
           SET ${setClause}
           WHERE plan_id = ? AND tenant_id = ? AND status IN ('pending', 'triggered')`,
          [id, tenantId],
        );
      }
    } catch (triggerError) {
      console.warn('更新触发记录状态失败:', triggerError.message);
    }

    await connection.commit();

    return {
      statusCode: 200,
      body: {
        success: true,
        message: '维护计划已触发，已生成维护日志并重置使用量',
        data: { maintenance_date: maintenanceDateStr, next_maintenance_date: nextMaintenanceDate },
      },
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getPlanHistory(id, req) {
  const tenantFilter = addTenantFilter(req, 'pmp');
  const [planCheck] = await db.execute(
    `SELECT id FROM preventive_maintenance_plans pmp WHERE pmp.id = ? ${tenantFilter.whereClause}`,
    [id, ...tenantFilter.params],
  );

  if (planCheck.length === 0) {
    return {
      statusCode: 404,
      body: { success: false, message: '预防性维护计划不存在' },
    };
  }

  const [rows] = await db.execute(
    `SELECT mph.* FROM maintenance_plan_history mph
     INNER JOIN preventive_maintenance_plans pmp ON mph.plan_id = pmp.id
     WHERE mph.plan_id = ? ${tenantFilter.whereClause}
     ORDER BY mph.maintenance_date DESC, mph.created_at DESC`,
    [id, ...tenantFilter.params],
  );

  return {
    statusCode: 200,
    body: { success: true, data: rows },
  };
}

/**
 * 自动生成工单（当计划的 auto_generate_workorder 为 true 时）
 * 检测 work_orders 或 maintenance_workorders 表是否存在，动态适配列结构
 * 内部版本：使用传入的 connection（事务内调用）
 */
async function autoGenerateWorkOrder(connection, plan, { tenantId, maintenanceDateStr, createdBy, planId }) {
  if (!plan.auto_generate_workorder) return;

  try {
    // 1. 检查工单表是否存在
    const [tables] = await connection.execute(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME IN ('work_orders', 'maintenance_workorders')
       ORDER BY TABLE_NAME`,
    );

    if (tables.length === 0) {
      console.warn('自动生成工单: 未找到工单表 (work_orders / maintenance_workorders)');
      return;
    }

    const tableName = tables[0].TABLE_NAME;

    // 2. 检测表的列结构
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?`,
      [tableName],
    );
    const columnMap = {};
    for (const col of columns) {
      columnMap[col.COLUMN_NAME] = col.DATA_TYPE;
    }
    const columnNames = Object.keys(columnMap);

    // 3. 生成工单编号
    const workOrderNo = `WO${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

    // 4. 动态构建插入字段和值
    const fields = [];
    const values = [];

    if (columnNames.includes('work_order_no')) {
      fields.push('work_order_no');
      values.push(workOrderNo);
    }

    if (columnNames.includes('tenant_id')) {
      fields.push('tenant_id');
      values.push(tenantId);
    }

    if (columnNames.includes('asset_code')) {
      fields.push('asset_code');
      values.push(plan.asset_code);
    }

    if (columnNames.includes('asset_name')) {
      fields.push('asset_name');
      values.push(plan.asset_name);
    }

    if (columnNames.includes('title')) {
      fields.push('title');
      values.push(`[预防性维护] ${plan.plan_name}`);
    }

    if (columnNames.includes('description')) {
      fields.push('description');
      values.push(plan.maintenance_content || null);
    }

    // priority: work_orders 使用 ENUM('low','normal','high','urgent')，maintenance_workorders 使用 INT
    if (columnNames.includes('priority')) {
      fields.push('priority');
      if (columnMap['priority'] === 'enum') {
        values.push('normal'); // ENUM 中 normal 对应"中"优先级
      } else {
        values.push(3); // INT 中 3 对应"中"优先级
      }
    }

    if (columnNames.includes('status')) {
      fields.push('status');
      values.push('pending');
    }

    if (columnNames.includes('maintenance_type')) {
      fields.push('maintenance_type');
      values.push('预防性维护');
    }

    if (columnNames.includes('planned_start_date')) {
      fields.push('planned_start_date');
      values.push(maintenanceDateStr);
    }

    if (columnNames.includes('planned_end_date')) {
      fields.push('planned_end_date');
      values.push(maintenanceDateStr);
    }

    // source_type: work_orders 的 ENUM 中无 'plan' 值，使用 'preventive'
    if (columnNames.includes('source_type')) {
      fields.push('source_type');
      if (columnMap['source_type'] === 'enum') {
        values.push('preventive'); // work_orders ENUM 中最接近"计划"的值
      } else {
        values.push('plan');
      }
    }

    if (columnNames.includes('source_id')) {
      fields.push('source_id');
      values.push(planId);
    }

    // work_orders 表用 maintenance_plan_id 关联计划
    if (columnNames.includes('maintenance_plan_id')) {
      fields.push('maintenance_plan_id');
      values.push(planId);
    }

    if (columnNames.includes('assigned_to')) {
      fields.push('assigned_to');
      values.push(plan.responsible_person || null);
    }

    if (columnNames.includes('created_by')) {
      fields.push('created_by');
      values.push(createdBy);
    }

    if (fields.length === 0) {
      console.warn('自动生成工单: 未匹配到可插入的列');
      return;
    }

    // 5. 执行插入
    const placeholders = fields.map(() => '?').join(', ');
    await connection.execute(
      `INSERT INTO ${tableName} (${fields.join(', ')}) VALUES (${placeholders})`,
      values,
    );

    console.log(`自动生成工单成功: ${workOrderNo} (表: ${tableName}, 计划ID: ${planId})`);
  } catch (error) {
    console.warn('自动生成工单失败:', error.message);
  }
}

/**
 * 自动生成工单（外部调用版本，不依赖事务）
 * 供 scheduler 等场景独立调用；计划必须开启 auto_generate_workorder
 * @param {Object} plan 计划对象（必须包含 auto_generate_workorder）
 * @param {Object} opts { tenantId, maintenanceDateStr, createdBy, planId }
 * @returns {Promise<{success:boolean, workOrderNo?:string, error?:string}>}
 */
async function createWorkOrderForPlan(plan, { tenantId, maintenanceDateStr, createdBy, planId }) {
  if (!plan || !plan.auto_generate_workorder) {
    return { success: false, error: '计划未开启 auto_generate_workorder' };
  }

  const connection = await db.getConnection();
  try {
    await autoGenerateWorkOrder(connection, plan, {
      tenantId,
      maintenanceDateStr,
      createdBy,
      planId,
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  } finally {
    connection.release();
  }
}

module.exports = {
  getPlans,
  getPlan,
  createPlan,
  createPlansBatch,
  previewBatchAssets,
  resolveAssetCodesFromFilters,
  normalizeBatchInput,
  updatePlan,
  completePlan,
  triggerPlan,
  deletePlan,
  getPlanHistory,
  createWorkOrderForPlan,
};
