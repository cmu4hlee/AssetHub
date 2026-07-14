const db = require('./config/database');

async function updateAssetImagesTenant() {
  try {
    console.log('正在更新asset_images表的tenant_id字段...');

    // 执行更新操作，将所有记录的tenant_id改为1
    const [result] = await db.execute('UPDATE asset_images SET tenant_id = 1');

    console.log(`✅ 更新成功！共更新了 ${result.affectedRows} 条记录`);
    console.log('更新结果:', result);
  } catch (error) {
    console.error('❌ 更新失败:', error);
    console.error('错误信息:', error.message);
  } finally {
    // 关闭数据库连接
    process.exit();
  }
}

updateAssetImagesTenant();
