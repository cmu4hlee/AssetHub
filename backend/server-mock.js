#!/usr/bin/env node

/**
 * 完全独立的后端服务器
 * 不依赖任何配置文件或数据库
 */

console.log('🚀 启动完全独立版服务器...\n');

// 内置必要模块
const http = require('http');
const url = require('url');

// 简单的内存数据存储
const mockData = {
  users: [
    { id: 1, username: 'su', password: '123', role: 'super_admin', real_name: '超级管理员', tenant_id: 1 },
    { id: 2, username: 'system_admin', password: '***TEST_PASSWORD***', role: 'system_admin', real_name: '系统管理员', tenant_id: 1 },
    { id: 3, username: 'asset_admin', password: '***TEST_PASSWORD***', role: 'asset_admin', real_name: '资产管理员', tenant_id: 1 },
    { id: 4, username: 'test_user', password: '***TEST_PASSWORD***', role: 'user', real_name: '普通用户', tenant_id: 1 },
  ],
  tokens: new Map(),
  assets: [
    { id: 1, name: 'Dell笔记本电脑', code: 'ZC001', category: '电脑设备', status: '在用', location: '办公室A', value: 8500 },
    { id: 2, name: '办公桌', code: 'ZC002', category: '办公家具', status: '在用', location: '办公室B', value: 2000 },
    { id: 3, name: '血压计', code: 'ZC003', category: '医疗设备', status: '维修中', location: '设备间', value: 3500 },
    { id: 4, name: '空调设备', code: 'ZC004', category: '机械设备', status: '在用', location: '会议室', value: 12000 },
    { id: 5, name: '旧打印机', code: 'ZC005', category: '办公设备', status: '闲置', location: '仓库', value: 1500 },
  ],
  metrology: [
    { id: 1, equipment_name: '电子血压计', certificate_no: 'RZ2024001', calibration_date: '2024-07-01', next_date: '2025-07-01', status: '合格', operator: '张工' },
    { id: 2, equipment_name: '体温计', certificate_no: 'RZ2024002', calibration_date: '2024-08-15', next_date: '2025-08-15', status: '合格', operator: '李工' },
    { id: 3, equipment_name: '血糖仪', certificate_no: 'RZ2024003', calibration_date: '2024-06-20', next_date: '2025-06-20', status: '待检', operator: '王工' },
  ],
  quality_control: [
    { id: 1, check_type: '日常巡检', check_date: '2025-01-10', status: '合格', checker: '赵工', department: '质量管理部' },
    { id: 2, check_type: '专项检查', check_date: '2025-01-08', status: '整改中', checker: '钱工', department: '质量管理部' },
  ],
  maintenance: [
    { id: 1, asset_name: '空调系统', type: '故障维修', status: '处理中', request_date: '2025-01-15', description: '制冷效果不佳' },
    { id: 2, asset_name: '电脑', type: '定期保养', status: '已完成', request_date: '2025-01-10', description: '日常维护保养' },
  ],
  inventory: [
    { id: 1, name: '2024年度盘点', status: '进行中', start_date: '2025-01-01', end_date: '2025-01-31', progress: 65 },
  ],
  transfer: [
    { id: 1, asset_name: '办公桌', from_dept: '财务部', to_dept: '人事部', status: '已完成', transfer_date: '2025-01-05' },
    { id: 2, asset_name: '文件柜', from_dept: '销售部', to_dept: '市场部', status: '待审批', transfer_date: '2025-01-12' },
  ],
  idle: [
    { id: 1, name: '旧打印机', category: '办公设备', idle_date: '2025-01-01', suggested_action: '调拨', value: 1500 },
    { id: 2, name: '扫描仪', category: '办公设备', idle_date: '2025-01-08', suggested_action: '报废', value: 800 },
  ],
  documents: [
    { id: 1, title: '设备操作手册', category: '操作指南', upload_date: '2025-01-01', file_type: 'PDF' },
    { id: 2, title: '维护保养规范', category: '维护规范', upload_date: '2025-01-05', file_type: 'Word' },
    { id: 3, title: '安全操作规程', category: '安全规范', upload_date: '2025-01-10', file_type: 'PDF' },
  ],
  departments: [
    { id: 1, name: '资产管理部', code: 'ZCGL' },
    { id: 2, name: '质量管理部门', code: 'ZLGL' },
    { id: 3, name: '信息技术部', code: 'XXJS' },
    { id: 4, name: '人力资源部', code: 'RLZY' },
  ],
  roles: [
    { id: 1, name: '超级管理员', code: 'super_admin', description: '系统最高权限' },
    { id: 2, name: '系统管理员', code: 'system_admin', description: '管理租户和系统配置' },
    { id: 3, name: '资产管理员', code: 'asset_admin', description: '管理资产全生命周期' },
    { id: 4, name: '普通用户', code: 'user', description: '基本查看权限' },
  ],
};

