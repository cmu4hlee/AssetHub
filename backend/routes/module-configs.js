const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, requireSystemAdmin } = require('../middleware/auth');
const { getModuleMenuDefinitions } = require('../services/module-menu.service');

const getTenantId = req => {
  const tenantId =
    req.user?.tenant_id ||
    req.body?.tenant_id ||
    req.query?.tenant_id ||
    req.headers['x-tenant-id'];
  return tenantId ? parseInt(tenantId) : null;
};

const parseJSONField = field => {
  if (!field) return null;
  try {
    return typeof field === 'string' ? JSON.parse(field) : field;
  } catch (e) {
    console.error('解析JSON字段失败:', e);
    return null;
  }
};

const stringifyJSONField = data => {
  if (!data) return null;
  return typeof data === 'string' ? data : JSON.stringify(data);
};

const createHttpError = (status, message) => {
  const error = new Error(message);
  error.httpStatus = status;
  return error;
};

const syncTenantModuleConfigState = async (executor, { tenantId, moduleId, config, version }) => {
  const serializedConfig = stringifyJSONField(config);
  const [updateResult] = await executor.execute(
    `UPDATE tenant_module_configs SET
      config = ?, version = ?, updated_at = CURRENT_TIMESTAMP
    WHERE tenant_id = ? AND module_id = ?`,
    [serializedConfig, version, tenantId, moduleId],
  );

  if (updateResult && updateResult.affectedRows > 0) {
    return { action: 'updated' };
  }

  await executor.execute(
    `INSERT INTO tenant_module_configs (tenant_id, module_id, enabled, config, version, updated_at)
     VALUES (?, ?, 0, ?, ?, CURRENT_TIMESTAMP)`,
    [tenantId, moduleId, serializedConfig, version],
  );

  return { action: 'inserted' };
};

// 仅允许系统管理员和超级管理员操作模块配置
router.use(authenticate, requireSystemAdmin);

