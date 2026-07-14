/**
 * 资产分类路由模块
 */

const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const { authenticate, requireSystemAdmin } = require('../../middleware/auth');
const { addTenantFilter, getTenantId } = require('../../middleware/tenant-filter');
const { cacheService } = require('../../services/cache/CacheService');
const logger = require('../../config/logger');

/**
 * 获取分类列表（支持 / 和 /list 两种路径）
 */
const normalizeParentId = value => {
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : 0;
};

const buildCategoryTree = (items, parentId = 0) => {
  return items
    .filter(item => normalizeParentId(item.parent_id) === parentId)
    .map(item => ({
      ...item,
      children: buildCategoryTree(items, item.id),
    }));
};

const buildCategoryLevels = items => {
  const itemMap = new Map(items.map(item => [item.id, item]));
  const levelCache = new Map();

  const resolveLevel = item => {
    if (!item?.id) return 1;
    if (levelCache.has(item.id)) {
      return levelCache.get(item.id);
    }

    const parentId = normalizeParentId(item.parent_id);
    if (parentId === 0) {
      levelCache.set(item.id, 1);
      return 1;
    }

    const parent = itemMap.get(parentId);
    const level = (parent ? resolveLevel(parent) : 0) + 1;
    levelCache.set(item.id, level);
    return level;
  };

  return items.map(item => ({
    ...item,
    level: resolveLevel(item),
  }));
};

const fetchTenantCategories = async tenantId => {
  const [categories] = await db.execute(
    `SELECT id, name, parent_id, code, description, is_public, created_at, tenant_id
     FROM asset_categories
     WHERE tenant_id = ? OR is_public = 1
     ORDER BY name`,
    [tenantId],
  );

  return categories.map(category => ({
    ...category,
    parent_id: normalizeParentId(category.parent_id),
    is_public: category.is_public === 1,
  }));
};

const getCategoryList = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, message: '请先选择企业空间' });
    }

    const level = Number.parseInt(req.query.level, 10);
    const hasParentFilter = req.query.parent_id !== undefined && req.query.parent_id !== '';
    const parentId = hasParentFilter ? normalizeParentId(req.query.parent_id) : null;

    const cacheKey = `category:list:${tenantId}:level:${Number.isInteger(level) ? level : 'all'}:parent:${parentId ?? 'all'}`;
    const cached = await cacheService.get('category', cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const categories = buildCategoryLevels(await fetchTenantCategories(tenantId));
    let resultList = categories;

    if (hasParentFilter) {
      resultList = categories.filter(item => normalizeParentId(item.parent_id) === parentId);
    } else if (Number.isInteger(level) && level > 0) {
      resultList = categories.filter(item => item.level === level);
    }

    const result = {
      success: true,
      data: resultList,
    };

    await cacheService.set('category', cacheKey, result, { ttl: 3600 });

    res.json(result);
  } catch (error) {
    logger.error('Get category list failed:', error);
    res.status(500).json({ success: false, message: '获取分类列表失败' });
  }
};

const getCategoryTree = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, message: '请先选择企业空间' });
    }

    const cacheKey = `category:tree:${tenantId}:v2`;
    const cached = await cacheService.get('category', cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const categories = buildCategoryLevels(await fetchTenantCategories(tenantId));
    const result = {
      success: true,
      data: buildCategoryTree(categories),
    };

    await cacheService.set('category', cacheKey, result, { ttl: 3600 });
    return res.json(result);
  } catch (error) {
    logger.error('Get category tree failed:', error);
    return res.status(500).json({ success: false, message: '获取分类树失败' });
  }
};

router.get('/', authenticate, getCategoryList);
router.get('/list', authenticate, getCategoryList);
router.get('/tree', authenticate, getCategoryTree);

/**
 * 创建分类
 */
