const mysql = require('mysql2/promise');
const { getDatabaseConfig } = require('./db-config-helper');

// 使用统一的数据库配置助手
const config = {
  ...getDatabaseConfig(),
  multipleStatements: true,
};

async function clearAssets() {
  let connection;
  try {
    console.log('正在连接数据库...');
    connection = await mysql.createConnection(config);
    console.log('数据库连接成功');

    // 先检查当前数据量
    const [countResult] = await connection.execute('SELECT COUNT(*) as total FROM assets');
    const { total } = countResult[0];
    console.log(`当前资产总数: ${total}`);

    if (total === 0) {
      console.log('数据库中没有资产数据，无需清空');
      return;
    }

    // 检查相关表的数据
    const [inventoryCount] = await connection.execute(
      'SELECT COUNT(*) as total FROM inventory_details',
    );
    const [transferCount] = await connection.execute(
      'SELECT COUNT(*) as total FROM transfer_records',
    );
    const [idleCount] = await connection.execute('SELECT COUNT(*) as total FROM idle_assets');

    console.log('\n相关表数据统计:');
    console.log(`  盘点明细: ${inventoryCount[0].total} 条`);
    console.log(`  调配记录: ${transferCount[0].total} 条`);
    console.log(`  闲置资产: ${idleCount[0].total} 条`);

    // 由于有外键约束，需要先删除相关表的数据
    console.log('\n开始清空数据...');

    // 禁用外键检查（临时）
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');

    // 清空相关表（这些表有外键引用assets表）
    if (inventoryCount[0].total > 0) {
      await connection.execute('DELETE FROM inventory_details');
      console.log('✓ 已清空盘点明细表');
    }

    if (transferCount[0].total > 0) {
      await connection.execute('DELETE FROM transfer_records');
      console.log('✓ 已清空调配记录表');
    }

    if (idleCount[0].total > 0) {
      await connection.execute('DELETE FROM idle_assets');
      console.log('✓ 已清空闲置资产表');
    }

    // 清空盘点记录表（盘点明细已清空，盘点记录也可以清空）
    await connection.execute('DELETE FROM inventory_records');
    console.log('✓ 已清空盘点记录表');

    // 清空资产主表
    await connection.execute('DELETE FROM assets');
    console.log('✓ 已清空资产主表');

    // 重新启用外键检查
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');

    // 重置自增ID（可选）
    await connection.execute('ALTER TABLE assets AUTO_INCREMENT = 1');
    await connection.execute('ALTER TABLE inventory_records AUTO_INCREMENT = 1');
    await connection.execute('ALTER TABLE inventory_details AUTO_INCREMENT = 1');
    await connection.execute('ALTER TABLE transfer_records AUTO_INCREMENT = 1');
    await connection.execute('ALTER TABLE idle_assets AUTO_INCREMENT = 1');
    console.log('✓ 已重置自增ID');

    // 验证清空结果
    const [verifyResult] = await connection.execute('SELECT COUNT(*) as total FROM assets');
    console.log(`\n验证结果: 当前资产总数 = ${verifyResult[0].total}`);

    console.log(`\n${'='.repeat(50)}`);
    console.log('数据清空完成！');
    console.log('='.repeat(50));
  } catch (error) {
    console.error('清空数据失败:', error.message);
    console.error(error);
    if (connection) {
      try {
        await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
      } catch (e) {
        // 忽略错误
      }
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n数据库连接已关闭');
    }
  }
}

// 确认提示
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('警告：此操作将清空所有资产数据及相关记录，是否继续？(yes/no): ', answer => {
  if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
    clearAssets();
  } else {
    console.log('操作已取消');
    process.exit(0);
  }
  rl.close();
});
