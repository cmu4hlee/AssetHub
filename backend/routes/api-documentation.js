const express = require('express');
const router = express.Router();

const apiDocumentation = {
  info: {
    title: 'AssetHub 资产管理系统 API',
    version: '1.0.0',
    description: '提供完整的资产管理系统API接口，支持资产管理、维修管理、库存管理等功能',
    baseUrl: '/api',
    documentationUrl: '/api-docs',
  },

  authentication: {
    type: 'Bearer Token',
    header: 'Authorization',
    example: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: '所有API接口（除健康检查外）都需要认证。请在请求头中添加Authorization字段',
  },

  modules: [
    {
      name: '资产模块',
      path: '/assets',
      description: '资产的全生命周期管理，包括资产的增删改查、统计、导入导出等功能',
      endpoints: [
        {
          method: 'GET',
          path: '/assets',
          summary: '获取资产列表',
          description: '支持分页、筛选、排序，获取当前租户下的所有资产',
          parameters: [
            { name: 'page', type: 'integer', required: false, description: '页码，默认1' },
            { name: 'pageSize', type: 'integer', required: false, description: '每页数量，默认20' },
            { name: 'type', type: 'string', required: false, description: '资产类型筛选' },
            { name: 'status', type: 'string', required: false, description: '状态筛选（在用/闲置/维修/报废）' },
            { name: 'department', type: 'string', required: false, description: '部门筛选' },
            { name: 'keyword', type: 'string', required: false, description: '关键词搜索（资产编号、名称、品牌）' },
          ],
          response: {
            success: true,
            data: [{ id: 1, asset_code: 'ZC001', asset_name: '测试资产', status: '在用' }],
            pagination: { page: 1, pageSize: 20, total: 100, totalPages: 5 },
          },
        },
        {
          method: 'GET',
          path: '/assets/:id',
          summary: '获取资产详情',
          description: '根据资产ID或资产编号获取资产的详细信息',
          parameters: [
            { name: 'id', type: 'string', required: true, description: '资产ID或资产编号（asset_code）' },
          ],
        },
        {
          method: 'POST',
          path: '/assets',
          summary: '创建资产',
          description: '添加新资产到系统中',
          requestBody: {
            asset_code: { type: 'string', required: true, description: '资产编号（唯一）' },
            asset_name: { type: 'string', required: true, description: '资产名称' },
            category_id: { type: 'integer', required: true, description: '资产分类ID' },
            brand: { type: 'string', required: false, description: '品牌' },
            model: { type: 'string', required: false, description: '型号' },
            purchase_date: { type: 'string', required: false, description: '购置日期（YYYY-MM-DD）' },
            purchase_price: { type: 'number', required: false, description: '购置价格' },
            department_new: { type: 'string', required: false, description: '使用部门代码' },
            status: { type: 'string', required: false, description: '状态，默认"在用"' },
          },
        },
        {
          method: 'PUT',
          path: '/assets/:id',
          summary: '更新资产',
          description: '修改现有资产的详细信息',
        },
        {
          method: 'DELETE',
          path: '/assets/:id',
          summary: '删除资产',
          description: '删除指定资产（逻辑删除）',
        },
        {
          method: 'GET',
          path: '/assets/statistics/overview',
          summary: '获取资产统计概览',
          description: '获取资产的总体统计数据，包括总数、总价值、各状态数量等',
        },
        {
          method: 'GET',
          path: '/assets/statistics/by-department',
          summary: '获取部门资产分布',
          description: '按部门统计资产数量和价值',
        },
        {
          method: 'GET',
          path: '/assets/export',
          summary: '导出资产',
          description: '导出符合条件的资产数据为Excel文件',
          parameters: [
            { name: 'type', type: 'string', required: false, description: '资产类型' },
            { name: 'status', type: 'string', required: false, description: '状态筛选' },
            { name: 'department', type: 'string', required: false, description: '部门筛选' },
            { name: 'keyword', type: 'string', required: false, description: '关键词搜索' },
          ],
        },
        {
          method: 'GET',
          path: '/assets/import-template',
          summary: '下载导入模板',
          description: '下载资产批量导入的Excel模板文件',
        },
        {
          method: 'POST',
          path: '/assets/import',
          summary: '批量导入资产',
          description: '通过Excel文件批量导入资产数据',
          requestBody: {
            file: { type: 'file', required: true, description: 'Excel文件（.xlsx/.xls）' },
          },
        },
        {
          method: 'GET',
          path: '/assets/categories/list',
          summary: '获取资产分类列表',
          description: '获取所有资产分类，支持按层级筛选',
          parameters: [
            { name: 'level', type: 'integer', required: false, description: '分类层级（1=一级分类）' },
            { name: 'parent_id', type: 'integer', required: false, description: '父分类ID（获取子分类）' },
          ],
        },
        {
          method: 'POST',
          path: '/assets/categories',
          summary: '创建资产分类',
          description: '创建新的资产分类（需要系统管理员权限）',
        },
        {
          method: 'PUT',
          path: '/assets/categories/:id',
          summary: '更新资产分类',
          description: '更新现有资产分类信息',
        },
        {
          method: 'DELETE',
          path: '/assets/categories/:id',
          summary: '删除资产分类',
          description: '删除指定资产分类（需要无子分类和无资产使用）',
        },
        {
          method: 'GET',
          path: '/assets/departments/list',
          summary: '获取部门列表',
          description: '获取所有可用部门列表',
          parameters: [
            { name: 'keyword', type: 'string', required: false, description: '关键词搜索' },
          ],
        },
      ],
    },
    {
      name: '维修模块',
      path: '/maintenance',
      description: '资产维修记录管理，包括报修、维修进度跟踪、维修记录查询等功能',
      endpoints: [
        {
          method: 'GET',
          path: '/maintenance',
          summary: '获取维修列表',
          description: '获取当前用户的维修记录列表',
        },
        {
          method: 'POST',
          path: '/maintenance',
          summary: '创建维修记录',
          description: '提交新的维修申请',
        },
        {
          method: 'GET',
          path: '/maintenance/:id',
          summary: '获取维修详情',
          description: '获取指定维修记录的详细信息',
        },
        {
          method: 'PUT',
          path: '/maintenance/:id',
          summary: '更新维修记录',
          description: '更新维修记录信息',
        },
        {
          method: 'DELETE',
          path: '/maintenance/:id',
          summary: '删除维修记录',
          description: '删除指定维修记录',
        },
      ],
    },
    {
      name: 'AI维修助手',
      path: '/maintenance/ai',
      description: '基于AI的智能维修助手，支持自然语言交互创建维修记录',
      endpoints: [
        {
          method: 'POST',
          path: '/maintenance/ai/init',
          summary: '初始化对话',
          description: '开始一个新的AI维修记录对话会话',
        },
        {
          method: 'POST',
          path: '/maintenance/ai/message',
          summary: '发送消息',
          description: '在对话中发送消息，AI会自动分析并提取维修信息',
          requestBody: {
            conversationId: { type: 'string', required: true, description: '对话ID' },
            message: { type: 'string', required: true, description: '用户消息' },
          },
        },
        {
          method: 'POST',
          path: '/maintenance/ai/submit-request',
          summary: '提交报修申请',
          description: '通过 AI/skill 安全入口提交故障维修申请，单据创建后仍进入待审批状态',
          requestBody: {
            asset_code: { type: 'string', required: true, description: '资产编号' },
            fault_description: { type: 'string', required: true, description: '故障描述' },
            fault_level: { type: 'string', required: false, description: '故障等级' },
            request_department: { type: 'string', required: false, description: '报修部门' },
            contact_phone: { type: 'string', required: false, description: '联系电话' },
            expected_repair_date: { type: 'string', required: false, description: '期望完成日期' },
            remark: { type: 'string', required: false, description: '备注' },
            source: { type: 'string', required: false, description: '提交来源，如 web_ai_assistant / mcp / assetclaw' },
            conversationId: { type: 'string', required: false, description: 'AI 对话 ID' },
          },
        },
        {
          method: 'POST',
          path: '/maintenance/ai/audio',
          summary: '语音输入',
          description: '上传语音文件，AI会进行语音识别并处理',
          requestBody: {
            conversationId: { type: 'string', required: true, description: '对话ID' },
            audio: { type: 'file', required: true, description: '音频文件' },
          },
        },
        {
          method: 'POST',
          path: '/maintenance/ai/extract',
          summary: '提取维修信息',
          description: '从文本中提取结构化的维修信息',
          requestBody: {
            text: { type: 'string', required: true, description: '要分析的文本' },
          },
        },
      ],
    },
    {
      name: '库存盘点模块',
      path: '/inventory',
      description: '资产盘点管理，支持盘点计划制定、盘点执行、差异处理等功能',
      endpoints: [
        {
          method: 'GET',
          path: '/inventory',
          summary: '获取盘点列表',
          description: '获取所有盘点任务列表',
        },
        {
          method: 'POST',
          path: '/inventory',
          summary: '创建盘点任务',
          description: '创建新的盘点任务',
        },
        {
          method: 'GET',
          path: '/inventory/:id',
          summary: '获取盘点详情',
          description: '获取指定盘点的详细信息',
        },
        {
          method: 'PUT',
          path: '/inventory/:id',
          summary: '更新盘点',
          description: '更新盘点任务信息',
        },
        {
          method: 'POST',
          path: '/inventory/:id/records',
          summary: '提交盘点结果',
          description: '提交资产盘点结果',
        },
      ],
    },
    {
      name: '资产调配模块',
      path: '/transfer',
      description: '资产调配申请管理，包括调配申请、审批流程、调配记录等功能',
      endpoints: [
        {
          method: 'GET',
          path: '/transfer',
          summary: '获取调配列表',
          description: '获取资产调配申请列表',
        },
        {
          method: 'POST',
          path: '/transfer',
          summary: '创建调配申请',
          description: '提交资产调配申请',
        },
        {
          method: 'GET',
          path: '/transfer/:id',
          summary: '获取调配详情',
          description: '获取指定调配申请的详细信息',
        },
        {
          method: 'PUT',
          path: '/transfer/:id',
          summary: '更新调配申请',
          description: '更新调配申请信息（待审批状态）',
        },
        {
          method: 'POST',
          path: '/transfer/:id/approve',
          summary: '审批调配',
          description: '审批调配申请',
        },
        {
          method: 'POST',
          path: '/transfer/:id/reject',
          summary: '拒绝调配',
          description: '拒绝调配申请',
        },
      ],
    },
    {
      name: '闲置资产模块',
      path: '/idle',
      description: '闲置资产管理和再利用',
      endpoints: [
        {
          method: 'GET',
          path: '/idle',
          summary: '获取闲置资产列表',
          description: '获取所有闲置状态资产',
        },
        {
          method: 'POST',
          path: '/idle',
          summary: '标记为闲置',
          description: '将资产标记为闲置状态',
        },
        {
          method: 'POST',
          path: '/idle/:id/reuse',
          summary: '重新利用闲置资产',
          description: '将闲置资产重新分配给其他部门或人员',
        },
      ],
    },
    {
      name: '报废管理模块',
      path: '/scrapping',
      description: '资产报废申请和审批管理',
      endpoints: [
        {
          method: 'GET',
          path: '/scrapping',
          summary: '获取报废申请列表',
          description: '获取所有报废申请',
        },
        {
          method: 'POST',
          path: '/scrapping',
          summary: '创建报废申请',
          description: '提交资产报废申请',
        },
        {
          method: 'GET',
          path: '/scrapping/:id',
          summary: '获取报废详情',
          description: '获取报废申请详情',
        },
        {
          method: 'POST',
          path: '/scrapping/:id/appraise',
          summary: '评估报废资产',
          description: '对报废资产进行价值评估',
        },
        {
          method: 'POST',
          path: '/scrapping/:id/approve',
          summary: '审批报废',
          description: '审批报废申请',
        },
        {
          method: 'POST',
          path: '/scrapping/:id/dispose',
          summary: '处置报废资产',
          description: '完成报废资产的最终处置',
        },
      ],
    },
    {
      name: '验收管理模块',
      path: '/acceptance',
      description: '资产验收管理，包括验收申请、验收记录等功能',
      endpoints: [
        {
          method: 'GET',
          path: '/acceptance',
          summary: '获取验收列表',
          description: '获取所有验收记录',
        },
        {
          method: 'POST',
          path: '/acceptance',
          summary: '创建验收',
          description: '创建新的验收记录',
        },
        {
          method: 'GET',
          path: '/acceptance/:id',
          summary: '获取验收详情',
          description: '获取验收记录详情',
        },
        {
          method: 'PUT',
          path: '/acceptance/:id',
          summary: '更新验收',
          description: '更新验收记录',
        },
      ],
    },
    {
      name: '技术资料模块',
      path: '/technical-documents',
      description: '资产技术资料管理，支持资料上传、分类管理、版本控制等功能',
      endpoints: [
        {
          method: 'GET',
          path: '/technical-documents',
          summary: '获取资料列表',
          description: '获取所有技术资料',
        },
        {
          method: 'POST',
          path: '/technical-documents',
          summary: '上传资料',
          description: '上传新的技术资料文件',
          requestBody: {
            file: { type: 'file', required: true, description: '要上传的文件' },
            asset_id: { type: 'integer', required: false, description: '关联资产ID' },
            category_id: { type: 'integer', required: false, description: '分类ID' },
          },
        },
        {
          method: 'GET',
          path: '/technical-documents/:id',
          summary: '获取资料详情',
          description: '获取技术资料详细信息',
        },
        {
          method: 'DELETE',
          path: '/technical-documents/:id',
          summary: '删除资料',
          description: '删除指定技术资料',
        },
        {
          method: 'GET',
          path: '/technical-documents/download/:id',
          summary: '下载资料',
          description: '下载技术资料文件',
        },
      ],
    },
    {
      name: 'AI文档分析模块',
      path: '/technical-documents/ai',
      description: '基于AI的技术资料智能分析功能',
      endpoints: [
        {
          method: 'POST',
          path: '/technical-documents/ai/analyze',
          summary: '分析文档',
          description: '使用AI分析技术资料内容',
        },
        {
          method: 'POST',
          path: '/technical-documents/ai/search',
          summary: '智能搜索',
          description: '基于AI的智能文档搜索',
        },
        {
          method: 'POST',
          path: '/technical-documents/ai/summary',
          summary: '生成摘要',
          description: '为技术资料生成AI摘要',
        },
      ],
    },
    {
      name: '资产定位模块',
      path: '/asset-location',
      description: '资产位置追踪和管理',
      endpoints: [
        {
          method: 'GET',
          path: '/asset-location',
          summary: '获取位置列表',
          description: '获取所有资产位置记录',
        },
        {
          method: 'POST',
          path: '/asset-location',
          summary: '更新位置',
          description: '更新资产位置信息',
        },
        {
          method: 'GET',
          path: '/asset-location/history/:assetId',
          summary: '获取位置历史',
          description: '获取指定资产的位置变更历史',
        },
      ],
    },
    {
      name: 'IoT设备模块',
      path: '/iot-devices',
      description: 'IoT设备管理，用于资产监控和追踪',
      endpoints: [
        {
          method: 'GET',
          path: '/iot-devices',
          summary: '获取设备列表',
          description: '获取所有IoT设备',
        },
        {
          method: 'POST',
          path: '/iot-devices',
          summary: '注册设备',
          description: '注册新的IoT设备',
        },
        {
          method: 'GET',
          path: '/iot-devices/:id',
          summary: '获取设备详情',
          description: '获取IoT设备详细信息',
        },
        {
          method: 'PUT',
          path: '/iot-devices/:id',
          summary: '更新设备',
          description: '更新IoT设备信息',
        },
        {
          method: 'DELETE',
          path: '/iot-devices/:id',
          summary: '删除设备',
          description: '删除指定IoT设备',
        },
        {
          method: 'GET',
          path: '/iot-devices/:id/data',
          summary: '获取设备数据',
          description: '获取IoT设备采集的数据',
        },
      ],
    },
    {
      name: '用户管理模块',
      path: '/users',
      description: '系统用户管理，包括用户信息、角色权限等功能',
      endpoints: [
        {
          method: 'GET',
          path: '/users/profile',
          summary: '获取当前用户信息',
          description: '获取登录用户的详细信息',
        },
        {
          method: 'PUT',
          path: '/users/profile',
          summary: '更新当前用户信息',
          description: '更新登录用户的个人信息',
        },
        {
          method: 'PUT',
          path: '/users/password',
          summary: '修改密码',
          description: '修改当前用户的密码',
        },
        {
          method: 'POST',
          path: '/users/login',
          summary: '用户登录',
          description: '用户认证登录',
          requestBody: {
            username: { type: 'string', required: true, description: '用户名' },
            password: { type: 'string', required: true, description: '密码' },
          },
        },
        {
          method: 'POST',
          path: '/users/logout',
          summary: '用户登出',
          description: '用户退出登录',
        },
      ],
    },
    {
      name: '角色权限模块',
      path: '/roles-permissions',
      description: '角色和权限管理',
      endpoints: [
        {
          method: 'GET',
          path: '/roles-permissions/roles',
          summary: '获取角色列表',
          description: '获取所有可用角色',
        },
        {
          method: 'POST',
          path: '/roles-permissions/roles',
          summary: '创建角色',
          description: '创建新角色',
        },
        {
          method: 'GET',
          path: '/roles-permissions/permissions',
          summary: '获取权限列表',
          description: '获取所有系统权限',
        },
        {
          method: 'POST',
          path: '/roles-permissions/roles/:roleId/permissions',
          summary: '分配权限',
          description: '为角色分配权限',
        },
      ],
    },
    {
      name: '部门管理模块',
      path: '/departments',
      description: '组织架构管理，包括部门创建、层级管理等功能',
      endpoints: [
        {
          method: 'GET',
          path: '/departments',
          summary: '获取部门列表',
          description: '获取所有部门',
        },
        {
          method: 'POST',
          path: '/departments',
          summary: '创建部门',
          description: '创建新部门',
        },
        {
          method: 'GET',
          path: '/departments/:id',
          summary: '获取部门详情',
          description: '获取部门详细信息',
        },
        {
          method: 'PUT',
          path: '/departments/:id',
          summary: '更新部门',
          description: '更新部门信息',
        },
        {
          method: 'DELETE',
          path: '/departments/:id',
          summary: '删除部门',
          description: '删除指定部门',
        },
      ],
    },
    {
      name: '资产标签模块',
      path: '/asset-labels',
      description: '资产标签生成和管理',
      endpoints: [
        {
          method: 'POST',
          path: '/asset-labels/generate',
          summary: '生成标签',
          description: '生成资产标签',
        },
        {
          method: 'POST',
          path: '/asset-labels/print',
          summary: '打印标签',
          description: '批量打印资产标签',
        },
      ],
    },
    {
      name: '资产图片模块',
      path: '/asset-images',
      description: '资产图片管理',
      endpoints: [
        {
          method: 'GET',
          path: '/asset-images',
          summary: '获取图片列表',
          description: '获取资产关联的图片列表',
        },
        {
          method: 'POST',
          path: '/asset-images',
          summary: '上传图片',
          description: '上传资产图片',
        },
        {
          method: 'DELETE',
          path: '/asset-images/:id',
          summary: '删除图片',
          description: '删除资产图片',
        },
      ],
    },
    {
      name: '临时资产模块',
      path: '/temp-assets',
      description: '临时资产登记和管理',
      endpoints: [
        {
          method: 'GET',
          path: '/temp-assets',
          summary: '获取临时资产列表',
          description: '获取所有临时资产',
        },
        {
          method: 'POST',
          path: '/temp-assets',
          summary: '创建临时资产',
          description: '登记临时资产',
        },
        {
          method: 'PUT',
          path: '/temp-assets/:id',
          summary: '更新临时资产',
          description: '更新临时资产信息',
        },
        {
          method: 'DELETE',
          path: '/temp-assets/:id',
          summary: '删除临时资产',
          description: '删除临时资产',
        },
        {
          method: 'POST',
          path: '/temp-assets/:id/convert',
          summary: '转为正式资产',
          description: '将临时资产转为正式资产',
        },
      ],
    },
    {
      name: '位置编码模块',
      path: '/location-codes',
      description: '资产存放位置编码管理',
      endpoints: [
        {
          method: 'GET',
          path: '/location-codes',
          summary: '获取位置编码列表',
          description: '获取所有位置编码',
        },
        {
          method: 'POST',
          path: '/location-codes',
          summary: '创建位置编码',
          description: '创建新的位置编码',
        },
        {
          method: 'DELETE',
          path: '/location-codes/:id',
          summary: '删除位置编码',
          description: '删除位置编码',
        },
      ],
    },
    {
      name: '质量控制模块',
      path: '/quality-control',
      description: '资产质量控制管理',
      endpoints: [
        {
          method: 'GET',
          path: '/quality-control',
          summary: '获取质检列表',
          description: '获取所有质量检查记录',
        },
        {
          method: 'POST',
          path: '/quality-control',
          summary: '创建质检',
          description: '创建质量检查记录',
        },
        {
          method: 'GET',
          path: '/quality-control/:id',
          summary: '获取质检详情',
          description: '获取质检详情',
        },
        {
          method: 'POST',
          path: '/quality-control/:id/result',
          summary: '提交质检结果',
          description: '提交质检结果',
        },
      ],
    },
    {
      name: '不良反映模块',
      path: '/adverse-reaction',
      description: '资产不良反映管理',
      endpoints: [
        {
          method: 'GET',
          path: '/adverse-reaction',
          summary: '获取不良反映列表',
          description: '获取所有不良反映记录',
        },
        {
          method: 'POST',
          path: '/adverse-reaction',
          summary: '提交不良反映',
          description: '提交资产不良反映',
        },
        {
          method: 'GET',
          path: '/adverse-reaction/:id',
          summary: '获取详情',
          description: '获取不良反映详情',
        },
        {
          method: 'PUT',
          path: '/adverse-reaction/:id',
          summary: '更新不良反映',
          description: '更新不良反映信息',
        },
      ],
    },
    {
      name: '租户管理模块',
      path: '/tenants',
      description: '多租户管理（超级管理员专用）',
      endpoints: [
        {
          method: 'GET',
          path: '/tenants',
          summary: '获取租户列表',
          description: '获取所有租户',
        },
        {
          method: 'POST',
          path: '/tenants',
          summary: '创建租户',
          description: '创建新租户',
        },
        {
          method: 'GET',
          path: '/tenants/:id',
          summary: '获取租户详情',
          description: '获取租户详细信息',
        },
        {
          method: 'PUT',
          path: '/tenants/:id',
          summary: '更新租户',
          description: '更新租户信息',
        },
      ],
    },
    {
      name: '审计日志模块',
      path: '/audit-logs',
      description: '系统操作审计日志',
      endpoints: [
        {
          method: 'GET',
          path: '/audit-logs',
          summary: '获取审计日志',
          description: '获取系统操作审计日志',
        },
        {
          method: 'GET',
          path: '/audit-logs/:id',
          summary: '获取日志详情',
          description: '获取单条审计日志详情',
        },
      ],
    },
    {
      name: '系统配置模块',
      path: '/system-config',
      description: '系统配置管理',
      endpoints: [
        {
          method: 'GET',
          path: '/system-config',
          summary: '获取配置',
          description: '获取系统配置',
        },
        {
          method: 'PUT',
          path: '/system-config',
          summary: '更新配置',
          description: '更新系统配置',
        },
      ],
    },
    {
      name: '备份恢复模块',
      path: '/backup',
      description: '数据备份和恢复管理',
      endpoints: [
        {
          method: 'GET',
          path: '/backup',
          summary: '获取备份列表',
          description: '获取所有备份记录',
        },
        {
          method: 'POST',
          path: '/backup',
          summary: '创建备份',
          description: '创建新的数据备份',
        },
        {
          method: 'GET',
          path: '/backup/:id',
          summary: '获取备份详情',
          description: '获取备份详细信息',
        },
        {
          method: 'POST',
          path: '/backup/:id/restore',
          summary: '恢复备份',
          description: '从备份恢复数据',
        },
        {
          method: 'DELETE',
          path: '/backup/:id',
          summary: '删除备份',
          description: '删除指定备份',
        },
      ],
    },
    {
      name: '增强权限模块',
      path: '/enhanced-permissions',
      description: '增强型权限管理，支持细粒度权限控制',
      endpoints: [
        {
          method: 'GET',
          path: '/enhanced-permissions',
          summary: '获取权限列表',
          description: '获取所有权限定义',
        },
        {
          method: 'POST',
          path: '/enhanced-permissions',
          summary: '创建权限',
          description: '创建新权限',
        },
        {
          method: 'PUT',
          path: '/enhanced-permissions/:id',
          summary: '更新权限',
          description: '更新权限信息',
        },
        {
          method: 'DELETE',
          path: '/enhanced-permissions/:id',
          summary: '删除权限',
          description: '删除权限',
        },
      ],
    },
    {
      name: 'AI资产分析模块',
      path: '/asset-ai-analysis',
      description: '基于AI的资产智能分析功能',
      endpoints: [
        {
          method: 'POST',
          path: '/asset-ai-analysis/analyze',
          summary: 'AI资产分析',
          description: '使用AI分析资产数据，提供优化建议',
        },
        {
          method: 'POST',
          path: '/asset-ai-analysis/predict',
          summary: '预测分析',
          description: 'AI预测资产使用寿命和维护需求',
        },
        {
          method: 'POST',
          path: '/asset-ai-analysis/recommend',
          summary: '智能推荐',
          description: 'AI推荐资产配置和维护方案',
        },
      ],
    },
    {
      name: '验收模块',
      path: '/acceptance',
      description: '资产验收管理',
      endpoints: [
        {
          method: 'GET',
          path: '/acceptance',
          summary: '获取验收列表',
          description: '获取所有验收记录',
        },
        {
          method: 'POST',
          path: '/acceptance',
          summary: '创建验收',
          description: '创建验收记录',
        },
        {
          method: 'GET',
          path: '/acceptance/:id',
          summary: '验收详情',
          description: '获取验收详情',
        },
      ],
    },
    {
      name: '物资模块',
      path: '/materials',
      description: '低值易耗品管理',
      endpoints: [
        {
          method: 'GET',
          path: '/materials',
          summary: '获取物资列表',
          description: '获取所有物资',
        },
        {
          method: 'POST',
          path: '/materials',
          summary: '创建物资',
          description: '创建新物资',
        },
        {
          method: 'PUT',
          path: '/materials/:id',
          summary: '更新物资',
          description: '更新物资信息',
        },
        {
          method: 'DELETE',
          path: '/materials/:id',
          summary: '删除物资',
          description: '删除物资',
        },
      ],
    },
    {
      name: '模块配置模块',
      path: '/modules',
      description: '系统模块管理',
      endpoints: [
        {
          method: 'GET',
          path: '/modules',
          summary: '获取模块列表',
          description: '获取所有系统模块',
        },
        {
          method: 'POST',
          path: '/modules',
          summary: '创建模块',
          description: '创建新模块',
        },
        {
          method: 'PUT',
          path: '/modules/:id',
          summary: '更新模块',
          description: '更新模块信息',
        },
        {
          method: 'PUT',
          path: '/modules/:id/enable',
          summary: '启用模块',
          description: '启用指定模块',
        },
        {
          method: 'PUT',
          path: '/modules/:id/disable',
          summary: '禁用模块',
          description: '禁用指定模块',
        },
      ],
    },
    {
      name: '租户模块配置',
      path: '/tenant-module-config',
      description: '租户模块配置管理',
      endpoints: [
        {
          method: 'GET',
          path: '/tenant-module-config',
          summary: '获取配置列表',
          description: '获取所有租户模块配置',
        },
        {
          method: 'POST',
          path: '/tenant-module-config',
          summary: '创建配置',
          description: '创建租户模块配置',
        },
        {
          method: 'PUT',
          path: '/tenant-module-config/:id',
          summary: '更新配置',
          description: '更新租户模块配置',
        },
      ],
    },
    {
      name: '系统模块',
      path: '/modules',
      description: '系统功能模块管理',
      endpoints: [
        {
          method: 'GET',
          path: '/modules',
          summary: '获取模块列表',
          description: '获取所有可用系统模块',
        },
        {
          method: 'POST',
          path: '/modules',
          summary: '创建模块',
          description: '创建新系统模块',
        },
        {
          method: 'PUT',
          path: '/modules/:id',
          summary: '更新模块',
          description: '更新模块信息',
        },
        {
          method: 'DELETE',
          path: '/modules/:id',
          summary: '删除模块',
          description: '删除模块',
        },
      ],
    },
    {
      name: '条码扫描模块',
      path: '/barcode-scan',
      description: '资产条码扫描和验证，支持批量盘点和扫码操作',
      endpoints: [
        {
          method: 'GET',
          path: '/',
          summary: '获取扫描记录',
          description: '获取条码扫描历史记录',
        },
        {
          method: 'GET',
          path: '/generate/:asset_code',
          summary: '生成资产条码',
          description: '根据资产编号生成条码图片',
        },
        {
          method: 'POST',
          path: '/verify',
          summary: '验证条码',
          description: '扫描验证资产条码是否有效',
        },
        {
          method: 'POST',
          path: '/inventory',
          summary: '扫码盘点',
          description: '通过扫描条码快速完成资产盘点',
        },
        {
          method: 'GET',
          path: '/logs',
          summary: '获取扫描日志',
          description: '获取条码扫描操作日志',
        },
      ],
    },
    {
      name: '盘点计划模块',
      path: '/inventory-plans',
      description: '盘点计划管理，支持创建、激活、完成、取消盘点计划',
      endpoints: [
        {
          method: 'GET',
          path: '/',
          summary: '获取盘点计划列表',
          description: '获取所有盘点计划',
        },
        {
          method: 'GET',
          path: '/:id',
          summary: '获取盘点计划详情',
          description: '获取指定盘点计划的详细信息',
        },
        {
          method: 'POST',
          path: '/',
          summary: '创建盘点计划',
          description: '创建新的盘点计划',
        },
        {
          method: 'PUT',
          path: '/:id',
          summary: '更新盘点计划',
          description: '更新盘点计划信息',
        },
        {
          method: 'DELETE',
          path: '/:id',
          summary: '删除盘点计划',
          description: '删除指定盘点计划',
        },
        {
          method: 'PUT',
          path: '/:id/activate',
          summary: '激活盘点计划',
          description: '激活盘点计划使其生效',
        },
        {
          method: 'PUT',
          path: '/:id/complete',
          summary: '完成盘点计划',
          description: '标记盘点计划为已完成',
        },
        {
          method: 'PUT',
          path: '/:id/cancel',
          summary: '取消盘点计划',
          description: '取消指定的盘点计划',
        },
      ],
    },
    {
      name: '盘点差异模块',
      path: '/inventory-discrepancies',
      description: '盘点差异记录管理，支持差异处理和批量处理',
      endpoints: [
        {
          method: 'GET',
          path: '/',
          summary: '获取盘点差异列表',
          description: '获取所有盘点差异记录',
        },
        {
          method: 'GET',
          path: '/:id',
          summary: '获取差异详情',
          description: '获取指定盘点差异的详细信息',
        },
        {
          method: 'PUT',
          path: '/:id/handle',
          summary: '处理差异',
          description: '处理单个盘点差异',
        },
        {
          method: 'POST',
          path: '/batch-handle',
          summary: '批量处理差异',
          description: '批量处理多个盘点差异',
        },
        {
          method: 'GET',
          path: '/:inventory_id/statistics',
          summary: '获取差异统计',
          description: '获取指定盘点的差异统计信息',
        },
        {
          method: 'POST',
          path: '/generate-from-details',
          summary: '生成差异记录',
          description: '根据盘点明细自动生成差异记录',
        },
      ],
    },
    {
      name: '盘点任务模块',
      path: '/inventory-tasks',
      description: '盘点任务执行管理，支持任务分配、开始、完成、取消',
      endpoints: [
        {
          method: 'GET',
          path: '/',
          summary: '获取盘点任务列表',
          description: '获取所有盘点任务',
        },
        {
          method: 'GET',
          path: '/:id',
          summary: '获取任务详情',
          description: '获取指定盘点任务的详细信息',
        },
        {
          method: 'POST',
          path: '/',
          summary: '创建盘点任务',
          description: '创建新的盘点任务',
        },
        {
          method: 'PUT',
          path: '/:id/assign',
          summary: '分配任务',
          description: '分配盘点任务给负责人',
        },
        {
          method: 'PUT',
          path: '/:id/start',
          summary: '开始任务',
          description: '开始执行盘点任务',
        },
        {
          method: 'PUT',
          path: '/:id/complete',
          summary: '完成任务',
          description: '完成盘点任务并提交结果',
        },
        {
          method: 'PUT',
          path: '/:id/cancel',
          summary: '取消任务',
          description: '取消指定的盘点任务',
        },
        {
          method: 'PUT',
          path: '/:id',
          summary: '更新任务',
          description: '更新盘点任务信息',
        },
        {
          method: 'DELETE',
          path: '/:id',
          summary: '删除任务',
          description: '删除指定的盘点任务',
        },
        {
          method: 'GET',
          path: '/my/tasks',
          summary: '获取我的任务',
          description: '获取当前用户负责的盘点任务',
        },
      ],
    },
    {
      name: '智能告警模块',
      path: '/intelligent-alerts',
      description: '智能告警管理，支持告警查看、标记已读、处理等',
      endpoints: [
        {
          method: 'GET',
          path: '/overview',
          summary: '获取告警概览',
          description: '获取告警统计概览',
        },
        {
          method: 'GET',
          path: '/',
          summary: '获取告警列表',
          description: '获取所有智能告警列表',
        },
        {
          method: 'POST',
          path: '/:alertId/read',
          summary: '标记已读',
          description: '将告警标记为已读',
        },
        {
          method: 'POST',
          path: '/:alertId/handle',
          summary: '处理告警',
          description: '处理指定告警',
        },
        {
          method: 'POST',
          path: '/:alertId/unhandle',
          summary: '取消处理',
          description: '取消告警的处理状态',
        },
        {
          method: 'POST',
          path: '/read-all',
          summary: '全部标记已读',
          description: '将所有告警标记为已读',
        },
        {
          method: 'POST',
          path: '/handle-all',
          summary: '批量处理告警',
          description: '批量处理所有告警',
        },
        {
          method: 'GET',
          path: '/maintenance',
          summary: '维修告警',
          description: '获取维修相关告警',
        },
        {
          method: 'GET',
          path: '/qualifications',
          summary: '资质告警',
          description: '获取资质相关告警',
        },
        {
          method: 'GET',
          path: '/inspections',
          summary: '巡检告警',
          description: '获取巡检相关告警',
        },
        {
          method: 'GET',
          path: '/safety',
          summary: '安全告警',
          description: '获取安全相关告警',
        },
        {
          method: 'GET',
          path: '/uptime',
          summary: '运行时间告警',
          description: '获取运行时间相关告警',
        },
        {
          method: 'GET',
          path: '/settings',
          summary: '获取告警设置',
          description: '获取告警规则设置',
        },
        {
          method: 'POST',
          path: '/settings',
          summary: '更新告警设置',
          description: '更新告警规则设置',
        },
      ],
    },
    {
      name: '位置告警模块',
      path: '/location-alerts',
      description: '资产位置异常告警管理',
      endpoints: [
        {
          method: 'GET',
          path: '/',
          summary: '获取位置告警列表',
          description: '获取所有位置告警记录',
        },
        {
          method: 'GET',
          path: '/stats',
          summary: '获取告警统计',
          description: '获取位置告警统计信息',
        },
        {
          method: 'PUT',
          path: '/:id/handle',
          summary: '处理告警',
          description: '处理指定位置告警',
        },
        {
          method: 'DELETE',
          path: '/:id',
          summary: '删除告警',
          description: '删除指定位置告警',
        },
        {
          method: 'POST',
          path: '/batch/handle',
          summary: '批量处理告警',
          description: '批量处理多个位置告警',
        },
      ],
    },
    {
      name: '采购管理模块',
      path: '/procurement',
      description: '采购申请管理，支持采购流程审批',
      endpoints: [
        {
          method: 'GET',
          path: '/',
          summary: '获取采购列表',
          description: '获取所有采购申请',
        },
        {
          method: 'POST',
          path: '/',
          summary: '创建采购申请',
          description: '提交新的采购申请',
        },
        {
          method: 'PUT',
          path: '/:id/approve',
          summary: '审批采购',
          description: '审批采购申请',
        },
      ],
    },
    {
      name: '折旧计算模块',
      path: '/depreciation',
      description: '资产折旧计算和统计，支持多种折旧方法',
      endpoints: [
        {
          method: 'GET',
          path: '/',
          summary: '获取折旧列表',
          description: '获取资产折旧列表',
        },
        {
          method: 'GET',
          path: '/summary/by-department',
          summary: '按部门汇总折旧',
          description: '按部门汇总折旧数据',
        },
        {
          method: 'GET',
          path: '/summary/by-type',
          summary: '按类型汇总折旧',
          description: '按资产类型汇总折旧数据',
        },
        {
          method: 'GET',
          path: '/summary/by-month',
          summary: '按月统计折旧',
          description: '按月份统计折旧趋势',
        },
        {
          method: 'POST',
          path: '/calculate',
          summary: '计算折旧',
          description: '执行折旧计算',
        },
        {
          method: 'GET',
          path: '/export',
          summary: '导出折旧数据',
          description: '导出折旧数据为Excel',
        },
        {
          method: 'GET',
          path: '/methods',
          summary: '获取折旧方法',
          description: '获取支持的折旧计算方法',
        },
        {
          method: 'GET',
          path: '/depreciation/:id',
          summary: '获取折旧详情',
          description: '获取指定资产的折旧详情',
        },
      ],
    },
    {
      name: '工作流模块',
      path: '/workflow',
      description: '资产状态工作流管理，支持状态迁移和流程配置',
      endpoints: [
        {
          method: 'GET',
          path: '/',
          summary: '获取工作流列表',
          description: '获取所有工作流定义',
        },
        {
          method: 'GET',
          path: '/default',
          summary: '获取默认工作流',
          description: '获取当前租户的默认工作流',
        },
        {
          method: 'GET',
          path: '/states',
          summary: '获取状态列表',
          description: '获取工作流状态定义',
        },
        {
          method: 'GET',
          path: '/transitions',
          summary: '获取迁移规则',
          description: '获取状态迁移规则',
        },
        {
          method: 'POST',
          path: '/transition/:assetId',
          summary: '执行状态迁移',
          description: '对指定资产执行状态迁移',
        },
      ],
    },
    {
      name: 'AI对话模块',
      path: '/ai',
      description: 'AI对话服务，支持资产管理的智能问答',
      endpoints: [
        {
          method: 'POST',
          path: '/chat/completions',
          summary: '对话补全',
          description: '发送对话请求获取AI回复',
        },
        {
          method: 'POST',
          path: '/completions',
          summary: '补全请求',
          description: 'AI补全请求接口',
        },
        {
          method: 'GET',
          path: '/config',
          summary: '获取AI配置',
          description: '获取AI服务配置信息',
        },
      ],
    },
    {
      name: '维修AI模块',
      path: '/maintenance-ai',
      description: 'AI维修助手，支持自然语言处理维修工单',
      endpoints: [
        {
          method: 'POST',
          path: '/init',
          summary: '初始化对话',
          description: '开始新的AI维修对话会话',
        },
        {
          method: 'GET',
          path: '/pending',
          summary: '获取待处理请求',
          description: '获取AI待处理的维修申请',
        },
        {
          method: 'POST',
          path: '/message',
          summary: '发送消息',
          description: '在对话中发送消息',
        },
        {
          method: 'POST',
          path: '/submit-request',
          summary: '提交维修申请',
          description: '通过AI提交故障维修申请',
        },
        {
          method: 'POST',
          path: '/feedback',
          summary: '提交反馈',
          description: '对AI维修建议提交反馈',
        },
        {
          method: 'POST',
          path: '/audio',
          summary: '语音输入',
          description: '上传语音进行维修咨询',
        },
        {
          method: 'GET',
          path: '/analysis',
          summary: 'AI分析',
          description: '获取AI维修分析结果',
        },
        {
          method: 'POST',
          path: '/test',
          summary: '测试AI',
          description: '测试AI维修功能',
        },
        {
          method: 'GET',
          path: '/debug-asset',
          summary: '调试资产',
          description: '获取资产调试信息',
        },
      ],
    },
    {
      name: '云同步模块',
      path: '/cloud-sync',
      description: '多端数据云同步服务',
      endpoints: [
        {
          method: 'POST',
          path: '/webhook/:sourceId',
          summary: '接收Webhook',
          description: '接收第三方数据同步Webhook',
        },
        {
          method: 'GET',
          path: '/sources',
          summary: '获取同步源',
          description: '获取所有数据同步源',
        },
        {
          method: 'POST',
          path: '/sources',
          summary: '创建同步源',
          description: '创建新的数据同步源',
        },
        {
          method: 'PUT',
          path: '/sources/:id',
          summary: '更新同步源',
          description: '更新同步源配置',
        },
        {
          method: 'DELETE',
          path: '/sources/:id',
          summary: '删除同步源',
          description: '删除指定的同步源',
        },
        {
          method: 'GET',
          path: '/events',
          summary: '获取同步事件',
          description: '获取数据同步事件记录',
        },
        {
          method: 'GET',
          path: '/events/stream',
          summary: '事件流',
          description: '获取实时同步事件流',
        },
      ],
    },
    {
      name: '仪表板模块',
      path: '/dashboard',
      description: '仪表板数据接口，提供实时和统计的数据',
      endpoints: [
        {
          method: 'GET',
          path: '/',
          summary: '获取仪表板数据',
          description: '获取仪表板展示数据',
        },
        {
          method: 'GET',
          path: '/realtime',
          summary: '获取实时数据',
          description: '获取实时更新的仪表板数据',
        },
      ],
    },
    {
      name: '健康检查模块',
      path: '/health',
      description: '系统健康检查接口，无需认证',
      endpoints: [
        {
          method: 'GET',
          path: '/health',
          summary: '健康检查',
          description: '基础健康检查',
        },
        {
          method: 'GET',
          path: '/health/detailed',
          summary: '详细健康检查',
          description: '获取详细系统健康状态',
        },
        {
          method: 'GET',
          path: '/ready',
          summary: '就绪检查',
          description: '检查系统是否就绪',
        },
        {
          method: 'GET',
          path: '/alive',
          summary: '存活检查',
          description: '检查服务是否存活',
        },
        {
          method: 'GET',
          path: '/metrics',
          summary: '获取指标',
          description: '获取系统指标数据',
        },
        {
          method: 'GET',
          path: '/circuit-breakers',
          summary: '获取熔断器状态',
          description: '获取熔断器状态信息',
        },
        {
          method: 'POST',
          path: '/circuit-breakers/:name/reset',
          summary: '重置熔断器',
          description: '重置指定熔断器',
        },
      ],
    },
    {
      name: '页面浏览模块',
      path: '/page-views',
      description: '页面浏览统计，无需认证',
      endpoints: [
        {
          method: 'GET',
          path: '/:pageKey',
          summary: '获取页面浏览量',
          description: '获取指定页面的浏览统计',
        },
        {
          method: 'POST',
          path: '/:pageKey',
          summary: '记录浏览',
          description: '记录页面浏览事件',
        },
      ],
    },
    {
      name: '增强审计日志模块',
      path: '/audit-logs-enhanced',
      description: '增强型审计日志，支持统计、导出、清理',
      endpoints: [
        {
          method: 'GET',
          path: '/enhanced',
          summary: '获取增强审计日志',
          description: '获取增强版审计日志列表',
        },
        {
          method: 'GET',
          path: '/statistics',
          summary: '获取审计统计',
          description: '获取审计日志统计信息',
        },
        {
          method: 'GET',
          path: '/export',
          summary: '导出审计日志',
          description: '导出审计日志到文件',
        },
        {
          method: 'POST',
          path: '/cleanup',
          summary: '清理审计日志',
          description: '清理过期的审计日志',
        },
        {
          method: 'GET',
          path: '/operations',
          summary: '获取操作类型',
          description: '获取所有操作类型统计',
        },
        {
          method: 'GET',
          path: '/resource-types',
          summary: '获取资源类型',
          description: '获取所有资源类型统计',
        },
      ],
    },
    {
      name: '增强技术文档模块',
      path: '/technical-documents-enhanced',
      description: '增强型技术文档管理，支持分类、标签、版本、收藏、评论',
      endpoints: [
        {
          method: 'GET',
          path: '/categories',
          summary: '获取文档分类',
          description: '获取所有文档分类',
        },
        {
          method: 'POST',
          path: '/categories',
          summary: '创建文档分类',
          description: '创建新的文档分类',
        },
        {
          method: 'PUT',
          path: '/categories/:id',
          summary: '更新文档分类',
          description: '更新文档分类信息',
        },
        {
          method: 'DELETE',
          path: '/categories/:id',
          summary: '删除文档分类',
          description: '删除指定的文档分类',
        },
        {
          method: 'GET',
          path: '/tags',
          summary: '获取文档标签',
          description: '获取所有文档标签',
        },
        {
          method: 'POST',
          path: '/tags',
          summary: '创建文档标签',
          description: '创建新的文档标签',
        },
        {
          method: 'DELETE',
          path: '/tags/:id',
          summary: '删除文档标签',
          description: '删除指定的文档标签',
        },
        {
          method: 'POST',
          path: '/documents/:id/tags',
          summary: '更新文档标签',
          description: '为文档添加或更新标签',
        },
        {
          method: 'GET',
          path: '/documents/:id/tags',
          summary: '获取文档标签',
          description: '获取文档的所有标签',
        },
        {
          method: 'GET',
          path: '/documents/:id/versions',
          summary: '获取文档版本',
          description: '获取文档的版本历史',
        },
        {
          method: 'POST',
          path: '/documents/:id/versions',
          summary: '创建文档版本',
          description: '创建文档新版本',
        },
        {
          method: 'POST',
          path: '/documents/:id/favorite',
          summary: '收藏文档',
          description: '收藏指定的技术文档',
        },
        {
          method: 'DELETE',
          path: '/documents/:id/favorite',
          summary: '取消收藏',
          description: '取消收藏指定文档',
        },
        {
          method: 'GET',
          path: '/my/favorites',
          summary: '获取我的收藏',
          description: '获取当前用户收藏的文档',
        },
        {
          method: 'GET',
          path: '/documents/:id/comments',
          summary: '获取文档评论',
          description: '获取文档的所有评论',
        },
        {
          method: 'POST',
          path: '/documents/:id/comments',
          summary: '添加文档评论',
          description: '为文档添加评论',
        },
        {
          method: 'PUT',
          path: '/comments/:id/resolve',
          summary: '标记评论已解决',
          description: '将评论标记为已解决',
        },
        {
          method: 'POST',
          path: '/documents/:id/view',
          summary: '记录文档浏览',
          description: '记录文档浏览历史',
        },
        {
          method: 'GET',
          path: '/my/history',
          summary: '获取浏览历史',
          description: '获取当前用户的浏览历史',
        },
        {
          method: 'GET',
          path: '/statistics',
          summary: '获取文档统计',
          description: '获取文档统计信息',
        },
        {
          method: 'GET',
          path: '/templates',
          summary: '获取文档模板',
          description: '获取所有文档模板',
        },
        {
          method: 'POST',
          path: '/templates',
          summary: '创建文档模板',
          description: '创建新的文档模板',
        },
        {
          method: 'DELETE',
          path: '/templates/:id',
          summary: '删除文档模板',
          description: '删除指定的文档模板',
        },
        {
          method: 'POST',
          path: '/batch/delete',
          summary: '批量删除文档',
          description: '批量删除技术文档',
        },
        {
          method: 'POST',
          path: '/batch/category',
          summary: '批量更新分类',
          description: '批量更新文档分类',
        },
      ],
    },
    {
      name: '数据分析模块',
      path: '/analysis',
      description: '资产数据分析，支持价值分布、折旧分析',
      endpoints: [
        {
          method: 'GET',
          path: '/',
          summary: '获取分析数据',
          description: '获取综合分析数据',
        },
        {
          method: 'GET',
          path: '/value-distribution',
          summary: '获取价值分布',
          description: '获取资产价值分布分析',
        },
        {
          method: 'GET',
          path: '/depreciation',
          summary: '获取折旧分析',
          description: '获取资产折旧分析报告',
        },
      ],
    },
    {
      name: '维修申请模块',
      path: '/maintenance/requests',
      description: '故障维修申请管理，支持审批、执行、完成',
      endpoints: [
        {
          method: 'GET',
          path: '/',
          summary: '获取维修申请列表',
          description: '获取所有故障维修申请',
        },
        {
          method: 'GET',
          path: '/:id',
          summary: '获取申请详情',
          description: '获取指定维修申请详情',
        },
        {
          method: 'POST',
          path: '/',
          summary: '创建维修申请',
          description: '提交新的故障维修申请',
        },
        {
          method: 'POST',
          path: '/:id/approve',
          summary: '审批维修申请',
          description: '审批故障维修申请',
        },
        {
          method: 'POST',
          path: '/:id/start',
          summary: '开始维修',
          description: '开始执行维修',
        },
        {
          method: 'POST',
          path: '/:id/complete',
          summary: '完成维修',
          description: '完成维修并提交结果',
        },
        {
          method: 'PUT',
          path: '/:id',
          summary: '更新维修申请',
          description: '更新维修申请信息',
        },
        {
          method: 'POST',
          path: '/:id/cancel',
          summary: '取消维修申请',
          description: '取消指定的维修申请',
        },
        {
          method: 'DELETE',
          path: '/:id',
          summary: '删除维修申请',
          description: '删除指定的维修申请',
        },
      ],
    },
    {
      name: '维修工单模块',
      path: '/maintenance/workorders',
      description: '维修工单执行管理，支持派工、执行、完工',
      endpoints: [
        {
          method: 'GET',
          path: '/',
          summary: '获取维修工单列表',
          description: '获取所有维修工单',
        },
        {
          method: 'GET',
          path: '/:id',
          summary: '获取工单详情',
          description: '获取指定维修工单详情',
        },
        {
          method: 'POST',
          path: '/',
          summary: '创建维修工单',
          description: '创建新的维修工单',
        },
        {
          method: 'PUT',
          path: '/:id',
          summary: '更新工单',
          description: '更新工单信息',
        },
        {
          method: 'POST',
          path: '/:id/materials',
          summary: '添加工单材料',
          description: '为工单添加材料清单',
        },
        {
          method: 'DELETE',
          path: '/:id',
          summary: '删除工单',
          description: '删除指定的维修工单',
        },
        {
          method: 'POST',
          path: '/:id/assign',
          summary: '分配工单',
          description: '分配工单给维修人员',
        },
        {
          method: 'POST',
          path: '/:id/start',
          summary: '开始工单',
          description: '开始执行工单',
        },
        {
          method: 'POST',
          path: '/:id/complete',
          summary: '完工工单',
          description: '完成工单执行',
        },
        {
          method: 'POST',
          path: '/:id/close',
          summary: '关闭工单',
          description: '关闭维修工单',
        },
        {
          method: 'POST',
          path: '/:id/cancel',
          summary: '取消工单',
          description: '取消指定的维修工单',
        },
      ],
    },
    {
      name: '维修费用模块',
      path: '/maintenance/costs',
      description: '维修费用统计和分析',
      endpoints: [
        {
          method: 'GET',
          path: '/',
          summary: '获取维修费用列表',
          description: '获取所有维修费用记录',
        },
        {
          method: 'GET',
          path: '/trend',
          summary: '获取费用趋势',
          description: '获取维修费用趋势分析',
        },
        {
          method: 'GET',
          path: '/department',
          summary: '按部门统计费用',
          description: '按部门汇总维修费用',
        },
        {
          method: 'GET',
          path: '/asset-type',
          summary: '按资产类型统计',
          description: '按资产类型汇总维修费用',
        },
        {
          method: 'GET',
          path: '/maintenance-type',
          summary: '按维修类型统计',
          description: '按维修类型汇总费用',
        },
        {
          method: 'GET',
          path: '/high-cost-assets',
          summary: '高费用资产',
          description: '获取维修费用最高的资产',
        },
        {
          method: 'POST',
          path: '/',
          summary: '创建费用记录',
          description: '创建维修费用记录',
        },
        {
          method: 'PUT',
          path: '/:id',
          summary: '更新费用记录',
          description: '更新维修费用记录',
        },
        {
          method: 'DELETE',
          path: '/:id',
          summary: '删除费用记录',
          description: '删除维修费用记录',
        },
        {
          method: 'GET',
          path: '/analysis',
          summary: '获取费用分析',
          description: '获取维修费用综合分析',
        },
      ],
    },
    {
      name: '预防性维护计划模块',
      path: '/maintenance/plans',
      description: '预防性维护计划管理，支持计划制定、执行、记录',
      endpoints: [
        {
          method: 'GET',
          path: '/',
          summary: '获取维护计划列表',
          description: '获取所有预防性维护计划',
        },
        {
          method: 'GET',
          path: '/:id',
          summary: '获取计划详情',
          description: '获取指定维护计划详情',
        },
        {
          method: 'POST',
          path: '/',
          summary: '创建维护计划',
          description: '创建新的预防性维护计划',
        },
        {
          method: 'PUT',
          path: '/:id',
          summary: '更新维护计划',
          description: '更新维护计划信息',
        },
        {
          method: 'POST',
          path: '/:id/complete',
          summary: '完成维护计划',
          description: '完成维护计划并记录结果',
        },
        {
          method: 'DELETE',
          path: '/:id',
          summary: '删除维护计划',
          description: '删除指定的维护计划',
        },
        {
          method: 'GET',
          path: '/:id/history',
          summary: '获取执行历史',
          description: '获取维护计划的执行历史',
        },
      ],
    },
    {
      name: '维修日志模块',
      path: '/maintenance/logs',
      description: '维修记录日志管理，支持附件上传',
      endpoints: [
        {
          method: 'GET',
          path: '/',
          summary: '获取维修日志列表',
          description: '获取所有维修日志',
        },
        {
          method: 'POST',
          path: '/',
          summary: '创建维修日志',
          description: '创建新的维修日志',
        },
        {
          method: 'PUT',
          path: '/:id',
          summary: '更新维修日志',
          description: '更新维修日志信息',
        },
        {
          method: 'DELETE',
          path: '/:id',
          summary: '删除维修日志',
          description: '删除指定的维修日志',
        },
        {
          method: 'GET',
          path: '/:id/attachments',
          summary: '获取附件列表',
          description: '获取日志的所有附件',
        },
        {
          method: 'POST',
          path: '/:id/attachments',
          summary: '上传附件',
          description: '为维修日志上传附件',
        },
        {
          method: 'GET',
          path: '/:logId/attachments/:attachmentId',
          summary: '获取附件',
          description: '下载指定附件',
        },
        {
          method: 'GET',
          path: '/:logId/attachments/:attachmentId/download',
          summary: '下载附件',
          description: '下载指定附件',
        },
        {
          method: 'DELETE',
          path: '/:logId/attachments/:attachmentId',
          summary: '删除附件',
          description: '删除指定的附件',
        },
        {
          method: 'GET',
          path: '/:id',
          summary: '获取日志详情',
          description: '获取指定维修日志详情',
        },
        {
          method: 'GET',
          path: '/statistics',
          summary: '获取维修统计',
          description: '获取维修统计信息',
        },
      ],
    },
    {
      name: '维修模板模块',
      path: '/maintenance/templates',
      description: '维修模板管理，支持模板创建、推荐',
      endpoints: [
        {
          method: 'GET',
          path: '/',
          summary: '获取维修模板列表',
          description: '获取所有维修模板',
        },
        {
          method: 'POST',
          path: '/',
          summary: '创建维修模板',
          description: '创建新的维修模板',
        },
        {
          method: 'PUT',
          path: '/:id',
          summary: '更新维修模板',
          description: '更新维修模板信息',
        },
        {
          method: 'DELETE',
          path: '/:id',
          summary: '删除维修模板',
          description: '删除指定的维修模板',
        },
        {
          method: 'GET',
          path: '/recommend',
          summary: '获取推荐模板',
          description: '获取推荐的维修模板',
        },
        {
          method: 'GET',
          path: '/recommend-by-asset',
          summary: '按资产推荐模板',
          description: '根据资产推荐合适的维修模板',
        },
      ],
    },
    {
      name: '资产使用量模块',
      path: '/maintenance/usage',
      description: '资产使用量追踪和触发维护',
      endpoints: [
        {
          method: 'POST',
          path: '/update',
          summary: '更新使用量',
          description: '更新资产使用量记录',
        },
        {
          method: 'GET',
          path: '/history',
          summary: '获取使用历史',
          description: '获取资产使用量历史',
        },
        {
          method: 'GET',
          path: '/statistics',
          summary: '获取使用统计',
          description: '获取使用量统计信息',
        },
        {
          method: 'GET',
          path: '/check-thresholds',
          summary: '检查阈值',
          description: '检查是否达到维护阈值',
        },
        {
          method: 'GET',
          path: '/usage-records',
          summary: '获取使用记录',
          description: '获取资产使用记录',
        },
        {
          method: 'POST',
          path: '/usage-records',
          summary: '创建使用记录',
          description: '创建新的使用记录',
        },
        {
          method: 'GET',
          path: '/usage-triggered',
          summary: '获取触发记录',
          description: '获取使用量触发的维护记录',
        },
        {
          method: 'POST',
          path: '/usage-triggered/:id/process',
          summary: '处理触发记录',
          description: '处理使用量触发的维护',
        },
        {
          method: 'POST',
          path: '/usage-triggered/check',
          summary: '检查触发',
          description: '检查是否有触发的维护',
        },
      ],
    },
    {
      name: '维修效率分析模块',
      path: '/maintenance/analytics',
      description: '维修效率统计分析',
      endpoints: [
        {
          method: 'GET',
          path: '/efficiency/overview',
          summary: '获取效率概览',
          description: '获取维修效率概览',
        },
        {
          method: 'GET',
          path: '/efficiency/response-time',
          summary: '获取响应时间',
          description: '获取维修响应时间统计',
        },
        {
          method: 'GET',
          path: '/efficiency/technician',
          summary: '获取技术人员统计',
          description: '获取技术人员维修统计',
        },
        {
          method: 'GET',
          path: '/efficiency/asset-frequency',
          summary: '获取资产频率',
          description: '获取资产维修频率统计',
        },
        {
          method: 'GET',
          path: '/analysis/asset-history',
          summary: '获取资产历史分析',
          description: '获取资产维修历史分析',
        },
        {
          method: 'GET',
          path: '/analysis/effectiveness-stats',
          summary: '获取效能统计',
          description: '获取维修效能统计',
        },
        {
          method: 'GET',
          path: '/analysis/cost-trend',
          summary: '获取费用趋势',
          description: '获取维修费用趋势',
        },
        {
          method: 'GET',
          path: '/analysis/technician-performance',
          summary: '获取人员绩效',
          description: '获取维修人员绩效',
        },
        {
          method: 'GET',
          path: '/analysis/type-distribution',
          summary: '获取类型分布',
          description: '获取维修类型分布',
        },
        {
          method: 'GET',
          path: '/analysis/frequency',
          summary: '获取维修频率',
          description: '获取维修频率分析',
        },
        {
          method: 'GET',
          path: '/asset-types/secondary',
          summary: '获取二级资产类型',
          description: '获取资产二级类型列表',
        },
      ],
    },
    {
      name: '维修评估模块',
      path: '/maintenance/evaluations',
      description: '维修质量评估管理',
      endpoints: [
        {
          method: 'GET',
          path: '/',
          summary: '获取维修评估列表',
          description: '获取所有维修评估记录',
        },
        {
          method: 'POST',
          path: '/',
          summary: '创建维修评估',
          description: '创建新的维修评估',
        },
        {
          method: 'PUT',
          path: '/:id',
          summary: '更新维修评估',
          description: '更新维修评估信息',
        },
      ],
    },
    {
      name: '维护提醒模块',
      path: '/maintenance/reminders',
      description: '维护提醒配置和管理',
      endpoints: [
        {
          method: 'GET',
          path: '/',
          summary: '获取维护提醒列表',
          description: '获取所有维护提醒',
        },
        {
          method: 'POST',
          path: '/send',
          summary: '发送提醒',
          description: '发送维护提醒',
        },
        {
          method: 'POST',
          path: '/config',
          summary: '配置提醒',
          description: '配置维护提醒规则',
        },
        {
          method: 'GET',
          path: '/check',
          summary: '检查提醒',
          description: '检查即将到期的维护',
        },
      ],
    },
  ],

  errorCodes: {
    1001: { message: '需要认证令牌', description: '未提供有效的认证令牌' },
    1002: { message: '服务暂时不可用', description: '数据库连接失败' },
    1003: { message: '用户不存在或已禁用', description: '用户认证失败' },
    1004: { message: '无效的租户ID格式', description: '租户ID格式不正确' },
    1005: { message: '普通用户不能切换租户', description: '普通用户无法切换租户' },
    2001: { message: '缺少租户信息', description: '无法访问资产数据' },
    2002: { message: '无效的租户ID', description: '租户ID不合法' },
  },

  commonParameters: {
    tenantId: { name: 'X-Tenant-ID', type: 'header', description: '租户ID（超级管理员可切换租户）' },
    authorization: { name: 'Authorization', type: 'header', description: 'Bearer认证令牌' },
  },

  responseFormats: {
    success: {
      success: true,
      message: '操作成功',
      data: { /* 具体数据 */ },
    },
    error: {
      success: false,
      message: '错误信息',
      error: '错误代码',
      code: 1001,
    },
    pagination: {
      page: 1,
      pageSize: 20,
      total: 100,
      totalPages: 5,
    },
  },
};

router.get('/', (req, res) => {
  res.json({
    success: true,
    data: apiDocumentation,
  });
});

router.get('/modules', (req, res) => {
  const modules = apiDocumentation.modules.map(module => ({
    name: module.name,
    path: module.path,
    description: module.description,
    endpointCount: module.endpoints.length,
  }));
  res.json({
    success: true,
    data: modules,
  });
});

router.get('/module/:path', (req, res) => {
  const { path } = req.params;
  const modulePath = `/${  path}`;
  const module = apiDocumentation.modules.find(m => m.path === modulePath);

  if (!module) {
    return res.status(404).json({
      success: false,
      message: '模块不存在',
    });
  }

  res.json({
    success: true,
    data: module,
  });
});

router.get('/endpoints', (req, res) => {
  const endpoints = [];
  apiDocumentation.modules.forEach(module => {
    module.endpoints.forEach(endpoint => {
      endpoints.push({
        method: endpoint.method,
        path: module.path + endpoint.path,
        summary: endpoint.summary,
        description: endpoint.description,
        module: module.name,
      });
    });
  });
  res.json({
    success: true,
    data: endpoints,
  });
});

module.exports = router;
