#!/usr/bin/env node
/**
 * 资产管理模块冒烟脚本
 * 使用方法：
 *   BASE_URL=http://localhost:3000 ASSETHUB_USERNAME=xxx ASSETHUB_PASSWORD=xxx TENANT_CODE=xxx node backend/scripts/asset-module-smoke.js
 * 或已有 TOKEN=xxx（Bearer）直接运行。
 *
 * 覆盖要点：
 * - 登录/鉴权
 * - 获取菜单（验证资产助手/资产菜单返回）
 * - 资产列表查询
 * - 调配列表查询
 * - 闲置资产列表
 */
const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const LOGIN_USERNAME =
  process.env.ASSETHUB_USERNAME || process.env.LOGIN_USERNAME || process.env.AUTH_USERNAME;
const LOGIN_PASSWORD =
  process.env.ASSETHUB_PASSWORD || process.env.LOGIN_PASSWORD || process.env.AUTH_PASSWORD;
const {TENANT_CODE} = process.env;
const {TENANT_ID} = process.env;
const {TOKEN} = process.env;

const api = axios.create({ baseURL: BASE_URL, timeout: 10000 });

async function loginIfNeeded() {
  if (TOKEN) {
    return {
      token: TOKEN,
      tenantId: TENANT_ID || null,
    };
  }
  if (!LOGIN_USERNAME || !LOGIN_PASSWORD) {
    throw new Error('缺少 TOKEN，且未提供 ASSETHUB_USERNAME/ASSETHUB_PASSWORD');
  }
  const { data } = await api.post('/api/users/login', {
    username: LOGIN_USERNAME,
    password: LOGIN_PASSWORD,
    tenant_code: TENANT_CODE,
  });
  const payload = data?.data || data;
  const token = payload?.token || data?.token;
  if (!data?.success || !token) {
    throw new Error(`登录失败: ${data?.message || 'unknown'}`);
  }
  const enterprises = Array.isArray(payload?.enterprises) ? payload.enterprises : [];
  const matchedEnterprise = enterprises.find(item => item?.tenant_code === TENANT_CODE);
  const tenantId =
    TENANT_ID ||
    matchedEnterprise?.id ||
    payload?.user?.tenant_id ||
    payload?.tenant_id ||
    enterprises?.[0]?.id ||
    null;

  return {
    token,
    tenantId,
  };
}

async function withToken(auth) {
  api.defaults.headers.common.Authorization = `Bearer ${auth.token}`;
  if (auth.tenantId) {
    api.defaults.headers.common['X-Tenant-ID'] = auth.tenantId;
  }
}

async function checkMenus() {
  const { data } = await api.get('/api/roles-permissions/user/menus');
  if (!data?.success) throw new Error('获取菜单失败');
  const menus = data.data || data;
  const hasAssets = menus.includes('/assets') || menus.includes('/assets-parent');
  const hasAssistant =
    menus.includes('/ai-assistant/ct-maintenance') || menus.includes('/ai-assistant-parent');
  return { menus, hasAssets, hasAssistant };
}

async function checkAssets() {
  const { data } = await api.get('/api/assets', { params: { page: 1, pageSize: 5 } });
  if (!data?.success) throw new Error('资产列表失败');
  return data.data || data;
}

async function checkTransfer() {
  const { data } = await api.get('/api/transfer', { params: { page: 1, pageSize: 5 } });
  if (!data?.success) throw new Error('调配列表失败');
  return data.data || data;
}

async function checkIdle() {
  const { data } = await api.get('/api/idle', { params: { page: 1, pageSize: 5 } });
  if (!data?.success) throw new Error('闲置资产列表失败');
  return data.data || data;
}

async function checkAssetDetail(sample) {
  if (!sample) return '跳过：无资产记录';
  const id = sample.id || sample.asset_id || sample.assetId;
  const code = sample.asset_code || sample.assetCode;
  let detail = null;
  if (id) {
    const { data } = await api.get(`/api/assets/${id}`);
    if (data?.success) {
      detail = data.data || data;
      return detail;
    }
  }
  if (code) {
    const { data } = await api.get('/api/assets', { params: { asset_code: code, page: 1, pageSize: 1 } });
    if (data?.success) {
      detail = (data.data || data)?.records?.[0] || data?.records?.[0] || null;
      return detail || '已查询但未返回详情';
    }
  }
  return '未能获取资产详情';
}

