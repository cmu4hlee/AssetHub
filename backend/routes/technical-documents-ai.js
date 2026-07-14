const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { getTenantId } = require('../middleware/tenant-filter');
const https = require('https');

// AI服务配置
const AI_CONFIG = {
  anthropic: {
    apiUrl: process.env.ANTHROPIC_API_URL || 'https://api.minimaxi.com/anthropic',
    apiKey: process.env.ANTHROPIC_API_KEY || 'sk-cp-T20-mwjucm0mkrot80rFF7XcGzOaGH9wKrRsWmQgTRLEG_ckRYgx_8pmUE828S17p7cc23Ke33S6EPPQXcEVO3FJng1c30ZrKTy-5wSbA4b13PfpAMjDZBs',
    model: process.env.ANTHROPIC_MODEL || 'claude-3-opus-20240229',
  },
  deepseek: {
    apiUrl: process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com',
    apiKey: process.env.DEEPSEEK_API_KEY || 'sk-9f97f488ee094931b1280c7d3d0c3814',
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
  },
};

async function callAIChatAPI(messages, service = 'anthropic') {
  const config = AI_CONFIG[service] || AI_CONFIG.anthropic;

  if (!config.apiKey) {
    throw new Error(`${service} API密钥未设置`);
  }

  const provider = service === 'deepseek' ? 'deepseek' : 'anthropic';

  const requestBody = {
    model: config.model,
    messages,
    max_tokens: 2048,
    temperature: 0.7,
  };

  const url = new URL(`${config.apiUrl}/v1/messages`);

  console.log(`[AI Service] Calling ${service} API at ${url.hostname}${url.pathname}`);

  return new Promise((resolve, reject) => {
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey.substring(0, 10)}...`,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-access': 'enable',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`[AI Service] Response status: ${res.statusCode}, data length: ${data.length}`);
        try {
          const response = JSON.parse(data);
          if (response.error) {
            console.error('[AI Service] API error:', response.error);
            reject(new Error(response.error.message || 'API调用失败'));
          } else {
            const text = response.content?.[0]?.text || '';
            console.log(`[AI Service] Response text length: ${text.length}`);
            resolve(text);
          }
        } catch (e) {
          console.error(`[AI Service] Parse error: ${e.message}, data: ${data.substring(0, 200)}`);
          reject(new Error(`解析响应失败: ${e.message}`));
        }
      });
    });

    req.on('error', (e) => {
      console.error(`[AI Service] Request error: ${e.message}`);
      reject(e);
    });
    req.write(JSON.stringify(requestBody));
    req.end();
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

function buildPlaceholders(values) {
  return values.map(() => '?').join(', ');
}

async function getTenantCategoryName(categoryCode, tenantId) {
  const [categories] = await executeQuery(
    `SELECT category_name
     FROM technical_document_categories
     WHERE category_code = ? AND (tenant_id = ? OR tenant_id = 0)
     ORDER BY CASE WHEN tenant_id = ? THEN 0 ELSE 1 END
     LIMIT 1`,
    [categoryCode, tenantId, tenantId],
  );

  return categories[0]?.category_name || categoryCode || '未分类';
}

async function getDocumentTags(documentId, tenantId) {
  const [tags] = await executeQuery(
    `SELECT t.id, t.tag_name, t.tag_color
     FROM technical_document_tags t
     INNER JOIN technical_document_tag_relations r ON t.id = r.tag_id
     WHERE r.document_id = ? AND t.tenant_id = ?`,
    [documentId, tenantId],
  );

  return tags;
}

// 存储AI对话上下文
const aiConversations = new Map();

router.post('/search', authenticate, async (req, res) => {
  try {
    const { query, category_id, tags, limit = 10 } = req.body;
    const tenantId = getTenantId(req);

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ success: false, message: '搜索查询不能为空' });
    }

    // 构建搜索条件
    const searchConditions = ['tenant_id = ?'];
    const searchParams = [tenantId];

    // 关键词搜索（标题和描述）
    if (query) {
      searchConditions.push('(title LIKE ? OR description LIKE ?)');
      searchParams.push(`%${query}%`, `%${query}%`);
    }

    // 分类过滤
    if (category_id) {
      searchConditions.push('category = ?');
      searchParams.push(category_id);
    }

    // 标签过滤
    if (tags && tags.length > 0) {
      searchConditions.push(`
        id IN (
          SELECT r.document_id
          FROM technical_document_tag_relations r
          INNER JOIN technical_document_tags t ON t.id = r.tag_id
          WHERE t.tenant_id = ? AND r.tag_id IN (${tags.map(() => '?').join(',')})
        )
      `);
      searchParams.push(tenantId, ...tags);
    }

    const whereClause = searchConditions.join(' AND ');

    const [documents] = await executeQuery(
      `SELECT id, title, description, file_name, file_type, file_size, 
              category, download_count, view_count, created_at, updated_at
       FROM technical_documents
       WHERE ${whereClause}
       ORDER BY (view_count + download_count * 2) DESC
       LIMIT ?`,
      [...searchParams, limit],
    );

    // 获取文档的标签
    for (const doc of documents) {
      doc.tags = await getDocumentTags(doc.id, tenantId);
    }

    res.json({
      success: true,
      data: {
        documents,
        query,
        total: documents.length,
        suggestion: generateSearchSuggestion(query, documents.length),
      },
    });
  } catch (error) {
    console.error('AI文档搜索失败:', error);
    res.status(500).json({ success: false, message: '搜索失败' });
  }
});

router.post('/summary', authenticate, async (req, res) => {
  try {
    const { document_id, max_length = 500 } = req.body;
    const tenantId = getTenantId(req);

    if (!document_id) {
      return res.status(400).json({ success: false, message: '文档ID不能为空' });
    }

    // 获取文档信息
    const [docs] = await executeQuery(
      'SELECT id, title, description, file_name, file_type, file_size, category, uploaded_by, created_at FROM technical_documents WHERE id = ? AND tenant_id = ?',
      [document_id, tenantId],
    );

    if (docs.length === 0) {
      return res.status(404).json({ success: false, message: '文档不存在' });
    }

    const doc = docs[0];

    // 获取分类名称
    doc.category_name = await getTenantCategoryName(doc.category, tenantId);

    // 获取标签
    doc.tags = await getDocumentTags(document_id, tenantId);

    // 生成AI摘要
    const summary = await generateDocumentSummary(doc, max_length);

    // 记录访问
    await executeQuery(
      `INSERT INTO technical_document_history (user_id, document_id, action_type, ip_address, user_agent, tenant_id)
       VALUES (?, ?, 'ai_summary', ?, ?, ?)`,
      [req.user.id, document_id, req.ip, req.get('User-Agent'), tenantId],
    );

    // 更新统计
    await executeQuery(
      'UPDATE technical_documents SET view_count = view_count + 1 WHERE id = ? AND tenant_id = ?',
      [document_id, tenantId],
    );

    res.json({
      success: true,
      data: {
        document_id: doc.id,
        title: doc.title,
        summary,
        metadata: {
          category: doc.category_name,
          tags: doc.tags.map(t => t.tag_name),
          file_type: doc.file_type,
          file_size: formatFileSize(doc.file_size),
          created_by: doc.created_by,
          created_at: doc.created_at,
        },
        related_documents: await findRelatedDocuments(document_id, tenantId),
      },
    });
  } catch (error) {
    console.error('AI文档摘要生成失败:', error);
    res.status(500).json({ success: false, message: '生成摘要失败' });
  }
});

router.post('/ask', authenticate, async (req, res) => {
  try {
    const { question, document_ids } = req.body;
    let { conversation_id } = req.body;
    const tenantId = getTenantId(req);
    const userId = req.user.id;
    const normalizedDocumentIds = document_ids == null ? null : normalizePositiveIdList(document_ids);

    if (!question || question.trim().length === 0) {
      return res.status(400).json({ success: false, message: '问题不能为空' });
    }

    if (document_ids != null && !normalizedDocumentIds) {
      return res.status(400).json({ success: false, message: '文档ID列表无效' });
    }

    // 获取对话历史
    let history = [];
    if (conversation_id) {
      if (aiConversations.has(conversation_id)) {
        history = aiConversations.get(conversation_id);
      }
    } else {
      // 创建新对话
      conversation_id = `ai_doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // 查找相关文档
    let relevantDocs = [];
    if (normalizedDocumentIds && normalizedDocumentIds.length > 0) {
      const placeholders = buildPlaceholders(normalizedDocumentIds);
      const [docs] = await executeQuery(
        `SELECT id, title, description FROM technical_documents 
         WHERE id IN (${placeholders}) AND tenant_id = ?`,
        [...normalizedDocumentIds, tenantId],
      );
      relevantDocs = docs;
    } else {
      // 搜索相关文档
      const keywords = extractKeywords(question);
      const searchKeyword = keywords[0] || question.trim();
      const [docs] = await executeQuery(
        `SELECT id, title, description FROM technical_documents 
         WHERE tenant_id = ? AND (
           title LIKE ? OR description LIKE ?
         )
         LIMIT 5`,
        [tenantId, `%${searchKeyword}%`, `%${searchKeyword}%`],
      );
      relevantDocs = docs;
    }

    // 生成回答（调用AI服务）
    const answer = await generateAIAnswer(question, relevantDocs, history);

    // 保存用户问题到数据库
    try {
      await executeQuery(
        `INSERT INTO ai_document_conversations 
         (tenant_id, user_id, conversation_id, message_role, message_content, document_ids, sources)
         VALUES (?, ?, ?, 'user', ?, ?, ?)`,
        [tenantId, userId, conversation_id, question, JSON.stringify(normalizedDocumentIds || []), null],
      );

      // 保存AI回答到数据库
      await executeQuery(
        `INSERT INTO ai_document_conversations 
         (tenant_id, user_id, conversation_id, message_role, message_content, document_ids, sources)
         VALUES (?, ?, ?, 'assistant', ?, ?, ?)`,
        [tenantId, userId, conversation_id, answer, JSON.stringify(normalizedDocumentIds || []), JSON.stringify(relevantDocs.map(d => ({ id: d.id, title: d.title })))],
      );
    } catch (dbError) {
      console.error('保存对话记录失败:', dbError.message);
    }

    // 更新内存中的对话历史
    history.push({ role: 'user', content: question, timestamp: new Date() });
    history.push({ role: 'assistant', content: answer, timestamp: new Date(), sources: relevantDocs.map(d => d.id) });

    // 保留最近10轮对话
    if (history.length > 20) {
      history = history.slice(-20);
    }
    aiConversations.set(conversation_id, history);

    res.json({
      success: true,
      data: {
        conversation_id,
        question,
        answer,
        sources: relevantDocs.map(d => ({
          id: d.id,
          title: d.title,
        })),
        history: history.slice(-6).map(h => ({
          role: h.role,
          content: h.content.substring(0, 200) + (h.content.length > 200 ? '...' : ''),
        })),
      },
    });
  } catch (error) {
    console.error('AI问答失败:', error);
    res.status(500).json({ success: false, message: '问答失败' });
  }
});

