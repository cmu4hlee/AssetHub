/**
 * 修复用户数据质量问题
 *
 * 用法：
 *   node backend/fix-user-data-quality.js            # 默认 dry-run，只打印不修改
 *   node backend/fix-user-data-quality.js --apply    # 真正执行修复
 *
 * 修复项：
 *   1) 清理 users.email / users.phone / users.real_name 等字段里
 *      被错误写入了字符串 "null" / "undefined" / "NULL" / "None" 的脏数据 → 改为 NULL
 *   2) 同步 users.tenant_id 到 user_tenant_roles.is_default=1 那条的 tenant_id
 *      （仅当两者不一致、且 utr.is_default=1 记录存在时执行）
 *   3) 补齐没有 user_tenant_roles 记录的 active 用户：插入一条
 *      (tenant_id = users.tenant_id, role='user', is_default=1)
 *      —— listUsers / getUserById 用 LEFT JOIN 过滤时，这些用户会变成"查不到"的孤儿
 */
const db = require('./config/database');

const DIRTY_STRING_VALUES = new Set(['null', 'undefined', 'NULL', 'None', 'NaN', '']);
const isApply = process.argv.includes('--apply');

function logResult(label, value) {
  console.log(`  ${label.padEnd(38, ' ')} ${value}`);
}

async function checkConnection() {
  try {
    const [rows] = await db.execute('SELECT 1 AS ok');
    if (!rows || rows[0].ok !== 1) throw new Error('unexpected ping result');
    console.log('✅ 数据库连接正常');
    return true;
  } catch (err) {
    console.error('❌ 数据库连接失败:', err.message);
    return false;
  }
}

async function findDirtyStringRows() {
  // 找出字段值是字符串 "null"/"undefined" 等的记录
  const fields = ['email', 'phone', 'real_name', 'department_code', 'username'];
  const results = [];
  for (const field of fields) {
    const placeholders = [...DIRTY_STRING_VALUES].map(() => '?').join(',');
    const [rows] = await db.execute(
      `SELECT id, username, \`${field}\` AS dirty_value
       FROM users
       WHERE \`${field}\` IN (${placeholders})`,
      [...DIRTY_STRING_VALUES],
    );
    if (rows.length > 0) {
      results.push({ field, rows });
    }
  }
  return results;
}

async function fixDirtyStringRows(dirtyList) {
  let totalFixed = 0;
  for (const { field, rows } of dirtyList) {
    const ids = rows.map(r => r.id);
    const placeholders = ids.map(() => '?').join(',');
    const sql = `UPDATE users SET \`${field}\` = NULL, updated_at = NOW() WHERE id IN (${placeholders})`;
    const [result] = await db.execute(sql, ids);
    totalFixed += result.affectedRows;
    logResult(`UPDATE users.${field} (${rows.length} 行)`, `affectedRows=${result.affectedRows}`);
  }
  return totalFixed;
}

async function findInconsistentTenantUsers() {
  const [rows] = await db.execute(
    `SELECT u.id, u.username, u.real_name, u.tenant_id AS users_tenant_id,
            utr.tenant_id AS default_role_tenant_id, utr.role AS default_role,
            (SELECT COUNT(*) FROM user_tenant_roles utr2 WHERE utr2.user_id = u.id) AS total_roles
     FROM users u
     JOIN user_tenant_roles utr
       ON utr.user_id = u.id AND utr.is_default = 1
     WHERE u.tenant_id <> utr.tenant_id`
  );
  return rows;
}

async function fixInconsistentTenantUsers(rows) {
  let totalFixed = 0;
  for (const r of rows) {
    const [result] = await db.execute(
      'UPDATE users SET tenant_id = ?, updated_at = NOW() WHERE id = ?',
      [r.default_role_tenant_id, r.id]
    );
    totalFixed += result.affectedRows;
    logResult(
      `users.id=${r.id} (${r.username}): tenant_id ${r.users_tenant_id} → ${r.default_role_tenant_id}`,
      `affectedRows=${result.affectedRows}`
    );
  }
  return totalFixed;
}

async function findOrphanUsers() {
  // 找出 status=active 但完全没有任何 user_tenant_roles 记录的用户
  // ——这些用户会被 listUsers / getUserById 的 LEFT JOIN + tenant_id 过滤逻辑漏掉
  const [rows] = await db.execute(
    `SELECT u.id, u.username, u.real_name, u.tenant_id
     FROM users u
     LEFT JOIN user_tenant_roles utr ON utr.user_id = u.id
     WHERE u.status = 'active' AND utr.id IS NULL`
  );
  return rows;
}

