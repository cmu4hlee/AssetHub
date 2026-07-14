/**
 * @swagger
 * /health:
 *   get:
 *     summary: 服务健康检查
 *     description: 检查后端服务运行状态与时间戳信息。
 *     tags: [系统管理]
 *     security: []
 *     responses:
 *       200:
 *         description: 服务可用
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccess'
 *
 * /roles-permissions/user/menus:
 *   get:
 *     summary: 获取当前用户菜单权限
 *     description: 返回当前登录用户可见菜单的 key 列表，用于前端动态菜单渲染。
 *     tags: [系统管理]
 *     responses:
 *       200:
 *         description: 成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccess'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ['/dashboard', '/assets', '/modules']
 *
 * /modules:
 *   get:
 *     summary: 获取模块清单
 *     description: 获取系统模块列表（仅超级管理员/系统管理员）。
 *     tags: [模块管理]
 *     responses:
 *       200:
 *         description: 成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccess'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: module-management
 *                           name:
 *                             type: string
 *                             example: 核心模块
 *                           version:
 *                             type: string
 *                             example: 1.0.0
 *
 * /modules/{moduleId}/dependencies:
 *   get:
 *     summary: 获取模块依赖
 *     description: 获取指定模块的依赖关系，可用于启停前依赖校验。
 *     tags: [模块管理]
 *     parameters:
 *       - in: path
 *         name: moduleId
 *         required: true
 *         schema:
 *           type: string
 *         example: iot-environment-monitoring-management
 *     responses:
 *       200:
 *         description: 成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccess'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/ModuleDependency'
 *       404:
 *         description: 模块不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *
 * /module-configs/list:
 *   get:
 *     summary: 获取租户模块配置列表
 *     description: 返回当前租户的模块状态、配置、分类、菜单域等信息。
 *     tags: [模块管理]
 *     parameters:
 *       - in: query
 *         name: tenant_id
 *         required: false
 *         schema:
 *           type: integer
 *         description: 超级管理员可指定租户ID
 *       - in: query
 *         name: category
 *         required: false
 *         schema:
 *           type: string
 *         description: 按分类过滤（如 资产生命周期 / 分析与智能）
 *     responses:
 *       200:
 *         description: 成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccess'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/ModuleConfigListItem'
 *       500:
 *         description: 查询失败
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *
 * /module-configs/enable:
 *   post:
 *     summary: 启用模块
 *     description: 为租户启用指定模块，并自动校验 required 依赖。
 *     tags: [模块管理]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [module_id]
 *             properties:
 *               module_id:
 *                 type: string
 *                 example: iot-environment-monitoring-management
 *               tenant_id:
 *                 type: integer
 *                 example: 2
 *               config:
 *                 type: object
 *                 additionalProperties: true
 *     responses:
 *       200:
 *         description: 启用成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccess'
 *       400:
 *         description: 参数错误或依赖未满足
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *
 * /module-configs/disable:
 *   post:
 *     summary: 停用模块
 *     description: 为租户停用模块，并校验是否被其他已启用模块依赖。
 *     tags: [模块管理]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [module_id]
 *             properties:
 *               module_id:
 *                 type: string
 *                 example: iot-environment-monitoring-management
 *               tenant_id:
 *                 type: integer
 *                 example: 2
 *     responses:
 *       200:
 *         description: 停用成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccess'
 *       400:
 *         description: 被依赖，无法停用
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *
 * /module-configs/{moduleId}:
 *   get:
 *     summary: 获取单模块租户配置
 *     tags: [模块管理]
 *     parameters:
 *       - in: path
 *         name: moduleId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: tenant_id
 *         required: false
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccess'
 *   put:
 *     summary: 更新单模块租户配置
 *     tags: [模块管理]
 *     parameters:
 *       - in: path
 *         name: moduleId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tenant_id:
 *                 type: integer
 *               enabled:
 *                 type: boolean
 *               config:
 *                 type: object
 *                 additionalProperties: true
 *     responses:
 *       200:
 *         description: 更新成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccess'
 *
 * /module-configs/{moduleId}/menus:
 *   get:
 *     summary: 获取模块菜单启用状态
 *     tags: [模块管理]
 *     parameters:
 *       - in: path
 *         name: moduleId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: tenant_id
 *         required: false
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccess'
 *   put:
 *     summary: 批量更新模块菜单启用状态
 *     tags: [模块管理]
 *     parameters:
 *       - in: path
 *         name: moduleId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [menus]
 *             properties:
 *               tenant_id:
 *                 type: integer
 *               menus:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     menu_key:
 *                       type: string
 *                       example: /modules
 *                     is_enabled:
 *                       type: boolean
 *                       example: true
 *     responses:
 *       200:
 *         description: 更新成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccess'
 *
 * /api/agent-mesh/topology:
 *   get:
 *     summary: 获取 Agent Mesh 拓扑结构
 *     description: 获取多智能体系统拓扑结构，包括所有可用的代理节点
 *     tags: [Agent Mesh]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     agents:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: coordinator
 *                           name:
 *                             type: string
 *                             example: 协调代理
 *                           description:
 *                             type: string
 *                             example: 负责意图路由、多代理协同编排与统一结论生成
 *                           capabilities:
 *                             type: array
 *                             items:
 *                               type: string
 *                               example: 意图识别
 *
 * /api/agent-mesh/init:
 *   post:
 *     summary: 初始化对话会话
 *     description: 创建新的 Agent Mesh 对话会话
 *     tags: [Agent Mesh]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     conversationId:
 *                       type: string
 *                       example: conv_abc123
 *
 * /api/agent-mesh/message:
 *   post:
 *     summary: 发送消息
 *     description: 在对话中发送消息，由协调代理触发多代理协同处理
 *     tags: [Agent Mesh]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [conversationId, message]
 *             properties:
 *               conversationId:
 *                 type: string
 *                 example: conv_abc123
 *               message:
 *                 type: string
 *                 example: 检查资产统计
 *     responses:
 *       200:
 *         description: 成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     response:
 *                       type: string
 *                     involvedAgents:
 *                       type: array
 *                       items:
 *                         type: string
 *
 * /api/agent-mesh/intelligence/predictive-maintenance:
 *   post:
 *     summary: 预测性维护分析
 *     description: 基于 IoT 时序数据和维修历史进行预测性维护分析
 *     tags: [Agent Mesh, 智能分析]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               assetCode:
 *                 type: string
 *                 example: ASSET001
 *               timeRange:
 *                 type: string
 *                 example: 30
 *     responses:
 *       200:
 *         description: 成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     failureProbability:
 *                       type: number
 *                       example: 0.25
 *                     predictedRUL:
 *                       type: number
 *                       example: 45
 *
 * /api/agent-mesh/intelligence/risk-score:
 *   post:
 *     summary: 风险评分计算
 *     description: 计算资产综合风险评分
 *     tags: [Agent Mesh, 智能分析]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       assetCode:
 *                         type: string
 *                       riskScore:
 *                         type: number
 *                       riskLevel:
 *                         type: string
 *                         example: 中风险
 *
 * /api/agent-mesh/intelligence/health-index:
 *   post:
 *     summary: 健康指数计算
 *     description: 计算资产健康指数
 *     tags: [Agent Mesh, 智能分析]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     overallHealthIndex:
 *                       type: number
 *                       example: 85
 *
 * /api/agent-mesh/microservice/roadmap:
 *   get:
 *     summary: 获取微服务拆分路线图
 *     description: 查看微服务化改造路线
 *     tags: [Agent Mesh, 系统架构]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *
 * /api/agent-mesh/microservice/events:
 *   get:
 *     summary: 获取事件契约清单
 *     description: 获取微服务事件契约
 *     tags: [Agent Mesh, 系统架构]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 */
