const db = require('../config/database');

async function addReservedFields() {
  try {
    console.log('开始添加计量表预留字段...');

    // 连接数据库
    const connection = await db.getConnection();

    try {
      // 添加20个预留字段
      for (let i = 1; i <= 20; i++) {
        const fieldName = `temp${i}`;
        console.log(`添加字段: ${fieldName}`);

        // 检查字段是否已存在
        const [fieldCheck] = await connection.execute(
          `SHOW COLUMNS FROM metrology_records LIKE '${fieldName}'`,
        );

        if (fieldCheck.length === 0) {
          // 字段不存在，添加字段
          await connection.execute(
            `ALTER TABLE metrology_records ADD COLUMN ${fieldName} TEXT COMMENT '预留字段${i}' AFTER calibration_conclusion`,
          );
          console.log(`✅ 已添加字段: ${fieldName}`);
        } else {
          console.log(`⚠️  字段 ${fieldName} 已存在，跳过`);
        }
      }

      console.log('\n✅ 所有预留字段添加完成');

      // 查看添加后的表结构
      console.log('\n查看添加后的表结构:');
      const [columns] = await connection.execute('DESCRIBE metrology_records');

      // 只显示新增的预留字段
      console.log('新增的预留字段:');
      console.log('字段名\t\t数据类型\t\t约束');
      console.log('-'.repeat(60));
      columns.forEach(col => {
        if (col.Field.startsWith('temp')) {
          console.log(
            `${col.Field}\t\t${col.Type}\t\t${col.Null === 'YES' ? 'NULL' : 'NOT NULL'}\t${col.Default || ''}`,
          );
        }
      });
    } catch (error) {
      console.error('❌ 添加字段失败:', error);
      throw error;
    } finally {
      if (connection) {
        connection.release();
        console.log('\n🔌 数据库连接已释放');
      }
    }
  } catch (error) {
    console.error('❌ 执行失败:', error);
    process.exit(1);
  }
}

// 执行添加预留字段
addReservedFields();
