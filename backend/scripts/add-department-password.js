const db = require('../config/database');

async function addDepartmentPassword() {
  try {
    console.log('开始为科室添加密码字段...');

    // 1. 为departments表添加password字段
    await db.execute(`
      ALTER TABLE departments 
      ADD COLUMN password VARCHAR(4) NULL 
      AFTER department_name
    `);
    console.log('密码字段添加成功');

    // 2. 获取所有科室
    const [departments] = await db.execute(
      'SELECT id, department_code, department_name FROM departments',
    );
    console.log('获取到', departments.length, '个科室');

    // 3. 生成并更新密码
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const updateSQL = `
        UPDATE departments 
        SET password = ? 
        WHERE id = ?
      `;

      let updatedCount = 0;
      const departmentPasswords = [];

      for (const dept of departments) {
        // 生成4位随机数字密码
        const password = Math.floor(1000 + Math.random() * 9000).toString();

        const [result] = await connection.execute(updateSQL, [password, dept.id]);
        updatedCount += result.affectedRows;

        // 保存密码记录
        departmentPasswords.push({
          id: dept.id,
          department_code: dept.department_code,
          department_name: dept.department_name,
          password,
        });
      }

      await connection.commit();
      console.log('密码更新成功，共更新', updatedCount, '个科室');

      // 输出部分密码信息（前10个）
      console.log('\n部分科室密码信息：');
      departmentPasswords.slice(0, 10).forEach(dept => {
        console.log(`${dept.department_code} - ${dept.department_name}: ${dept.password}`);
      });

      // 保存所有密码到文件
      const fs = require('fs');
      const path = require('path');
      const passwordFilePath = path.join(__dirname, '../config/department-passwords.json');
      fs.writeFileSync(passwordFilePath, JSON.stringify(departmentPasswords, null, 2), 'utf8');
      console.log(`\n所有科室密码已保存到：${passwordFilePath}`);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    console.log('\n科室密码添加完成！');
  } catch (error) {
    console.error('添加科室密码失败:', error);
  }
}

// 执行脚本
addDepartmentPassword();
