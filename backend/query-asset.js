const db = require('./config/database');

async function queryAsset() {
  try {
    // 查询资产表结构
    const [tableStructure] = await db.execute('SHOW CREATE TABLE assets;');
    console.log('资产表结构:', tableStructure[0]['Create Table']);

    // 查询资产ID 26520的详细信息
    const [assetInfo] = await db.execute('SELECT * FROM assets WHERE id = ?;', [26520]);
    console.log('资产ID 26520的详细信息:', assetInfo);

    // 查询资产表的自增ID当前值
    const [autoIncrementInfo] = await db.execute('SHOW TABLE STATUS LIKE "assets";');
    console.log('资产表自增ID当前值:', autoIncrementInfo[0].Auto_increment);

    // 查询资产数量
    const [assetCount] = await db.execute('SELECT COUNT(*) as total FROM assets;');
    console.log('资产总数:', assetCount[0].total);
  } catch (error) {
    console.error('查询失败:', error);
  } finally {
    // 关闭数据库连接
    await db.end();
  }
}

queryAsset();
