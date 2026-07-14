const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const { getDatabaseConfig } = require('./db-config-helper');
const { readFirstWorksheetObjects } = require('../utils/excel-reader');

// 使用统一的数据库配置助手
const config = getDatabaseConfig();

// 辅助函数：模拟导入脚本中的资产编号生成逻辑
function generateAssetCode(row, rowIndex) {
  const originalCode = (row['code'] || '').toString().trim().replace(/^\t+/, '');
  const originalCode2 = (row['code2'] || '').toString().trim().replace(/^\t+/, '');
  const originalCode3 = (row['code3'] || '').toString().trim().replace(/^\t+/, '');
  return originalCode3 || originalCode || originalCode2 || `ZC${Date.now()}${rowIndex}`;
}

// 辅助函数：检查记录是否符合导入条件
function checkImportConditions(row) {
  const conditions = {
    hasAssetName: false,
    hasAssetCode: false,
    reason: '',
  };

  // 检查资产名称
  const assetName = (row['name'] || '').toString().trim();
  conditions.hasAssetName = assetName.length > 0;

  // 检查资产编号相关字段
  const originalCode = (row['code'] || '').toString().trim().replace(/^\t+/, '');
  const originalCode2 = (row['code2'] || '').toString().trim().replace(/^\t+/, '');
  const originalCode3 = (row['code3'] || '').toString().trim().replace(/^\t+/, '');
  conditions.hasAssetCode =
    originalCode3.length > 0 || originalCode.length > 0 || originalCode2.length > 0;

  if (!conditions.hasAssetName && !conditions.hasAssetCode) {
    conditions.reason = '缺少资产名称和所有资产编号字段';
  } else if (!conditions.hasAssetName) {
    conditions.reason = '缺少资产名称';
  } else if (!conditions.hasAssetCode) {
    conditions.reason = '缺少所有资产编号字段';
  }

  return conditions;
}

