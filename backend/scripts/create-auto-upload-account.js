const bcrypt = require('bcryptjs');
const db = require('../config/database');

function parseArgs(argv) {
  return argv.reduce((result, item) => {
    if (!item.startsWith('--')) return result;
    const trimmed = item.slice(2);
    const splitIndex = trimmed.indexOf('=');
    if (splitIndex === -1) {
      result[trimmed] = 'true';
      return result;
    }
    const key = trimmed.slice(0, splitIndex);
    const value = trimmed.slice(splitIndex + 1);
    result[key] = value;
    return result;
  }, {});
}

function parseCsv(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

async function loadTargetTenants({ tenantIds, tenantCodes }) {
  if (tenantIds.length > 0) {
    const placeholders = tenantIds.map(() => '?').join(',');
    const [rows] = await db.execute(
      `SELECT id, tenant_code, tenant_name
       FROM tenants
       WHERE status = 'active' AND id IN (${placeholders})
       ORDER BY id ASC`,
      tenantIds,
    );
    return rows;
  }

  if (tenantCodes.length > 0) {
    const placeholders = tenantCodes.map(() => '?').join(',');
    const [rows] = await db.execute(
      `SELECT id, tenant_code, tenant_name
       FROM tenants
       WHERE status = 'active' AND tenant_code IN (${placeholders})
       ORDER BY id ASC`,
      tenantCodes,
    );
    return rows;
  }

  const [rows] = await db.execute(
    `SELECT id, tenant_code, tenant_name
     FROM tenants
     WHERE status = 'active'
     ORDER BY id ASC`,
  );
  return rows;
}

async function ensureUser({ username, passwordHash, realName, email, phone, defaultTenantId }) {
  const [rows] = await db.execute('SELECT id FROM users WHERE username = ? LIMIT 1', [username]);

  if (rows.length > 0) {
    const userId = rows[0].id;
    await db.execute(
      `UPDATE users
       SET password = ?,
           real_name = ?,
           email = ?,
           phone = ?,
           status = 'active',
           tenant_id = ?,
           updated_at = NOW(),
           updated_by = ?
       WHERE id = ?`,
      [passwordHash, realName, email, phone, defaultTenantId, 'auto_upload_bootstrap', userId],
    );
    return { userId, created: false };
  }

  const [result] = await db.execute(
    `INSERT INTO users (
      username,
      password,
      real_name,
      department_code,
      email,
      phone,
      status,
      tenant_id,
      updated_at,
      updated_by
    ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, NOW(), ?)`,
    [username, passwordHash, realName, null, email, phone, defaultTenantId, 'auto_upload_bootstrap'],
  );

  return { userId: result.insertId, created: true };
}

async function ensureTenantRoles({ userId, tenants, role, defaultTenantId }) {
  await db.execute('UPDATE user_tenant_roles SET is_default = 0 WHERE user_id = ?', [userId]);

  for (const tenant of tenants) {
    const isDefault = Number(tenant.id) === Number(defaultTenantId) ? 1 : 0;

    const [existing] = await db.execute(
      'SELECT id FROM user_tenant_roles WHERE user_id = ? AND tenant_id = ? LIMIT 1',
      [userId, tenant.id],
    );

    if (existing.length > 0) {
      await db.execute(
        `UPDATE user_tenant_roles
         SET role = ?,
             managed_departments = NULL,
             is_default = ?,
             status = 'active',
             updated_at = NOW()
         WHERE user_id = ? AND tenant_id = ?`,
        [role, isDefault, userId, tenant.id],
      );
      continue;
    }

    await db.execute(
      `INSERT INTO user_tenant_roles (
        user_id,
        tenant_id,
        role,
        managed_departments,
        is_default,
        status,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, NULL, ?, 'active', NOW(), NOW())`,
      [userId, tenant.id, role, isDefault],
    );
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const username = args.username || process.env.AUTO_UPLOAD_USERNAME || 'auto_uploader';
  const password = args.password || process.env.AUTO_UPLOAD_PASSWORD;
  const realName = args['real-name'] || process.env.AUTO_UPLOAD_REAL_NAME || '自动上传服务账号';
  const email = args.email || process.env.AUTO_UPLOAD_EMAIL || 'auto-uploader@local.invalid';
  const phone = args.phone || process.env.AUTO_UPLOAD_PHONE || null;
  const role = args.role || process.env.AUTO_UPLOAD_ROLE || 'system_admin';
  const tenantIds = parseCsv(args['tenant-ids'] || process.env.AUTO_UPLOAD_TENANT_IDS).map(id => Number(id)).filter(id => Number.isFinite(id) && id > 0);
  const tenantCodes = parseCsv(args['tenant-codes'] || process.env.AUTO_UPLOAD_TENANT_CODES);

  if (!password) {
    throw new Error('缺少密码，请通过 --password=... 或 AUTO_UPLOAD_PASSWORD 提供');
  }

  const tenants = await loadTargetTenants({ tenantIds, tenantCodes });
  if (tenants.length === 0) {
    throw new Error('未找到可用的 active tenant，无法创建自动上传账号');
  }

  const requestedDefaultTenantId = Number(
    args['default-tenant-id'] || process.env.AUTO_UPLOAD_DEFAULT_TENANT_ID || tenants[0].id,
  );
  const defaultTenant = tenants.find(item => Number(item.id) === requestedDefaultTenantId) || tenants[0];

  const passwordHash = await bcrypt.hash(password, 10);
  const { userId, created } = await ensureUser({
    username,
    passwordHash,
    realName,
    email,
    phone,
    defaultTenantId: defaultTenant.id,
  });

  await ensureTenantRoles({
    userId,
    tenants,
    role,
    defaultTenantId: defaultTenant.id,
  });

  console.log(created ? '已创建自动上传账号' : '已更新自动上传账号');
  console.log(`用户名: ${username}`);
  console.log(`密码: ${password}`);
  console.log(`角色: ${role}`);
  console.log(`默认租户: ${defaultTenant.id} (${defaultTenant.tenant_name})`);
  console.log('可用租户:');
  tenants.forEach(tenant => {
    const marker = Number(tenant.id) === Number(defaultTenant.id) ? '*' : '-';
    console.log(`  ${marker} ${tenant.id} | ${tenant.tenant_code} | ${tenant.tenant_name}`);
  });
}

main()
  .catch(error => {
    console.error('创建自动上传账号失败:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      if (typeof db.end === 'function') {
        await db.end();
      }
    } catch (error) {
      console.error('关闭数据库连接失败:', error.message);
    }
  });
