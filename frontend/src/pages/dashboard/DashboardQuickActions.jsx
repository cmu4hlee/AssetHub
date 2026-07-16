/**
 * Dashboard - 快捷入口组件
 *
 * 设计要点:
 * 1. 按业务场景分组（资产主数据 / 维护管理 / 审批流程 / 资料文档 / AI 与报表）
 * 2. 通过 roles 做权限过滤，避免普通用户看到无权访问的入口
 * 3. 支持本地搜索（按 label/desc/path）
 * 4. 记录最近使用（localStorage）并置顶展示
 * 5. 提供"全部"与"我的常用"两种视图
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Card, Input, Empty, Tooltip, Modal, Button, Checkbox } from 'antd';
import {
  SearchOutlined,
  StarOutlined,
  StarFilled,
  AppstoreOutlined,
  ClockCircleOutlined,
  SettingOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import auth from '../../utils/auth';

const STORAGE_KEY = 'dashboard:quick-actions:custom';
const RECENT_KEY = 'dashboard:quick-actions:recent';

// 首次进入默认显示的精选集合(按 weight 顺序展示,最多 8 个)
const DEFAULT_CUSTOM_KEYS = [
  'add-asset',
  'asset-list',
  'inventory',
  'maintenance-requests',
  'maintenance-workorders',
  'acceptance',
  'ai-assistant',
  'report-print',
];

// 完整快捷入口定义（按业务分组）
// group 用于在面板里分区展示；weight 影响在分组内的展示顺序
const QUICK_ACTIONS = [
  // —— 资产主数据 ——
  {
    key: 'add-asset',
    label: '新增资产',
    desc: '录入新资产信息',
    path: '/assets/add',
    icon: '➕',
    color: '#1677ff',
    group: 'asset',
    weight: 1,
  },
  {
    key: 'asset-list',
    label: '资产列表',
    desc: '查看与管理所有资产',
    path: '/assets',
    icon: '📦',
    color: '#2f54eb',
    group: 'asset',
    weight: 2,
  },
  {
    key: 'asset-label-print',
    label: '资产标签打印',
    desc: '生成并打印资产标签',
    path: '/asset-labels/print',
    icon: '🏷️',
    color: '#722ed1',
    group: 'asset',
    weight: 3,
  },
  {
    key: 'asset-location',
    label: '资产定位',
    desc: '在地图上查看资产分布',
    path: '/asset-location',
    icon: '📍',
    color: '#eb2f96',
    group: 'asset',
    weight: 4,
  },
  {
    key: 'idle',
    label: '闲置资产',
    desc: '管理闲置资产',
    path: '/idle',
    icon: '🎁',
    color: '#fa8c16',
    group: 'asset',
    weight: 5,
  },
  {
    key: 'scrapping',
    label: '报废管理',
    desc: '资产报废处理流程',
    path: '/scrapping',
    icon: '🗑️',
    color: '#f5222d',
    group: 'asset',
    weight: 6,
  },

  // —— 盘点 / 调配 ——
  {
    key: 'inventory',
    label: '资产盘点',
    desc: '创建或参与盘点任务',
    path: '/inventory',
    icon: '📋',
    color: '#52c41a',
    group: 'operation',
    weight: 1,
  },
  {
    key: 'inventory-self',
    label: '我的资产盘点',
    desc: '个人盘点任务',
    path: '/inventory/self',
    icon: '✅',
    color: '#13c2c2',
    group: 'operation',
    weight: 2,
  },
  {
    key: 'transfer',
    label: '资产调配',
    desc: '发起资产调拨申请',
    path: '/transfer',
    icon: '🚚',
    color: '#9254de',
    group: 'operation',
    weight: 3,
  },
  {
    key: 'transfer-new',
    label: '新建调配',
    desc: '提交资产调拨申请单',
    path: '/transfer/new',
    icon: '📝',
    color: '#1890ff',
    group: 'operation',
    weight: 4,
  },

  // —— 维护管理 ——
  {
    key: 'maintenance-workorders',
    label: '维修工单',
    desc: '查看与处理设备维修工单',
    path: '/maintenance/workorder-management',
    icon: '🔧',
    color: '#faad14',
    group: 'maintenance',
    weight: 1,
  },
  {
    key: 'maintenance-requests',
    label: '维修申请',
    desc: '发起或处理维修申请',
    path: '/maintenance/requests',
    icon: '🛠️',
    color: '#d4380d',
    group: 'maintenance',
    weight: 2,
  },
  {
    key: 'maintenance-plans',
    label: '预防性维护',
    desc: '维护计划与执行',
    path: '/maintenance/plans',
    icon: '📆',
    color: '#a0d911',
    group: 'maintenance',
    weight: 3,
  },
  {
    key: 'workorder-create',
    label: '新建工单',
    desc: '新建维修工单',
    path: '/maintenance/workorder-management',
    icon: '🎫',
    color: '#08979c',
    group: 'maintenance',
    weight: 4,
  },

  // —— 质量 / 验收 / 检验 ——
  {
    key: 'acceptance',
    label: '资产验收',
    desc: '设备验收申请管理',
    path: '/acceptance',
    icon: '✅',
    color: '#2f54eb',
    group: 'quality',
    weight: 1,
  },
  {
    key: 'acceptance-create',
    label: '新建验收',
    desc: '创建验收记录',
    path: '/acceptance/create',
    icon: '📥',
    color: '#096dd9',
    group: 'quality',
    weight: 2,
  },
  {
    key: 'quality-metrology',
    label: '计量管理',
    desc: '计量器具管理',
    path: '/quality-control/metrology',
    icon: '⚖️',
    color: '#5b8c00',
    group: 'quality',
    weight: 3,
  },
  {
    key: 'adverse-reaction',
    label: '不良事件',
    desc: '上报与跟踪不良事件',
    path: '/adverse-reaction',
    icon: '⚠️',
    color: '#cf1322',
    group: 'quality',
    weight: 4,
  },
  {
    key: 'inspection',
    label: '巡检任务',
    desc: '日常巡检管理',
    path: '/inspection',
    icon: '🔍',
    color: '#597ef7',
    group: 'quality',
    weight: 5,
  },

  // —— 资料与文档 ——
  {
    key: 'documents',
    label: '技术资料',
    desc: '资料清单与检索',
    path: '/technical-documents',
    icon: '📚',
    color: '#1d39c4',
    group: 'docs',
    weight: 1,
  },
  {
    key: 'documents-upload',
    label: '上传资料',
    desc: '资料上传与归档',
    path: '/technical-documents/upload',
    icon: '⬆️',
    color: '#1d39c4',
    group: 'docs',
    weight: 2,
  },
  {
    key: 'tendering-suppliers',
    label: '供应商管理',
    desc: '维护供应商档案',
    path: '/tendering/suppliers',
    icon: '🏪',
    color: '#7cb305',
    group: 'docs',
    weight: 3,
  },
  {
    key: 'tendering-contracts',
    label: '合同管理',
    desc: '采购合同总览',
    path: '/tendering/contracts',
    icon: '📑',
    color: '#c41d7f',
    group: 'docs',
    weight: 4,
  },
  {
    key: 'tendering-projects',
    label: '招标项目',
    desc: '招标项目跟进',
    path: '/tendering/projects',
    icon: '📊',
    color: '#531dab',
    group: 'docs',
    weight: 5,
  },

  // —— AI 与报表 ——
  {
    key: 'ai-assistant',
    label: 'AI 助手',
    desc: '智能问答与数据分析',
    path: '/ai-assistant',
    icon: '🤖',
    color: '#13c2c2',
    group: 'ai',
    weight: 1,
  },
  {
    key: 'ai-maintenance',
    label: 'AI 维护',
    desc: 'AI 维护决策',
    path: '/ai-maintenance',
    icon: '🧠',
    color: '#9254de',
    group: 'ai',
    weight: 2,
  },
  {
    key: 'report-print',
    label: '统计报表',
    desc: '资产统计与打印',
    path: '/report-print',
    icon: '🖨️',
    color: '#fa8c16',
    group: 'ai',
    weight: 3,
  },
  {
    key: 'tendering-dashboard',
    label: '招标概览',
    desc: '招标采购数据概览',
    path: '/tendering/dashboard',
    icon: '📈',
    color: '#2f54eb',
    group: 'ai',
    weight: 4,
  },
];

const GROUP_LABELS = {
  asset: '资产主数据',
  operation: '盘点与调配',
  maintenance: '维修维护',
  quality: '质量与检验',
  docs: '资料与采购',
  ai: 'AI 与报表',
};

const loadJSON = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const saveJSON = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* swallow quota errors */
  }
};

