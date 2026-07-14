/**
 * 同步资产图片的tenant_id与对应资产的tenant_id
 * 解决资产转移后图片不显示的问题
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const { database: databaseConfig } = require('../config/app.config');

async function syncAssetImagesTenantId() {
  let connection;
  try {
    console.log('开始同步资产图片的tenant_id...\n');

    connection = await mysql.createConnection({
      host: databaseConfig.host,
      port: databaseConfig.port,
      user: databaseConfig.user,
      password: databaseConfig.password,
      database: databaseConfig.database,
      connectTimeout: 10000,
    });

    console.log('✓ 数据库连接成功\n');

    // 获取所有图片及其对应的资产信息
    const [images] = await connection.execute(
      `SELECT ai.id, ai.asset_code, ai.tenant_id, a.tenant_id as asset_tenant_id
       FROM asset_images ai
       LEFT JOIN assets a ON ai.asset_code = a.asset_code OR ai.asset_code = CAST(a.id AS CHAR)`,
    );

    console.log(`✓ 找到 ${images.length} 张图片`);

    // 统计需要更新的图片数量
    const imagesToUpdate = images.filter(
      img => img.asset_tenant_id !== null && img.tenant_id !== img.asset_tenant_id,
    );

    console.log(`✓ 需要更新 ${imagesToUpdate.length} 张图片的tenant_id\n`);

    if (imagesToUpdate.length === 0) {
      console.log('✅ 所有图片的tenant_id已经与资产一致，无需更新');
      return true;
    }

    // 批量更新图片的tenant_id
    let updatedCount = 0;
    for (const img of imagesToUpdate) {
      try {
        await connection.execute('UPDATE asset_images SET tenant_id = ? WHERE id = ?', [
          img.asset_tenant_id,
          img.id,
        ]);
        updatedCount++;
        if (updatedCount % 100 === 0) {
          console.log(`  已更新 ${updatedCount}/${imagesToUpdate.length} 张图片`);
        }
      } catch (error) {
        console.error(`  ✗ 更新图片 ${img.id} 失败 - ${error.message}`);
      }
    }

    console.log('\n✅ 图片tenant_id同步完成！');
    console.log(`   总计需要更新: ${imagesToUpdate.length} 张`);
    console.log(`   成功更新: ${updatedCount} 张`);
    console.log(`   失败: ${imagesToUpdate.length - updatedCount} 张`);

    await connection.end();
    return true;
  } catch (error) {
    console.error('\n❌ 执行失败:');
    console.error('错误代码:', error.code);
    console.error('错误消息:', error.message);
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

// 运行脚本
syncAssetImagesTenantId()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('脚本执行异常:', error);
    process.exit(1);
  });
