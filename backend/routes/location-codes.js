const express = require('express');
const router = express.Router();
const db = require('../config/database');
const logger = require('../config/logger');
const { authenticate } = require('../middleware/auth');
const { addTenantFilter, getTenantId } = require('../middleware/tenant-filter');

function logLocationCodeError(message, error, req, context = {}) {
  logger.error(message, {
    error: error?.message || String(error || ''),
    code: error?.code || undefined,
    tenantId: getTenantId(req) || null,
    userId: req?.user?.id || null,
    username: req?.user?.username || null,
    userRole: req?.user?.role || null,
    ...context,
  });
}

// ==================== 位置编码管理 ====================

// 获取位置编码列表
router.get('/', authenticate, async (req, res) => {
  try {
    const { page = 1, pageSize = 20, keyword, is_active } = req.query;
    const offset = (page - 1) * pageSize;

    // 检查表是否存在，如果不存在则自动创建
    try {
      await db.execute('SELECT 1 FROM location_codes LIMIT 1');
    } catch (tableError) {
      if (tableError.code === 'ER_NO_SUCH_TABLE') {
        console.warn('位置编码表不存在，正在自动创建...');
        try {
          // 自动创建表
          await db.execute(`
            CREATE TABLE IF NOT EXISTS location_codes (
              id INT PRIMARY KEY AUTO_INCREMENT,
              tenant_id INT NULL COMMENT '租户ID',
              location_code VARCHAR(100) UNIQUE NOT NULL COMMENT '位置编号',
              location_name VARCHAR(200) NOT NULL COMMENT '位置名称',
              description TEXT COMMENT '位置描述',
              building_name VARCHAR(200) COMMENT '建筑物名称',
              floor_number INT COMMENT '楼层号',
              room_number VARCHAR(100) COMMENT '房间号',
              area_name VARCHAR(200) COMMENT '区域名称',
              latitude DECIMAL(10, 7) COMMENT '纬度',
              longitude DECIMAL(10, 7) COMMENT '经度',
              is_active TINYINT(1) DEFAULT 1 COMMENT '是否激活',
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME NULL DEFAULT NULL,
              INDEX idx_location_code (location_code),
              INDEX idx_location_name (location_name),
              INDEX idx_building (building_name, floor_number),
              INDEX idx_tenant_id (tenant_id),
              FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='位置编码表';
          `);
          console.log('✅ 位置编码表自动创建成功');
        } catch (createError) {
          logLocationCodeError('自动创建位置编码表失败', createError, req);
          // 创建失败，返回空列表
          return res.json({
            success: true,
            data: [],
            pagination: {
              page: parseInt(page),
              pageSize: parseInt(pageSize),
              total: 0,
              totalPages: 0,
            },
          });
        }
      } else {
        // 其他错误，返回空列表
        console.warn('检查位置编码表失败，返回空列表:', tableError.message);
        return res.json({
          success: true,
          data: [],
          pagination: {
            page: parseInt(page),
            pageSize: parseInt(pageSize),
            total: 0,
            totalPages: 0,
          },
        });
      }
    }

    let whereClause = 'WHERE 1=1';
    const params = [];

    // 添加租户过滤
    const tenantFilter = addTenantFilter(req, 'lc');
    whereClause += tenantFilter.whereClause;
    params.push(...tenantFilter.params);

    if (keyword) {
      whereClause += ' AND (lc.location_code LIKE ? OR lc.location_name LIKE ?)';
      const keywordParam = `%${keyword}%`;
      params.push(keywordParam, keywordParam);
    }

    if (is_active !== undefined) {
      whereClause += ' AND lc.is_active = ?';
      params.push(is_active === 'true' ? 1 : 0);
    }

    // 获取总数
    const [countRows] = await db.execute(
      `SELECT COUNT(*) as total FROM location_codes lc ${whereClause}`,
      params,
    );
    const total = countRows[0]?.total || 0;

    // 获取数据
    const [rows] = await db.execute(
      `SELECT lc.* FROM location_codes lc
       ${whereClause}
       ORDER BY lc.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(pageSize), offset],
    );

    res.json({
      success: true,
      data: rows || [],
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    logLocationCodeError('获取位置编码列表失败', error, req, {
      page: req.query?.page || 1,
      pageSize: req.query?.pageSize || 20,
      keyword: req.query?.keyword || null,
      isActive: req.query?.is_active ?? null,
    });
    // 即使出错也返回空列表，避免前端报错
    res.json({
      success: true,
      data: [],
      pagination: {
        page: parseInt(req.query.page || 1),
        pageSize: parseInt(req.query.pageSize || 20),
        total: 0,
        totalPages: 0,
      },
    });
  }
});

// 获取位置编码详情
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // 添加租户过滤验证
    const tenantFilter = addTenantFilter(req, 'lc');
    const [rows] = await db.execute(
      `SELECT lc.* FROM location_codes lc WHERE lc.id = ? ${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: '位置编码不存在' });
    }

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    logLocationCodeError('获取位置编码详情失败', error, req, {
      locationCodeId: req.params?.id || null,
    });
    res.status(500).json({
      success: false,
      message: '获取位置编码详情失败',
      error: error.message,
    });
  }
});