const DashboardQuickActions = ({ onNavigate }) => {
  const [keyword, setKeyword] = useState('');
  const [customItems, setCustomItems] = useState(
    () => new Set(loadJSON(STORAGE_KEY, DEFAULT_CUSTOM_KEYS)),
  );
  const [recent, setRecent] = useState(() => loadJSON(RECENT_KEY, {}));
  const [manageOpen, setManageOpen] = useState(false);
  const [manageKeyword, setManageKeyword] = useState('');

  const userRole = useMemo(() => {
    try {
      const user = auth.getUser();
      return user?.role || '';
    } catch {
      return '';
    }
  }, []);

  // 角色权限过滤
  const isAllowed = useCallback(
    (a) => !a.roles || (a.roles.length > 0 && a.roles.indexOf(userRole) !== -1),
    [userRole],
  );

  // 实际展示的卡片:用户勾选的 + 搜索过滤
  const visibleActions = useMemo(() => {
    const query = (keyword || '').trim().toLowerCase();
    return QUICK_ACTIONS.filter(a => customItems.has(a.key) && isAllowed(a))
      .filter(a => {
        if (!query) return true;
        return (
          a.label.toLowerCase().indexOf(query) !== -1 ||
          a.desc.toLowerCase().indexOf(query) !== -1 ||
          a.path.toLowerCase().indexOf(query) !== -1
        );
      })
      .sort((a, b) => a.weight - b.weight);
  }, [customItems, keyword, isAllowed]);

  // 管理 Modal 中:所有可用的 actions(按角色过滤)
  const allAvailable = useMemo(
    () => QUICK_ACTIONS.filter(isAllowed),
    [isAllowed],
  );

  // 管理 Modal 中:按 group 分组 + 搜索过滤
  const manageGrouped = useMemo(() => {
    const query = (manageKeyword || '').trim().toLowerCase();
    const out = new Map();
    allAvailable.forEach(a => {
      if (query) {
        const hit =
          a.label.toLowerCase().indexOf(query) !== -1 ||
          a.desc.toLowerCase().indexOf(query) !== -1 ||
          a.path.toLowerCase().indexOf(query) !== -1;
        if (!hit) return;
      }
      if (!out.has(a.group)) out.set(a.group, []);
      out.get(a.group).push(a);
    });
    // 维持固定顺序
    const order = ['asset', 'operation', 'maintenance', 'quality', 'docs', 'ai'];
    return order
      .filter(k => out.has(k))
      .map(k => [k, out.get(k).sort((a, b) => a.weight - b.weight)]);
  }, [allAvailable, manageKeyword]);

  const handleClick = useCallback(
    (action) => {
      const nextRecent = { ...recent, [action.key]: Date.now() };
      setRecent(nextRecent);
      saveJSON(RECENT_KEY, nextRecent);
      onNavigate?.(action.path);
    },
    [recent, onNavigate],
  );

  const toggleCustom = useCallback(
    (key) => {
      const next = new Set(customItems);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      setCustomItems(next);
      saveJSON(STORAGE_KEY, Array.from(next));
    },
    [customItems],
  );

  const resetToDefault = useCallback(() => {
    setCustomItems(new Set(DEFAULT_CUSTOM_KEYS));
    saveJSON(STORAGE_KEY, DEFAULT_CUSTOM_KEYS);
  }, []);

  const renderCard = (action) => {
    const isRecent =
      recent[action.key] && Date.now() - recent[action.key] < 1000 * 60 * 60 * 24;
    return (
      <div
        key={action.key}
        className="quick-action-card"
        onClick={() => handleClick(action)}
        role="button"
        tabIndex={0}
      >
        <div
          className="quick-action-icon"
          style={{
            color: action.color,
            background: `${action.color}1a`,
            border: `1px solid ${action.color}33`,
          }}
        >
          {action.icon}
        </div>
        <div className="quick-action-content">
          <div className="quick-action-label">{action.label}</div>
          <div className="quick-action-desc">{action.desc}</div>
        </div>
        {isRecent && (
          <Tooltip title="最近使用">
            <span
              className="quick-action-recent-dot"
              style={{ background: '#52c41a' }}
              aria-label="最近使用"
            />
          </Tooltip>
        )}
      </div>
    );
  };

  const renderManageItem = (action) => (
    <div
      key={action.key}
      className={`quick-manage-item${customItems.has(action.key) ? ' checked' : ''}`}
      onClick={() => toggleCustom(action.key)}
      role="button"
      tabIndex={0}
    >
      <Checkbox checked={customItems.has(action.key)} onClick={e => e.stopPropagation()} />
      <span
        className="quick-manage-icon"
        style={{
          color: action.color,
          background: `${action.color}1a`,
          border: `1px solid ${action.color}33`,
        }}
      >
        {action.icon}
      </span>
      <div className="quick-manage-content">
        <div className="quick-manage-label">{action.label}</div>
        <div className="quick-manage-desc">{action.desc}</div>
      </div>
    </div>
  );

  return (
    <Card className="quick-actions-panel">
      <div className="chart-panel-header">
        <span className="chart-panel-icon">⚡</span>
        <h3 className="chart-panel-title">快捷入口</h3>
        <span className="chart-panel-total">已选 {visibleActions.length} 项 · 点击管理自定义</span>
        <div className="quick-actions-toolbar">
          <Input
            className="quick-actions-search"
            size="small"
            prefix={<SearchOutlined />}
            placeholder="搜索已选"
            allowClear
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            style={{ width: 140 }}
          />
          <Button
            size="small"
            type="primary"
            icon={<SettingOutlined />}
            onClick={() => setManageOpen(true)}
          >
            管理
          </Button>
        </div>
      </div>

      {visibleActions.length === 0 ? (
        <Empty
          description="还没有快捷入口，点击右上角“管理”添加"
          style={{ padding: '32px 0' }}
        >
          <Button type="primary" icon={<SettingOutlined />} onClick={() => setManageOpen(true)}>
            去添加
          </Button>
        </Empty>
      ) : (
        <div className="quick-actions-grid">{visibleActions.map(renderCard)}</div>
      )}

      <Modal
        title={
          <span>
            <SettingOutlined style={{ marginRight: 8 }} />
            自定义快捷入口
          </span>
        }
        open={manageOpen}
        onCancel={() => setManageOpen(false)}
        footer={[
          <Button
            key="reset"
            icon={<ReloadOutlined />}
            onClick={resetToDefault}
          >
            重置默认
          </Button>,
          <Button key="close" type="primary" onClick={() => setManageOpen(false)}>
            完成 ({customItems.size})
          </Button>,
        ]}
        width={680}
        destroyOnHidden
        mask={{ closable: false }}
      >
        <Input
          size="middle"
          prefix={<SearchOutlined />}
          placeholder="搜索功能/描述/路径"
          allowClear
          value={manageKeyword}
          onChange={e => setManageKeyword(e.target.value)}
          style={{ marginBottom: 16 }}
        />
        {manageGrouped.length === 0 ? (
          <Empty description="没有匹配的功能" />
        ) : (
          manageGrouped.map(([groupKey, items]) => (
            <div key={groupKey} className="quick-manage-group">
              <div className="quick-manage-group-header">
                {GROUP_LABELS[groupKey] || groupKey}
                <span className="quick-manage-group-count">
                  {items.filter(a => customItems.has(a.key)).length}/{items.length}
                </span>
              </div>
              <div className="quick-manage-list">{items.map(renderManageItem)}</div>
            </div>
          ))
        )}
      </Modal>
    </Card>
  );
};

export default DashboardQuickActions;
