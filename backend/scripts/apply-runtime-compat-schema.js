#!/usr/bin/env node

const path = require('path');
const mysql = require('mysql2/promise');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const connectionConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number.parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'zcgl',
  multipleStatements: true,
};

const REQUIRED_TABLES = {
  tenants: `
    CREATE TABLE IF NOT EXISTS tenants (
      id INT PRIMARY KEY AUTO_INCREMENT,
      tenant_code VARCHAR(50) NOT NULL UNIQUE,
      tenant_name VARCHAR(200) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `,
  users: `
    CREATE TABLE IF NOT EXISTS users (
      id INT PRIMARY KEY AUTO_INCREMENT,
      username VARCHAR(50) NOT NULL UNIQUE,
      password VARCHAR(100) NOT NULL,
      real_name VARCHAR(50) NOT NULL,
      department_code VARCHAR(50) NULL,
      role VARCHAR(50) NULL,
      tenant_id INT NULL,
      email VARCHAR(100) NULL,
      phone VARCHAR(20) NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NULL,
      INDEX idx_users_status (status),
      INDEX idx_users_tenant_id (tenant_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `,
  user_tenant_roles: `
    CREATE TABLE IF NOT EXISTS user_tenant_roles (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      tenant_id INT NOT NULL,
      role VARCHAR(50) NOT NULL,
      managed_departments TEXT NULL,
      is_default TINYINT(1) NOT NULL DEFAULT 0,
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NULL,
      UNIQUE KEY uk_user_tenant (user_id, tenant_id),
      INDEX idx_utr_tenant (tenant_id),
      INDEX idx_utr_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `,
  user_managed_departments: `
    CREATE TABLE IF NOT EXISTS user_managed_departments (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      tenant_id INT NOT NULL,
      department_code VARCHAR(50) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_user_tenant_dept (user_id, tenant_id, department_code),
      INDEX idx_umd_tenant (tenant_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `,
  tenant_module_configs: `
    CREATE TABLE IF NOT EXISTS tenant_module_configs (
      id INT PRIMARY KEY AUTO_INCREMENT,
      tenant_id INT NOT NULL,
      module_id VARCHAR(100) NOT NULL,
      enabled TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NULL,
      UNIQUE KEY uk_tenant_module (tenant_id, module_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `,
  technical_documents: `
    CREATE TABLE IF NOT EXISTS technical_documents (
      id INT PRIMARY KEY AUTO_INCREMENT,
      asset_type VARCHAR(200) NULL,
      file_name VARCHAR(255) NOT NULL,
      file_type VARCHAR(100) NULL,
      file_size BIGINT NULL,
      upload_date DATETIME NULL,
      description TEXT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_td_asset_type (asset_type),
      INDEX idx_td_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `,
  staff_qualifications: `
    CREATE TABLE IF NOT EXISTS staff_qualifications (
      id INT PRIMARY KEY AUTO_INCREMENT,
      tenant_id INT NOT NULL,
      user_id INT NULL,
      qualification_type VARCHAR(100) NULL,
      qualification_name VARCHAR(200) NULL,
      certificate_number VARCHAR(100) NULL,
      expiry_date DATE NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NULL,
      INDEX idx_sq_tenant (tenant_id),
      INDEX idx_sq_expiry (expiry_date),
      INDEX idx_sq_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `,
  special_equipment: `
    CREATE TABLE IF NOT EXISTS special_equipment (
      id INT PRIMARY KEY AUTO_INCREMENT,
      tenant_id INT NOT NULL,
      asset_id INT NULL,
      equipment_code VARCHAR(100) NULL,
      equipment_name VARCHAR(200) NULL,
      equipment_type VARCHAR(100) NULL,
      next_inspection_date DATE NULL,
      registration_code VARCHAR(100) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NULL,
      INDEX idx_se_tenant (tenant_id),
      INDEX idx_se_next_inspection (next_inspection_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `,
  safety_inspections: `
    CREATE TABLE IF NOT EXISTS safety_inspections (
      id INT PRIMARY KEY AUTO_INCREMENT,
      tenant_id INT NOT NULL,
      asset_id INT NULL,
      inspection_code VARCHAR(100) NULL,
      inspection_name VARCHAR(200) NULL,
      inspection_type VARCHAR(100) NULL,
      next_inspection_date DATE NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NULL,
      INDEX idx_si_tenant (tenant_id),
      INDEX idx_si_next_inspection (next_inspection_date),
      INDEX idx_si_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `,
  uptime_statistics: `
    CREATE TABLE IF NOT EXISTS uptime_statistics (
      id INT PRIMARY KEY AUTO_INCREMENT,
      tenant_id INT NOT NULL,
      asset_id INT NULL,
      statistics_date DATE NOT NULL,
      uptime_rate DECIMAL(5,2) NOT NULL DEFAULT 100.00,
      planned_hours DECIMAL(10,2) NULL,
      actual_hours DECIMAL(10,2) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NULL,
      INDEX idx_us_tenant_date (tenant_id, statistics_date),
      INDEX idx_us_uptime_rate (uptime_rate)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `,
};

