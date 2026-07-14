const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const { getDatabaseConfig } = require('./db-config-helper');
const { readFirstWorksheetObjects } = require('../utils/excel-reader');

// 使用统一的数据库配置助手
const config = {
  ...getDatabaseConfig(),
  multipleStatements: false,
};

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

async function importAssets() {
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
    console.log(`找到 ${data.length} 条资产记录`);

    if (data.length === 0) {
      console.log('Excel文件中没有数据');
      return;
    }

    // 获取分类映射
    const [categories] = await connection.execute('SELECT id, name, code FROM asset_categories');
    const categoryMap = {};
    categories.forEach(cat => {
      categoryMap[cat.name] = cat.id;
      categoryMap[cat.code] = cat.id;
    });

    let successCount = 0;
    let errorCount = 0;
    let skipCount = 0;
    const errors = [];

    console.log('开始导入数据...\n');

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      try {
        // 获取原始编码
        const originalCode = (row['code'] || '').toString().trim().replace(/^\t+/, '');
        const originalCode2 = (row['code2'] || '').toString().trim().replace(/^\t+/, '');
        const originalCode3 = (row['code3'] || '').toString().trim().replace(/^\t+/, '');

        // 资产编号优先使用code3，其次code，最后code2，都没有则生成
        const assetCode = originalCode3 || originalCode || originalCode2 || `ZC${Date.now()}${i}`;

        // 处理价格
        const priceStr = (row['price'] || '0').toString().replace(/[,\t]/g, '').trim();
        const price = parseFloat(priceStr) || 0;

        const assetName = (row['name'] || '').toString().trim() || `资产${i + 1}`;
        const assetType = mapAssetType(row['type'], row['name']);

        // 格式化原始创建时间
        const originalCreatedAt = formatDateTime(row['创建时间']);

        const assetData = {
          'asset.code': assetCode,
          code: originalCode || null,
          code2: originalCode2 || null,
          code3: originalCode3 || null,
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
          unit: safeSubstring(row['unit'], 200), // 单位
          responsible_person: safeSubstring(row['user'] || row['user2'], 50),
          status: mapStatus(row['status'] || row['check'] || '在用'),
          supplier: safeSubstring(row['factory'], 200),
          data_id: safeSubstring(row['数据标识'], 100), // 数据标识
          original_created_at: originalCreatedAt, // 原始创建时间
          warranty_period: null,
          warranty_end_date: null,
          remark: safeSubstring(row['remark'] || row['管理科室核实情况'], 500),
          created_by: '系统导入',
        };

        // 验证必填字段
        if (!assetData.asset.code || !assetData.asset_name) {
          throw new Error('资产编号或资产名称为空');
        }

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

        // 检查是否已存在
        const [existing] = await connection.execute('SELECT id FROM assets WHERE asset.code = ?', [
          assetData.asset.code,
        ]);

        if (existing.length > 0) {
          skipCount++;
          if (skipCount % 1000 === 0) {
            console.log(`已跳过 ${skipCount} 条已存在的记录...`);
          }
          continue;
        }

        // 插入数据
        try {
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
        } catch (insertError) {
          if (insertError.code === 'ER_DUP_ENTRY') {
            skipCount++;
            continue;
          }
          throw insertError;
        }

        successCount++;
        if (successCount % 500 === 0) {
          const progress = ((successCount / data.length) * 100).toFixed(1);
          console.log(
            `进度: ${successCount}/${data.length} (${progress}%) - 成功: ${successCount}, 跳过: ${skipCount}, 失败: ${errorCount}`,
          );
        }
      } catch (error) {
        errorCount++;
        if (errorCount <= 20) {
          errors.push({
            row: i + 2,
            error: error.message,
            code: row['code'] || row['code3'] || 'N/A',
          });
          console.error(
            `第 ${i + 2} 行导入失败 (${row['code'] || row['code3'] || 'N/A'}):`,
            error.message,
          );
        }
      }
    }

    console.log(`\n${'='.repeat(50)}`);
    console.log('导入完成！');
    console.log(`成功: ${successCount} 条`);
    console.log(`跳过: ${skipCount} 条（已存在）`);
    console.log(`失败: ${errorCount} 条`);
    console.log('='.repeat(50));

    if (errors.length > 0) {
      console.log('\n错误详情（前20个）:');
      errors.forEach(err => {
        console.log(`  第 ${err.row} 行 (${err.code}): ${err.error}`);
      });
    }
  } catch (error) {
    console.error('导入失败:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n数据库连接已关闭');
    }
  }
}

importAssets();