router.post('/enable', authenticate, async (req, res) => {
  try {
    const { module_id, config } = req.body;
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: '租户ID不能为空',
      });
    }

    if (!module_id) {
      return res.status(400).json({
        success: false,
        message: '模块ID为必填项',
      });
    }

    const [modules] = await db.execute('SELECT * FROM system_modules WHERE id = ?', [module_id]);

    if (modules.length === 0) {
      return res.status(404).json({
        success: false,
        message: '模块不存在',
      });
    }

    const module = modules[0];

    const [dependencies] = await db.execute(
      `SELECT md.*, sm.name as module_name, sm.version as module_version
       FROM module_dependencies md
       JOIN system_modules sm ON md.dependency_module_id = sm.id
       WHERE md.module_id = ? AND md.dependency_type = 'required'`,
      [module_id],
    );

    for (const dep of dependencies) {
      const [tenantConfigs] = await db.execute(
        'SELECT * FROM tenant_module_configs WHERE tenant_id = ? AND module_id = ? AND enabled = 1',
        [tenantId, dep.dependency_module_id],
      );

      if (tenantConfigs.length === 0) {
        return res.status(400).json({
          success: false,
          message: `模块依赖的模块 ${dep.module_name} 未启用`,
          dependency: dep,
        });
      }
    }

    const [configs] = await db.execute(
      'SELECT * FROM tenant_module_configs WHERE tenant_id = ? AND module_id = ?',
      [tenantId, module_id],
    );

    const finalConfig =
      config || (module.default_config ? parseJSONField(module.default_config) : {});

    if (configs.length > 0) {
      await db.execute(
        `UPDATE tenant_module_configs SET
          enabled = 1, config = ?, version = ?, enabled_at = CURRENT_TIMESTAMP, disabled_at = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE tenant_id = ? AND module_id = ?`,
        [stringifyJSONField(finalConfig), module.version, tenantId, module_id],
      );
    } else {
      await db.execute(
        `INSERT INTO tenant_module_configs (tenant_id, module_id, enabled, config, version, enabled_at, updated_at)
         VALUES (?, ?, 1, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [tenantId, module_id, stringifyJSONField(finalConfig), module.version],
      );
    }

    // 同步模块菜单权限：创建缺失的菜单并启用已存在的菜单
    try {
      const menuDefinitions = await getModuleMenuDefinitions(module_id);
      if (menuDefinitions.length > 0) {
        const connection = await db.getConnection();
        try {
          await connection.beginTransaction();
          for (const menu of menuDefinitions) {
            await connection.execute(
              `INSERT INTO tenant_module_menus (tenant_id, module_id, menu_key, is_enabled, updated_at)
               VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)
               ON DUPLICATE KEY UPDATE is_enabled = 1, updated_at = CURRENT_TIMESTAMP`,
              [tenantId, module_id, menu.menu_key],
            );
          }
          await connection.commit();
        } catch (menuError) {
          await connection.rollback();
          console.warn('同步模块菜单权限失败:', menuError.message);
        } finally {
          connection.release();
        }
      }
    } catch (menuSeedError) {
      console.warn('获取模块菜单定义失败:', menuSeedError.message);
    }

    await db.execute(
      `INSERT INTO module_operation_logs (module_id, tenant_id, operation, operator, operation_data, result)
         VALUES (?, ?, 'enable', ?, ?, 'success')`,
      [module_id, tenantId, req.user.username, stringifyJSONField({ config: finalConfig })],
    );

    res.json({
      success: true,
      message: '模块启用成功',
    });
  } catch (error) {
    console.error('启用模块失败:', error);
    res.status(500).json({
      success: false,
      message: '启用模块失败',
      error: error.message,
    });
  }
});

router.post('/disable', authenticate, async (req, res) => {
  try {
    const { module_id } = req.body;
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: '租户ID不能为空',
      });
    }

    if (!module_id) {
      return res.status(400).json({
        success: false,
        message: '模块ID为必填项',
      });
    }

    const [configs] = await db.execute(
      'SELECT * FROM tenant_module_configs WHERE tenant_id = ? AND module_id = ?',
      [tenantId, module_id],
    );

    if (configs.length > 0) {
      // 依赖级联校验：检查是否有其他已启用模块依赖此模块
      const [dependentModules] = await db.execute(
        `SELECT md.module_id, sm.name
         FROM module_dependencies md
         LEFT JOIN system_modules sm ON sm.id = md.module_id
         WHERE md.dependency_id = ? AND md.dependency_type = 'required'`,
        [module_id],
      );

      if (dependentModules.length > 0) {
        // 查询这些依赖方模块是否当前已启用
        const depModuleIds = dependentModules.map(d => d.module_id);
        const placeholders = depModuleIds.map(() => '?').join(',');
        const [enabledDeps] = await db.execute(
          `SELECT module_id FROM tenant_module_configs
           WHERE tenant_id = ? AND module_id IN (${placeholders}) AND enabled = 1`,
          [tenantId, ...depModuleIds],
        );

        if (enabledDeps.length > 0) {
          const enabledNames = enabledDeps
            .map(ed => dependentModules.find(dm => dm.module_id === ed.module_id)?.name || ed.module_id)
            .join(', ');
          return res.status(400).json({
            success: false,
            message: `此模块被以下已启用模块依赖，无法禁用：${enabledNames}。请先禁用依赖方模块。`,
          });
        }
      }

      // 如果配置存在，更新为禁用状态
      await db.execute(
        `UPDATE tenant_module_configs SET
          enabled = 0, disabled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE tenant_id = ? AND module_id = ?`,
        [tenantId, module_id],
      );

      // 同时禁用该模块的所有菜单
      try {
        await db.execute(
          `UPDATE tenant_module_menus SET is_enabled = 0, updated_at = CURRENT_TIMESTAMP
           WHERE tenant_id = ? AND module_id = ?`,
          [tenantId, module_id],
        );
      } catch (menuError) {
        console.warn('禁用模块菜单失败:', menuError.message);
      }

      await db.execute(
        `INSERT INTO module_operation_logs (module_id, tenant_id, operation, operator, operation_data, result)
           VALUES (?, ?, 'disable', ?, ?, 'success')`,
        [module_id, tenantId, req.user.username, stringifyJSONField({})],
      );

      res.json({
        success: true,
        message: '模块禁用成功',
      });
    } else {
      // 如果配置不存在，检查模块是否存在
      const [modules] = await db.execute('SELECT * FROM system_modules WHERE id = ?', [module_id]);

      if (modules.length === 0) {
        return res.status(404).json({
          success: false,
          message: '模块不存在',
        });
      }

      // 如果模块存在但配置不存在，视为已禁用状态
      res.json({
        success: true,
        message: '模块禁用成功',
      });
    }
  } catch (error) {
    console.error('禁用模块失败:', error);
    res.status(500).json({
      success: false,
      message: '禁用模块失败',
      error: error.message,
    });
  }
});

router.get('/list', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: '租户ID不能为空',
      });
    }

    const { category, type, status } = req.query;
    const filters = [];
    const params = [tenantId];

    if (category) {
      filters.push('sm.category = ?');
      params.push(category);
    }
    if (type) {
      filters.push('sm.type = ?');
      params.push(type);
    }
    if (status) {
      filters.push('sm.status = ?');
      params.push(status);
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

    const result = await db.execute(
      `SELECT sm.*,
              tmc.id AS tenant_config_id,
              tmc.tenant_id,
              tmc.module_id AS config_module_id,
              tmc.enabled,
              tmc.config AS tenant_config,
              tmc.version AS config_version,
              tmc.enabled_at,
              tmc.disabled_at,
              tmc.created_at AS config_created_at,
              tmc.updated_at AS config_updated_at
       FROM system_modules sm
       LEFT JOIN tenant_module_configs tmc
         ON tmc.module_id = sm.id AND tmc.tenant_id = ?
       ${whereClause}
       ORDER BY sm.category, sm.name`,
      params,
    );

    const rawRows = Array.isArray(result)
      ? result[0]
      : result?.rows || result?.data || result;
    const rows = Array.isArray(rawRows)
      ? rawRows
      : rawRows && typeof rawRows === 'object' && !('affectedRows' in rawRows)
        ? [rawRows]
        : [];

    const formattedConfigs = rows.map(row => {
      const defaultConfig = parseJSONField(row.default_config) || {};
      const tenantConfig = parseJSONField(row.tenant_config);
      return {
        id: row.id,
        module_id: row.id,
        tenant_id: row.tenant_id || tenantId,
        enabled: row.enabled ? 1 : 0,
        config: tenantConfig !== null && tenantConfig !== undefined ? tenantConfig : defaultConfig,
        config_version: row.config_version || null,
        enabled_at: row.enabled_at || null,
        disabled_at: row.disabled_at || null,
        created_at: row.config_created_at || null,
        updated_at: row.config_updated_at || null,
        tenant_config_id: row.tenant_config_id || null,
        name: row.name,
        description: row.description,
        category: row.category,
        type: row.type,
        version: row.version,
        status: row.status,
        author: row.author,
        dependencies: parseJSONField(row.dependencies),
        compatibility: parseJSONField(row.compatibility),
        frontend_config: parseJSONField(row.frontend_config),
        backend_config: parseJSONField(row.backend_config),
        config_schema: parseJSONField(row.config_schema),
        default_config: defaultConfig,
        interfaces: parseJSONField(row.interfaces),
        module_info: {
          name: row.name,
          description: row.description,
          category: row.category,
          type: row.type,
          version: row.version,
          author: row.author,
        },
      };
    });

    res.json({
      success: true,
      data: formattedConfigs,
      message: '获取租户模块配置成功',
    });
  } catch (error) {
    console.error('获取租户模块配置失败:', error);
    res.status(500).json({
      success: false,
      message: '获取租户模块配置失败',
      error: error.message,
    });
  }
});

router.get('/:moduleId', authenticate, async (req, res) => {
  try {
    const { moduleId } = req.params;
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: '租户ID不能为空',
      });
    }

    // 首先尝试获取模块配置
    const [configs] = await db.execute(
      `SELECT tmc.*, sm.name, sm.description, sm.category, sm.type, sm.version, sm.author,
              sm.config_schema, sm.default_config
       FROM tenant_module_configs tmc
       LEFT JOIN system_modules sm ON tmc.module_id = sm.id
       WHERE tmc.tenant_id = ? AND tmc.module_id = ?`,
      [tenantId, moduleId],
    );

    if (configs.length > 0) {
      // 如果配置存在，返回配置
      const config = configs[0];
      const formattedConfig = {
        ...config,
        config: parseJSONField(config.config),
        module_info: {
          name: config.name,
          description: config.description,
          category: config.category,
          type: config.type,
          version: config.version,
          author: config.author,
          config_schema: parseJSONField(config.config_schema),
          default_config: parseJSONField(config.default_config),
        },
      };

      res.json({
        success: true,
        data: formattedConfig,
        message: '获取模块配置成功',
      });
    } else {
      // 如果配置不存在，尝试获取模块信息并返回默认配置
      const [modules] = await db.execute('SELECT * FROM system_modules WHERE id = ?', [moduleId]);

      if (modules.length === 0) {
        return res.status(404).json({
          success: false,
          message: '模块不存在',
        });
      }

      const module = modules[0];
      const formattedConfig = {
        id: null,
        tenant_id: tenantId,
        module_id: moduleId,
        enabled: false,
        config: parseJSONField(module.default_config) || {},
        version: module.version,
        enabled_at: null,
        disabled_at: null,
        created_at: null,
        updated_at: null,
        module_info: {
          name: module.name,
          description: module.description,
          category: module.category,
          type: module.type,
          version: module.version,
          author: module.author,
          config_schema: parseJSONField(module.config_schema),
          default_config: parseJSONField(module.default_config),
        },
      };

      res.json({
        success: true,
        data: formattedConfig,
        message: '模块配置不存在，返回默认配置',
      });
    }
  } catch (error) {
    console.error('获取模块配置失败:', error);
    res.status(500).json({
      success: false,
      message: '获取模块配置失败',
      error: error.message,
    });
  }
});

router.put('/:moduleId', authenticate, async (req, res) => {
  try {
    const { moduleId } = req.params;
    const { config } = req.body;
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: '租户ID不能为空',
      });
    }

    const [configs] = await db.execute(
      'SELECT * FROM tenant_module_configs WHERE tenant_id = ? AND module_id = ?',
      [tenantId, moduleId],
    );

    if (configs.length === 0) {
      return res.status(404).json({
        success: false,
        message: '模块配置不存在',
      });
    }

    await db.execute(
      `UPDATE tenant_module_configs SET
        config = ?, updated_at = CURRENT_TIMESTAMP
      WHERE tenant_id = ? AND module_id = ?`,
      [stringifyJSONField(config), tenantId, moduleId],
    );

    await db.execute(
      `INSERT INTO module_operation_logs (module_id, tenant_id, operation, operator, operation_data, result)
         VALUES (?, ?, 'update_config', ?, ?, 'success')`,
      [moduleId, tenantId, req.user.username, stringifyJSONField({ config })],
    );

    res.json({
      success: true,
      message: '模块配置更新成功',
    });
  } catch (error) {
    console.error('更新模块配置失败:', error);
    res.status(500).json({
      success: false,
      message: '更新模块配置失败',
      error: error.message,
    });
  }
});

router.get('/:moduleId/validate', authenticate, async (req, res) => {
  try {
    const { moduleId } = req.params;
    const { config } = req.query;
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: '租户ID不能为空',
      });
    }

    const [modules] = await db.execute('SELECT * FROM system_modules WHERE id = ?', [moduleId]);

    if (modules.length === 0) {
      return res.status(404).json({
        success: false,
        message: '模块不存在',
      });
    }

    const module = modules[0];
    const configSchema = parseJSONField(module.config_schema);
    const configToValidate = config ? parseJSONField(config) : {};

    const errors = [];

    if (configSchema) {
      for (const schemaItem of configSchema) {
        const value = configToValidate[schemaItem.key];

        if (schemaItem.required && (value === undefined || value === null || value === '')) {
          errors.push(`${schemaItem.name} 为必填项`);
          continue;
        }

        if (value !== undefined && value !== null) {
          switch (schemaItem.type) {
            case 'string':
              if (typeof value !== 'string') {
                errors.push(`${schemaItem.name} 必须是字符串`);
              }
              break;
            case 'number':
              if (typeof value !== 'number' || isNaN(value)) {
                errors.push(`${schemaItem.name} 必须是数字`);
              }
              break;
            case 'boolean':
              if (typeof value !== 'boolean') {
                errors.push(`${schemaItem.name} 必须是布尔值`);
              }
              break;
            case 'select':
              if (!schemaItem.options || !schemaItem.options.find(opt => opt.value === value)) {
                errors.push(`${schemaItem.name} 的值无效`);
              }
              break;
            case 'multi_select':
              if (!Array.isArray(value)) {
                errors.push(`${schemaItem.name} 必须是数组`);
              }
              break;
            case 'json':
              try {
                JSON.parse(JSON.stringify(value));
              } catch (e) {
                errors.push(`${schemaItem.name} 必须是有效的JSON`);
              }
              break;
          }
        }

        if (schemaItem.validation) {
          const { min, max, pattern } = schemaItem.validation;

          if (min !== undefined && value < min) {
            errors.push(`${schemaItem.name} 不能小于 ${min}`);
          }

          if (max !== undefined && value > max) {
            errors.push(`${schemaItem.name} 不能大于 ${max}`);
          }

          if (pattern && !new RegExp(pattern).test(value)) {
            errors.push(`${schemaItem.name} 格式不正确`);
          }
        }
      }
    }

    res.json({
      success: errors.length === 0,
      data: {
        valid: errors.length === 0,
        errors,
      },
      message: errors.length === 0 ? '配置验证通过' : '配置验证失败',
    });
  } catch (error) {
    console.error('验证配置失败:', error);
    res.status(500).json({
      success: false,
      message: '验证配置失败',
      error: error.message,
    });
  }
});

router.get('/:moduleId/versions', authenticate, async (req, res) => {
  try {
    const { moduleId } = req.params;
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: '租户ID不能为空',
      });
    }

    const [versions] = await db.execute(
      `SELECT * FROM module_config_versions
       WHERE tenant_id = ? AND module_id = ?
       ORDER BY created_at DESC`,
      [tenantId, moduleId],
    );

    const formattedVersions = versions.map(version => ({
      ...version,
      config: parseJSONField(version.config),
    }));

    res.json({
      success: true,
      data: formattedVersions,
      message: '获取配置版本历史成功',
    });
  } catch (error) {
    console.error('获取配置版本历史失败:', error);
    res.status(500).json({
      success: false,
      message: '获取配置版本历史失败',
      error: error.message,
    });
  }
});

router.post('/:moduleId/versions', authenticate, async (req, res) => {
  try {
    const { moduleId } = req.params;
    const { config, change_log } = req.body;
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: '租户ID不能为空',
      });
    }

    if (!config) {
      return res.status(400).json({
        success: false,
        message: '配置内容为必填项',
      });
    }

    const [modules] = await db.execute('SELECT * FROM system_modules WHERE id = ?', [moduleId]);

    if (modules.length === 0) {
      return res.status(404).json({
        success: false,
        message: '模块不存在',
      });
    }

    const module = modules[0];
    const { version } = module;
    const result = await db.transaction(async connection => {
      await connection.execute(
        `UPDATE module_config_versions SET is_current = 0
         WHERE tenant_id = ? AND module_id = ?`,
        [tenantId, moduleId],
      );

      const [insertResult] = await connection.execute(
        `INSERT INTO module_config_versions (tenant_id, module_id, version, config, change_log, created_by, is_current)
           VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [tenantId, moduleId, version, stringifyJSONField(config), change_log || '', req.user.username],
      );

      await syncTenantModuleConfigState(connection, { tenantId, moduleId, config, version });

      await connection.execute(
        `INSERT INTO module_operation_logs (module_id, tenant_id, operation, operator, operation_data, result)
           VALUES (?, ?, 'create_version', ?, ?, 'success')`,
        [moduleId, tenantId, req.user.username, stringifyJSONField({ version, change_log })],
      );

      return insertResult;
    });

    res.json({
      success: true,
      message: '配置版本创建成功',
      data: {
        id: result.insertId,
        version,
      },
    });
  } catch (error) {
    console.error('创建配置版本失败:', error);
    res.status(500).json({
      success: false,
      message: '创建配置版本失败',
      error: error.message,
    });
  }
});

