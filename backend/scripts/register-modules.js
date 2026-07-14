const db = require('../config/database');

async function registerModule(moduleConfig) {
  try {
    const [existing] = await db.execute('SELECT id FROM system_modules WHERE id = ?', [
      moduleConfig.id,
    ]);

    if (existing.length > 0) {
      console.log(`模块 ${moduleConfig.id} 已存在，正在更新...`);
      await db.execute(
        `UPDATE system_modules SET
          name = ?,
          version = ?,
          description = ?,
          category = ?,
          type = ?,
          status = ?,
          author = ?,
          dependencies = ?,
          compatibility = ?,
          frontend_config = ?,
          backend_config = ?,
          config_schema = ?,
          default_config = ?,
          interfaces = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
        [
          moduleConfig.name,
          moduleConfig.version,
          moduleConfig.description,
          moduleConfig.category,
          moduleConfig.type,
          moduleConfig.status,
          moduleConfig.author,
          JSON.stringify(moduleConfig.dependencies),
          JSON.stringify(moduleConfig.compatibility),
          JSON.stringify(moduleConfig.frontend_config),
          JSON.stringify(moduleConfig.backend_config),
          JSON.stringify(moduleConfig.config_schema),
          JSON.stringify(moduleConfig.default_config),
          JSON.stringify(moduleConfig.interfaces),
          moduleConfig.id,
        ],
      );
      console.log(`✅ 模块 ${moduleConfig.id} 更新成功`);
    } else {
      console.log(`正在注册模块 ${moduleConfig.id}...`);
      await db.execute(
        `INSERT INTO system_modules SET
          id = ?,
          name = ?,
          version = ?,
          description = ?,
          category = ?,
          type = ?,
          status = ?,
          author = ?,
          dependencies = ?,
          compatibility = ?,
          frontend_config = ?,
          backend_config = ?,
          config_schema = ?,
          default_config = ?,
          interfaces = ?,
          created_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP`,
        [
          moduleConfig.id,
          moduleConfig.name,
          moduleConfig.version,
          moduleConfig.description,
          moduleConfig.category,
          moduleConfig.type,
          moduleConfig.status,
          moduleConfig.author,
          JSON.stringify(moduleConfig.dependencies),
          JSON.stringify(moduleConfig.compatibility),
          JSON.stringify(moduleConfig.frontend_config),
          JSON.stringify(moduleConfig.backend_config),
          JSON.stringify(moduleConfig.config_schema),
          JSON.stringify(moduleConfig.default_config),
          JSON.stringify(moduleConfig.interfaces),
        ],
      );
      console.log(`✅ 模块 ${moduleConfig.id} 注册成功`);
    }
  } catch (error) {
    console.error(`❌ 注册模块 ${moduleConfig.id} 失败:`, error.message);
    throw error;
  }
}

async function registerModuleDependencies(moduleConfig) {
  try {
    if (moduleConfig.dependencies && moduleConfig.dependencies.length > 0) {
      console.log(`正在注册模块 ${moduleConfig.id} 的依赖关系...`);
      for (const dep of moduleConfig.dependencies) {
        // 检查依赖模块是否存在
        const [depExists] = await db.execute('SELECT id FROM system_modules WHERE id = ?', [
          dep.module_id,
        ]);
        if (depExists.length === 0) {
          console.warn(`  ⚠️  依赖模块 ${dep.module_id} 不存在，跳过依赖注册`);
          continue;
        }

        // 检查依赖关系是否已存在
        const [existingDep] = await db.execute(
          'SELECT id FROM module_dependencies WHERE module_id = ? AND dependency_module_id = ?',
          [moduleConfig.id, dep.module_id],
        );

        if (existingDep.length > 0) {
          console.log(`  ✅ 依赖 ${dep.module_id} 已存在，跳过注册`);
        } else {
          await db.execute(
            `INSERT INTO module_dependencies SET
              module_id = ?,
              dependency_module_id = ?,
              dependency_type = ?,
              min_version = ?,
              max_version = ?,
              created_at = CURRENT_TIMESTAMP`,
            [
              moduleConfig.id,
              dep.module_id,
              dep.dependency_type,
              dep.min_version || null,
              dep.max_version || null,
            ],
          );
          console.log(`  ✅ 依赖 ${dep.module_id} 注册成功`);
        }
      }
    }
  } catch (error) {
    console.error(`❌ 注册模块 ${moduleConfig.id} 的依赖关系失败:`, error.message);
    // 依赖注册失败不影响模块注册
  }
}

async function registerAllModules() {
  try {
    console.log('开始注册模块...\n');

    const modules = [
      require('../modules/user-management/config/module.config'),
      require('../modules/department-management/config/module.config'),
      require('../modules/asset-management/config/module.config'),
      require('../modules/maintenance-management/config/module.config'),
      require('../modules/depreciation-management/config/module.config'),
      require('../modules/quality-control/config/module.config'),
      require('../modules/adverse-event/config/module.config'),
      require('../modules/iot-management/config/module.config'),
      require('../modules/quality-common/config/module.config'),
    ];

    // 第一阶段：注册所有模块
    for (const moduleConfig of modules) {
      await registerModule(moduleConfig);
      console.log('');
    }

    // 第二阶段：注册所有模块的依赖关系
    console.log('开始注册模块依赖关系...\n');
    for (const moduleConfig of modules) {
      await registerModuleDependencies(moduleConfig);
      console.log('');
    }

    console.log('✅ 所有模块注册完成！');
  } catch (error) {
    console.error('❌ 模块注册失败:', error);
    process.exit(1);
  }
}

registerAllModules();
