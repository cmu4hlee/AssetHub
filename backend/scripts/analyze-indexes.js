const db = require('../config/database');

// 分析数据库表结构和索引的脚本
async function analyzeDatabaseIndexes() {
  console.log('🔍 开始分析数据库表结构和索引...');

  try {
    // 获取所有表名
    const [tables] = await db.execute(`
      SHOW TABLES
    `);

    console.log(`📊 发现 ${tables.length} 个表:`);
    tables.forEach((table, index) => {
      const tableName = Object.values(table)[0];
      console.log(`   ${index + 1}. ${tableName}`);
    });

    // 分析核心表的结构和索引
    const coreTables = [
      'assets',
      'asset_images',
      'maintenance_logs',
      'technical_documents',
      'asset_location_history',
      'iot_devices',
      'quality_control_records',
      'idle_assets',
      'asset_labels',
      'acceptance_records',
      'adverse_reaction_records',
      'tenants',
      'departments',
      'users',
      'user_tenant_roles',
      'audit_logs',
    ];

    for (const tableName of coreTables) {
      console.log(`\n📋 分析表: ${tableName}`);

      // 获取表结构
      const [columns] = await db.execute(`
        SHOW COLUMNS FROM ${tableName}
      `);

      console.log(`   字段数量: ${columns.length}`);
      columns.forEach(column => {
        console.log(`   - ${column.Field} (${column.Type}) ${column.Key === 'PRI' ? '[PK]' : ''}`);
      });

      // 获取索引
      const [indexes] = await db.execute(`
        SHOW INDEX FROM ${tableName}
      `);

      console.log(`\n   索引数量: ${indexes.length}`);
      const indexMap = new Map();

      indexes.forEach(index => {
        if (!indexMap.has(index.Key_name)) {
          indexMap.set(index.Key_name, {
            columns: [],
            unique: index.Non_unique === 0,
            primary: index.Key_name === 'PRIMARY',
          });
        }
        indexMap.get(index.Key_name).columns.push(index.Column_name);
      });

      indexMap.forEach((info, name) => {
        console.log(
          `   - ${name} ${info.primary ? '[PRIMARY]' : ''} ${info.unique ? '[UNIQUE]' : ''}`,
        );
        console.log(`     列: ${info.columns.join(', ')}`);
      });

      // 分析查询频率（基于代码中的查询模式）
      console.log('\n   建议的复合索引:');
      await analyzeTableQueries(tableName);
    }
  } catch (error) {
    console.error('❌ 分析数据库索引时出错:', error.message);
  } finally {
    console.log('\n✅ 数据库索引分析完成');
  }
}

// 分析表的查询模式并建议复合索引
async function analyzeTableQueries(tableName) {
  // 根据表名分析常见的查询模式
  const indexSuggestions = [];

  switch (tableName) {
    case 'assets':
      indexSuggestions.push({
        columns: ['tenant_id', 'department_id', 'status'],
        reason: '用于按租户、部门和状态查询资产',
      });
      indexSuggestions.push({
        columns: ['tenant_id', 'acquisition_date'],
        reason: '用于按租户和购置日期查询资产',
      });
      indexSuggestions.push({
        columns: ['tenant_id', 'asset_code'],
        reason: '用于按租户和资产编码查询资产',
      });
      break;

    case 'asset_images':
      indexSuggestions.push({
        columns: ['asset_code', 'created_at'],
        reason: '用于按资产编码和创建时间查询图片',
      });
      indexSuggestions.push({
        columns: ['tenant_id', 'asset_code'],
        reason: '用于按租户和资产编码查询图片',
      });
      break;

    case 'maintenance_logs':
      indexSuggestions.push({
        columns: ['tenant_id', 'asset_code', 'status'],
        reason: '用于按租户、资产编码和状态查询维修记录',
      });
      indexSuggestions.push({
        columns: ['tenant_id', 'maintenance_date'],
        reason: '用于按租户和维修日期查询维修记录',
      });
      break;

    case 'technical_documents':
      indexSuggestions.push({
        columns: ['tenant_id', 'asset_code'],
        reason: '用于按租户和资产编码查询技术资料',
      });
      indexSuggestions.push({
        columns: ['tenant_id', 'document_type', 'created_at'],
        reason: '用于按租户、文档类型和创建时间查询技术资料',
      });
      break;

    case 'asset_location_history':
      indexSuggestions.push({
        columns: ['asset_code', 'timestamp'],
        reason: '用于按资产编码和时间戳查询位置历史',
      });
      indexSuggestions.push({
        columns: ['tenant_id', 'asset_code', 'timestamp'],
        reason: '用于按租户、资产编码和时间戳查询位置历史',
      });
      break;

    case 'iot_devices':
      indexSuggestions.push({
        columns: ['tenant_id', 'device_status'],
        reason: '用于按租户和设备状态查询物联网设备',
      });
      indexSuggestions.push({
        columns: ['tenant_id', 'last_activity'],
        reason: '用于按租户和最后活动时间查询物联网设备',
      });
      break;

    case 'quality_control_records':
      indexSuggestions.push({
        columns: ['tenant_id', 'asset_code', 'status'],
        reason: '用于按租户、资产编码和状态查询质量控制记录',
      });
      indexSuggestions.push({
        columns: ['tenant_id', 'expiry_date'],
        reason: '用于按租户和过期日期查询质量控制记录',
      });
      break;

    case 'idle_assets':
      indexSuggestions.push({
        columns: ['tenant_id', 'status'],
        reason: '用于按租户和状态查询闲置资产',
      });
      indexSuggestions.push({
        columns: ['tenant_id', 'publish_date'],
        reason: '用于按租户和发布日期查询闲置资产',
      });
      break;

    case 'acceptance_records':
      indexSuggestions.push({
        columns: ['tenant_id', 'status'],
        reason: '用于按租户和状态查询验收记录',
      });
      indexSuggestions.push({
        columns: ['tenant_id', 'acceptance_date'],
        reason: '用于按租户和验收日期查询验收记录',
      });
      break;

    case 'adverse_reaction_records':
      indexSuggestions.push({
        columns: ['tenant_id', 'asset_code', 'status'],
        reason: '用于按租户、资产编码和状态查询不良事件记录',
      });
      indexSuggestions.push({
        columns: ['tenant_id', 'occurrence_date'],
        reason: '用于按租户和发生日期查询不良事件记录',
      });
      break;

    case 'users':
      indexSuggestions.push({
        columns: ['tenant_id', 'role'],
        reason: '用于按租户和角色查询用户',
      });
      indexSuggestions.push({
        columns: ['tenant_id', 'department_id'],
        reason: '用于按租户和部门查询用户',
      });
      break;

    case 'departments':
      indexSuggestions.push({
        columns: ['tenant_id', 'parent_id'],
        reason: '用于按租户和父部门查询部门',
      });
      break;

    case 'tenants':
      indexSuggestions.push({
        columns: ['status'],
        reason: '用于按状态查询租户',
      });
      break;

    case 'audit_logs':
      indexSuggestions.push({
        columns: ['tenant_id', 'action_type', 'created_at'],
        reason: '用于按租户、操作类型和创建时间查询审计日志',
      });
      break;
  }

  if (indexSuggestions.length > 0) {
    indexSuggestions.forEach((suggestion, index) => {
      console.log(`   ${index + 1}. ${suggestion.columns.join(', ')}`);
      console.log(`     原因: ${suggestion.reason}`);
    });
  } else {
    console.log('   暂无建议的复合索引');
  }
}

// 运行分析
if (require.main === module) {
  analyzeDatabaseIndexes();
}

module.exports = analyzeDatabaseIndexes;
