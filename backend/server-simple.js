/**
 * 简化版后端服务器入口
 * 在数据库不可用时也能启动
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

console.log('🚀 启动简化版服务器...');

const app = express();

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 简单的内存数据存储（用于演示）
const mockData = {
  users: [
    { id: 1, username: 'su', password: '123', role: 'super_admin', real_name: '超级管理员' },
    { id: 2, username: 'system_admin', password: '***TEST_PASSWORD***', role: 'system_admin', real_name: '系统管理员' },
    { id: 3, username: 'asset_admin', password: '***TEST_PASSWORD***', role: 'asset_admin', real_name: '资产管理员' },
    { id: 4, username: 'test_user', password: '***TEST_PASSWORD***', role: 'user', real_name: '普通用户' },
  ],
  tokens: new Map(),
};

// 登录接口
app.post('/api/users/login', (req, res) => {
  const { username, password } = req.body;
  console.log('登录请求:', username);

  const user = mockData.users.find(u => u.username === username && u.password === password);

  if (user) {
    const token = `mock-token-${Date.now()}`;
    mockData.tokens.set(token, { userId: user.id, username: user.username, role: user.role });

    res.json({
      success: true,
      message: '登录成功',
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          real_name: user.real_name,
        },
      },
    });
  } else {
    res.json({
      success: false,
      message: '用户名或密码错误',
    });
  }
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: '简化版服务器运行正常（数据库连接失败，使用模拟数据）',
    database: 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

// 资产列表（模拟数据）
app.get('/api/assets', (req, res) => {
  res.json({
    success: true,
    data: [
      { id: 1, name: '测试资产1', code: 'ZC001', category: '电脑设备', status: '在用', location: '办公室A' },
      { id: 2, name: '测试资产2', code: 'ZC002', category: '办公家具', status: '在用', location: '办公室B' },
      { id: 3, name: '测试资产3', code: 'ZC003', category: '医疗设备', status: '维修中', location: '设备间' },
    ],
    total: 3,
  });
});

// 资产统计
app.get('/api/assets/statistics/overview', (req, res) => {
  res.json({
    success: true,
    data: {
      total: 156,
      inUse: 120,
      idle: 20,
      maintenance: 10,
      scrapped: 6,
      totalValue: 2580000,
    },
  });
});

// 质量管理-计量
app.get('/api/quality-control/metrology', (req, res) => {
  res.json({
    success: true,
    data: [
      { id: 1, equipment_name: '血压计', certificate_no: 'RZ2024001', status: '合格', next_date: '2025-08-01' },
      { id: 2, equipment_name: '体温计', certificate_no: 'RZ2024002', status: '合格', next_date: '2025-09-15' },
    ],
    total: 2,
  });
});

// 质量管理-统计
app.get('/api/quality-control/metrology/statistics', (req, res) => {
  res.json({
    success: true,
    data: {
      total: 45,
      qualified: 42,
      unqualified: 2,
      pending: 1,
      expiring_soon: 5,
    },
  });
});

// 维修维护
app.get('/api/maintenance/requests', (req, res) => {
  res.json({
    success: true,
    data: [
      { id: 1, asset_name: '空调设备', type: '故障维修', status: '处理中', request_date: '2025-01-15' },
      { id: 2, asset_name: '电脑', type: '定期保养', status: '已完成', request_date: '2025-01-10' },
    ],
    total: 2,
  });
});

// 盘点管理
app.get('/api/inventory', (req, res) => {
  res.json({
    success: true,
    data: [
      { id: 1, name: '年度盘点2024', status: '进行中', start_date: '2025-01-01', end_date: '2025-01-31' },
    ],
    total: 1,
  });
});

// 调配管理
app.get('/api/transfer', (req, res) => {
  res.json({
    success: true,
    data: [
      { id: 1, asset_name: '办公桌', from_dept: '财务部', to_dept: '人事部', status: '已完成' },
    ],
    total: 1,
  });
});

// 闲置资产
app.get('/api/idle', (req, res) => {
  res.json({
    success: true,
    data: [
      { id: 1, name: '旧打印机', category: '办公设备', idle_date: '2025-01-01', suggested_use: '调拨' },
    ],
    total: 1,
  });
});

// 技术资料
app.get('/api/technical-documents', (req, res) => {
  res.json({
    success: true,
    data: [
      { id: 1, title: '设备操作手册', category: '操作指南', upload_date: '2025-01-01' },
      { id: 2, title: '维护保养规范', category: '维护规范', upload_date: '2025-01-05' },
    ],
    total: 2,
  });
});

// 权限
app.get('/api/permissions/my', (req, res) => {
  res.json({
    success: true,
    data: {
      menus: ['资产管理', '质量管理', '维修维护', '系统管理'],
      actions: ['create', 'read', 'update', 'delete'],
    },
  });
});

// 用户列表
app.get('/api/users', (req, res) => {
  res.json({
    success: true,
    data: mockData.users.map(u => ({ ...u, password: '***' })),
    total: mockData.users.length,
  });
});

// 科室列表
app.get('/api/departments', (req, res) => {
  res.json({
    success: true,
    data: [
      { id: 1, name: '资产管理部', code: 'ZCGL' },
      { id: 2, name: '质量管理部门', code: 'ZLGL' },
      { id: 3, name: '信息技术部', code: 'XXJS' },
    ],
  });
});

// 角色列表
app.get('/api/roles', (req, res) => {
  res.json({
    success: true,
    data: [
      { id: 1, name: '超级管理员', code: 'super_admin' },
      { id: 2, name: '系统管理员', code: 'system_admin' },
      { id: 3, name: '资产管理员', code: 'asset_admin' },
      { id: 4, name: '普通用户', code: 'user' },
    ],
  });
});

// 租户
app.get('/api/tenants', (req, res) => {
  res.json({
    success: true,
    data: [
      { id: 1, name: '默认租户', status: 'active' },
    ],
  });
});

// 404处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在',
    path: req.path,
  });
});

// 启动服务器
const PORT = process.env.PORT || 5183;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log('✅ 简化版服务器启动成功！');
  console.log(`📡 访问地址: http://localhost:${PORT}`);
  console.log('🔐 登录账户: su / 123');
  console.log('');
  console.log('注意: 当前使用模拟数据，数据库连接失败');
  console.log('');
});
