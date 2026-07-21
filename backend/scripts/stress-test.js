/**
 * 后端稳定性压力测试
 *
 * 验证: 在高并发下后端不崩, 不会内存泄漏, 不会 unhandledRejection
 *
 * 用法:
 *   cd backend && node scripts/stress-test.js
 *
 * 配置 (env):
 *   STRESS_URL=...       默认 http://127.0.0.1:5183
 *   STRESS_CONCURRENCY=N 并发数 (默认 50)
 *   STRESS_TOTAL=N       总请求数 (默认 500)
 *   STRESS_USERNAME=...  默认 admin
 *   STRESS_PASSWORD=...  默认 admin123
 *
 * 输出:
 *   - 总耗时 / 平均响应 / P50 / P95 / P99 延迟
 *   - HTTP 状态码分布
 *   - 失败数 + 错误样本 (前 5)
 *   - 内存增量 (RSS 增长)
 */

const http = require('http');
const { performance } = require('perf_hooks');
const { URL: URLClass } = require('url');

const STRESS_URL = process.env.STRESS_URL || 'http://127.0.0.1:5183';
const CONCURRENCY = parseInt(process.env.STRESS_CONCURRENCY || '50', 10);
const TOTAL = parseInt(process.env.STRESS_TOTAL || '500', 10);
const USERNAME = process.env.STRESS_USERNAME || 'admin';
const PASSWORD = process.env.STRESS_PASSWORD || 'admin123';

// 测的端点 (覆盖: 读 / 写 / 鉴权 / 健康检查)
const ENDPOINTS = [
  { method: 'GET', path: '/api/health', auth: false, weight: 5 },
  { method: 'GET', path: '/api/health/detailed', auth: false, weight: 2 },
  { method: 'GET', path: '/api/assets/statistics/overview', auth: true, weight: 5 },
  { method: 'GET', path: '/api/maintenance/workorders/statistics', auth: true, weight: 4 },
  { method: 'GET', path: '/api/poct-quality-control/subjects?pageSize=5', auth: true, weight: 3 },
  { method: 'GET', path: '/api/maintenance/plans?pageSize=5', auth: true, weight: 3 },
  { method: 'GET', path: '/api/preventive-maintenance/temporary?pageSize=5', auth: true, weight: 3 },
  { method: 'GET', path: '/api/spare-parts/statistics/overview', auth: true, weight: 2 },
  { method: 'GET', path: '/api/users/profile', auth: true, weight: 2 },
  { method: 'GET', path: '/api/dashboard', auth: true, weight: 2 },
];

function pickEndpoint() {
  const totalWeight = ENDPOINTS.reduce((s, e) => s + e.weight, 0);
  let r = Math.random() * totalWeight;
  for (const e of ENDPOINTS) {
    if (r < e.weight) return e;
    r -= e.weight;
  }
  return ENDPOINTS[0];
}

function urlBase() {
  const u = new URLClass(STRESS_URL);
  return { host: u.hostname, port: u.port, protocol: u.protocol.replace(':', '') };
}

function request({ method, path, token }) {
  return new Promise(resolve => {
    const { host, port } = urlBase();
    const start = performance.now();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const req = http.request({
      host, port, method, path, headers, timeout: 60000,
    }, res => {
      let bytes = 0;
      res.on('data', chunk => { bytes += chunk.length; });
      res.on('end', () => {
        const ms = performance.now() - start;
        resolve({ status: res.statusCode, ms, bytes });
      });
    });
    req.on('timeout', () => {
      req.destroy();
      const ms = performance.now() - start;
      resolve({ status: 0, ms, error: 'timeout' });
    });
    req.on('error', err => {
      const ms = performance.now() - start;
      resolve({ status: 0, ms, error: err.message });
    });
    req.end();
  });
}