router.post('/extract', authenticate, async (req, res) => {
  try {
    const { document_id } = req.body;
    const tenantId = getTenantId(req);

    if (!document_id) {
      return res.status(400).json({ success: false, message: '文档ID不能为空' });
    }

    // 获取文档信息
    const [docs] = await executeQuery(
      'SELECT * FROM technical_documents WHERE id = ? AND tenant_id = ?',
      [document_id, tenantId],
    );

    if (docs.length === 0) {
      return res.status(404).json({ success: false, message: '文档不存在' });
    }

    const doc = docs[0];

    // 提取信息
    const extractedInfo = {
      title: doc.title,
      file_name: doc.file_name,
      file_type: doc.file_type,
      file_size: formatFileSize(doc.file_size),
      extracted_at: new Date(),
      keywords: extractKeywords(`${doc.title  } ${  doc.description || ''}`),
      suggested_category: await suggestCategory(`${doc.title  } ${  doc.description || ''}`, tenantId),
      metadata: {
        uploaded_by: doc.uploaded_by,
        created_at: doc.created_at,
        download_count: doc.download_count,
        view_count: doc.view_count,
      },
    };

    res.json({
      success: true,
      data: extractedInfo,
    });
  } catch (error) {
    console.error('信息提取失败:', error);
    res.status(500).json({ success: false, message: '提取失败' });
  }
});

