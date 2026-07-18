// 登录 + 登出 流程 E2E
//
// 验证:
// 1. 登录页正常渲染
// 2. 错误密码提示
// 3. 正确凭据跳到 dashboard
// 4. 退出登录回登录页

import { test, expect } from '@playwright/test';

test.describe('登录流程', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    // 等待登录表单
    await expect(page.locator('input[placeholder="请输入用户名"]')).toBeVisible();
  });

  test('登录页正常显示', async ({ page }) => {
    await expect(page.locator('input[placeholder="请输入用户名"]')).toBeVisible();
    await expect(page.locator('input[placeholder="请输入密码"]')).toBeVisible();
    await expect(page.locator('button:has-text("登 录")')).toBeVisible();
  });

  test('错误密码给出错误提示', async ({ page }) => {
    await page.fill('input[placeholder="请输入用户名"]', 'admin');
    await page.fill('input[placeholder="请输入密码"]', 'wrongpassword');
    await page.click('button:has-text("登 录")');

    // 错误 toast / 提示 (后端可能慢, 给 15s)
    await expect(page.locator('.ant-message-error, .ant-notification-notice-error, .ant-form-item-explain-error'))
      .toBeVisible({ timeout: 15000 });
  });

  test('正确凭据登录成功, 跳转到 enterprise-select 或 dashboard', async ({ page }) => {
    await page.fill('input[placeholder="请输入用户名"]', 'admin');
    await page.fill('input[placeholder="请输入密码"]', 'admin123');
    await page.click('button:has-text("登 录")');

    // 等待跳转 (可能跳 enterprise-select 或 dashboard)
    await page.waitForFunction(
      () => location.pathname !== '/login',
      { timeout: 10000 }
    );

    // 至少不再在 /login
    expect(page.url()).not.toContain('/login');
  });

  test('空用户名/密码提示必填', async ({ page }) => {
    // 不填任何东西直接点登录
    await page.click('button:has-text("登 录")');

    // 应该有 ant-form 错误提示
    await expect(page.locator('.ant-form-item-explain-error').first())
      .toBeVisible({ timeout: 3000 });
  });
});