router.post('/:moduleId/rollback', authenticate, async (req, res) => {
  try {
    const { moduleId } = req.params;
    const { version_id } = req.body;
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: '租户ID不能为空',
      });
    }

    if (!version_id) {
      return res.status(400).json({
        success: false,
        message: '版本ID为必填项',
      });
    }

    const [versions] = await db.execute(
      `SELECT * FROM module_config_versions
       WHERE id = ? AND tenant_id = ? AND module_id = ?`,
      [version_id, tenantId, moduleId],
    );

    if (versions.length === 0) {
      return res.status(404).json({
        success: false,
        message: '版本不存在',
      });
    }

    const version = versions[0];
    await db.transaction(async connection => {
      await connection.execute(
        `UPDATE module_config_versions SET is_current = 0
         WHERE tenant_id = ? AND module_id = ?`,
        [tenantId, moduleId],
      );

      const [updateVersionResult] = await connection.execute(
        `UPDATE module_config_versions SET is_current = 1
         WHERE id = ? AND tenant_id = ? AND module_id = ?`,
        [version_id, tenantId, moduleId],
      );

      if (!updateVersionResult || updateVersionResult.affectedRows === 0) {
        throw createHttpError(404, '版本不存在');
      }

      await syncTenantModuleConfigState(connection, {
        tenantId,
        moduleId,
        config: version.config,
        version: version.version,
      });

      await connection.execute(
        `INSERT INTO module_operation_logs (module_id, tenant_id, operation, operator, operation_data, result)
           VALUES (?, ?, 'rollback', ?, ?, 'success')`,
        [
          moduleId,
          tenantId,
          req.user.username,
          stringifyJSONField({ version_id, version: version.version }),
        ],
      );
    });

    res.json({
      success: true,
      message: '配置版本回滚成功',
    });
  } catch (error) {
    if (error.httpStatus) {
      return res.status(error.httpStatus).json({
        success: false,
        message: error.message,
      });
    }
    console.error('回滚配置版本失败:', error);
    res.status(500).json({
      success: false,
      message: '回滚配置版本失败',
      error: error.message,
    });
  }
});