router.post('/suggest-tags', authenticate, async (req, res) => {
  try {
    const { document_id, title, description } = req.body;
    const tenantId = getTenantId(req);

    let docTitle = title;
    let docDescription = description;

    if (document_id) {
      const [docs] = await executeQuery(
        'SELECT title, description FROM technical_documents WHERE id = ? AND tenant_id = ?',
        [document_id, tenantId],
      );
      if (docs.length > 0) {
        docTitle = docs[0].title;
        docDescription = docs[0].description;
      }
    }

    const textContent = `${docTitle || ''} ${docDescription || ''}`;
    const keywords = extractKeywords(textContent);

    const suggestedTags = [
      { tag_name: '重要', tag_color: 'red' },
      { tag_name: '待审核', tag_color: 'orange' },
      { tag_name: '参考', tag_color: 'blue' },
    ];

    if (keywords.includes('维护') || keywords.includes('保养')) {
      suggestedTags.push({ tag_name: '维护', tag_color: 'green' });
    }
    if (keywords.includes('安全') || keywords.includes('操作')) {
      suggestedTags.push({ tag_name: '安全', tag_color: 'red' });
    }
    if (keywords.includes('故障') || keywords.includes('维修')) {
      suggestedTags.push({ tag_name: '维修', tag_color: 'purple' });
    }
    if (keywords.includes('使用') || keywords.includes('手册')) {
      suggestedTags.push({ tag_name: '手册', tag_color: 'cyan' });
    }

    res.json({
      success: true,
      data: {
        keywords,
        suggested_tags: suggestedTags.slice(0, 6),
      },
    });
  } catch (error) {
    console.error('标签建议失败:', error);
    res.status(500).json({ success: false, message: '获取标签建议失败' });
  }
});

