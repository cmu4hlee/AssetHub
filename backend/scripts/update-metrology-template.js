const db = require('../config/database');

/**
 * 更新计量校准模板字段到数据库
 * 直接使用现有数据库配置，连接到远程数据库101.37.236.101
 */
async function updateMetrologyTemplate() {
  let connection = null;
  try {
    console.log('开始更新计量校准模板字段...');

    // 获取数据库连接
    connection = await db.getConnection();
    console.log('✅ 已连接到远程数据库:', '101.37.236.101');

    // 执行SQL语句列表
    const sqlStatements = [
      // 1. 添加校准环境字段
      "ALTER TABLE metrology_records ADD COLUMN calibration_environment VARCHAR(255) COMMENT '校准环境' AFTER measurement_range",

      // 2. 添加标准器具字段
      "ALTER TABLE metrology_records ADD COLUMN standard_instrument VARCHAR(255) COMMENT '标准器具' AFTER calibration_environment",

      // 3. 添加标准证书编号字段
      "ALTER TABLE metrology_records ADD COLUMN standard_certificate_no VARCHAR(100) COMMENT '标准证书编号' AFTER standard_instrument",

      // 4. 添加标准有效期字段
      "ALTER TABLE metrology_records ADD COLUMN standard_validity DATE COMMENT '标准有效期' AFTER standard_certificate_no",

      // 5. 添加扩展不确定度字段
      "ALTER TABLE metrology_records ADD COLUMN uncertainty VARCHAR(50) COMMENT '扩展不确定度' AFTER standard_validity",

      // 6. 添加校准项目字段
      "ALTER TABLE metrology_records ADD COLUMN calibration_items TEXT COMMENT '校准项目' AFTER certificate_validity_date",

      // 7. 添加校准数据字段
      "ALTER TABLE metrology_records ADD COLUMN calibration_data TEXT COMMENT '校准数据' AFTER calibration_items",

      // 8. 添加校准结论字段
      "ALTER TABLE metrology_records ADD COLUMN calibration_conclusion TEXT COMMENT '校准结论' AFTER calibration_data",

      // 9. 添加批准人字段
      "ALTER TABLE metrology_records ADD COLUMN approver VARCHAR(50) COMMENT '批准人' AFTER operator",
    ];

    // 执行所有SQL语句
    for (let i = 0; i < sqlStatements.length; i++) {
      const sql = sqlStatements[i];
      console.log(`📝 执行SQL ${i + 1}/${sqlStatements.length}: ${sql.substring(0, 100)}...`);
      try {
        await connection.execute(sql);
        console.log('✅ SQL执行成功');
      } catch (error) {
        // 如果是字段已存在的错误，跳过继续执行
        if (error.code === 'ER_DUP_FIELDNAME' || error.code === 'ER_INDEX_EXISTS') {
          console.log(`⚠️  跳过已存在的字段/索引: ${error.message}`);
        } else if (error.code === 'ER_NO_REFERENCED_ROW_2') {
          // 外键约束错误，可能是tenants表不存在，跳过
          console.log(`⚠️  外键约束跳过: ${error.message}`);
        } else {
          console.error(`❌ SQL执行失败: ${error.message}`);
          console.error(`   SQL语句: ${sql}`);
          throw error;
        }
      }
    }

    console.log('\n✅ 计量校准模板字段更新完成！');
    console.log('\n已添加的字段:');
    console.log('  - calibration_environment (校准环境)');
    console.log('  - standard_instrument (标准器具)');
    console.log('  - standard_certificate_no (标准证书编号)');
    console.log('  - standard_validity (标准有效期)');
    console.log('  - uncertainty (扩展不确定度)');
    console.log('  - calibration_items (校准项目)');
    console.log('  - calibration_data (校准数据)');
    console.log('  - calibration_conclusion (校准结论)');
    console.log('  - approver (批准人)');
  } catch (error) {
    console.error('❌ 更新失败:', error);
    process.exit(1);
  } finally {
    if (connection) {
      connection.release();
      console.log('🔌 数据库连接已释放');
    }
  }
}

// 执行脚本
if (require.main === module) {
  updateMetrologyTemplate()
    .then(() => {
      console.log('\n🎯 脚本执行完成');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ 脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = updateMetrologyTemplate;
