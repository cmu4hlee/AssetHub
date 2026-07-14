const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const fs = require('fs');

// 允许的项目目录名
const ALLOWED_PROJECT_DIRS = ['backend', 'frontend'];

// 验证路径是否安全（防止路径遍历攻击）
function isPathSafe(targetPath) {
  try {
    const resolved = path.resolve(targetPath);
    // 检查路径中不包含可疑字符
    if (targetPath.includes('..') || targetPath.includes('~')) {
      return false;
    }
    // 检查路径不指向系统目录
    const normalized = path.normalize(resolved);
    if (normalized.startsWith('/etc') ||
        normalized.startsWith('/usr') ||
        normalized.startsWith('/bin') ||
        normalized.startsWith('/sbin') ||
        normalized.startsWith('/var') ||
        normalized.startsWith('/sys') ||
        normalized.startsWith('/proc')) {
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

// 验证目录是否包含必要的项目文件
function isValidProjectRoot(dir) {
  if (!isPathSafe(dir)) return false;
  return ALLOWED_PROJECT_DIRS.every(subDir => {
    const subPath = path.join(dir, subDir);
    return fs.existsSync(subPath) && fs.statSync(subPath).isDirectory();
  });
}

const MODE_PORTS = {
  development: {
    backend: 5183,
    frontend: 13579,
  },
  production: {
    backend: 4001,
    frontend: 4000,
  },
};

const LEGACY_MODE_PORTS = {
  development: {
    backend: new Set([4001, 5174, 6001]),
    frontend: new Set([4000, 5173, 6000]),
  },
  production: {
    backend: new Set([5174, 5183, 6001]),
    frontend: new Set([5173, 13579, 6000]),
  },
};

// 确保只有一个应用实例
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // 如果已经有实例在运行，退出
  app.quit();
} else {
  app.on('second-instance', () => {
    // 当另一个实例启动时，聚焦到现有窗口
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// 获取项目根目录（兼容开发和生产环境）
function getProjectRoot() {
  // 开发环境：__dirname 是 ServiceManager 目录
  // 生产环境：__dirname 是 app.asar 内的路径
  let currentDir = __dirname;
  
  // 如果是打包后的应用，需要从 app.asar 路径推断
  if (process.env.NODE_ENV === 'production' || app.isPackaged) {
    console.log('检测到打包后的应用，查找项目根目录...');
    // 尝试从应用路径推断项目根目录
    // app.getAppPath() 返回 app.asar 的路径
    const appPath = app.getAppPath();
    console.log('app.getAppPath():', appPath);
    
    // 如果路径包含 app.asar，说明是打包后的应用
    if (appPath.includes('app.asar')) {
      // 从 app.asar 路径向上查找项目根目录
      // 需要找到包含 backend 和 frontend 的目录
      const homeDir = process.env.HOME || process.env.USERPROFILE || '';
      const possibleRoots = [];
      
      // 首先尝试从 app.asar 的父目录查找
      const appDir = path.dirname(appPath);
      const appDirParent = path.dirname(appDir);
      possibleRoots.push(
        path.join(appDirParent, '..', '..', '..'), // 从 .app/Contents/Resources/app.asar 向上
        path.join(appDirParent, '..', '..'), // 从 .app/Contents/Resources 向上
        appDirParent, // 直接使用父目录
      );
      
      if (process.platform === 'win32') {
        // Windows 路径
        possibleRoots.push(
          path.join(homeDir, 'Desktop', 'Mac_Win_share', '资产管理系统', '资产管理vite'),
          path.join(homeDir, 'Desktop', '资产管理系统', '资产管理vite'),
          path.join(homeDir, 'Documents', 'Mac_Win_share', '资产管理系统', '资产管理vite'),
          path.join(homeDir, 'Documents', '资产管理系统', '资产管理vite'),
        );
      } else {
        // macOS/Linux 路径
        possibleRoots.push(
          path.join(homeDir, 'Desktop', 'Mac_Win_share', '资产管理系统', '资产管理vite'),
          path.join(homeDir, 'Desktop', '资产管理系统', '资产管理vite'),
          path.join(homeDir, 'Documents', 'Mac_Win_share', '资产管理系统', '资产管理vite'),
          path.join(homeDir, 'Documents', '资产管理系统', '资产管理vite'),
        );
      }
      
      console.log('尝试查找项目根目录，可能的路径:', possibleRoots);

      for (const root of possibleRoots) {
        // 安全检查：确保路径安全且包含必要的项目文件
        if (!isValidProjectRoot(root)) {
          continue;
        }
        const normalizedRoot = path.resolve(root);
        console.log(`检查路径: ${normalizedRoot}`);
        const backendPath = path.join(normalizedRoot, 'backend');
        const frontendPath = path.join(normalizedRoot, 'frontend');
        console.log(`  后端存在: ${fs.existsSync(backendPath)}`);
        console.log(`  前端存在: ${fs.existsSync(frontendPath)}`);
        if (fs.existsSync(backendPath) && fs.existsSync(frontendPath)) {
          console.log(`✅ 找到项目根目录: ${normalizedRoot}`);
          return normalizedRoot;
        }
      }
      
      // 如果找不到，尝试从当前工作目录查找
      const cwd = process.cwd();
      if (isValidProjectRoot(cwd)) {
        console.log('当前工作目录:', cwd);
        console.log(`✅ 从工作目录找到项目根目录: ${cwd}`);
        return cwd;
      }

      console.warn('⚠️ 未找到项目根目录，使用默认路径');
    }
    currentDir = appPath.replace('app.asar', '');
  }

  // 开发环境：从 ServiceManager 目录向上查找项目根目录
  let dir = currentDir;
  for (let i = 0; i < 5; i++) {
    if (isValidProjectRoot(dir)) {
      return dir;
    }
    dir = path.dirname(dir);
    if (dir === path.dirname(dir)) break; // 到达根目录
  }

  // 如果都找不到，返回默认路径（开发环境）
  const defaultPath = path.join(__dirname, '..');
  if (isValidProjectRoot(defaultPath)) {
    return defaultPath;
  }
  // 最后的保险：返回当前目录
  return __dirname;
}

// 更新后端 .env 文件
function updateBackendEnv(dbConfig) {
  try {
    const projectRoot = getProjectRoot();
    const envPath = path.join(projectRoot, 'backend', '.env');
    let envContent = '';
    
    // 如果 .env 文件存在，读取现有内容
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    // 更新或添加数据库配置
    const envLines = envContent.split('\n');
    const newEnvLines = [];
    const dbKeys = {
      'DB_HOST': dbConfig.host,
      'DB_PORT': dbConfig.port,
      'DB_USER': dbConfig.user,
      'DB_PASSWORD': dbConfig.password,
      'DB_NAME': dbConfig.database
    };
    
    let foundKeys = new Set();
    
    // 处理现有行
    for (const line of envLines) {
      let processed = false;
      for (const [key, value] of Object.entries(dbKeys)) {
        if (line.trim().startsWith(key + '=')) {
          newEnvLines.push(`${key}=${value}`);
          foundKeys.add(key);
          processed = true;
          break;
        }
      }
      if (!processed) {
        newEnvLines.push(line);
      }
    }
    
    // 添加缺失的配置项
    for (const [key, value] of Object.entries(dbKeys)) {
      if (!foundKeys.has(key)) {
        newEnvLines.push(`${key}=${value}`);
      }
    }
    
    // 写入文件
    fs.writeFileSync(envPath, newEnvLines.join('\n'), 'utf8');
    return true;
  } catch (error) {
    console.error('更新 .env 文件失败:', error);
    return false;
  }
}

let mainWindow;
let backendProcess = null;
let frontendProcess = null;
let redisProcess = null;
let monitoringInterval = null;
let autoRestartEnabled = false;
let backendRestartCount = 0;
let frontendRestartCount = 0;
let redisRestartCount = 0;
let backendFailedNotified = false;
let frontendFailedNotified = false;
let redisFailedNotified = false;

// 超时常量定义
const MAX_RESTART_COUNT = 5; // 最大重启次数
const MONITORING_INTERVAL = 10000; // 监控间隔：10秒
const REDIS_PORT = 6379; // Redis默认端口
const STARTUP_TIMEOUT = 3000; // 启动检测超时：3秒
const STOP_TIMEOUT = 1000; // 停止等待超时：1秒
const RESTART_DELAY = 2000; // 重启延迟：2秒
const HEALTH_CHECK_TIMEOUT = 3000; // 健康检查超时：3秒
const FORCE_SHOW_DELAY = 3000; // 强制显示窗口延迟：3秒
const CONFIG_REFRESH_INTERVAL = 60000; // 配置刷新间隔：60秒

// 配置文件路径
const configPath = path.join(__dirname, 'config.json');

// 从项目文件中读取数据库配置
function loadDatabaseConfigFromProject() {
  const projectRoot = getProjectRoot();
  const backendPath = path.join(projectRoot, 'backend');
  // 默认配置（仅作为最后的后备，优先使用 .env 文件）
  const dbConfig = {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '', // 不允许硬编码密码，必须从 .env 文件读取
    database: 'zcgl'
  };
  
  // 1. 尝试从 .env 文件读取
  const envPath = path.join(backendPath, '.env');
  if (fs.existsSync(envPath)) {
    try {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const envLines = envContent.split('\n');
      
      for (const line of envLines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=');
          if (key && valueParts.length > 0) {
            const value = valueParts.join('=').trim();
            switch (key.trim()) {
              case 'DB_HOST':
                dbConfig.host = value;
                break;
              case 'DB_PORT':
                dbConfig.port = parseInt(value) || 3306;
                break;
              case 'DB_USER':
                dbConfig.user = value;
                break;
              case 'DB_PASSWORD':
                dbConfig.password = value;
                break;
              case 'DB_NAME':
                dbConfig.database = value;
                break;
            }
          }
        }
      }
    } catch (error) {
      console.error('读取 .env 文件失败:', error);
    }
  }
  
  // 2. 如果 .env 中没有完整配置，尝试从 database.js 读取默认值
  if (!dbConfig.host || !dbConfig.user || !dbConfig.database) {
    try {
      const dbConfigPath = path.join(backendPath, 'config', 'database.js');
      if (fs.existsSync(dbConfigPath)) {
        const dbConfigContent = fs.readFileSync(dbConfigPath, 'utf8');
        
        // 使用正则表达式提取默认值
        const hostMatch = dbConfigContent.match(/host:\s*process\.env\.DB_HOST\s*\|\|\s*['"]([^'"]+)['"]/);
        if (hostMatch && !dbConfig.host) {
          dbConfig.host = hostMatch[1];
        }
        
        const portMatch = dbConfigContent.match(/port:\s*process\.env\.DB_PORT\s*\|\|\s*(\d+)/);
        if (portMatch && !dbConfig.port) {
          dbConfig.port = parseInt(portMatch[1]) || 3306;
        }
        
        const userMatch = dbConfigContent.match(/user:\s*process\.env\.DB_USER\s*\|\|\s*['"]([^'"]+)['"]/);
        if (userMatch && !dbConfig.user) {
          dbConfig.user = userMatch[1];
        }
        
        const passwordMatch = dbConfigContent.match(/password:\s*process\.env\.DB_PASSWORD\s*\|\|\s*['"]([^'"]+)['"]/);
        if (passwordMatch && !dbConfig.password) {
          dbConfig.password = passwordMatch[1];
        }
        
        const databaseMatch = dbConfigContent.match(/database:\s*process\.env\.DB_NAME\s*\|\|\s*['"]([^'"]+)['"]/);
        if (databaseMatch && !dbConfig.database) {
          dbConfig.database = databaseMatch[1];
        }
      }
    } catch (error) {
      console.error('读取 database.js 文件失败:', error);
    }
  }
  
  return dbConfig;
}

// 获取默认配置
// 支持开发模式和生产模式，自动配置对应端口
function getModePortDefaults(mode = 'development') {
  return MODE_PORTS[mode] || MODE_PORTS.development;
}

function normalizePort(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function shouldMigrateLegacyPort(mode, service, port) {
  const parsed = Number.parseInt(String(port ?? ''), 10);
  return LEGACY_MODE_PORTS[mode]?.[service]?.has(parsed) || false;
}

function createDefaultConfig(mode = 'development') {
  const projectRoot = getProjectRoot();
  const ports = getModePortDefaults(mode);

  return {
    mode,
    backend: {
      port: ports.backend,
      host: '0.0.0.0',
      path: path.join(projectRoot, 'backend')
    },
    frontend: {
      port: ports.frontend,
      host: '0.0.0.0',
      path: path.join(projectRoot, 'frontend')
    },
    database: loadDatabaseConfigFromProject()
  };
}

function getDefaultConfig() {
  return createDefaultConfig('development');
}

// 加载配置
function loadConfig() {
  try {
    // 每次加载时都重新读取项目中的数据库配置（以便获取最新值）
    const projectDbConfig = loadDatabaseConfigFromProject();
    const currentDefaultConfig = getDefaultConfig();
    
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const mode = config.mode || currentDefaultConfig.mode || 'development';
      const modeDefaults = createDefaultConfig(mode);
      const mergedConfig = {
        ...modeDefaults,
        ...config,
        mode,
        backend: {
          ...modeDefaults.backend,
          ...(config.backend || {}),
        },
        frontend: {
          ...modeDefaults.frontend,
          ...(config.frontend || {}),
        },
        database: {
          ...projectDbConfig,
          ...(config.database || {}),
        },
      };

      mergedConfig.backend.port = shouldMigrateLegacyPort(mode, 'backend', config.backend?.port)
        ? modeDefaults.backend.port
        : normalizePort(config.backend?.port, modeDefaults.backend.port);
      mergedConfig.frontend.port = shouldMigrateLegacyPort(mode, 'frontend', config.frontend?.port)
        ? modeDefaults.frontend.port
        : normalizePort(config.frontend?.port, modeDefaults.frontend.port);

      const projectRoot = getProjectRoot();
      mergedConfig.backend.path = config.backend?.path || path.join(projectRoot, 'backend');
      mergedConfig.frontend.path = config.frontend?.path || path.join(projectRoot, 'frontend');

      if (!config.database || !config.database.host) {
        mergedConfig.database = projectDbConfig;
      }

      return mergedConfig;
    }
  } catch (error) {
    console.error('加载配置失败:', error);
  }
  
  // 返回包含项目数据库配置的默认配置
  return getDefaultConfig();
}

// 保存配置
function saveConfig(config) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('保存配置失败:', error);
    return false;
  }
}

// 创建窗口
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#f5f5f5',
    show: false // 先不显示，等加载完成后再显示
  });
  
  // 窗口加载完成后显示
  mainWindow.once('ready-to-show', () => {
    console.log('窗口准备就绪，显示窗口...');
    mainWindow.show();
    mainWindow.focus();
  });

  // 如果 3 秒后窗口仍未显示，强制显示
  setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      console.log('窗口未显示，强制显示...');
      mainWindow.show();
      mainWindow.focus();
    }
  }, FORCE_SHOW_DELAY);

  // 在打包后的应用中，需要正确处理文件路径
  let indexPath;
  if (app.isPackaged) {
    // 打包后的应用，index.html 在 app.asar 中
    indexPath = path.join(__dirname, 'index.html');
  } else {
    // 开发环境
    indexPath = path.join(__dirname, 'index.html');
  }
  
  console.log('应用是否已打包:', app.isPackaged);
  console.log('__dirname:', __dirname);
  console.log('app.getAppPath():', app.getAppPath());
  console.log('加载页面:', indexPath);
  console.log('文件是否存在:', fs.existsSync(indexPath));
  
  // 如果文件不存在，尝试其他路径
  if (!fs.existsSync(indexPath) && app.isPackaged) {
    // 尝试从 app.asar 外部加载
    const appPath = app.getAppPath();
    const possiblePaths = [
      path.join(path.dirname(appPath), 'index.html'),
      path.join(path.dirname(appPath), '..', 'index.html'),
      path.join(__dirname, '..', 'index.html')
    ];
    
    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        indexPath = possiblePath;
        console.log('找到备用路径:', indexPath);
        break;
      }
    }
  }
  
  mainWindow.loadFile(indexPath).catch((error) => {
    console.error('加载 index.html 失败:', error);
    console.error('尝试的路径:', indexPath);
    // 即使加载失败也显示窗口
    if (mainWindow) {
      mainWindow.show();
      // 尝试加载错误页面或显示错误信息
      mainWindow.webContents.send('error', { message: `加载页面失败: ${error.message}` });
    }
  });

  // 开发模式下打开开发者工具
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
  
  // 处理窗口错误
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('窗口加载失败:', errorCode, errorDescription);
  });
  
  mainWindow.webContents.on('crashed', () => {
    console.error('渲染进程崩溃');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 检查服务状态（仅检查端口）
function checkServiceStatus(port) {
  return new Promise((resolve) => {
    // 输入验证：确保端口是有效的数字
    const portNum = parseInt(port, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      resolve(false);
      return;
    }

    if (process.platform === 'win32') {
      // Windows 使用 netstat，使用数组形式避免命令注入
      exec(['netstat', '-ano'], (error, stdout) => {
        if (error) {
          resolve(false);
          return;
        }
        const lines = stdout.split('\n');
        const found = lines.some(line => line.includes(`:${portNum}`));
        resolve(found);
      });
    } else {
      // macOS/Linux 使用 lsof，使用数组形式避免命令注入
      exec(['lsof', '-ti:' + portNum], (error) => {
        resolve(!error);
      });
    }
  });
}

// 检查服务健康状态（通过HTTP请求）
async function checkServiceHealth(port, path = '/api/health') {
  return new Promise((resolve) => {
    const http = require('http');
    const options = {
      hostname: 'localhost',
      port: port,
      path: path,
      method: 'GET',
      timeout: HEALTH_CHECK_TIMEOUT
    };
    
    const req = http.request(options, (res) => {
      resolve(res.statusCode === 200 || res.statusCode === 404); // 404也算正常（可能是路由问题）
    });
    
    req.on('error', () => {
      resolve(false);
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    
    req.end();
  });
}

// 监控服务状态并自动重启
async function startMonitoring() {
  if (monitoringInterval) {
    return; // 已经在监控中
  }
  
  monitoringInterval = setInterval(async () => {
    if (!autoRestartEnabled) {
      return;
    }
    
    const config = loadConfig();
    
    // 检查后端服务
    const backendPortRunning = await checkServiceStatus(config.backend.port);
    const backendHealthy = backendPortRunning ? await checkServiceHealth(config.backend.port) : false;
    
    if (!backendPortRunning || !backendHealthy) {
      // 后端服务停止或异常
      if (backendProcess) {
        // 进程存在但服务不健康，可能是崩溃了
        console.log('检测到后端服务异常，准备重启...');
        backendProcess = null;
      }
      
      if (backendRestartCount < MAX_RESTART_COUNT) {
        backendRestartCount++;
        console.log(`自动重启后端服务 (${backendRestartCount}/${MAX_RESTART_COUNT})...`);
        
        if (mainWindow) {
          mainWindow.webContents.send('auto-restart', { service: 'backend', count: backendRestartCount });
        }
        
        // 等待一下再重启
        setTimeout(async () => {
          await startBackend(config);
          // 重置计数（如果成功启动）
          setTimeout(async () => {
            const isRunning = await checkServiceStatus(config.backend.port);
            if (isRunning) {
              backendRestartCount = 0;
            }
          }, 5000);
        }, RESTART_DELAY);
      } else {
        console.log('后端服务重启次数已达上限，停止自动重启');
        if (mainWindow && !backendFailedNotified) {
          mainWindow.webContents.send('auto-restart-failed', { service: 'backend' });
          backendFailedNotified = true;
        }
      }
    } else {
      // 服务正常，重置计数
      backendRestartCount = 0;
      backendFailedNotified = false;
    }
    
    // 检查前端服务（前端可能没有健康检查接口，只检查端口）
    const frontendPortRunning = await checkServiceStatus(config.frontend.port);
    
    if (!frontendPortRunning) {
      // 前端服务停止
      if (frontendProcess) {
        console.log('检测到前端服务异常，准备重启...');
        frontendProcess = null;
      }
      
      if (frontendRestartCount < MAX_RESTART_COUNT) {
        frontendRestartCount++;
        console.log(`自动重启前端服务 (${frontendRestartCount}/${MAX_RESTART_COUNT})...`);
        
        if (mainWindow) {
          mainWindow.webContents.send('auto-restart', { service: 'frontend', count: frontendRestartCount });
        }
        
        // 等待一下再重启
        setTimeout(async () => {
          await startFrontend(config);
          // 重置计数（如果成功启动）
          setTimeout(async () => {
            const isRunning = await checkServiceStatus(config.frontend.port);
            if (isRunning) {
              frontendRestartCount = 0;
            }
          }, 5000);
        }, RESTART_DELAY);
      } else {
        console.log('前端服务重启次数已达上限，停止自动重启');
        if (mainWindow && !frontendFailedNotified) {
          mainWindow.webContents.send('auto-restart-failed', { service: 'frontend' });
          frontendFailedNotified = true;
        }
      }
    } else {
      // 服务正常，重置计数
      frontendRestartCount = 0;
      frontendFailedNotified = false;
    }

    // 检查Redis服务
    const redisRunning = await checkRedisStatus();
    if (!redisRunning) {
      // Redis服务停止
      if (redisProcess) {
        console.log('检测到Redis服务异常，准备重启...');
        redisProcess = null;
      }
      
      if (redisRestartCount < MAX_RESTART_COUNT) {
        redisRestartCount++;
        console.log(`自动重启Redis服务 (${redisRestartCount}/${MAX_RESTART_COUNT})...`);
        
        if (mainWindow) {
          mainWindow.webContents.send('auto-restart', { service: 'redis', count: redisRestartCount });
        }
        
        // 等待一下再重启
        setTimeout(async () => {
          await startRedis();
          // 重置计数（如果成功启动）
          setTimeout(async () => {
            const isRunning = await checkRedisStatus();
            if (isRunning) {
              redisRestartCount = 0;
            }
          }, 5000);
        }, RESTART_DELAY);
      } else {
        console.log('Redis服务重启次数已达上限，停止自动重启');
        if (mainWindow && !redisFailedNotified) {
          mainWindow.webContents.send('auto-restart-failed', { service: 'redis' });
          redisFailedNotified = true;
        }
      }
    } else {
      // Redis服务正常，重置计数
      redisRestartCount = 0;
      redisFailedNotified = false;
    }
  }, MONITORING_INTERVAL);
}

// 检查Redis服务状态
async function checkRedisStatus() {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      exec(['netstat', '-ano'], (error, stdout) => {
        if (error) {
          resolve(false);
          return;
        }
        const lines = stdout.split('\n');
        const found = lines.some(line => line.includes(`:${REDIS_PORT}`));
        resolve(found);
      });
    } else {
      exec(['lsof', '-ti:' + REDIS_PORT], (error) => {
        resolve(!error);
      });
    }
  });
}

// 启动Redis服务
async function startRedis() {
  // 检查进程是否还在运行
  if (redisProcess) {
    try {
      // 检查进程是否真的在运行
      redisProcess.killed = redisProcess.killed || false;
      if (!redisProcess.killed && redisProcess.pid) {
        // 尝试发送信号检查进程是否存在
        try {
          process.kill(redisProcess.pid, 0); // 信号0用于检查进程是否存在
          return { success: false, message: 'Redis服务已在运行' };
        } catch (e) {
          // 进程不存在，清理引用
          console.log('Redis进程已不存在，清理引用');
          redisProcess = null;
        }
      } else {
        redisProcess = null;
      }
    } catch (e) {
      // 出错时清理引用
      redisProcess = null;
    }
  }

  return new Promise((resolve) => {
    console.log('启动Redis服务...');
    
    // 检查Redis是否已通过系统服务运行
    checkRedisStatus().then(isRunning => {
      if (isRunning) {
        resolve({ success: false, message: 'Redis服务已在运行' });
        return;
      }
      
      // 尝试从PATH中查找redis-server命令
      let redisCommand = 'redis-server';
      let useShell = false;
      
      if (process.platform === 'win32') {
        // Windows 上，redis-server.exe 可能不在PATH中
        useShell = true;
      } else {
        // macOS/Linux 上，尝试查找redis-server的完整路径
        try {
          const { execSync } = require('child_process');
          try {
            const redisFromPath = execSync('which redis-server', { encoding: 'utf8' }).trim();
            if (redisFromPath && fs.existsSync(redisFromPath)) {
              redisCommand = redisFromPath;
              console.log(`找到系统 redis-server: ${redisCommand}`);
            }
          } catch (e) {
            console.log('使用默认 redis-server 命令');
          }
        } catch (e) {
          console.log('使用默认 redis-server 命令');
        }
      }
      
      try {
        redisProcess = spawn(redisCommand, [], {
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: useShell
        });
        
        console.log(`Redis进程已启动，PID: ${redisProcess.pid}`);
        
        let output = '';
        redisProcess.stdout.on('data', (data) => {
          output += data.toString();
          if (mainWindow) {
            mainWindow.webContents.send('redis-log', data.toString());
          }
        });
        
        redisProcess.stderr.on('data', (data) => {
          output += data.toString();
          if (mainWindow) {
            mainWindow.webContents.send('redis-log', data.toString());
          }
        });
        
        redisProcess.on('exit', (code) => {
          console.log(`Redis服务退出，退出码: ${code}`);
          console.log(`输出内容: ${output}`);
          redisProcess = null;
          if (mainWindow) {
            mainWindow.webContents.send('redis-status', { running: false });
            mainWindow.webContents.send('redis-log', `服务已退出，退出码: ${code}\n`);
          }
        });
        
        redisProcess.on('error', (error) => {
          console.error('启动Redis服务失败:', error);
          const errorMsg = `启动失败: ${error.message}\n错误代码: ${error.code || '未知'}\n命令: ${redisCommand}`;
          if (mainWindow) {
            mainWindow.webContents.send('redis-log', `❌ ${errorMsg}\n`);
            mainWindow.webContents.send('redis-status', { running: false, error: errorMsg });
          }
          redisProcess = null;
          resolve({ success: false, message: errorMsg });
        });
        
        // 等待2秒检查是否成功启动
        setTimeout(async () => {
          const isRunning = await checkRedisStatus();
          if (isRunning) {
            if (mainWindow) {
              mainWindow.webContents.send('redis-status', { running: true });
            }
            resolve({ success: true, message: 'Redis服务启动成功' });
          } else {
            const errorMessage = `Redis服务启动失败。端口 ${REDIS_PORT} 未响应。\n进程状态: ${redisProcess?.killed ? '已退出' : '运行中'}\n退出码: ${redisProcess?.exitCode || '未知'}`;
            console.error(errorMessage);
            if (mainWindow) {
              mainWindow.webContents.send('redis-status', { running: false, error: errorMessage });
            }
            resolve({ success: false, message: errorMessage });
          }
        }, 2000);
      } catch (spawnError) {
        console.error('启动Redis进程失败:', spawnError);
        const errorMsg = `启动进程失败: ${spawnError.message}`;
        if (mainWindow) {
          mainWindow.webContents.send('redis-status', { running: false, error: errorMsg });
        }
        resolve({ success: false, message: errorMsg });
      }
    });
  });
}

// 停止Redis服务
function stopRedis() {
  return new Promise((resolve) => {
    if (redisProcess) {
      redisProcess.kill();
      redisProcess = null;
      setTimeout(() => {
        if (mainWindow) {
          mainWindow.webContents.send('redis-status', { running: false });
        }
        resolve({ success: true, message: 'Redis服务已停止' });
      }, STOP_TIMEOUT);
    } else {
      // 尝试通过端口杀死进程
      if (process.platform === 'win32') {
        // Windows: 先获取进程ID，再杀死
        exec(['netstat', '-ano'], (error, stdout) => {
          if (!error) {
            const lines = stdout.split('\n');
            for (const line of lines) {
              if (line.includes(`:${REDIS_PORT}`)) {
                const parts = line.trim().split(/\s+/);
                const pid = parts[parts.length - 1];
                if (pid && !isNaN(parseInt(pid))) {
                  exec(['taskkill', '/F', '/PID', pid], () => {});
                }
              }
            }
          }
          if (mainWindow) {
            mainWindow.webContents.send('redis-status', { running: false });
          }
          resolve({ success: true, message: 'Redis服务已停止' });
        });
      } else {
        // macOS/Linux 使用 lsof 获取 PID 再 kill
        exec(['lsof', '-ti:' + REDIS_PORT], (error, stdout) => {
          if (!error && stdout.trim()) {
            const pids = stdout.trim().split('\n');
            for (const pid of pids) {
              if (pid && !isNaN(parseInt(pid))) {
                try {
                  process.kill(parseInt(pid), 'SIGKILL');
                } catch (e) {
                  // 忽略错误
                }
              }
            }
          }
          if (mainWindow) {
            mainWindow.webContents.send('redis-status', { running: false });
          }
          resolve({ success: true, message: 'Redis服务已停止' });
        });
      }
    }
  });
}

// 停止监控
function stopMonitoring() {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
  }
}