// 创建HTTP服务器
const server = http.createServer((req, res) => {
  // 设置CORS
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

  console.log(`${method} ${pathname}`);

  // 解析请求体
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    let data = {};
    if (body) {
      try { data = JSON.parse(body); } catch (_error) {
        // Malformed JSON requests are handled by route-level validation.
      }
    }

    // 路由处理
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
  // 登录
  if (pathname === '/api/users/login' && method === 'POST') {
    const { username, password } = data;
    const user = mockData.users.find(u => u.username === username && u.password === password);

    if (user) {
      const token = `mock-token-${Date.now()}`;
      mockData.tokens.set(token, { userId: user.id, username: user.username, role: user.role });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        message: '登录成功',
        data: {
          token,
          user: { id: user.id, username: user.username, role: user.role, real_name: user.real_name, tenant_id: user.tenant_id },
        },
      }));
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: '用户名或密码错误' }));
    }
    return;
  }

  // 健康检查
  if (pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      message: '资产管理服务运行正常',
      database: 'mock',
      timestamp: new Date().toISOString(),
    }));
    return;
  }

  // 资产管理
  if (pathname === '/api/assets' && method === 'GET') {
    const page = parseInt(query.page) || 1;
    const pageSize = parseInt(query.pageSize) || 10;
    const start = (page - 1) * pageSize;
    const list = mockData.assets.slice(start, start + pageSize);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: list, total: mockData.assets.length }));
    return;
  }

  if (pathname === '/api/assets/statistics/overview') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      data: {
        total: mockData.assets.length,
        inUse: mockData.assets.filter(a => a.status === '在用').length,
        idle: mockData.assets.filter(a => a.status === '闲置').length,
        maintenance: mockData.assets.filter(a => a.status === '维修中').length,
        totalValue: mockData.assets.reduce((sum, a) => sum + a.value, 0),
      },
    }));
    return;
  }

  // 质量管理-计量
  if (pathname === '/api/quality-control/metrology' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: mockData.metrology, total: mockData.metrology.length }));
    return;
  }

  if (pathname === '/api/quality-control/metrology/statistics') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      data: {
        total: mockData.metrology.length,
        qualified: mockData.metrology.filter(m => m.status === '合格').length,
        pending: mockData.metrology.filter(m => m.status === '待检').length,
        expiring_soon: 2,
      },
    }));
    return;
  }

  // 质量管理-质控
  if (pathname === '/api/quality-control' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: mockData.quality_control, total: mockData.quality_control.length }));
    return;
  }

  if (pathname === '/api/quality-control/statistics') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      data: {
        total: mockData.quality_control.length,
        qualified: mockData.quality_control.filter(q => q.status === '合格').length,
        rectification: mockData.quality_control.filter(q => q.status === '整改中').length,
      },
    }));
    return;
  }

  // 维修维护
  if (pathname === '/api/maintenance/requests' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: mockData.maintenance, total: mockData.maintenance.length }));
    return;
  }

  if (pathname === '/api/maintenance/statistics') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      data: {
        total: mockData.maintenance.length,
        processing: mockData.maintenance.filter(m => m.status === '处理中').length,
        completed: mockData.maintenance.filter(m => m.status === '已完成').length,
      },
    }));
    return;
  }

  // 盘点管理
  if (pathname === '/api/inventory' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: mockData.inventory, total: mockData.inventory.length }));
    return;
  }

  // 调配管理
  if (pathname === '/api/transfer' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: mockData.transfer, total: mockData.transfer.length }));
    return;
  }

  // 闲置资产
  if (pathname === '/api/idle' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: mockData.idle, total: mockData.idle.length }));
    return;
  }

  // 技术资料
  if (pathname === '/api/technical-documents' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: mockData.documents, total: mockData.documents.length }));
    return;
  }

  // 权限
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

  // 用户
  if (pathname === '/api/users' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      data: mockData.users.map(u => ({ ...u, password: '***' })),
      total: mockData.users.length,
    }));
    return;
  }

  // 科室
  if (pathname === '/api/departments') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: mockData.departments }));
    return;
  }

  // 角色
  if (pathname === '/api/roles') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: mockData.roles }));
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: false, message: '接口不存在', path: pathname }));
}

// 启动服务器
const PORT = 5183;
server.listen(PORT, '0.0.0.0', () => {
  console.log('✅ 完全独立版服务器启动成功！');
  console.log('');
  console.log(`📡 访问地址: http://localhost:${  PORT}`);
  console.log('🔐 登录接口: POST /api/users/login');
  console.log('');
  console.log('测试账户:');
  console.log('  超级管理员: su / 123');
  console.log('  系统管理员: system_admin / Test123!');
  console.log('  资产管理员: asset_admin / Test123!');
  console.log('  普通用户: test_user / Test123!');
  console.log('');
  console.log('注意: 使用内存模拟数据，数据库连接失败时使用');
  console.log('');
});
