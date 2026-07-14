const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { addTenantFilter, getTenantId } = require('../middleware/tenant-filter');

// ============================================
// 物料管理相关接口
// ============================================

// 获取物料列表
router.get('/', authenticate, async (req, res) => {
  try {
    const { page = 1, pageSize = 20, keyword, category, status } = req.query;
    const offset = (page - 1) * pageSize;

    let whereClause = 'WHERE 1=1';
    const params = [];

    // 添加租户过滤
    const tenantFilter = addTenantFilter(req, 'm');
    whereClause += tenantFilter.whereClause;
    params.push(...tenantFilter.params);

    if (keyword) {
      whereClause +=
        ' AND (m.material_code LIKE ? OR m.material_name LIKE ? OR m.specification LIKE ?)';
      const keywordParam = `%${keyword}%`;
      params.push(keywordParam, keywordParam, keywordParam);
    }
    if (category) {
      whereClause += ' AND m.category = ?';
      params.push(category);
    }
    if (status) {
      whereClause += ' AND m.status = ?';
      params.push(status);
    }

    // 获取总数
    const [countResult] = await db.execute(
      `SELECT COUNT(*) as total FROM materials m ${whereClause}`,
      params,
    );
    const { total } = countResult[0];

    // 获取数据
    const [rows] = await db.execute(
      `SELECT m.*, i.current_stock, i.available_stock, i.location
       FROM materials m
       LEFT JOIN inventory i ON m.id = i.material_id AND m.tenant_id = i.tenant_id
       ${whereClause}
       ORDER BY m.material_code ASC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(pageSize), offset],
    );

    res.json({
      success: true,
      data: rows,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('获取物料列表失败:', error);
    res.status(500).json({ success: false, message: '获取物料列表失败', error: error.message });
  }
});

// 创建物料
router.post('/', authenticate, async (req, res) => {
  try {
    const {
      material_code,
      material_name,
      specification,
      unit,
      category,
      subcategory,
      supplier,
      manufacturer,
      min_stock,
      max_stock,
      unit_price,
      currency,
      lead_time_days,
      description,
      status,
    } = req.body;

    if (!material_code || !material_name || !unit) {
      return res.status(400).json({ success: false, message: '物料编码、名称和单位不能为空' });
    }

    const tenantId = getTenantId(req);

    // 检查物料编码是否已存在
    const [existing] = await db.execute(
      'SELECT id FROM materials WHERE tenant_id = ? AND material_code = ?',
      [tenantId, material_code],
    );
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: '物料编码已存在' });
    }

    // 创建物料
    const [result] = await db.execute(
      `INSERT INTO materials (
        tenant_id, material_code, material_name, specification, unit, category, subcategory,
        supplier, manufacturer, min_stock, max_stock, unit_price, currency, lead_time_days,
        description, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        material_code,
        material_name,
        specification || null,
        unit,
        category || null,
        subcategory || null,
        supplier || null,
        manufacturer || null,
        min_stock || 0,
        max_stock || 1000,
        unit_price || 0.0,
        currency || 'CNY',
        lead_time_days || 7,
        description || null,
        status || '正常',
      ],
    );

    const materialId = result.insertId;

    // 创建库存记录
    await db.execute(
      `INSERT INTO inventory (
        tenant_id, material_id, current_stock, available_stock, reserved_stock,
        average_cost, total_value
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [tenantId, materialId, 0, 0, 0, unit_price || 0.0, 0],
    );

    res.json({
      success: true,
      message: '物料创建成功',
      data: { id: materialId },
    });
  } catch (error) {
    console.error('创建物料失败:', error);
    res.status(500).json({ success: false, message: '创建物料失败', error: error.message });
  }
});

// 更新物料
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      material_name,
      specification,
      unit,
      category,
      subcategory,
      supplier,
      manufacturer,
      min_stock,
      max_stock,
      unit_price,
      currency,
      lead_time_days,
      description,
      status,
    } = req.body;

    // 验证物料是否存在并验证租户
    const tenantFilter = addTenantFilter(req, 'm');
    const [existing] = await db.execute(
      `SELECT id FROM materials m WHERE m.id = ? ${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: '物料不存在' });
    }

    const updateFields = [];
    const updateValues = [];

    if (material_name !== undefined) {
      updateFields.push('material_name = ?');
      updateValues.push(material_name);
    }
    if (specification !== undefined) {
      updateFields.push('specification = ?');
      updateValues.push(specification);
    }
    if (unit !== undefined) {
      updateFields.push('unit = ?');
      updateValues.push(unit);
    }
    if (category !== undefined) {
      updateFields.push('category = ?');
      updateValues.push(category);
    }
    if (subcategory !== undefined) {
      updateFields.push('subcategory = ?');
      updateValues.push(subcategory);
    }
    if (supplier !== undefined) {
      updateFields.push('supplier = ?');
      updateValues.push(supplier);
    }
    if (manufacturer !== undefined) {
      updateFields.push('manufacturer = ?');
      updateValues.push(manufacturer);
    }
    if (min_stock !== undefined) {
      updateFields.push('min_stock = ?');
      updateValues.push(min_stock);
    }
    if (max_stock !== undefined) {
      updateFields.push('max_stock = ?');
      updateValues.push(max_stock);
    }
    if (unit_price !== undefined) {
      updateFields.push('unit_price = ?');
      updateValues.push(unit_price);
    }
    if (currency !== undefined) {
      updateFields.push('currency = ?');
      updateValues.push(currency);
    }
    if (lead_time_days !== undefined) {
      updateFields.push('lead_time_days = ?');
      updateValues.push(lead_time_days);
    }
    if (description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(description);
    }
    if (status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(status);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, message: '没有要更新的字段' });
    }

    updateFields.push('updated_at = NOW()');
    updateValues.push(id);

    await db.execute(
      `UPDATE materials m SET ${updateFields.join(', ')} WHERE m.id = ? ${tenantFilter.whereClause.replace('WHERE', 'AND')}`,
      [...updateValues, ...tenantFilter.params],
    );

    res.json({ success: true, message: '物料更新成功' });
  } catch (error) {
    console.error('更新物料失败:', error);
    res.status(500).json({ success: false, message: '更新物料失败', error: error.message });
  }
});

