const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getTenantId } = require('../middleware/tenant-filter');

const AIService = {
  async unifiedQuery(params, userId, tenantId) {
    try {
      const { question, mode, context } = params;

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
      };

      const selectedMode = modes[mode] || modes['sqlbot'];

      return {
        success: true,
        data: {
          mode,
          modeName: selectedMode.name,
          description: selectedMode.description,
          capabilities: selectedMode.capabilities,
          question,
          context,
          message: `已切换到${selectedMode.name}模式，您可以直接在集成界面中提问`,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
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
    const { question, mode, context } = req.body;
    const tenantId = getTenantId(req);
    const userId = req.user?.id || 1;

    if (!question) {
      return res.status(400).json({ success: false, message: '问题不能为空' });
    }

    const result = await AIService.unifiedQuery({ question, mode, context }, userId, tenantId);

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