async function fixOrphanUsers(rows) {
  let totalFixed = 0;
  for (const r of rows) {
    const [result] = await db.execute(
      `INSERT INTO user_tenant_roles
         (user_id, tenant_id, role, is_default, status, created_at, updated_at)
       VALUES (?, ?, 'user', 1, 'active', NOW(), NOW())`,
      [r.id, r.tenant_id]
    );
    totalFixed += result.affectedRows;
    logResult(
      `INSERT user_tenant_roles for id=${r.id} (${r.username})`,
      `affectedRows=${result.affectedRows}, tenant_id=${r.tenant_id}, role=user, is_default=1`
    );
  }
  return totalFixed;
}

async function main() {
  console.log('============================================================');
  console.log('  用户数据质量修复脚本');
  console.log(`  模式: ${isApply ? '🔴 APPLY（真修改）' : '🟢 DRY-RUN（仅查看）'}`);
  console.log('============================================================');

  if (!(await checkConnection())) {
    process.exit(1);
  }

  // 步骤 1：脏字符串
  console.log('\n[1/2] 扫描字符串脏数据 (email/phone/real_name/...= "null" / "undefined" / ...)...');
  const dirtyList = await findDirtyStringRows();
  if (dirtyList.length === 0) {
    console.log('  ✅ 无脏字符串数据');
  } else {
    let totalRows = 0;
    for (const { field, rows } of dirtyList) {
      console.log(`  ⚠️  字段 ${field}: ${rows.length} 行`);
      for (const r of rows) {
        console.log(`     - id=${r.id} username=${r.username} 当前值=${JSON.stringify(r.dirty_value)}`);
      }
      totalRows += rows.length;
    }
    logResult('脏字符串总行数', totalRows);

    if (isApply) {
      console.log('\n  🚧 执行修复...');
      const fixed = await fixDirtyStringRows(dirtyList);
      logResult('实际修复行数', fixed);
    } else {
      console.log('\n  ⏭️  DRY-RUN 模式，未修改。加 --apply 真正执行。');
    }
  }

  // 步骤 2：tenant_id 不一致
  console.log('\n[2/3] 扫描 users.tenant_id 与 user_tenant_roles.is_default=1.tenant_id 不一致...');
  const inconsistent = await findInconsistentTenantUsers();
  if (inconsistent.length === 0) {
    console.log('  ✅ tenant_id 一致');
  } else {
    for (const r of inconsistent) {
      console.log(
        `  ⚠️  id=${r.id} ${r.username}: users.tenant_id=${r.users_tenant_id}, utr.is_default=1.tenant_id=${r.default_role_tenant_id} (role=${r.default_role}, 共 ${r.total_roles} 个角色)`
      );
    }
    logResult('不一致用户数', inconsistent.length);

    if (isApply) {
      console.log('\n  🚧 执行修复: users.tenant_id → utr.is_default=1.tenant_id ...');
      const fixed = await fixInconsistentTenantUsers(inconsistent);
      logResult('实际修复行数', fixed);
    } else {
      console.log('\n  ⏭️  DRY-RUN 模式，未修改。加 --apply 真正执行。');
    }
  }

  // 步骤 3：孤儿用户（无任何 utr 记录）
  console.log('\n[3/3] 扫描 status=active 但没有 user_tenant_roles 记录的用户...');
  const orphans = await findOrphanUsers();
  if (orphans.length === 0) {
    console.log('  ✅ 无孤儿用户');
  } else {
    for (const r of orphans) {
      console.log(`  ⚠️  id=${r.id} ${r.username} (${r.real_name || '未填'}): users.tenant_id=${r.tenant_id}`);
    }
    logResult('孤儿用户数', orphans.length);

    if (isApply) {
      console.log('\n  🚧 执行修复: 插入 user_tenant_roles (role=user, is_default=1)...');
      const fixed = await fixOrphanUsers(orphans);
      logResult('实际插入行数', fixed);
    } else {
      console.log('\n  ⏭️  DRY-RUN 模式，未修改。加 --apply 真正执行。');
    }
  }

  console.log('\n============================================================');
  console.log(`  完成。${isApply ? '已写入数据库。' : '未修改任何数据。'}`);
  console.log('============================================================');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ 脚本异常:', err);
  console.error(err.stack);
  process.exit(1);
});
