const db = require('../config/database');

async function addAssetCategoryFields() {
  let connection;
  try {
    console.log('开始为资产表添加分类相关字段...');
    connection = await db.getConnection();
    console.log('✅ 数据库连接已建立');

    // 1. 修改 asset_type 枚举，添加"车辆"和"土地建筑"
    console.log('修改 asset_type 枚举...');
    await connection.execute(`
      ALTER TABLE assets 
      MODIFY COLUMN asset_type ENUM('医疗设备', '普通设备', '房产建筑', '办公家具', '车辆', '土地建筑', '其他') 
      NOT NULL COMMENT '资产类型'
    `);
    console.log('✅ asset_type 枚举已更新');

    // 2. 添加车辆相关字段
    console.log('添加车辆相关字段...');

    // 检查字段是否已存在
    const [vehicleFields] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'assets' 
      AND COLUMN_NAME IN ('license_plate', 'vehicle_type', 'engine_number', 'vin_number')
    `);

    const existingVehicleFields = vehicleFields.map(f => f.COLUMN_NAME);

    if (!existingVehicleFields.includes('license_plate')) {
      await connection.execute(`
        ALTER TABLE assets 
        ADD COLUMN license_plate VARCHAR(50) COMMENT '车牌号码' AFTER model
      `);
      console.log('✅ 已添加 license_plate 字段');
    } else {
      console.log('⚠️  license_plate 字段已存在，跳过');
    }

    if (!existingVehicleFields.includes('vehicle_type')) {
      await connection.execute(`
        ALTER TABLE assets 
        ADD COLUMN vehicle_type VARCHAR(50) COMMENT '车辆类型（如：轿车、SUV、货车等）' AFTER license_plate
      `);
      console.log('✅ 已添加 vehicle_type 字段');
    } else {
      console.log('⚠️  vehicle_type 字段已存在，跳过');
    }

    if (!existingVehicleFields.includes('engine_number')) {
      await connection.execute(`
        ALTER TABLE assets 
        ADD COLUMN engine_number VARCHAR(100) COMMENT '发动机号' AFTER vehicle_type
      `);
      console.log('✅ 已添加 engine_number 字段');
    } else {
      console.log('⚠️  engine_number 字段已存在，跳过');
    }

    if (!existingVehicleFields.includes('vin_number')) {
      await connection.execute(`
        ALTER TABLE assets 
        ADD COLUMN vin_number VARCHAR(100) COMMENT '车架号（VIN码）' AFTER engine_number
      `);
      console.log('✅ 已添加 vin_number 字段');
    } else {
      console.log('⚠️  vin_number 字段已存在，跳过');
    }

    // 3. 添加土地建筑相关字段
    console.log('添加土地建筑相关字段...');

    const [landFields] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'assets' 
      AND COLUMN_NAME IN ('property_certificate', 'property_address', 'land_area', 'building_area', 'land_use_right', 'building_structure')
    `);

    const existingLandFields = landFields.map(f => f.COLUMN_NAME);

    if (!existingLandFields.includes('property_certificate')) {
      await connection.execute(`
        ALTER TABLE assets 
        ADD COLUMN property_certificate VARCHAR(100) COMMENT '产权证号' AFTER model
      `);
      console.log('✅ 已添加 property_certificate 字段');
    } else {
      console.log('⚠️  property_certificate 字段已存在，跳过');
    }

    if (!existingLandFields.includes('property_address')) {
      await connection.execute(`
        ALTER TABLE assets 
        ADD COLUMN property_address VARCHAR(500) COMMENT '坐落地址' AFTER property_certificate
      `);
      console.log('✅ 已添加 property_address 字段');
    } else {
      console.log('⚠️  property_address 字段已存在，跳过');
    }

    if (!existingLandFields.includes('land_area')) {
      await connection.execute(`
        ALTER TABLE assets 
        ADD COLUMN land_area DECIMAL(15, 2) COMMENT '土地面积（平方米）' AFTER property_address
      `);
      console.log('✅ 已添加 land_area 字段');
    } else {
      console.log('⚠️  land_area 字段已存在，跳过');
    }

    if (!existingLandFields.includes('building_area')) {
      await connection.execute(`
        ALTER TABLE assets 
        ADD COLUMN building_area DECIMAL(15, 2) COMMENT '建筑面积（平方米）' AFTER land_area
      `);
      console.log('✅ 已添加 building_area 字段');
    } else {
      console.log('⚠️  building_area 字段已存在，跳过');
    }

    if (!existingLandFields.includes('land_use_right')) {
      await connection.execute(`
        ALTER TABLE assets 
        ADD COLUMN land_use_right VARCHAR(100) COMMENT '土地使用权类型' AFTER building_area
      `);
      console.log('✅ 已添加 land_use_right 字段');
    } else {
      console.log('⚠️  land_use_right 字段已存在，跳过');
    }

    if (!existingLandFields.includes('building_structure')) {
      await connection.execute(`
        ALTER TABLE assets 
        ADD COLUMN building_structure VARCHAR(100) COMMENT '建筑结构（如：框架结构、砖混结构等）' AFTER land_use_right
      `);
      console.log('✅ 已添加 building_structure 字段');
    } else {
      console.log('⚠️  building_structure 字段已存在，跳过');
    }

    console.log('✅ 所有字段添加完成！');
  } catch (error) {
    console.error('❌ 添加字段失败:', error);
    throw error;
  } finally {
    if (connection) {
      connection.release();
      console.log('✅ 数据库连接已释放');
    }
  }
}

addAssetCategoryFields()
  .then(() => {
    console.log('✅ 脚本执行成功！');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ 脚本执行失败:', err);
    process.exit(1);
  });