router.get('/:moduleId/versions/:versionId/compare', authenticate, async (req, res) => {
  try {
    const { moduleId, versionId } = req.params;
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: '租户ID不能为空',
      });
    }

    const [versions] = await db.execute(
      `SELECT * FROM module_config_versions
       WHERE id = ? AND tenant_id = ? AND module_id = ?`,
      [versionId, tenantId, moduleId],
    );

    if (versions.length === 0) {
      return res.status(404).json({
        success: false,
        message: '版本不存在',
      });
    }

    const version = versions[0];

    const [currentVersions] = await db.execute(
      `SELECT * FROM module_config_versions
       WHERE tenant_id = ? AND module_id = ? AND is_current = 1`,
      [tenantId, moduleId],
    );

    if (currentVersions.length === 0) {
      return res.status(404).json({
        success: false,
        message: '当前版本不存在',
      });
    }

    const currentVersion = currentVersions[0];

    const diff = {
      version_id: versionId,
      version: version.version,
      created_at: version.created_at,
      config: parseJSONField(version.config),
      current_version_id: currentVersion.id,
      current_version: currentVersion.version,
      current_created_at: currentVersion.created_at,
      current_config: parseJSONField(currentVersion.config),
    };

    const changes = [];
    const oldConfig = parseJSONField(currentVersion.config);
    const newConfig = parseJSONField(version.config);

    const allKeys = new Set([...Object.keys(oldConfig || {}), ...Object.keys(newConfig || {})]);
    allKeys.forEach(key => {
      if (JSON.stringify(oldConfig?.[key]) !== JSON.stringify(newConfig?.[key])) {
        changes.push({
          key,
          old_value: oldConfig?.[key],
          new_value: newConfig?.[key],
        });
      }
    });

    diff.changes = changes;

    res.json({
      success: true,
      data: diff,
      message: '配置版本对比成功',
    });
  } catch (error) {
    console.error('对比配置版本失败:', error);
    res.status(500).json({
      success: false,
      message: '对比配置版本失败',
      error: error.message,
    });
  }
});

