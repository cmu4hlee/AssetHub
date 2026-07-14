#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const baseUrl = process.env.E2E_BASE_URL || 'http://127.0.0.1:5183/api';
const now = Date.now();
const adminUser = `ms_flow_admin_${now}`;
const joinUser = `ms_flow_join_${now}`;
const password = process.env.E2E_PASSWORD || 'AaTest123!';

async function api(
  url,
  { method = 'GET', token, tenantId, body, headers, rawBody = false } = {},
) {
  const requestHeaders = { ...(headers || {}) };
  if (token) requestHeaders.Authorization = `Bearer ${token}`;
  if (tenantId !== undefined && tenantId !== null) {
    requestHeaders['X-Tenant-ID'] = String(tenantId);
  }

  if (body !== undefined && !rawBody) {
    requestHeaders['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${baseUrl}${url}`, {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : rawBody ? body : JSON.stringify(body),
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    data = { raw: text };
  }

  return {
    status: response.status,
    ok: response.ok,
    data,
  };
}

async function run() {
  const report = [];
  const push = (step, response, extra = {}, options = {}) => {
    const { expectedFailure = false } = options;
    const ok = expectedFailure ? !response.ok : response.ok;
    report.push({
      step,
      status: response.status,
      ok,
      expected_failure: expectedFailure,
      message: response.data?.message || response.data?.error || '',
      ...extra,
    });
  };

  // 1) 注册管理员并创建企业
  const registerAdmin = await api('/users/register', {
    method: 'POST',
    body: {
      username: adminUser,
      password,
      real_name: '微软系统管理员',
      tenant_option: 'create',
      tenant_name: '微软公司',
      email: `${adminUser}@example.com`,
      phone: '13800138000',
    },
  });
  push('register_admin_create_tenant', registerAdmin, {
    admin_user_id: registerAdmin.data?.data?.id,
  });

  // 2) 管理员登录
  const loginAdmin = await api('/users/login', {
    method: 'POST',
    body: { username: adminUser, password },
  });
  const adminToken = loginAdmin.data?.data?.token;
  const tenantId = loginAdmin.data?.data?.user?.tenant_id;
  const tenantCode = loginAdmin.data?.data?.enterprises?.[0]?.tenant_code;
  push('login_admin', loginAdmin, {
    role: loginAdmin.data?.data?.user?.role,
    tenant_id: tenantId,
    tenant_code: tenantCode,
  });

  if (!adminToken || !tenantId) {
    throw new Error('管理员登录失败，无法继续流程');
  }

  // 3) 企业与模块配置读取
  const currentTenant = await api('/tenants/current/info', {
    token: adminToken,
    tenantId,
  });
  push('get_current_tenant_info', currentTenant, {
    tenant_name: currentTenant.data?.data?.tenant_name,
  });

  const tenantModules = await api(`/tenant-module-config/tenants/${tenantId}/modules`, {
    token: adminToken,
    tenantId,
  });
  const tenantModuleCount = Array.isArray(tenantModules.data)
    ? tenantModules.data.length
    : (tenantModules.data?.data || []).length;
  push('get_tenant_modules', tenantModules, { module_count: tenantModuleCount });

  const moduleList = await api(`/module-configs/list?tenant_id=${tenantId}`, {
    token: adminToken,
    tenantId,
  });
  const modules = moduleList.data?.data || [];
  push('get_module_config_list', moduleList, { module_count: modules.length });

  // 4) 启用维修模块（若默认未启用）
  const maintenanceModule = modules.find(item => item.id === 'maintenance-management');
  if (maintenanceModule && !maintenanceModule.enabled) {
    const enableMaintenance = await api('/module-configs/enable', {
      method: 'POST',
      token: adminToken,
      tenantId,
      body: { module_id: 'maintenance-management' },
    });
    push('enable_maintenance_module', enableMaintenance);
  } else {
    report.push({
      step: 'enable_maintenance_module',
      status: 200,
      ok: true,
      expected_failure: false,
      message: '维修模块已启用，跳过启用动作',
    });
  }

  // 5) 创建部门与分类
  const createDepartment = await api('/departments', {
    method: 'POST',
    token: adminToken,
    tenantId,
    body: { department_name: '微软信息科' },
  });
  const departmentCode = createDepartment.data?.data?.department_code;
  push('create_department', createDepartment, { department_code: departmentCode });

  const createCategoryLevel1 = await api('/assets/categories', {
    method: 'POST',
    token: adminToken,
    tenantId,
    body: {
      name: '设备类',
      code: `MS-L1-${String(now).slice(-6)}`,
      parent_id: 0,
      description: 'E2E 一级分类',
    },
  });
  const categoryLevel1Id = createCategoryLevel1.data?.data?.id;
  push('create_asset_category_level1', createCategoryLevel1, { category_id: categoryLevel1Id });

  let categoryLevel2Id = null;
  if (categoryLevel1Id) {
    const createCategoryLevel2 = await api('/assets/categories', {
      method: 'POST',
      token: adminToken,
      tenantId,
      body: {
        name: '监护设备',
        code: `MS-L2-${String(now).slice(-6)}`,
        parent_id: categoryLevel1Id,
        description: 'E2E 二级分类',
      },
    });
    categoryLevel2Id = createCategoryLevel2.data?.data?.id;
    push('create_asset_category_level2', createCategoryLevel2, {
      category_id: categoryLevel2Id,
      parent_id: categoryLevel1Id,
    });
  }

  // 6) 创建资产并发起维修申请
  const assetCode = `MS-${String(now).slice(-8)}`;
  const createAsset = await api('/assets', {
    method: 'POST',
    token: adminToken,
    tenantId,
    body: {
      asset_code: assetCode,
      asset_name: '微软测试资产',
      category_id: categoryLevel1Id,
      category_secondary_id: categoryLevel2Id,
      purchase_date: '2026-02-27',
      purchase_price: 12345.67,
      current_value: 12000,
      department_new: departmentCode,
      department: '微软信息科',
      status: '在用',
      brand: 'Microsoft',
      model: 'Surface Pro Test',
    },
  });
  push('create_asset', createAsset, {
    asset_id: createAsset.data?.data?.id,
    asset_code: assetCode,
  });

  const createMaintenanceRequest = await api('/maintenance/requests', {
    method: 'POST',
    token: adminToken,
    tenantId,
    body: {
      asset_code: assetCode,
      fault_description: 'E2E 自动化测试故障',
      fault_level: '一般',
    },
  });
  const maintenanceRequestId = createMaintenanceRequest.data?.data?.id;
  push('create_maintenance_request', createMaintenanceRequest, {
    request_id: maintenanceRequestId,
  });

  if (maintenanceRequestId) {
    const approveMaintenance = await api(`/maintenance/requests/${maintenanceRequestId}/approve`, {
      method: 'POST',
      token: adminToken,
      tenantId,
      body: { approved: true, comment: 'E2E 自动审批' },
    });
    push('approve_maintenance_request', approveMaintenance, {
      request_id: maintenanceRequestId,
    });
  }

  // 7) IoT Token 配置与验证
  const tokenScopes = await api('/system-config/iot-tokens/scopes', {
    token: adminToken,
    tenantId,
  });
  push('get_iot_token_scopes', tokenScopes, {
    scope_count: (tokenScopes.data?.data || []).length,
  });

  const generateIotToken = await api('/system-config/iot-tokens/generate', {
    method: 'POST',
    token: adminToken,
    tenantId,
    body: {
      token_name: `微软IoT测试Token-${now}`,
      scopes: ['location'],
      expires_in_days: 7,
    },
  });
  const plainIotToken = generateIotToken.data?.data?.token;
  push('generate_iot_token', generateIotToken, {
    token_id: generateIotToken.data?.data?.id,
    has_plain_token: Boolean(plainIotToken),
  });

  if (plainIotToken) {
    const verifyIotToken = await api('/system-config/iot-tokens/verify', {
      method: 'POST',
      token: adminToken,
      tenantId,
      body: {
        token: plainIotToken,
        scope: 'location',
      },
    });
    push('verify_iot_token', verifyIotToken, {
      valid: verifyIotToken.data?.data?.valid,
      tenant_id: verifyIotToken.data?.data?.tenant_id,
    });
  }

  // 8) 新用户加入企业、审批并登录
  const registerJoinUser = await api('/users/register', {
    method: 'POST',
    body: {
      username: joinUser,
      password,
      real_name: '微软普通用户',
      tenant_option: 'join',
      tenant_code: String(tenantCode),
    },
  });
  push('register_join_user', registerJoinUser, {
    join_user_id: registerJoinUser.data?.data?.id,
  });

  const loginJoinBeforeApprove = await api('/users/login', {
    method: 'POST',
    body: { username: joinUser, password },
  });
  push(
    'login_join_user_before_approve',
    loginJoinBeforeApprove,
    {},
    { expectedFailure: true },
  );

  const pendingJoinRequests = await api('/users/role-requests/pending', {
    token: adminToken,
    tenantId,
  });
  const pendingRows = pendingJoinRequests.data?.data || [];
  const joinRequest = pendingRows.find(item => item.username === joinUser);
  push('get_pending_join_requests', pendingJoinRequests, {
    pending_count: pendingRows.length,
    request_id: joinRequest?.id,
  });

  if (joinRequest?.id) {
    const approveJoinRequest = await api(`/users/role-requests/${joinRequest.id}/approve`, {
      method: 'PUT',
      token: adminToken,
      tenantId,
      body: { approved: true },
    });
    push('approve_join_request', approveJoinRequest, { request_id: joinRequest.id });
  }

  const loginJoinAfterApprove = await api('/users/login', {
    method: 'POST',
    body: { username: joinUser, password },
  });
  push('login_join_user_after_approve', loginJoinAfterApprove, {
    role: loginJoinAfterApprove.data?.data?.user?.role,
    tenant_id: loginJoinAfterApprove.data?.data?.user?.tenant_id,
  });

  // 输出结果
  const failures = report.filter(item => !item.ok);
  const output = {
    run_at: new Date().toISOString(),
    base_url: baseUrl,
    admin_user: adminUser,
    join_user: joinUser,
    tenant_id: tenantId,
    tenant_code: tenantCode,
    total_steps: report.length,
    pass_steps: report.length - failures.length,
    fail_steps: failures.length,
    failures,
    report,
  };

  const outputDir = path.resolve(__dirname, '../../analysis');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const reportFile = path.join(outputDir, 'e2e-register-tenant-config-usage-report.json');
  fs.writeFileSync(reportFile, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

  console.log(
    JSON.stringify(
      {
        summary: {
          total: output.total_steps,
          pass: output.pass_steps,
          fail: output.fail_steps,
        },
        report_file: 'analysis/e2e-register-tenant-config-usage-report.json',
      },
      null,
      2,
    ),
  );

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

run().catch(error => {
  console.error('[E2E_FLOW] 执行失败:', error.message);
  process.exit(1);
});