// 删除物料
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // 验证物料是否存在并验证租户
    const tenantFilter = addTenantFilter(req, 'm');
    const [existing] = await db.execute(
      `SELECT id FROM materials m WHERE m.id = ? ${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: '物料不存在' });
    }

    // 删除物料（级联删除库存记录）
    await db.execute(
      `DELETE FROM materials m WHERE m.id = ? ${tenantFilter.whereClause.replace('WHERE', 'AND')}`,
      [id, ...tenantFilter.params],
    );

    res.json({ success: true, message: '物料删除成功' });
  } catch (error) {
    console.error('删除物料失败:', error);
    res.status(500).json({ success: false, message: '删除物料失败', error: error.message });
  }
});

// ============================================
// 库存管理相关接口
// ============================================

// 获取库存列表
router.get('/inventory', authenticate, async (req, res) => {
  try {
    const { page = 1, pageSize = 20, keyword, location, min_stock_alert } = req.query;
    const offset = (page - 1) * pageSize;

    let whereClause = 'WHERE 1=1';
    const params = [];

    // 添加租户过滤
    const tenantFilter = addTenantFilter(req, 'i');
    whereClause += tenantFilter.whereClause;
    params.push(...tenantFilter.params);

    if (keyword) {
      whereClause +=
        ' AND EXISTS (SELECT 1 FROM materials m WHERE m.id = i.material_id AND (m.material_code LIKE ? OR m.material_name LIKE ?))';
      const keywordParam = `%${keyword}%`;
      params.push(keywordParam, keywordParam);
    }
    if (location) {
      whereClause += ' AND i.location LIKE ?';
      params.push(`%${location}%`);
    }
    if (min_stock_alert === 'true') {
      whereClause +=
        ' AND EXISTS (SELECT 1 FROM materials m WHERE m.id = i.material_id AND i.current_stock <= m.min_stock)';
    }

    // 获取总数
    const [countResult] = await db.execute(
      `SELECT COUNT(*) as total FROM inventory i ${whereClause}`,
      params,
    );
    const { total } = countResult[0];

    // 获取数据
    const [rows] = await db.execute(
      `SELECT i.*, m.material_code, m.material_name, m.specification, m.unit, m.min_stock, m.max_stock
       FROM inventory i
       JOIN materials m ON i.material_id = m.id
       ${whereClause}
       ORDER BY i.current_stock ASC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(pageSize), offset],
    );

    res.json({
      success: true,
      data: rows,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('获取库存列表失败:', error);
    res.status(500).json({ success: false, message: '获取库存列表失败', error: error.message });
  }
});

