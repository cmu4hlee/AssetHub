const fs = require('fs');
const path = require('path');
const db = require('../../config/database');

async function runMigration() {
  try {
    const sqlPath = path.join(__dirname, 'create_module_tables.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => {
        const lines = s.split('\n');
        const nonCommentLines = lines.filter(line => !line.trim().startsWith('--'));
        return nonCommentLines.join('').trim().length > 0;
      });

    console.log(`执行 ${statements.length} 条SQL语句...`);

    for (const statement of statements) {
      await db.execute(statement);
      const preview = statement.replace(/\s+/g, ' ').substring(0, 80);
      console.log('✅ 执行成功:', `${preview}...`);
    }

    console.log('✅ 所有表创建成功！');
  } catch (error) {
    console.error('❌ 执行失败:', error.message);
    console.error('错误详情:', error);
    process.exit(1);
  }
}

runMigration();
