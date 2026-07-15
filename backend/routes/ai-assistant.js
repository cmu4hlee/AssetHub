const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getTenantId } = require('../middleware/tenant-filter');

// 知识库集成 — 让 AI 助手支持"知识库问答"模式 + RAG 增强
const { getDatabase } = require('../core/DatabaseInterface');
const { getEventBus } = require('../core/EventBus');
const KnowledgeBaseService = require('../modules/knowledge-base/services/knowledge-base.service');
const KnowledgeBaseAIService = require('../modules/knowledge-base/services/knowledge-base-ai.service');
const kbDb = getDatabase();
const kbEventBus = getEventBus();
const kbService = new KnowledgeBaseService({ db: kbDb, eventBus: kbEventBus });
const kbAIService = new KnowledgeBaseAIService({ db: kbDb, eventBus: kbEventBus });

const AIService = {
  async unifiedQuery(params, userId, tenantId) {
    try {
      const { question, mode, context, with_kb_search, kb_id } = params;

      const modes = {
        sqlbot: {
          name: '本地AI分析',
          description: '通过本地 Ollama 模型查询资产数据并生成分析报告',
          apiEndpoint: '/api/asset-ai-analysis',
          capabilities: ['数据查询', '统计分析', '报表生成', 'SQL生成'],
        },
        documents: {
          name: '文档智能助手',
          description: '技术文档问答、知识检索、智能推荐',
          apiEndpoint: '/api/technical-documents-ai',
          capabilities: ['文档问答', '知识检索', '文档推荐', '内容摘要'],
        },
        maintenance: {
          name: '维修AI助手',
          description: '维修日志智能分析、故障诊断、保养建议',
          apiEndpoint: '/api/maintenance/ai',
          capabilities: ['故障诊断', '维修建议', '保养计划', '日志分析'],
        },
        search: {
          name: '智能搜索',
          description: '历史问答记录检索、快速定位问题',
          apiEndpoint: '/api/asset-ai-analysis/records',
          capabilities: ['记录搜索', '历史查询', '快速定位', '问答记录'],
        },
        // 新增：知识库问答
        knowledge_base: {
          name: '知识库问答',
          description: '基于上传的文档(SOP/手册/制度)做 RAG 问答,带引用来源',
          apiEndpoint: '/api/knowledge-base/ask',
          capabilities: ['文档问答', '知识检索', 'SOP查询', '引用标注'],
        },
      };

      const selectedMode = modes[mode] || modes['sqlbot'];

      const result = {
        mode,
        modeName: selectedMode.name,
        description: selectedMode.description,
        capabilities: selectedMode.capabilities,
        question,
        context,
        message: `已切换到${selectedMode.name}模式，您可以直接在集成界面中提问`,
      };

      // 可选: 自动从知识库做 RAG 检索,把命中的 chunks 随响应一起返回
      // 前端可在任何 mode 下加 with_kb_search: true 来启用
      if (with_kb_search && question) {
        try {
          const settings = await kbService.getSettings(tenantId);
          if (settings.ai_enabled) {
            const { results: chunks } = await kbService.search(tenantId, {
              question,
              kb_id: kb_id || null,
              top_k: settings.top_k,
              min_score: settings.min_score,
            });
            result.kb_chunks = chunks.map((c, i) => ({
              index: i + 1,
              doc_title: c.doc_title,
              doc_id: c.doc_id,
              kb_id: c.kb_id,
              kb_name: c.kb_name,
              chunk_id: c.id,
              score: Number((c.score || 0).toFixed(4)),
              snippet: String(c.content || '').slice(0, 300),
            }));
            result.kb_chunks_count = chunks.length;
          }
        } catch (kbErr) {
          // 知识库检索失败不影响主流程
          result.kb_search_error = kbErr.message;
        }
      }

      return { success: true, data: result };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  async getModes() {
    return {
      sqlbot: {
        name: '本地AI分析',
        icon: 'database',
        description: '通过本地 Ollama 模型查询资产数据，生成分析报告',
        capabilities: ['数据查询', '统计分析', '报表生成', 'SQL生成'],
        color: '#1890ff',
      },
      documents: {
        name: '文档智能助手',
        icon: 'file-text',
        description: '技术文档问答、知识检索、智能推荐',
        capabilities: ['文档问答', '知识检索', '文档推荐', '内容摘要'],
        color: '#52c41a',
      },
      maintenance: {
        name: '维修AI助手',
        icon: 'tool',
        description: '维修日志智能分析、故障诊断、保养建议',
        capabilities: ['故障诊断', '维修建议', '保养计划', '日志分析'],
        color: '#faad14',
      },
      search: {
        name: '智能搜索',
        icon: 'search',
        description: '历史问答记录检索、快速定位问题',
        capabilities: ['记录搜索', '历史查询', '快速定位', '问答记录'],
        color: '#722ed1',
      },
      // 新增模式
      knowledge_base: {
        name: '知识库问答',
        icon: 'book',
        description: '基于已上传文档(SOP/手册/制度)做 RAG 问答,带引用来源',
        capabilities: ['文档问答', '知识检索', 'SOP查询', '引用标注'],
        color: '#13c2c2',
      },
    };
  },

  async getQuickQuestions() {
    return [
      { text: '查询所有在用资产', mode: 'sqlbot', icon: 'database' },
      { text: '统计各部门资产数量', mode: 'sqlbot', icon: 'bar-chart' },
      { text: '查找维修中的设备', mode: 'maintenance', icon: 'tool' },
      { text: '查询即将到期的保修资产', mode: 'sqlbot', icon: 'warning' },
      { text: '查找关于CT设备的使用手册', mode: 'documents', icon: 'file-text' },
      { text: '搜索关于资产调配的问题记录', mode: 'search', icon: 'search' },
      // 新增快捷问题
      { text: '询问知识库: CT 设备日常保养要点', mode: 'knowledge_base', icon: 'book' },
      { text: '询问知识库: 实验室安全操作规范', mode: 'knowledge_base', icon: 'book' },
    ];
  },
};

/**
 * 获取AI助手所有模式
 * GET /api/ai-assistant/modes
 */
router.get('/modes', authenticate, async (req, res) => {
  try {
    const modes = await AIService.getModes();
    res.json({ success: true, data: modes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 获取快捷问题列表
 * GET /api/ai-assistant/quick-questions
 */
router.get('/quick-questions', authenticate, async (req, res) => {
  try {
    const questions = await AIService.getQuickQuestions();
    res.json({ success: true, data: questions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 统一AI查询接口
 * POST /api/ai-assistant/query
 * @body {string} question - 用户问题
 * @body {string} mode - AI模式
 * @body {object} context - 上下文信息
 */
router.post('/query', authenticate, async (req, res) => {
  try {
    const { question, mode, context, with_kb_search, kb_id } = req.body;
    const tenantId = getTenantId(req);
    const userId = req.user?.id || 1;

    if (!question) {
      return res.status(400).json({ success: false, message: '问题不能为空' });
    }

    const result = await AIService.unifiedQuery({ question, mode, context, with_kb_search, kb_id }, userId, tenantId);

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 获取AI助手配置信息
 * GET /api/ai-assistant/config
 */
router.get('/config', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    res.json({
      success: true,
      data: {
        baseUrl: process.env.SQLBOT_BASE_URL || 'http://localhost:8000',
        integratedPath: '/#/zcgl',
        supportedModes: ['sqlbot', 'documents', 'maintenance', 'search'],
        features: {
          voiceInput: true,
          historyRecord: true,
          quickQuestions: true,
          fullscreen: true,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 记录用户查询历史
 * POST /api/ai-assistant/history
 */
router.post('/history', authenticate, async (req, res) => {
  try {
    const { question, mode, result } = req.body;
    const tenantId = getTenantId(req);
    const userId = req.user?.id;

    // 这里可以扩展为将查询历史保存到数据库
    // 暂时只返回成功响应
    res.json({
      success: true,
      message: '查询已记录',
      data: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