// 库存入库
router.post('/inventory/inbound', authenticate, async (req, res) => {
  try {
    const { material_id, quantity, unit_price, supplier, batch_number, location, remark } =
      req.body;

    if (!material_id || !quantity || quantity <= 0) {
      return res
        .status(400)
        .json({ success: false, message: '物料ID和入库数量不能为空，且数量必须大于0' });
    }

    const tenantId = getTenantId(req);
    const transactionDate = new Date();

    // 验证物料是否存在
    const [material] = await db.execute(
      'SELECT id, material_code, material_name, unit FROM materials WHERE id = ? AND tenant_id = ?',
      [material_id, tenantId],
    );
    if (material.length === 0) {
      return res.status(404).json({ success: false, message: '物料不存在' });
    }

    // 开始事务
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // 获取当前库存
      const [inventory] = await connection.execute(
        'SELECT current_stock, available_stock, average_cost, total_value FROM inventory WHERE material_id = ? AND tenant_id = ?',
        [material_id, tenantId],
      );

      if (inventory.length === 0) {
        throw new Error('库存记录不存在');
      }

      const currentStock = inventory[0].current_stock;
      const newStock = currentStock + quantity;
      const totalCost = (inventory[0].total_value || 0) + quantity * unit_price;
      const newAverageCost = newStock > 0 ? totalCost / newStock : 0;

      // 更新库存
      await connection.execute(
        `UPDATE inventory SET 
          current_stock = ?, 
          available_stock = available_stock + ?, 
          last_stock_date = ?, 
          last_restock_quantity = ?, 
          average_cost = ?, 
          total_value = ?, 
          location = COALESCE(?, location)
        WHERE material_id = ? AND tenant_id = ?`,
        [
          newStock,
          quantity,
          transactionDate,
          quantity,
          newAverageCost,
          totalCost,
          location || null,
          material_id,
          tenantId,
        ],
      );

      // 记录库存变动
      await connection.execute(
        `INSERT INTO inventory_transactions (
          tenant_id, transaction_date, transaction_type, material_id, quantity, 
          unit_price, total_amount, source_location, target_location, 
          reference_type, reference_id, description, operator
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tenantId,
          transactionDate,
          '入库',
          material_id,
          quantity,
          unit_price,
          quantity * unit_price,
          null,
          location || null,
          'manual',
          null,
          remark || `手动入库 - 供应商: ${supplier || '未知'} 批次: ${batch_number || '未知'}`,
          req.user.real_name || req.user.username,
        ],
      );

      await connection.commit();

      res.json({ success: true, message: '库存入库成功' });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('库存入库失败:', error);
    res.status(500).json({ success: false, message: '库存入库失败', error: error.message });
  }
});

// 库存出库
router.post('/inventory/outbound', authenticate, async (req, res) => {
  try {
    const { material_id, quantity, purpose, location, remark } = req.body;

    if (!material_id || !quantity || quantity <= 0) {
      return res
        .status(400)
        .json({ success: false, message: '物料ID和出库数量不能为空，且数量必须大于0' });
    }

    const tenantId = getTenantId(req);
    const transactionDate = new Date();

    // 验证物料是否存在
    const [material] = await db.execute(
      'SELECT id, material_code, material_name, unit FROM materials WHERE id = ? AND tenant_id = ?',
      [material_id, tenantId],
    );
    if (material.length === 0) {
      return res.status(404).json({ success: false, message: '物料不存在' });
    }

    // 开始事务
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // 获取当前库存
      const [inventory] = await connection.execute(
        'SELECT current_stock, available_stock, average_cost FROM inventory WHERE material_id = ? AND tenant_id = ?',
        [material_id, tenantId],
      );

      if (inventory.length === 0) {
        throw new Error('库存记录不存在');
      }

      if (inventory[0].available_stock < quantity) {
        throw new Error('库存不足');
      }

      const currentStock = inventory[0].current_stock;
      const newStock = currentStock - quantity;
      const unitPrice = inventory[0].average_cost;

      // 更新库存
      await connection.execute(
        `UPDATE inventory SET 
          current_stock = ?, 
          available_stock = available_stock - ?
        WHERE material_id = ? AND tenant_id = ?`,
        [newStock, quantity, material_id, tenantId],
      );

      // 记录库存变动
      await connection.execute(
        `INSERT INTO inventory_transactions (
          tenant_id, transaction_date, transaction_type, material_id, quantity, 
          unit_price, total_amount, source_location, target_location, 
          reference_type, reference_id, description, operator
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tenantId,
          transactionDate,
          '出库',
          material_id,
          quantity,
          unitPrice,
          quantity * unitPrice,
          location || null,
          null,
          'manual',
          null,
          remark || `手动出库 - 用途: ${purpose || '未知'}`,
          req.user.real_name || req.user.username,
        ],
      );

      await connection.commit();

      res.json({ success: true, message: '库存出库成功' });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('库存出库失败:', error);
    res.status(500).json({ success: false, message: '库存出库失败', error: error.message });
  }
});

