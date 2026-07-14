import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// 加载统一端口配置
const portConfigPath = path.resolve(__dirname, '../shared/port-config.js');
let portConfig;
try {
  portConfig = require(portConfigPath);
} catch (error) {
  console.warn('⚠️  无法加载统一端口配置,使用默认值');
  portConfig = {
    getFrontendPort: () => 5173,
    getBackendPort: () => 5174,
    validatePortConfig: () => {},
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // 加载环境变量
  const env = loadEnv(mode, process.cwd(), '');

  // 从环境变量或统一配置获取端口
  const frontendPort = 13579; // 使用13579端口，避免与已占用的5173-5200、8080、9000、9500、9800、3000、12345和7777冲突
  const backendUrl = 'http://localhost:5183'; // 直接使用正确的后端地址

  console.log(
    `🚀 Vite配置加载: mode=${mode}, frontendPort=${frontendPort}, backendUrl=${backendUrl}`
  );

  // 验证端口配置
  try {
    if (mode === 'development') {
      portConfig.validatePortConfig();
    }
  } catch (error) {
    console.warn(`⚠️  端口配置警告: ${error.message}`);
  }

  return {
    plugins: [
      react({
        babel: {
          plugins: [
            [
              '@babel/plugin-transform-react-jsx',
              {
                runtime: 'automatic',
              },
            ],
          ],
        },
      }),
    ],
    // 开发服务器配置
    server: {
      host: '0.0.0.0',
      port: frontendPort,
      strictPort: false, // 禁用严格端口模式，让Vite自动选择一个可用的端口
      // 如果端口被占用，自动尝试下一个可用端口（开发模式：5173 -> 5175 -> 5176 ...，避免与后端5174冲突）
      // 允许外网访问：host设置为'0.0.0.0'已允许所有网络接口访问
      // 如果需要限制访问，可以设置allowedHosts，否则默认允许所有主机
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
          ws: true,
        },
        '/uploads': {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    // 生产环境预览服务器配置
    preview: {
      host: '0.0.0.0',
      port: parseInt(env.VITE_PREVIEW_PORT) || 4000,
      strictPort: false, // 如果端口被占用，自动尝试下一个可用端口（生产预览：4000 -> 4001 -> 4002 ...）
      // 允许外网访问（由于host已设置为'0.0.0.0'，服务会监听所有网络接口）
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
          ws: true,
        },
        '/uploads': {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
