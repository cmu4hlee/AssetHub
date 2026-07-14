const express = require('express');
const router = express.Router();
const db = require('../config/database');
const logger = require('../config/logger');
const { authenticate, requireSystemAdmin } = require('../middleware/auth');
const { auditLogger } = require('../middleware/auditLogger');
const { addTenantFilter, getTenantId } = require('../middleware/tenant-filter');

function logDocEnhancedError(message, error, req, context = {}) {
  logger.error(message, {
    error: error?.message || String(error || ''),
    code: error?.code || undefined,
    tenantId: req?.user?.tenant_id || null,
    userId: req?.user?.id || null,
    ...context,
  });
}

async function executeQuery(query, params, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const result = await db.execute(query, params);
      return result;
    } catch (error) {
      if (
        (error.code === 'PROTOCOL_CONNECTION_LOST' || error.code === 'ECONNREFUSED') &&
        i < retries - 1
      ) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        continue;
      }
      throw error;
    }
  }
}

function parsePositiveId(value) {
  if (Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    return Number.parseInt(value.trim(), 10);
  }

  return null;
}

function normalizePositiveIdList(values) {
  if (!Array.isArray(values)) {
    return null;
  }

  const normalized = [];
  for (const value of values) {
    const parsed = parsePositiveId(value);
    if (!parsed) {
      return null;
    }

    if (!normalized.includes(parsed)) {
      normalized.push(parsed);
    }
  }

  return normalized;
}

function normalizeOptionalPositiveId(value) {
  if (value == null || value === '') {
    return null;
  }

  return parsePositiveId(value);
}

function normalizeParentCategoryId(value) {
  if (value == null || value === '') {
    return 0;
  }

  if ((typeof value === 'number' || typeof value === 'string') && String(value).trim() === '0') {
    return 0;
  }

  return parsePositiveId(value);
}

function normalizeParentCommentId(value) {
  if (value == null || value === '') {
    return 0;
  }

  if ((typeof value === 'number' || typeof value === 'string') && String(value).trim() === '0') {
    return 0;
  }

  return parsePositiveId(value);
}

function normalizeCategoryTreeId(value) {
  if (value == null || value === '') {
    return 0;
  }

  return parsePositiveId(value) || 0;
}

async function getTenantDocument(documentId, tenantId, executor = db) {
  const [rows] = await executor.execute(
    'SELECT id FROM technical_documents WHERE id = ? AND tenant_id = ? LIMIT 1',
    [documentId, tenantId],
  );
  return rows[0] || null;
}

async function getTenantDocumentIds(documentIds, tenantId, executor = db) {
  if (documentIds.length === 0) {
    return [];
  }

  const placeholders = documentIds.map(() => '?').join(', ');
  const [rows] = await executor.execute(
    `SELECT id FROM technical_documents
     WHERE tenant_id = ? AND id IN (${placeholders})`,
    [tenantId, ...documentIds],
  );
  return rows.map(row => Number(row.id));
}

async function getTenantCategory(categoryId, tenantId, executor = db) {
  if (categoryId == null) {
    return null;
  }

  const [rows] = await executor.execute(
    'SELECT id FROM technical_document_categories WHERE id = ? AND tenant_id = ? LIMIT 1',
    [categoryId, tenantId],
  );
  return rows[0] || null;
}

async function getTenantCategoryDetail(categoryId, tenantId, executor = db) {
  const [rows] = await executor.execute(
    `SELECT id, parent_id, category_name, description, icon, sort_order, is_active
     FROM technical_document_categories
     WHERE id = ? AND tenant_id = ?
     LIMIT 1`,
    [categoryId, tenantId],
  );
  return rows[0] || null;
}

async function getTenantTagIds(tagIds, tenantId, executor = db) {
  if (tagIds.length === 0) {
    return [];
  }

  const placeholders = tagIds.map(() => '?').join(', ');
  const [rows] = await executor.execute(
    `SELECT id FROM technical_document_tags
     WHERE tenant_id = ? AND id IN (${placeholders})`,
    [tenantId, ...tagIds],
  );
  return rows.map(row => Number(row.id));
}