// 获取库存变动记录
router.get('/transactions', authenticate, async (req, res) => {
  try {
    const {
      page = 1,
      pageSize = 20,
      start_date,
      end_date,
      transaction_type,
      material_id,
    } = req.query;
    const offset = (page - 1) * pageSize;

    let whereClause = 'WHERE 1=1';
    const params = [];

    // 添加租户过滤
    const tenantFilter = addTenantFilter(req, 'it');
    whereClause += tenantFilter.whereClause;
    params.push(...tenantFilter.params);

    if (start_date) {
      whereClause += ' AND it.transaction_date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      whereClause += ' AND it.transaction_date <= ?';
      params.push(end_date);
    }
    if (transaction_type) {
      whereClause += ' AND it.transaction_type = ?';
      params.push(transaction_type);
    }
    if (material_id) {
      whereClause += ' AND it.material_id = ?';
      params.push(material_id);
    }

    // 获取总数
    const [countResult] = await db.execute(
      `SELECT COUNT(*) as total FROM inventory_transactions it ${whereClause}`,
      params,
    );
    const { total } = countResult[0];

    // 获取数据
    const [rows] = await db.execute(
      `SELECT it.*, m.material_code, m.material_name, m.specification, m.unit
       FROM inventory_transactions it
       JOIN materials m ON it.material_id = m.id
       ${whereClause}
       ORDER BY it.transaction_date DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(pageSize), offset],
    );

    res.json({
      success: true,
      data: rows,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('获取库存变动记录失败:', error);
    res.status(500).json({ success: false, message: '获取库存变动记录失败', error: error.message });
  }
});

// ============================================
// 维护物料需求相关接口
// ============================================

// 获取维护物料需求
router.get('/maintenance-requirements', authenticate, async (req, res) => {
  try {
    const { page = 1, pageSize = 20, maintenance_id, maintenance_type, status } = req.query;
    const offset = (page - 1) * pageSize;

    let whereClause = 'WHERE 1=1';
    const params = [];

    // 添加租户过滤
    const tenantFilter = addTenantFilter(req, 'mmr');
    whereClause += tenantFilter.whereClause;
    params.push(...tenantFilter.params);

    if (maintenance_id) {
      whereClause += ' AND mmr.maintenance_id = ?';
      params.push(maintenance_id);
    }
    if (maintenance_type) {
      whereClause += ' AND mmr.maintenance_type = ?';
      params.push(maintenance_type);
    }
    if (status) {
      whereClause += ' AND mmr.status = ?';
      params.push(status);
    }

    // 获取总数
    const [countResult] = await db.execute(
      `SELECT COUNT(*) as total FROM maintenance_material_requirements mmr ${whereClause}`,
      params,
    );
    const { total } = countResult[0];

    // 获取数据
    const [rows] = await db.execute(
      `SELECT mmr.*, m.material_code, m.material_name, m.specification, m.unit, i.current_stock
       FROM maintenance_material_requirements mmr
       JOIN materials m ON mmr.material_id = m.id
       LEFT JOIN inventory i ON m.id = i.material_id AND m.tenant_id = i.tenant_id
       ${whereClause}
       ORDER BY mmr.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(pageSize), offset],
    );

    res.json({
      success: true,
      data: rows,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('获取维护物料需求失败:', error);
    res.status(500).json({ success: false, message: '获取维护物料需求失败', error: error.message });
  }
});

// 创建维护物料需求
router.post('/maintenance-requirements', authenticate, async (req, res) => {
  try {
    const { maintenance_id, maintenance_type, materials } = req.body;

    if (!maintenance_id || !maintenance_type || !Array.isArray(materials)) {
      return res.status(400).json({ success: false, message: '参数错误' });
    }

    const tenantId = getTenantId(req);

    // 开始事务
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      for (const material of materials) {
        const { material_id, required_quantity, unit_price } = material;

        if (!material_id || !required_quantity || required_quantity <= 0) {
          continue;
        }

        // 验证物料是否存在
        const [materialInfo] = await connection.execute(
          'SELECT id, unit_price as default_unit_price FROM materials WHERE id = ? AND tenant_id = ?',
          [material_id, tenantId],
        );
        if (materialInfo.length === 0) {
          continue;
        }

        const price = unit_price || materialInfo[0].default_unit_price || 0;

        // 创建维护物料需求
        await connection.execute(
          `INSERT INTO maintenance_material_requirements (
            tenant_id, maintenance_id, maintenance_type, material_id, 
            required_quantity, unit_price, total_cost
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            tenantId,
            maintenance_id,
            maintenance_type,
            material_id,
            required_quantity,
            price,
            required_quantity * price,
          ],
        );
      }

      await connection.commit();

      res.json({ success: true, message: '维护物料需求创建成功' });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('创建维护物料需求失败:', error);
    res.status(500).json({ success: false, message: '创建维护物料需求失败', error: error.message });
  }
});

// 发料
router.post('/maintenance-requirements/:id/issue', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { issued_quantity } = req.body;

    if (!issued_quantity || issued_quantity <= 0) {
      return res.status(400).json({ success: false, message: '发料数量必须大于0' });
    }

    const tenantId = getTenantId(req);

    // 验证需求是否存在
    const [requirement] = await db.execute(
      `SELECT mmr.*, m.material_code, m.material_name, i.available_stock
       FROM maintenance_material_requirements mmr
       JOIN materials m ON mmr.material_id = m.id
       LEFT JOIN inventory i ON m.id = i.material_id AND m.tenant_id = i.tenant_id
       WHERE mmr.id = ? AND mmr.tenant_id = ?`,
      [id, tenantId],
    );

    if (requirement.length === 0) {
      return res.status(404).json({ success: false, message: '物料需求不存在' });
    }

    const reqItem = requirement[0];

    if (reqItem.available_stock < issued_quantity) {
      return res.status(400).json({ success: false, message: '库存不足' });
    }

    if (reqItem.issued_quantity + issued_quantity > reqItem.required_quantity) {
      return res.status(400).json({ success: false, message: '发料数量超过需求数量' });
    }

    // 开始事务
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // 更新库存
      await connection.execute(
        `UPDATE inventory SET 
          available_stock = available_stock - ?
        WHERE material_id = ? AND tenant_id = ?`,
        [issued_quantity, reqItem.material_id, tenantId],
      );

      // 更新维护物料需求
      const newIssuedQuantity = reqItem.issued_quantity + issued_quantity;
      let newStatus = reqItem.status;

      if (newIssuedQuantity >= reqItem.required_quantity) {
        newStatus = '已发料';
      } else if (newIssuedQuantity > 0) {
        newStatus = '部分发料';
      }

      await connection.execute(
        `UPDATE maintenance_material_requirements SET 
          issued_quantity = ?, 
          status = ?, 
          issued_by = ?, 
          issued_date = ?
        WHERE id = ? AND tenant_id = ?`,
        [
          newIssuedQuantity,
          newStatus,
          req.user.real_name || req.user.username,
          new Date(),
          id,
          tenantId,
        ],
      );

      // 记录库存变动
      await connection.execute(
        `INSERT INTO inventory_transactions (
          tenant_id, transaction_date, transaction_type, material_id, quantity, 
          unit_price, total_amount, source_location, target_location, 
          reference_type, reference_id, description, operator
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tenantId,
          new Date(),
          '出库',
          reqItem.material_id,
          issued_quantity,
          reqItem.unit_price,
          issued_quantity * reqItem.unit_price,
          null,
          null,
          'maintenance',
          reqItem.maintenance_id,
          `维护发料 - ${reqItem.maintenance_type}: ${reqItem.maintenance_id}`,
          req.user.real_name || req.user.username,
        ],
      );

      await connection.commit();

      res.json({ success: true, message: '发料成功' });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('发料失败:', error);
    res.status(500).json({ success: false, message: '发料失败', error: error.message });
  }
});

module.exports = router;