router.delete('/:moduleId/versions/:versionId', authenticate, async (req, res) => {
  try {
    const { moduleId, versionId } = req.params;
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: '租户ID不能为空',
      });
    }

    const [versions] = await db.execute(
      `SELECT * FROM module_config_versions
       WHERE id = ? AND tenant_id = ? AND module_id = ? AND is_current = 0`,
      [versionId, tenantId, moduleId],
    );

    if (versions.length === 0) {
      return res.status(404).json({
        success: false,
        message: '版本不存在或不能删除当前版本',
      });
    }

    await db.transaction(async connection => {
      const [deleteResult] = await connection.execute(
        `DELETE FROM module_config_versions
         WHERE id = ? AND tenant_id = ? AND module_id = ? AND is_current = 0`,
        [versionId, tenantId, moduleId],
      );

      if (!deleteResult || deleteResult.affectedRows === 0) {
        throw createHttpError(404, '版本不存在或不能删除当前版本');
      }

      await connection.execute(
        `INSERT INTO module_operation_logs (module_id, tenant_id, operation, operator, operation_data, result)
           VALUES (?, ?, 'delete_version', ?, ?, 'success')`,
        [moduleId, tenantId, req.user.username, stringifyJSONField({ version_id: versionId })],
      );
    });

    res.json({
      success: true,
      message: '配置版本删除成功',
    });
  } catch (error) {
    if (error.httpStatus) {
      return res.status(error.httpStatus).json({
        success: false,
        message: error.message,
      });
    }
    console.error('删除配置版本失败:', error);
    res.status(500).json({
      success: false,
      message: '删除配置版本失败',
      error: error.message,
    });
  }
});