async function getTenantCommentForDocument(commentId, documentId, tenantId, executor = db) {
  const [rows] = await executor.execute(
    `SELECT c.id
     FROM technical_document_comments c
     INNER JOIN technical_documents d ON c.document_id = d.id
     WHERE c.id = ? AND c.document_id = ? AND d.tenant_id = ?
     LIMIT 1`,
    [commentId, documentId, tenantId],
  );
  return rows[0] || null;
}

// 分类管理
router.get('/categories', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { parent_id, active } = req.query;

    let query = 'SELECT * FROM technical_document_categories WHERE tenant_id = ?';
    const params = [tenantId];

    if (parent_id !== undefined) {
      query += ' AND parent_id = ?';
      params.push(parent_id);
    }
    if (active !== undefined) {
      query += ' AND is_active = ?';
      params.push(active);
    }

    query += ' ORDER BY sort_order, id';

    const [categories] = await executeQuery(query, params);

    const buildTree = (items, parentId = 0) => {
      const normalizedParentId = normalizeCategoryTreeId(parentId);
      return items
        .filter(item => normalizeCategoryTreeId(item.parent_id) === normalizedParentId)
        .map(item => ({
          ...item,
          children: buildTree(items, normalizeCategoryTreeId(item.id)),
        }));
    };

    res.json({
      success: true,
      data: buildTree(categories),
    });
  } catch (error) {
    logDocEnhancedError('获取分类列表失败', error, req);
    res.status(500).json({ success: false, message: '获取分类列表失败' });
  }
});

