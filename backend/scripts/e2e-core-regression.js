#!/usr/bin/env node
/**
 * Core end-to-end regression smoke test.
 * Flow: login -> assets -> maintenance -> labels -> inventory(read + write cleanup).
 *
 * Usage:
 *   BASE_URL=http://localhost:5183 ASSETHUB_USERNAME=su ASSETHUB_PASSWORD=123456 node scripts/e2e-core-regression.js
 * Optional:
 *   TENANT_CODE=default | TENANT_ID=1 | TOKEN=<bearer-token-without-prefix>
 */
const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5183';
const LOGIN_USERNAME =
  process.env.ASSETHUB_USERNAME || process.env.LOGIN_USERNAME || process.env.AUTH_USERNAME;
const LOGIN_PASSWORD =
  process.env.ASSETHUB_PASSWORD || process.env.LOGIN_PASSWORD || process.env.AUTH_PASSWORD;
const {TENANT_CODE} = process.env;
const {TENANT_ID} = process.env;
const {TOKEN} = process.env;
const IDEMPOTENCY_KEY_SEED =
  process.env.E2E_IDEMPOTENCY_KEY ||
  `e2e-core-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const SKIP_INVENTORY_WRITE =
  String(process.env.E2E_SKIP_INVENTORY_WRITE || '').trim() === '1';

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
});

let idempotencySeq = 0;
client.interceptors.request.use(config => {
  const method = String(config.method || 'get').toLowerCase();
  if (['post', 'put', 'patch', 'delete'].includes(method)) {
    config.headers = config.headers || {};
    if (!config.headers['Idempotency-Key'] && !config.headers['idempotency-key']) {
      idempotencySeq += 1;
      config.headers['Idempotency-Key'] = `${IDEMPOTENCY_KEY_SEED}-${idempotencySeq}`;
    }
  }
  return config;
});

client.interceptors.response.use(
  response => response,
  async error => {
    const status = error?.response?.status;
    const payload = error?.response?.data || {};
    const original = error?.config;

    if (
      status === 428 &&
      payload?.requiresConfirmation &&
      payload?.confirmToken &&
      original &&
      !original.__riskConfirmed
    ) {
      original.__riskConfirmed = true;
      original.headers = original.headers || {};

      const confirmHeader = payload.confirmTokenHeader || 'X-Risk-Confirm-Token';
      original.headers[confirmHeader] = payload.confirmToken;

      if (!original.headers['Idempotency-Key'] && !original.headers['idempotency-key']) {
        idempotencySeq += 1;
        original.headers['Idempotency-Key'] = `${IDEMPOTENCY_KEY_SEED}-${idempotencySeq}`;
      }

      return client.request(original);
    }

    throw error;
  },
);

const normalizeToken = rawToken => {
  if (!rawToken || typeof rawToken !== 'string') return '';
  return rawToken.replace(/^Bearer\s+/i, '').trim();
};

const resolveRecordCount = payload => {
  if (!payload) return 0;
  if (Array.isArray(payload)) return payload.length;
  if (Array.isArray(payload.records)) return payload.records.length;
  if (Array.isArray(payload.items)) return payload.items.length;
  if (Array.isArray(payload.list)) return payload.list.length;
  if (Array.isArray(payload.rows)) return payload.rows.length;
  return 0;
};

const resolveRecordList = payload => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.records)) return payload.records;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.list)) return payload.list;
  if (Array.isArray(payload.rows)) return payload.rows;
  return [];
};

const logStep = label => {
  console.log(`\n[STEP] ${label}`);
};

const logOk = label => {
  console.log(`[OK] ${label}`);
};

const logWarn = label => {
  console.log(`[WARN] ${label}`);
};

const buildLoginPayload = () => {
  const payload = {
    username: LOGIN_USERNAME,
    password: LOGIN_PASSWORD,
  };
  if (TENANT_CODE) {
    payload.tenant_code = TENANT_CODE;
  }
  return payload;
};

const resolveAuthContext = async () => {
  const providedToken = normalizeToken(TOKEN);
  if (providedToken) {
    return {
      token: providedToken,
      tenantId: TENANT_ID || null,
      source: 'token',
    };
  }

  if (!LOGIN_USERNAME || !LOGIN_PASSWORD) {
    throw new Error(
      'Missing credentials. Set ASSETHUB_USERNAME and ASSETHUB_PASSWORD (or provide TOKEN).',
    );
  }

  logStep('Login');
  const { data } = await client.post('/api/users/login', buildLoginPayload());
  const payload = data?.data || data;
  const token = normalizeToken(payload?.token || data?.token);

  if (!data?.success || !token) {
    throw new Error(`Login failed: ${data?.message || 'unknown error'}`);
  }

  const enterprises = Array.isArray(payload?.enterprises) ? payload.enterprises : [];
  const matchedEnterprise = TENANT_CODE
    ? enterprises.find(item => String(item?.tenant_code || '') === String(TENANT_CODE))
    : null;

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
    source: 'login',
    username: payload?.user?.username || LOGIN_USERNAME,
  };
};

const applyAuthContext = authContext => {
  client.defaults.headers.common.Authorization = `Bearer ${authContext.token}`;
  if (authContext.tenantId) {
    client.defaults.headers.common['X-Tenant-ID'] = authContext.tenantId;
  }
};

const assertSuccess = (label, response) => {
  if (!response || response.success !== true) {
    throw new Error(`${label} failed: ${response?.message || 'unexpected response'}`);
  }
};

const executeReadCheck = async ({ label, url, params }) => {
  logStep(label);
  const { data } = await client.get(url, { params });
  assertSuccess(label, data);

  const payload = data.data || data;
  const count = resolveRecordCount(payload);
  logOk(`${label} (records=${count})`);

  return {
    count,
    list: resolveRecordList(payload),
    raw: payload,
  };
};

const createInventoryNo = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = `${now.getMonth() + 1}`.padStart(2, '0');
  const d = `${now.getDate()}`.padStart(2, '0');
  const time = `${now.getHours()}`.padStart(2, '0') + `${now.getMinutes()}`.padStart(2, '0');
  const rand = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0');
  return `E2E${y}${m}${d}${time}${rand}`;
};

const createInventoryDate = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = `${now.getMonth() + 1}`.padStart(2, '0');
  const d = `${now.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const runInventoryWriteFlow = async ({ assetSample, inventoryPerson }) => {
  if (SKIP_INVENTORY_WRITE) {
    logWarn('Inventory write flow skipped (E2E_SKIP_INVENTORY_WRITE=1)');
    return { created: false };
  }

  if (!assetSample?.asset_code) {
    logWarn('Inventory write flow skipped (no asset sample with asset_code)');
    return { created: false };
  }

  let inventoryId = null;
  try {
    const createPayload = {
      inventory_no: createInventoryNo(),
      inventory_date: createInventoryDate(),
      inventory_type: '专项盘点',
      inventory_person: inventoryPerson || 'e2e',
      remark: 'core-e2e-regression',
      self_check_enabled: false,
      self_check_scope: 'mine',
    };

    logStep('Inventory create');
    const createResp = await client.post('/api/inventory', createPayload);
    assertSuccess('Inventory create', createResp.data);
    inventoryId = createResp.data?.data?.id;
    if (!inventoryId) {
      throw new Error('Inventory create failed: missing id');
    }
    logOk(`Inventory created (id=${inventoryId})`);

    logStep('Inventory detail read');
    const detailResp = await client.get(`/api/inventory/${inventoryId}`);
    assertSuccess('Inventory detail read', detailResp.data);
    logOk('Inventory detail read');

    logStep('Inventory add detail');
    const addDetailResp = await client.post(`/api/inventory/${inventoryId}/details`, {
      asset_code: assetSample.asset_code,
      expected_location: assetSample.location || null,
      actual_location: assetSample.location || null,
      expected_status: assetSample.status || null,
      actual_status: assetSample.status || null,
      discrepancy_type: '正常',
      discrepancy_desc: 'e2e baseline',
    });
    assertSuccess('Inventory add detail', addDetailResp.data);
    logOk(`Inventory detail added (asset_code=${assetSample.asset_code})`);

    logStep('Inventory statistics');
    const statsResp = await client.get(`/api/inventory/${inventoryId}/statistics`);
    assertSuccess('Inventory statistics', statsResp.data);
    const total = Number(statsResp.data?.data?.total || 0);
    if (total < 1) {
      throw new Error('Inventory statistics total < 1 after adding detail');
    }
    logOk(`Inventory statistics (total=${total})`);

    logStep('Inventory update');
    const updateResp = await client.put(`/api/inventory/${inventoryId}`, {
      ...createPayload,
      remark: 'core-e2e-regression-updated',
    });
    assertSuccess('Inventory update', updateResp.data);
    logOk('Inventory updated');

    logStep('Inventory status update');
    const statusResp = await client.put(`/api/inventory/${inventoryId}/status`, {
      status: '已取消',
    });
    assertSuccess('Inventory status update', statusResp.data);
    logOk('Inventory status updated (已取消)');

    return {
      created: true,
      inventoryId,
    };
  } finally {
    if (inventoryId) {
      try {
        logStep('Inventory cleanup');
        const delResp = await client.delete(`/api/inventory/${inventoryId}`);
        assertSuccess('Inventory cleanup', delResp.data);
        logOk(`Inventory deleted (id=${inventoryId})`);
      } catch (cleanupError) {
        logWarn(
          `Inventory cleanup failed (id=${inventoryId}): ${
            cleanupError.response?.data?.message || cleanupError.message
          }`,
        );
      }
    }
  }
};

async function main() {
  console.log('=== Core E2E Regression ===');
  console.log(`BASE_URL=${BASE_URL}`);

  const authContext = await resolveAuthContext();
  applyAuthContext(authContext);

  const authDetails = [
    `source=${authContext.source}`,
    authContext.username ? `user=${authContext.username}` : null,
    authContext.tenantId ? `tenantId=${authContext.tenantId}` : 'tenantId=<none>',
  ].filter(Boolean);
  logOk(`Auth ready (${authDetails.join(', ')})`);

  const assetsResult = await executeReadCheck({
    label: 'Assets list',
    url: '/api/assets',
    params: { page: 1, pageSize: 5 },
  });

  const maintenanceResult = await executeReadCheck({
    label: 'Maintenance logs',
    url: '/api/maintenance/logs',
    params: { page: 1, pageSize: 5 },
  });

  const labelsResult = await executeReadCheck({
    label: 'Asset label templates',
    url: '/api/asset-labels/templates',
    params: { page: 1, pageSize: 5 },
  });

  const inventoryReadResult = await executeReadCheck({
    label: 'Inventory list',
    url: '/api/inventory',
    params: { page: 1, pageSize: 5 },
  });

  const assetSample = assetsResult.list.find(item => item && item.asset_code) || null;
  const inventoryWriteResult = await runInventoryWriteFlow({
    assetSample,
    inventoryPerson: authContext.username || LOGIN_USERNAME || 'e2e',
  });

  console.log('\n=== Regression Summary ===');
  console.log(`assets=${assetsResult.count}`);
  console.log(`maintenance_logs=${maintenanceResult.count}`);
  console.log(`label_templates=${labelsResult.count}`);
  console.log(`inventory_records=${inventoryReadResult.count}`);
  console.log(
    `inventory_write_flow=${inventoryWriteResult.created ? 'executed' : 'skipped'}`,
  );
  console.log('[DONE] Core E2E regression passed');
}

main().catch(error => {
  console.error('\n[FAIL] Core E2E regression failed:', error.message);

  if (error.response) {
    console.error(
      JSON.stringify(
        {
          status: error.response.status,
          method: error.config?.method,
          url: error.config?.url,
          data: error.response.data,
        },
        null,
        2,
      ),
    );
  }

  process.exit(1);
});