// 启动后端服务
async function startBackend(config) {
  // 检查进程是否还在运行
  if (backendProcess) {
    try {
      // 检查进程是否真的在运行
      backendProcess.killed = backendProcess.killed || false;
      if (!backendProcess.killed && backendProcess.pid) {
        // 尝试发送信号检查进程是否存在
        try {
          process.kill(backendProcess.pid, 0); // 信号0用于检查进程是否存在
          return { success: false, message: '后端服务已在运行' };
        } catch (e) {
          // 进程不存在，清理引用
          console.log('后端进程已不存在，清理引用');
          backendProcess = null;
        }
      } else {
        backendProcess = null;
      }
    } catch (e) {
      // 出错时清理引用
      backendProcess = null;
    }
  }

  return new Promise((resolve) => {
    const projectRoot = getProjectRoot();
    const backendPath = config.backend?.path || path.join(projectRoot, 'backend');
    
    // 检查路径是否存在
    if (!fs.existsSync(backendPath)) {
      console.error(`后端目录不存在: ${backendPath}`);
      console.error(`项目根目录: ${projectRoot}`);
      console.error(`配置中的路径: ${config.backend?.path}`);
      resolve({ success: false, message: `后端目录不存在: ${backendPath}\n项目根目录: ${projectRoot}` });
      return;
    }
    
    const env = {
      ...process.env,
      PORT: String(config.backend.port),
      HOST: config.backend.host,
      SERVER_HOST: config.backend.host,
      FRONTEND_PORT: String(config.frontend.port),
      FRONTEND_URL: `http://localhost:${config.frontend.port}`,
      // 根据模式设置 NODE_ENV
      NODE_ENV: config.mode || 'development'
    };
    
    // 添加数据库环境变量
    if (config.database) {
      env.DB_HOST = config.database.host;
      env.DB_PORT = config.database.port;
      env.DB_USER = config.database.user;
      env.DB_PASSWORD = config.database.password;
      env.DB_NAME = config.database.database;
    }

    console.log(`启动后端服务: ${backendPath}`);
    console.log(`环境变量 PORT: ${env.PORT}, HOST: ${env.HOST}`);
    if (config.database) {
      console.log(`数据库配置: ${config.database.host}:${config.database.port}/${config.database.database}`);
    }
    
    // 使用系统的 node 命令，而不是 Electron 的 node
    let nodeCommand = 'node';
    
    if (process.platform === 'win32') {
      // Windows 上，直接使用 'node' 命令，让 shell 自动解析
      // 不需要查找完整路径，shell 会自动找到 node.exe
      nodeCommand = 'node';
      console.log('Windows 平台，使用 node 命令（shell 自动解析）');
    } else {
      // macOS/Linux 上，尝试查找 node 的完整路径
      try {
        const { execSync } = require('child_process');
        try {
          const nodeFromPath = execSync('which node', { encoding: 'utf8' }).trim();
          if (nodeFromPath && fs.existsSync(nodeFromPath)) {
            nodeCommand = nodeFromPath;
            console.log(`找到系统 node: ${nodeCommand}`);
          } else {
            console.log('使用默认 node 命令（未找到系统 node）');
          }
        } catch (e) {
          console.log('使用默认 node 命令（查找 node 失败）');
        }
      } catch (e) {
        console.log('使用默认 node 命令（异常）');
      }
    }
    
    console.log(`使用 node 命令: ${nodeCommand}`);
    console.log(`工作目录: ${backendPath}`);
    
    // 检查工作目录是否存在
    if (!fs.existsSync(backendPath)) {
      const errorMsg = `后端目录不存在: ${backendPath}`;
      console.error(errorMsg);
      if (mainWindow) {
        mainWindow.webContents.send('backend-log', `❌ ${errorMsg}\n`);
        mainWindow.webContents.send('backend-status', { running: false, error: errorMsg });
      }
      resolve({ success: false, message: errorMsg });
      return;
    }
    
    // 检查 server.js 是否存在
    const serverJsPath = path.join(backendPath, 'server.js');
    if (!fs.existsSync(serverJsPath)) {
      const errorMsg = `后端 server.js 不存在: ${serverJsPath}`;
      console.error(errorMsg);
      if (mainWindow) {
        mainWindow.webContents.send('backend-log', `❌ ${errorMsg}\n`);
        mainWindow.webContents.send('backend-status', { running: false, error: errorMsg });
      }
      resolve({ success: false, message: errorMsg });
      return;
    }
    
    try {
      // Windows 上需要使用 shell: true 来正确执行 node 命令
      // 确保 PATH 环境变量包含 Node.js 的路径
      if (process.platform === 'win32') {
        // 确保 PATH 包含常见的 Node.js 安装路径
        const nodePaths = [
          path.join(process.env.ProgramFiles || 'C:\\Program Files', 'nodejs'),
          path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'nodejs'),
          path.join(process.env.APPDATA || '', 'npm'),
          path.join(process.env.LOCALAPPDATA || '', 'npm')
        ];
        
        const existingPath = env.PATH || env.Path || '';
        const additionalPaths = nodePaths
          .filter(p => fs.existsSync(p))
          .join(path.delimiter);
        
        if (additionalPaths) {
          env.PATH = existingPath ? `${existingPath}${path.delimiter}${additionalPaths}` : additionalPaths;
          env.Path = env.PATH; // Windows 上 PATH 和 Path 都需要设置
        }
        
        console.log(`环境变量 PATH: ${env.PATH ? env.PATH.substring(0, 200) + '...' : '未设置'}`);
        
        backendProcess = spawn('node', ['server.js'], {
          cwd: backendPath,
          env: env,
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: true // Windows 上必须使用 shell
        });
      } else {
        backendProcess = spawn(nodeCommand, ['server.js'], {
          cwd: backendPath,
          env: env,
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: false
        });
      }
      
      console.log(`后端进程已启动，PID: ${backendProcess.pid}`);
    } catch (spawnError) {
      console.error('启动后端进程失败:', spawnError);
      resolve({ success: false, message: `启动进程失败: ${spawnError.message}` });
      return;
    }

    let output = '';
    backendProcess.stdout.on('data', (data) => {
      output += data.toString();
      if (mainWindow) {
        mainWindow.webContents.send('backend-log', data.toString());
      }
    });

    backendProcess.stderr.on('data', (data) => {
      output += data.toString();
      if (mainWindow) {
        mainWindow.webContents.send('backend-log', data.toString());
      }
    });

    backendProcess.on('exit', (code) => {
      console.log(`后端服务退出，退出码: ${code}`);
      console.log(`输出内容: ${output}`);
      backendProcess = null;
      if (mainWindow) {
        mainWindow.webContents.send('backend-status', { running: false });
        mainWindow.webContents.send('backend-log', `服务已退出，退出码: ${code}\n`);
      }
    });
    
    backendProcess.on('error', (error) => {
      console.error('启动后端服务失败:', error);
      console.error('错误详情:', error.stack);
      const errorMsg = `启动失败: ${error.message}\n错误代码: ${error.code || '未知'}\n命令: ${nodeCommand} server.js\n工作目录: ${backendPath}`;
      if (mainWindow) {
        mainWindow.webContents.send('backend-log', `❌ ${errorMsg}\n`);
        mainWindow.webContents.send('backend-status', { running: false, error: errorMsg });
      }
      backendProcess = null;
      resolve({ success: false, message: errorMsg });
    });

    // 等待几秒检查是否成功启动
    setTimeout(async () => {
      // 检查进程是否还在运行
      if (!backendProcess || backendProcess.killed) {
        const errorMessage = `后端进程已退出。退出码: ${backendProcess?.exitCode || '未知'}\n输出: ${output.substring(0, 500)}`;
        console.error(errorMessage);
        if (mainWindow) {
          mainWindow.webContents.send('backend-status', { running: false, error: errorMessage });
        }
        resolve({ success: false, message: errorMessage });
        return;
      }
      
      const isRunning = await checkServiceStatus(config.backend.port);
      // 只要端口运行就认为启动成功（健康检查作为辅助，不强制）
      if (isRunning) {
        if (mainWindow) {
          mainWindow.webContents.send('backend-status', { running: true });
        }
        resolve({ success: true, message: '后端服务启动成功' });
      } else {
        // 如果端口未运行，但进程还在，可能是启动中或配置错误
        const errorMessage = `后端服务启动失败。端口 ${config.backend.port} 未响应。\n进程状态: ${backendProcess.killed ? '已退出' : '运行中'}\n退出码: ${backendProcess?.exitCode || '未知'}\n输出: ${output.substring(0, 500)}`;
        console.error(errorMessage);
        if (mainWindow) {
          mainWindow.webContents.send('backend-status', { running: false, error: errorMessage });
        }
        resolve({ success: false, message: errorMessage });
      }
    }, STARTUP_TIMEOUT);
  });
}

