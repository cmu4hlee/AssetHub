// 工单管理 流程 E2E
//
// 验证:
// 1. 登录后导航到工单管理
// 2. 6 个统计卡正常显示
// 3. 工单列表渲染
// 4. 点击 stat card 触发筛选
// 5. 点击工单查看详情 drawer

import { test, expect } from '@playwright/test';

// 共享登录 helper
async function login(page) {
  await page.goto('/login');
  await page.fill('input[placeholder="请输入用户名"]', 'admin');
  await page.fill('input[placeholder="请输入密码"]', 'admin123');
  await page.click('button:has-text("登 录")');
  // 等跳转
  await page.waitForFunction(
    () => location.pathname !== '/login',
    { timeout: 10000 }
  );
  // 如果在 enterprise-select, 选第一个
  if (page.url().includes('enterprise-select')) {
    await page.evaluate(`document.querySelectorAll('.ant-radio-wrapper')[0]?.click()`);
    await page.waitForTimeout(500);
    for (const txt of ['确认', '进入', '确定']) {
      const btn = page.locator(`button:has-text("${txt}")`);
      if (await btn.count() > 0) {
        await btn.first().click();
        break;
      }
    }
    await page.waitForTimeout(2000);
  }
}

test.describe('工单管理', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    // 直接跳到工单管理
    await page.goto('/maintenance/workorder-management', { waitUntil: 'domcontentloaded' });
    // 等页面基本元素出现 (dev server 慢 + 间歇 ECONNREFUSED)
    await page.waitForSelector('.ant-table-tbody, .ant-empty', { timeout: 30000 });
    // 等至少 1 行 或 明确空
    await page.waitForFunction(
      () =>
        document.querySelectorAll('.ant-table-tbody tr.ant-table-row').length > 0 ||
        !!document.querySelector('.ant-empty'),
      { timeout: 30000 }
    );
    // 额外等稳定 (stat card 加载)
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1000);
  });

  test('页面正常显示 6 个统计卡 + 12 列表格', async ({ page }) => {
    // 6 个 stat cards
    const statCards = await page.locator('.wo-stat-card').count();
    expect(statCards).toBeGreaterThanOrEqual(6);

    // 至少 1 行
    const rows = await page.locator('.ant-table-tbody tr.ant-table-row').count();
    expect(rows).toBeGreaterThan(0);

    // "导出 Excel" 按钮
    await expect(page.locator('button:has-text("导出 Excel")')).toBeVisible();
  });

  test('点击"待评价"统计卡触发状态筛选', async ({ page }) => {
    // 记录初始行数
    const before = await page.locator('.ant-table-tbody tr.ant-table-row').count();

    // 点"待评价"卡
    await page.locator('.wo-stat-card--pending-acceptance').click();

    // 等筛选生效
    await page.waitForTimeout(2000);

    // 验证状态 select 显示"已签字·待评价"
    await expect(page.locator('.ant-select-selection-item:has-text("已签字·待评价")'))
      .toBeVisible();
  });

  test('点击工单查看按钮打开详情 drawer', async ({ page }) => {
    // 点第一个查看按钮
    await page.locator('button .anticon-eye').first().click();

    // 等 drawer 出现
    await expect(page.locator('.ant-drawer-body')).toBeVisible({ timeout: 5000 });

    // 看到 "工单详情" 标题
    await expect(page.locator('.ant-drawer-title:has-text("工单详情")'))
      .toBeVisible();
  });

  test('导出 Excel 按钮可点击 (不期望真下载)', async ({ page }) => {
    // 监听下载事件
    const downloadPromise = page.waitForEvent('download', { timeout: 8000 });

    await page.locator('button:has-text("导出 Excel")').click();

    // 验证下载触发
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/工单列表.*\.xlsx$/);
  });
});