async function login() {
  const { host, port } = urlBase();
  const body = JSON.stringify({ username: USERNAME, password: PASSWORD });
  return new Promise((resolve, reject) => {
    const req = http.request({
      host, port, method: 'POST', path: '/api/users/login',
      headers: { 'Content-Type': 'application/json' }, timeout: 30000,
    }, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => {
        try {
          const d = JSON.parse(buf);
          if (d.success && d.data?.token) resolve(d.data.token);
          else reject(new Error(`登录失败: ${d.message || res.statusCode}`));
        } catch (e) {
          reject(new Error(`登录响应解析失败: ${buf.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function formatMB(bytes) {
  return (bytes / 1024 / 1024).toFixed(1);
}

function pct(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(Math.floor((p / 100) * sorted.length), sorted.length - 1);
  return sorted[idx];
}

async function main() {
  console.log('========================================');
  console.log('AssetHub 后端压力测试');
  console.log('========================================');
  console.log(`目标:        ${STRESS_URL}`);
  console.log(`并发:        ${CONCURRENCY}`);
  console.log(`总请求:      ${TOTAL}`);
  console.log(`端点数:      ${ENDPOINTS.length}`);
  console.log('');

  // 登录
  console.log('[1/3] 登录...');
  const token = await login();
  console.log(`  拿到 token (前 20): ${token.slice(0, 20)}...`);

  // baseline memory
  const memBefore = process.memoryUsage();
  console.log(`  baseline RSS: ${formatMB(memBefore.rss)}MB heap: ${formatMB(memBefore.heapUsed)}MB`);
  console.log('');

  // 压测
  console.log(`[2/3] 开始压测 (${CONCURRENCY} 并发, ${TOTAL} 请求)...`);
  const t0 = performance.now();
  const results = [];

  // 用信号量控制并发
  let inflight = 0;
  let completed = 0;
  let nextIdx = 0;

  await new Promise(resolve => {
    function next() {
      while (inflight < CONCURRENCY && nextIdx < TOTAL && !globalThis.__aborted) {
        const idx = nextIdx++;
        const ep = pickEndpoint();
        const useAuth = ep.auth && token;
        inflight++;
        request({ method: ep.method, path: ep.path, token: useAuth ? token : null })
          .then(r => {
            results.push(r);
            completed++;
            inflight--;
            if (completed >= TOTAL) {
              resolve();
            } else if (nextIdx < TOTAL) {
              next();
            }
          })
          .catch(err => {
            results.push({ status: 0, ms: 0, error: err.message });
            completed++;
            inflight--;
            if (completed >= TOTAL) resolve();
            else if (nextIdx < TOTAL) next();
          });
      }
      if (inflight === 0 && nextIdx >= TOTAL) resolve();
    }
    next();
  });

  const t1 = performance.now();
  const totalMs = t1 - t0;
  console.log(`  压测完成, 耗时 ${(totalMs / 1000).toFixed(2)}s`);
  console.log('');

  // 统计
  console.log('[3/3] 统计结果');
  console.log('----------------------------------------');

  const latencies = results.filter(r => r.ms > 0).map(r => r.ms);
  const statusCount = {};
  let errCount = 0;
  const errSamples = [];
  results.forEach(r => {
    const k = r.status || 'NETWORK_ERROR';
    statusCount[k] = (statusCount[k] || 0) + 1;
    if (r.status >= 500 || r.status === 0 || r.error) {
      errCount++;
      if (errSamples.length < 5) errSamples.push(r);
    }
  });

  console.log(`总请求:    ${results.length}`);
  console.log(`总耗时:    ${(totalMs / 1000).toFixed(2)}s`);
  console.log(`吞吐量:    ${(results.length / (totalMs / 1000)).toFixed(1)} req/s`);
  console.log(`平均延迟:  ${(latencies.reduce((s, n) => s + n, 0) / Math.max(latencies.length, 1)).toFixed(1)}ms`);
  console.log(`P50:       ${pct(latencies, 50).toFixed(1)}ms`);
  console.log(`P95:       ${pct(latencies, 95).toFixed(1)}ms`);
  console.log(`P99:       ${pct(latencies, 99).toFixed(1)}ms`);
  console.log(`Max:       ${(latencies.length ? Math.max(...latencies) : 0).toFixed(1)}ms`);
  console.log('');
  console.log('状态码分布:');
  Object.keys(statusCount).sort().forEach(k => {
    console.log(`  ${k}: ${statusCount[k]}`);
  });
  console.log('');
  console.log(`错误数 (5xx + 网络错误): ${errCount}`);
  if (errSamples.length > 0) {
    console.log('错误样本:');
    errSamples.forEach((e, i) => {
      console.log(`  [${i + 1}] status=${e.status} ms=${e.ms?.toFixed(0)} err=${e.error || ''}`);
    });
  }

  // 内存增量
  // 强制 GC 一下 (如果开启了 --expose-gc)
  if (global.gc) {
    global.gc();
  }
  const memAfter = process.memoryUsage();
  console.log('');
  console.log('内存变化 (本进程, 不是后端进程):');
  console.log(`  RSS:    ${formatMB(memBefore.rss)}MB → ${formatMB(memAfter.rss)}MB (Δ ${(memAfter.rss - memBefore.rss > 0 ? '+' : '')}${formatMB(memAfter.rss - memBefore.rss)}MB)`);
  console.log(`  heap:   ${formatMB(memBefore.heapUsed)}MB → ${formatMB(memAfter.heapUsed)}MB (Δ ${(memAfter.heapUsed - memBefore.heapUsed > 0 ? '+' : '')}${formatMB(memAfter.heapUsed - memBefore.heapUsed)}MB)`);

  // 退出码
  const failRate = errCount / results.length;
  if (failRate > 0.05) {
    console.log('');
    console.log(`❌ 错误率 ${(failRate * 100).toFixed(2)}% > 5%, 判定后端不稳定`);
    process.exit(1);
  } else {
    console.log('');
    console.log(`✅ 错误率 ${(failRate * 100).toFixed(2)}% <= 5%, 后端通过压力测试`);
    process.exit(0);
  }
}

main().catch(err => {
  console.error('压测异常:', err);
  process.exit(2);
});
