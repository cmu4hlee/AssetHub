const { ipcRenderer } = require('electron');

// DOM 元素
const elements = {
  // 配置
  runMode: document.getElementById('run-mode'),
  backendPort: document.getElementById('backend-port'),
  backendHost: document.getElementById('backend-host'),
  frontendPort: document.getElementById('frontend-port'),
  frontendHost: document.getElementById('frontend-host'),
  dbHost: document.getElementById('db-host'),
  dbPort: document.getElementById('db-port'),
  dbName: document.getElementById('db-name'),
  dbUser: document.getElementById('db-user'),
  dbPassword: document.getElementById('db-password'),
  saveConfigBtn: document.getElementById('save-config'),
  testDbConnectionBtn: document.getElementById('test-db-connection'),
  dbTestResult: document.getElementById('db-test-result'),
  
  // 后端控制
  startBackendBtn: document.getElementById('start-backend'),
  stopBackendBtn: document.getElementById('stop-backend'),
  restartBackendBtn: document.getElementById('restart-backend'),
  backendStatusDot: document.getElementById('backend-status-dot'),
  backendStatusText: document.getElementById('backend-status-text'),
  backendLog: document.getElementById('backend-log'),
  
  // 前端控制
  startFrontendBtn: document.getElementById('start-frontend'),
  stopFrontendBtn: document.getElementById('stop-frontend'),
  restartFrontendBtn: document.getElementById('restart-frontend'),
  frontendStatusDot: document.getElementById('frontend-status-dot'),
  frontendStatusText: document.getElementById('frontend-status-text'),
  frontendLog: document.getElementById('frontend-log'),
  
  // Redis控制
  startRedisBtn: document.getElementById('start-redis'),
  stopRedisBtn: document.getElementById('stop-redis'),
  restartRedisBtn: document.getElementById('restart-redis'),
  redisStatusDot: document.getElementById('redis-status-dot'),
  redisStatusText: document.getElementById('redis-status-text'),
  redisLog: document.getElementById('redis-log'),
  clearRedisLogBtn: document.getElementById('clear-redis-log'),
  
  // 日志清空
  clearBackendLogBtn: document.getElementById('clear-backend-log'),
  clearFrontendLogBtn: document.getElementById('clear-frontend-log'),
  
  // 快速操作
  startAllBtn: document.getElementById('start-all'),
  stopAllBtn: document.getElementById('stop-all'),
  restartAllBtn: document.getElementById('restart-all'),
  
  // 自动监控
  autoRestartToggle: document.getElementById('auto-restart-toggle'),
  monitoringStatus: document.getElementById('monitoring-status'),
  restartInfo: document.getElementById('restart-info'),
  backendRestartInfo: document.getElementById('backend-restart-info'),
  frontendRestartInfo: document.getElementById('frontend-restart-info'),
  redisRestartInfo: document.getElementById('redis-restart-info'),
  
  // 诊断
  checkPathsBtn: document.getElementById('check-paths'),
  diagnosticInfo: document.getElementById('diagnostic-info')
};

// 加载配置
async function loadConfig() {
  try {
    const config = await ipcRenderer.invoke('get-config');
    
    // 加载模式
    if (config.mode) {
      elements.runMode.value = config.mode;
    }
    
    // 根据模式更新端口
    updatePortsByMode(config.mode || 'development');
    
    elements.backendPort.value = config.backend.port;
    elements.backendHost.value = config.backend.host;
    elements.frontendPort.value = config.frontend.port;
    elements.frontendHost.value = config.frontend.host;
    
    // 加载数据库配置
    if (config.database) {
      elements.dbHost.value = config.database.host || '';
      elements.dbPort.value = config.database.port || 3306;
      elements.dbName.value = config.database.database || '';
      elements.dbUser.value = config.database.user || '';
      elements.dbPassword.value = config.database.password || '';
    }
  } catch (error) {
    console.error('加载配置失败:', error);
  }
}

// 根据模式更新端口
function updatePortsByMode(mode) {
  if (mode === 'development') {
    elements.backendPort.value = 5183;
    elements.frontendPort.value = 13579;
  } else {
    elements.backendPort.value = 4001;
    elements.frontendPort.value = 4000;
  }
}

