const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const { getDatabaseConfig } = require('./db-config-helper');
const { readFirstWorksheetObjects } = require('../utils/excel-reader');

// 使用统一的数据库配置助手
const config = getDatabaseConfig();

// 辅助函数：安全截取字符串
function safeSubstring(str, maxLen) {
  if (!str) return null;
  const s = String(str).trim();
  return s.length > 0 ? (s.length > maxLen ? s.substring(0, maxLen) : s) : null;
}

// 映射资产类型
function mapAssetType(type, name) {
  const typeStr = String(type || '')
    .trim()
    .toLowerCase();
  const nameStr = String(name || '')
    .trim()
    .toLowerCase();
  const combined = `${typeStr} ${nameStr}`;

  // 医疗设备关键词
  if (
    combined.includes('医疗') ||
    combined.includes('医院') ||
    combined.includes('ct') ||
    combined.includes('mri') ||
    combined.includes('x光') ||
    combined.includes('呼吸机') ||
    combined.includes('监护仪') ||
    combined.includes('检验') ||
    combined.includes('生化') ||
    combined.includes('血球') ||
    combined.includes('超声') ||
    combined.includes('心电图')
  ) {
    return '医疗设备';
  }

  // 房产建筑关键词
  if (
    combined.includes('房产') ||
    combined.includes('建筑') ||
    combined.includes('房屋') ||
    combined.includes('土地') ||
    combined.includes('楼') ||
    combined.includes('房') ||
    combined.includes('建筑物')
  ) {
    return '房产建筑';
  }

  // 办公家具关键词
  if (
    combined.includes('家具') ||
    combined.includes('办公') ||
    combined.includes('桌') ||
    combined.includes('椅') ||
    combined.includes('柜') ||
    combined.includes('架') ||
    combined.includes('沙发') ||
    combined.includes('床') ||
    combined.includes('货架') ||
    combined.includes('文件柜')
  ) {
    return '办公家具';
  }

  // 普通设备（默认）
  return '普通设备';
}

// 映射状态
function mapStatus(status) {
  if (!status) return '在用';
  const statusStr = String(status).trim();
  if (statusStr.includes('闲置')) return '闲置';
  if (statusStr.includes('维修')) return '维修';
  if (statusStr.includes('报废')) return '报废';
  if (statusStr.includes('调配')) return '调配中';
  return '在用';
}

