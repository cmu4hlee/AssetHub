#!/usr/bin/env node

// MySQL命令行工具替代方案
// 使用Node.js和mysql2库实现mysql命令的基本功能

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// 解析命令行参数
const args = process.argv.slice(2);

// 显示帮助信息
function showHelp() {
  console.log('MySQL命令行工具替代方案');
  console.log('');
  console.log('用法:');
  console.log('  node mysql-cli.js [options] [database]');
  console.log('  node mysql-cli.js < script.sql [options]');
  console.log('');
  console.log('选项:');
  console.log('  -h, --host <host>    数据库主机地址 (默认: localhost)');
  console.log('  -P, --port <port>    数据库端口 (默认: 3306)');
  console.log('  -u, --user <user>    数据库用户名 (默认: root)');
  console.log('  -p, --password <pwd> 数据库密码 (默认: 空)');
  console.log('  -e, --execute <sql>  执行SQL语句');
  console.log('  -V, --version        显示版本信息');
  console.log('  --help               显示帮助信息');
  console.log('');
  console.log('示例:');
  console.log('  node mysql-cli.js -u root -p password zcgl -e "SELECT * FROM users LIMIT 10"');
  console.log('  node mysql-cli.js zcgl < scripts/add-tenant-id.sql');
  console.log('');
}

// 显示版本信息
function showVersion() {
  console.log('mysql-cli 1.0.0');
}

// 解析命令行参数
function parseArgs() {
  const config = {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '',
    database: null,
    sql: null,
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    switch (arg) {
      case '-h':
      case '--host':
        config.host = args[++i];
        break;
      case '-P':
      case '--port':
        config.port = parseInt(args[++i]);
        break;
      case '-u':
      case '--user':
        config.user = args[++i];
        break;
      case '-p':
      case '--password':
        config.password = args[++i];
        break;
      case '-e':
      case '--execute':
        config.sql = args[++i];
        break;
      case '-V':
      case '--version':
        showVersion();
        process.exit(0);
        break;
      case '--help':
        showHelp();
        process.exit(0);
        break;
      default:
        // 如果参数不是选项，假定是数据库名
        if (!arg.startsWith('-')) {
          config.database = arg;
        } else {
          console.error(`未知选项: ${arg}`);
          showHelp();
          process.exit(1);
        }
        break;
    }
    i++;
  }

  return config;
}

// 执行SQL语句
async function executeSql(config, sql) {
  let connection;

  try {
    // 连接数据库
    connection = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      multipleStatements: true,
    });

    // 执行SQL语句
    const [results] = await connection.execute(sql);

    // 输出结果
    if (Array.isArray(results)) {
      // 是查询结果
      console.log('查询结果:');
      console.log(JSON.stringify(results, null, 2));
    } else {
      // 是执行结果
      console.log('执行结果:');
      console.log(`影响行数: ${results.affectedRows}`);
      if (results.insertId) {
        console.log(`插入ID: ${results.insertId}`);
      }
    }

    return true;
  } catch (error) {
    console.error('错误:', error.message);
    return false;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// 执行SQL脚本文件
async function executeSqlFile(config, filePath) {
  let connection;

  try {
    // 读取SQL文件
    const sqlContent = fs.readFileSync(filePath, 'utf8');

    // 连接数据库
    connection = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      multipleStatements: true,
    });

    // 执行SQL语句
    const [results] = await connection.execute(sqlContent);

    console.log('SQL脚本执行完成');
    console.log('执行结果:', results);

    return true;
  } catch (error) {
    console.error('错误:', error.message);
    return false;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// 从标准输入读取SQL脚本
async function executeSqlFromStdin(config) {
  let connection;

  try {
    // 从标准输入读取
    console.log('从标准输入读取SQL脚本...');
    const chunks = [];

    process.stdin.setEncoding('utf8');

    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }

    const sqlContent = chunks.join('');

    if (!sqlContent.trim()) {
      console.error('错误: 标准输入为空');
      return false;
    }

    // 连接数据库
    connection = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      multipleStatements: true,
    });

    // 执行SQL语句
    const [results] = await connection.execute(sqlContent);

    console.log('SQL脚本执行完成');
    console.log('执行结果:', results);

    return true;
  } catch (error) {
    console.error('错误:', error.message);
    return false;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// 主函数
async function main() {
  // 解析参数
  const config = parseArgs();

  // 检查是否有标准输入
  const hasStdin = !process.stdin.isTTY;

  if (config.sql) {
    // 执行命令行指定的SQL
    await executeSql(config, config.sql);
  } else if (hasStdin) {
    // 从标准输入读取SQL
    await executeSqlFromStdin(config);
  } else {
    // 没有SQL要执行，显示帮助
    showHelp();
    process.exit(1);
  }
}

// 执行主函数
main()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('致命错误:', error.message);
    process.exit(1);
  });
