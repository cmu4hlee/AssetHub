import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import net from 'node:net';

const parsePort = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const parseCsv = value =>
  String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

const shouldAllowAllHosts = value => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  return normalized === '*' || normalized === 'true';
};

const DEFAULT_PROXY_TIMEOUT_MS = 30 * 1000;
const LONG_RUNNING_API_PROXY_TIMEOUT_MS = 10 * 60 * 1000;

const normalizeProxyTarget = value => {
  if (!value) {
    return 'http://127.0.0.1:5183';
  }

  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}`;
  } catch (_error) {
    return String(value).replace(/\/api\/?$/, '').replace(/\/$/, '');
  }
};

const extractHost = value => {
  if (!value) {
    return '';
  }

  try {
    return new URL(value).host;
  } catch (_error) {
    return String(value)
      .replace(/^[a-z]+:\/\//i, '')
      .replace(/\/.*$/, '')
      .trim();
  }
};

const createProxyConfig = target => {
  const handleProxyReq = (proxyReq, req) => {
    const timestamp = new Date().toISOString();
    console.log(`[Vite Proxy] ${timestamp} ${req.method} ${req.url} -> ${proxyReq.path}`);
  };

  const baseProxyOptions = {
    changeOrigin: true,
    secure: false,
    onProxyReq: handleProxyReq,
  };

  return {
  '/api/health': {
    ...baseProxyOptions,
    target,
    timeout: DEFAULT_PROXY_TIMEOUT_MS,
    proxyTimeout: DEFAULT_PROXY_TIMEOUT_MS,
  },
  '/api': {
    ...baseProxyOptions,
    target,
    ws: true,
    timeout: LONG_RUNNING_API_PROXY_TIMEOUT_MS,
    proxyTimeout: LONG_RUNNING_API_PROXY_TIMEOUT_MS,
  },
  '/socket.io': {
    ...baseProxyOptions,
    target,
    ws: true,
    timeout: DEFAULT_PROXY_TIMEOUT_MS,
    proxyTimeout: DEFAULT_PROXY_TIMEOUT_MS,
  },
  '/uploads': {
    ...baseProxyOptions,
    target,
    timeout: DEFAULT_PROXY_TIMEOUT_MS,
    proxyTimeout: DEFAULT_PROXY_TIMEOUT_MS,
  },
};};

/**
 * Vite 6 http-proxy 在转发 socket.io WebSocket upgrade 时存在已知问题：
 * 浏览器会间歇性报 "WebSocket is closed before the connection is established"，
 * 表现为 dashboard 正常、risk/classification 失败。
 * 根因是 Vite 内置的 http-proxy 在 upgrade 阶段偶发 ECONNRESET
 * （vite.log 中可见 "ws proxy socket error: Error: read ECONNRESET"）。
 *
 * 修复方案：通过原始 TCP socket 手动转发 /socket.io 的 WebSocket upgrade 请求，
 * 绕过 Vite 的 http-proxy.ws() 路径。
 */
const socketIOUpgradePlugin = (backendTarget) => {
  // 解析后端 host/port
  let backendHost = '127.0.0.1';
  let backendPort = 5183;
  try {
    const u = new URL(backendTarget);
    backendHost = u.hostname || '127.0.0.1';
    backendPort = u.port ? Number(u.port) : (u.protocol === 'https:' ? 443 : 80);
  } catch (_e) {
    // backendTarget 可能形如 "127.0.0.1:5183"
    const [h, p] = String(backendTarget).replace(/^https?:\/\//, '').split(':');
    if (h) backendHost = h;
    if (p) backendPort = Number(p);
  }

  return {
    name: 'socket-io-upgrade',
    apply: 'serve',
    configureServer(server) {
      const httpServer = server.httpServer;
      if (!httpServer) return;

      // prependListener 确保我们先于 Vite 的 proxy/HMR 监听器处理 /socket.io upgrade
      httpServer.prependListener('upgrade', (req, socket, head) => {
        const url = req.url || '';
        if (!url.startsWith('/socket.io/')) return;

        // 仅处理 WebSocket upgrade（GET + Upgrade: websocket）
        if (req.method !== 'GET') return;
        const upgradeHeader = String(req.headers.upgrade || '').toLowerCase();
        if (upgradeHeader !== 'websocket') return;

        // 禁用 Nagle 算法 — WebSocket 帧较小，需要立即发送
        try { socket.setNoDelay(true); } catch (_e) { /* noop */ }

        const upstream = net.connect(backendPort, backendHost, () => {
          // 重建 upgrade 请求头，host 改为后端地址
          const skip = new Set(['host', 'connection', 'upgrade', 'content-length']);
          const headerLines = [`${req.method} ${url} HTTP/1.1`];
          for (const [k, v] of Object.entries(req.headers)) {
            if (skip.has(k.toLowerCase())) continue;
            if (Array.isArray(v)) {
              headerLines.push(`${k}: ${v.join(', ')}`);
            } else if (v != null) {
              headerLines.push(`${k}: ${v}`);
            }
          }
          headerLines.push(`Host: ${backendHost}:${backendPort}`);
          headerLines.push('Connection: Upgrade');
          headerLines.push('Upgrade: websocket');
          headerLines.push('', '');

          const request = headerLines.join('\r\n');
          upstream.write(request);
          if (head && head.length) upstream.write(head);

          // 双向管道
          socket.pipe(upstream);
          upstream.pipe(socket);
        });

        upstream.on('error', () => {
          try { socket.destroy(); } catch (_e) { /* noop */ }
        });
        socket.on('error', () => {
          try { upstream.destroy(); } catch (_e) { /* noop */ }
        });
        socket.on('close', () => {
          try { upstream.destroy(); } catch (_e) { /* noop */ }
        });
        upstream.on('close', () => {
          try { socket.destroy(); } catch (_e) { /* noop */ }
        });
      });

      console.log(`[Vite] socket.io upgrade handler installed → ${backendHost}:${backendPort}`);
    },
  };
};

const createManualChunks = id => {
  if (!id.includes('node_modules')) {
    return undefined;
  }

  if (
    id.includes('/react/') ||
    id.includes('/react-dom/') ||
    id.includes('/scheduler/') ||
    id.includes('/react-router/') ||
    id.includes('/react-router-dom/')
  ) {
    return 'vendor-react';
  }

  if (
    id.includes('/antd/') ||
    id.includes('/@ant-design/') ||
    id.includes('/rc-') ||
    id.includes('/@rc-component/')
  ) {
    return 'vendor-antd';
  }

  if (
    id.includes('/recharts/') ||
    id.includes('/d3-') ||
    id.includes('/victory-vendor/')
  ) {
    return 'vendor-charts';
  }

  if (id.includes('/xlsx/')) {
    return 'vendor-xlsx';
  }

  if (id.includes('/dayjs/') || id.includes('/moment/')) {
    return 'vendor-date';
  }

  return 'vendor-misc';
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const host = env.VITE_BIND_HOST || env.FRONTEND_BIND_HOST || '0.0.0.0';
  const devPort = parsePort(env.VITE_FRONTEND_PORT, 13579);
  const previewPort = parsePort(env.VITE_FRONTEND_PORT || env.FRONTEND_PORT, 80);

  const backendUrl = env.VITE_BACKEND_URL || '';
  const configuredAllowedHosts = parseCsv(env.VITE_ALLOWED_HOSTS);
  const additionalAllowedHosts = parseCsv(process.env.__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS);
  const publicHosts = [
    extractHost(env.VITE_FRONTEND_PUBLIC_URL),
    extractHost(env.FRONTEND_PUBLIC_URL),
    extractHost(env.PUBLIC_URL),
  ];
  const allowAllHosts =
    shouldAllowAllHosts(env.VITE_ALLOWED_HOSTS) ||
    shouldAllowAllHosts(process.env.__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS);

  const allowedHosts = allowAllHosts
    ? true
    : Array.from(
        new Set(
          [
            'localhost',
            '127.0.0.1',
            extractHost(host),
            extractHost(backendUrl),
            ...publicHosts,
            ...configuredAllowedHosts,
            ...additionalAllowedHosts,
          ].filter(Boolean),
        ),
      );

  const backendTarget = normalizeProxyTarget(backendUrl || 'http://127.0.0.1:5183');
  const proxy = createProxyConfig(backendTarget);

  console.log(
    `[Vite] Mode: ${mode}, Backend: ${backendTarget}, Allowed hosts: ${
      allowedHosts === true ? 'ALL' : allowedHosts.join(', ')
    }`,
  );

  return {
    plugins: [
      react(),
      socketIOUpgradePlugin(backendTarget),
    ],
    server: {
      host,
      port: devPort,
      strictPort: false,
      allowedHosts,
      proxy,
    },
    preview: {
      host,
      port: previewPort,
      strictPort: false,
      allowedHosts,
      proxy,
    },
    build: {
      chunkSizeWarningLimit: 500,
      rollupOptions: {
        output: {
          manualChunks: createManualChunks,
        },
      },
      // 启用 gzip 压缩
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true, // 生产环境移除 console.log
          drop_debugger: true,
        },
      },
    },
  };
});
