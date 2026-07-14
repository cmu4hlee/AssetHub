// ============================================
// 添加依据技术文件和符合标准字段到计量管理表
// ============================================

const mysql = require('mysql2/promise');

async function addTechnicalStandardFields() {
  let connection;
  try {
    // 创建数据库连接
    connection = await mysql.createConnection({
      host: '101.37.236.101',
      port: 3306,
      user: 'root',
      password: 'Cmu19801008',
      database: 'zcgl',
    });

    console.log('✅ 数据库连接成功');

    // 检查字段是否存在
    const fieldsToCheck = ['technical_document', 'conformance_standard'];
    const existingFields = [];

    for (const field of fieldsToCheck) {
      const [results] = await connection.execute(
        `
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = 'zcgl' AND TABLE_NAME = 'metrology_records' AND COLUMN_NAME = ?
      `,
        [field],
      );

      if (results.length > 0) {
        existingFields.push(field);
        console.log(`ℹ️  字段 ${field} 已存在`);
      }
    }

    // 添加不存在的字段
    const fieldsToAdd = fieldsToCheck.filter(field => !existingFields.includes(field));

    for (const field of fieldsToAdd) {
      let sql;
      switch (field) {
        case 'technical_document':
          sql = `ALTER TABLE metrology_records 
                 ADD COLUMN technical_document VARCHAR(255) COMMENT '依据技术文件' AFTER serial_number`;
          break;
        case 'conformance_standard':
          sql = `ALTER TABLE metrology_records 
                 ADD COLUMN conformance_standard VARCHAR(255) COMMENT '符合标准' AFTER technical_document`;
          break;
      }

      if (sql) {
        await connection.execute(sql);
        console.log(`✅ 添加字段成功: ${field}`);
      }
    }

    // 添加索引
    const indexesToAdd = [
      { name: 'idx_technical_document', field: 'technical_document' },
      { name: 'idx_conformance_standard', field: 'conformance_standard' },
    ];

    for (const index of indexesToAdd) {
      try {
        await connection.execute(`CREATE INDEX ${index.name} ON metrology_records(${index.field})`);
        console.log(`✅ 添加索引成功: ${index.name}`);
      } catch (indexError) {
        if (indexError.code === 'ER_DUP_KEYNAME') {
          console.log(`ℹ️  索引 ${index.name} 已存在`);
        } else {
          console.error(`❌ 添加索引失败: ${index.name}`, indexError.message);
        }
      }
    }

    // 验证添加结果
    const [finalResults] = await connection.execute(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, COLUMN_COMMENT 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'zcgl' AND TABLE_NAME = 'metrology_records'
      AND COLUMN_NAME IN ('technical_document', 'conformance_standard')
    `);

    console.log('\n✅ 字段验证结果:');
    finalResults.forEach(field => {
      console.log(
        `- ${field.COLUMN_NAME}: ${field.DATA_TYPE}(${field.CHARACTER_MAXIMUM_LENGTH}) - ${field.COLUMN_COMMENT}`,
      );
    });

    console.log('\n🎉 所有字段和索引操作完成！');
  } catch (error) {
    console.error('❌ 执行失败:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('✅ 数据库连接已关闭');
    }
  }
}

// 执行脚本
addTechnicalStandardFields();
