const { getTenantId } = require('../../../middleware/tenant-filter');
const db = require('../../../config/database');
const logger = require('../../../config/logger');

const normalizeParentId = value => {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : 0;
};

const buildCategoryTree = (items, parentId = 0) =>
  items
    .filter(item => normalizeParentId(item.parent_id) === parentId)
    .map(item => ({
      ...item,
      children: buildCategoryTree(items, item.id),
    }));

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

const fetchAllCategories = async tenantId => {
  const [rows] = await db.execute(
    `SELECT id, name, parent_id, code, description, is_public, created_at, tenant_id
     FROM asset_categories
     WHERE tenant_id = ? OR is_public = 1
     ORDER BY name`,
    [tenantId],
  );
  return rows.map(category => ({
    ...category,
    parent_id: normalizeParentId(category.parent_id),
  }));
};

class CategoryController {
  async list(req, res) {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ success: false, message: '请先选择企业空间' });
      }

      const level = Number.parseInt(req.query.level, 10);
      const hasParentFilter = req.query.parent_id !== undefined && req.query.parent_id !== '';
      const parentId = hasParentFilter ? normalizeParentId(req.query.parent_id) : null;

      const categories = buildCategoryLevels(await fetchAllCategories(tenantId));
      let resultList = categories;

      if (hasParentFilter) {
        resultList = categories.filter(item => normalizeParentId(item.parent_id) === parentId);
      } else if (Number.isInteger(level) && level > 0) {
        resultList = categories.filter(item => item.level === level);
      }

      res.json({ success: true, data: resultList });
    } catch (error) {
      logger.error('Get category list failed:', error);
      res.status(500).json({ success: false, message: '获取分类列表失败' });
    }
  }

  async tree(req, res) {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ success: false, message: '请先选择企业空间' });
      }

      const categories = buildCategoryLevels(await fetchAllCategories(tenantId));
      res.json({ success: true, data: buildCategoryTree(categories) });
    } catch (error) {
      logger.error('Get category tree failed:', error);
      res.status(500).json({ success: false, message: '获取分类树失败' });
    }
  }
}

module.exports = new CategoryController();
