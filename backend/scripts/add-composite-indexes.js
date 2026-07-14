/**
 * 数据库复合索引添加脚本
 * 基于分析结果，为核心表添加复合索引以优化查询性能
 */

const db = require('../config/database');

// 复合索引配置 - 根据实际数据库结构修正
const compositeIndexes = [
  // assets表
  {
    table: 'assets',
    name: 'idx_assets_tenant_asset_code',
    columns: ['tenant_id', 'asset_code'],
    reason: '用于按租户和资产编码查询资产',
  },
  {
    table: 'assets',
    name: 'idx_assets_tenant_status',
    columns: ['tenant_id', 'status'],
    reason: '用于按租户和状态查询资产',
  },
  {
    table: 'assets',
    name: 'idx_assets_tenant_created_at',
    columns: ['tenant_id', 'created_at'],
    reason: '用于按租户和创建时间查询资产',
  },
  {
    table: 'assets',
    name: 'idx_assets_tenant_purchase_date',
    columns: ['tenant_id', 'purchase_date'],
    reason: '用于按租户和采购日期查询资产',
  },

  // asset_images表
  {
    table: 'asset_images',
    name: 'idx_asset_images_asset_created',
    columns: ['asset_code', 'created_at'],
    reason: '用于按资产编码和创建时间查询图片',
  },
  {
    table: 'asset_images',
    name: 'idx_asset_images_tenant_asset',
    columns: ['tenant_id', 'asset_code'],
    reason: '用于按租户和资产编码查询图片',
  },

  // maintenance_logs表
  {
    table: 'maintenance_logs',
    name: 'idx_maintenance_tenant_asset_status',
    columns: ['tenant_id', 'asset_code', 'status'],
    reason: '用于按租户、资产编码和状态查询维修记录',
  },
  {
    table: 'maintenance_logs',
    name: 'idx_maintenance_tenant_date',
    columns: ['tenant_id', 'maintenance_date'],
    reason: '用于按租户和维修日期查询维修记录',
  },

  // technical_documents表
  {
    table: 'technical_documents',
    name: 'idx_tech_docs_tenant_category',
    columns: ['tenant_id', 'category'],
    reason: '用于按租户和类别查询技术资料',
  },
  {
    table: 'technical_documents',
    name: 'idx_tech_docs_tenant_upload_date',
    columns: ['tenant_id', 'upload_date', 'created_at'],
    reason: '用于按租户和上传日期查询技术资料',
  },

  // asset_location_history表
  {
    table: 'asset_location_history',
    name: 'idx_location_asset_timestamp',
    columns: ['asset_code', 'record_time'],
    reason: '用于按资产编码和时间戳查询位置历史',
  },
  {
    table: 'asset_location_history',
    name: 'idx_location_tenant_asset_timestamp',
    columns: ['tenant_id', 'asset_code', 'record_time'],
    reason: '用于按租户、资产编码和时间戳查询位置历史',
  },
  {
    table: 'asset_location_history',
    name: 'idx_location_tenant_building_floor',
    columns: ['tenant_id', 'building_name', 'floor_number'],
    reason: '用于按租户、建筑和楼层查询位置历史',
  },

  // iot_devices表
  {
    table: 'iot_devices',
    name: 'idx_iot_tenant_status',
    columns: ['tenant_id', 'status'],
    reason: '用于按租户和设备状态查询物联网设备',
  },
  {
    table: 'iot_devices',
    name: 'idx_iot_tenant_last_online',
    columns: ['tenant_id', 'last_online_time'],
    reason: '用于按租户和最后活动时间查询物联网设备',
  },
  {
    table: 'iot_devices',
    name: 'idx_iot_tenant_type_active',
    columns: ['tenant_id', 'device_type', 'is_active'],
    reason: '用于按租户、设备类型和活跃状态查询物联网设备',
  },

  // quality_control_records表
  {
    table: 'quality_control_records',
    name: 'idx_qc_tenant_asset_status',
    columns: ['tenant_id', 'asset_code', 'status'],
    reason: '用于按租户、资产编码和状态查询质量控制记录',
  },
  {
    table: 'quality_control_records',
    name: 'idx_qc_tenant_qc_date',
    columns: ['tenant_id', 'qc_date'],
    reason: '用于按租户和质控日期查询质量控制记录',
  },
  {
    table: 'quality_control_records',
    name: 'idx_qc_tenant_type_result',
    columns: ['tenant_id', 'qc_type', 'result'],
    reason: '用于按租户、质控类型和结果查询质量控制记录',
  },

  // idle_assets表
  {
    table: 'idle_assets',
    name: 'idx_idle_tenant_status',
    columns: ['tenant_id', 'status'],
    reason: '用于按租户和状态查询闲置资产',
  },
  {
    table: 'idle_assets',
    name: 'idx_idle_tenant_publish',
    columns: ['tenant_id', 'publish_date'],
    reason: '用于按租户和发布日期查询闲置资产',
  },
];

// 检查索引是否已存在
async function checkIndexExists(table, indexName) {
  try {
    const [rows] = await db.execute(`SHOW INDEX FROM ${table} WHERE Key_name = ?`, [indexName]);
    return rows.length > 0;
  } catch (error) {
    console.error(`检查索引 ${indexName} 时出错:`, error.message);
    return false;
  }
}

// 添加单个索引
async function addIndex(indexConfig) {
  const { table, name, columns, reason } = indexConfig;

  try {
    // 检查索引是否已存在
    const exists = await checkIndexExists(table, name);
    if (exists) {
      console.log(`✅ 索引 ${name} 已存在，跳过创建`);
      return true;
    }

    // 创建索引
    const columnsStr = columns.join(', ');
    const sql = `ALTER TABLE ${table} ADD INDEX ${name} (${columnsStr})`;

    console.log(`📋 创建索引: ${name} 用于 ${table} 表`);
    console.log(`   列: ${columnsStr}`);
    console.log(`   原因: ${reason}`);

    await db.execute(sql);
    console.log(`✅ 索引 ${name} 创建成功`);
    return true;
  } catch (error) {
    console.error(`❌ 创建索引 ${name} 失败:`, error.message);
    return false;
  }
}

// 主函数
async function main() {
  console.log('🚀 开始添加复合索引...');
  console.log('='.repeat(80));

  let successCount = 0;
  let failureCount = 0;

  for (const indexConfig of compositeIndexes) {
    console.log(`\n${'-'.repeat(80)}`);
    const success = await addIndex(indexConfig);
    if (success) {
      successCount++;
    } else {
      failureCount++;
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 索引添加完成');
  console.log(`✅ 成功: ${successCount}`);
  console.log(`❌ 失败: ${failureCount}`);
  console.log(`📋 总计: ${compositeIndexes.length}`);

  // 关闭数据库连接
  await db.end();
}

// 运行脚本
if (require.main === module) {
  main().catch(error => {
    console.error('❌ 脚本执行失败:', error);
    process.exit(1);
  });
}

module.exports = { addIndex, main };
