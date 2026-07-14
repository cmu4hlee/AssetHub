require('dotenv').config({ path: '../.env' });
const db = require('../config/database');

/**
 * 创建验收管理相关的数据库表
 */
async function createAcceptanceTables() {
  try {
    console.log('🔄 开始创建验收管理相关数据库表...');

    const connection = await db.getConnection();

    // 1. 创建资产验收记录表
    console.log('创建资产验收记录表 (asset_acceptance_records)...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS asset_acceptance_records (
        id INT PRIMARY KEY AUTO_INCREMENT,
        asset_id INT COMMENT '资产ID，外键关联资产主表',
        asset_code VARCHAR(200) NOT NULL COMMENT '资产编号',
        asset_name VARCHAR(200) NOT NULL COMMENT '资产名称',
        supplier VARCHAR(200) COMMENT '销售企业/供应商',
        acceptance_date DATE NOT NULL COMMENT '验收日期',
        acceptance_person VARCHAR(100) NOT NULL COMMENT '验收人',
        department VARCHAR(200) NOT NULL COMMENT '使用科室',
        functional_department VARCHAR(200) COMMENT '职能部门',
        status VARCHAR(50) DEFAULT '待验收' COMMENT '验收状态：待验收、验收中、已验收、验收不合格',
        remark TEXT COMMENT '备注',
        created_by VARCHAR(100) COMMENT '创建人',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
        INDEX idx_asset_code (asset_code),
        INDEX idx_status (status),
        INDEX idx_department (department),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资产验收记录表'
    `);
    console.log('✅ 资产验收记录表创建成功');

    // 2. 创建资产验收文件表
    console.log('创建资产验收文件表 (asset_acceptance_files)...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS asset_acceptance_files (
        id INT PRIMARY KEY AUTO_INCREMENT,
        acceptance_id INT NOT NULL COMMENT '验收记录ID，外键关联资产验收记录表',
        file_type VARCHAR(100) NOT NULL COMMENT '文件类型：安装图片、正常运行图片、安装报告单、采购合同、发票、其他资料',
        file_name VARCHAR(255) NOT NULL COMMENT '文件名',
        file_path VARCHAR(500) NOT NULL COMMENT '文件路径',
        file_size BIGINT COMMENT '文件大小，字节',
        mime_type VARCHAR(100) COMMENT 'MIME类型',
        uploaded_by VARCHAR(100) COMMENT '上传人',
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '上传时间',
        INDEX idx_acceptance_id (acceptance_id),
        INDEX idx_file_type (file_type),
        FOREIGN KEY (acceptance_id) REFERENCES asset_acceptance_records(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资产验收文件表'
    `);
    console.log('✅ 资产验收文件表创建成功');

    connection.release();

    console.log('🎉 验收管理相关数据库表创建完成');
    return true;
  } catch (error) {
    console.error('创建验收管理相关数据库表失败:', error);
    console.error('创建验收管理相关数据库表失败:', error.message);
    return false;
  }
}

/**
 * 检查验收管理相关的数据库表是否存在
 */
async function checkAcceptanceTables() {
  try {
    console.log('🔄 开始检查验收管理相关数据库表...');

    const connection = await db.getConnection();

    // 检查资产验收记录表是否存在
    const [recordTableResult] = await connection.execute(
      "SHOW TABLES LIKE 'asset_acceptance_records'",
    );

    // 检查资产验收文件表是否存在
    const [fileTableResult] = await connection.execute("SHOW TABLES LIKE 'asset_acceptance_files'");

    connection.release();

    const recordTableExists = recordTableResult.length > 0;
    const fileTableExists = fileTableResult.length > 0;

    console.log('📊 验收管理相关数据库表检查结果:');
    console.log(`   asset_acceptance_records: ${recordTableExists ? '✅ 存在' : '❌ 不存在'}`);
    console.log(`   asset_acceptance_files: ${fileTableExists ? '✅ 存在' : '❌ 不存在'}`);

    return {
      recordTableExists,
      fileTableExists,
      allExists: recordTableExists && fileTableExists,
    };
  } catch (error) {
    console.error('检查验收管理相关数据库表失败:', error);
    console.error('检查验收管理相关数据库表失败:', error.message);
    return {
      recordTableExists: false,
      fileTableExists: false,
      allExists: false,
    };
  }
}

/**
 * 主函数
 */
async function main() {
  try {
    // 先检查表是否存在
    const checkResult = await checkAcceptanceTables();

    if (!checkResult.allExists) {
      console.log('表不存在，开始创建...');
      const createResult = await createAcceptanceTables();

      if (createResult) {
        console.log('✅ 验收管理相关数据库表初始化成功');
      } else {
        console.error('❌ 验收管理相关数据库表初始化失败');
        process.exit(1);
      }
    } else {
      console.log('✅ 验收管理相关数据库表已存在，跳过创建');
    }

    console.log('🎉 验收管理相关数据库表操作完成');
    process.exit(0);
  } catch (error) {
    console.error('验收管理相关数据库表初始化失败:', error);
    console.error('验收管理相关数据库表初始化失败:', error.message);
    process.exit(1);
  }
}

// 执行主函数
if (require.main === module) {
  main();
}

module.exports = {
  createAcceptanceTables,
  checkAcceptanceTables,
};
