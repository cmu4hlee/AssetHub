const getRoadmap = () => ({
  name: 'AssetHub 渐进式微服务拆分路线',
  version: '0.1.0',
  generated_at: new Date().toISOString(),
  principles: [
    '先边界后迁移：先抽象契约再拆运行时',
    '先写后读：先事件化写入，再逐步读侧解耦',
    '单服务可回滚：每一步均可独立回退',
  ],
  phases: [
    {
      phase: 1,
      title: '认证与权限服务化（Auth/Permission）',
      goals: [
        '统一登录、令牌签发、菜单权限校验',
        '为资产与维保核心服务提供统一鉴权中台',
      ],
      deliverables: [
        'Auth API 网关适配层',
        '权限缓存与租户策略中心',
        '用户/角色/菜单事件发布',
      ],
      exit_criteria: [
        '原单体鉴权调用完全透传到新服务',
        '权限变更事件可被资产/维保域消费',
      ],
    },
    {
      phase: 2,
      title: '资产核心服务化（Asset Core）',
      goals: [
        '沉淀资产台账、状态流转、折旧核心逻辑',
        '对外发布资产主数据变更事件',
      ],
      deliverables: [
        '资产主数据 API',
        '折旧计算与对账 API',
        '资产状态事件（创建/调拨/报废）',
      ],
      exit_criteria: [
        '资产写入流量 80% 以上走 Asset Core',
        '下游服务依赖事件而非跨库查询',
      ],
    },
    {
      phase: 3,
      title: '维保核心服务化（Maintenance Core）',
      goals: [
        '独立报修、工单、维保成本闭环',
        '形成对风险与健康评分的高质量事件输入',
      ],
      deliverables: [
        '维修申请/工单/日志 API',
        '维保成本结算 API',
        '维保事件（工单状态、成本入账）',
      ],
      exit_criteria: [
        '预测维护与风险评分仅依赖事件总线即可刷新核心指标',
        '单体内维保逻辑进入只读兼容态',
      ],
    },
  ],
});

const getEventContracts = () => ({
  version: '0.1.0',
  topics: [
    {
      topic: 'auth.permission.changed',
      producer: 'auth-permission-service',
      consumers: ['asset-core-service', 'maintenance-core-service', 'gateway'],
      payload: ['tenant_id', 'user_id', 'roles', 'permission_version', 'occurred_at'],
    },
    {
      topic: 'asset.updated',
      producer: 'asset-core-service',
      consumers: ['maintenance-core-service', 'risk-engine', 'health-index'],
      payload: ['tenant_id', 'asset_code', 'status', 'department', 'updated_fields', 'occurred_at'],
    },
    {
      topic: 'maintenance.workorder.completed',
      producer: 'maintenance-core-service',
      consumers: ['risk-engine', 'health-index', 'finance'],
      payload: ['tenant_id', 'workorder_id', 'asset_code', 'maintenance_cost', 'occurred_at'],
    },
    {
      topic: 'risk.score.updated',
      producer: 'risk-engine',
      consumers: ['health-index', 'management-dashboard'],
      payload: ['tenant_id', 'asset_code', 'risk_score', 'alert_level', 'occurred_at'],
    },
    {
      topic: 'health.index.updated',
      producer: 'health-index',
      consumers: ['management-dashboard', 'strategy-center'],
      payload: ['tenant_id', 'asset_code', 'health_index', 'health_grade', 'occurred_at'],
    },
  ],
  outbox_strategy: {
    write_pattern: '事务内写业务表 + outbox表',
    delivery_pattern: '后台轮询 outbox -> 发布事件 -> 标记 delivered',
    idempotency_key: 'tenant_id + topic + business_id + event_version',
  },
});

module.exports = {
  getRoadmap,
  getEventContracts,
};
