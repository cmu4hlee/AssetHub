#!/usr/bin/env node

/**
 * 数据库优化和修复脚本
 */

const db = require('../config/database');

async function checkAndFixOrphanedData() {
  console.log('='.repeat(80));
  console.log('🔍 检查孤立数据（使用正确的字段名）');
  console.log(`${'='.repeat(80)  }\n`);

  // 1. 检查 inventory_details 的实际字段
  console.log('1. 检查 inventory_details 表结构:');
  try {
    const [columns] = await db.execute(`
      SELECT COLUMN_NAME 
      FROM information_schema.columns 
      WHERE TABLE_SCHEMA = 'zcgl' AND TABLE_NAME = 'inventory_details'
    `);
    console.log('  字段:', columns.map(c => c.COLUMN_NAME).join(', '));
  } catch (e) {
    console.log('  错误:', e.message);
  }

  // 2. 检查 transfer_records 的实际字段
  console.log('\n2. 检查 transfer_records 表结构:');
  try {
    const [columns] = await db.execute(`
      SELECT COLUMN_NAME 
      FROM information_schema.columns 
      WHERE TABLE_SCHEMA = 'zcgl' AND TABLE_NAME = 'transfer_records'
    `);
    console.log('  字段:', columns.map(c => c.COLUMN_NAME).join(', '));
  } catch (e) {
    console.log('  错误:', e.message);
  }

  // 3. 检查 metrology_records 是否有 tenant_id
  console.log('\n3. 检查 metrology_records 表:');
  try {
    const [columns] = await db.execute(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM information_schema.columns 
      WHERE TABLE_SCHEMA = 'zcgl' AND TABLE_NAME = 'metrology_records'
      ORDER BY ORDINAL_POSITION
    `);
    console.log('  字段:', columns.map(c => `${c.COLUMN_NAME}(${c.IS_NULLABLE})`).join(', '));

    const hasTenantId = columns.some(c => c.COLUMN_NAME === 'tenant_id');
    console.log('  tenant_id:', hasTenantId ? '✅ 存在' : '❌ 不存在');

    // 检查现有索引
    const [indexes] = await db.execute(`
      SELECT INDEX_NAME, COLUMN_NAME
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = 'zcgl' AND TABLE_NAME = 'metrology_records'
      ORDER BY INDEX_NAME, SEQ_IN_INDEX
    `);
    console.log('  索引:', indexes.map(i => `${i.INDEX_NAME}(${i.COLUMN_NAME})`).join(', '));
  } catch (e) {
    console.log('  错误:', e.message);
  }

  // 4. 检查 quality_control_records
  console.log('\n4. 检查 quality_control_records 表:');
  try {
    const [columns] = await db.execute(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM information_schema.columns 
      WHERE TABLE_SCHEMA = 'zcgl' AND TABLE_NAME = 'quality_control_records'
      ORDER BY ORDINAL_POSITION
    `);
    console.log('  字段:', columns.map(c => `${c.COLUMN_NAME}(${c.IS_NULLABLE})`).join(', '));

    const hasTenantId = columns.some(c => c.COLUMN_NAME === 'tenant_id');
    console.log('  tenant_id:', hasTenantId ? '✅ 存在' : '❌ 不存在');

    // 检查现有索引
    const [indexes] = await db.execute(`
      SELECT INDEX_NAME, COLUMN_NAME
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = 'zcgl' AND TABLE_NAME = 'quality_control_records'
      ORDER BY INDEX_NAME, SEQ_IN_INDEX
    `);
    console.log('  索引:', indexes.map(i => `${i.INDEX_NAME}(${i.COLUMN_NAME})`).join(', '));
  } catch (e) {
    console.log('  错误:', e.message);
  }
}