router.get('/:moduleId/backup', authenticate, async (req, res) => {
  try {
    const { moduleId } = req.params;
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: '租户ID不能为空',
      });
    }

    const [configs] = await db.execute(
      'SELECT * FROM tenant_module_configs WHERE tenant_id = ? AND module_id = ?',
      [tenantId, moduleId],
    );

    if (configs.length === 0) {
      return res.status(404).json({
        success: false,
        message: '模块配置不存在',
      });
    }

    const config = configs[0];

    const backupData = {
      tenant_id: tenantId,
      module_id: moduleId,
      config: parseJSONField(config.config),
      version: config.version,
      backed_up_at: new Date().toISOString(),
    };

    res.json({
      success: true,
      data: backupData,
      message: '模块配置备份成功',
    });
  } catch (error) {
    console.error('备份模块配置失败:', error);
    res.status(500).json({
      success: false,
      message: '备份模块配置失败',
      error: error.message,
    });
  }
});

router.post('/:moduleId/restore', authenticate, async (req, res) => {
  try {
    const { moduleId } = req.params;
    const { backup_data } = req.body;
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: '租户ID不能为空',
      });
    }

    if (!backup_data) {
      return res.status(400).json({
        success: false,
        message: '备份数据为必填项',
      });
    }

    await db.execute(
      `UPDATE tenant_module_configs SET
        config = ?, updated_at = CURRENT_TIMESTAMP
      WHERE tenant_id = ? AND module_id = ?`,
      [stringifyJSONField(backup_data.config), tenantId, moduleId],
    );

    await db.execute(
      `INSERT INTO module_operation_logs (module_id, tenant_id, operation, operator, operation_data, result)
         VALUES (?, ?, 'restore', ?, ?, 'success')`,
      [moduleId, tenantId, req.user.username, stringifyJSONField({ backup_data })],
    );

    res.json({
      success: true,
      message: '模块配置恢复成功',
    });
  } catch (error) {
    console.error('恢复模块配置失败:', error);
    res.status(500).json({
      success: false,
      message: '恢复模块配置失败',
      error: error.message,
    });
  }
});

