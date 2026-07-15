const db = require('../../config/database');
const { addTenantFilter, getTenantId } = require('../../middleware/tenant-filter');

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function requireScopedTenantId(req) {
  const tenantId = getTenantId(req);
  if (tenantId == null) {
    throw createHttpError(
      400,
      req.user?.role === 'super_admin' ? '请先选择企业空间' : '当前用户未分配企业空间',
    );
  }
  return tenantId;
}

function parseTemplateRow(row) {
  try {
    return {
      ...row,
      maintenance_items: row.maintenance_items
        ? typeof row.maintenance_items === 'string'
          ? JSON.parse(row.maintenance_items)
          : row.maintenance_items
        : [],
      required_materials: row.required_materials
        ? typeof row.required_materials === 'string'
          ? JSON.parse(row.required_materials)
          : row.required_materials
        : [],
    };
  } catch (error) {
    console.warn('解析模板JSON字段失败:', error.message);
    return {
      ...row,
      maintenance_items: [],
      required_materials: [],
    };
  }
}

function safeJSONStringify(value) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  try {
    return JSON.stringify(value);
  } catch (error) {
    throw createHttpError(400, 'JSON字段格式错误');
  }
}

async function getLegacyTemplates(query, req) {
  const { page = 1, pageSize = 20, asset_type, brand, model, keyword } = query;
  const pageNumber = parseInt(page, 10);
  const limit = parseInt(pageSize, 10);
  const offset = (pageNumber - 1) * limit;

  let whereClause = 'WHERE 1=1';
  const params = [];

  const tenantFilter = addTenantFilter(req, 'mt');
  whereClause += tenantFilter.whereClause;
  params.push(...tenantFilter.params);

  if (asset_type) {
    whereClause += ' AND mt.asset_type = ?';
    params.push(asset_type);
  }
  if (brand) {
    whereClause += ' AND mt.brand = ?';
    params.push(brand);
  }
  if (model) {
    whereClause += ' AND mt.model = ?';
    params.push(model);
  }
  if (keyword) {
    whereClause += ' AND (mt.template_name LIKE ? OR mt.maintenance_content LIKE ?)';
    const keywordParam = `%${keyword}%`;
    params.push(keywordParam, keywordParam);
  }

  const [countResult] = await db.execute(
    `SELECT COUNT(*) as total FROM maintenance_templates mt ${whereClause}`,
    params,
  );
  const {total} = countResult[0];

  const [rows] = await db.execute(
    `SELECT mt.* FROM maintenance_templates mt
     ${whereClause}
     ORDER BY mt.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return {
    success: true,
    data: rows,
    pagination: {
      page: pageNumber,
      pageSize: limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

async function createTemplate(body, req) {
  const {
    template_name,
    asset_type,
    brand,
    model,
    maintenance_items,
    cycle_type,
    cycle_value,
    estimated_hours,
    required_materials,
    maintenance_content,
    status,
  } = body;

  if (!template_name || !cycle_type || !cycle_value) {
    throw createHttpError(400, '模板名称、周期类型和周期值不能为空');
  }

  const tenantId = requireScopedTenantId(req);
  const createdBy = req.user.real_name || req.user.username;

  const [result] = await db.execute(
    `INSERT INTO maintenance_templates (
      tenant_id, template_name, asset_type, brand, model, maintenance_items,
      cycle_type, cycle_value, estimated_hours, required_materials,
      maintenance_content, status, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tenantId,
      template_name,
      asset_type || null,
      brand || null,
      model || null,
      maintenance_items ? safeJSONStringify(maintenance_items) : null,
      cycle_type,
      cycle_value,
      estimated_hours || null,
      required_materials ? safeJSONStringify(required_materials) : null,
      maintenance_content || null,
      status || '启用',
      createdBy,
    ],
  );

  return {
    success: true,
    message: '维护计划模板创建成功',
    data: { id: result.insertId },
  };
}

async function updateTemplate(id, body, req) {
  return updateLegacyTemplate(id, body, req);
}

async function deleteTemplate(id, req) {
  return deleteLegacyTemplate(id, req);
}

