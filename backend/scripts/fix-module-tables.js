const mysql = require('../config/database');

async function fixModuleTables() {
  try {
    console.log('开始修复模块相关表结构...');

    // 修复tenant_module_configs表的外键约束
    await mysql.execute(`
      ALTER TABLE tenant_module_configs
      DROP FOREIGN KEY IF EXISTS tenant_module_configs_ibfk_2;
    `);
    console.log('✅ 已删除tenant_module_configs表的旧外键约束');

    await mysql.execute(`
      ALTER TABLE tenant_module_configs
      ADD CONSTRAINT tenant_module_configs_ibfk_2 FOREIGN KEY (module_id) REFERENCES system_modules(id) ON DELETE CASCADE;
    `);
    console.log('✅ 已添加tenant_module_configs表的新外键约束');

    // 修复tenant_module_menus表的外键约束
    await mysql.execute(`
      ALTER TABLE tenant_module_menus
      DROP FOREIGN KEY IF EXISTS tenant_module_menus_ibfk_2;
    `);
    console.log('✅ 已删除tenant_module_menus表的旧外键约束');

    await mysql.execute(`
      ALTER TABLE tenant_module_menus
      ADD CONSTRAINT tenant_module_menus_ibfk_2 FOREIGN KEY (module_id) REFERENCES system_modules(id) ON DELETE CASCADE;
    `);
    console.log('✅ 已添加tenant_module_menus表的新外键约束');

    // 修复module_dependencies表的外键约束
    await mysql.execute(`
      ALTER TABLE module_dependencies
      DROP FOREIGN KEY IF EXISTS module_dependencies_ibfk_1;
    `);
    console.log('✅ 已删除module_dependencies表的旧外键约束1');

    await mysql.execute(`
      ALTER TABLE module_dependencies
      DROP FOREIGN KEY IF EXISTS module_dependencies_ibfk_2;
    `);
    console.log('✅ 已删除module_dependencies表的旧外键约束2');

    await mysql.execute(`
      ALTER TABLE module_dependencies
      ADD CONSTRAINT module_dependencies_ibfk_1 FOREIGN KEY (module_id) REFERENCES system_modules(id) ON DELETE CASCADE;
    `);
    console.log('✅ 已添加module_dependencies表的新外键约束1');

    await mysql.execute(`
      ALTER TABLE module_dependencies
      ADD CONSTRAINT module_dependencies_ibfk_2 FOREIGN KEY (dependency_id) REFERENCES system_modules(id) ON DELETE CASCADE;
    `);
    console.log('✅ 已添加module_dependencies表的新外键约束2');

    console.log('🎉 所有表结构修复完成');
  } catch (error) {
    console.error('❌ 修复表结构失败:', error);
  } finally {
    process.exit();
  }
}

fixModuleTables();
