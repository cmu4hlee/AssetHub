/**
 * 验收模板 - 服务层
 *
 * 涵盖：模板 CRUD + 分类查询 + 软删。
 *
 * 模板分两类：
 *  - 全局模板 (tenant_id IS NULL)：系统内置或平台级模板
 *  - 租户模板 (tenant_id = ?)：租户自定义模板
 *
 * 列表/分类查询对两类都可见；写操作仅限租户模板。
 */
const db = require('../../../config/database');
const { getTenantId } = require('../../../middleware/tenant-filter');
const { logger, validateTemplateInput } = require('../utils/helpers');

/**
 * 模板列表
 * @param grouped true=按 category 分组返回；false=平铺
 */
async function listTemplates({ tenantId, grouped = true, category }) {
  let query = `SELECT * FROM asset_acceptance_templates WHERE (tenant_id = ? OR tenant_id IS NULL) AND is_deleted = 0`;
  const params = [tenantId];
  if (category) { query += ' AND category = ?'; params.push(category); }
  query += ' ORDER BY category, sort_order, id';

  const [templates] = await db.execute(query, params);
  if (!grouped) return { records: templates };
  const groupedResult = {};
  for (const t of templates) {
    if (!groupedResult[t.category]) groupedResult[t.category] = [];
    groupedResult[t.category].push(t);
  }
  return { records: groupedResult };
}

/**
 * 模板分类
 */
async function listCategories({ tenantId }) {
  const [rows] = await db.execute(
    `SELECT DISTINCT category FROM asset_acceptance_templates WHERE (tenant_id = ? OR tenant_id IS NULL) AND is_deleted = 0 ORDER BY category`,
    [tenantId],
  );
  return rows.map(r => r.category);
}

/**
 * 创建模板（仅租户级，全局模板走数据库直插）
 */
async function createTemplate({ tenantId, body }) {
  const {
    asset_category, template_name, category, item_name, item_description,
    is_required = 1, sort_order = 0, is_enabled = 1, template_description,
  } = body;

  const validation = validateTemplateInput({ category, item_name, item_description });
  if (!validation.valid) {
    const err = new Error(validation.errors.join('; '));
    err.statusCode = 400;
    throw err;
  }

  const [result] = await db.execute(
    `INSERT INTO asset_acceptance_templates
       (tenant_id, asset_category, template_name, template_description, category,
        item_name, item_description, is_required, sort_order, is_enabled)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tenantId, asset_category || null, template_name || null, template_description || null,
      category, item_name, item_description || null, is_required ? 1 : 0, sort_order || 0, is_enabled ? 1 : 0,
    ],
  );
  return { id: result.insertId };
}

/**
 * 更新模板（仅租户级）
 */
async function updateTemplate({ id, tenantId, body }) {
  const {
    asset_category, template_name, category, item_name, item_description,
    is_required, sort_order, is_enabled, template_description,
  } = body;
  const validation = validateTemplateInput({ category, item_name, item_description });
  if (!validation.valid) {
    const err = new Error(validation.errors.join('; '));
    err.statusCode = 400;
    throw err;
  }

  const [result] = await db.execute(
    `UPDATE asset_acceptance_templates
     SET asset_category=?, template_name=?, template_description=?, category=?,
         item_name=?, item_description=?, is_required=?, sort_order=?, is_enabled=?
     WHERE id=? AND (tenant_id = ? OR tenant_id IS NULL)`,
    [
      asset_category || null, template_name || null, template_description || null,
      category, item_name, item_description || null, is_required ? 1 : 0, sort_order || 0, is_enabled ? 1 : 0,
      id, tenantId,
    ],
  );
  if (result.affectedRows === 0) {
    const err = new Error('模板不存在或无权限');
    err.statusCode = 404;
    throw err;
  }
}

/**
 * 软删模板（仅租户级；全局模板不允许）
 */
async function softDeleteTemplate({ id, tenantId, user }) {
  const [result] = await db.execute(
    `UPDATE asset_acceptance_templates
     SET is_deleted = 1, deleted_at = NOW(), deleted_by = ?
     WHERE id = ? AND tenant_id = ? AND is_deleted = 0`,
    [user?.username || null, id, tenantId],
  );
  if (result.affectedRows === 0) {
    const err = new Error('模板不存在或为系统内置模板，无法删除');
    err.statusCode = 404;
    throw err;
  }
}

module.exports = {
  listTemplates,
  listCategories,
  createTemplate,
  updateTemplate,
  softDeleteTemplate,
};