// 格式化日期
function formatDate(dateValue) {
  if (!dateValue) return null;

  if (dateValue instanceof Date) {
    const year = dateValue.getFullYear();
    const month = String(dateValue.getMonth() + 1).padStart(2, '0');
    const day = String(dateValue.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const str = String(dateValue).trim().replace(/^\t+/, '');
  if (!str || str === 'null' || str === 'NULL' || str === '') return null;

  // 中文日期格式 "2009年11月30日"
  const chineseDateMatch = str.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (chineseDateMatch) {
    const year = chineseDateMatch[1];
    const month = String(chineseDateMatch[2]).padStart(2, '0');
    const day = String(chineseDateMatch[3]).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Excel日期序列号
  if (!isNaN(str) && parseFloat(str) > 0 && parseFloat(str) < 100000) {
    const excelDate = new Date((parseFloat(str) - 25569) * 86400 * 1000);
    if (!isNaN(excelDate.getTime())) {
      const year = excelDate.getFullYear();
      const month = String(excelDate.getMonth() + 1).padStart(2, '0');
      const day = String(excelDate.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }

  // 标准日期格式
  const dateMatch = str.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (dateMatch) {
    const year = dateMatch[1];
    const month = String(dateMatch[2]).padStart(2, '0');
    const day = String(dateMatch[3]).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return null;
}

// 格式化日期时间（用于原始创建时间）
function formatDateTime(dateTimeValue) {
  if (!dateTimeValue) return null;

  if (dateTimeValue instanceof Date) {
    const year = dateTimeValue.getFullYear();
    const month = String(dateTimeValue.getMonth() + 1).padStart(2, '0');
    const day = String(dateTimeValue.getDate()).padStart(2, '0');
    const hours = String(dateTimeValue.getHours()).padStart(2, '0');
    const minutes = String(dateTimeValue.getMinutes()).padStart(2, '0');
    const seconds = String(dateTimeValue.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  const str = String(dateTimeValue).trim().replace(/^\t+/, '');
  if (!str || str === 'null' || str === 'NULL' || str === '') return null;

  // 尝试解析标准日期时间格式 YYYY-MM-DD HH:mm:ss
  const dateTimeMatch = str.match(
    /(\d{4})[-/](\d{1,2})[-/](\d{1,2})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})/,
  );
  if (dateTimeMatch) {
    const year = dateTimeMatch[1];
    const month = String(dateTimeMatch[2]).padStart(2, '0');
    const day = String(dateTimeMatch[3]).padStart(2, '0');
    const hours = String(dateTimeMatch[4]).padStart(2, '0');
    const minutes = String(dateTimeMatch[5]).padStart(2, '0');
    const seconds = String(dateTimeMatch[6]).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  // 尝试解析只有日期的格式
  const dateMatch = str.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (dateMatch) {
    const year = dateMatch[1];
    const month = String(dateMatch[2]).padStart(2, '0');
    const day = String(dateMatch[3]).padStart(2, '0');
    return `${year}-${month}-${day} 00:00:00`;
  }

  return null;
}

// 生成唯一资产编号
async function generateUniqueAssetCode(connection, baseCode, rowIndex) {
  let counter = 1;
  let newCode = baseCode;

  // 检查当前代码是否已存在（不区分大小写）
  while (counter <= 100) {
    const [existing] = await connection.execute(
      'SELECT id FROM assets WHERE LOWER(asset.code) = LOWER(?)',
      [newCode],
    );

    if (existing.length === 0) {
      return newCode;
    }

    // 生成新的代码
    newCode = `${baseCode}_${counter}`;
    counter++;

  }

  return `ZC_${Date.now()}_${rowIndex}`;
}

async function fixDuplicateCodes() {
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
    const data = await readFirstWorksheetObjects(excelPath);
    console.log(`Excel中找到 ${data.length} 条记录`);

    console.log('正在获取数据库中所有资产编号...');
    const [dbRecords] = await connection.execute('SELECT asset.code FROM assets');

    // 获取分类映射
    const [categories] = await connection.execute('SELECT id, name, code FROM asset_categories');
    const categoryMap = {};
    categories.forEach(cat => {
      categoryMap[cat.name] = cat.id;
      categoryMap[cat.code] = cat.id;
    });

    // 创建一个不区分大小写的资产编号集合
    const existingCodes = new Set();
    dbRecords.forEach(record => {
      if (record.asset.code) {
        existingCodes.add(record.asset.code.toLowerCase());
      }
    });

    console.log('\n正在查找Excel中的重复资产编号...');

    // 查找Excel中使用相同资产编号的记录
    const codeToRows = new Map();
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const originalCode = (row['code'] || '').toString().trim().replace(/^\t+/, '');
      const originalCode2 = (row['code2'] || '').toString().trim().replace(/^\t+/, '');
      const originalCode3 = (row['code3'] || '').toString().trim().replace(/^\t+/, '');

      // 资产编号优先使用code3，其次code，最后code2
      const assetCode = originalCode3 || originalCode || originalCode2;

      if (assetCode) {
        const codeLower = assetCode.toLowerCase();
        if (!codeToRows.has(codeLower)) {
          codeToRows.set(codeLower, []);
        }
        codeToRows.get(codeLower).push({ index: i, row, assetCode });
      }
    }

    // 找出重复的资产编号
    const duplicateCodes = [];
    codeToRows.forEach((rows, code) => {
      if (rows.length > 1) {
        duplicateCodes.push({ code, rows });
      }
    });

    console.log(`找到 ${duplicateCodes.length} 个重复的资产编号`);
    console.log('\n正在处理重复的资产编号...');
    console.log('='.repeat(50));

    let processedCount = 0;
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const { code, rows } of duplicateCodes) {
      console.log(`\n处理重复编号: ${code}`);
      console.log(`共有 ${rows.length} 条记录使用此编号`);

      let firstRecordProcessed = false;

      for (const { index, row, assetCode } of rows) {
        const rowNum = index + 2;
        console.log(`\n  处理行 ${rowNum}: ${row['name'] || '未命名资产'}`);

        try {
          // 检查记录是否符合导入条件
          const assetName = (row['name'] || '').toString().trim();
          if (!assetName) {
            console.log('    跳过: 缺少资产名称');
            skipCount++;
            continue;
          }

          // 处理价格
          const priceStr = (row['price'] || '0').toString().replace(/[,\t]/g, '').trim();
          const price = parseFloat(priceStr) || 0;

          const assetType = mapAssetType(row['type'], row['name']);

          // 格式化原始创建时间
          const originalCreatedAt = formatDateTime(row['创建时间']);

          // 如果是第一条记录且数据库中不存在，则使用原始编号
          let finalAssetCode = assetCode;
          if (firstRecordProcessed || existingCodes.has(assetCode.toLowerCase())) {
            // 生成新的唯一编号
            finalAssetCode = await generateUniqueAssetCode(connection, assetCode, index);
            console.log(`    生成新编号: ${finalAssetCode}`);
          }

          const assetData = {
            'asset.code': finalAssetCode,
            code: (row['code'] || '').toString().trim().replace(/^\t+/, '') || null,
            code2: (row['code2'] || '').toString().trim().replace(/^\t+/, '') || null,
            code3: (row['code3'] || '').toString().trim().replace(/^\t+/, '') || null,
            asset_name: assetName.length > 200 ? assetName.substring(0, 200) : assetName,
            category_id: null,
            asset_type: assetType,
            brand: safeSubstring(row['band'] || row['factory'], 100),
            model: safeSubstring(row['sn'], 100),
            specification: null,
            purchase_date: formatDate(row['date_of_acquisition']),
            purchase_price: price,
            current_value: price,
            depreciation_method: null,
            depreciation_years: null,
            location: safeSubstring(row['location'] || row['roomID'], 200),
            department: safeSubstring(row['department'], 100),
            unit: safeSubstring(row['unit'], 200),
            responsible_person: safeSubstring(row['user'] || row['user2'], 50),
            status: mapStatus(row['status'] || row['check'] || '在用'),
            supplier: safeSubstring(row['factory'], 200),
            data_id: safeSubstring(row['数据标识'], 100),
            original_created_at: originalCreatedAt,
            warranty_period: null,
            warranty_end_date: null,
            remark: safeSubstring(row['remark'] || row['管理科室核实情况'], 500),
            created_by: '系统导入-修复',
          };

          // 查找分类ID
          if (assetType === '医疗设备') {
            assetData.category_id =
              categoryMap['医疗设备'] || categories.find(c => c.code === 'YL')?.id || 1;
          } else if (assetType === '普通设备') {
            assetData.category_id =
              categoryMap['普通设备'] || categories.find(c => c.code === 'PT')?.id || 2;
          } else if (assetType === '房产建筑') {
            assetData.category_id =
              categoryMap['房产建筑'] || categories.find(c => c.code === 'FC')?.id || 3;
          } else if (assetType === '办公家具') {
            assetData.category_id =
              categoryMap['办公家具'] || categories.find(c => c.code === 'BG')?.id || 4;
          } else {
            assetData.category_id =
              categoryMap['普通设备'] || categories.find(c => c.code === 'PT')?.id || 2;
          }

          // 检查是否已存在（不区分大小写）
          const [existing] = await connection.execute(
            'SELECT id FROM assets WHERE LOWER(asset.code) = LOWER(?)',
            [assetData.asset.code],
          );

          if (existing.length > 0) {
            console.log('    跳过: 记录已存在');
            skipCount++;
            continue;
          }

          // 插入数据
          await connection.execute(
            `INSERT INTO assets (
              asset.code, code, code2, code3, asset_name, category_id, asset_type, brand, model,
              specification, purchase_date, purchase_price, current_value,
              depreciation_method, depreciation_years, location, department, unit,
              responsible_person, status, supplier, data_id, original_created_at,
              warranty_period, warranty_end_date, remark, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              assetData.asset.code,
              assetData.code,
              assetData.code2,
              assetData.code3,
              assetData.asset_name,
              assetData.category_id,
              assetData.asset_type,
              assetData.brand,
              assetData.model,
              assetData.specification,
              assetData.purchase_date,
              assetData.purchase_price,
              assetData.current_value,
              assetData.depreciation_method,
              assetData.depreciation_years,
              assetData.location,
              assetData.department,
              assetData.unit,
              assetData.responsible_person,
              assetData.status,
              assetData.supplier,
              assetData.data_id,
              assetData.original_created_at,
              assetData.warranty_period,
              assetData.warranty_end_date,
              assetData.remark,
              assetData.created_by,
            ],
          );

          console.log('    成功: 记录导入完成');
          successCount++;
          processedCount++;
          firstRecordProcessed = true;

          // 更新已存在编号集合
          existingCodes.add(assetData.asset.code.toLowerCase());
        } catch (error) {
          console.error(`    失败: ${error.message}`);
          errorCount++;
        }
      }
    }

    console.log(`\n${'='.repeat(50)}`);
    console.log('修复完成！');
    console.log(`处理了 ${processedCount} 条重复编号记录`);
    console.log(`成功: ${successCount} 条`);
    console.log(`跳过: ${skipCount} 条`);
    console.log(`失败: ${errorCount} 条`);
    console.log('='.repeat(50));

    // 检查最终记录数
    const [finalCount] = await connection.execute('SELECT COUNT(*) AS total FROM assets');
    console.log(`\n数据库最终记录数: ${finalCount[0].total}`);
    console.log(`Excel记录数: ${data.length}`);
  } catch (error) {
    console.error('修复失败:', error.message);
    console.error(error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n数据库连接已关闭');
    }
  }
}

fixDuplicateCodes();