const REQUIRED_COLUMNS = [
  { table: 'assets', column: 'is_deleted', definition: 'TINYINT(1) NOT NULL DEFAULT 0' },
  { table: 'assets', column: 'deleted_at', definition: 'DATETIME NULL' },
  { table: 'assets', column: 'deleted_by', definition: 'INT NULL' },
  { table: 'inventory_records', column: 'is_deleted', definition: 'TINYINT(1) NOT NULL DEFAULT 0' },
  { table: 'inventory_records', column: 'deleted_at', definition: 'DATETIME NULL' },
  { table: 'inventory_records', column: 'deleted_by', definition: 'INT NULL' },
  { table: 'inventory_details', column: 'is_deleted', definition: 'TINYINT(1) NOT NULL DEFAULT 0' },
  { table: 'inventory_details', column: 'deleted_at', definition: 'DATETIME NULL' },
  { table: 'inventory_details', column: 'deleted_by', definition: 'INT NULL' },
];

const REQUIRED_INDEXES = [
  { table: 'assets', index: 'idx_assets_is_deleted', definition: '(is_deleted)' },
  { table: 'inventory_records', index: 'idx_inventory_records_is_deleted', definition: '(is_deleted)' },
  { table: 'inventory_details', index: 'idx_inventory_details_is_deleted', definition: '(is_deleted)' },
];

async function tableExists(connection, tableName) {
  const [rows] = await connection.query(
    `SELECT 1
       FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
      LIMIT 1`,
    [tableName],
  );
  return rows.length > 0;
}

async function columnExists(connection, tableName, columnName) {
  const [rows] = await connection.query(
    `SELECT 1
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
      LIMIT 1`,
    [tableName, columnName],
  );
  return rows.length > 0;
}

async function indexExists(connection, tableName, indexName) {
  const [rows] = await connection.query(
    `SELECT 1
       FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND INDEX_NAME = ?
      LIMIT 1`,
    [tableName, indexName],
  );
  return rows.length > 0;
}

async function ensureActiveTenant(connection) {
  if (!(await tableExists(connection, 'tenants'))) {
    return;
  }

  const [rows] = await connection.query(
    "SELECT COUNT(*) AS total FROM tenants WHERE status = 'active'",
  );

  if (Number(rows[0]?.total || 0) > 0) {
    return;
  }

  await connection.query(
    `INSERT INTO tenants (tenant_code, tenant_name, status, created_at)
     VALUES (?, ?, 'active', NOW())`,
    ['default', 'Default Tenant'],
  );

  console.log('  + inserted default active tenant');
}

async function applyRuntimeCompatSchema() {
  const connection = await mysql.createConnection(connectionConfig);
  try {
    console.log('Applying runtime compatibility schema patch...');
    console.log(
      `DB ${connectionConfig.user}@${connectionConfig.host}:${connectionConfig.port}/${connectionConfig.database}`,
    );

    for (const [tableName, createSql] of Object.entries(REQUIRED_TABLES)) {
      await connection.query(createSql);
      console.log(`  + ensured table: ${tableName}`);
    }

    for (const item of REQUIRED_COLUMNS) {
      const hasTable = await tableExists(connection, item.table);
      if (!hasTable) {
        console.log(`  - skipped column ${item.table}.${item.column} (table missing)`);
        continue;
      }

      const hasColumn = await columnExists(connection, item.table, item.column);
      if (hasColumn) {
        continue;
      }

      await connection.query(
        `ALTER TABLE \`${item.table}\` ADD COLUMN \`${item.column}\` ${item.definition}`,
      );
      console.log(`  + added column: ${item.table}.${item.column}`);
    }

    for (const item of REQUIRED_INDEXES) {
      const hasTable = await tableExists(connection, item.table);
      if (!hasTable) {
        console.log(`  - skipped index ${item.index} (table missing)`);
        continue;
      }

      const hasIndex = await indexExists(connection, item.table, item.index);
      if (hasIndex) {
        continue;
      }

      await connection.query(
        `ALTER TABLE \`${item.table}\` ADD INDEX \`${item.index}\` ${item.definition}`,
      );
      console.log(`  + added index: ${item.table}.${item.index}`);
    }

    await ensureActiveTenant(connection);

    console.log('Runtime compatibility schema patch completed.');
  } finally {
    await connection.end();
  }
}

applyRuntimeCompatSchema().catch(error => {
  console.error('Runtime compatibility schema patch failed:', error.message);
  process.exitCode = 1;
});