router.post('/categories', authenticate, requireSystemAdmin, auditLogger('create', 'doc_category'), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { category_code, category_name, parent_id, description, icon, sort_order } = req.body;
    const normalizedParentId = normalizeParentCategoryId(parent_id);

    if (!category_code || !category_name) {
      return res.status(400).json({ success: false, message: '分类代码和名称不能为空' });
    }

    if (normalizedParentId == null) {
      return res.status(400).json({ success: false, message: '父分类ID无效' });
    }

    if (normalizedParentId > 0 && !(await getTenantCategory(normalizedParentId, tenantId))) {
      return res.status(400).json({ success: false, message: '父分类不存在或不属于当前租户' });
    }

    const [result] = await executeQuery(
      `INSERT INTO technical_document_categories 
       (tenant_id, category_code, category_name, parent_id, description, icon, sort_order, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        category_code,
        category_name,
        normalizedParentId,
        description,
        icon,
        sort_order || 0,
        req.user.username,
      ],
    );

    res.status(201).json({
      success: true,
      message: '分类创建成功',
      data: { id: result.insertId },
    });
  } catch (error) {
    logDocEnhancedError('创建分类失败', error, req);
    res.status(500).json({ success: false, message: '创建分类失败' });
  }
});

router.put('/categories/:id', authenticate, requireSystemAdmin, auditLogger('update', 'doc_category'), async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = getTenantId(req);
    const { category_name, parent_id, description, icon, sort_order, is_active } = req.body;
    const normalizedCategoryId = parsePositiveId(id);
    const hasParentId = Object.prototype.hasOwnProperty.call(req.body, 'parent_id');

    if (!normalizedCategoryId) {
      return res.status(400).json({ success: false, message: '分类ID无效' });
    }

    const existingCategory = await getTenantCategoryDetail(normalizedCategoryId, tenantId);
    if (!existingCategory) {
      return res.status(404).json({ success: false, message: '分类不存在' });
    }

    const normalizedParentId = hasParentId
      ? normalizeParentCategoryId(parent_id)
      : normalizeParentCategoryId(existingCategory.parent_id);

    if (normalizedParentId == null) {
      return res.status(400).json({ success: false, message: '父分类ID无效' });
    }

    if (normalizedParentId === normalizedCategoryId) {
      return res.status(400).json({ success: false, message: '父分类不能是当前分类' });
    }

    if (
      hasParentId &&
      normalizedParentId > 0 &&
      !(await getTenantCategory(normalizedParentId, tenantId))
    ) {
      return res.status(400).json({ success: false, message: '父分类不存在或不属于当前租户' });
    }

    const [updateResult] = await executeQuery(
      `UPDATE technical_document_categories SET
       category_name = ?, parent_id = ?, description = ?, icon = ?, 
       sort_order = ?, is_active = ?, updated_at = NOW()
       WHERE id = ? AND tenant_id = ?`,
      [
        category_name !== undefined ? category_name : existingCategory.category_name,
        normalizedParentId,
        description !== undefined ? description : existingCategory.description,
        icon !== undefined ? icon : existingCategory.icon,
        sort_order !== undefined ? sort_order : existingCategory.sort_order,
        is_active !== undefined ? is_active : existingCategory.is_active,
        normalizedCategoryId,
        tenantId,
      ],
    );

    if (!updateResult || updateResult.affectedRows === 0) {
      return res.status(404).json({ success: false, message: '分类不存在' });
    }

    res.json({ success: true, message: '分类更新成功' });
  } catch (error) {
    logDocEnhancedError('更新分类失败', error, req);
    res.status(500).json({ success: false, message: '更新分类失败' });
  }
});

router.delete('/categories/:id', authenticate, requireSystemAdmin, auditLogger('delete', 'doc_category'), async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = getTenantId(req);

    // 检查是否有子分类
    const [children] = await executeQuery(
      'SELECT COUNT(*) as count FROM technical_document_categories WHERE parent_id = ? AND tenant_id = ?',
      [id, tenantId],
    );
    if (children[0].count > 0) {
      return res.status(400).json({ success: false, message: '该分类下有子分类，无法删除' });
    }

    // 检查是否有资料
    const [docs] = await executeQuery(
      'SELECT COUNT(*) as count FROM technical_documents WHERE category_id = ? AND tenant_id = ?',
      [id, tenantId],
    );
    if (docs[0].count > 0) {
      return res.status(400).json({ success: false, message: '该分类下有资料，无法删除' });
    }

    const [deleteResult] = await executeQuery(
      'DELETE FROM technical_document_categories WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );

    if (!deleteResult || deleteResult.affectedRows === 0) {
      return res.status(404).json({ success: false, message: '分类不存在' });
    }

    res.json({ success: true, message: '分类删除成功' });
  } catch (error) {
    logDocEnhancedError('删除分类失败', error, req);
    res.status(500).json({ success: false, message: '删除分类失败' });
  }
});

// 标签管理
router.get('/tags', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const [tags] = await executeQuery(
      'SELECT * FROM technical_document_tags WHERE tenant_id = ? ORDER BY tag_name',
      [tenantId],
    );
    res.json({ success: true, data: tags });
  } catch (error) {
    logDocEnhancedError('获取标签列表失败', error, req);
    res.status(500).json({ success: false, message: '获取标签列表失败' });
  }
});

router.post('/tags', authenticate, requireSystemAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { tag_name, tag_color } = req.body;

    const [result] = await executeQuery(
      `INSERT INTO technical_document_tags (tenant_id, tag_name, tag_color)
       VALUES (?, ?, ?)`,
      [tenantId, tag_name, tag_color || '#1890ff'],
    );

    res.status(201).json({ success: true, message: '标签创建成功', data: { id: result.insertId } });
  } catch (error) {
    logDocEnhancedError('创建标签失败', error, req);
    res.status(500).json({ success: false, message: '创建标签失败' });
  }
});

router.delete('/tags/:id', authenticate, requireSystemAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = getTenantId(req);

    const [deleteResult] = await executeQuery(
      'DELETE FROM technical_document_tags WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );

    if (!deleteResult || deleteResult.affectedRows === 0) {
      return res.status(404).json({ success: false, message: '标签不存在' });
    }

    res.json({ success: true, message: '标签删除成功' });
  } catch (error) {
    logDocEnhancedError('删除标签失败', error, req);
    res.status(500).json({ success: false, message: '删除标签失败' });
  }
});

// 资料标签操作
router.post('/documents/:id/tags', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { tag_ids } = req.body;
    const tenantId = getTenantId(req);
    const normalizedTagIds = normalizePositiveIdList(tag_ids);

    // 验证资料存在
    const [docs] = await executeQuery(
      'SELECT id FROM technical_documents WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );
    if (docs.length === 0) {
      return res.status(404).json({ success: false, message: '资料不存在' });
    }

    if (!normalizedTagIds) {
      return res.status(400).json({ success: false, message: '标签ID列表无效' });
    }

    const tenantTagIds = await getTenantTagIds(normalizedTagIds, tenantId);
    if (tenantTagIds.length !== normalizedTagIds.length) {
      return res.status(400).json({ success: false, message: '标签不存在或不属于当前租户' });
    }

    // 删除旧标签
    await executeQuery('DELETE FROM technical_document_tag_relations WHERE document_id = ? AND tenant_id = ?', [id, tenantId]);

    for (const tagId of normalizedTagIds) {
      await executeQuery(
        'INSERT INTO technical_document_tag_relations (document_id, tag_id, tenant_id) VALUES (?, ?, ?)',
        [id, tagId, tenantId],
      );
    }

    res.json({ success: true, message: '标签更新成功' });
  } catch (error) {
    logDocEnhancedError('更新标签失败', error, req);
    res.status(500).json({ success: false, message: '更新标签失败' });
  }
});

router.get('/documents/:id/tags', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = getTenantId(req);

    if (!(await getTenantDocument(id, tenantId))) {
      return res.status(404).json({ success: false, message: '资料不存在' });
    }

    const [tags] = await executeQuery(
      `SELECT t.* FROM technical_document_tags t
       INNER JOIN technical_document_tag_relations r ON t.id = r.tag_id
       WHERE r.document_id = ? AND t.tenant_id = ?`,
      [id, tenantId],
    );

    res.json({ success: true, data: tags });
  } catch (error) {
    logDocEnhancedError('获取资料标签失败', error, req);
    res.status(500).json({ success: false, message: '获取资料标签失败' });
  }
});

// 版本管理
router.get('/documents/:id/versions', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = getTenantId(req);

    if (!(await getTenantDocument(id, tenantId))) {
      return res.status(404).json({ success: false, message: '资料不存在' });
    }

    const [versions] = await executeQuery(
      `SELECT * FROM technical_document_versions WHERE document_id = ? 
       ORDER BY created_at DESC`,
      [id],
    );

    res.json({ success: true, data: versions });
  } catch (error) {
    logDocEnhancedError('获取版本列表失败', error, req);
    res.status(500).json({ success: false, message: '获取版本列表失败' });
  }
});

router.post('/documents/:id/versions', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = getTenantId(req);
    const { version_number, change_log, file_path, file_size, file_hash } = req.body;

    if (!(await getTenantDocument(id, tenantId))) {
      return res.status(404).json({ success: false, message: '资料不存在' });
    }

    const [result] = await executeQuery(
      `INSERT INTO technical_document_versions 
       (document_id, version_number, file_path, file_size, file_hash, change_log, created_by, created_by_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, version_number, file_path, file_size, file_hash, change_log, req.user.username, req.user.id],
    );

    res.status(201).json({ success: true, message: '版本创建成功', data: { id: result.insertId } });
  } catch (error) {
    logDocEnhancedError('创建版本失败', error, req);
    res.status(500).json({ success: false, message: '创建版本失败' });
  }
});