// 创建位置编码
router.post('/', authenticate, async (req, res) => {
  try {
    const {
      location_code,
      location_name,
      description,
      building_name,
      floor_number,
      room_number,
      area_name,
      latitude,
      longitude,
      is_active = 1,
    } = req.body;

    if (!location_code || !location_name) {
      return res.status(400).json({ success: false, message: '位置编号和位置名称不能为空' });
    }

    // 检查表是否存在，如果不存在则自动创建
    try {
      await db.execute('SELECT 1 FROM location_codes LIMIT 1');
    } catch (tableError) {
      if (tableError.code === 'ER_NO_SUCH_TABLE') {
        console.warn('位置编码表不存在，正在自动创建...');
        try {
          // 自动创建表
          await db.execute(`
            CREATE TABLE IF NOT EXISTS location_codes (
              id INT PRIMARY KEY AUTO_INCREMENT,
              tenant_id INT NULL COMMENT '租户ID',
              location_code VARCHAR(100) UNIQUE NOT NULL COMMENT '位置编号',
              location_name VARCHAR(200) NOT NULL COMMENT '位置名称',
              description TEXT COMMENT '位置描述',
              building_name VARCHAR(200) COMMENT '建筑物名称',
              floor_number INT COMMENT '楼层号',
              room_number VARCHAR(100) COMMENT '房间号',
              area_name VARCHAR(200) COMMENT '区域名称',
              latitude DECIMAL(10, 7) COMMENT '纬度',
              longitude DECIMAL(10, 7) COMMENT '经度',
              is_active TINYINT(1) DEFAULT 1 COMMENT '是否激活',
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME NULL DEFAULT NULL,
              INDEX idx_location_code (location_code),
              INDEX idx_location_name (location_name),
              INDEX idx_building (building_name, floor_number),
              INDEX idx_tenant_id (tenant_id),
              FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='位置编码表';
          `);
          console.log('✅ 位置编码表自动创建成功');
        } catch (createError) {
          logLocationCodeError('自动创建位置编码表失败', createError, req);
          return res.status(500).json({
            success: false,
            message: '位置编码表不存在且自动创建失败，请手动运行数据库脚本创建表',
            error: createError.message,
          });
        }
      } else {
        logLocationCodeError('检查位置编码表失败', tableError, req);
        return res.status(500).json({
          success: false,
          message: '检查位置编码表失败',
          error: tableError.message,
        });
      }
    }

    // 处理数据类型转换
    const processNumber = value => {
      if (value === undefined || value === null || value === '') return null;
      const num = typeof value === 'string' ? parseFloat(value) : value;
      return isNaN(num) ? null : num;
    };

    const processInt = value => {
      if (value === undefined || value === null || value === '') return null;
      const num = typeof value === 'string' ? parseInt(value) : value;
      return isNaN(num) ? null : num;
    };

    const processString = value => {
      if (value === undefined || value === null) return null;
      const str = String(value).trim();
      return str === '' ? null : str;
    };

    // 获取租户ID
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, message: '无法确定租户信息' });
    }

    const processedData = {
      location_code: String(location_code).trim(),
      location_name: String(location_name).trim(),
      description: processString(description),
      building_name: processString(building_name),
      floor_number: processInt(floor_number),
      room_number: processString(room_number),
      area_name: processString(area_name),
      latitude: processNumber(latitude),
      longitude: processNumber(longitude),
      is_active: is_active !== undefined ? (is_active ? 1 : 0) : 1,
    };

    const [result] = await db.execute(
      `INSERT INTO location_codes (
        tenant_id, location_code, location_name, description,
        building_name, floor_number, room_number,
        area_name, latitude, longitude, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        processedData.location_code,
        processedData.location_name,
        processedData.description,
        processedData.building_name,
        processedData.floor_number,
        processedData.room_number,
        processedData.area_name,
        processedData.latitude,
        processedData.longitude,
        processedData.is_active,
      ],
    );

    res.json({
      success: true,
      message: '位置编码创建成功',
      data: { id: result.insertId },
    });
  } catch (error) {
    logLocationCodeError('创建位置编码失败', error, req, {
      locationCode: req.body?.location_code || null,
      locationName: req.body?.location_name || null,
    });
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: '位置编号已存在' });
    }
    res.status(500).json({
      success: false,
      message: '创建位置编码失败',
      error: error.message,
    });
  }
});

// 更新位置编码
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      location_code,
      location_name,
      description,
      building_name,
      floor_number,
      room_number,
      area_name,
      latitude,
      longitude,
      is_active,
    } = req.body;

    // 检查位置编码是否存在并验证租户
    const tenantFilter = addTenantFilter(req, 'lc');
    const [existing] = await db.execute(
      `SELECT lc.* FROM location_codes lc WHERE lc.id = ? ${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: '位置编码不存在' });
    }

    // 处理数据类型转换
    const processNumber = value => {
      if (value === undefined || value === null || value === '') return null;
      const num = typeof value === 'string' ? parseFloat(value) : value;
      return isNaN(num) ? null : num;
    };

    const processInt = value => {
      if (value === undefined || value === null || value === '') return null;
      const num = typeof value === 'string' ? parseInt(value) : value;
      return isNaN(num) ? null : num;
    };

    const processString = value => {
      if (value === undefined || value === null) return null;
      const str = String(value).trim();
      return str === '' ? null : str;
    };

    // 如果 location_code 或 location_name 未提供，使用现有值
    const finalLocationCode =
      location_code !== undefined ? String(location_code).trim() : existing[0].location_code;
    const finalLocationName =
      location_name !== undefined ? String(location_name).trim() : existing[0].location_name;

    // 验证必填字段
    if (!finalLocationCode || !finalLocationName) {
      return res.status(400).json({
        success: false,
        message: '位置编号和位置名称不能为空',
      });
    }

    const processedData = {
      location_code: finalLocationCode,
      location_name: finalLocationName,
      description: description !== undefined ? processString(description) : existing[0].description,
      building_name:
        building_name !== undefined ? processString(building_name) : existing[0].building_name,
      floor_number:
        floor_number !== undefined ? processInt(floor_number) : existing[0].floor_number,
      room_number: room_number !== undefined ? processString(room_number) : existing[0].room_number,
      area_name: area_name !== undefined ? processString(area_name) : existing[0].area_name,
      latitude: latitude !== undefined ? processNumber(latitude) : existing[0].latitude,
      longitude: longitude !== undefined ? processNumber(longitude) : existing[0].longitude,
      is_active: is_active !== undefined ? (is_active ? 1 : 0) : existing[0].is_active,
    };

    await db.execute(
      `UPDATE location_codes lc SET
        lc.location_code = ?, lc.location_name = ?, lc.description = ?,
        lc.building_name = ?, lc.floor_number = ?, lc.room_number = ?,
        lc.area_name = ?, lc.latitude = ?, lc.longitude = ?,
        lc.is_active = ?, lc.updated_at = NOW()
       WHERE lc.id = ? ${tenantFilter.whereClause}`,
      [
        processedData.location_code,
        processedData.location_name,
        processedData.description,
        processedData.building_name,
        processedData.floor_number,
        processedData.room_number,
        processedData.area_name,
        processedData.latitude,
        processedData.longitude,
        processedData.is_active,
        id,
        ...tenantFilter.params,
      ],
    );

    res.json({ success: true, message: '位置编码更新成功' });
  } catch (error) {
    logLocationCodeError('更新位置编码失败', error, req, {
      locationCodeId: req.params?.id || null,
      locationCode: req.body?.location_code || null,
    });
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: '位置编号已存在' });
    }
    res.status(500).json({
      success: false,
      message: '更新位置编码失败',
      error: error.message,
    });
  }
});

// 删除位置编码
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // 检查位置编码是否存在并验证租户
    const tenantFilter = addTenantFilter(req, 'lc');
    const [existing] = await db.execute(
      `SELECT lc.id FROM location_codes lc WHERE lc.id = ? ${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: '位置编码不存在' });
    }

    await db.execute(
      `DELETE lc FROM location_codes lc WHERE lc.id = ? ${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );

    res.json({ success: true, message: '位置编码删除成功' });
  } catch (error) {
    logLocationCodeError('删除位置编码失败', error, req, {
      locationCodeId: req.params?.id || null,
    });
    res.status(500).json({
      success: false,
      message: '删除位置编码失败',
      error: error.message,
    });
  }
});

module.exports = router;
