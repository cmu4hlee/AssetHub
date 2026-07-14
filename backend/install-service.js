const { Service } = require('node-windows');
const path = require('path');

// 创建 Windows 服务
const svc = new Service({
  name: 'AssetManagement Backend',
  description: '资产管理系统后端服务',
  script: path.join(__dirname, 'server.js'),
  nodeOptions: ['--max_old_space_size=4096'],
  // 工作目录
  workingDirectory: __dirname,
  // 环境变量
  env: [
    {
      name: 'NODE_ENV',
      value: 'production',
    },
  ],
});

// 安装服务
svc.on('install', () => {
  console.log('✅ 服务安装成功！');
  console.log('正在启动服务...');
  svc.start();
  console.log('✅ 服务已启动！');
  console.log('');
  console.log('服务管理命令：');
  console.log('  启动: net start "AssetManagement Backend"');
  console.log('  停止: net stop "AssetManagement Backend"');
  console.log('  卸载: 运行 uninstall-service.js');
});

svc.on('start', () => {
  console.log('✅ 服务已启动！');
});

svc.on('error', err => {
  console.error('❌ 服务错误:', err);
});

// 执行安装
console.log('正在安装 Windows 服务...');
svc.install();
