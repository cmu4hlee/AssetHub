/**
 * 修复数据库兼容性问题
 * 1. 修复条码扫描日志字符集不兼容问题
 * 2. 修复人员资质表缺失问题
 */

const db = require('../config/database');

async function fixDatabaseIssues() {
  console.log('='.repeat(50));
  console.log('开始修复数据库兼容性问题...');
  console.log('='.repeat(50));

  try {
    // 1. 检查并创建 staff_qualifications 表（如果不存在）
    console.log('\n📋 检查人员资质表...');
    const [tables] = await db.execute(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'staff_qualifications'
    `);

    if (tables.length === 0) {
      console.log('  ⚠️  staff_qualifications 表不存在，正在创建...');
      await db.execute(`
        CREATE TABLE IF NOT EXISTS staff_qualifications (
          id INT AUTO_INCREMENT PRIMARY KEY,
          tenant_id INT NOT NULL,
          user_id INT NOT NULL,
          qualification_type VARCHAR(100) NOT NULL COMMENT '资质类型',
          qualification_name VARCHAR(200) NOT NULL COMMENT '资质名称',
          certificate_no VARCHAR(100) NULL COMMENT '证书编号',
          issue_date DATE NULL COMMENT '发证日期',
          expiry_date DATE NULL COMMENT '到期日期',
          issuing_authority VARCHAR(200) NULL COMMENT '发证机构',
          status ENUM('active', 'expired', 'revoked') DEFAULT 'active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_tenant_id (tenant_id),
          INDEX idx_user_id (user_id),
          INDEX idx_expiry_date (expiry_date),
          INDEX idx_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('  ✅ staff_qualifications 表创建成功');
    } else {
      console.log('  ✅ staff_qualifications 表已存在');
      
      // 检查是否有 certificate_no 字段
      const [columns] = await db.execute(`
        SELECT COLUMN_NAME 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'staff_qualifications'
        AND COLUMN_NAME IN ('certificate_no', 'certificate_number')
      `);
      
      if (columns.length === 0) {
        console.log('  ⚠️  缺少证书编号字段，正在添加...');
        await db.execute(`
          ALTER TABLE staff_qualifications 
          ADD COLUMN certificate_no VARCHAR(100) NULL COMMENT '证书编号' AFTER qualification_name
        `);
        console.log('  ✅ certificate_no 字段添加成功');
      } else {
        console.log('  ✅ 证书编号字段已存在');
      }
    }

    // 2. 修复 scan_logs 表字符集问题
    console.log('\n📋 检查扫码日志表字符集...');
    const [scanLogsColumns] = await db.execute(`
      SELECT COLUMN_NAME, CHARACTER_SET_NAME, COLLATION_NAME
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'scan_logs'
      AND COLUMN_NAME = 'asset_code'
      LIMIT 1
    `);

    if (scanLogsColumns.length > 0) {
      console.log(`  当前 asset_code 列字符集: ${scanLogsColumns[0].CHARACTER_SET_NAME}`);
      console.log(`  当前 asset_code 列排序规则: ${scanLogsColumns[0].COLLATION_NAME}`);
    }

    // 检查 assets 表的字符集
    const [assetsColumns] = await db.execute(`
      SELECT COLUMN_NAME, CHARACTER_SET_NAME, COLLATION_NAME
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'assets'
      AND COLUMN_NAME = 'asset_code'
      LIMIT 1
    `);

    if (assetsColumns.length > 0) {
      console.log(`  assets 表 asset_code 列字符集: ${assetsColumns[0].CHARACTER_SET_NAME}`);
      console.log(`  assets 表 asset_code 列排序规则: ${assetsColumns[0].COLLATION_NAME}`);
    }

    // 如果字符集不一致，修复 scan_logs 表
    if (assetsColumns.length > 0 && scanLogsColumns.length > 0) {
      if (assetsColumns[0].COLLATION_NAME !== scanLogsColumns[0].COLLATION_NAME) {
        console.log('  ⚠️  字符集不一致，正在修复...');
        const targetCollation = assetsColumns[0].COLLATION_NAME;
        const targetCharset = assetsColumns[0].CHARACTER_SET_NAME;
        
        await db.execute(`
          ALTER TABLE scan_logs 
          CONVERT TO CHARACTER SET ${targetCharset} COLLATE ${targetCollation}
        `);
        console.log(`  ✅ scan_logs 表已转换为 ${targetCharset}/${targetCollation}`);
      } else {
        console.log('  ✅ 字符集一致，无需修复');
      }
    }

    // 3. 检查并创建 intelligent_alerts 表
    console.log('\n📋 检查智能告警表...');
    const [alertTables] = await db.execute(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'intelligent_alerts'
    `);

    if (alertTables.length === 0) {
      console.log('  ⚠️  intelligent_alerts 表不存在，正在创建...');
      await db.execute(`
        CREATE TABLE IF NOT EXISTS intelligent_alerts (
          id INT AUTO_INCREMENT PRIMARY KEY,
          tenant_id INT NOT NULL,
          alert_type VARCHAR(50) NOT NULL COMMENT '告警类型',
          alert_title VARCHAR(200) NOT NULL COMMENT '告警标题',
          alert_content TEXT NULL COMMENT '告警内容',
          urgency ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
          related_id INT NULL COMMENT '关联ID',
          related_type VARCHAR(50) NULL COMMENT '关联类型',
          status ENUM('pending', 'read', 'handled') DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          handled_at TIMESTAMP NULL,
          handled_by INT NULL,
          INDEX idx_tenant_id (tenant_id),
          INDEX idx_alert_type (alert_type),
          INDEX idx_status (status),
          INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('  ✅ intelligent_alerts 表创建成功');
    } else {
      console.log('  ✅ intelligent_alerts 表已存在');
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ 数据库兼容性修复完成！');
    console.log('='.repeat(50));

  } catch (error) {
    console.error('\n❌ 修复失败:', error.message);
    throw error;
  } finally {
    await db.end();
  }
}

// 执行修复
fixDatabaseIssues()
  .then(() => {
    console.log('\n修复脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n执行出错:', error);
    process.exit(1);
  });
