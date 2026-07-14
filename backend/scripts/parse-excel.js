const path = require('path');
const { readWorksheetObjectsFromFile } = require('../utils/excel-reader');

async function parseExcel() {
  const worksheets = await readWorksheetObjectsFromFile(path.join(__dirname, '../config/db.xlsx'));

  // 获取所有工作表名称
  console.log('工作表名称:', worksheets.map(worksheet => worksheet.name));

  // 遍历每个工作表，打印结构信息
  worksheets.forEach(worksheet => {
    console.log(`\n=== 工作表: ${worksheet.name} ===`);
    const jsonData = worksheet.rows;

    if (jsonData.length > 0) {
      console.log('数据行数:', jsonData.length);
      console.log('列名:', Object.keys(jsonData[0]));
      console.log('前5行数据:', JSON.stringify(jsonData.slice(0, 5), null, 2));
    } else {
      console.log('该工作表没有数据');
    }
  });
}

parseExcel().catch(error => {
  console.error('解析Excel失败:', error);
  process.exit(1);
});
