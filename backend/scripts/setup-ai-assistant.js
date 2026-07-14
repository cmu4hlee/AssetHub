#!/usr/bin/env node

const { database: dbConfig } = require('../config/app.config');

async function executeSql() {
  const mysql = require('mysql2/promise');

  const masterConfig = dbConfig.master;
  const slaveConfig = dbConfig.slave;

  let connection;
  try {
    console.log('正在连接数据库...');
    console.log(`主机: ${masterConfig.host}`);
    console.log(`数据库: ${masterConfig.database}`);
    console.log(`用户: ${masterConfig.user}`);

    connection = await mysql.createConnection({
      host: masterConfig.host,
      port: masterConfig.port,
      user: masterConfig.user,
      password: masterConfig.password,
      database: masterConfig.database,
      multipleStatements: true,
    });

    console.log('数据库连接成功！');

    const sql = `
-- 资产AI助手模块配置

-- 1. 检查并添加系统模块
INSERT INTO system_modules (
    id, name, version, description, category, type, status, author,
    dependencies, compatibility, frontend_config, backend_config,
    config_schema, default_config, interfaces, created_at, updated_at
) VALUES (
    'asset-ai-assistant',
    '资产AI助手',
    '1.0.0',
    '统一的资产AI助手入口，整合SQL智能分析、文档智能助手、维修AI助手和智能搜索功能',
    'ai',
    'unified',
    'stable',
    'System',
    '["sqlbot", "technical-documents-ai", "maintenance-ai"]',
    NULL,
    '{"entryPath": "/ai-assistant", "modes": ["sqlbot", "documents", "maintenance", "search"], "iframeUrl": "http://localhost:8000/#/zcgl"}',
    NULL,
    '{"modes": {"type": "array", "items": {"type": "string"}, "default": ["sqlbot", "documents", "maintenance", "search"]}, "iframeEnabled": {"type": "boolean", "default": true}}',
    '{"modes": ["sqlbot", "documents", "maintenance", "search"], "iframeEnabled": true, "defaultMode": "sqlbot"}',
    NULL,
    NOW(),
    NOW()
) ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    version = VALUES(version),
    description = VALUES(description),
    frontend_config = VALUES(frontend_config),
    default_config = VALUES(default_config),
    updated_at = NOW();

-- 2. 确保父菜单存在
INSERT INTO menu_definitions (menu_key, menu_label, parent_key, icon, order_index, is_active)
VALUES ('ai-assistant-parent', '资产AI助手', NULL, 'RobotOutlined', 15, 1)
ON DUPLICATE KEY UPDATE menu_label = VALUES(menu_label);

-- 3. 添加子菜单到 ai-assistant-parent
INSERT INTO menu_definitions (menu_key, menu_label, parent_key, icon, order_index, is_active)
VALUES
    ('/ai-assistant', '统一AI入口', 'ai-assistant-parent', 'AppstoreOutlined', 1, 1)
ON DUPLICATE KEY UPDATE menu_label = VALUES(menu_label);

SELECT '菜单配置完成！' AS status;
    `;

    await connection.query(sql);
    console.log('SQL执行成功！');
  } catch (error) {
    console.error('执行失败:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('数据库连接已关闭');
    }
  }
}

executeSql();