// 保存配置
async function saveConfig() {
  const config = {
    mode: elements.runMode.value, // 保存运行模式
    backend: {
      port: parseInt(elements.backendPort.value),
      host: elements.backendHost.value,
      path: null // 保持默认路径
    },
    frontend: {
      port: parseInt(elements.frontendPort.value),
      host: elements.frontendHost.value,
      path: null // 保持默认路径
    },
    database: {
      host: elements.dbHost.value.trim(),
      port: parseInt(elements.dbPort.value) || 3306,
      user: elements.dbUser.value.trim(),
      password: elements.dbPassword.value,
      database: elements.dbName.value.trim()
    }
  };
  
  // 验证数据库配置
  if (!config.database.host || !config.database.database || !config.database.user) {
    showMessage('请填写完整的数据库配置信息', 'error');
    return;
  }
  
  try {
    const result = await ipcRenderer.invoke('save-config', config);
    if (result) {
      showMessage('配置保存成功，已更新后端 .env 文件', 'success');
    } else {
      showMessage('配置保存失败', 'error');
    }
  } catch (error) {
    console.error('保存配置失败:', error);
    showMessage('配置保存失败: ' + error.message, 'error');
  }
}

// 测试数据库连接
async function testDbConnection() {
  const dbConfig = {
    host: elements.dbHost.value.trim(),
    port: parseInt(elements.dbPort.value) || 3306,
    user: elements.dbUser.value.trim(),
    password: elements.dbPassword.value,
    database: elements.dbName.value.trim()
  };
  
  if (!dbConfig.host || !dbConfig.database || !dbConfig.user) {
    showMessage('请先填写数据库配置信息', 'error');
    return;
  }
  
  elements.testDbConnectionBtn.disabled = true;
  elements.testDbConnectionBtn.textContent = '测试中...';
  elements.dbTestResult.style.display = 'block';
  elements.dbTestResult.textContent = '正在测试数据库连接...';
  elements.dbTestResult.style.background = '#fff3cd';
  elements.dbTestResult.style.color = '#856404';
  
  try {
    const result = await ipcRenderer.invoke('test-db-connection', dbConfig);
    if (result.success) {
      elements.dbTestResult.textContent = '✅ ' + result.message;
      elements.dbTestResult.style.background = '#d4edda';
      elements.dbTestResult.style.color = '#155724';
    } else {
      elements.dbTestResult.textContent = '❌ ' + result.message;
      elements.dbTestResult.style.background = '#f8d7da';
      elements.dbTestResult.style.color = '#721c24';
    }
  } catch (error) {
    elements.dbTestResult.textContent = '❌ 测试失败: ' + error.message;
    elements.dbTestResult.style.background = '#f8d7da';
    elements.dbTestResult.style.color = '#721c24';
  } finally {
    elements.testDbConnectionBtn.disabled = false;
    elements.testDbConnectionBtn.textContent = '🔌 测试数据库连接';
  }
}

// 检查服务状态
async function checkStatus() {
  try {
    const status = await ipcRenderer.invoke('check-status');
    updateBackendStatus(status.backend);
    updateFrontendStatus(status.frontend);
    updateRedisStatus(status.redis);
  } catch (error) {
    console.error('检查状态失败:', error);
  }
}
  
// 更新后端状态
function updateBackendStatus(running) {
  if (running) {
    elements.backendStatusDot.classList.add('running');
    elements.backendStatusDot.classList.remove('stopped');
    elements.backendStatusText.textContent = '运行中';
    elements.startBackendBtn.disabled = true;
    elements.stopBackendBtn.disabled = false;
    elements.restartBackendBtn.disabled = false;
  } else {
    elements.backendStatusDot.classList.add('stopped');
    elements.backendStatusDot.classList.remove('running');
    elements.backendStatusText.textContent = '已停止';
    elements.startBackendBtn.disabled = false;
    elements.stopBackendBtn.disabled = true;
    elements.restartBackendBtn.disabled = true;
  }
}

// 更新前端状态
function updateFrontendStatus(running) {
  if (running) {
    elements.frontendStatusDot.classList.add('running');
    elements.frontendStatusDot.classList.remove('stopped');
    elements.frontendStatusText.textContent = '运行中';
    elements.startFrontendBtn.disabled = true;
    elements.stopFrontendBtn.disabled = false;
    elements.restartFrontendBtn.disabled = false;
  } else {
    elements.frontendStatusDot.classList.add('stopped');
    elements.frontendStatusDot.classList.remove('running');
    elements.frontendStatusText.textContent = '已停止';
    elements.startFrontendBtn.disabled = false;
    elements.stopFrontendBtn.disabled = true;
    elements.restartFrontendBtn.disabled = true;
  }
}