// ============================================
// 模块-菜单关联相关路由
// ============================================

// 获取模块的菜单权限
router.get('/:moduleId/menus', authenticate, async (req, res) => {
  try {
    const { moduleId } = req.params;
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: '租户ID不能为空',
      });
    }

    const menuDefinitions = await getModuleMenuDefinitions(moduleId);
    const menuKeys = menuDefinitions.map(menu => menu.menu_key);
    const menuPermissions = new Map();

    if (menuKeys.length > 0) {
      const [rows] = await db.execute(
        `SELECT menu_key, is_enabled
         FROM tenant_module_menus
         WHERE tenant_id = ? AND module_id = ? AND menu_key IN (?)`,
        [tenantId, moduleId, menuKeys],
      );
      rows.forEach(row => {
        menuPermissions.set(row.menu_key, row.is_enabled);
      });
    }

    const menus = menuDefinitions.map(menu => ({
      ...menu,
      is_visible: menuPermissions.get(menu.menu_key) ? 1 : 0,
    }));

    res.json({
      success: true,
      data: menus,
      message: '获取模块菜单权限成功',
    });
  } catch (error) {
    console.error('获取模块菜单权限失败:', error);
    res.status(500).json({
      success: false,
      message: '获取模块菜单权限失败',
      error: error.message,
    });
  }
});

