const mysql = require('mysql2/promise');
const { database: databaseConfig } = require('../config/app.config');

async function updatePrintQueueTable() {
  let connection;

  try {
    console.log('开始更新资产标签打印队列表...');

    connection = await mysql.createConnection({
      host: databaseConfig.master.host,
      port: databaseConfig.master.port,
      user: databaseConfig.master.user,
      password: databaseConfig.master.password,
      database: databaseConfig.master.database,
      connectTimeout: 10000,
    });

    console.log('✅ 数据库连接成功');

    // 检查asset_label_print_queue表结构
    console.log('\n🔍 检查asset_label_print_queue表结构...');
    const [columns] = await connection.execute('SHOW COLUMNS FROM asset_label_print_queue');

    const hasAssetId = columns.some(col => col.Field === 'asset_id');
    const hasAssetCode = columns.some(col => col.Field === 'asset_code');

    console.log(`  - 存在asset_id字段: ${hasAssetId}`);
    console.log(`  - 存在asset_code字段: ${hasAssetCode}`);

    if (hasAssetId && !hasAssetCode) {
      console.log('\n📝 修改表结构，添加asset_code字段...');

      // 先删除外键约束
      try {
        await connection.execute(
          'ALTER TABLE asset_label_print_queue DROP FOREIGN KEY fk_asset_label_print_queue_asset',
        );
        console.log('  ✅ 已删除旧的外键约束');
      } catch (error) {
        console.log('  ℹ️  外键约束不存在，跳过删除');
      }

      // 添加asset_code字段
      await connection.execute(
        'ALTER TABLE asset_label_print_queue ADD COLUMN asset_code VARCHAR(50) NULL AFTER asset_id',
      );
      console.log('  ✅ 已添加asset_code字段');

      // 更新现有数据，将asset_id关联的资产编码填充到asset_code字段
      console.log('\n🔄 更新现有数据...');
      await connection.execute(`
        UPDATE asset_label_print_queue pq
        JOIN assets a ON pq.asset_id = a.id
        SET pq.asset_code = a.asset_code
        WHERE pq.asset_code IS NULL
      `);
      console.log('  ✅ 已更新现有数据');

      // 删除asset_id字段
      await connection.execute('ALTER TABLE asset_label_print_queue DROP COLUMN asset_id');
      console.log('  ✅ 已删除asset_id字段');

      // 添加索引
      await connection.execute(
        'CREATE INDEX idx_asset_code ON asset_label_print_queue(asset_code)',
      );
      console.log('  ✅ 已添加asset_code索引');
    } else if (!hasAssetId && hasAssetCode) {
      console.log('\n✅ 表结构已经是最新的，跳过修改');
    } else if (hasAssetId && hasAssetCode) {
      console.log('\n📝 表结构包含两个字段，删除asset_id字段...');

      // 删除asset_id字段
      await connection.execute('ALTER TABLE asset_label_print_queue DROP COLUMN asset_id');
      console.log('  ✅ 已删除asset_id字段');
    } else {
      console.log('\n❌ 表结构异常，既没有asset_id也没有asset_code字段');
      return false;
    }

    // 验证修改结果
    console.log('\n✅ 验证修改结果...');
    const [updatedColumns] = await connection.execute('SHOW COLUMNS FROM asset_label_print_queue');

    console.log('\n📋 更新后的表结构:');
    updatedColumns.forEach(col => {
      console.log(`  - ${col.Field}: ${col.Type} ${col.Null === 'YES' ? '(NULL)' : ''}`);
    });

    // 检查是否还有asset_id字段
    const stillHasAssetId = updatedColumns.some(col => col.Field === 'asset_id');
    const nowHasAssetCode = updatedColumns.some(col => col.Field === 'asset_code');

    if (!stillHasAssetId && nowHasAssetCode) {
      console.log('\n🎉 表结构更新成功！asset_label_print_queue表现在使用asset_code字段进行关联。');
    } else {
      console.log('\n❌ 表结构更新失败！');
      return false;
    }

    await connection.end();
    console.log('\n✅ 数据库连接已关闭');
    return true;
  } catch (error) {
    console.error('\n❌ 操作失败:', error.message);
    if (connection) {
      try {
        await connection.end();
      } catch (e) {
        // 忽略关闭错误
      }
    }
    return false;
  }
}

// 执行函数
updatePrintQueueTable()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('脚本执行异常:', error);
    process.exit(1);
  });