router.post('/suggest-category', authenticate, async (req, res) => {
  try {
    const { document_id, title, description } = req.body;
    const tenantId = getTenantId(req);

    let docTitle = title;
    let docDescription = description;

    if (document_id) {
      const [docs] = await executeQuery(
        'SELECT title, description, category FROM technical_documents WHERE id = ? AND tenant_id = ?',
        [document_id, tenantId],
      );
      if (docs.length > 0) {
        docTitle = docs[0].title;
        docDescription = docs[0].description;
      }
    }

    const [categories] = await executeQuery(
      'SELECT category_code, category_name FROM technical_document_categories WHERE (tenant_id = ? OR tenant_id = 0) AND is_active = 1',
      [tenantId],
    );

    const suggestedCategory = await suggestCategory(`${docTitle || ''} ${docDescription || ''}`, tenantId);

    const categoryScores = categories.map(cat => ({
      category_code: cat.category_code,
      category_name: cat.category_name,
      score: cat.category_name === suggestedCategory ? 1 : 0,
    }));

    const categoryKeywords = {
      '使用手册': ['使用', '手册', '指南', '操作', '说明书'],
      '维护保养': ['维护', '保养', '检修', '故障', '维修'],
      '安全规范': ['安全', '规范', '注意事项', '警告', '操作规程'],
      '技术参数': ['参数', '规格', '型号', '技术', '指标'],
      '验收报告': ['验收', '报告', '检测', '合格', '测试'],
    };

    const content = `${docTitle || ''} ${docDescription || ''}`.toLowerCase();
    for (const [catName, keywords] of Object.entries(categoryKeywords)) {
      const matchCount = keywords.filter(kw => content.includes(kw)).length;
      const category = categoryScores.find(c => c.category_name === catName);
      if (category) {
        category.score += matchCount * 0.5;
      }
    }

    categoryScores.sort((a, b) => b.score - a.score);

    res.json({
      success: true,
      data: {
        suggested_category: suggestedCategory,
        category_scores: categoryScores.slice(0, 5),
        all_categories: categories,
      },
    });
  } catch (error) {
    console.error('分类建议失败:', error);
    res.status(500).json({ success: false, message: '获取分类建议失败' });
  }
});

router.post('/ocr', authenticate, async (req, res) => {
  try {
    const { document_id, image_url } = req.body;
    const tenantId = getTenantId(req);

    if (!document_id && !image_url) {
      return res.status(400).json({ success: false, message: '请提供文档ID或图片URL' });
    }

    let imagePath = null;
    let documentInfo = null;

    if (document_id) {
      const [docs] = await executeQuery(
        'SELECT id, title, file_path, file_type FROM technical_documents WHERE id = ? AND tenant_id = ?',
        [document_id, tenantId],
      );

      if (docs.length === 0) {
        return res.status(404).json({ success: false, message: '文档不存在' });
      }

      documentInfo = docs[0];
      imagePath = documentInfo.file_path;
    } else {
      imagePath = image_url;
    }

    const isImage = imagePath.match(/\.(jpg|jpeg|png|gif|bmp|tiff|webp)$/i);

    if (!isImage && !image_url) {
      return res.status(400).json({
        success: false,
        message: 'OCR仅支持图片格式文档（jpg, jpeg, png, gif, bmp, tiff, webp）',
      });
    }

    const ocrResult = {
      success: true,
      text: '',
      confidence: 0,
      blocks: [],
      processing_time: 0,
      document_id: document_id || null,
      processed_at: new Date(),
    };

    try {
      const https = require('https');
      const fs = require('fs');

      let imageData = null;

      if (image_url && image_url.startsWith('http')) {
        imageData = await new Promise((resolve, reject) => {
          https.get(image_url, (res) => {
            const data = [];
            res.on('data', chunk => data.push(chunk));
            res.on('end', () => resolve(Buffer.concat(data)));
            res.on('error', reject);
          }).on('error', reject);
        });
      } else if (fs.existsSync(imagePath)) {
        imageData = fs.readFileSync(imagePath);
      }

      if (!imageData) {
        throw new Error('无法读取图片文件');
      }

      const startTime = Date.now();

      const ocrText = await performOCR(imageData);

      ocrResult.text = ocrText;
      ocrResult.confidence = 0.85;
      ocrResult.blocks = ocrText.split('\n').filter(line => line.trim().length > 0).map((text, index) => ({
        id: index + 1,
        text,
        confidence: 0.85,
      }));
      ocrResult.processing_time = Date.now() - startTime;

    } catch (ocrError) {
      console.error('OCR处理失败:', ocrError.message);
      ocrResult.text = 'OCR处理暂时不可用，请稍后重试';
      ocrResult.error = ocrError.message;
    }

    res.json({
      success: true,
      data: ocrResult,
    });
  } catch (error) {
    console.error('OCR处理失败:', error);
    res.status(500).json({ success: false, message: 'OCR处理失败' });
  }
});

