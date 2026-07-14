const mysql = require('mysql2/promise');
const path = require('path');

// 明确指定.env文件的路径，确保能够正确加载
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

// 添加调试信息，查看环境变量是否被正确加载
console.log('调试信息:');
console.log(`DB_HOST: ${process.env.DB_HOST}`);
console.log(`DB_PORT: ${process.env.DB_PORT}`);
console.log(`DB_USER: ${process.env.DB_USER}`);
console.log(`DB_PASSWORD: ${process.env.DB_PASSWORD ? '***已加载***' : '未加载'}`);
console.log(`DB_NAME: ${process.env.DB_NAME}`);

// 获取数据库配置
const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'zcgl',
  connectTimeout: 10000,
};

async function updateDepartmentTable() {
  console.log('开始更新远程数据库中的部门表结构...');
  console.log('数据库配置:');
  console.log(`  主机: ${config.host}`);
  console.log(`  端口: ${config.port}`);
  console.log(`  数据库: ${config.database}`);

  try {
    const connection = await mysql.createConnection(config);
    console.log('\n✅ 数据库连接成功！');

    // 1. 删除不必要的password字段
    console.log('\n1. 正在删除不必要的password字段...');
    // 先检查password字段是否存在
    const [passwordColumns] = await connection.execute(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'departments' AND COLUMN_NAME = 'password'",
      [config.database],
    );
    if (passwordColumns.length > 0) {
      await connection.execute('ALTER TABLE departments DROP COLUMN password');
      console.log('✅ password字段删除成功！');
    } else {
      console.log('✅ password字段不存在，跳过删除！');
    }

    // 2. 确保所有现有数据的tenant_id都不为空
    console.log('\n2. 正在检查并修复现有数据的tenant_id...');
    // 先检查tenant_id字段是否存在且允许空值
    const [tenantIdColumns] = await connection.execute(
      "SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'departments' AND COLUMN_NAME = 'tenant_id'",
      [config.database],
    );

    if (tenantIdColumns.length > 0 && tenantIdColumns[0].IS_NULLABLE === 'YES') {
      // 先修复现有数据中的空值
      await connection.execute('UPDATE departments SET tenant_id = 1 WHERE tenant_id IS NULL');
      console.log('✅ 现有数据的tenant_id修复成功！');

      // 然后修改字段为非空
      await connection.execute('ALTER TABLE departments MODIFY COLUMN tenant_id INT NOT NULL');
      console.log('✅ tenant_id字段修改为非空成功！');
    } else {
      console.log('✅ tenant_id字段已经是非空，跳过修改！');
    }

    // 3. 检查并修复唯一索引
    console.log('\n3. 正在检查并修复唯一索引...');
    // 先查询现有索引
    const [existingIndexes] = await connection.execute(
      `SELECT INDEX_NAME, NON_UNIQUE, COLUMN_NAME 
       FROM information_schema.STATISTICS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'departments' AND INDEX_NAME != 'PRIMARY'`,
      [config.database],
    );

    // 检查是否已经有符合要求的复合索引
    const hasProperCodeIndex = existingIndexes.some(
      idx =>
        idx.INDEX_NAME === 'uk_department_code' &&
        idx.COLUMN_NAME.includes('department_code') &&
        idx.COLUMN_NAME.includes('tenant_id'),
    );

    const hasProperNameIndex = existingIndexes.some(
      idx =>
        idx.INDEX_NAME === 'uk_department_name' &&
        idx.COLUMN_NAME.includes('department_name') &&
        idx.COLUMN_NAME.includes('tenant_id'),
    );

    if (!hasProperCodeIndex || !hasProperNameIndex) {
      // 删除旧索引
      for (const idx of existingIndexes) {
        if (idx.INDEX_NAME === 'uk_department_code' || idx.INDEX_NAME === 'uk_department_name') {
          await connection.execute(`ALTER TABLE departments DROP INDEX ${idx.INDEX_NAME}`);
          console.log(`✅ 旧索引 ${idx.INDEX_NAME} 删除成功！`);
        }
      }

      // 创建新的复合唯一索引
      await connection.execute(
        'ALTER TABLE departments ADD UNIQUE KEY uk_department_code (department_code, tenant_id)',
      );
      await connection.execute(
        'ALTER TABLE departments ADD UNIQUE KEY uk_department_name (department_name, tenant_id)',
      );
      console.log('✅ 新的复合唯一索引创建成功！');
    } else {
      console.log('✅ 已经存在符合要求的复合唯一索引，跳过创建！');
    }

    // 6. 显示更新后的表结构
    console.log('\n6. 显示更新后的表结构...');
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME, DATA_TYPE, COLUMN_KEY, IS_NULLABLE, COLUMN_DEFAULT 
       FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'departments'`,
      [config.database],
    );

    console.log('\n更新后的部门表结构:');
    console.log(
      '+-------------------+----------------+--------------+-------------+----------------+',
    );
    console.log(
      '| 字段名            | 数据类型       | 键类型       | 是否可为空  | 默认值         |',
    );
    console.log(
      '+-------------------+----------------+--------------+-------------+----------------+',
    );
    columns.forEach(col => {
      const columnName = col.COLUMN_NAME.padEnd(17);
      const dataType = col.DATA_TYPE.padEnd(14);
      const columnKey = col.COLUMN_KEY.padEnd(12);
      const isNullable = col.IS_NULLABLE.padEnd(11);
      const columnDefault = (col.COLUMN_DEFAULT || '').padEnd(16);
      console.log(
        `| ${columnName} | ${dataType} | ${columnKey} | ${isNullable} | ${columnDefault} |`,
      );
    });
    console.log(
      '+-------------------+----------------+--------------+-------------+----------------+',
    );

    // 7. 显示更新后的索引信息
    console.log('\n更新后的索引信息:');
    const [indexes] = await connection.execute(
      `SELECT INDEX_NAME, NON_UNIQUE, COLUMN_NAME 
       FROM information_schema.STATISTICS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'departments' AND INDEX_NAME != 'PRIMARY'`,
      [config.database],
    );

    indexes.forEach(idx => {
      const indexName = idx.INDEX_NAME.padEnd(20);
      const isUnique = idx.NON_UNIQUE === 0 ? '唯一索引' : '普通索引';
      const columns = idx.COLUMN_NAME;
      console.log(`- ${indexName}: ${isUnique} (${columns})`);
    });

    // 关闭连接
    await connection.end();
    console.log('\n✅ 数据库连接已关闭');
    console.log('\n🎉 部门表结构更新完成！');
  } catch (error) {
    console.error('\n❌ 更新部门表失败:');
    console.error(`  错误代码: ${error.code}`);
    console.error(`  错误消息: ${error.message}`);
    console.error(`  错误堆栈: ${error.stack}`);
  }
}

updateDepartmentTable();
