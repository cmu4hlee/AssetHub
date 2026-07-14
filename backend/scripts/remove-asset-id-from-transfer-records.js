const db = require('../config/database');

async function removeAssetIdFromTransferRecords() {
  try {
    console.log('开始从transfer_records表中删除asset_id字段...');

    const connection = await db.getConnection();

    try {
      // 1. 尝试删除外键约束（忽略错误）
      console.log('1. 尝试删除外键约束...');
      try {
        await connection.execute(
          'ALTER TABLE transfer_records DROP FOREIGN KEY transfer_records_ibfk_1',
        );
        console.log('✓ 外键约束删除成功');
      } catch (fkError) {
        console.log('⚠️  外键约束不存在或删除失败，继续执行下一步:', fkError.message);
      }

      // 2. 删除asset_id字段
      console.log('2. 删除asset_id字段...');
      await connection.execute('ALTER TABLE transfer_records DROP COLUMN IF EXISTS asset_id');
      console.log('✓ asset_id字段删除成功');

      // 3. 删除相关索引
      console.log('3. 删除相关索引...');
      await connection.execute('ALTER TABLE transfer_records DROP INDEX IF EXISTS idx_asset');
      console.log('✓ 索引删除成功');

      console.log('\n🎉 操作完成：成功从transfer_records表中删除asset_id字段');
    } catch (error) {
      console.error('操作失败:', error.message);
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('执行脚本失败:', error);
    process.exit(1);
  }
}

removeAssetIdFromTransferRecords();
