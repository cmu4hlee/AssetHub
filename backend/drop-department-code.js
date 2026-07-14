const db = require('./config/database');

async function dropDepartmentCodeColumn() {
  try {
    console.log('正在连接数据库...');

    // 1. 首先修改auth.js中间件，移除department_code相关代码
    const fs = require('fs');
    const path = require('path');

    // 读取auth.js文件
    const authFilePath = path.join(__dirname, 'middleware', 'auth.js');
    let authContent = fs.readFileSync(authFilePath, 'utf8');

    // 修改generateToken函数，移除department_code
    authContent = authContent.replace(
      '  // 使用用户在当前企业的角色，而不是从user表获取的角色\n  role: user.role,\n  departmentCode: user.department_code,\n  tenantId: user.tenant_id,',
      '  // 使用用户在当前企业的角色，而不是从user表获取的角色\n  role: user.role,\n  tenantId: user.tenant_id,',
    );

    // 修改authenticate中间件，移除department_code
    authContent = authContent.replace('      user.department_code = null;', '');
    authContent = authContent.replace(
      "      user = superUsers[0];\n      user.role = 'super_admin';\n      user.department_code = null;",
      "      user = superUsers[0];\n      user.role = 'super_admin';",
    );
    authContent = authContent.replace(
      "        'SELECT id, username, real_name, department_code, status FROM users WHERE id = ? AND status = ?',",
      '        SELECT id, username, real_name, status FROM users WHERE id = ? AND status = ?,',
    );
    authContent = authContent.replace(
      '      user = users[0];\n    }',
      '      user = users[0];\n      // 确保用户对象没有department_code字段\n      delete user.department_code;\n    }',
    );

    // 修改restrictToOwnDepartment中间件，移除department_code
    authContent = authContent.replace(
      '  // 首先需要认证\n  if (!req.user) {\n    return res.status(401).json({ success: false, message: \'需要先登录\' });\n  }',
      '  // 首先需要认证\n  if (!req.user) {\n    return res.status(401).json({ success: false, message: \'需要先登录\' });\n  }',
    );

    // 保存修改后的auth.js
    fs.writeFileSync(authFilePath, authContent);
    console.log('✅ 已修改auth.js，移除了department_code相关代码');

    // 2. 现在修改users.js路由，移除department_code
    const usersFilePath = path.join(__dirname, 'routes', 'users.js');
    let usersContent = fs.readFileSync(usersFilePath, 'utf8');

    // 移除users.js中所有department_code相关的SELECT语句
    usersContent = usersContent.replace(/department_code,/g, '');
    usersContent = usersContent.replace(/department_code/g, '');

    // 保存修改后的users.js
    fs.writeFileSync(usersFilePath, usersContent);
    console.log('✅ 已修改users.js，移除了department_code相关代码');

    // 3. 检查是否还有其他文件引用department_code
    const { exec } = require('child_process');
    exec('grep -r "department_code" --include="*.js" --include="*.jsx" ./', (error, stdout, stderr) => {
      if (error) {
        console.error(`grep执行错误: ${error.message}`);
        return;
      }
      if (stderr) {
        console.error(`grep错误: ${stderr}`);
        return;
      }
      if (stdout) {
        console.log('⚠️  仍然引用department_code的文件:');
        console.log(stdout);
      } else {
        console.log('✅ 所有文件已移除department_code引用');
      }
    });

    // 4. 执行SQL语句删除department_code字段
    try {
      const [result] = await db.execute('ALTER TABLE users DROP COLUMN department_code');
      console.log('✅ 成功删除users表中的department_code字段');

      // 5. 验证删除结果
      const [columns] = await db.execute('DESCRIBE users');
      console.log('\n✅ 删除后的users表结构:');
      columns.forEach(col => {
        console.log(`   ${col.Field} (${col.Type}) - ${col.Null}`);
      });

    } catch (sqlError) {
      if (sqlError.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
        console.log('✅ department_code字段可能已经不存在，跳过删除');

        // 验证表结构
        const [columns] = await db.execute('DESCRIBE users');
        console.log('\n✅ 当前users表结构:');
        columns.forEach(col => {
          console.log(`   ${col.Field} (${col.Type}) - ${col.Null}`);
        });
      } else {
        throw sqlError;
      }
    }

    console.log('\n🎉 所有操作完成！');
    process.exit(0);

  } catch (error) {
    console.error('❌ 执行错误:', error.message);
    process.exit(1);
  }
}

dropDepartmentCodeColumn();
