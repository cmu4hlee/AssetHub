const { Service } = require('node-windows');
const path = require('path');

// 创建服务对象
const svc = new Service({
  name: 'AssetManagement Backend',
  script: path.join(__dirname, 'server.js'),
});

// 卸载服务
svc.on('uninstall', () => {
  console.log('✅ 服务已卸载！');
});

svc.on('error', err => {
  console.error('❌ 卸载错误:', err);
});

// 执行卸载
console.log('正在卸载 Windows 服务...');
svc.uninstall();
