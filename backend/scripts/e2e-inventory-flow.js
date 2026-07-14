#!/usr/bin/env node
/**
 * Inventory end-to-end write flow test.
 * Flow: login -> inventory create -> add detail -> stats -> update -> status -> cleanup.
 *
 * Usage:
 *   BASE_URL=http://localhost:5183 ASSETHUB_USERNAME=su ASSETHUB_PASSWORD=123456 node scripts/e2e-inventory-flow.js
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
  `e2e-inv-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

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

const normalizeToken = rawToken =>
  typeof rawToken === 'string' ? rawToken.replace(/^Bearer\s+/i, '').trim() : '';

const logStep = label => console.log(`\n[STEP] ${label}`);
const logOk = label => console.log(`[OK] ${label}`);
const logWarn = label => console.log(`[WARN] ${label}`);

const assertSuccess = (label, response) => {
  if (!response || response.success !== true) {
    throw new Error(`${label} failed: ${response?.message || 'unexpected response'}`);
  }
};

const buildLoginPayload = () => {
  const payload = {
    username: LOGIN_USERNAME,
    password: LOGIN_PASSWORD,
  };
  if (TENANT_CODE) payload.tenant_code = TENANT_CODE;
  return payload;
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
  return `E2EINV${y}${m}${d}${time}${rand}`;
};

const createInventoryDate = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = `${now.getMonth() + 1}`.padStart(2, '0');
  const d = `${now.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const resolveAuthContext = async () => {
  const token = normalizeToken(TOKEN);
  if (token) {
    return {
      token,
      tenantId: TENANT_ID || null,
      username: LOGIN_USERNAME || 'token-user',
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
  const loginToken = normalizeToken(payload?.token || data?.token);
  if (!data?.success || !loginToken) {
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
    token: loginToken,
    tenantId,
    username: payload?.user?.username || LOGIN_USERNAME,
  };
};

const applyAuthContext = auth => {
  client.defaults.headers.common.Authorization = `Bearer ${auth.token}`;
  if (auth.tenantId) {
    client.defaults.headers.common['X-Tenant-ID'] = auth.tenantId;
  }
};

const resolveAssetSample = async () => {
  logStep('Assets list (pick sample)');
  const { data } = await client.get('/api/assets', { params: { page: 1, pageSize: 10 } });
  assertSuccess('Assets list', data);
  const payload = data?.data || data;
  const list = Array.isArray(payload?.list)
    ? payload.list
    : Array.isArray(payload)
      ? payload
      : [];
  const sample = list.find(item => item && item.asset_code) || null;
  if (!sample) {
    throw new Error('No asset sample available to create inventory details');
  }
  logOk(`Asset sample ready (asset_code=${sample.asset_code})`);
  return sample;
};

async function main() {
  console.log('=== Inventory E2E Write Flow ===');
  console.log(`BASE_URL=${BASE_URL}`);

  const auth = await resolveAuthContext();
  applyAuthContext(auth);
  logOk(`Auth ready (tenantId=${auth.tenantId || '<none>'}, user=${auth.username || '<unknown>'})`);

  const asset = await resolveAssetSample();
  let inventoryId = null;

  try {
    const createPayload = {
      inventory_no: createInventoryNo(),
      inventory_date: createInventoryDate(),
      inventory_type: '专项盘点',
      inventory_person: auth.username || 'e2e',
      remark: 'inventory-e2e',
      self_check_enabled: false,
      self_check_scope: 'mine',
    };

    logStep('Create inventory');
    const createResp = await client.post('/api/inventory', createPayload);
    assertSuccess('Create inventory', createResp.data);
    inventoryId = createResp.data?.data?.id;
    if (!inventoryId) {
      throw new Error('Create inventory failed: missing id');
    }
    logOk(`Inventory created (id=${inventoryId})`);

    logStep('Add detail');
    const addDetailResp = await client.post(`/api/inventory/${inventoryId}/details`, {
      asset_code: asset.asset_code,
      expected_location: asset.location || null,
      actual_location: asset.location || null,
      expected_status: asset.status || null,
      actual_status: asset.status || null,
      discrepancy_type: '正常',
      discrepancy_desc: 'inventory-e2e',
    });
    assertSuccess('Add detail', addDetailResp.data);
    logOk('Detail added');

    logStep('Get detail');
    const detailResp = await client.get(`/api/inventory/${inventoryId}`);
    assertSuccess('Get detail', detailResp.data);
    const details = Array.isArray(detailResp.data?.data?.details) ? detailResp.data.data.details : [];
    if (!details.some(item => item.asset_code === asset.asset_code)) {
      throw new Error(`Detail check failed: asset ${asset.asset_code} not found`);
    }
    logOk(`Detail verified (details=${details.length})`);

    logStep('Get statistics');
    const statsResp = await client.get(`/api/inventory/${inventoryId}/statistics`);
    assertSuccess('Get statistics', statsResp.data);
    const total = Number(statsResp.data?.data?.total || 0);
    if (total < 1) {
      throw new Error('Statistics check failed: total < 1');
    }
    logOk(`Statistics verified (total=${total})`);

    logStep('Update inventory');
    const updateResp = await client.put(`/api/inventory/${inventoryId}`, {
      ...createPayload,
      remark: 'inventory-e2e-updated',
    });
    assertSuccess('Update inventory', updateResp.data);
    logOk('Inventory updated');

    logStep('Update status');
    const statusResp = await client.put(`/api/inventory/${inventoryId}/status`, { status: '已取消' });
    assertSuccess('Update status', statusResp.data);
    logOk('Inventory status updated (已取消)');
  } finally {
    if (inventoryId) {
      try {
        logStep('Cleanup inventory');
        const deleteResp = await client.delete(`/api/inventory/${inventoryId}`);
        assertSuccess('Cleanup inventory', deleteResp.data);
        logOk(`Inventory deleted (id=${inventoryId})`);
      } catch (cleanupError) {
        logWarn(
          `Cleanup failed (id=${inventoryId}): ${
            cleanupError.response?.data?.message || cleanupError.message
          }`,
        );
      }
    }
  }

  console.log('\n[DONE] Inventory E2E write flow passed');
}

main().catch(error => {
  console.error('\n[FAIL] Inventory E2E write flow failed:', error.message);
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