// 更新模块的菜单权限
router.put('/:moduleId/menus', authenticate, async (req, res) => {
  try {
    const { moduleId } = req.params;
    const { menus } = req.body;
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: '租户ID不能为空',
      });
    }

    if (!Array.isArray(menus)) {
      return res.status(400).json({
        success: false,
        message: '菜单列表必须是数组',
      });
    }

    const allowedMenus = await getModuleMenuDefinitions(moduleId);
    const allowedKeys = new Set(allowedMenus.map(menu => menu.menu_key));
    const filteredMenus = menus.filter(menu => allowedKeys.has(menu.menu_key));

    // 开始事务
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // 删除该模块的所有现有菜单权限
      await connection.execute(
        'DELETE FROM tenant_module_menus WHERE tenant_id = ? AND module_id = ?',
        [tenantId, moduleId],
      );

      // 插入新的菜单权限
      for (const menu of filteredMenus) {
        if (menu.menu_key) {
          await connection.execute(
            `INSERT INTO tenant_module_menus (tenant_id, module_id, menu_key, is_enabled, updated_at)
             VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [tenantId, moduleId, menu.menu_key, menu.is_visible ? 1 : 0],
          );
        }
      }

      await connection.commit();

      // 记录操作日志
      await db.execute(
        `INSERT INTO module_operation_logs (module_id, tenant_id, operation, operator, operation_data, result)
           VALUES (?, ?, 'update_menu_permissions', ?, ?, 'success')`,
        [
          moduleId,
          tenantId,
          req.user.username,
          stringifyJSONField({ menus_count: filteredMenus.length }),
        ],
      );

      res.json({
        success: true,
        message: '模块菜单权限更新成功',
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('更新模块菜单权限失败:', error);
    res.status(500).json({
      success: false,
      message: '更新模块菜单权限失败',
      error: error.message,
    });
  }
});

module.exports = router;