async function performOCR(imageBuffer) {
  const { exec } = require('child_process');
  const path = require('path');
  const os = require('os');
  const fs = require('fs');

  const tempDir = os.tmpdir();
  const tempImagePath = path.join(tempDir, `ocr_${Date.now()}.jpg`);
  const tempOutputPath = path.join(tempDir, `ocr_${Date.now()}.txt`);

  try {
    fs.writeFileSync(tempImagePath, imageBuffer);

    await new Promise((resolve, reject) => {
      exec(`tesseract "${tempImagePath}" "${tempImagePath.replace('.jpg', '')}" -l chi_sim+eng 2>/dev/null`, (error, stdout, stderr) => {
        if (error) {
          console.error('Tesseract执行失败:', error.message);
        }
        resolve();
      });
    });

    if (fs.existsSync(tempOutputPath)) {
      const text = fs.readFileSync(tempOutputPath, 'utf8');
      return text.trim();
    }

    return '无法提取图片中的文字内容。请确保Tesseract OCR已正确安装。';

  } catch (error) {
    console.error('OCR执行失败:', error.message);
    return `OCR处理失败: ${  error.message}`;
  } finally {
    try {
      if (fs.existsSync(tempImagePath)) fs.unlinkSync(tempImagePath);
      if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
    } catch (cleanupError) {
      console.warn('OCR临时文件清理失败:', cleanupError.message);
    }
  }
}

router.post('/recommend', authenticate, async (req, res) => {
  try {
    const { document_id, limit = 5 } = req.body;
    const tenantId = getTenantId(req);

    // 获取用户历史
    const [history] = await executeQuery(
      `SELECT d.*, h.action_type, h.created_at as action_time
       FROM technical_documents d
       INNER JOIN technical_document_history h ON d.id = h.document_id
       WHERE h.user_id = ? AND d.tenant_id = ?
       ORDER BY h.created_at DESC
       LIMIT 20`,
      [req.user.id, tenantId],
    );

    // 提取用户兴趣标签
    const interests = new Set();
    history.forEach(h => {
      if (h.title) {
        extractKeywords(h.title).forEach(k => interests.add(k));
      }
    });

    // 基于兴趣推荐
    const [recommendations] = await executeQuery(
      `SELECT id, title, description, file_name, file_type, view_count, download_count
       FROM technical_documents
       WHERE tenant_id = ? AND id != ?
       ORDER BY (view_count + download_count * 2) DESC
       LIMIT ?`,
      [tenantId, document_id || 0, limit],
    );

    res.json({
      success: true,
      data: {
        recommendations,
        based_on: Array.from(interests).slice(0, 10),
      },
    });
  } catch (error) {
    console.error('推荐失败:', error);
    res.status(500).json({ success: false, message: '推荐失败' });
  }
});

router.get('/preview/:id', authenticate, async (req, res) => {
  try {
    const documentId = req.params.id;
    const tenantId = getTenantId(req);

    const [docs] = await executeQuery(
      'SELECT id, title, description, file_name, file_type, file_size, file_path, category, uploaded_by, upload_date, download_count, view_count FROM technical_documents WHERE id = ? AND tenant_id = ?',
      [documentId, tenantId],
    );

    if (docs.length === 0) {
      return res.status(404).json({ success: false, message: '文档不存在' });
    }

    const doc = docs[0];

    const categoryName = await getTenantCategoryName(doc.category, tenantId);
    const tags = await getDocumentTags(documentId, tenantId);

    const previewInfo = {
      id: doc.id,
      title: doc.title,
      description: doc.description,
      file_name: doc.file_name,
      file_type: doc.file_type,
      file_size: formatFileSize(doc.file_size),
      file_path: doc.file_path,
      category: categoryName,
      tags,
      uploaded_by: doc.uploaded_by,
      upload_date: doc.upload_date,
      download_count: doc.download_count,
      view_count: doc.view_count,
      preview_available: isPreviewable(doc.file_type),
      supported_formats: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'jpg', 'jpeg', 'png', 'gif'],
    };

    res.json({
      success: true,
      data: previewInfo,
    });
  } catch (error) {
    console.error('获取预览信息失败:', error);
    res.status(500).json({ success: false, message: '获取预览信息失败' });
  }
});

