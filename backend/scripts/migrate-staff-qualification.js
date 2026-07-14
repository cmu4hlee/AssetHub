/**
 * 资质认证模块数据库迁移脚本
 * 添加 qualification_code 和 scope 列
 */

const db = require('../config/database');

async function runMigration() {
  console.log('🔧 开始执行资质认证模块数据库迁移...\n');

  try {
    // 检查表是否存在
    const [tables] = await db.execute(
      "SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'staff_qualifications'",
    );

    if (tables.length === 0) {
      console.error('❌ staff_qualifications 表不存在');
      process.exit(1);
    }
    console.log('✅ staff_qualifications 表存在');

    // 检查 qualification_code 列是否存在
    const [qcCheck] = await db.execute(
      "SELECT COLUMN_NAME FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'staff_qualifications' AND column_name = 'qualification_code'",
    );

    if (qcCheck.length === 0) {
      console.log('📝 添加 qualification_code 列...');
      await db.execute(
        "ALTER TABLE staff_qualifications ADD COLUMN qualification_code VARCHAR(50) COMMENT '资质编号' AFTER qualification_type",
      );
      console.log('✅ qualification_code 列已添加');
    } else {
      console.log('ℹ️ qualification_code 列已存在');
    }

    // 检查 scope 列是否存在
    const [scopeCheck] = await db.execute(
      "SELECT COLUMN_NAME FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'staff_qualifications' AND column_name = 'scope'",
    );

    if (scopeCheck.length === 0) {
      console.log('📝 添加 scope 列...');
      await db.execute(
        "ALTER TABLE staff_qualifications ADD COLUMN scope TEXT COMMENT '资质适用范围' AFTER expiry_date",
      );
      console.log('✅ scope 列已添加');
    } else {
      console.log('ℹ️ scope 列已存在');
    }

    // 检查索引是否存在
    const [idxCheck] = await db.execute(
      "SELECT INDEX_NAME FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'staff_qualifications' AND index_name = 'idx_tenant_qualification_code'",
    );

    if (idxCheck.length === 0) {
      console.log('📝 添加唯一索引 idx_tenant_qualification_code...');
      await db.execute(
        'ALTER TABLE staff_qualifications ADD UNIQUE INDEX idx_tenant_qualification_code (tenant_id, qualification_code)',
      );
      console.log('✅ 索引已添加');
    } else {
      console.log('ℹ️ 索引已存在');
    }

    // 验证最终表结构
    console.log('\n📋 staff_qualifications 表结构:');
    const [columns] = await db.execute('DESCRIBE staff_qualifications');
    columns.forEach(col => {
      console.log(`  ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });

    console.log('\n✅ 数据库迁移成功完成!');
  } catch (error) {
    console.error('❌ 数据库迁移失败:', error.message);
    process.exit(1);
  }
}

runMigration();
