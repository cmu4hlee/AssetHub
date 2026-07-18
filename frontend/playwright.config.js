// Playwright E2E 测试配置
// 跑: npx playwright test
// 看 UI: npx playwright test --ui
// 报告: npx playwright show-report

import { defineConfig, devices } from '@playwright/test';

const PORT = 13579;
const BASE_URL = process.env.E2E_BASE_URL || `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  // 测试超时 (单 case)
  timeout: 30 * 1000,
  // 期望超时
  expect: { timeout: 5 * 1000 },
  // 失败重试 0 (CI 友好)
  retries: process.env.CI ? 2 : 0,
  // 串行 (共享 dev server, 避免 state 污染)
  workers: 1,
  // 用例并行 off (串行最稳)
  fullyParallel: false,

  // 报告
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // 默认 viewport
    viewport: { width: 1600, height: 900 },
    // 失败时记录 console
    // 简单 dev admin 凭据
    extraHTTPHeaders: {
      'X-E2E-Client': 'playwright',
    },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // 启动 dev server (确保 vite 在跑)
  webServer: process.env.E2E_NO_SERVER
    ? undefined
    : {
        command: 'npm run dev',
        url: BASE_URL,
        timeout: 60 * 1000,
        reuseExistingServer: true, // 已有 dev server 复用
        stdout: 'ignore',
        stderr: 'pipe',
      },
});