async function addIndexes() {
  console.log(`\n${  '='.repeat(80)}`);
  console.log('🔧 添加索引优化');
  console.log(`${'='.repeat(80)  }\n`);

  // 1. 检查 metrology_records 是否有 tenant_id 字段
  const [metaColumns] = await db.execute(`
    SELECT COLUMN_NAME FROM information_schema.columns 
    WHERE TABLE_SCHEMA = 'zcgl' AND TABLE_NAME = 'metrology_records' AND COLUMN_NAME = 'tenant_id'
  `);

  if (metaColumns.length > 0) {
    console.log('✅ metrology_records 已有 tenant_id 字段，添加索引...');
    try {
      await db.execute('ALTER TABLE metrology_records ADD INDEX idx_tenant_id (tenant_id)');
      console.log('  ✅ idx_tenant_id 添加成功');
    } catch (e) {
      if (e.message.includes('Duplicate')) {
        console.log('  ℹ️ idx_tenant_id 已存在');
      } else {
        console.log('  ❌ 错误:', e.message);
      }
    }
  } else {
    console.log('⚠️ metrology_records 没有 tenant_id 字段，跳过');
  }

  // 2. 检查 quality_control_records 是否有 tenant_id 字段
  const [qcColumns] = await db.execute(`
    SELECT COLUMN_NAME FROM information_schema.columns 
    WHERE TABLE_SCHEMA = 'zcgl' AND TABLE_NAME = 'quality_control_records' AND COLUMN_NAME = 'tenant_id'
  `);

  if (qcColumns.length > 0) {
    console.log('✅ quality_control_records 已有 tenant_id 字段，添加索引...');
    try {
      await db.execute('ALTER TABLE quality_control_records ADD INDEX idx_tenant_id (tenant_id)');
      console.log('  ✅ idx_tenant_id 添加成功');
    } catch (e) {
      if (e.message.includes('Duplicate')) {
        console.log('  ℹ️ idx_tenant_id 已存在');
      } else {
        console.log('  ❌ 错误:', e.message);
      }
    }
  } else {
    console.log('⚠️ quality_control_records 没有 tenant_id 字段，跳过');
  }

  // 3. 为 metrology_records 添加其他常用索引
  console.log('\n添加 metrology_records 常用索引:');
  const indexes = [
    { name: 'idx_next_date', cols: 'next_metrology_date' },
    { name: 'idx_status', cols: 'status' },
    { name: 'idx_asset', cols: 'asset_id' },
  ];

  for (const idx of indexes) {
    try {
      await db.execute(`ALTER TABLE metrology_records ADD INDEX ${idx.name} (${idx.cols})`);
      console.log(`  ✅ ${idx.name} 添加成功`);
    } catch (e) {
      if (e.message.includes('Duplicate')) {
        console.log(`  ℹ️ ${idx.name} 已存在`);
      } else {
        console.log(`  ❌ 错误: ${e.message}`);
      }
    }
  }

  // 4. 为 quality_control_records 添加其他常用索引
  console.log('\n添加 quality_control_records 常用索引:');
  const qcIndexes = [
    { name: 'idx_next_date', cols: 'next_qc_date' },
    { name: 'idx_status', cols: 'status' },
    { name: 'idx_asset', cols: 'asset_id' },
  ];

  for (const idx of qcIndexes) {
    try {
      await db.execute(`ALTER TABLE quality_control_records ADD INDEX ${idx.name} (${idx.cols})`);
      console.log(`  ✅ ${idx.name} 添加成功`);
    } catch (e) {
      if (e.message.includes('Duplicate')) {
        console.log(`  ℹ️ ${idx.name} 已存在`);
      } else {
        console.log(`  ❌ 错误: ${e.message}`);
      }
    }
  }
}

async function verifyOptimization() {
  console.log(`\n${  '='.repeat(80)}`);
  console.log('✅ 验证优化结果');
  console.log(`${'='.repeat(80)  }\n`);

  // 验证 metrology_records 索引
  console.log('metrology_records 索引:');
  const [metaIndexes] = await db.execute(`
    SELECT INDEX_NAME, COLUMN_NAME
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = 'zcgl' AND TABLE_NAME = 'metrology_records'
    ORDER BY INDEX_NAME, SEQ_IN_INDEX
  `);
  const metaIndexMap = new Map();
  for (const idx of metaIndexes) {
    if (!metaIndexMap.has(idx.INDEX_NAME)) {
      metaIndexMap.set(idx.INDEX_NAME, []);
    }
    metaIndexMap.get(idx.INDEX_NAME).push(idx.COLUMN_NAME);
  }
  for (const [name, cols] of metaIndexMap) {
    console.log(`  - ${name}: (${cols.join(', ')})`);
  }

  // 验证 quality_control_records 索引
  console.log('\nquality_control_records 索引:');
  const [qcIndexes] = await db.execute(`
    SELECT INDEX_NAME, COLUMN_NAME
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = 'zcgl' AND TABLE_NAME = 'quality_control_records'
    ORDER BY INDEX_NAME, SEQ_IN_INDEX
  `);
  const qcIndexMap = new Map();
  for (const idx of qcIndexes) {
    if (!qcIndexMap.has(idx.INDEX_NAME)) {
      qcIndexMap.set(idx.INDEX_NAME, []);
    }
    qcIndexMap.get(idx.INDEX_NAME).push(idx.COLUMN_NAME);
  }
  for (const [name, cols] of qcIndexMap) {
    console.log(`  - ${name}: (${cols.join(', ')})`);
  }
}

async function main() {
  console.log('🔧 AssetHub 数据库优化工具');
  console.log('========================================\n');

  try {
    // 1. 检查当前结构
    await checkAndFixOrphanedData();

    // 2. 添加索引
    await addIndexes();

    // 3. 验证结果
    await verifyOptimization();

    console.log(`\n${  '='.repeat(80)}`);
    console.log('✅ 优化完成！');
    console.log('='.repeat(80));

    process.exit(0);
  } catch (error) {
    console.error('\n❌ 错误:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
