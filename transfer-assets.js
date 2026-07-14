const mysql = require('mysql2/promise');
const { database: databaseConfig } = require('./backend/config/app.config');

async function transferAssets() {
  let connection;
  try {
    // 创建数据库连接
    connection = await mysql.createConnection({
      host: databaseConfig.host,
      port: databaseConfig.port,
      user: databaseConfig.user,
      password: databaseConfig.password,
      database: databaseConfig.database,
    });

    console.log('数据库连接成功');

    const sourceTenantId = 1; // default企业空间id
    const targetTenantId = 2; // 001企业空间id

    // 开始事务
    await connection.beginTransaction();

    // 1. 查询需要转移的资产数量
    const [assetCountResult] = await connection.execute(
      'SELECT COUNT(*) as count FROM assets WHERE tenant_id = ?',
      [sourceTenantId]
    );
    const assetCount = assetCountResult[0].count;
    console.log(`需要转移的资产数量: ${assetCount}`);

    // 2. 更新资产表
    console.log('开始转移资产...');
    const [assetUpdateResult] = await connection.execute(
      'UPDATE assets SET tenant_id = ? WHERE tenant_id = ?',
      [targetTenantId, sourceTenantId]
    );
    console.log(`资产表更新成功，影响行数: ${assetUpdateResult.affectedRows}`);

    // 3. 更新资产标签模板表
    const [templateUpdateResult] = await connection.execute(
      'UPDATE asset_label_templates SET tenant_id = ? WHERE tenant_id = ?',
      [targetTenantId, sourceTenantId]
    );
    console.log(`资产标签模板表更新成功，影响行数: ${templateUpdateResult.affectedRows}`);

    // 4. 更新资产标签打印队列表
    const [printQueueUpdateResult] = await connection.execute(
      'UPDATE asset_label_print_queue SET tenant_id = ? WHERE tenant_id = ?',
      [targetTenantId, sourceTenantId]
    );
    console.log(`资产标签打印队列表更新成功，影响行数: ${printQueueUpdateResult.affectedRows}`);

    // 5. 更新资产转移请求表
    const [transferRequestUpdateResult] = await connection.execute(
      'UPDATE asset_transfer_requests SET tenant_id = ? WHERE tenant_id = ?',
      [targetTenantId, sourceTenantId]
    );
    console.log(`资产转移请求表更新成功，影响行数: ${transferRequestUpdateResult.affectedRows}`);

    // 6. 更新资产AI分析日志表（如果存在）
    try {
      const [aiAnalysisUpdateResult] = await connection.execute(
        'UPDATE asset_ai_analysis_logs SET tenant_id = ? WHERE tenant_id = ?',
        [targetTenantId, sourceTenantId]
      );
      console.log(`资产AI分析日志表更新成功，影响行数: ${aiAnalysisUpdateResult.affectedRows}`);
    } catch (error) {
      if (error.code === 'ER_NO_SUCH_TABLE') {
        console.log(`资产AI分析日志表不存在，跳过更新`);
      } else {
        throw error;
      }
    }

    // 7. 更新验收申请资产关联表（如果存在）
    try {
      const [acceptanceUpdateResult] = await connection.execute(
        'UPDATE acceptance_application_assets SET tenant_id = ? WHERE tenant_id = ?',
        [targetTenantId, sourceTenantId]
      );
      console.log(`验收申请资产关联表更新成功，影响行数: ${acceptanceUpdateResult.affectedRows}`);
    } catch (error) {
      if (error.code === 'ER_NO_SUCH_TABLE') {
        console.log(`验收申请资产关联表不存在，跳过更新`);
      } else {
        throw error;
      }
    }

    // 提交事务
    await connection.commit();
    console.log('\n✅ 所有资产转移操作已成功提交！');

    // 验证转移结果
    console.log('\n🔍 验证转移结果:');
    const [afterAssetCountResult] = await connection.execute(
      'SELECT COUNT(*) as count FROM assets WHERE tenant_id = ?',
      [targetTenantId]
    );
    console.log(`001企业空间现有资产数量: ${afterAssetCountResult[0].count}`);

    const [sourceAssetCountResult] = await connection.execute(
      'SELECT COUNT(*) as count FROM assets WHERE tenant_id = ?',
      [sourceTenantId]
    );
    console.log(`default企业空间剩余资产数量: ${sourceAssetCountResult[0].count}`);

    // 初始化更新结果变量
    let aiAnalysisAffectedRows = 0;
    let acceptanceAffectedRows = 0;

    return {
      success: true,
      message: '资产转移成功',
      assetCount,
      updatedTables: {
        assets: assetUpdateResult.affectedRows,
        asset_label_templates: templateUpdateResult.affectedRows,
        asset_label_print_queue: printQueueUpdateResult.affectedRows,
        asset_transfer_requests: transferRequestUpdateResult.affectedRows,
        asset_ai_analysis_logs: aiAnalysisAffectedRows,
        acceptance_application_assets: acceptanceUpdateResult.affectedRows
      }
    };
  } catch (error) {
    // 回滚事务
    if (connection) {
      await connection.rollback();
    }
    console.error('资产转移失败:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n数据库连接已关闭');
    }
  }
}

transferAssets();
