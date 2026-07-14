import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const DESKTOP_MODULES = [
  { key: 'dashboard', label: '仪表盘', path: '/dashboard', icon: '📊' },
  { key: 'ai-assistant', label: 'AI助手', path: '/ai-assistant', icon: '🤖' },
  { key: 'assets', label: '资产主数据', path: '/assets', icon: '🏢' },
  { key: 'depreciation', label: '折旧管理', path: '/depreciation', icon: '💰' },
  { key: 'inventory', label: '盘点管理', path: '/inventory', icon: '📋' },
  { key: 'transfer', label: '资产调配', path: '/transfer', icon: '🔄' },
  { key: 'idle', label: '闲置资产', path: '/idle', icon: '📦' },
  { key: 'maintenance', label: '维修维护', path: '/maintenance/workorders', icon: '🔧' },
  { key: 'asset-monitoring', label: '资产定位与IoT', path: '/asset-location', icon: '📍' },
  { key: 'quality', label: '质量管理', path: '/quality-control/metrology', icon: '🔬' },
  { key: 'technical-documents', label: '技术资料', path: '/technical-documents', icon: '📄' },
  { key: 'acceptance', label: '验收管理', path: '/acceptance', icon: '✅' },
  { key: 'compliance', label: '合规模块', path: '/compliance', icon: '🛡️' },
  { key: 'risk', label: '风险管理', path: '/risk', icon: '⚠️' },
  { key: 'staff', label: '人员资质', path: '/staff', icon: '👤' },
  { key: 'uptime', label: '开机率管理', path: '/uptime', icon: '📈' },
  { key: 'system', label: '系统管理', path: '/modules', icon: '⚙️' },
];

export default function ModuleSelector() {
  const [searchParams] = useSearchParams();
  const parentKey = searchParams.get('parent');
  const [modules, setModules] = useState([]);

  useEffect(() => {
    // 找到父模块的子模块
    const parentModule = DESKTOP_MODULES.find(m => m.key === parentKey);
    if (parentModule) {
      // 这里可以根据不同的父模块返回不同的子模块列表
      const childModules = getChildModules(parentKey);
      setModules(childModules);
    }
  }, [parentKey]);

  const handleSelect = (module) => {
    // 通知父窗口选择的模块
    if (window.opener) {
      window.opener.postMessage({
        type: 'module-selected',
        key: module.key,
      }, window.location.origin);
    }
    window.close();
  };

  return (
    <div style={{
      padding: '20px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      backgroundColor: '#f5f5f5',
      minHeight: '100vh',
    }}>
      <h2 style={{ marginTop: 0, marginBottom: '20px', fontSize: '18px', color: '#333' }}>
        选择模块
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {modules.map((mod) => (
          <button
            key={mod.key}
            onClick={() => handleSelect(mod)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 16px',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              backgroundColor: 'white',
              cursor: 'pointer',
              fontSize: '14px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f0f0f0';
              e.currentTarget.style.borderColor = '#1890ff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'white';
              e.currentTarget.style.borderColor = '#e0e0e0';
            }}
          >
            <span style={{ fontSize: '20px' }}>{mod.icon}</span>
            <span>{mod.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function getChildModules(parentKey) {
  const childrenMap = {
    'dashboard': [
      { key: 'dashboard-main', label: '仪表盘', path: '/dashboard', icon: '📊' },
    ],
    'ai-assistant': [
      { key: 'ai-assistant-main', label: 'AI助手', path: '/ai-assistant', icon: '🤖' },
    ],
    'assets': [
      { key: 'assets-list', label: '资产列表', path: '/assets', icon: '📋' },
      { key: 'assets-add', label: '添加资产', path: '/assets/add', icon: '➕' },
      { key: 'assets-import', label: '导入资产', path: '/assets/import', icon: '📥' },
    ],
    'depreciation': [
      { key: 'depreciation-list', label: '资产折旧', path: '/depreciation', icon: '📉' },
    ],
    'inventory': [
      { key: 'inventory-list', label: '盘点列表', path: '/inventory', icon: '📋' },
      { key: 'inventory-new', label: '新建盘点', path: '/inventory/new', icon: '➕' },
    ],
    'transfer': [
      { key: 'transfer-list', label: '调配记录', path: '/transfer', icon: '📋' },
      { key: 'transfer-new', label: '调配申请', path: '/transfer/new', icon: '➕' },
    ],
    'idle': [
      { key: 'idle-list', label: '闲置资产', path: '/idle', icon: '📋' },
      { key: 'idle-new', label: '新增闲置', path: '/idle/new', icon: '➕' },
    ],
    'maintenance': [
      { key: 'maintenance-plans', label: '预防性维护', path: '/maintenance/plans', icon: '📅' },
      { key: 'maintenance-workorders', label: '调度中心', path: '/maintenance/workorders', icon: '📝' },
    ],
    'asset-monitoring': [
      { key: 'asset-location', label: '地理定位', path: '/asset-location', icon: '📍' },
      { key: 'iot-devices', label: 'IoT设备', path: '/iot-devices', icon: '📡' },
    ],
    'quality': [
      { key: 'metrology', label: '计量管理', path: '/quality-control/metrology', icon: '📏' },
      { key: 'quality-qc', label: '质控管理', path: '/quality-control/qc', icon: '🔬' },
      { key: 'adverse-reaction', label: '不良事件', path: '/adverse-reaction', icon: '⚠️' },
    ],
    'technical-documents': [
      { key: 'docs-list', label: '资料列表', path: '/technical-documents', icon: '📋' },
      { key: 'docs-upload', label: '资料上传', path: '/technical-documents/upload', icon: '📤' },
    ],
    'acceptance': [
      { key: 'acceptance-list', label: '验收记录', path: '/acceptance', icon: '📋' },
      { key: 'acceptance-create', label: '创建验收', path: '/acceptance/create', icon: '➕' },
    ],
    'compliance': [
      { key: 'compliance-dashboard', label: '合规仪表盘', path: '/compliance', icon: '📊' },
      { key: 'special-equipment', label: '特种设备', path: '/special-equipment', icon: '🏭' },
    ],
    'risk': [
      { key: 'risk-dashboard', label: '风险仪表盘', path: '/risk', icon: '📊' },
      { key: 'risk-assessment', label: '风险评估', path: '/risk/assessment', icon: '📝' },
    ],
    'staff': [
      { key: 'staff-qualifications', label: '资质管理', path: '/staff/qualifications', icon: '📜' },
      { key: 'staff-training', label: '培训管理', path: '/staff/training', icon: '📚' },
    ],
    'uptime': [
      { key: 'uptime-dashboard', label: '开机率仪表盘', path: '/uptime', icon: '📊' },
      { key: 'uptime-statistics', label: '开机率统计', path: '/uptime/statistics', icon: '📈' },
    ],
    'system': [
      { key: 'modules', label: '模块管理', path: '/modules', icon: '📦' },
      { key: 'users', label: '用户管理', path: '/users', icon: '👥' },
      { key: 'user-roles', label: '用户与角色', path: '/user-roles', icon: '👤' },
      { key: 'roles-permissions', label: '权限管理', path: '/roles-permissions', icon: '🔐' },
      { key: 'data-scope', label: '数据权限', path: '/data-scope', icon: '📊' },
      { key: 'tenant-management', label: '租户管理', path: '/tenant-management', icon: '🏢' },
    ],
  };
  
  return childrenMap[parentKey] || [];
}