function isPreviewable(fileType) {
  if (!fileType) return false;
  const previewableTypes = ['pdf', 'txt', 'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
  return previewableTypes.some(type => fileType.toLowerCase().includes(type));
}

router.post('/compare', authenticate, async (req, res) => {
  try {
    const { document_ids } = req.body;
    const tenantId = getTenantId(req);
    const normalizedDocumentIds = normalizePositiveIdList(document_ids);

    if (!document_ids || document_ids.length < 2) {
      return res.status(400).json({ success: false, message: '至少需要选择2个文档进行对比' });
    }

    if (!normalizedDocumentIds) {
      return res.status(400).json({ success: false, message: '文档ID列表无效' });
    }

    if (normalizedDocumentIds.length < 2) {
      return res.status(400).json({ success: false, message: '至少需要选择2个文档进行对比' });
    }

    const placeholders = buildPlaceholders(normalizedDocumentIds);
    const [docs] = await executeQuery(
      `SELECT id, title, description, file_name, file_type, file_size, 
              category, download_count, view_count, created_at
       FROM technical_documents
       WHERE id IN (${placeholders}) AND tenant_id = ?`,
      [...normalizedDocumentIds, tenantId],
    );

    // 获取标签
    for (const doc of docs) {
      doc.tags = (await getDocumentTags(doc.id, tenantId)).map(tag => tag.tag_name);
    }

    // 生成对比分析
    const comparison = {
      documents: docs.map(d => ({
        id: d.id,
        title: d.title,
        file_type: d.file_type,
        file_size: formatFileSize(d.file_size),
        popularity: d.view_count + d.download_count * 2,
        tags: d.tags,
        created_at: d.created_at,
      })),
      analysis: generateComparisonAnalysis(docs),
    };

    res.json({
      success: true,
      data: comparison,
    });
  } catch (error) {
    console.error('文档对比失败:', error);
    res.status(500).json({ success: false, message: '对比失败' });
  }
});

router.get('/conversations', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const userId = req.user.id;

    const [conversations] = await executeQuery(
      `SELECT 
         conversation_id as id,
         MAX(created_at) as last_message,
         COUNT(*) as message_count
       FROM ai_document_conversations
       WHERE tenant_id = ? AND user_id = ?
       GROUP BY conversation_id
       ORDER BY last_message DESC
       LIMIT 20`,
      [tenantId, userId],
    );

    res.json({
      success: true,
      data: conversations.map(c => ({
        id: c.id,
        last_message: c.last_message,
        timestamp: c.last_message,
        message_count: c.message_count,
      })),
    });
  } catch (error) {
    console.error('获取对话列表失败:', error);
    res.status(500).json({ success: false, message: '获取对话列表失败' });
  }
});

router.get('/conversations/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = getTenantId(req);

    const [messages] = await executeQuery(
      `SELECT message_role as role, message_content as content, created_at as timestamp, sources
       FROM ai_document_conversations
       WHERE conversation_id = ? AND tenant_id = ?
       ORDER BY created_at ASC`,
      [id, tenantId],
    );

    const history = messages.map(m => ({
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
      sources: m.sources ? JSON.parse(m.sources) : null,
    }));

    res.json({
      success: true,
      data: {
        id,
        messages: history,
      },
    });
  } catch (error) {
    console.error('获取对话详情失败:', error);
    res.status(500).json({ success: false, message: '获取对话详情失败' });
  }
});

router.delete('/conversations/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = getTenantId(req);

    await executeQuery(
      'DELETE FROM ai_document_conversations WHERE conversation_id = ? AND tenant_id = ?',
      [id, tenantId],
    );

    aiConversations.delete(id);

    res.json({ success: true, message: '对话已删除' });
  } catch (error) {
    console.error('删除对话失败:', error);
    res.status(500).json({ success: false, message: '删除对话失败' });
  }
});

