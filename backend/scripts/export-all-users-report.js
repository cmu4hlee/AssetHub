const fs = require('fs');
const path = require('path');
const db = require('../config/database');

function parseArgs(argv) {
  const options = {
    outputDir: path.resolve(__dirname, '..', 'reports'),
    prefix: 'all-users',
    includeCsv: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    if (arg === '--csv') {
      options.includeCsv = true;
      continue;
    }

    if (arg.startsWith('--output-dir=')) {
      options.outputDir = path.resolve(arg.slice('--output-dir='.length));
      continue;
    }

    if (arg === '--output-dir' && argv[index + 1]) {
      options.outputDir = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg.startsWith('--prefix=')) {
      options.prefix = arg.slice('--prefix='.length).trim() || options.prefix;
      continue;
    }

    if (arg === '--prefix' && argv[index + 1]) {
      options.prefix = argv[index + 1].trim() || options.prefix;
      index += 1;
      continue;
    }
  }

  return options;
}

function printHelp() {
  console.log('Usage: node scripts/export-all-users-report.js [options]');
  console.log('');
  console.log('Options:');
  console.log('  --csv                 Also export CSV');
  console.log('  --output-dir <path>   Set output directory (default: backend/reports)');
  console.log('  --prefix <name>       Set report file prefix (default: all-users)');
  console.log('  -h, --help            Show this help');
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function formatFileTimestamp(date) {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  const hour = pad2(date.getHours());
  const minute = pad2(date.getMinutes());
  const second = pad2(date.getSeconds());
  return `${year}${month}${day}-${hour}${minute}${second}`;
}

function groupByCount(items, keySelector) {
  const map = new Map();
  for (const item of items) {
    const key = keySelector(item) || 'unknown';
    map.set(key, (map.get(key) || 0) + 1);
  }
  return Object.fromEntries([...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function escapeCsvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function normalizeDateValue(value) {
  if (!value) {
    return '';
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}

function buildCsv(users, superUsers) {
  const header = [
    'record_type',
    'id',
    'username',
    'real_name',
    'email',
    'phone',
    'status',
    'created_at',
    'updated_at',
    'tenant_roles',
    'tenant_role_count',
    'active_tenant_role_count',
  ];

  const lines = [header.map(escapeCsvCell).join(',')];

  for (const user of users) {
    lines.push(
      [
        'user',
        user.id,
        user.username,
        user.real_name,
        user.email,
        user.phone,
        user.status,
        normalizeDateValue(user.created_at),
        normalizeDateValue(user.updated_at),
        user.tenant_roles,
        user.tenant_role_count,
        user.active_tenant_role_count,
      ]
        .map(escapeCsvCell)
        .join(','),
    );
  }

  for (const superUser of superUsers) {
    lines.push(
      [
        'super_user',
        superUser.id,
        superUser.username,
        superUser.real_name,
        superUser.email,
        superUser.phone,
        superUser.status,
        normalizeDateValue(superUser.created_at),
        normalizeDateValue(superUser.updated_at),
        '',
        '',
        '',
      ]
        .map(escapeCsvCell)
        .join(','),
    );
  }

  return lines.join('\n');
}

async function fetchUsers() {
  const [rows] = await db.execute(
    `
      SELECT
        u.id,
        u.username,
        u.real_name,
        u.email,
        u.phone,
        u.status,
        u.created_at,
        u.updated_at,
        COALESCE(
          GROUP_CONCAT(
            CONCAT(
              COALESCE(t.tenant_code, 'N/A'),
              ' / ',
              COALESCE(t.tenant_name, 'Unknown Tenant'),
              ' / ',
              COALESCE(utr.role, 'N/A'),
              ' / ',
              COALESCE(utr.status, 'unknown')
            )
            ORDER BY utr.is_default DESC, utr.id ASC
            SEPARATOR ' | '
          ),
          ''
        ) AS tenant_roles,
        COUNT(utr.id) AS tenant_role_count,
        SUM(CASE WHEN utr.status = 'active' THEN 1 ELSE 0 END) AS active_tenant_role_count
      FROM users u
      LEFT JOIN user_tenant_roles utr ON u.id = utr.user_id
      LEFT JOIN tenants t ON utr.tenant_id = t.id
      GROUP BY u.id
      ORDER BY u.id ASC
    `,
  );

  return rows.map(row => ({
    ...row,
    tenant_role_count: Number(row.tenant_role_count || 0),
    active_tenant_role_count: Number(row.active_tenant_role_count || 0),
  }));
}

async function fetchSuperUsers() {
  try {
    const [rows] = await db.execute(
      `
        SELECT id, username, real_name, email, phone, status, created_at, updated_at
        FROM super_users
        ORDER BY id ASC
      `,
    );
    return rows;
  } catch (error) {
    if (error && error.code === 'ER_NO_SUCH_TABLE') {
      return [];
    }
    throw error;
  }
}

function buildInsights(users, superUsers) {
  const usersByStatus = groupByCount(users, item => item.status);

  const usersWithoutTenantRoles = users
    .filter(item => item.tenant_role_count === 0)
    .map(item => ({ id: item.id, username: item.username, status: item.status }));

  const usersWithoutActiveTenantRoles = users
    .filter(item => item.tenant_role_count > 0 && item.active_tenant_role_count === 0)
    .map(item => ({ id: item.id, username: item.username, status: item.status }));

  const inactiveUsersWithActiveTenantRoles = users
    .filter(item => item.status !== 'active' && item.active_tenant_role_count > 0)
    .map(item => ({
      id: item.id,
      username: item.username,
      status: item.status,
      active_tenant_role_count: item.active_tenant_role_count,
    }));

  const usernameCounts = new Map();
  for (const item of users) {
    const key = item.username || '';
    usernameCounts.set(key, (usernameCounts.get(key) || 0) + 1);
  }
  for (const item of superUsers) {
    const key = item.username || '';
    usernameCounts.set(key, (usernameCounts.get(key) || 0) + 1);
  }

  const duplicatedUsernames = [...usernameCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([username, count]) => ({ username, count }))
    .sort((a, b) => b.count - a.count || a.username.localeCompare(b.username));

  return {
    users_by_status: usersByStatus,
    tenant_role_overview: {
      total_tenant_roles: users.reduce((sum, item) => sum + item.tenant_role_count, 0),
      total_active_tenant_roles: users.reduce((sum, item) => sum + item.active_tenant_role_count, 0),
      users_without_tenant_roles: usersWithoutTenantRoles.length,
      users_without_active_tenant_roles: usersWithoutActiveTenantRoles.length,
    },
    anomalies: {
      users_without_tenant_roles: usersWithoutTenantRoles,
      users_without_active_tenant_roles: usersWithoutActiveTenantRoles,
      inactive_users_with_active_tenant_roles: inactiveUsersWithActiveTenantRoles,
      duplicated_usernames_across_user_tables: duplicatedUsernames,
    },
  };
}

function buildReport(users, superUsers, generatedAt) {
  const insights = buildInsights(users, superUsers);

  return {
    generated_at: generatedAt.toISOString(),
    generated_at_local: generatedAt.toLocaleString('sv-SE', { hour12: false }).replace(' ', 'T'),
    total_users: users.length,
    total_super_users: superUsers.length,
    insights,
    users: users.map(item => ({
      id: item.id,
      username: item.username,
      real_name: item.real_name,
      email: item.email,
      phone: item.phone,
      status: item.status,
      created_at: item.created_at,
      updated_at: item.updated_at,
      tenant_roles: item.tenant_roles,
      tenant_role_count: item.tenant_role_count,
      active_tenant_role_count: item.active_tenant_role_count,
    })),
    super_users: superUsers,
  };
}

async function run() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return 0;
  }

  const generatedAt = new Date();
  const stamp = formatFileTimestamp(generatedAt);
  const baseName = `${options.prefix}-${stamp}`;

  fs.mkdirSync(options.outputDir, { recursive: true });

  const users = await fetchUsers();
  const superUsers = await fetchSuperUsers();
  const report = buildReport(users, superUsers, generatedAt);

  const jsonPath = path.join(options.outputDir, `${baseName}.json`);
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`JSON report written: ${jsonPath}`);

  if (options.includeCsv) {
    const csvPath = path.join(options.outputDir, `${baseName}.csv`);
    const csv = buildCsv(users, superUsers);
    fs.writeFileSync(csvPath, `${csv}\n`, 'utf8');
    console.log(`CSV report written: ${csvPath}`);
  }

  console.log(`Users: ${users.length}, super users: ${superUsers.length}`);
  console.log(
    `Users without tenant roles: ${report.insights.tenant_role_overview.users_without_tenant_roles}`,
  );
  console.log(
    `Users without active tenant roles: ${report.insights.tenant_role_overview.users_without_active_tenant_roles}`,
  );

  return 0;
}

async function main() {
  let exitCode = 1;
  try {
    exitCode = await run();
  } catch (error) {
    console.error('Failed to export users report:', error);
    exitCode = 1;
  } finally {
    try {
      await db.end();
    } catch (error) {
      console.warn('Database pool close warning:', error.message);
    }
  }
  process.exit(exitCode);
}

main();