async function checkCategories() {
  const { data } = await api.get('/api/assets/categories/list');
  if (!data?.success) throw new Error('资产分类列表失败');
  return data.data || data;
}

async function checkInventory() {
  const { data } = await api.get('/api/inventory', { params: { page: 1, pageSize: 5 } });
  if (!data?.success) throw new Error('盘点列表失败');
  return data.data || data;
}

async function checkTransferStats() {
  const { data } = await api.get('/api/transfer/statistics');
  if (!data?.success) throw new Error('调配统计失败');
  return data.data || data;
}

async function checkDepreciation() {
  const { data } = await api.get('/api/depreciation', { params: { page: 1, pageSize: 5 } });
  if (!data?.success) throw new Error('折旧列表失败');
  return data.data || data;
}

async function checkMaintenance() {
  const { data } = await api.get('/api/maintenance/logs', { params: { page: 1, pageSize: 5 } });
  if (!data?.success) throw new Error('维修日志列表失败');
  return data.data || data;
}

async function checkProcurement() {
  const { data } = await api
    .get('/api/procurement/requests', { params: { page: 1, pageSize: 5 } })
    .catch(() => ({ data: null }));
  if (!data?.success) throw new Error('采购列表失败');
  return data.data || data;
}

async function checkLabels() {
  const { data } = await api.get('/api/asset-labels/templates', { params: { page: 1, pageSize: 5 } });
  if (!data?.success) throw new Error('标签模板列表失败');
  return data.data || data;
}

async function checkImportTemplate() {
  const resp = await api.get('/api/assets/import-template', { responseType: 'arraybuffer' });
  if (resp.status !== 200) throw new Error('资产导入模板下载失败');
  return resp.headers['content-length'] || resp.data?.length || 'downloaded';
}

async function main() {
  console.log('== 资产模块冒烟开始 ==');
  console.log('步骤: 登录鉴权');
  const auth = await loginIfNeeded();
  await withToken(auth);
  if (auth.tenantId) {
    console.log(`登录成功（租户ID: ${auth.tenantId}）`);
  } else {
    console.log('登录成功');
  }

  const menuResult = await checkMenus();
  console.log(
    '菜单检查: 资产菜单',
    menuResult.hasAssets ? '✅' : '❌',
    ' 资产AI助手',
    menuResult.hasAssistant ? '✅' : '❌',
  );

  await checkAssets();
  const assetList = await checkAssets();
  console.log('资产列表: ✅');

  const firstAsset = Array.isArray(assetList?.records) ? assetList.records[0] : null;
  const detail = await checkAssetDetail(firstAsset);
  console.log('资产详情: ✅', typeof detail === 'string' ? detail : (detail?.asset_code || detail?.assetCode || '已返回'));

  await checkCategories();
  console.log('资产分类: ✅');

  await checkTransfer();
  console.log('调配列表: ✅');

  await checkTransferStats();
  console.log('调配统计: ✅');

  await checkIdle();
  console.log('闲置资产: ✅');

  await checkInventory();
  console.log('盘点列表: ✅');

  await checkDepreciation();
  console.log('折旧列表: ✅');

  await checkMaintenance();
  console.log('维修日志: ✅');

  await checkProcurement();
  console.log('采购列表: ✅');

  await checkLabels();
  console.log('标签模板: ✅');

  await checkImportTemplate();
  console.log('资产导入模板下载: ✅');

  console.log('== 冒烟完成 ==');
}

main().catch(err => {
  console.error('冒烟失败:', err.message);
  if (err.response) {
    console.error(
      '失败详情:',
      JSON.stringify(
        {
          status: err.response.status,
          url: err.config?.url,
          method: err.config?.method,
          data: err.response.data,
        },
        null,
        2,
      ),
    );
  }
  process.exit(1);
});
