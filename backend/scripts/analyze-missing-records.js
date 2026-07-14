const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const { getDatabaseConfig } = require('./db-config-helper');
const { readFirstWorksheetObjects } = require('../utils/excel-reader');

// 使用统一的数据库配置助手
const config = getDatabaseConfig();

async function analyzeMissingRecords() {
  let connection;
  try {
    console.log('正在连接数据库...');
    connection = await mysql.createConnection(config);
    console.log('数据库连接成功');

    const excelPath = path.join(__dirname, '../config/zclist.xlsx');
    if (!fs.existsSync(excelPath)) {
      throw new Error(`Excel文件不存在: ${excelPath}`);
    }

    console.log('正在读取Excel文件...');
    const excelData = await readFirstWorksheetObjects(excelPath);
    console.log(`Excel中找到 ${excelData.length} 条记录`);

    console.log('正在获取数据库中的资产编号...');
    const [dbRecords] = await connection.execute(
      'SELECT asset.code, code, code2, code3 FROM assets',
    );
    console.log(`数据库中找到 ${dbRecords.length} 条记录`);

    // 创建数据库中所有资产编号的集合
    const dbAssetCodes = new Set();
    const dbCode1Set = new Set();
    const dbCode2Set = new Set();
    const dbCode3Set = new Set();

    dbRecords.forEach(record => {
      if (record.asset.code) dbAssetCodes.add(record.asset.code);
      if (record.code) dbCode1Set.add(record.code);
      if (record.code2) dbCode2Set.add(record.code2);
      if (record.code3) dbCode3Set.add(record.code3);
    });

    console.log('\n正在分析缺失的记录...');

    const missingRecords = [];
    const skippedRecords = [];
    const errorRecords = [];

    for (let i = 0; i < excelData.length; i++) {
      const row = excelData[i];

      // 模拟导入脚本中的资产编号生成逻辑
      const originalCode = (row['code'] || '').toString().trim().replace(/^\t+/, '');
      const originalCode2 = (row['code2'] || '').toString().trim().replace(/^\t+/, '');
      const originalCode3 = (row['code3'] || '').toString().trim().replace(/^\t+/, '');
      const assetCode = originalCode3 || originalCode || originalCode2 || `ZC${Date.now()}${i}`;

      // 检查必填字段
      const assetName = (row['name'] || '').toString().trim();
      if (!assetCode || !assetName) {
        errorRecords.push({
          row: i + 2,
          reason: '缺少必填字段（资产编号或资产名称）',
          code: assetCode,
          name: assetName,
        });
        continue;
      }

      // 检查是否已存在于数据库
      const existsInDb =
        dbAssetCodes.has(assetCode) ||
        (originalCode && dbCode1Set.has(originalCode)) ||
        (originalCode2 && dbCode2Set.has(originalCode2)) ||
        (originalCode3 && dbCode3Set.has(originalCode3));

      if (existsInDb) {
        skippedRecords.push({
          row: i + 2,
          code: assetCode,
          name: assetName,
        });
      } else {
        missingRecords.push({
          row: i + 2,
          code: assetCode,
          name: assetName,
          originalCode,
          originalCode2,
          originalCode3,
        });
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('分析结果：');
    console.log('='.repeat(60));
    console.log(`Excel总记录数: ${excelData.length}`);
    console.log(`数据库总记录数: ${dbRecords.length}`);
    console.log(`缺失的记录数: ${missingRecords.length}`);
    console.log(`已存在的记录数: ${skippedRecords.length}`);
    console.log(`有问题的记录数: ${errorRecords.length}`);
    console.log('='.repeat(60));

    if (missingRecords.length > 0) {
      console.log('\n缺失的记录（前10条）:');
      missingRecords.slice(0, 10).forEach(record => {
        console.log(`  行 ${record.row}: ${record.name} (编号: ${record.code})`);
      });

      if (missingRecords.length > 10) {
        console.log(`  ... 还有 ${missingRecords.length - 10} 条缺失记录`);
      }
    }

    if (errorRecords.length > 0) {
      console.log('\n有问题的记录（前10条）:');
      errorRecords.slice(0, 10).forEach(record => {
        console.log(`  行 ${record.row}: ${record.reason} - ${record.name} (编号: ${record.code})`);
      });

      if (errorRecords.length > 10) {
        console.log(`  ... 还有 ${errorRecords.length - 10} 条有问题的记录`);
      }
    }

    // 保存完整的分析报告
    const report = {
      totalExcelRecords: excelData.length,
      totalDbRecords: dbRecords.length,
      missingRecords,
      skippedRecords: skippedRecords.length,
      errorRecords,
    };

    const reportPath = path.join(__dirname, '../missing-records-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`\n完整的分析报告已保存到: ${reportPath}`);
  } catch (error) {
    console.error('分析失败:', error.message);
    console.error(error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n数据库连接已关闭');
    }
  }
}

analyzeMissingRecords();
