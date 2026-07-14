/**
 * 修复远程数据库字符集问题
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

const moduleNames = {
  'adverse-event': '不良事件',
  'asset-ai-assistant': '资产AI助手',
  'asset-management': '库存管理',
  'asset-risk-management': '风险管理',
  'asset-usage-management': '资产使用',
  'compliance-management': '合规性管理',
  'ct-maintenance-assistant-management': 'CT维护助手模块',
  'department-management': '部门管理',
  'depreciation-management': '折旧管理',
  'inventory-management': '盘点管理',
  'iot-asset-monitoring-management': '资产监测模块',
  'iot-environment-monitoring-management': '环境监测模块',
  'iot-geo-location-management': '地理定位模块',
  'iot-management': '物联网管理',
  'iot-zone-location-management': '区域定位模块',
  'label-management': '标签管理',
  'maintenance-management': '日常维修',
  'message-integration': '消息平台集成',
  'preventive-maintenance-management': '预防性维护',
  'procurement-management': '采购管理',
  'quality-assurance-management': '质控管理',
  'quality-common': '平台公共能力',
  'quality-control': '计量管理',
  'safety-inspection-management': '安全检测管理',
  'special-equipment-management': '特种设备管理',
  'staff-qualification': '人员资质管理',
  'uptime-management': '开机率管理',
  'user-management': '用户管理',
};

async function fixCharset() {
  let connection;
  try {
    connection = await mysql.createConnection(config);
    console.log('数据库连接成功');

    // 设置字符集
    await connection.execute('SET NAMES utf8mb4');
    await connection.execute('SET CHARACTER SET utf8mb4');

    // 更新每个模块名称
    for (const [id, name] of Object.entries(moduleNames)) {
      await connection.execute(
        'UPDATE system_modules SET name = ? WHERE id = ?',
        [name, id],
      );
      console.log(`✓ 更新: ${id} -> ${name}`);
    }

    // 验证结果
    const [rows] = await connection.execute(
      'SELECT id, name, category FROM system_modules ORDER BY category, id',
    );

    console.log('\n修复后的模块列表:');
    console.log('==================');
    rows.forEach(row => {
      console.log(`${row.id}: ${row.name} (${row.category})`);
    });

    console.log(`\n共修复 ${rows.length} 个模块`);

  } catch (error) {
    console.error('修复失败:', error.message);
  } finally {
    if (connection) await connection.end();
  }
}

fixCharset();
