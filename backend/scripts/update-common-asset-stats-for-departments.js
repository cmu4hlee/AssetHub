const db = require('../config/database');

async function updateTableStructure() {
  try {
    console.log('开始更新通用资产统计表结构...');

    // 1. 检查表是否存在
    const [tables] = await db.execute(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'common_asset_stats'`,
    );

    if (tables.length === 0) {
      console.log('表不存在，创建新表...');
      // 创建新表（带department_code）
      await db.execute(`
        CREATE TABLE common_asset_stats (
          id INT PRIMARY KEY AUTO_INCREMENT,
          department_code INT NOT NULL COMMENT '科室编码',
          asset_name VARCHAR(100) NOT NULL COMMENT '资产名称',
          count INT DEFAULT 0 COMMENT '数量',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
          updated_at TIMESTAMP NULL DEFAULT NULL COMMENT '更新时间',
          UNIQUE KEY uk_dept_asset (department_code, asset_name),
          FOREIGN KEY (department_code) REFERENCES departments(department_code) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='通用资产统计表（按科室）';
      `);
      console.log('新表创建成功');
    } else {
      console.log('表已存在，开始迁移...');

      // 2. 检查是否已有department_id字段
      const [columns] = await db.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'common_asset_stats'
         AND COLUMN_NAME = 'department_id'`,
      );

      if (columns.length === 0) {
        // 3. 备份现有数据（如果有）
        const [existingData] = await db.execute('SELECT asset_name, count FROM common_asset_stats');
        console.log(`找到 ${existingData.length} 条现有数据`);

        // 4. 删除旧表
        await db.execute('DROP TABLE IF EXISTS common_asset_stats');
        console.log('旧表已删除');

        // 5. 创建新表结构
        await db.execute(`
        CREATE TABLE common_asset_stats (
          id INT PRIMARY KEY AUTO_INCREMENT,
          department_code INT NOT NULL COMMENT '科室编码',
          asset_name VARCHAR(100) NOT NULL COMMENT '资产名称',
          count INT DEFAULT 0 COMMENT '数量',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
          updated_at TIMESTAMP NULL DEFAULT NULL COMMENT '更新时间',
          UNIQUE KEY uk_dept_asset (department_code, asset_name),
          FOREIGN KEY (department_code) REFERENCES departments(department_code) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='通用资产统计表（按科室）';
      `);
        console.log('新表结构创建成功');

        // 6. 为每个科室初始化通用资产数据
        const [departments] = await db.execute('SELECT department_code FROM departments');
        const commonAssets = [
          '病床',
          '床头桌',
          '计算机',
          '文件柜',
          '更衣柜',
          '办公桌',
          '办公椅',
          '空调',
          '壁挂式消毒机',
          '处置车',
          '口服药车',
          '器械柜',
          '休息床',
          '监护仪',
          '输液泵',
          '注射泵',
          '除颤监护仪',
          '心电图机',
          '打印机',
          '手持护理终端',
        ];

        console.log(`为 ${departments.length} 个科室初始化通用资产数据...`);
        let totalInserted = 0;

        for (const dept of departments) {
          for (const asset of commonAssets) {
            // 如果原有数据存在，使用原有数量；否则使用0
            const existing = existingData.find(d => d.asset_name === asset);
            const count = existing ? existing.count : 0;

            await db.execute(
              `INSERT INTO common_asset_stats (department_code, asset_name, count)
               VALUES (?, ?, ?)`,
              [dept.department_code, asset, count],
            );
            totalInserted++;
          }
        }

        console.log(`成功为所有科室初始化 ${totalInserted} 条通用资产数据`);
      } else {
        console.log('表结构已包含department_code字段，无需迁移');
      }
    }

    console.log('\n通用资产统计表结构更新完成！');
  } catch (error) {
    console.error('更新表结构失败:', error);
    throw error;
  } finally {
    process.exit(0);
  }
}

// 执行脚本
updateTableStructure();