// 停止后端服务
function stopBackend() {
  return new Promise((resolve) => {
    if (backendProcess) {
      backendProcess.kill();
      backendProcess = null;
      setTimeout(() => {
        if (mainWindow) {
          mainWindow.webContents.send('backend-status', { running: false });
        }
        resolve({ success: true, message: '后端服务已停止' });
      }, STOP_TIMEOUT);
    } else {
      // 尝试通过端口杀死进程
      const config = loadConfig();
      const port = config.backend.port;
      if (process.platform === 'win32') {
        exec(['netstat', '-ano'], (error, stdout) => {
          if (!error) {
            const lines = stdout.split('\n');
            for (const line of lines) {
              if (line.includes(`:${port}`)) {
                const parts = line.trim().split(/\s+/);
                const pid = parts[parts.length - 1];
                if (pid && !isNaN(parseInt(pid))) {
                  exec(['taskkill', '/F', '/PID', pid], () => {});
                }
              }
            }
          }
          if (mainWindow) {
            mainWindow.webContents.send('backend-status', { running: false });
          }
          resolve({ success: true, message: '后端服务已停止' });
        });
      } else {
        exec(['lsof', '-ti:' + port], (error, stdout) => {
          if (!error && stdout.trim()) {
            const pids = stdout.trim().split('\n');
            for (const pid of pids) {
              if (pid && !isNaN(parseInt(pid))) {
                try {
                  process.kill(parseInt(pid), 'SIGKILL');
                } catch (e) {
                  // 忽略错误
                }
              }
            }
          }
          if (mainWindow) {
            mainWindow.webContents.send('backend-status', { running: false });
          }
          resolve({ success: true, message: '后端服务已停止' });
        });
      }
    }
  });
}