// 收藏管理
router.post('/documents/:id/favorite', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = getTenantId(req);

    if (!(await getTenantDocument(id, tenantId))) {
      return res.status(404).json({ success: false, message: '资料不存在' });
    }

    // 先检查是否已收藏
    const [existing] = await executeQuery(
      'SELECT id FROM technical_document_favorites WHERE user_id = ? AND document_id = ? AND tenant_id = ?',
      [req.user.id, id, tenantId],
    );

    if (existing && existing.length > 0) {
      return res.json({ success: true, message: '该资料已在收藏列表中', alreadyFavorited: true });
    }

    await executeQuery(
      'INSERT INTO technical_document_favorites (user_id, document_id, tenant_id) VALUES (?, ?, ?)',
      [req.user.id, id, tenantId],
    );

    res.json({ success: true, message: '收藏成功', alreadyFavorited: false });
  } catch (error) {
    logDocEnhancedError('收藏失败', error, req);
    res.status(500).json({ success: false, message: '收藏失败' });
  }
});

router.delete('/documents/:id/favorite', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = getTenantId(req);

    if (!(await getTenantDocument(id, tenantId))) {
      return res.status(404).json({ success: false, message: '资料不存在' });
    }

    await executeQuery(
      'DELETE FROM technical_document_favorites WHERE user_id = ? AND document_id = ? AND tenant_id = ?',
      [req.user.id, id, tenantId],
    );

    res.json({ success: true, message: '取消收藏成功' });
  } catch (error) {
    logDocEnhancedError('取消收藏失败', error, req);
    res.status(500).json({ success: false, message: '取消收藏失败' });
  }
});

