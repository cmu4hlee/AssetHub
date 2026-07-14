#!/bin/sh
set -e

echo "=== AssetHub Backend (fnOS) 启动中 ==="

# 等待 MySQL 就绪（最多 90 秒）
echo "等待 MySQL 就绪..."
MAX_RETRIES=30
RETRY_COUNT=0

DB_HOST_VALUE="${DB_HOST:-mysql}"
DB_PORT_VALUE="${DB_PORT:-3306}"
DB_USER_VALUE="${DB_USER:-root}"
DB_PASSWORD_VALUE="${DB_PASSWORD:-assethub2024}"

until node -e "
const net = require('net');
const s = new net.Socket();
s.setTimeout(2000);
s.on('connect', () => { s.destroy(); process.exit(0); });
s.on('timeout', () => { s.destroy(); process.exit(1); });
s.on('error', () => process.exit(1));
s.connect(${DB_PORT_VALUE}, '${DB_HOST_VALUE}');
" 2>/dev/null; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    echo "❌ MySQL 连接超时（${DB_HOST_VALUE}:${DB_PORT_VALUE}）"
    exit 1
  fi
  echo "MySQL 未就绪 ($RETRY_COUNT/$MAX_RETRIES)，5 秒后重试..."
  sleep 5
done
echo "✅ MySQL 已就绪"

# 检查数据库是否存在；不存在则初始化
node -e "
const mysql = require('mysql2/promise');
(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '${DB_HOST_VALUE}',
    port: parseInt(process.env.DB_PORT || '${DB_PORT_VALUE}', 10),
    user: process.env.DB_USER || '${DB_USER_VALUE}',
    password: process.env.DB_PASSWORD || '${DB_PASSWORD_VALUE}',
    multipleStatements: true,
  });
  const [rows] = await conn.query(\"SHOW DATABASES LIKE 'zcgl'\");
  if (rows.length === 0) {
    console.log('数据库 zcgl 不存在，开始初始化...');
    await conn.query('CREATE DATABASE zcgl CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    console.log('✅ 已创建数据库 zcgl');

    const fs = require('fs');
    const schema = fs.readFileSync('/app/config/init-schema.sql', 'utf8');
    await conn.query('USE zcgl');
    await conn.query(schema);
    console.log('✅ 已初始化 194 张表');

    const seed = fs.readFileSync('/app/config/init-seed-data.sql', 'utf8');
    await conn.query(seed);
    console.log('✅ 已写入种子数据');

    // 给 tenant 1 启用模块（包括 ai-services），让管理员能调用 AI 助手
    const modules = ['asset-management', 'ai-services', 'user-management', 'iot-management', 'integration', 'system'];
    for (const m of modules) {
      try {
        await conn.query(\"INSERT IGNORE INTO zcgl.system_modules (id, name, version, description, category, type, status) VALUES (?, ?, '1.0.0', ?, 'core', 'builtin', 'stable')\", [m, m, m]);
        await conn.query(\"INSERT IGNORE INTO zcgl.tenant_module_configs (tenant_id, module_id, enabled) VALUES (1, ?, 1)\", [m]);
      } catch (e) {
        console.warn('初始化模块', m, '失败:', e.message);
      }
    }
    console.log('✅ 已为 tenant 1 启用模块');
  } else {
    console.log('✅ 数据库 zcgl 已存在，跳过初始化');
  }
  await conn.end();
})().catch(e => { console.error('数据库初始化失败:', e); process.exit(1); });
"

echo "=== 启动 Node.js 应用 ==="
cd /app
exec node server.js