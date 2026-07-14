/**
 * 修复远程数据库category字符集
 */
const mysql = require('mysql2/promise');

const config = {
  host: '101.37.236.101',
  port: 3306,
  user: 'root',
  password: 'Cmu19801008',
  database: 'zcgl',
  charset: 'utf8mb4',
};

const moduleCategories = {
  'adverse-event': '质量与安全',
  'asset-ai-assistant': '资产生命周期',
  'asset-management': '资产生命周期',
  'asset-risk-management': '质量与安全',
  'asset-usage-management': '资产生命周期',
  'compliance-management': '质量与合规',
  'ct-maintenance-assistant-management': '资产生命周期',
  'department-management': '系统基础',
  'depreciation-management': '财务管理',
  'inventory-management': '资产生命周期',
  'iot-asset-monitoring-management': '物联与定位',
  'iot-environment-monitoring-management': '物联与定位',
  'iot-geo-location-management': '物联与定位',
  'iot-management': '物联与定位',
  'iot-zone-location-management': '物联与定位',
  'label-management': '资产生命周期',
  'maintenance-management': '维护与工单',
  'message-integration': '系统基础',
  'preventive-maintenance-management': '维护与工单',
  'procurement-management': '资产生命周期',
  'quality-assurance-management': '质量与安全',
  'quality-common': '系统基础',
  'quality-control': '质量与安全',
  'safety-inspection-management': '质量与安全',
  'special-equipment-management': '质量与安全',
  'staff-qualification': '人力资源',
  'uptime-management': '分析与统计',
  'user-management': '系统基础',
};

async function fixCategory() {
  let connection;
  try {
    connection = await mysql.createConnection(config);
    console.log('数据库连接成功');

    await connection.execute('SET NAMES utf8mb4');

    for (const [id, category] of Object.entries(moduleCategories)) {
      await connection.execute(
        'UPDATE system_modules SET category = ? WHERE id = ?',
        [category, id],
      );
      console.log(`✓ 更新: ${id} -> ${category}`);
    }

    const [rows] = await connection.execute(
      'SELECT id, name, category FROM system_modules ORDER BY category, id',
    );

    console.log('\n修复后的模块列表:');
    console.log('==================');
    rows.forEach(row => {
      console.log(`${row.name}: ${row.category}`);
    });

  } catch (error) {
    console.error('修复失败:', error.message);
  } finally {
    if (connection) await connection.end();
  }
}

fixCategory();