router.get('/my/favorites', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { page = 1, pageSize = 10 } = req.query;

    const [docs] = await executeQuery(
      `SELECT d.* FROM technical_documents d
       INNER JOIN technical_document_favorites f ON d.id = f.document_id
       WHERE d.tenant_id = ? AND f.user_id = ?
       ORDER BY f.created_at DESC
       LIMIT ? OFFSET ?`,
      [tenantId, req.user.id, parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize)],
    );

    const [countResult] = await executeQuery(
      `SELECT COUNT(*) as total FROM technical_document_favorites f
       INNER JOIN technical_documents d ON d.id = f.document_id
       WHERE d.tenant_id = ? AND f.user_id = ?`,
      [tenantId, req.user.id],
    );

    res.json({
      success: true,
      data: {
        documents: docs,
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          total: countResult[0].total,
          totalPages: Math.ceil(countResult[0].total / parseInt(pageSize)),
        },
      },
    });
  } catch (error) {
    logDocEnhancedError('获取收藏列表失败', error, req);
    res.status(500).json({ success: false, message: '获取收藏列表失败' });
  }
});

// 评论管理
router.get('/documents/:id/comments', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = getTenantId(req);
    const { resolved } = req.query;

    if (!(await getTenantDocument(id, tenantId))) {
      return res.status(404).json({ success: false, message: '资料不存在' });
    }

    let query = 'SELECT * FROM technical_document_comments WHERE document_id = ? AND tenant_id = ?';
    const params = [id, tenantId];

    if (resolved !== undefined) {
      query += ' AND is_resolved = ?';
      params.push(resolved);
    }

    query += ' ORDER BY created_at DESC';

    const [comments] = await executeQuery(query, params);

    res.json({ success: true, data: comments });
  } catch (error) {
    logDocEnhancedError('获取评论列表失败', error, req);
    res.status(500).json({ success: false, message: '获取评论列表失败' });
  }
});