async function recommendTemplates(query, req) {
  const { asset_type, brand, model } = query;

  if (!asset_type) {
    throw createHttpError(400, '资产类型不能为空');
  }

  const brandVal = brand || null;
  const modelVal = model || null;

  const tenantFilter = addTenantFilter(req, 'mt');

  const sql = `
    SELECT
      mt.*,
      CASE
        WHEN mt.asset_type = ? AND mt.brand = ? AND mt.model = ? THEN 3
        WHEN mt.asset_type = ? AND mt.brand = ? THEN 2
        WHEN mt.asset_type = ? THEN 1
        ELSE 0
      END as match_score
    FROM maintenance_templates mt
    WHERE mt.status = '启用'
      ${tenantFilter.whereClause}
      AND (
      (mt.asset_type = ? AND mt.brand = ? AND mt.model = ?) OR
      (mt.asset_type = ? AND mt.brand = ?) OR
      (mt.asset_type = ?)
    )
    ORDER BY match_score DESC, mt.created_at DESC
    LIMIT 10
  `;

  const params = [
    asset_type,
    brandVal,
    modelVal,
    asset_type,
    brandVal,
    asset_type,
    ...tenantFilter.params,
    asset_type,
    brandVal,
    modelVal,
    asset_type,
    brandVal,
    asset_type,
  ];

  const [rows] = await db.execute(sql, params);
  const parsedTemplates = rows.map(parseTemplateRow);

  return {
    success: true,
    data: parsedTemplates,
    message: '推荐模板获取成功',
    request_params: { asset_type, brand, model },
    timestamp: new Date().toISOString(),
    match_count: parsedTemplates.length,
  };
}

async function getTemplates(query, req) {
  const { asset_type, brand, model, status, asset_code } = query;

  try {
    const [tables] = await db.execute(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'maintenance_templates'`,
    );

    if (tables.length === 0) {
      return {
        success: true,
        data: [],
      };
    }
  } catch (checkError) {
    console.warn('检查表结构失败:', checkError.message);
  }

  let whereClause = 'WHERE 1=1';
  const params = [];

  const tenantFilter = addTenantFilter(req, 'mt');
  whereClause += tenantFilter.whereClause;
  params.push(...tenantFilter.params);

  if (asset_code) {
    const assetTenantFilter = addTenantFilter(req, 'a');
    const [assets] = await db.execute(
      `SELECT ac.name as asset_type, a.brand, a.model FROM assets a
       LEFT JOIN asset_categories ac ON a.category_id = ac.id
       WHERE a.asset_code = ? AND a.is_deleted = 0 ${assetTenantFilter.whereClause}`,
      [asset_code, ...assetTenantFilter.params],
    );

    if (assets.length > 0) {
      const asset = assets[0];
      if (asset.asset_type) {
        whereClause += ' AND (mt.asset_type = ? OR mt.asset_type IS NULL)';
        params.push(asset.asset_type);
      }
      if (asset.brand) {
        whereClause += ' AND (mt.brand = ? OR mt.brand IS NULL)';
        params.push(asset.brand);
      }
      if (asset.model) {
        whereClause += ' AND (mt.model = ? OR mt.model IS NULL)';
        params.push(asset.model);
      }
    }
  } else {
    if (asset_type) {
      whereClause += ' AND mt.asset_type = ?';
      params.push(asset_type);
    }
    if (brand) {
      whereClause += ' AND mt.brand = ?';
      params.push(brand);
    }
    if (model) {
      whereClause += ' AND mt.model = ?';
      params.push(model);
    }
  }

  if (status) {
    whereClause += ' AND mt.status = ?';
    params.push(status);
  } else {
    whereClause += ' AND mt.status = ?';
    params.push('启用');
  }

  const [rows] = await db.execute(
    `SELECT mt.* FROM maintenance_templates mt ${whereClause} ORDER BY mt.created_at DESC`,
    params,
  );

  return {
    success: true,
    data: rows.map(parseTemplateRow),
  };
}

async function recommendByAsset(assetCode, req) {
  if (!assetCode) {
    throw createHttpError(400, '资产编号不能为空');
  }

  try {
    const [tables] = await db.execute(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'maintenance_templates'`,
    );

    if (tables.length === 0) {
      return {
        success: true,
        data: [],
      };
    }
  } catch (checkError) {
    console.warn('检查表结构失败:', checkError.message);
  }

  const assetTenantFilter = addTenantFilter(req, 'a');
  const [assets] = await db.execute(
    `SELECT ac.name as asset_type, a.brand, a.model FROM assets a
     LEFT JOIN asset_categories ac ON a.category_id = ac.id
     WHERE a.asset_code = ? AND a.is_deleted = 0 ${assetTenantFilter.whereClause}`,
    [assetCode, ...assetTenantFilter.params],
  );

  if (assets.length === 0) {
    throw createHttpError(404, '资产不存在');
  }

  const asset = assets[0];
  let whereClause = 'WHERE 1=1';
  const params = [];

  const tenantFilter = addTenantFilter(req, 'mt');
  whereClause += tenantFilter.whereClause;
  params.push(...tenantFilter.params);

  whereClause += ' AND mt.status = ?';
  params.push('启用');

  const conditions = [];
  if (asset.asset_type) {
    conditions.push('mt.asset_type = ?');
    params.push(asset.asset_type);
  }
  if (asset.brand) {
    conditions.push('mt.brand = ?');
    params.push(asset.brand);
  }
  if (asset.model) {
    conditions.push('mt.model = ?');
    params.push(asset.model);
  }

  if (conditions.length > 0) {
    whereClause += ` AND (${conditions.join(' OR ')})`;
  }

  let orderBy = 'ORDER BY ';
  const orderConditions = [];
  if (asset.asset_type) {
    orderConditions.push('(mt.asset_type = ?) DESC');
    params.push(asset.asset_type);
  }
  if (asset.brand) {
    orderConditions.push('(mt.brand = ?) DESC');
    params.push(asset.brand);
  }
  if (asset.model) {
    orderConditions.push('(mt.model = ?) DESC');
    params.push(asset.model);
  }
  orderConditions.push('mt.created_at DESC');
  orderBy += orderConditions.join(', ');

  const [rows] = await db.execute(
    `SELECT mt.* FROM maintenance_templates mt ${whereClause} ${orderBy}`,
    params,
  );

  const templates = rows.map(row => {
    const parsed = parseTemplateRow(row);
    return {
      ...parsed,
      match_score:
        (row.asset_type === asset.asset_type ? 3 : 0) +
        (row.brand === asset.brand ? 2 : 0) +
        (row.model === asset.model ? 1 : 0),
    };
  });

  templates.sort((a, b) => b.match_score - a.match_score);

  return {
    success: true,
    data: templates,
    asset_info: asset,
  };
}

