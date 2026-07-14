/**
 * 为 location_codes 表添加 tenant_id 字段和索引
 */

const db = require('../config/database');

async function addTenantIdToLocationCodes() {
  try {
    console.log('开始为 location_codes 表添加 tenant_id 字段...');

    // 检查表是否存在
    try {
      await db.execute('SELECT 1 FROM location_codes LIMIT 1');
    } catch (error) {
      if (error.code === 'ER_NO_SUCH_TABLE') {
        console.log('⚠️ location_codes 表不存在，跳过添加字段');
        process.exit(0);
      } else {
        throw error;
      }
    }

    // 检查 tenant_id 字段是否已存在
    try {
      const [columns] = await db.execute(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'location_codes' AND COLUMN_NAME = 'tenant_id'",
      );
      if (columns.length > 0) {
        console.log('✅ tenant_id 字段已存在，跳过添加');
      } else {
        // 添加 tenant_id 字段
        await db.execute(`
          ALTER TABLE location_codes 
          ADD COLUMN tenant_id INT NOT NULL COMMENT '租户ID' AFTER id
        `);
        console.log('✅ tenant_id 字段添加成功');

        // 添加索引
        await db.execute(`
          ALTER TABLE location_codes 
          ADD INDEX idx_tenant_id (tenant_id)
        `);
        console.log('✅ tenant_id 索引添加成功');

        // 添加外键约束
        try {
          await db.execute(`
            ALTER TABLE location_codes 
            ADD CONSTRAINT fk_location_codes_tenant 
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
          `);
          console.log('✅ 外键约束添加成功');
        } catch (fkError) {
          if (fkError.code === 'ER_DUP_KEY' || fkError.code === 'ER_CANNOT_ADD_FOREIGN') {
            console.warn('⚠️ 外键约束可能已存在或添加失败，继续执行');
          } else {
            throw fkError;
          }
        }
      }
    } catch (error) {
      console.error('❌ 检查或添加字段失败:', error);
      throw error;
    }

    // 更新现有记录的 tenant_id（设置为默认租户，如果有的话）
    try {
      const [tenants] = await db.execute(
        'SELECT id FROM tenants WHERE tenant_code = ? OR id = 1 LIMIT 1',
        ['001'],
      );
      if (tenants.length > 0) {
        const defaultTenantId = tenants[0].id;
        await db.execute('UPDATE location_codes SET tenant_id = ? WHERE tenant_id IS NULL', [
          defaultTenantId,
        ]);
        console.log(`✅ 已更新现有记录的 tenant_id 为 ${defaultTenantId}`);
      }
    } catch (updateError) {
      console.warn('⚠️ 更新现有记录失败（可能没有默认租户）:', updateError.message);
    }

    console.log('✅ location_codes 表 tenant_id 字段添加完成！');
    process.exit(0);
  } catch (error) {
    console.error('❌ 添加 tenant_id 字段失败:', error);
    process.exit(1);
  }
}

// 执行脚本
addTenantIdToLocationCodes();