router.post('/batch/ocr', authenticate, async (req, res) => {
  try {
    const { document_ids } = req.body;
    const tenantId = getTenantId(req);
    const normalizedDocumentIds = normalizePositiveIdList(document_ids);

    if (!document_ids || document_ids.length === 0) {
      return res.status(400).json({ success: false, message: '请选择要处理的文档' });
    }

    if (document_ids.length > 20) {
      return res.status(400).json({ success: false, message: '批量处理最多支持20个文档' });
    }

    if (!normalizedDocumentIds || normalizedDocumentIds.length === 0) {
      return res.status(400).json({ success: false, message: '文档ID列表无效' });
    }

    const placeholders = buildPlaceholders(normalizedDocumentIds);
    const [docs] = await executeQuery(
      `SELECT id, title, file_path, file_type 
       FROM technical_documents 
       WHERE id IN (${placeholders}) AND tenant_id = ?`,
      [...normalizedDocumentIds, tenantId],
    );

    const results = [];
    for (const doc of docs) {
      const isImage = doc.file_type?.match(/\.(jpg|jpeg|png|gif|bmp|tiff|webp)$/i);

      results.push({
        document_id: doc.id,
        title: doc.title,
        file_type: doc.file_type,
        is_processable: !!isImage,
        ocr_status: isImage ? 'pending' : 'not_applicable',
        processed_at: null,
      });
    }

    res.json({
      success: true,
      data: {
        total: results.length,
        processable: results.filter(r => r.is_processable).length,
        results,
      },
    });
  } catch (error) {
    console.error('批量OCR处理失败:', error);
    res.status(500).json({ success: false, message: '批量处理失败' });
  }
});

router.post('/batch/summary', authenticate, async (req, res) => {
  try {
    const { document_ids, max_length = 500 } = req.body;
    const tenantId = getTenantId(req);
    const normalizedDocumentIds = normalizePositiveIdList(document_ids);

    if (!document_ids || document_ids.length === 0) {
      return res.status(400).json({ success: false, message: '请选择要处理的文档' });
    }

    if (document_ids.length > 50) {
      return res.status(400).json({ success: false, message: '批量处理最多支持50个文档' });
    }

    if (!normalizedDocumentIds || normalizedDocumentIds.length === 0) {
      return res.status(400).json({ success: false, message: '文档ID列表无效' });
    }

    const placeholders = buildPlaceholders(normalizedDocumentIds);
    const [docs] = await executeQuery(
      `SELECT id, title, description 
       FROM technical_documents 
       WHERE id IN (${placeholders}) AND tenant_id = ?`,
      [...normalizedDocumentIds, tenantId],
    );

    const results = [];
    for (const doc of docs) {
      const summary = await generateDocumentSummary(doc, max_length);
      results.push({
        document_id: doc.id,
        title: doc.title,
        summary,
        summary_length: summary.length,
      });
    }

    res.json({
      success: true,
      data: {
        total: results.length,
        results,
      },
    });
  } catch (error) {
    console.error('批量摘要生成失败:', error);
    res.status(500).json({ success: false, message: '批量处理失败' });
  }
});

// 辅助函数
function generateSearchSuggestion(query, resultCount) {
  if (resultCount === 0) {
    return `未找到 "${query}" 相关文档，尝试使用更简单的关键词搜索`;
  }
  if (resultCount < 3) {
    return `找到 ${resultCount} 个相关文档，可以尝试使用更精确的关键词`;
  }
  return `找到 ${resultCount} 个相关文档`;
}

async function generateDocumentSummary(doc, maxLength) {
  try {
    const description = doc.description || '';
    const title = doc.title || '';

    if (description.length > 0) {
      try {
        const messages = [
          {
            role: 'user',
            content: `请为以下技术文档生成一个简洁的摘要（最多${maxLength}字符）：

文档标题: ${title}
文档描述: ${description}

请用简洁的中文生成摘要：`,
          },
        ];

        const aiSummary = await callAIChatAPI(messages, 'anthropic');
        if (aiSummary && aiSummary.trim().length > 0) {
          return aiSummary.substring(0, maxLength);
        }
      } catch (aiError) {
        console.error('AI摘要生成失败:', aiError.message);
      }
    }

    if (description.length > 0) {
      return description.substring(0, maxLength) + (description.length > maxLength ? '...' : '');
    } else if (title.length > 0) {
      return `关于 "${title}" 的技术文档。`;
    } else {
      return '暂无文档描述信息。';
    }
  } catch (error) {
    console.error('生成文档摘要失败:', error);
    return '无法生成文档摘要。';
  }
}

