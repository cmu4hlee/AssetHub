#!/usr/bin/env node

console.log('🚀 启动完全独立版服务器...\n');

const http = require('http');
const url = require('url');
const path = require('path');

const users = [
  { id: 1, username: 'su', password: '123', role: 'super_admin', real_name: '超级管理员' },
  { id: 2, username: 'system_admin', password: '***TEST_PASSWORD***', role: 'system_admin', real_name: '系统管理员' },
  { id: 3, username: 'asset_admin', password: '***TEST_PASSWORD***', role: 'asset_admin', real_name: '资产管理员' },
  { id: 4, username: 'test_user', password: '***TEST_PASSWORD***', role: 'user', real_name: '普通用户' },
];

const assets = [
  { id: 1, name: 'Dell笔记本电脑', code: 'ZC001', category: '电脑设备', status: '在用', location: '办公室A', value: 8500 },
  { id: 2, name: '办公桌', code: 'ZC002', category: '办公家具', status: '在用', location: '办公室B', value: 2000 },
  { id: 3, name: '血压计', code: 'ZC003', category: '医疗设备', status: '维修中', location: '设备间', value: 3500 },
  { id: 4, name: '空调设备', code: 'ZC004', category: '机械设备', status: '在用', location: '会议室', value: 12000 },
  { id: 5, name: '旧打印机', code: 'ZC005', category: '办公设备', status: '闲置', location: '仓库', value: 1500 },
];

const metrology = [
  { id: 1, equipment_name: '电子血压计', certificate_no: 'RZ2024001', calibration_date: '2024-07-01', next_date: '2025-07-01', status: '合格', operator: '张工' },
  { id: 2, equipment_name: '体温计', certificate_no: 'RZ2024002', calibration_date: '2024-08-15', next_date: '2025-08-15', status: '合格', operator: '李工' },
  { id: 3, equipment_name: '血糖仪', certificate_no: 'RZ2024003', calibration_date: '2024-06-20', next_date: '2025-06-20', status: '待检', operator: '王工' },
];

const quality_control = [
  { id: 1, check_type: '日常巡检', check_date: '2025-01-10', status: '合格', checker: '赵工', department: '质量管理部' },
  { id: 2, check_type: '专项检查', check_date: '2025-01-08', status: '整改中', checker: '钱工', department: '质量管理部' },
];

const maintenance = [
  { id: 1, asset_name: '空调系统', type: '故障维修', status: '处理中', request_date: '2025-01-15', description: '制冷效果不佳' },
  { id: 2, asset_name: '电脑', type: '定期保养', status: '已完成', request_date: '2025-01-10', description: '日常维护保养' },
];

const inventory = [
  { id: 1, name: '2024年度盘点', status: '进行中', start_date: '2025-01-01', end_date: '2025-01-31', progress: 65 },
];

const transfer = [
  { id: 1, asset_name: '办公桌', from_dept: '财务部', to_dept: '人事部', status: '已完成', transfer_date: '2025-01-05' },
  { id: 2, asset_name: '文件柜', from_dept: '销售部', to_dept: '市场部', status: '待审批', transfer_date: '2025-01-12' },
];

const idle = [
  { id: 1, name: '旧打印机', category: '办公设备', idle_date: '2025-01-01', suggested_action: '调拨', value: 1500 },
  { id: 2, name: '扫描仪', category: '办公设备', idle_date: '2025-01-08', suggested_action: '报废', value: 800 },
];

const documents = [
  { id: 1, title: '设备操作手册', category: '操作指南', upload_date: '2025-01-01', file_type: 'PDF' },
  { id: 2, title: '维护保养规范', category: '维护规范', upload_date: '2025-01-05', file_type: 'Word' },
  { id: 3, title: '安全操作规程', category: '安全规范', upload_date: '2025-01-10', file_type: 'PDF' },
];

const departments = [
  { id: 1, name: '资产管理部', code: 'ZCGL' },
  { id: 2, name: '质量管理部门', code: 'ZLGL' },
  { id: 3, name: '信息技术部', code: 'XXJS' },
  { id: 4, name: '人力资源部', code: 'RLZY' },
];

const roles = [
  { id: 1, name: '超级管理员', code: 'super_admin', description: '系统最高权限' },
  { id: 2, name: '系统管理员', code: 'system_admin', description: '管理租户和系统配置' },
  { id: 3, name: '资产管理员', code: 'asset_admin', description: '管理资产全生命周期' },
  { id: 4, name: '普通用户', code: 'user', description: '基本查看权限' },
];

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const {pathname} = parsedUrl;
  const {method} = req;

  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    let data = {};
    try { if (body) data = JSON.parse(body); } catch (_error) {
      // Malformed JSON requests are handled by route-level validation.
    }

    console.log(`${method} ${pathname}`);

    try {
      handleRequest(res, pathname, method, data, parsedUrl.query);
    } catch (error) {
      console.error('处理请求错误:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: '服务器内部错误' }));
    }
  });
});

