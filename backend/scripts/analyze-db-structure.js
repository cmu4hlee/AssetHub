const db = require('../config/database');

async function analyzeDatabaseStructure() {
  try {
    console.log('🔍 开始分析数据库结构...');

    // 获取所有表名（排除视图）
    console.log('\n1. 获取所有表名:');
    const [tables] = await db.execute(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = DATABASE()
       AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
    );

    console.log(`找到 ${tables.length} 个表:`);
    tables.forEach((table, index) => {
      console.log(`  ${index + 1}. ${table.table_name}`);
    });

    // 分析每个表的结构
    console.log('\n2. 分析表结构:');
    const tableStructures = [];

    for (const table of tables) {
      const tableName = table.table_name;
      console.log(`\n   ${tableName}:`);

      // 获取表结构
      const [columns] = await db.execute(
        `SELECT column_name, data_type, is_nullable, column_default, column_comment
         FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = ?
         ORDER BY ordinal_position`,
        [tableName],
      );

      console.log(`     字段数: ${columns.length}`);
      columns.forEach(column => {
        console.log(
          `     - ${column.column_name} (${column.data_type}, ${column.is_nullable === 'YES' ? '可空' : '非空'}${column.column_default ? `, 默认: ${column.column_default}` : ''})${column.column_comment ? ` - ${column.column_comment}` : ''}`,
        );
      });

      // 获取表的索引
      const [indexes] = await db.execute(`SHOW INDEX FROM ${tableName}`);

      if (indexes.length > 0) {
        console.log(`     索引数: ${indexes.length}`);
        const uniqueIndexes = new Set();
        indexes.forEach(index => {
          if (!uniqueIndexes.has(index.Key_name)) {
            uniqueIndexes.add(index.Key_name);
            console.log(`     - ${index.Key_name} (${index.Non_unique === 0 ? '唯一' : '普通'})`);
          }
        });
      }

      tableStructures.push({
        tableName,
        columns: columns.length,
        indexes: indexes.length,
      });
    }

    // 分析表之间的关系
    console.log('\n3. 分析表之间的关系:');
    const relationships = [];

    for (const table of tables) {
      const tableName = table.table_name;

      // 获取外键关系
      const [foreignKeys] = await db.execute(
        `SELECT COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
         FROM information_schema.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ?
         AND REFERENCED_TABLE_NAME IS NOT NULL`,
        [tableName],
      );

      if (foreignKeys.length > 0) {
        console.log(`\n   ${tableName} 的外键关系:`);
        foreignKeys.forEach(fk => {
          console.log(
            `     - ${fk.COLUMN_NAME} -> ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}`,
          );
          relationships.push({
            fromTable: tableName,
            fromColumn: fk.COLUMN_NAME,
            toTable: fk.REFERENCED_TABLE_NAME,
            toColumn: fk.REFERENCED_COLUMN_NAME,
          });
        });
      }
    }

    // 分析冗余情况
    console.log('\n4. 分析冗余情况:');

    // 检查重复表结构
    const tableNamePatterns = {};
    tables.forEach(table => {
      const tableName = table.table_name;
      // 提取表名模式
      const patterns = tableName.split('_');
      patterns.forEach(pattern => {
        if (pattern.length > 2) {
          tableNamePatterns[pattern] = (tableNamePatterns[pattern] || 0) + 1;
        }
      });
    });

    console.log('   表名模式分析:');
    Object.entries(tableNamePatterns)
      .filter(([_, count]) => count > 1)
      .forEach(([pattern, count]) => {
        console.log(`     - ${pattern}: ${count} 个表`);
      });

    // 检查租户ID字段一致性
    console.log('\n5. 检查租户ID字段一致性:');
    const tenantIdTables = [];
    for (const table of tables) {
      const tableName = table.table_name;
      const [columns] = await db.execute(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = ? AND column_name LIKE '%tenant%id%'`,
        [tableName],
      );
      if (columns.length > 0) {
        tenantIdTables.push(tableName);
        console.log(`   - ${tableName}: ${columns.map(c => c.column_name).join(', ')}`);
      }
    }

    console.log(`\n   共有 ${tenantIdTables.length} 个表包含租户ID字段`);

    // 生成分析报告
    console.log('\n6. 分析报告:');
    console.log(`   总表数: ${tables.length}`);

    const avgColumns =
      tableStructures.reduce((sum, table) => sum + table.columns, 0) / tables.length;
    console.log(`   平均字段数: ${avgColumns.toFixed(1)}`);

    const avgIndexes =
      tableStructures.reduce((sum, table) => sum + table.indexes, 0) / tables.length;
    console.log(`   平均索引数: ${avgIndexes.toFixed(1)}`);

    console.log(`   外键关系数: ${relationships.length}`);

    // 检查可能的冗余
    console.log('\n7. 可能的冗余分析:');

    // 检查重复字段
    const commonColumns = {};
    for (const table of tables) {
      const tableName = table.table_name;
      const [columns] = await db.execute(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = ?`,
        [tableName],
      );

      columns.forEach(column => {
        const colName = column.column_name;
        if (!commonColumns[colName]) {
          commonColumns[colName] = [];
        }
        commonColumns[colName].push(tableName);
      });
    }

    console.log('   常见字段（出现在多个表中）:');
    Object.entries(commonColumns)
      .filter(([_, tables]) => tables.length > 5)
      .forEach(([column, tables]) => {
        console.log(`     - ${column}: 出现在 ${tables.length} 个表中`);
      });

    // 检查表名相似的表
    console.log('\n8. 表名相似性分析:');
    const similarTables = [];
    for (let i = 0; i < tables.length; i++) {
      for (let j = i + 1; j < tables.length; j++) {
        const table1 = tables[i].table_name;
        const table2 = tables[j].table_name;

        // 检查表名相似度
        const commonPrefix = getCommonPrefix(table1, table2);
        if (commonPrefix.length > 5) {
          similarTables.push({ table1, table2, commonPrefix });
        }
      }
    }

    if (similarTables.length > 0) {
      console.log('   表名相似的表:');
      similarTables.forEach(item => {
        console.log(`     - ${item.table1} 与 ${item.table2} (共同前缀: ${item.commonPrefix})`);
      });
    }

    console.log('\n🎉 数据库结构分析完成!');
  } catch (error) {
    console.error('❌ 分析数据库结构失败:', error.message);
    console.error('错误堆栈:', error.stack);
  }
}

// 获取两个字符串的共同前缀
function getCommonPrefix(str1, str2) {
  let prefix = '';
  const minLength = Math.min(str1.length, str2.length);

  for (let i = 0; i < minLength; i++) {
    if (str1[i] === str2[i]) {
      prefix += str1[i];
    } else {
      break;
    }
  }

  return prefix;
}

// 运行分析
if (require.main === module) {
  analyzeDatabaseStructure()
    .then(() => {
      console.log('\n✅ 分析完成');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ 分析过程中发生错误:', error);
      process.exit(1);
    });
}

module.exports = analyzeDatabaseStructure;