// 启动前端服务
async function startFrontend(config) {
  // 检查进程是否还在运行
  if (frontendProcess) {
    try {
      // 检查进程是否真的在运行
      frontendProcess.killed = frontendProcess.killed || false;
      if (!frontendProcess.killed && frontendProcess.pid) {
        // 尝试发送信号检查进程是否存在
        try {
          process.kill(frontendProcess.pid, 0); // 信号0用于检查进程是否存在
          return { success: false, message: '前端服务已在运行' };
        } catch (e) {
          // 进程不存在，清理引用
          console.log('前端进程已不存在，清理引用');
          frontendProcess = null;
        }
      } else {
        frontendProcess = null;
      }
    } catch (e) {
      // 出错时清理引用
      frontendProcess = null;
    }
  }

  return new Promise((resolve) => {
    const projectRoot = getProjectRoot();
    const frontendPath = config.frontend?.path || path.join(projectRoot, 'frontend');
    
    // 检查路径是否存在
    if (!fs.existsSync(frontendPath)) {
      console.error(`前端目录不存在: ${frontendPath}`);
      console.error(`项目根目录: ${projectRoot}`);
      console.error(`配置中的路径: ${config.frontend?.path}`);
      resolve({ success: false, message: `前端目录不存在: ${frontendPath}\n项目根目录: ${projectRoot}` });
      return;
    }
    
    // 检查 package.json 是否存在
    const packageJsonPath = path.join(frontendPath, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      console.error(`package.json 不存在: ${packageJsonPath}`);
      resolve({ success: false, message: `前端 package.json 不存在: ${packageJsonPath}` });
      return;
    }
    
    console.log(`启动前端服务: ${frontendPath}`);
    console.log(`前端端口: ${config.frontend.port}`);
    
    // 查找 npm 命令
    let npmCommand = 'npm';
    let useShell = false;
    
    if (process.platform === 'win32') {
      // Windows 上，npm 是一个 .cmd 文件，需要使用 cmd.exe 来执行
      // 或者直接使用 npm.cmd，或者使用 shell: true
      try {
        const { execSync } = require('child_process');
        try {
          // 尝试查找 npm.cmd
          const npmCmdPath = execSync('where npm.cmd', { encoding: 'utf8' }).trim().split('\n')[0];
          if (npmCmdPath && fs.existsSync(npmCmdPath)) {
            npmCommand = npmCmdPath;
            console.log(`找到系统 npm.cmd: ${npmCommand}`);
          } else {
            // 如果找不到 npm.cmd，尝试查找 npm
            const npmPath = execSync('where npm', { encoding: 'utf8' }).trim().split('\n')[0];
            if (npmPath && fs.existsSync(npmPath)) {
              npmCommand = npmPath;
              console.log(`找到系统 npm: ${npmCommand}`);
            }
          }
        } catch (e) {
          console.log('使用默认 npm 命令');
        }
      } catch (e) {
        console.log('使用默认 npm 命令');
      }
      // Windows 上必须使用 shell: true
      useShell = true;
    } else {
      // macOS/Linux
      try {
        const { execSync } = require('child_process');
        try {
          const npmFromPath = execSync('which npm', { encoding: 'utf8' }).trim();
          if (npmFromPath && fs.existsSync(npmFromPath)) {
            npmCommand = npmFromPath;
            console.log(`找到系统 npm: ${npmCommand}`);
          }
        } catch (e) {
          console.log('使用默认 npm 命令');
        }
      } catch (e) {
        console.log('使用默认 npm 命令');
      }
      useShell = false;
    }
    
    console.log(`使用 npm 命令: ${npmCommand}`);
    console.log(`工作目录: ${frontendPath}`);
    console.log(`使用 shell: ${useShell}`);
    
    // 检查工作目录是否存在
    if (!fs.existsSync(frontendPath)) {
      const errorMsg = `前端目录不存在: ${frontendPath}`;
      console.error(errorMsg);
      if (mainWindow) {
        mainWindow.webContents.send('frontend-log', `❌ ${errorMsg}\n`);
        mainWindow.webContents.send('frontend-status', { running: false, error: errorMsg });
      }
      resolve({ success: false, message: errorMsg });
      return;
    }
    
    // 生产模式需要先检查是否已构建
    if (config.mode === 'production') {
      const distPath = path.join(frontendPath, 'dist');
      if (!fs.existsSync(distPath)) {
        const errorMsg = '❌ 生产模式需要先构建前端代码！\n请运行: cd frontend && npm run build';
        console.error(errorMsg);
        if (mainWindow) {
          mainWindow.webContents.send('frontend-log', `${errorMsg}\n`);
          mainWindow.webContents.send('frontend-status', { running: false, error: errorMsg });
        }
        resolve({ success: false, message: errorMsg });
        return;
      }
      console.log('✅ 生产模式：检测到 dist 目录存在');
    }
    
    try {
      // Windows 上需要使用 shell: true 来正确执行 npm 命令
      // 在 Windows 上，npm 是 .cmd 文件，需要 shell 来执行
      if (process.platform === 'win32') {
        // Windows 上，直接使用 'npm' 命令，让 shell 自动解析
        // 确保 PATH 环境变量包含 Node.js 的路径
        const env = {
          ...process.env,
          PORT: String(config.frontend.port),
          FRONTEND_PORT: String(config.frontend.port),
          VITE_FRONTEND_PORT: String(config.frontend.port),
          VITE_BIND_HOST: config.frontend.host,
          BACKEND_URL: `http://localhost:${config.backend.port}`,
          VITE_BACKEND_URL: `http://localhost:${config.backend.port}`
        };
        
        // 确保 PATH 包含常见的 Node.js 安装路径
        const nodePaths = [
          path.join(process.env.ProgramFiles || 'C:\\Program Files', 'nodejs'),
          path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'nodejs'),
          path.join(process.env.APPDATA || '', 'npm'),
          path.join(process.env.LOCALAPPDATA || '', 'npm')
        ];
        
        const existingPath = env.PATH || env.Path || '';
        const additionalPaths = nodePaths
          .filter(p => fs.existsSync(p))
          .join(path.delimiter);
        
        if (additionalPaths) {
          env.PATH = existingPath ? `${existingPath}${path.delimiter}${additionalPaths}` : additionalPaths;
          env.Path = env.PATH; // Windows 上 PATH 和 Path 都需要设置
        }
        
        console.log(`环境变量 PATH: ${env.PATH ? env.PATH.substring(0, 200) + '...' : '未设置'}`);
        
        // 根据模式选择启动命令
        const frontendCommand = config.mode === 'production' ? 'preview' : 'dev';
        frontendProcess = spawn(
          'npm',
          [
            'run',
            frontendCommand,
            '--',
            '--host',
            config.frontend.host,
            '--port',
            String(config.frontend.port),
            '--strictPort',
          ],
          {
          cwd: frontendPath,
          env: env,
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: true // Windows 上必须使用 shell
          }
        );
      } else {
        // 根据模式选择启动命令
        const frontendCommand = config.mode === 'production' ? 'preview' : 'dev';
        frontendProcess = spawn(
          npmCommand,
          [
            'run',
            frontendCommand,
            '--',
            '--host',
            config.frontend.host,
            '--port',
            String(config.frontend.port),
            '--strictPort',
          ],
          {
          cwd: frontendPath,
          env: {
            ...process.env,
            PORT: String(config.frontend.port),
            FRONTEND_PORT: String(config.frontend.port),
            VITE_FRONTEND_PORT: config.frontend.port.toString(),
            VITE_BIND_HOST: config.frontend.host,
            BACKEND_URL: `http://localhost:${config.backend.port}`,
            VITE_BACKEND_URL: `http://localhost:${config.backend.port}`
          },
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: false
          }
        );
      }
      
      console.log(`前端进程已启动，PID: ${frontendProcess.pid}`);
    } catch (spawnError) {
      console.error('启动前端进程失败:', spawnError);
      resolve({ success: false, message: `启动进程失败: ${spawnError.message}` });
      return;
    }

    let output = '';
    frontendProcess.stdout.on('data', (data) => {
      output += data.toString();
      if (mainWindow) {
        mainWindow.webContents.send('frontend-log', data.toString());
      }
    });

    frontendProcess.stderr.on('data', (data) => {
      output += data.toString();
      if (mainWindow) {
        mainWindow.webContents.send('frontend-log', data.toString());
      }
    });

    frontendProcess.on('exit', (code) => {
      console.log(`前端服务退出，退出码: ${code}`);
      console.log(`输出内容: ${output}`);
      frontendProcess = null;
      if (mainWindow) {
        mainWindow.webContents.send('frontend-status', { running: false });
        mainWindow.webContents.send('frontend-log', `服务已退出，退出码: ${code}\n`);
      }
    });
    
    frontendProcess.on('error', (error) => {
      console.error('启动前端服务失败:', error);
      console.error('错误详情:', error.stack);
      const errorMsg = `启动失败: ${error.message}\n错误代码: ${error.code || '未知'}\n命令: ${npmCommand} run dev\n工作目录: ${frontendPath}`;
      if (mainWindow) {
        mainWindow.webContents.send('frontend-log', `❌ ${errorMsg}\n`);
        mainWindow.webContents.send('frontend-status', { running: false, error: errorMsg });
      }
      frontendProcess = null;
      resolve({ success: false, message: errorMsg });
    });

    // 等待几秒检查是否成功启动
    setTimeout(async () => {
      // 检查进程是否还在运行
      if (!frontendProcess || frontendProcess.killed) {
        const errorMessage = `前端进程已退出。退出码: ${frontendProcess?.exitCode || '未知'}\n输出: ${output.substring(0, 500)}`;
        console.error(errorMessage);
        if (mainWindow) {
          mainWindow.webContents.send('frontend-status', { running: false, error: errorMessage });
        }
        resolve({ success: false, message: errorMessage });
        return;
      }
      
      const isRunning = await checkServiceStatus(config.frontend.port);
      if (isRunning) {
        if (mainWindow) {
          mainWindow.webContents.send('frontend-status', { running: true });
        }
        resolve({ success: true, message: '前端服务启动成功' });
      } else {
        // 如果端口未运行，但进程还在，可能是启动中或配置错误
        const errorMessage = `前端服务启动失败。端口 ${config.frontend.port} 未响应。\n进程状态: ${frontendProcess.killed ? '已退出' : '运行中'}\n退出码: ${frontendProcess?.exitCode || '未知'}\n输出: ${output.substring(0, 500)}`;
        console.error(errorMessage);
        if (mainWindow) {
          mainWindow.webContents.send('frontend-status', { running: false, error: errorMessage });
        }
        resolve({ success: false, message: errorMessage });
      }
    }, 5000);
  });
}