function handleRequest(res, pathname, method, data, query) {
  if (pathname === '/api/users/login' && method === 'POST') {
    const { username, password } = data;
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
      const token = `mock-token-${Date.now()}`;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        message: '登录成功',
        data: {
          token,
          user: { id: user.id, username: user.username, role: user.role, real_name: user.real_name, tenant_id: 1 },
          enterprises: [{ id: 1, name: '默认租户', tenant_name: '默认租户', status: 'active' }],
        },
      }));
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: '用户名或密码错误' }));
    }
    return;
  }

  if (pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', message: '服务运行正常', database: 'mock', timestamp: new Date().toISOString() }));
    return;
  }

  if (pathname === '/api/assets' && method === 'GET') {
    const page = parseInt(query.page) || 1;
    const pageSize = parseInt(query.pageSize) || 10;
    const start = (page - 1) * pageSize;
    const list = assets.slice(start, start + pageSize);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: list, total: true, data: assets.length }));
    return;
  }

  if (pathname === '/api/assets/statistics/overview') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      data: {
        total: assets.length,
        inUse: assets.filter(a => a.status === '在用').length,
        idle: assets.filter(a => a.status === '闲置').length,
        maintenance: assets.filter(a => a.status === '维修中').length,
        totalValue: assets.reduce((sum, a) => sum + a.value, 0),
      },
    }));
    return;
  }

  if (pathname === '/api/quality-control/metrology' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: metrology, total: metrology.length }));
    return;
  }

  if (pathname === '/api/quality-control/metrology/statistics') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      data: {
        total: metrology.length,
        qualified: metrology.filter(m => m.status === '合格').length,
        pending: metrology.filter(m => m.status === '待检').length,
        expiring_soon: 2,
      },
    }));
    return;
  }

  if (pathname === '/api/quality-control' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: quality_control, total: quality_control.length }));
    return;
  }

  if (pathname === '/api/quality-control/statistics') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      data: {
        total: quality_control.length,
        qualified: quality_control.filter(q => q.status === '合格').length,
        rectification: quality_control.filter(q => q.status === '整改中').length,
      },
    }));
    return;
  }

  if (pathname === '/api/maintenance/requests' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: maintenance, total: maintenance.length }));
    return;
  }

  if (pathname === '/api/maintenance/statistics') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      data: {
        total: maintenance.length,
        processing: maintenance.filter(m => m.status === '处理中').length,
        completed: maintenance.filter(m => m.status === '已完成').length,
      },
    }));
    return;
  }

  if (pathname === '/api/maintenance/plans') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: [], total: 0 }));
    return;
  }

  if (pathname === '/api/inventory' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: inventory, total: inventory.length }));
    return;
  }

  if (pathname === '/api/inventory/statistics') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: { total: inventory.length, processing: 1 } }));
    return;
  }

  if (pathname === '/api/transfer' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: transfer, total: transfer.length }));
    return;
  }

  if (pathname === '/api/transfer/statistics') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: { total: transfer.length, completed: 1, pending: 1 } }));
    return;
  }

  if (pathname === '/api/idle' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: idle, total: idle.length }));
    return;
  }

  if (pathname === '/api/idle/statistics') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: { total: idle.length, value: idle.reduce((s, i) => s + i.value, 0) } }));
    return;
  }

  if (pathname === '/api/technical-documents' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: documents, total: documents.length }));
    return;
  }

  if (pathname === '/api/technical-documents/categories') {
    const categories = [...new Set(documents.map(d => d.category))];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: categories.map((name, i) => ({ id: i + 1, name })) }));
    return;
  }

  if (pathname === '/api/permissions/my') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      data: {
        menus: ['资产管理', '质量管理', '维修维护', '盘点管理', '调配管理', '技术资料', '系统管理'],
        permissions: ['read', 'write', 'delete', 'manage'],
      },
    }));
    return;
  }

  if (pathname === '/api/permissions/menus') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: [] }));
    return;
  }

  if (pathname === '/api/users' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: users.map(u => ({ ...u, password: '***' })), total: users.length }));
    return;
  }

  if (pathname === '/api/users/profile') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: users[0] }));
    return;
  }

  if (pathname === '/api/departments') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: departments }));
    return;
  }

  if (pathname === '/api/departments/tree') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: departments }));
    return;
  }

  if (pathname === '/api/roles') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: roles }));
    return;
  }

  if (pathname === '/api/tenants' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: [{
      id: 1,
      name: '默认租户',
      code: 'DEFAULT',
      status: 'active',
      tenant_name: '默认租户',
      created_at: '2024-01-01 00:00:00',
    }], total: 1 }));
    return;
  }

  if (pathname === '/api/tenants/current/info') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: {
      id: 1,
      name: '默认租户',
      code: 'DEFAULT',
      status: 'active',
      tenant_name: '默认租户',
      created_at: '2024-01-01 00:00:00',
    } }));
    return;
  }

  if (pathname.startsWith('/api/tenants/') && pathname.endsWith('/info')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: {
      id: 1,
      name: '默认租户',
      code: 'DEFAULT',
      status: 'active',
      tenant_name: '默认租户',
      created_at: '2024-01-01 00:00:00',
    } }));
    return;
  }

  if (pathname === '/api/tenant-module-config/tenants' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: [{
      id: 1,
      name: '默认租户',
      code: 'DEFAULT',
      status: 'active',
    }], total: 1 }));
    return;
  }

  if (pathname === '/api/tenants/current') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: { id: 1, name: '默认租户' } }));
    return;
  }

  if (pathname === '/api/quality-control/reports/comprehensive') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      data: {
        period: '2025年1月',
        metrology_stats: { total: metrology.length, qualified: 2, pending: 1 },
        quality_stats: { total: quality_control.length, qualified: 1, rectification: 1 },
        recommendations: ['建议加快血糖仪的计量检定', '继续保持日常巡检工作'],
      },
    }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: false, message: '接口不存在' }));
}

const PORT = 5183;
server.listen(PORT, '0.0.0.0', () => {
  console.log('✅ 完全独立版服务器启动成功！');
  console.log('');
  console.log(`📡 访问地址: http://localhost:${  PORT}`);
  console.log('');
  console.log('测试账户:');
  console.log('  超级管理员: su / 123');
  console.log('  系统管理员: system_admin / Test123!');
  console.log('  资产管理员: asset_admin / Test123!');
  console.log('  普通用户: test_user / Test123!');
  console.log('');
});