// 更新Redis状态
function updateRedisStatus(running) {
  if (running) {
    elements.redisStatusDot.classList.add('running');
    elements.redisStatusDot.classList.remove('stopped');
    elements.redisStatusText.textContent = '运行中';
    elements.startRedisBtn.disabled = true;
    elements.stopRedisBtn.disabled = false;
    elements.restartRedisBtn.disabled = false;
  } else {
    elements.redisStatusDot.classList.add('stopped');
    elements.redisStatusDot.classList.remove('running');
    elements.redisStatusText.textContent = '已停止';
    elements.startRedisBtn.disabled = false;
    elements.stopRedisBtn.disabled = true;
    elements.restartRedisBtn.disabled = true;
  }
}

// 显示消息
function showMessage(message, type = 'info') {
  // 简单的消息提示
  const messageDiv = document.createElement('div');
  messageDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 20px;
    background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#667eea'};
    color: white;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    z-index: 1000;
    animation: slideIn 0.3s ease;
  `;
  messageDiv.textContent = message;
  document.body.appendChild(messageDiv);
  
  setTimeout(() => {
    messageDiv.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => {
      document.body.removeChild(messageDiv);
    }, 300);
  }, 3000);
}

// 添加日志
function addLog(logElement, message) {
  const timestamp = new Date().toLocaleTimeString();
  logElement.textContent += `[${timestamp}] ${message}`;
  logElement.scrollTop = logElement.scrollHeight;
}

// 事件监听
elements.saveConfigBtn.addEventListener('click', saveConfig);
elements.testDbConnectionBtn.addEventListener('click', testDbConnection);

// 日志清空功能
 elements.clearBackendLogBtn.addEventListener('click', () => {
  elements.backendLog.textContent = '';
});

elements.clearFrontendLogBtn.addEventListener('click', () => {
  elements.frontendLog.textContent = '';
});

elements.clearRedisLogBtn.addEventListener('click', () => {
  elements.redisLog.textContent = '';
});

elements.startBackendBtn.addEventListener('click', async () => {
  elements.startBackendBtn.disabled = true;
  const result = await ipcRenderer.invoke('start-backend');
  showMessage(result.message, result.success ? 'success' : 'error');
  // 立即检查状态，然后定期检查
  setTimeout(checkStatus, 2000);
  setTimeout(checkStatus, 5000);
  if (!result.success) {
    elements.startBackendBtn.disabled = false;
  }
});

elements.stopBackendBtn.addEventListener('click', async () => {
  elements.stopBackendBtn.disabled = true;
  const result = await ipcRenderer.invoke('stop-backend');
  showMessage(result.message, result.success ? 'success' : 'error');
  // 立即检查状态
  setTimeout(checkStatus, 500);
  setTimeout(checkStatus, 2000);
});

elements.restartBackendBtn.addEventListener('click', async () => {
  elements.restartBackendBtn.disabled = true;
  const result = await ipcRenderer.invoke('restart-backend');
  showMessage(result.message, result.success ? 'success' : 'error');
  // 立即检查状态，然后定期检查
  setTimeout(checkStatus, 2000);
  setTimeout(checkStatus, 5000);
  if (!result.success) {
    elements.restartBackendBtn.disabled = false;
  }
});

elements.startFrontendBtn.addEventListener('click', async () => {
  elements.startFrontendBtn.disabled = true;
  const result = await ipcRenderer.invoke('start-frontend');
  showMessage(result.message, result.success ? 'success' : 'error');
  // 立即检查状态，然后定期检查
  setTimeout(checkStatus, 3000);
  setTimeout(checkStatus, 6000);
  if (!result.success) {
    elements.startFrontendBtn.disabled = false;
  }
});

elements.stopFrontendBtn.addEventListener('click', async () => {
  elements.stopFrontendBtn.disabled = true;
  const result = await ipcRenderer.invoke('stop-frontend');
  showMessage(result.message, result.success ? 'success' : 'error');
  // 立即检查状态
  setTimeout(checkStatus, 500);
  setTimeout(checkStatus, 2000);
});

elements.restartFrontendBtn.addEventListener('click', async () => {
  elements.restartFrontendBtn.disabled = true;
  const result = await ipcRenderer.invoke('restart-frontend');
  showMessage(result.message, result.success ? 'success' : 'error');
  // 立即检查状态，然后定期检查
  setTimeout(checkStatus, 3000);
  setTimeout(checkStatus, 6000);
  if (!result.success) {
    elements.restartFrontendBtn.disabled = false;
  }
});

// Redis控制事件

elements.startRedisBtn.addEventListener('click', async () => {
  elements.startRedisBtn.disabled = true;
  const result = await ipcRenderer.invoke('start-redis');
  showMessage(result.message, result.success ? 'success' : 'error');
  // 立即检查状态，然后定期检查
  setTimeout(checkStatus, 2000);
  setTimeout(checkStatus, 5000);
  if (!result.success) {
    elements.startRedisBtn.disabled = false;
  }
});

elements.stopRedisBtn.addEventListener('click', async () => {
  elements.stopRedisBtn.disabled = true;
  const result = await ipcRenderer.invoke('stop-redis');
  showMessage(result.message, result.success ? 'success' : 'error');
  // 立即检查状态
  setTimeout(checkStatus, 500);
  setTimeout(checkStatus, 2000);
});

elements.restartRedisBtn.addEventListener('click', async () => {
  elements.restartRedisBtn.disabled = true;
  const result = await ipcRenderer.invoke('restart-redis');
  showMessage(result.message, result.success ? 'success' : 'error');
  // 立即检查状态，然后定期检查
  setTimeout(checkStatus, 2000);
  setTimeout(checkStatus, 5000);
  if (!result.success) {
    elements.restartRedisBtn.disabled = false;
  }
});

// 快速操作按钮

elements.startAllBtn.addEventListener('click', async () => {
  elements.startAllBtn.disabled = true;
  const backendResult = await ipcRenderer.invoke('start-backend');
  await new Promise(resolve => setTimeout(resolve, 1000));
  const redisResult = await ipcRenderer.invoke('start-redis');
  await new Promise(resolve => setTimeout(resolve, 1000));
  const frontendResult = await ipcRenderer.invoke('start-frontend');
  showMessage('所有服务启动完成', backendResult.success && frontendResult.success && redisResult.success ? 'success' : 'error');
  setTimeout(checkStatus, 5000);
  elements.startAllBtn.disabled = false;
});

elements.stopAllBtn.addEventListener('click', async () => {
  elements.stopAllBtn.disabled = true;
  await ipcRenderer.invoke('stop-backend');
  await ipcRenderer.invoke('stop-frontend');
  await ipcRenderer.invoke('stop-redis');
  showMessage('所有服务已停止', 'success');
  setTimeout(checkStatus, 1000);
  elements.stopAllBtn.disabled = false;
});

elements.restartAllBtn.addEventListener('click', async () => {
  elements.restartAllBtn.disabled = true;
  await ipcRenderer.invoke('stop-backend');
  await ipcRenderer.invoke('stop-frontend');
  await ipcRenderer.invoke('stop-redis');
  await new Promise(resolve => setTimeout(resolve, 2000));
  const backendResult = await ipcRenderer.invoke('start-backend');
  await new Promise(resolve => setTimeout(resolve, 1000));
  const redisResult = await ipcRenderer.invoke('start-redis');
  await new Promise(resolve => setTimeout(resolve, 1000));
  const frontendResult = await ipcRenderer.invoke('start-frontend');
  showMessage('所有服务重启完成', backendResult.success && frontendResult.success && redisResult.success ? 'success' : 'error');
  setTimeout(checkStatus, 5000);
  elements.restartAllBtn.disabled = false;
});

// IPC 监听
ipcRenderer.on('backend-log', (event, data) => {
  addLog(elements.backendLog, data);
});

ipcRenderer.on('frontend-log', (event, data) => {
  addLog(elements.frontendLog, data);
});

ipcRenderer.on('redis-log', (event, data) => {
  addLog(elements.redisLog, data);
});

ipcRenderer.on('backend-status', (event, status) => {
  updateBackendStatus(status.running);
});

ipcRenderer.on('frontend-status', (event, status) => {
  updateFrontendStatus(status.running);
});

ipcRenderer.on('redis-status', (event, status) => {
  updateRedisStatus(status.running);
});

// 加载自动监控状态
async function loadAutoRestartStatus() {
  try {
    const status = await ipcRenderer.invoke('get-auto-restart-status');
    elements.autoRestartToggle.checked = status.enabled;
    updateMonitoringStatus(status.enabled);
    if (status.enabled) {
      elements.restartInfo.style.display = 'block';
      elements.backendRestartInfo.textContent = `后端重启次数: ${status.backendRestartCount}`;
      elements.frontendRestartInfo.textContent = `前端重启次数: ${status.frontendRestartCount}`;
      elements.redisRestartInfo.textContent = `Redis重启次数: ${status.redisRestartCount || 0}`;
    }
  } catch (error) {
    console.error('加载自动监控状态失败:', error);
  }
}

// 更新监控状态显示
function updateMonitoringStatus(enabled) {
  if (enabled) {
    elements.monitoringStatus.textContent = '监控中';
    elements.monitoringStatus.style.background = '#28a745';
    elements.monitoringStatus.style.color = 'white';
  } else {
    elements.monitoringStatus.textContent = '未启用';
    elements.monitoringStatus.style.background = '#f0f0f0';
    elements.monitoringStatus.style.color = '#666';
  }
}

// 自动监控切换事件
elements.autoRestartToggle.addEventListener('change', async (event) => {
  const enabled = event.target.checked;
  const result = await ipcRenderer.invoke('set-auto-restart', enabled);
  if (result.success) {
    updateMonitoringStatus(enabled);
    if (enabled) {
      elements.restartInfo.style.display = 'block';
      showMessage('自动监控已启用', 'success');
    } else {
      elements.restartInfo.style.display = 'none';
      showMessage('自动监控已禁用', 'info');
    }
  } else {
    elements.autoRestartToggle.checked = !enabled;
    showMessage('设置自动监控失败', 'error');
  }
});

// IPC 监听自动重启事件
ipcRenderer.on('auto-restart', (event, data) => {
  if (data.service === 'backend') {
    elements.backendRestartInfo.textContent = `后端重启次数: ${data.count}`;
  } else if (data.service === 'frontend') {
    elements.frontendRestartInfo.textContent = `前端重启次数: ${data.count}`;
  } else if (data.service === 'redis') {
    elements.redisRestartInfo.textContent = `Redis重启次数: ${data.count}`;
  }
  elements.restartInfo.style.display = 'block';
});

ipcRenderer.on('auto-restart-failed', (event, data) => {
  let serviceName = '';
  if (data.service === 'backend') {
    serviceName = '后端';
  } else if (data.service === 'frontend') {
    serviceName = '前端';
  } else if (data.service === 'redis') {
    serviceName = 'Redis';
  }
  showMessage(`${serviceName}服务自动重启失败，已达最大重启次数`, 'error');
});

// 诊断功能
if (elements.checkPathsBtn) {
  elements.checkPathsBtn.addEventListener('click', async () => {
    try {
      const info = await ipcRenderer.invoke('get-project-root');
      let diagnosticText = '=== 路径诊断信息 ===\n\n';
      diagnosticText += `项目根目录: ${info.path}\n`;
      diagnosticText += `后端路径: ${info.backendPath}\n`;
      diagnosticText += `前端路径: ${info.frontendPath}\n\n`;
      diagnosticText += `后端目录存在: ${info.backendExists ? '✅' : '❌'}\n`;
      diagnosticText += `前端目录存在: ${info.frontendExists ? '✅' : '❌'}\n`;
      diagnosticText += `server.js 存在: ${info.serverJsExists ? '✅' : '❌'}\n`;
      diagnosticText += `package.json 存在: ${info.frontendPackageExists ? '✅' : '❌'}\n\n`;
      diagnosticText += `应用已打包: ${info.isPackaged ? '是' : '否'}\n`;
      diagnosticText += `应用路径: ${info.appPath}\n`;
      diagnosticText += `当前工作目录: ${info.cwd}\n`;
      
      if (elements.diagnosticInfo) {
        elements.diagnosticInfo.textContent = diagnosticText;
        elements.diagnosticInfo.style.display = 'block';
      }
    } catch (error) {
      if (elements.diagnosticInfo) {
        elements.diagnosticInfo.textContent = `诊断失败: ${error.message}`;
        elements.diagnosticInfo.style.display = 'block';
      }
    }
  });
}

// 模式切换事件
elements.runMode.addEventListener('change', (e) => {
  const mode = e.target.value;
  updatePortsByMode(mode);
  showMessage(`已切换到${mode === 'development' ? '开发' : '生产'}模式，端口已自动更新`, 'info');
});

// 初始化
loadConfig();
loadAutoRestartStatus();
// 立即检查状态
checkStatus();
// 定期检查状态（每15秒检查一次，减少请求频率）
setInterval(checkStatus, 15000);

// 添加 CSS 动画
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);
