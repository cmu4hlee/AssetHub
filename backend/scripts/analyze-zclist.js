const path = require('path');
const fs = require('fs');
const { readFirstWorksheetObjects, readFirstWorksheetRowsFromFile } = require('../utils/excel-reader');

const excelPath = path.join(__dirname, '../config/zclist.xlsx');

async function analyzeZclist() {
  console.log('正在分析 zclist.xlsx 文件...\n');

  // 检查文件是否存在
  if (!fs.existsSync(excelPath)) {
    console.error(`错误: 文件不存在: ${excelPath}`);
    return;
  }

  // 获取文件信息
  const stats = fs.statSync(excelPath);
  console.log('文件信息:');
  console.log(`  路径: ${excelPath}`);
  console.log(`  大小: ${(stats.size / 1024).toFixed(2)} KB`);
  console.log(`  最后修改: ${stats.mtime}`);
  console.log('');

  try {
    // 读取第一行（表头）
    const rows = await readFirstWorksheetRowsFromFile(excelPath);
    console.log('表头信息:');
    if (rows.length > 0) {
      const headers = rows[0];
      console.log(`  列数: ${headers.length}`);
      console.log(`  表头: ${headers.map((h, i) => `[${i+1}] ${h || '(空)'}`).join(', ')}`);
      console.log('');
    }

    // 读取为对象
    const data = await readFirstWorksheetObjects(excelPath);
    console.log(`数据总行数: ${data.length}`);
    console.log('');

    if (data.length > 0) {
      // 显示前5行数据的键
      console.log('第一条数据的字段:');
      const firstRow = data[0];
      Object.keys(firstRow).forEach(key => {
        console.log(`  ${key}: ${JSON.stringify(firstRow[key])}`);
      });
      console.log('');

      // 统计字段出现频率
      console.log('字段统计:');
      const fieldStats = {};
      data.forEach(row => {
        Object.keys(row).forEach(key => {
          if (!fieldStats[key]) fieldStats[key] = { count: 0, nonEmpty: 0 };
          fieldStats[key].count++;
          if (row[key] !== null && row[key] !== '') {
            fieldStats[key].nonEmpty++;
          }
        });
      });

      Object.entries(fieldStats).forEach(([key, stats]) => {
        const nonEmptyPercent = ((stats.nonEmpty / stats.count) * 100).toFixed(1);
        console.log(`  ${key}: ${stats.nonEmpty}/${stats.count} (${nonEmptyPercent}%)`);
      });
      console.log('');

      // 显示前3行完整数据
      console.log('前3行数据预览:');
      data.slice(0, 3).forEach((row, index) => {
        console.log(`\n第 ${index + 2} 行:`);
        Object.entries(row).forEach(([key, value]) => {
          const displayValue = value ? String(value).substring(0, 50) : '(空)';
          console.log(`  ${key}: ${displayValue}`);
        });
      });
    }
  } catch (error) {
    console.error('分析失败:', error.message);
    console.error(error);
  }
}

analyzeZclist();