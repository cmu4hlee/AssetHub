/**
 * Migration: 修复 assets 表 asset_code 全局 UNIQUE 约束
 *
 * 问题：
 *   - init.sql 中 asset_code 是 UNIQUE（全局唯一）
 *   - 多租户系统下，不同租户不能使用相同的 asset_code
 *   - 并发场景下前端临时生成的 AST-{时间戳}-{随机} 可能撞码
 *
 * 修复：
 *   - 删除 assets.asset_code 上的全局 UNIQUE 约束
 *   - 改为联合 UNIQUE(tenant_id, asset_code)：同租户内不可重复，跨租户允许
 *   - 保留 idx_asset_code 单列索引以兼容历史查询性能
 *
 * 运行：node backend/migrations/20260712_assets_tenant_unique_code.js
 */

const db = require('../config/database');

// MySQL 5.7+ 允许 IF EXISTS 语法；为兼容 5.6 用 try/catch 兜底
const safeAlter = async (sql, description) => {
  try {
    await db.execute(sql);
    console.log(`✅ ${description}`);
  } catch (err) {
    // 重复操作不算错误（约束可能已经存在或不存在）
    if (
      err.code === 'ER_DUP_KEYNAME' || // 索引已存在
      err.code === 'ER_CANT_DROP_FIELD_OR_KEY' || // 索引不存在
      err.errno === 1061 ||
      err.errno === 1091
    ) {
      console.log(`⏭️  ${description} （已处于目标状态）`);
      return;
    }
    throw err;
  }
};

async function migrate() {
  console.log('🔧 开始修复 assets 表 UNIQUE 约束...');

  try {
    // 1. 查清数据库名（用于 SHOW INDEX）
    const [dbRows] = await db.execute('SELECT DATABASE() AS db');
    const dbName = dbRows[0]?.db;
    if (!dbName) {
      throw new Error('无法获取当前数据库名');
    }
    console.log(`📦 当前数据库: ${dbName}`);

    // 2. 查清 assets 表上 asset_code 相关的索引
    const [indexes] = await db.execute(
      `SHOW INDEX FROM \`${dbName}\`.assets WHERE Column_name = 'asset_code'`
    );
    console.log(`📋 assets.asset_code 上现有索引:`);
    const grouped = {};
    indexes.forEach(row => {
      if (!grouped[row.Key_name]) grouped[row.Key_name] = [];
      grouped[row.Key_name].push(row);
    });
    Object.entries(grouped).forEach(([name, rows]) => {
      const cols = rows.map(r => `${r.Column_name}(${r.Sub_part || 'full'})`).join(',');
      const isUnique = rows[0].Non_unique === 0 ? 'UNIQUE' : 'INDEX';
      console.log(`   - ${name}: ${isUnique} (${cols})`);
    });

    // 3. 找出所有要删除的 UNIQUE 单列索引（asset_code 单独成索引且 Non_unique=0）
    const oldUniqueNames = [];
    Object.entries(grouped).forEach(([name, rows]) => {
      const isSingleColumn = rows.length === 1 && rows[0].Column_name === 'asset_code';
      const isUnique = rows[0].Non_unique === 0;
      // 排除我们要保留的联合索引（如果脚本重跑，uk_tenant_asset_code 已经在）
      if (isSingleColumn && isUnique && name !== 'uk_tenant_asset_code') {
        oldUniqueNames.push(name);
      }
    });

    if (oldUniqueNames.length === 0) {
      console.log('⏭️  未发现旧的全局 UNIQUE 索引，跳过删除');
    } else {
      for (const idxName of oldUniqueNames) {
        await safeAlter(
          `ALTER TABLE \`${dbName}\`.assets DROP INDEX \`${idxName}\``,
          `删除旧的全局 UNIQUE 索引: ${idxName}`
        );
      }
    }

    // 4. 添加联合 UNIQUE 约束（如果不存在）
    await safeAlter(
      `ALTER TABLE \`${dbName}\`.assets ADD UNIQUE KEY uk_tenant_asset_code (tenant_id, asset_code)`,
      '添加联合 UNIQUE 约束: uk_tenant_asset_code (tenant_id, asset_code)'
    );

    // 5. 验证最终状态
    const [finalIndexes] = await db.execute(
      `SHOW INDEX FROM \`${dbName}\`.assets WHERE Column_name = 'asset_code'`
    );
    console.log('\n📋 修复后索引:');
    const finalGrouped = {};
    finalIndexes.forEach(row => {
      if (!finalGrouped[row.Key_name]) finalGrouped[row.Key_name] = [];
      finalGrouped[row.Key_name].push(row);
    });
    Object.entries(finalGrouped).forEach(([name, rows]) => {
      const cols = rows.map(r => `${r.Column_name}(${r.Sub_part || 'full'})`).join(',');
      const isUnique = rows[0].Non_unique === 0 ? 'UNIQUE' : 'INDEX';
      console.log(`   - ${name}: ${isUnique} (${cols})`);
    });

    console.log('\n🎉 assets 表 UNIQUE 约束修复完成');
    console.log('   后续行为：同租户内 asset_code 不可重复，跨租户允许。');
  } catch (error) {
    console.error('❌ Migration 失败:', error.message);
    console.error('   错误码:', error.code, 'errno:', error.errno);
    console.error('   详情:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

migrate();
