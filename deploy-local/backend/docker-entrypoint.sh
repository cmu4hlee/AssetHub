#!/bin/sh
set -e

echo "=== AssetHub Docker 启动脚本 ==="

# 等待数据库就绪
echo "[1/3] 等待数据库连接..."
RETRIES=30
until node -e "
  const mysql = require('mysql2/promise');
  mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  }).then(c => { c.end(); process.exit(0); }).catch(() => process.exit(1));
" 2>/dev/null; do
  RETRIES=$((RETRIES - 1))
  if [ $RETRIES -le 0 ]; then
    echo "  数据库连接超时，继续启动..."
    break
  fi
  sleep 2
done
echo "  数据库连接成功"

# 运行数据库初始化（仅在首次启动时）
echo "[2/3] 初始化数据库..."
node -e "
const mysql = require('mysql2/promise');
const fs = require('fs');
require('dotenv').config();

async function init() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true,
  });

  // 检查是否已初始化
  const [rows] = await conn.query('SELECT COUNT(*) as cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?', [process.env.DB_NAME || 'zcgl', 'super_users']);
  if (rows[0].cnt > 0) {
    console.log('  数据库已初始化，跳过');
    await conn.end();
    return;
  }

  console.log('  执行表结构初始化...');
  const schema = fs.readFileSync('/app/config/init-schema.sql', 'utf8');
  await conn.query(schema);

  console.log('  执行初始数据导入...');
  const seed = fs.readFileSync('/app/config/init-seed-data.sql', 'utf8');
  await conn.query(seed);

  console.log('  数据库初始化完成');
  await conn.end();
}

init().catch(e => { console.error('  初始化失败:', e.message); process.exit(0); });
" || echo "  数据库初始化跳过（可能已完成）"

# 启动后端服务
echo "[3/3] 启动后端服务..."
exec npm start
