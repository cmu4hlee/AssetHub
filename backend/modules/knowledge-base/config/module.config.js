/**
 * 知识库模块配置
 */

module.exports = {
  id: 'knowledge-base-management',
  name: '知识库管理',
  displayName: '知识库管理',
  version: '1.0.0',
  description: '上传文档并基于 OpenClaw 实现 AI 智能问答',
  category: 'AI 智能',
  type: 'business',
  status: 'stable',
  enabled: true,

  permissions: [
    {
      code: 'knowledge_base:view',
      name: '查看知识库',
      resource: 'knowledge_base',
      action: 'view',
    },
    {
      code: 'knowledge_base:create',
      name: '新建知识库',
      resource: 'knowledge_base',
      action: 'create',
    },
    {
      code: 'knowledge_base:edit',
      name: '编辑知识库',
      resource: 'knowledge_base',
      action: 'edit',
    },
    {
      code: 'knowledge_base:delete',
      name: '删除知识库',
      resource: 'knowledge_base',
      action: 'delete',
    },
    {
      code: 'knowledge_base:upload',
      name: '上传文档',
      resource: 'knowledge_base_document',
      action: 'upload',
    },
    {
      code: 'knowledge_base:ask',
      name: 'AI 智能问答',
      resource: 'knowledge_base',
      action: 'ask',
    },
  ],

  frontend_config: {
    menu_routes: [
      {
        key: '/knowledge-base',
        icon: 'BookOutlined',
        label: '知识库管理',
        path: '/knowledge-base',
        component: 'KnowledgeBaseList',
        permissions: ['knowledge_base:view'],
      },
      {
        key: '/knowledge-base/qa',
        icon: 'RobotOutlined',
        label: '智能问答',
        path: '/knowledge-base/qa',
        component: 'KnowledgeBaseQA',
        permissions: ['knowledge_base:ask'],
      },
    ],
  },

  menu: [
    {
      key: 'knowledge-base',
      path: '/knowledge-base',
      icon: 'BookOutlined',
      title: '知识库',
    },
    {
      key: 'knowledge-base-qa',
      path: '/knowledge-base/qa',
      icon: 'RobotOutlined',
      title: '智能问答',
    },
  ],

  backend_config: {
    api_prefix: '/api/knowledge-base',
    auto_register: false, // server.js 显式 moduleRoute 挂载,不走 module-loader 自动注册
    routes_path: 'routes',
    database_tables: [
      'knowledge_bases',
      'knowledge_documents',
      'knowledge_chunks',
      'knowledge_qa_records',
      'knowledge_settings',
    ],
    services: [
      { name: 'KnowledgeBaseService', path: 'services/knowledge-base.service' },
      { name: 'KnowledgeBaseAIService', path: 'services/knowledge-base-ai.service' },
      { name: 'KnowledgeBaseParserService', path: 'services/knowledge-base-parser.service' },
    ],
    controllers: [
      { name: 'KnowledgeBaseController', path: 'controllers/knowledge-base.controller' },
    ],
    permissions: [
      'knowledge_base:view',
      'knowledge_base:create',
      'knowledge_base:edit',
      'knowledge_base:delete',
      'knowledge_base:upload',
      'knowledge_base:ask',
    ],
  },
};
