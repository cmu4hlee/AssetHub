#!/usr/bin/env node

console.log('🚀 启动独立版服务器...\n');

const http = require('http');
const url = require('url');

const users = [
  { id: 1, username: 'su', password: '123', role: 'super_admin', real_name: '超级管理员' },
  { id: 2, username: 'system_admin', password: '***TEST_PASSWORD***', role: 'system_admin', real_name: '系统管理员' },
  { id: 3, username: 'asset_admin', password: '***TEST_PASSWORD***', role: 'asset_admin', real_name: '资产管理员' },
  { id: 4, username: 'test_user', password: '***TEST_PASSWORD***', role: 'user', real_name: '普通用户' },
];

const tokens = new Map();
const assets = [
  { id: 1, name: 'Dell笔记本电脑', code: 'ZC001', status: '在用' },
  { id: 2, name: '办公桌', code: 'ZC002', status: '在用' },
  { id: 3, name: '血压计', code: 'ZC003', status: '维修中' },
];

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const parsedUrl = url.parse(req.url, true);
  const {pathname} = parsedUrl;

  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    let data = {};
    try { if (body) data = JSON.parse(body); } catch (_error) {
      // Malformed JSON requests are handled by route-level validation.
    }

    console.log(`${req.method} ${pathname}`);

    // 登录
    if (pathname === '/api/users/login' && req.method === 'POST') {
      const user = users.find(u => u.username === data.username && u.password === data.password);
      if (user) {
        const token = `token-${Date.now()}`;
        tokens.set(token, user);
        res.end(JSON.stringify({ success: true, message: '登录成功', data: { token, user: { id: user.id, username: user.username, role: user.role, real_name: user.real_name } } }));
      } else {
        res.end(JSON.stringify({ success: false, message: '用户名或密码错误' }));
      }
      return;
    }

    // 健康检查
    if (pathname === '/api/health') {
      res.end(JSON.stringify({ status: 'ok', message: '服务运行正常', database: 'mock' }));
      return;
    }

    // 资产列表
    if (pathname === '/api/assets' && req.method === 'GET') {
      res.end(JSON.stringify({ success: true, data: assets, total: assets.length }));
      return;
    }

    // 资产统计
    if (pathname === '/api/assets/statistics/overview') {
      res.end(JSON.stringify({ success: true, data: { total: 156, inUse: 120, idle: 20, maintenance: 10, scrapped: 6 } }));
      return;
    }

    // 用户列表
    if (pathname === '/api/users' && req.method === 'GET') {
      res.end(JSON.stringify({ success: true, data: users.map(u => ({ ...u, password: '***' })), total: users.length }));
      return;
    }

    // 科室
    if (pathname === '/api/departments') {
      res.end(JSON.stringify({ success: true, data: [{ id: 1, name: '资产管理部', code: 'ZCGL' }, { id: 2, name: '质量管理部门', code: 'ZLGL' }] }));
      return;
    }

    // 权限
    if (pathname === '/api/permissions/my') {
      res.end(JSON.stringify({ success: true, data: { menus: ['资产管理', '质量管理', '维修维护'], permissions: ['read', 'write', 'delete'] } }));
      return;
    }

    // 质量管理-计量
    if (pathname === '/api/quality-control/metrology') {
      res.end(JSON.stringify({ success: true, data: [{ id: 1, equipment_name: '血压计', status: '合格' }], total: 1 }));
      return;
    }

    // 维修
    if (pathname === '/api/maintenance/requests') {
      res.end(JSON.stringify({ success: true, data: [{ id: 1, asset_name: '空调', type: '维修', status: '处理中' }], total: 1 }));
      return;
    }

    // 盘点
    if (pathname === '/api/inventory') {
      res.end(JSON.stringify({ success: true, data: [{ id: 1, name: '年度盘点', status: '进行中' }], total: 1 }));
      return;
    }

    // 调配
    if (pathname === '/api/transfer') {
      res.end(JSON.stringify({ success: true, data: [], total: 0 }));
      return;
    }

    // 闲置
    if (pathname === '/api/idle') {
      res.end(JSON.stringify({ success: true, data: [], total: 0 }));
      return;
    }

    // 资料
    if (pathname === '/api/technical-documents') {
      res.end(JSON.stringify({ success: true, data: [], total: 0 }));
      return;
    }

    res.end(JSON.stringify({ success: false, message: '接口不存在' }));
  });
});

server.listen(5183, '0.0.0.0', () => {
  console.log('✅ 服务器启动成功！');
  console.log('📡 地址: http://localhost:5183');
  console.log('');
  console.log('测试账户: su/123, system_admin/Test123!');
  console.log('');
});
