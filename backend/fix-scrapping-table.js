const db = require('./config/database');

async function fixScrappingTable() {
  console.log('🔧 修复资产报废表结构');

  try {
    // 修改asset_scrapping_records表，将updated_at字段类型改为datetime并允许NULL值
    console.log('\n=== 修改asset_scrapping_records表 ===');
    await db.execute(
      `ALTER TABLE asset_scrapping_records
       MODIFY COLUMN updated_at datetime DEFAULT NULL`,
    );
    console.log('✅ asset_scrapping_records表已修复');

  } catch (error) {
    console.error('修复表结构失败:', error);
  } finally {
    db.end();
  }
}

fixScrappingTable();
