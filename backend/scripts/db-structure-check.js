#!/usr/bin/env node

/**
 * 数据库结构检查工具 - 使用项目现有数据库配置
 */

const db = require('../config/database');

async function main() {
  console.log('🔧 AssetHub 数据库结构检查工具');
  console.log('========================================\n');

  try {
    // 1. 检查表统计
    console.log('='.repeat(80));
    console.log('📊 检查数据库表结构');
    console.log(`${'='.repeat(80)  }\n`);

    const [tables] = await db.execute(`
      SELECT 
        table_name,
        table_rows,
        ROUND(data_length / 1024 / 1024, 2) AS data_size_mb,
        ROUND(index_length / 1024 / 1024, 2) AS index_size_mb
      FROM information_schema.tables 
      WHERE table_schema = 'zcgl' 
        AND table_type = 'BASE TABLE'
      ORDER BY data_length DESC
    `);

    console.log('表统计信息:');
    console.log('-'.repeat(60));
    for (const table of tables.slice(0, 20)) {
      console.log(`  ${String(table.table_name).padEnd(30)} | ${String(table.table_rows).padEnd(12)} | ${String(table.data_size_mb).padEnd(8)}MB | ${table.index_size_mb}MB`);
    }

    console.log(`\n共 ${tables.length} 个表\n`);

    // 2. 检查 tenant_id 支持
    console.log('='.repeat(80));
    console.log('🔍 检查 tenant_id 支持情况');
    console.log(`${'='.repeat(80)  }\n`);

    const [tenantTables] = await db.execute(`
      SELECT DISTINCT TABLE_NAME
      FROM information_schema.columns 
      WHERE table_schema = 'zcgl' AND COLUMN_NAME = 'tenant_id'
      ORDER BY TABLE_NAME
    `);

    console.log(`✅ 有 tenant_id 字段的表 (${tenantTables.length}个):`);
    for (const t of tenantTables) {
      console.log(`  - ${t.TABLE_NAME}`);
    }

    // 3. 检查外键
    console.log(`\n${  '='.repeat(80)}`);
    console.log('🔍 检查外键约束');
    console.log(`${'='.repeat(80)  }\n`);

    const [foreignKeys] = await db.execute(`
      SELECT 
        CONSTRAINT_NAME,
        TABLE_NAME,
        COLUMN_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = 'zcgl' AND REFERENCED_TABLE_NAME IS NOT NULL
      ORDER BY TABLE_NAME
    `);

    if (foreignKeys.length === 0) {
      console.log('⚠️ 没有找到外键约束！');
    } else {
      console.log(`✅ 有 ${foreignKeys.length} 个外键约束:`);
      for (const fk of foreignKeys.slice(0, 15)) {
        console.log(`  ${fk.TABLE_NAME}.${fk.COLUMN_NAME} -> ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}`);
      }
    }

    // 4. 检查孤立数据
    console.log(`\n${  '='.repeat(80)}`);
    console.log('🔍 检查孤立数据');
    console.log(`${'='.repeat(80)  }\n`);

    const checks = [
      { name: 'inventory_details.asset_id', sql: 'SELECT COUNT(*) as cnt FROM inventory_details i LEFT JOIN assets a ON i.asset_id = a.id WHERE a.id IS NULL AND i.asset_id IS NOT NULL' },
      { name: 'transfer_records.asset_id', sql: 'SELECT COUNT(*) as cnt FROM transfer_records t LEFT JOIN assets a ON t.asset_id = a.id WHERE a.id IS NULL AND t.asset_id IS NOT NULL' },
      { name: 'idle_assets.asset_id', sql: 'SELECT COUNT(*) as cnt FROM idle_assets i LEFT JOIN assets a ON i.asset_id = a.id WHERE a.id IS NULL AND i.asset_id IS NOT NULL' },
    ];

    for (const check of checks) {
      try {
        const [result] = await db.execute(check.sql);
        if (result[0].cnt > 0) {
          console.log(`⚠️ ${check.name}: ${result[0].cnt} 条孤立数据`);
        } else {
          console.log(`✅ ${check.name}: 无孤立数据`);
        }
      } catch (e) {
        console.log(`⚠️ ${check.name}: 无法检查`);
      }
    }

    // 5. 检查 assets 表索引
    console.log(`\n${  '='.repeat(80)}`);
    console.log('🔍 检查 assets 表索引');
    console.log(`${'='.repeat(80)  }\n`);

    const [indexes] = await db.execute(`
      SELECT INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = 'zcgl' AND TABLE_NAME = 'assets'
      ORDER BY INDEX_NAME, SEQ_IN_INDEX
    `);

    console.log('assets 表索引:');
    const indexMap = new Map();
    for (const idx of indexes) {
      if (!indexMap.has(idx.INDEX_NAME)) {
        indexMap.set(idx.INDEX_NAME, []);
      }
      indexMap.get(idx.INDEX_NAME).push(idx.COLUMN_NAME);
    }
    for (const [name, cols] of indexMap) {
      console.log(`  - ${name}: (${cols.join(', ')})`);
    }

    // 检查是否有 tenant_id + status 复合索引
    let hasTenantStatusIndex = false;
    for (const [name, cols] of indexMap) {
      if (cols.includes('tenant_id') && cols.includes('status')) {
        hasTenantStatusIndex = true;
        break;
      }
    }

    if (!hasTenantStatusIndex) {
      console.log('\n⚠️ 缺少 tenant_id+status 复合索引');
      console.log('💡 建议: ALTER TABLE assets ADD INDEX idx_tenant_status (tenant_id, status);');
    } else {
      console.log('\n✅ 已有的复合索引');
    }

    // 6. 生成优化SQL
    console.log(`\n${  '='.repeat(80)}`);
    console.log('📝 建议的优化SQL');
    console.log(`${'='.repeat(80)  }\n`);

    const optimizationSQL = `
-- ============================================
-- 1. assets 表复合索引优化
-- ============================================
ALTER TABLE assets ADD INDEX idx_tenant_status (tenant_id, status);
ALTER TABLE assets ADD INDEX idx_tenant_category (tenant_id, category_id);
ALTER TABLE assets ADD INDEX idx_tenant_created (tenant_id, created_at);

-- ============================================
-- 2. inventory_records 表索引优化
-- ============================================
ALTER TABLE inventory_records ADD INDEX idx_tenant_status (tenant_id, status);

-- ============================================
-- 3. transfer_records 表索引优化
-- ============================================
ALTER TABLE transfer_records ADD INDEX idx_tenant_status (tenant_id, status);

-- ============================================
-- 4. metrology_records 表索引优化（添加tenant_id支持）
-- ============================================
ALTER TABLE metrology_records ADD INDEX idx_tenant_id (tenant_id);
ALTER TABLE metrology_records ADD INDEX idx_tenant_status (tenant_id, status);

-- ============================================
-- 5. quality_control_records 表索引优化
-- ============================================
ALTER TABLE quality_control_records ADD INDEX idx_tenant_id (tenant_id);
ALTER TABLE quality_control_records ADD INDEX idx_tenant_status (tenant_id, status);

-- ============================================
-- 6. 添加外键约束
-- ============================================
ALTER TABLE inventory_details 
  ADD CONSTRAINT fk_inventory_details_asset 
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE;

ALTER TABLE transfer_records 
  ADD CONSTRAINT fk_transfer_records_asset 
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE;
`;
    console.log(optimizationSQL);

    console.log(`\n${  '='.repeat(80)}`);
    console.log('✅ 检查完成！');
    console.log('='.repeat(80));

    process.exit(0);
  } catch (error) {
    console.error('❌ 错误:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