async function getLegacyTemplate(id, req) {
  const tenantFilter = addTenantFilter(req, 'mt');
  const [rows] = await db.execute(
    `SELECT mt.* FROM maintenance_templates mt WHERE mt.id = ? ${tenantFilter.whereClause}`,
    [id, ...tenantFilter.params],
  );

  if (rows.length === 0) {
    throw createHttpError(404, '维护计划模板不存在');
  }

  return {
    success: true,
    data: parseTemplateRow(rows[0]),
  };
}

async function createLegacyTemplate(body, req) {
  const {
    template_name,
    asset_type,
    brand,
    model,
    maintenance_items,
    cycle_type,
    cycle_value,
    estimated_hours,
    required_materials,
    maintenance_content,
    status,
  } = body;

  if (!template_name) {
    throw createHttpError(400, '模板名称不能为空');
  }

  const createdBy = req.user.real_name || req.user.username || '系统管理员';
  const tenantId = getTenantId(req);

  const [result] = await db.execute(
    `INSERT INTO maintenance_templates (
      tenant_id, template_name, asset_type, brand, model, maintenance_items,
      cycle_type, cycle_value, estimated_hours, required_materials,
      maintenance_content, status, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tenantId,
      template_name,
      asset_type || null,
      brand || null,
      model || null,
      maintenance_items ? safeJSONStringify(maintenance_items) : null,
      cycle_type || null,
      cycle_value || null,
      estimated_hours || null,
      required_materials ? safeJSONStringify(required_materials) : null,
      maintenance_content || null,
      status || '启用',
      createdBy,
    ],
  );

  return {
    success: true,
    message: '维护计划模板创建成功',
    data: { id: result.insertId },
  };
}

async function updateLegacyTemplate(id, body, req) {
  const {
    template_name,
    asset_type,
    brand,
    model,
    maintenance_items,
    cycle_type,
    cycle_value,
    estimated_hours,
    required_materials,
    maintenance_content,
    status,
  } = body;

  const updateFields = [];
  const updateValues = [];

  if (template_name !== undefined) {
    updateFields.push('template_name = ?');
    updateValues.push(template_name);
  }
  if (asset_type !== undefined) {
    updateFields.push('asset_type = ?');
    updateValues.push(asset_type);
  }
  if (brand !== undefined) {
    updateFields.push('brand = ?');
    updateValues.push(brand);
  }
  if (model !== undefined) {
    updateFields.push('model = ?');
    updateValues.push(model);
  }
  if (maintenance_items !== undefined) {
    updateFields.push('maintenance_items = ?');
    updateValues.push(maintenance_items ? safeJSONStringify(maintenance_items) : null);
  }
  if (cycle_type !== undefined) {
    updateFields.push('cycle_type = ?');
    updateValues.push(cycle_type);
  }
  if (cycle_value !== undefined) {
    updateFields.push('cycle_value = ?');
    updateValues.push(cycle_value);
  }
  if (estimated_hours !== undefined) {
    updateFields.push('estimated_hours = ?');
    updateValues.push(estimated_hours);
  }
  if (required_materials !== undefined) {
    updateFields.push('required_materials = ?');
    updateValues.push(required_materials ? safeJSONStringify(required_materials) : null);
  }
  if (maintenance_content !== undefined) {
    updateFields.push('maintenance_content = ?');
    updateValues.push(maintenance_content);
  }
  if (status !== undefined) {
    updateFields.push('status = ?');
    updateValues.push(status);
  }

  if (updateFields.length === 0) {
    throw createHttpError(400, '没有要更新的字段');
  }

  updateFields.push('updated_at = NOW()');

  const tenantFilter = addTenantFilter(req, 'mt');
  const [existing] = await db.execute(
    `SELECT id FROM maintenance_templates mt WHERE mt.id = ? ${tenantFilter.whereClause}`,
    [id, ...tenantFilter.params],
  );

  if (existing.length === 0) {
    throw createHttpError(404, '维护计划模板不存在');
  }

  updateValues.push(id);

  await db.execute(
    `UPDATE maintenance_templates mt SET ${updateFields.join(', ')} WHERE mt.id = ? ${tenantFilter.whereClause.replace('WHERE', 'AND')}`,
    [...updateValues, ...tenantFilter.params],
  );

  return { success: true, message: '维护计划模板更新成功' };
}

async function deleteLegacyTemplate(id, req) {
  const tenantFilter = addTenantFilter(req, 'mt');
  const [existing] = await db.execute(
    `SELECT id FROM maintenance_templates mt WHERE mt.id = ? ${tenantFilter.whereClause}`,
    [id, ...tenantFilter.params],
  );

  if (existing.length === 0) {
    throw createHttpError(404, '维护计划模板不存在');
  }

  await db.execute(
    `DELETE mt FROM maintenance_templates mt WHERE mt.id = ? ${tenantFilter.whereClause.replace('WHERE', 'AND')}`,
    [id, ...tenantFilter.params],
  );

  return { success: true, message: '维护计划模板删除成功' };
}

// 预防性维护计划模板库（医疗设备 + 基础设施设备）
// 新增租户或执行 seed 脚本时自动生成，按 template_name 幂等去重
const DEFAULT_MEDICAL_TEMPLATES = [
  // ========== 医疗设备类（现有 8 条） ==========
  {
    template_name: '影像设备（CT/MR/DR）月度预防性维护',
    asset_type: '影像设备',
    cycle_type: '按月',
    cycle_value: 1,
    estimated_hours: 2.50,
    maintenance_content: '关注图像质量漂移、机械运动精度和温控散热状态，异常及时升级处理。',
    maintenance_items: ['检查机架/滑环/运动机构状态与异响', '检查探测器、球管、准直器运行状态', '进行系统自检并记录错误码', '检查接地、电源质量与UPS告警', '清洁进风口、滤网与关键散热通道'],
    required_materials: ['防静电清洁耗材', '润滑维护包', '电气测试工具'],
  },
  {
    template_name: '超声设备季度预防性维护',
    asset_type: '超声设备',
    cycle_type: '按季度',
    cycle_value: 1,
    estimated_hours: 1.50,
    maintenance_content: '重点保障探头完好率与成像稳定性，防止因线缆老化导致故障停机。',
    maintenance_items: ['检查探头外观、线缆折损与接口松动', '执行灰阶/彩超成像一致性检查', '检查触控面板、按键与脚踏开关', '检查网络打印与DICOM传输', '清洁风道并确认散热风扇工况'],
    required_materials: ['探头清洁剂', '接口保护套', '绝缘清洁布'],
  },
  {
    template_name: '生命体征监护设备月度预防性维护',
    asset_type: '监护设备',
    cycle_type: '按月',
    cycle_value: 1,
    estimated_hours: 1.00,
    maintenance_content: '以报警可靠性和监测准确性为核心，确保临床连续监测安全。',
    maintenance_items: ['检查ECG/SpO2/NIBP模块采集稳定性', '检查报警音量、报警阈值与日志', '检查电池健康度与续航', '检查导联线、血氧夹与袖带状态', '核对设备时间同步与网络连通'],
    required_materials: ['导联线备件', '袖带备件', '电池检测工具'],
  },
  {
    template_name: '呼吸机/麻醉机月度预防性维护',
    asset_type: '呼吸治疗设备',
    cycle_type: '按月',
    cycle_value: 1,
    estimated_hours: 2.00,
    maintenance_content: '重点排查气路与传感器风险，保障通气参数准确与报警可用。',
    maintenance_items: ['检查气路密封性与漏气测试', '检查流量/压力传感器零点漂移', '检查氧浓度监测与报警联动', '检查加温加湿与冷凝水管理', '检查后备电源与断电保护'],
    required_materials: ['气路密封件', '过滤器', '校准工装'],
  },
  {
    template_name: '输注泵设备季度预防性维护',
    asset_type: '输注设备',
    cycle_type: '按季度',
    cycle_value: 1,
    estimated_hours: 1.00,
    maintenance_content: '围绕输注精度、报警有效性与电源可靠性进行周期维护。',
    maintenance_items: ['检查推进机构磨损与卡阻', '检查流速精度与堵塞报警', '检查电池与充电底座状态', '检查键盘、屏幕与按键反馈', '校核设备参数与软件版本'],
    required_materials: ['推进机构保养件', '流速校准工具'],
  },
  {
    template_name: '血液净化设备月度预防性维护',
    asset_type: '血液净化设备',
    cycle_type: '按月',
    cycle_value: 1,
    estimated_hours: 2.00,
    maintenance_content: '重点控制液路安全与传感器精度，确保透析治疗过程稳定。',
    maintenance_items: ['检查血泵与比例泵运行噪声', '检查导电度/温度/压力传感器', '检查液路密封与泄漏情况', '执行消毒程序并核对日志', '检查报警系统与紧急停机功能'],
    required_materials: ['液路密封件', '传感器校准液', '消毒耗材'],
  },
  {
    template_name: '检验分析设备季度预防性维护',
    asset_type: '检验设备',
    cycle_type: '按季度',
    cycle_value: 1,
    estimated_hours: 2.00,
    maintenance_content: '围绕检测准确性与重复性，建立校准-质控-告警闭环。',
    maintenance_items: ['检查样本针、反应杯与清洗机构', '检查光学系统污染与漂移', '执行质控样本并校验结果偏差', '检查试剂仓温控与耗材寿命', '核查异常日志与错误码趋势'],
    required_materials: ['清洗液', '质控品', '校准品'],
  },
  {
    template_name: '灭菌设备季度预防性维护',
    asset_type: '灭菌设备',
    cycle_type: '按季度',
    cycle_value: 1,
    estimated_hours: 1.50,
    maintenance_content: '保障灭菌参数可追溯与联锁安全，降低灭菌失败风险。',
    maintenance_items: ['检查门封、腔体与真空系统密封', '检查温度/压力传感器一致性', '检查蒸汽发生与排水系统', '执行生物/化学监测记录核查', '检查安全联锁与超压保护'],
    required_materials: ['门封保养件', '生物监测包', '传感器校验工装'],
  },
  // ========== 医疗设备类（新增 10 条） ==========
  {
    template_name: '手术设备月度预防性维护',
    asset_type: '手术设备',
    cycle_type: '按月',
    cycle_value: 1,
    estimated_hours: 2.50,
    maintenance_content: '关注手术床运动精度、无影灯照度与电刀输出稳定性，保障手术安全。',
    maintenance_items: ['检查手术床升降/倾斜/平移功能与锁定', '检查无影灯照度、色温与灯泡寿命', '检查高频电刀输出功率与负极板回路报警', '检查控制台按键、脚踏开关与紧急停止', '检查电源线、接地与漏电流'],
    required_materials: ['电刀测试仪', '照度计', '清洁消毒耗材'],
  },
  {
    template_name: '内窥镜设备季度预防性维护',
    asset_type: '内窥镜设备',
    cycle_type: '按季度',
    cycle_value: 1,
    estimated_hours: 2.00,
    maintenance_content: '重点关注镜体密封性、图像质量与清洗消毒效果。',
    maintenance_items: ['检查镜体外观、弯曲角度与插入部损伤', '进行漏水测试检查镜体密封性', '检查图像清晰度、色彩与噪点', '检查光源、送气送水与吸引功能', '检查清洗消毒机运行与消毒效果监测'],
    required_materials: ['漏水测试器', '清洗消毒耗材', '光源灯泡'],
  },
  {
    template_name: '口腔设备季度预防性维护',
    asset_type: '口腔设备',
    cycle_type: '按季度',
    cycle_value: 1,
    estimated_hours: 1.50,
    maintenance_content: '保障牙椅气水路、手机转速与影像系统正常。',
    maintenance_items: ['检查综合治疗台气路、水路与吸唾器', '检查高速/低速手机运转与轴承状态', '检查口腔影像设备曝光与图像质量', '检查灯光、椅位调节与脚踏控制', '检查水路消毒与生物膜污染'],
    required_materials: ['手机润滑保养包', '水路消毒剂', '气路清洁剂'],
  },
  {
    template_name: '康复理疗设备季度预防性维护',
    asset_type: '康复设备',
    cycle_type: '按季度',
    cycle_value: 1,
    estimated_hours: 1.50,
    maintenance_content: '关注理疗输出参数准确性与运动设备机械安全。',
    maintenance_items: ['检查电疗/光疗/磁疗输出参数与定时', '检查运动训练设备机械结构与紧急停止', '检查牵引设备拉力校准与安全保护', '检查治疗床/椅调节与锁定机构', '检查接地、漏电流与电磁兼容'],
    required_materials: ['输出参数测试仪', '润滑脂', '清洁耗材'],
  },
  {
    template_name: '婴儿培养箱月度预防性维护',
    asset_type: '婴儿培养箱',
    cycle_type: '按月',
    cycle_value: 1,
    estimated_hours: 1.50,
    maintenance_content: '重点保障温度湿度控制精度与婴儿安全防护。',
    maintenance_items: ['校准箱内温度与湿度传感器', '检查加热、加湿与风道循环系统', '检查氧浓度监测与报警', '检查床板倾斜、挡板与紧急报警', '检查漏电流与接地保护'],
    required_materials: ['温湿度校准仪', '氧浓度校准气体', '消毒耗材'],
  },
  {
    template_name: '除颤器月度预防性维护',
    asset_type: '除颤设备',
    cycle_type: '按月',
    cycle_value: 1,
    estimated_hours: 0.50,
    maintenance_content: '确保除颤能量输出准确与急救可用性。',
    maintenance_items: ['测试除颤能量输出（10J/50J/150J/200J/360J）', '检查电池电量与充电时间', '检查心电监护与起搏功能', '检查电极板/电极片与导联线', '检查自检日志与报警'],
    required_materials: ['除颤测试仪', '测试负载', '备用电池'],
  },
  {
    template_name: '心电图机季度预防性维护',
    asset_type: '心电设备',
    cycle_type: '按季度',
    cycle_value: 1,
    estimated_hours: 1.00,
    maintenance_content: '保障心电信号采集质量与导联完整性。',
    maintenance_items: ['检查导联线连通性与屏蔽干扰', '校验标准信号1mV幅度与方波', '检查记录纸、打印头与走纸速度', '检查滤波、共模抑制比与噪声', '检查接地与漏电流'],
    required_materials: ['心电模拟器', '导联线测试器', '记录纸'],
  },
  {
    template_name: '放射治疗设备月度预防性维护',
    asset_type: '放疗设备',
    cycle_type: '按月',
    cycle_value: 1,
    estimated_hours: 3.00,
    maintenance_content: '严格保障剂量输出精度与放射防护安全。',
    maintenance_items: ['校准输出剂量与射线质', '检查机架、床、准直器运动精度与等中心', '检查MLC多叶光栅到位精度', '检查安全联锁、紧急停止与门禁', '检查图像引导（EPID/CBCT）功能', '测试辐射防护与剂量监测'],
    required_materials: ['剂量仪', '水模体', '等中心指示器', '防护检测仪'],
  },
  {
    template_name: '高压氧舱月度预防性维护',
    asset_type: '高压氧舱',
    cycle_type: '按月',
    cycle_value: 1,
    estimated_hours: 2.00,
    maintenance_content: '重点关注压力容器安全与氧浓度控制。',
    maintenance_items: ['检查舱体密封性与压力升降曲线', '校验压力表、安全阀与紧急泄压', '检查氧浓度监测与空调通风', '检查对讲、监控与应急呼叫', '检查静电消除与消防系统', '检查气源、阀门与管路密封'],
    required_materials: ['压力校验仪', '氧浓度校准气体', '密封件'],
  },
  {
    template_name: '麻醉机月度预防性维护',
    asset_type: '麻醉设备',
    cycle_type: '按月',
    cycle_value: 1,
    estimated_hours: 2.00,
    maintenance_content: '保障麻醉气体输送精度与呼吸回路安全。',
    maintenance_items: ['校验挥发罐输出浓度', '检查流量计、气体回路与快速充氧', '检查呼吸回路密封性与APL阀', '检查潮气量、压力与氧浓度监测', '测试报警与低氧保护', '检查吸收罐与二氧化碳吸收剂'],
    required_materials: ['麻醉气体浓度仪', '回路密封测试器', '二氧化碳吸收剂'],
  },
  // ========== 基础设施设备类（现有 5 条） ==========
  {
    template_name: '医用电梯月度预防性维护',
    asset_type: '电梯设备',
    cycle_type: '按月',
    cycle_value: 1,
    estimated_hours: 2.00,
    maintenance_content: '重点保障电梯安全联锁和应急能力，降低停梯与困人风险。',
    maintenance_items: ['检查曳引机、制动器与限速器工作状态', '检查门机开闭、门锁回路与防夹功能', '检查轿厢平层精度与运行振动噪声', '检查应急照明、对讲与报警装置', '核查维保记录与故障闭环处理'],
    required_materials: ['门机保养件', '润滑油脂', '电气检测工具'],
  },
  {
    template_name: '车辆设备季度预防性维护',
    asset_type: '车辆设备',
    cycle_type: '按季度',
    cycle_value: 1,
    estimated_hours: 2.00,
    maintenance_content: '以行车安全与可靠出勤为核心，控制车辆故障导致的转运风险。',
    maintenance_items: ['检查制动系统、转向系统与轮胎磨损', '检查发动机/电机、冷却系统与皮带状态', '检查蓄电池、电路与灯光信号系统', '检查车载急救/转运附属装置固定性', '核查保险、年检与维保里程记录'],
    required_materials: ['机油/滤芯', '制动液', '轮胎检测工具'],
  },
  {
    template_name: '中央空调系统月度预防性维护',
    asset_type: '中央空调设备',
    cycle_type: '按月',
    cycle_value: 1,
    estimated_hours: 2.50,
    maintenance_content: '重点保障温湿度稳定与能效运行，减少区域温控异常。',
    maintenance_items: ['检查主机运行参数（压力、温度、电流）', '检查冷却塔、冷冻/冷却水泵振动与泄漏', '检查过滤器、盘管与风阀执行机构', '检查新风与回风比例及风量平衡', '检查控制系统告警与联动逻辑'],
    required_materials: ['滤网耗材', '水处理药剂', '振动检测工具'],
  },
  {
    template_name: '手术室层流系统月度预防性维护',
    asset_type: '手术室层流设备',
    cycle_type: '按月',
    cycle_value: 1,
    estimated_hours: 2.00,
    maintenance_content: '以洁净等级、压差与温湿度稳定为核心，保障手术环境安全。',
    maintenance_items: ['检查高效过滤器压差与更换阈值', '检查送风机、回风机与风速均匀性', '检查温湿度与压差传感器校准状态', '检查手术室正压维持与门禁联动', '核查空气洁净度监测记录与报警'],
    required_materials: ['压差计校准件', '高效过滤器备件', '风速测试仪'],
  },
  {
    template_name: 'UPS不间断电源月度预防性维护',
    asset_type: '不间断电源设备',
    cycle_type: '按月',
    cycle_value: 1,
    estimated_hours: 1.50,
    maintenance_content: '重点保障关键负载不断电与电池健康，防止突发断电风险。',
    maintenance_items: ['检查输入/输出电压、电流与负载率', '检查电池组内阻、温度与容量趋势', '执行旁路切换与逆变恢复测试', '检查散热风扇、告警蜂鸣与指示灯', '核查事件日志与放电测试记录'],
    required_materials: ['电池检测仪', '端子紧固工具', '绝缘防护耗材'],
  },
  // ========== 基础设施设备类（新增 8 条） ==========
  {
    template_name: '医用气体系统月度预防性维护',
    asset_type: '医用气体系统',
    cycle_type: '按月',
    cycle_value: 1,
    estimated_hours: 2.00,
    maintenance_content: '保障医用气体供应稳定与终端压力达标。',
    maintenance_items: ['检查气源、汇流排与切换功能', '检查管路压力、流量与压力报警', '检查终端插座密封性与单向阀', '检查阀门、过滤器与减压阀', '检查气体标识与色标'],
    required_materials: ['压力检测仪', '气体测漏液', '过滤器'],
  },
  {
    template_name: '中心供氧系统月度预防性维护',
    asset_type: '中心供氧系统',
    cycle_type: '按月',
    cycle_value: 1,
    estimated_hours: 2.00,
    maintenance_content: '确保氧气稳定供应与备用气源切换可靠。',
    maintenance_items: ['检查氧源（液氧/制氧机）运行与储氧量', '校验汇流排与自动切换', '检查主管道压力与减压装置', '检查流量计、纯度监测与报警', '测试应急备用氧源切换'],
    required_materials: ['氧浓度分析仪', '压力校验仪', '密封件'],
  },
  {
    template_name: '中心负压系统月度预防性维护',
    asset_type: '中心负压系统',
    cycle_type: '按月',
    cycle_value: 1,
    estimated_hours: 1.50,
    maintenance_content: '保障负压吸引稳定与排污通畅。',
    maintenance_items: ['检查真空泵运行与油液', '检查负压罐密封与压力', '检查管路、阀门与终端负压', '检查细菌过滤器与排污消毒', '测试负压报警与备用泵切换'],
    required_materials: ['真空泵油', '细菌过滤器', '消毒剂'],
  },
  {
    template_name: '配电系统季度预防性维护',
    asset_type: '配电系统',
    cycle_type: '按季度',
    cycle_value: 1,
    estimated_hours: 2.00,
    maintenance_content: '保障电力供应可靠与电气安全。',
    maintenance_items: ['检查变压器运行温度与油位', '检查高低压开关柜与断路器', '测试双电源切换与UPS', '检查接地系统与等电位连接', '红外测温检查连接点', '检查仪表与计量'],
    required_materials: ['红外测温仪', '万用表', '接地电阻测试仪'],
  },
  {
    template_name: '给排水系统季度预防性维护',
    asset_type: '给排水系统',
    cycle_type: '按季度',
    cycle_value: 1,
    estimated_hours: 1.50,
    maintenance_content: '保障供水稳定与排水通畅。',
    maintenance_items: ['检查水泵运行、振动与密封', '检查水箱/水池液位与清洗', '检查阀门、管道与防冻', '检查水质消毒与二次供水', '测试漏水报警与备用泵切换'],
    required_materials: ['水泵密封件', '阀门润滑脂', '消毒剂'],
  },
  {
    template_name: '消防系统月度预防性维护',
    asset_type: '消防系统',
    cycle_type: '按月',
    cycle_value: 1,
    estimated_hours: 1.50,
    maintenance_content: '确保火灾自动报警与灭火系统可靠。',
    maintenance_items: ['检查火灾报警控制器与探测器', '检查喷淋、消火栓与消防水箱', '检查灭火器压力与有效期', '测试防排烟与防火门', '检查应急照明与疏散指示'],
    required_materials: ['烟雾测试气', '探测器清洗工具', '灭火器'],
  },
  {
    template_name: '安防监控系统季度预防性维护',
    asset_type: '安防监控系统',
    cycle_type: '按季度',
    cycle_value: 1,
    estimated_hours: 1.50,
    maintenance_content: '保障监控录像与门禁正常运行。',
    maintenance_items: ['检查摄像头画面、云台与存储', '检查录像机/NVR运行与回放', '检查门禁控制器、读卡器与电锁', '检查对讲、报警与紧急按钮', '检查网络与供电'],
    required_materials: ['摄像头清洁工具', '存储硬盘', '门禁卡'],
  },
  {
    template_name: '锅炉设备月度预防性维护',
    asset_type: '锅炉设备',
    cycle_type: '按月',
    cycle_value: 1,
    estimated_hours: 2.00,
    maintenance_content: '保障锅炉安全运行与蒸汽供应稳定。',
    maintenance_items: ['检查燃烧器与燃料系统', '检查水位、压力与温度控制', '检查安全阀、压力表与排污', '检查水泵、阀门与管道', '水质化验与水处理', '检查烟道与节能装置'],
    required_materials: ['水质化验试剂', '锅炉除垢剂', '密封件'],
  },
];

async function generateMedicalDefaultTemplatesByTenant(tenantId, createdBy = 'system-seed') {
  const [existing] = await db.execute(
    'SELECT template_name FROM maintenance_templates WHERE tenant_id = ?',
    [tenantId],
  );
  const existingNames = new Set(existing.map(r => r.template_name));

  let createdCount = 0;
  let skippedCount = 0;

  for (const tpl of DEFAULT_MEDICAL_TEMPLATES) {
    if (existingNames.has(tpl.template_name)) {
      skippedCount += 1;
      continue;
    }
    await db.execute(
      `INSERT INTO maintenance_templates (
        tenant_id, template_name, asset_type, brand, model, maintenance_items,
        cycle_type, cycle_value, estimated_hours, required_materials,
        maintenance_content, status, created_by
      ) VALUES (?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, '启用', ?)`,
      [
        tenantId,
        tpl.template_name,
        tpl.asset_type,
        JSON.stringify(tpl.maintenance_items),
        tpl.cycle_type,
        tpl.cycle_value,
        tpl.estimated_hours,
        JSON.stringify(tpl.required_materials),
        tpl.maintenance_content,
        createdBy,
      ],
    );
    createdCount += 1;
  }

  return {
    success: true,
    message: '预防性维护模板生成完成',
    data: {
      created_count: createdCount,
      skipped_count: skippedCount,
      total: DEFAULT_MEDICAL_TEMPLATES.length,
    },
  };
}

module.exports = {
  getLegacyTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  recommendTemplates,
  getTemplates,
  recommendByAsset,
  getLegacyTemplate,
  createLegacyTemplate,
  updateLegacyTemplate,
  deleteLegacyTemplate,
  generateMedicalDefaultTemplatesByTenant,
  DEFAULT_MEDICAL_TEMPLATES,
};