async function detailedAnalyze() {
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

    console.log('正在获取数据库中的所有资产记录...');
    const [dbRecords] = await connection.execute(
      'SELECT asset.code, code, code2, code3, asset_name FROM assets',
    );
    console.log(`数据库中找到 ${dbRecords.length} 条记录`);

    // 创建数据库记录的查找映射
    const dbLookup = new Map();
    dbRecords.forEach((record, index) => {
      // 使用多种方式查找记录
      const keys = [];
      if (record.asset.code) keys.push(record.asset.code);
      if (record.code) keys.push(record.code);
      if (record.code2) keys.push(record.code2);
      if (record.code3) keys.push(record.code3);

      keys.forEach(key => {
        if (key) {
          dbLookup.set(key, { ...record, dbIndex: index });
        }
      });
    });

    console.log('\n正在进行详细分析...');

    const results = {
      totalExcel: excelData.length,
      totalDb: dbRecords.length,
      matched: 0,
      unmatched: 0,
      skippedDueToConditions: 0,
      skippedDuplicates: 0,
      records: [],
    };

    // 用于跟踪重复的资产编号
    const generatedCodes = new Set();

    for (let i = 0; i < excelData.length; i++) {
      const row = excelData[i];
      const rowNum = i + 2; // Excel行号从1开始，且有表头

      // 模拟生成资产编号
      const assetCode = generateAssetCode(row, i);

      // 检查导入条件
      const importConditions = checkImportConditions(row);

      // 检查是否重复生成了相同的资产编号
      let isDuplicateCode = false;
      if (generatedCodes.has(assetCode)) {
        isDuplicateCode = true;
      } else {
        generatedCodes.add(assetCode);
      }

      // 检查是否在数据库中找到
      let foundInDb = false;
      let dbRecord = null;
      let matchReason = '';

      // 尝试多种方式查找
      const lookupKeys = [];
      if (assetCode) lookupKeys.push(assetCode);
      if (row['code']) lookupKeys.push((row['code'] || '').toString().trim());
      if (row['code2']) lookupKeys.push((row['code2'] || '').toString().trim());
      if (row['code3']) lookupKeys.push((row['code3'] || '').toString().trim());

      for (const key of lookupKeys) {
        if (key && dbLookup.has(key)) {
          foundInDb = true;
          dbRecord = dbLookup.get(key);
          matchReason = key;
          break;
        }
      }

      const recordResult = {
        rowNum,
        assetName: (row['name'] || '').toString().trim(),
        assetCode,
        originalCode: (row['code'] || '').toString().trim(),
        originalCode2: (row['code2'] || '').toString().trim(),
        originalCode3: (row['code3'] || '').toString().trim(),
        importConditions,
        isDuplicateCode,
        foundInDb,
        matchReason,
        dbRecord,
      };

      results.records.push(recordResult);

      // 更新统计信息
      if (!importConditions.hasAssetName || !importConditions.hasAssetCode) {
        results.skippedDueToConditions++;
      } else if (isDuplicateCode) {
        results.skippedDuplicates++;
      } else if (foundInDb) {
        results.matched++;
      } else {
        results.unmatched++;
      }

      // 每处理1000条记录显示进度
      if ((i + 1) % 1000 === 0) {
        console.log(`处理了 ${i + 1}/${excelData.length} 条记录`);
      }
    }

    console.log(`\n${'='.repeat(70)}`);
    console.log('详细分析结果：');
    console.log('='.repeat(70));
    console.log(`Excel总记录数: ${results.totalExcel}`);
    console.log(`数据库总记录数: ${results.totalDb}`);
    console.log(`成功匹配: ${results.matched}`);
    console.log(`未匹配: ${results.unmatched}`);
    console.log(`因条件不满足被跳过: ${results.skippedDueToConditions}`);
    console.log(`因重复编号被跳过: ${results.skippedDuplicates}`);
    console.log('='.repeat(70));

    // 检查未匹配的记录
    if (results.unmatched > 0) {
      console.log('\n未匹配的记录（前20条）:');
      const unmatchedRecords = results.records.filter(
        r => !r.foundInDb && r.importConditions.hasAssetName && r.importConditions.hasAssetCode,
      );
      unmatchedRecords.slice(0, 20).forEach(record => {
        console.log(`  行 ${record.rowNum}: ${record.assetName} (编号: ${record.assetCode})`);
        console.log(
          `     原始编码: ${record.originalCode}, ${record.originalCode2}, ${record.originalCode3}`,
        );
      });

      if (unmatchedRecords.length > 20) {
        console.log(`  ... 还有 ${unmatchedRecords.length - 20} 条未匹配记录`);
      }
    }

    // 检查因条件不满足被跳过的记录
    if (results.skippedDueToConditions > 0) {
      console.log('\n因条件不满足被跳过的记录（前20条）:');
      const skippedRecords = results.records.filter(
        r => !r.importConditions.hasAssetName || !r.importConditions.hasAssetCode,
      );
      skippedRecords.slice(0, 20).forEach(record => {
        console.log(`  行 ${record.rowNum}: ${record.assetName} (编号: ${record.assetCode})`);
        console.log(`     原因: ${record.importConditions.reason}`);
      });

      if (skippedRecords.length > 20) {
        console.log(`  ... 还有 ${skippedRecords.length - 20} 条被跳过记录`);
      }
    }

    // 检查重复编号的记录
    if (results.skippedDuplicates > 0) {
      console.log('\n因重复编号被跳过的记录（前20条）:');
      const duplicateRecords = results.records.filter(r => r.isDuplicateCode);
      duplicateRecords.slice(0, 20).forEach(record => {
        console.log(`  行 ${record.rowNum}: ${record.assetName} (编号: ${record.assetCode})`);
        console.log(
          `     原始编码: ${record.originalCode}, ${record.originalCode2}, ${record.originalCode3}`,
        );
      });

      if (duplicateRecords.length > 20) {
        console.log(`  ... 还有 ${duplicateRecords.length - 20} 条重复记录`);
      }
    }

    // 保存完整的分析结果
    const reportPath = path.join(__dirname, '../detailed-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2), 'utf8');
    console.log(`\n完整的详细报告已保存到: ${reportPath}`);

    // 保存未匹配记录的详细信息
    const unmatchedPath = path.join(__dirname, '../unmatched-records.json');
    const unmatchedDetails = results.records
      .filter(
        r => !r.foundInDb && r.importConditions.hasAssetName && r.importConditions.hasAssetCode,
      )
      .map(r => ({
        rowNum: r.rowNum,
        assetName: r.assetName,
        assetCode: r.assetCode,
        originalCode: r.originalCode,
        originalCode2: r.originalCode2,
        originalCode3: r.originalCode3,
      }));
    fs.writeFileSync(unmatchedPath, JSON.stringify(unmatchedDetails, null, 2), 'utf8');
    console.log(`未匹配记录详情已保存到: ${unmatchedPath}`);
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

detailedAnalyze();