router.post('/documents/:id/comments', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = getTenantId(req);
    const { content, parent_id } = req.body;
    const normalizedContent = typeof content === 'string' ? content.trim() : '';
    const normalizedParentCommentId = normalizeParentCommentId(parent_id);

    if (!(await getTenantDocument(id, tenantId))) {
      return res.status(404).json({ success: false, message: '资料不存在' });
    }

    if (!normalizedContent) {
      return res.status(400).json({ success: false, message: '评论内容不能为空' });
    }

    if (normalizedParentCommentId == null) {
      return res.status(400).json({ success: false, message: '父评论ID无效' });
    }

    if (
      normalizedParentCommentId > 0 &&
      !(await getTenantCommentForDocument(normalizedParentCommentId, id, tenantId))
    ) {
      return res.status(400).json({ success: false, message: '父评论不存在或不属于当前资料' });
    }

    const [result] = await executeQuery(
      `INSERT INTO technical_document_comments
       (document_id, user_id, user_name, content, parent_id, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        req.user.id,
        req.user.real_name || req.user.username,
        normalizedContent,
        normalizedParentCommentId,
        tenantId,
      ],
    );

    res.status(201).json({ success: true, message: '评论成功', data: { id: result.insertId } });
  } catch (error) {
    logDocEnhancedError('评论失败', error, req);
    res.status(500).json({ success: false, message: '评论失败' });
  }
});

router.put('/comments/:id/resolve', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = getTenantId(req);

    const [comments] = await executeQuery(
      `SELECT c.id
       FROM technical_document_comments c
       INNER JOIN technical_documents d ON c.document_id = d.id
       WHERE c.id = ? AND d.tenant_id = ?
       LIMIT 1`,
      [id, tenantId],
    );

    if (comments.length === 0) {
      return res.status(404).json({ success: false, message: '评论不存在' });
    }

    await executeQuery(
      'UPDATE technical_document_comments SET is_resolved = 1, updated_at = NOW() WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );

    res.json({ success: true, message: '评论已标记为已解决' });
  } catch (error) {
    logDocEnhancedError('标记评论失败', error, req);
    res.status(500).json({ success: false, message: '标记评论失败' });
  }
});

// 访问历史
router.post('/documents/:id/view', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = getTenantId(req);

    if (!(await getTenantDocument(id, tenantId))) {
      return res.status(404).json({ success: false, message: '资料不存在' });
    }

    await executeQuery(
      `INSERT INTO technical_document_history
       (user_id, document_id, action_type, ip_address, user_agent, tenant_id)
       VALUES (?, ?, 'view', ?, ?, ?)`,
      [req.user.id, id, req.ip, req.get('User-Agent'), tenantId],
    );

    res.json({ success: true });
  } catch (error) {
    logDocEnhancedError('记录访问历史失败', error, req);
    res.status(500).json({ success: false, message: '记录访问历史失败' });
  }
});

router.get('/my/history', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { page = 1, pageSize = 20 } = req.query;

    const [history] = await executeQuery(
      `SELECT h.*, d.title as document_title, d.file_name
       FROM technical_document_history h
       INNER JOIN technical_documents d ON h.document_id = d.id
       WHERE h.user_id = ? AND d.tenant_id = ?
       ORDER BY h.created_at DESC
       LIMIT ? OFFSET ?`,
      [req.user.id, tenantId, parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize)],
    );

    res.json({ success: true, data: history });
  } catch (error) {
    logDocEnhancedError('获取访问历史失败', error, req);
    res.status(500).json({ success: false, message: '获取访问历史失败' });
  }
});

// 统计信息
router.get('/statistics', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);

    const [stats] = await executeQuery(
      `SELECT 
         COUNT(*) as total_documents
       FROM technical_documents
       WHERE tenant_id = ?`,
      [tenantId],
    );

    const [categories] = await executeQuery(
      'SELECT COUNT(*) as count FROM technical_document_categories WHERE tenant_id = ?',
      [tenantId],
    );

    const [tags] = await executeQuery(
      'SELECT COUNT(*) as count FROM technical_document_tags WHERE tenant_id = ?',
      [tenantId],
    );

    res.json({
      success: true,
      data: {
        overview: {
          total_documents: stats[0].total_documents,
          total_categories: categories[0].count,
          total_tags: tags[0].count,
        },
      },
    });
  } catch (error) {
    logDocEnhancedError('获取统计信息失败', error, req);
    res.status(500).json({ success: false, message: `获取统计信息失败: ${  error.message}` });
  }
});

// 模板管理
router.get('/templates', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const [templates] = await executeQuery(
      `SELECT t.*, c.category_name 
       FROM technical_document_templates t
       LEFT JOIN technical_document_categories c ON t.category_id = c.id AND c.tenant_id = t.tenant_id
       WHERE t.tenant_id = ? AND t.is_active = 1
       ORDER BY t.created_at DESC`,
      [tenantId],
    );
    res.json({ success: true, data: templates });
  } catch (error) {
    logDocEnhancedError('获取模板列表失败', error, req);
    res.status(500).json({ success: false, message: '获取模板列表失败' });
  }
});

router.post('/templates', authenticate, requireSystemAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { template_name, template_description, category_id, template_fields } = req.body;
    const normalizedCategoryId = normalizeOptionalPositiveId(category_id);

    if (category_id != null && category_id !== '' && !normalizedCategoryId) {
      return res.status(400).json({ success: false, message: '分类ID无效' });
    }

    if (normalizedCategoryId && !(await getTenantCategory(normalizedCategoryId, tenantId))) {
      return res.status(400).json({ success: false, message: '分类不存在或不属于当前租户' });
    }

    const [result] = await executeQuery(
      `INSERT INTO technical_document_templates 
       (tenant_id, template_name, template_description, category_id, template_fields, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [tenantId, template_name, template_description, normalizedCategoryId, template_fields, req.user.username],
    );

    res.status(201).json({ success: true, message: '模板创建成功', data: { id: result.insertId } });
  } catch (error) {
    logDocEnhancedError('创建模板失败', error, req);
    res.status(500).json({ success: false, message: '创建模板失败' });
  }
});