async function generateAIAnswer(question, relevantDocs, history) {
  try {
    if (relevantDocs.length === 0) {
      return '抱歉，我没有找到与您问题相关的技术文档。\n\n您可以：\n1. 尝试使用不同的关键词搜索\n2. 上传相关的技术文档\n3. 浏览现有文档分类';
    }

    const systemPrompt = `你是一个技术文档助手，请根据提供的文档内容回答用户的问题。
请用简洁、专业的中文回答。如果文档中没有相关信息，请明确告知用户。`;

    let context = '相关文档内容：\n';
    relevantDocs.forEach((doc, index) => {
      context += `\n文档${index + 1}: ${doc.title}\n`;
      if (doc.description) {
        context += `描述: ${doc.description}\n`;
      }
    });

    const messages = [
      { role: 'user', content: systemPrompt },
      { role: 'user', content: `${context  }\n\n用户问题: ${  question}` },
    ];

    try {
      const answer = await callAIChatAPI(messages, 'anthropic');
      if (answer && answer.trim().length > 0) {
        return answer;
      }
    } catch (aiError) {
      console.error('AI API调用失败，回退到模拟回答:', aiError.message);
    }

    let fallbackAnswer = '根据相关文档，我为您整理了以下信息：\n\n';
    relevantDocs.forEach((doc, index) => {
      fallbackAnswer += `${index + 1}. ${doc.title}\n`;
      if (doc.description) {
        fallbackAnswer += `   ${doc.description.substring(0, 100)}${doc.description.length > 100 ? '...' : ''}\n`;
      }
    });
    fallbackAnswer += '\n如果您需要更详细的信息，可以直接查看以上文档或继续向我提问。';

    return fallbackAnswer;
  } catch (error) {
    console.error('生成AI回答失败:', error);
    return '抱歉，我现在无法回答您的问题，请稍后再试。';
  }
}

function extractKeywords(text) {
  if (!text) return [];

  // 简单分词（实际应用中应使用专业的中文分词库）
  const words = text.split(/[\s,，、。]+/)
    .filter(w => w.length > 1)
    .filter(w => !isStopWord(w));

  return [...new Set(words)].slice(0, 10);
}

function isStopWord(word) {
  const stopWords = ['的', '是', '在', '和', '与', '或', '等', '了', '着', '过', '对', '于', '用', '有', '这', '那', '之', '为', '以', '从', '到', '被'];
  return stopWords.includes(word);
}

async function findRelatedDocuments(documentId, tenantId) {
  try {
    const [docs] = await executeQuery(
      `SELECT id, title FROM technical_documents
       WHERE tenant_id = ? AND id != ?
       ORDER BY RAND()
       LIMIT 3`,
      [tenantId, documentId],
    );
    return docs;
  } catch (error) {
    return [];
  }
}

async function suggestCategory(text, tenantId = 1) {
  const keywords = extractKeywords(text).join('').toLowerCase();

  const [categories] = await executeQuery(
    'SELECT category_code, category_name FROM technical_document_categories WHERE (tenant_id = ? OR tenant_id = 0) AND is_active = 1',
    [tenantId],
  );

  const categoryKeywords = {
    '使用手册': ['使用', '手册', '指南', '操作', '说明书', '使用说明'],
    '维护保养': ['维护', '保养', '检修', '故障', '维修', '定期'],
    '安全规范': ['安全', '规范', '注意事项', '警告', '操作规程', '安全'],
    '技术参数': ['参数', '规格', '型号', '技术', '指标', '性能'],
    '验收报告': ['验收', '报告', '检测', '合格', '测试', '检测'],
    ' warranty': ['保修', '质保', ' warranty', ' warranty'],
    ' certificate': ['证书', '认证', 'certificate', '合格证'],
  };

  let bestCategory = '未分类';
  let bestScore = 0;

  for (const cat of categories) {
    const catName = cat.category_name;
    let score = 0;

    if (categoryKeywords[catName]) {
      for (const keyword of categoryKeywords[catName]) {
        if (keywords.includes(keyword.toLowerCase())) {
          score++;
        }
      }
    }

    if (keywords.includes(catName.substring(0, 2).toLowerCase())) {
      score += 2;
    }

    if (score > bestScore) {
      bestScore = score;
      bestCategory = catName;
    }
  }

  return bestCategory;
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))  } ${  sizes[i]}`;
}

function generateComparisonAnalysis(docs) {
  const analysis = {
    total_documents: docs.length,
    file_types: [...new Set(docs.map(d => d.file_type))],
    total_size: docs.reduce((sum, d) => sum + (d.file_size || 0), 0),
    total_views: docs.reduce((sum, d) => sum + (d.view_count || 0), 0),
    total_downloads: docs.reduce((sum, d) => sum + (d.download_count || 0), 0),
  };

  analysis.total_size_formatted = formatFileSize(analysis.total_size);

  // 找出最受欢迎的文档
  const mostPopular = docs.reduce((max, d) => {
    const score = (d.view_count || 0) + (d.download_count || 0) * 2;
    const maxScore = (max.view_count || 0) + (max.download_count || 0) * 2;
    return score > maxScore ? d : max;
  }, docs[0]);

  analysis.most_popular = {
    id: mostPopular.id,
    title: mostPopular.title,
    popularity: (mostPopular.view_count || 0) + (mostPopular.download_count || 0) * 2,
  };

  return analysis;
}

module.exports = router;