router.post('/', authenticate, requireSystemAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { name, parent_id = null, code, description, sort_order = 0 } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: '分类名称不能为空' });
    }

    // 计算层级
    let level = 1;
    if (parent_id) {
      const [parent] = await db.execute(
        'SELECT level FROM asset_categories WHERE id = ? AND (tenant_id = ? OR is_public = 1)',
        [parent_id, tenantId],
      );
      if (parent.length === 0) {
        return res.status(404).json({ success: false, message: '父分类不存在' });
      }
      level = parent[0].level + 1;
    }

    // 检查编码是否重复
    if (code) {
      const [existing] = await db.execute(
        'SELECT id FROM asset_categories WHERE code = ? AND tenant_id = ?',
        [code, tenantId],
      );
      if (existing.length > 0) {
        return res.status(409).json({ success: false, message: '分类编码已存在' });
      }
    }

    const [result] = await db.execute(
      `INSERT INTO asset_categories (tenant_id, name, parent_id, code, level, description, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [tenantId, name, parent_id, code, level, description, sort_order],
    );

    await cacheService.deleteByTag('category');

    res.status(201).json({
      success: true,
      message: '分类创建成功',
      data: { id: result.insertId },
    });
  } catch (error) {
    logger.error('Create category failed:', error);
    res.status(500).json({ success: false, message: '创建分类失败' });
  }
});

/**
 * 更新分类
 */
router.put('/:id', authenticate, requireSystemAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = getTenantId(req);
    const { name, code, description, sort_order, is_active } = req.body;

    const [existing] = await db.execute(
      'SELECT * FROM asset_categories WHERE id = ? AND (tenant_id = ? OR is_public = 1)',
      [id, tenantId],
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: '分类不存在' });
    }

    const category = existing[0];

    // 公共分类不能被租户用户修改
    if (category.is_public === 1 && category.tenant_id !== tenantId) {
      return res.status(403).json({ success: false, message: '不能修改公共分类' });
    }

    // 检查编码重复
    if (code && code !== existing[0].code) {
      const [duplicate] = await db.execute(
        'SELECT id FROM asset_categories WHERE code = ? AND tenant_id = ? AND id != ?',
        [code, tenantId, id],
      );
      if (duplicate.length > 0) {
        return res.status(409).json({ success: false, message: '分类编码已存在' });
      }
    }

    const updates = [];
    const values = [];
    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (code !== undefined) { updates.push('code = ?'); values.push(code); }
    if (description !== undefined) { updates.push('description = ?'); values.push(description); }
    if (sort_order !== undefined) { updates.push('sort_order = ?'); values.push(sort_order); }
    if (is_active !== undefined) { updates.push('is_active = ?'); values.push(is_active); }

    updates.push('updated_at = NOW()');
    values.push(id);
    values.push(tenantId);

    await db.execute(
      `UPDATE asset_categories SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`,
      values,
    );

    await cacheService.deleteByTag('category');

    res.json({ success: true, message: '分类更新成功' });
  } catch (error) {
    logger.error('Update category failed:', error);
    res.status(500).json({ success: false, message: '更新分类失败' });
  }
});

/**
 * 删除分类
 */
router.delete('/:id', authenticate, requireSystemAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = getTenantId(req);

    const [existing] = await db.execute(
      'SELECT id FROM asset_categories WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: '分类不存在' });
    }

    // 检查是否有子分类
    const [children] = await db.execute(
      'SELECT COUNT(*) as count FROM asset_categories WHERE parent_id = ?',
      [id],
    );

    if (children[0].count > 0) {
      return res.status(400).json({ success: false, message: '该分类下有子分类，不能删除' });
    }

    // 检查是否有关联资产
    const [assets] = await db.execute(
      'SELECT COUNT(*) as count FROM assets WHERE category_id = ? AND tenant_id = ?',
      [id, tenantId],
    );

    if (assets[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: `该分类下有${assets[0].count}个资产，不能删除`,
      });
    }

    await db.execute(
      'DELETE FROM asset_categories WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );

    await cacheService.deleteByTag('category');

    res.json({ success: true, message: '分类删除成功' });
  } catch (error) {
    logger.error('Delete category failed:', error);
    res.status(500).json({ success: false, message: '删除分类失败' });
  }
});

module.exports = router;