// 停止前端服务
function stopFrontend() {
  return new Promise((resolve) => {
    if (frontendProcess) {
      try {
        if (frontendProcess.pid) {
          // 先尝试正常终止
          frontendProcess.kill('SIGTERM');
          // 如果3秒后还在运行，强制终止
          setTimeout(() => {
            if (frontendProcess && frontendProcess.pid) {
              try {
                process.kill(frontendProcess.pid, 'SIGKILL');
              } catch (e) {
                // 忽略错误
              }
            }
          }, STARTUP_TIMEOUT);
        }
      } catch (e) {
        console.error('停止前端进程时出错:', e);
      }
      frontendProcess = null;
      setTimeout(() => {
        if (mainWindow) {
          mainWindow.webContents.send('frontend-status', { running: false });
        }
        resolve({ success: true, message: '前端服务已停止' });
      }, STOP_TIMEOUT);
    } else {
      // 尝试通过端口杀死进程
      const config = loadConfig();
      let killCommand;
      if (process.platform === 'win32') {
        // Windows 使用 netstat 和 taskkill
        killCommand = `for /f "tokens=5" %a in ('netstat -ano ^| findstr :${config.frontend.port}') do taskkill /F /PID %a 2>nul`;
      } else {
        // macOS/Linux 使用 lsof 和 kill
        killCommand = `lsof -ti:${config.frontend.port} | xargs kill -9 2>/dev/null`;
      }
      exec(killCommand, { shell: true }, (error) => {
        if (mainWindow) {
          mainWindow.webContents.send('frontend-status', { running: false });
        }
        resolve({ success: true, message: '前端服务已停止' });
      });
    }
  });
}

