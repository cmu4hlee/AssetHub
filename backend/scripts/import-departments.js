const fs = require('fs');
const path = require('path');
const db = require('../config/database');
const { readFirstWorksheetObjects } = require('../utils/excel-reader');

async function importDepartments() {
  try {
    // 读取Excel文件
    const excelPath = path.join(__dirname, '../config/DepartmentList.xlsx');
    if (!fs.existsSync(excelPath)) {
      console.error('DepartmentList.xlsx 文件不存在');
      return;
    }

    // 将Excel数据转换为JSON
    const departments = await readFirstWorksheetObjects(excelPath);
    console.log('读取到的科室数据:', departments.length, '条');
    console.log('数据结构示例:', departments[0]);

    // 创建科室表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS departments (
        id INT PRIMARY KEY AUTO_INCREMENT,
        tenant_id INT NOT NULL,
        department_code VARCHAR(50) NOT NULL,
        department_name VARCHAR(100) NOT NULL,
        parent_code VARCHAR(50),
        level INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT NULL,
        UNIQUE KEY uk_department_code (department_code, tenant_id),
        UNIQUE KEY uk_department_name (department_name, tenant_id),
        INDEX idx_tenant_id (tenant_id)
      )
    `);
    console.log('科室表创建成功');

    // 导入数据
    if (departments.length > 0) {
      // 先清空表
      await db.execute('TRUNCATE TABLE departments');

      const insertSQL = `
        INSERT INTO departments (tenant_id, department_code, department_name, parent_code, level)
        VALUES (?, ?, ?, ?, ?)
      `;

      let importedCount = 0;
      const importedNames = new Set();
      // 使用事务批量插入
      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();

        for (let i = 0; i < departments.length; i++) {
          const dept = departments[i];
          // 跳过标题行
          if (i === 0) continue;

          // 适应实际的Excel列名
          const level2 = dept['第四临床学院二三级学科构架（2025.10）'] || '';
          const level3 = dept['__EMPTY'] || '';

          // 只处理有效的数据行
          if (level2 || level3) {
            let department_code = '';
            let department_name = '';
            let parent_code = null;
            let level = 1;

            // 根据数据结构判断是二级还是三级学科
            if (level2 && !level3) {
              // 二级学科
              department_code = `DEP${i}`;
              department_name = level2;
              level = 2;
            } else if (level3) {
              // 三级学科
              department_code = `DEP${i}`;
              department_name = level3;
              parent_code = `DEP${i - 1}`; // 假设前一行是对应的二级学科
              level = 3;
            }

            if (department_name && department_name !== '无') {
              // 处理重复名称
              let uniqueName = department_name;
              let suffix = 1;
              while (importedNames.has(uniqueName)) {
                uniqueName = `${department_name}_${suffix}`;
                suffix++;
              }
              importedNames.add(uniqueName);

              const [result] = await connection.execute(insertSQL, [
                1, // 默认租户ID
                department_code,
                uniqueName,
                parent_code,
                level,
              ]);
              importedCount += result.affectedRows;
            }
          }
        }

        await connection.commit();
        console.log('科室数据导入成功，共导入:', importedCount, '条');
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }
  } catch (error) {
    console.error('导入科室数据失败:', error);
  }
}

// 执行导入
importDepartments();
