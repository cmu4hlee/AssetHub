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

async function importAssets() {
  let connection;
  try {
    console.log('正在连接数据库...');
    connection = await mysql.createConnection(config);
    console.log('数据库连接成功');

    // 读取Excel文件
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

    // 显示第一行数据，用于调试
    console.log('\n第一行数据示例:');
    console.log(JSON.stringify(data[0], null, 2));

    // 获取分类映射
    const [categories] = await connection.execute('SELECT id, name, code FROM asset_categories');
    const categoryMap = {};
    categories.forEach(cat => {
      categoryMap[cat.name] = cat.id;
      categoryMap[cat.code] = cat.id;
    });

    console.log('\n可用的分类:', Object.keys(categoryMap));

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    // 不使用事务，逐条提交（避免大量数据时事务过大）
    // await connection.beginTransaction();

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      try {
        // 字段映射 - 根据Excel实际列名
        const originalCode = (row['code'] || '').toString().trim().replace(/^\t+/, '');
        const originalCode2 = (row['code2'] || '').toString().trim().replace(/^\t+/, '');
        const originalCode3 = (row['code3'] || '').toString().trim().replace(/^\t+/, '');

        // 资产编号优先使用code3，其次code，最后code2，都没有则生成
        const assetCode = originalCode3 || originalCode || originalCode2 || `ZC${Date.now()}${i}`;

        // 处理价格 - 移除逗号和制表符
        const priceStr = (row['price'] || '0').toString().replace(/[,\t]/g, '').trim();
        const price = parseFloat(priceStr) || 0;

        // 辅助函数：安全截取字符串
        const safeSubstring = (str, maxLen) => {
          if (!str) return null;
          const s = String(str).trim();
          return s.length > 0 ? s.substring(0, maxLen) : null;
        };

        const assetName = (row['name'] || '').toString().trim() || `资产${i + 1}`;
        const assetType = mapAssetType(row['type'] || row['name'] || '');

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
          current_value: price, // 默认使用购置价格作为当前价值
          depreciation_method: null,
          depreciation_years: null,
          location: safeSubstring(row['location'] || row['roomID'], 200),
          department: safeSubstring(row['department'], 100),
          responsible_person: safeSubstring(row['user'] || row['user2'], 50),
          status: mapStatus(row['status'] || row['check'] || '在用'),
          supplier: safeSubstring(row['factory'], 200),
          warranty_period: null,
          warranty_end_date: null,
          remark: safeSubstring(row['remark'] || row['管理科室核实情况'], 500),
          created_by: '系统导入',
        };

        // 查找分类ID - 根据资产类型自动匹配
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
          // 默认使用普通设备
          assetData.category_id =
            categoryMap['普通设备'] || categories.find(c => c.code === 'PT')?.id || 2;
        }

        // 验证必填字段
        if (!assetData.asset.code || !assetData.asset_name) {
          throw new Error('资产编号或资产名称为空');
        }

        // 检查资产编号是否已存在
        const [existing] = await connection.execute('SELECT id FROM assets WHERE asset.code = ?', [
          assetData.asset.code,
        ]);

        if (existing.length > 0) {
          console.log(`跳过已存在的资产: ${assetData.asset.code}`);
          continue;
        }

        // 插入数据
        try {
          await connection.execute(
            `INSERT INTO assets (
              asset.code, code, code2, code3, asset_name, category_id, asset_type, brand, model,
              specification, purchase_date, purchase_price, current_value,
              depreciation_method, depreciation_years, location, department,
              responsible_person, status, supplier, warranty_period, warranty_end_date,
              remark, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
              assetData.responsible_person,
              assetData.status,
              assetData.supplier,
              assetData.warranty_period,
              assetData.warranty_end_date,
              assetData.remark,
              assetData.created_by,
            ],
          );
        } catch (insertError) {
          // 如果是重复键错误，跳过
          if (insertError.code === 'ER_DUP_ENTRY') {
            continue;
          }
          throw insertError;
        }

        successCount++;
        if (successCount % 500 === 0) {
          console.log(
            `已导入 ${successCount}/${data.length} 条记录 (${((successCount / data.length) * 100).toFixed(1)}%)...`,
          );
        }
      } catch (error) {
        errorCount++;
        errors.push({
          row: i + 2, // Excel行号（+2因为第一行是标题，从1开始）
          error: error.message,
          data: row,
        });
        console.error(`第 ${i + 2} 行导入失败:`, error.message);
      }
    }

    // 不使用事务，所以不需要提交
    // await connection.commit();
    console.log('\n导入完成！');
    console.log(`成功: ${successCount} 条`);
    console.log(`失败: ${errorCount} 条`);

    if (errors.length > 0 && errors.length <= 10) {
      console.log('\n错误详情:');
      errors.forEach(err => {
        console.log(`  第 ${err.row} 行: ${err.error}`);
      });
    } else if (errors.length > 10) {
      console.log('\n前10个错误详情:');
      errors.slice(0, 10).forEach(err => {
        console.log(`  第 ${err.row} 行: ${err.error}`);
      });
      console.log(`  ... 还有 ${errors.length - 10} 个错误`);
    }
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('导入失败:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('数据库连接已关闭');
    }
  }
}

// 映射资产类型
function mapAssetType(type) {
  if (!type) return '普通设备'; // 默认改为普通设备
  const typeStr = String(type).trim().toLowerCase();

  // 医疗设备关键词
  if (
    typeStr.includes('医疗') ||
    typeStr.includes('医院') ||
    typeStr.includes('ct') ||
    typeStr.includes('mri') ||
    typeStr.includes('x光') ||
    typeStr.includes('呼吸机') ||
    typeStr.includes('监护仪') ||
    typeStr.includes('检验') ||
    typeStr.includes('生化') ||
    typeStr.includes('血球')
  ) {
    return '医疗设备';
  }

  // 房产建筑关键词
  if (
    typeStr.includes('房产') ||
    typeStr.includes('建筑') ||
    typeStr.includes('房屋') ||
    typeStr.includes('土地') ||
    typeStr.includes('楼') ||
    typeStr.includes('房')
  ) {
    return '房产建筑';
  }

  // 办公家具关键词
  if (
    typeStr.includes('家具') ||
    typeStr.includes('办公') ||
    typeStr.includes('桌') ||
    typeStr.includes('椅') ||
    typeStr.includes('柜') ||
    typeStr.includes('架') ||
    typeStr.includes('沙发') ||
    typeStr.includes('床')
  ) {
    return '办公家具';
  }

  // 普通设备关键词
  if (
    typeStr.includes('设备') ||
    typeStr.includes('电脑') ||
    typeStr.includes('打印机') ||
    typeStr.includes('车辆') ||
    typeStr.includes('待完善')
  ) {
    return '普通设备';
  }

  // 根据名称判断（如果type是"待完善"，尝试从name判断）
  return '普通设备'; // 默认返回普通设备而不是"其他"
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

  // 如果是日期对象
  if (dateValue instanceof Date) {
    const year = dateValue.getFullYear();
    const month = String(dateValue.getMonth() + 1).padStart(2, '0');
    const day = String(dateValue.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // 如果是字符串
  const str = String(dateValue).trim().replace(/^\t+/, '');
  if (!str || str === 'null' || str === 'NULL' || str === '') return null;

  // 尝试解析中文日期格式，如 "2009年11月30日"
  const chineseDateMatch = str.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (chineseDateMatch) {
    const year = chineseDateMatch[1];
    const month = String(chineseDateMatch[2]).padStart(2, '0');
    const day = String(chineseDateMatch[3]).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // 尝试解析Excel日期序列号
  if (!isNaN(str) && parseFloat(str) > 0 && parseFloat(str) < 100000) {
    const excelDate = new Date((parseFloat(str) - 25569) * 86400 * 1000);
    if (!isNaN(excelDate.getTime())) {
      const year = excelDate.getFullYear();
      const month = String(excelDate.getMonth() + 1).padStart(2, '0');
      const day = String(excelDate.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }

  // 尝试解析标准日期格式 YYYY-MM-DD 或 YYYY/MM/DD
  const dateMatch = str.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (dateMatch) {
    const year = dateMatch[1];
    const month = String(dateMatch[2]).padStart(2, '0');
    const day = String(dateMatch[3]).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return null;
}

importAssets();