// 错误处理
process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error);
  if (mainWindow) {
    mainWindow.webContents.send('error', { message: error.message, stack: error.stack });
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的 Promise 拒绝:', reason);
  if (mainWindow) {
    mainWindow.webContents.send('error', { message: String(reason) });
  }
});

// IPC 通信处理
app.whenReady().then(() => {
  try {
    createWindow();
  } catch (error) {
    console.error('创建窗口失败:', error);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  // 获取配置
  ipcMain.handle('get-config', () => {
    try {
      return loadConfig();
    } catch (error) {
      console.error('获取配置失败:', error);
      return getDefaultConfig();
    }
  });
  
  // 获取项目根目录
  ipcMain.handle('get-project-root', () => {
    try {
      const projectRoot = getProjectRoot();
      const backendPath = path.join(projectRoot, 'backend');
      const frontendPath = path.join(projectRoot, 'frontend');
      const backendExists = fs.existsSync(backendPath);
      const frontendExists = fs.existsSync(frontendPath);
      const serverJsExists = fs.existsSync(path.join(backendPath, 'server.js'));
      const frontendPackageExists = fs.existsSync(path.join(frontendPath, 'package.json'));
      
      return { 
        success: true, 
        path: projectRoot,
        backendPath: backendPath,
        frontendPath: frontendPath,
        backendExists: backendExists,
        frontendExists: frontendExists,
        serverJsExists: serverJsExists,
        frontendPackageExists: frontendPackageExists,
        isPackaged: app.isPackaged,
        appPath: app.getAppPath(),
        cwd: process.cwd()
      };
    } catch (error) {
      console.error('获取项目根目录失败:', error);
      return { success: false, message: error.message };
    }
  });

  // 保存配置
  ipcMain.handle('save-config', (event, config) => {
    const result = saveConfig(config);
    if (result) {
      // 同时更新后端的 .env 文件
      updateBackendEnv(config.database);
    }
    return result;
  });

  // 测试数据库连接
  ipcMain.handle('test-db-connection', async (event, dbConfig) => {
    try {
      // 动态加载 mysql2
      let mysql;
      try {
        // 首先尝试正常加载
        mysql = require('mysql2/promise');
      } catch (requireError) {
        // 如果失败，尝试从解压的 asar 中加载
        try {
          const unpackedPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'mysql2');
          if (fs.existsSync(unpackedPath)) {
            // 从解压路径加载
            mysql = require(path.join(unpackedPath, 'promise'));
          } else {
            // 尝试从当前目录的 node_modules 加载（开发模式）
            const localPath = path.join(__dirname, 'node_modules', 'mysql2', 'promise');
            if (fs.existsSync(localPath)) {
              mysql = require(localPath);
            } else {
              throw new Error('mysql2 模块未找到。请重新构建应用或安装依赖：npm install mysql2');
            }
          }
        } catch (unpackedError) {
          throw new Error(`无法加载 mysql2 模块: ${requireError.message}`);
        }
      }
      
      const connection = await mysql.createConnection({
        host: dbConfig.host,
        port: dbConfig.port,
        user: dbConfig.user,
        password: dbConfig.password,
        database: dbConfig.database,
        connectTimeout: 5000
      });
      await connection.ping();
      await connection.end();
      return { success: true, message: '数据库连接成功！' };
    } catch (error) {
      return { success: false, message: `数据库连接失败: ${error.message}` };
    }
  });

  // 启动后端
  ipcMain.handle('start-backend', async () => {
    try {
      const config = loadConfig();
      return await startBackend(config);
    } catch (error) {
      console.error('启动后端失败:', error);
      return { success: false, message: `启动失败: ${error.message}` };
    }
  });

  // 停止后端
  ipcMain.handle('stop-backend', async () => {
    return await stopBackend();
  });

  // 重启后端
  ipcMain.handle('restart-backend', async () => {
    await stopBackend();
    await new Promise(resolve => setTimeout(resolve, RESTART_DELAY));
    const config = loadConfig();
    return await startBackend(config);
  });

  // 启动前端
  ipcMain.handle('start-frontend', async () => {
    try {
      const config = loadConfig();
      return await startFrontend(config);
    } catch (error) {
      console.error('启动前端失败:', error);
      return { success: false, message: `启动失败: ${error.message}` };
    }
  });

  // 停止前端
  ipcMain.handle('stop-frontend', async () => {
    return await stopFrontend();
  });

  // 重启前端
  ipcMain.handle('restart-frontend', async () => {
    await stopFrontend();
    await new Promise(resolve => setTimeout(resolve, RESTART_DELAY));
    const config = loadConfig();
    return await startFrontend(config);
  });

  // 检查服务状态
  ipcMain.handle('check-status', async () => {
    const config = loadConfig();
    const backendPortRunning = await checkServiceStatus(config.backend.port);
    const frontendPortRunning = await checkServiceStatus(config.frontend.port);
    const redisRunning = await checkRedisStatus();
    
    // 对于后端，需要同时检查端口和健康状态
    let backendHealthy = false;
    if (backendPortRunning) {
      backendHealthy = await checkServiceHealth(config.backend.port);
    }
    
    // 如果端口运行但健康检查失败，仍然认为服务在运行（可能是刚启动）
    const backendStatus = backendPortRunning;
    const frontendStatus = frontendPortRunning;
    
    // 发送状态更新事件
    if (mainWindow) {
      mainWindow.webContents.send('backend-status', { running: backendStatus });
      mainWindow.webContents.send('frontend-status', { running: frontendStatus });
      mainWindow.webContents.send('redis-status', { running: redisRunning });
    }
    
    return {
      backend: backendStatus,
      frontend: frontendStatus,
      redis: redisRunning
    };
  });
  
  // 启动Redis服务
  ipcMain.handle('start-redis', async () => {
    try {
      return await startRedis();
    } catch (error) {
      console.error('启动Redis失败:', error);
      return { success: false, message: `启动失败: ${error.message}` };
    }
  });
  
  // 停止Redis服务
  ipcMain.handle('stop-redis', async () => {
    return await stopRedis();
  });
  
  // 重启Redis服务
  ipcMain.handle('restart-redis', async () => {
    await stopRedis();
    await new Promise(resolve => setTimeout(resolve, RESTART_DELAY));
    return await startRedis();
  });

  // 启用/禁用自动重启
  ipcMain.handle('set-auto-restart', (event, enabled) => {
    autoRestartEnabled = enabled;
    if (enabled) {
      startMonitoring();
    } else {
      stopMonitoring();
    }
    return { success: true };
  });

  // 获取自动重启状态
  ipcMain.handle('get-auto-restart-status', () => {
    return {
      enabled: autoRestartEnabled,
      backendRestartCount: backendRestartCount,
      frontendRestartCount: frontendRestartCount
    };
  });
});

app.on('window-all-closed', () => {
  // 停止所有服务
  if (backendProcess) {
    backendProcess.kill();
  }
  if (frontendProcess) {
    frontendProcess.kill();
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // 停止所有服务
  if (backendProcess) {
    backendProcess.kill();
  }
  if (frontendProcess) {
    frontendProcess.kill();
  }
  if (redisProcess) {
    redisProcess.kill();
  }
});