router.delete('/templates/:id', authenticate, requireSystemAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = getTenantId(req);

    const [deleteResult] = await executeQuery(
      'DELETE FROM technical_document_templates WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );

    if (!deleteResult || deleteResult.affectedRows === 0) {
      return res.status(404).json({ success: false, message: '模板不存在' });
    }

    res.json({ success: true, message: '模板删除成功' });
  } catch (error) {
    logDocEnhancedError('删除模板失败', error, req);
    res.status(500).json({ success: false, message: '删除模板失败' });
  }
});

// 批量操作
router.post('/batch/delete', authenticate, requireSystemAdmin, auditLogger('batch_delete', 'documents'), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { document_ids } = req.body;
    const normalizedDocumentIds = normalizePositiveIdList(document_ids);

    if (!Array.isArray(document_ids) || document_ids.length === 0) {
      return res.status(400).json({ success: false, message: '请选择要删除的资料' });
    }

    if (!normalizedDocumentIds || normalizedDocumentIds.length === 0) {
      return res.status(400).json({ success: false, message: '资料ID列表无效' });
    }

    const tenantDocumentIds = await getTenantDocumentIds(normalizedDocumentIds, tenantId);
    if (tenantDocumentIds.length !== normalizedDocumentIds.length) {
      const validIdSet = new Set(tenantDocumentIds);
      const invalidIds = normalizedDocumentIds.filter(id => !validIdSet.has(id));
      return res.status(400).json({
        success: false,
        message: `以下资料不存在或不属于当前租户: ${invalidIds.join(', ')}`,
      });
    }

    const placeholders = normalizedDocumentIds.map(() => '?').join(',');
    await executeQuery(
      `DELETE FROM technical_documents WHERE id IN (${placeholders}) AND tenant_id = ?`,
      [...normalizedDocumentIds, tenantId],
    );

    res.json({ success: true, message: `成功删除 ${normalizedDocumentIds.length} 项资料` });
  } catch (error) {
    logDocEnhancedError('批量删除失败', error, req);
    res.status(500).json({ success: false, message: '批量删除失败' });
  }
});

router.post('/batch/category', authenticate, requireSystemAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { document_ids, category_id } = req.body;
    const normalizedDocumentIds = normalizePositiveIdList(document_ids);
    const normalizedCategoryId = normalizeOptionalPositiveId(category_id);

    if (!Array.isArray(document_ids) || document_ids.length === 0) {
      return res.status(400).json({ success: false, message: '请选择要移动的资料' });
    }

    if (!normalizedDocumentIds || normalizedDocumentIds.length === 0) {
      return res.status(400).json({ success: false, message: '资料ID列表无效' });
    }

    const tenantDocumentIds = await getTenantDocumentIds(normalizedDocumentIds, tenantId);
    if (tenantDocumentIds.length !== normalizedDocumentIds.length) {
      const validIdSet = new Set(tenantDocumentIds);
      const invalidIds = normalizedDocumentIds.filter(id => !validIdSet.has(id));
      return res.status(400).json({
        success: false,
        message: `以下资料不存在或不属于当前租户: ${invalidIds.join(', ')}`,
      });
    }

    if (category_id != null && category_id !== '' && !normalizedCategoryId) {
      return res.status(400).json({ success: false, message: '分类ID无效' });
    }

    if (normalizedCategoryId && !(await getTenantCategory(normalizedCategoryId, tenantId))) {
      return res.status(400).json({ success: false, message: '分类不存在或不属于当前租户' });
    }

    const placeholders = normalizedDocumentIds.map(() => '?').join(',');
    await executeQuery(
      `UPDATE technical_documents SET category_id = ?, updated_at = NOW() 
       WHERE id IN (${placeholders}) AND tenant_id = ?`,
      [normalizedCategoryId, ...normalizedDocumentIds, tenantId],
    );

    res.json({ success: true, message: `成功移动 ${normalizedDocumentIds.length} 项资料` });
  } catch (error) {
    logDocEnhancedError('批量移动失败', error, req);
    res.status(500).json({ success: false, message: '批量移动失败' });
  }
});

module.exports = router;
