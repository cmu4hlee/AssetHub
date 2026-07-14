const mysql = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { getModuleMenuDefinitions } = require('./module-menu.service');

class TenantModuleConfigService {
  constructor() {
    this.db = mysql;
    this.configLogTableReady = false;
  }

  async ensureConfigLogTable() {
    if (this.configLogTableReady) {
      return;
    }

    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS tenant_module_config_logs (
        id VARCHAR(64) PRIMARY KEY,
        tenant_id INT NOT NULL,
        tenant_name VARCHAR(255) NULL,
        module_id VARCHAR(50) NOT NULL,
        module_name VARCHAR(255) NULL,
        action VARCHAR(20) NOT NULL,
        old_value LONGTEXT NULL,
        new_value LONGTEXT NULL,
        operator_id VARCHAR(64) NULL,
        operator_name VARCHAR(100) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_tmcl_tenant_id (tenant_id),
        INDEX idx_tmcl_module_id (module_id),
        INDEX idx_tmcl_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='租户模块配置变更日志表'
    `);

    this.configLogTableReady = true;
  }

  /**
   * 获取企业空间列表
   * @param {Object} params - 查询参数
   * @param {string} params.search - 搜索关键词
   * @param {number} params.page - 页码
   * @param {number} params.pageSize - 每页数量
   * @returns {Promise<Object>} 企业空间列表
   */
  async getTenants({ search, page, pageSize }) {
    try {
      let query =
        'SELECT id, tenant_name as name, tenant_code as code, status FROM tenants WHERE 1=1';
      const params = [];

      if (search) {
        query += ' AND (tenant_name LIKE ? OR tenant_code LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
      }

      // 获取总数
      const countQuery = `SELECT COUNT(*) as total FROM (${query}) as total`;
      const [countResult] = await this.db.execute(countQuery, params);
      const { total } = countResult[0];

      // 分页
      const offset = (page - 1) * pageSize;
      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(pageSize, offset);

      const [records] = await this.db.execute(query, params);

      return {
        total,
        records,
      };
    } catch (error) {
      console.error('获取企业空间列表失败:', error);
      throw new Error('获取企业空间列表失败');
    }
  }

  /**
   * 获取指定企业空间的模块配置
   * @param {string} tenantId - 企业空间ID
   * @returns {Promise<Array>} 模块配置列表
   */
  async getTenantModules(tenantId) {
    try {
      // 首先获取所有可用模块
      const [allModules] = await this.db.execute(
        'SELECT id, name, version, category, type, description FROM system_modules WHERE status = ?',
        ['stable'],
      );

      // 获取企业空间的模块配置
      const [tenantConfigs] = await this.db.execute(
        'SELECT module_id, enabled, config FROM tenant_module_configs WHERE tenant_id = ?',
        [tenantId],
      );

      // 转换为Map便于查找
      const configMap = new Map();
      tenantConfigs.forEach(config => {
        configMap.set(config.module_id, {
          enabled: config.enabled,
          config: config.config ? JSON.parse(config.config) : {},
        });
      });

      // 合并结果
      const result = allModules.map(module => {
        const config = configMap.get(module.id) || { enabled: false, config: {} };
        return {
          module_id: module.id,
          module_name: module.name,
          version: module.version,
          category: module.category,
          type: module.type,
          enabled: config.enabled,
          config: config.config,
        };
      });

      return result;
    } catch (error) {
      console.error('获取企业空间模块配置失败:', error);
      throw new Error('获取企业空间模块配置失败');
    }
  }

  /**
   * 更新企业空间的模块配置
   * @param {string} tenantId - 企业空间ID
   * @param {Array} moduleConfigs - 模块配置列表
   * @param {string} userId - 操作人ID
   * @param {string} userName - 操作人名称
   * @returns {Promise<void>}
   */
  async updateTenantModules(tenantId, moduleConfigs, userId, userName) {
    try {
      // 使用事务处理
      await this.db.transaction(async connection => {
        // 获取企业空间名称
        const [tenantResult] = await connection.execute(
          'SELECT tenant_name as name FROM tenants WHERE id = ?',
          [tenantId],
        );
        const tenantName = tenantResult[0]?.name || '未知企业';

        for (const config of moduleConfigs) {
          const { module_id, enabled, config: moduleConfig } = config;

          // 获取模块信息
          const [moduleResult] = await connection.execute(
            'SELECT name FROM system_modules WHERE id = ?',
            [module_id],
          );
          const moduleName = moduleResult[0]?.name || '未知模块';

          // 检查是否已存在配置
          const [existingConfig] = await connection.execute(
            'SELECT id, enabled, config FROM tenant_module_configs WHERE tenant_id = ? AND module_id = ?',
            [tenantId, module_id],
          );

          if (existingConfig.length > 0) {
            // 更新现有配置
            const oldConfig = {
              enabled: existingConfig[0].enabled,
              config: existingConfig[0].config ? JSON.parse(existingConfig[0].config) : {},
            };
            const wasEnabled = oldConfig.enabled;

            await connection.execute(
              'UPDATE tenant_module_configs SET enabled = ?, config = ?, updated_at = NOW() WHERE tenant_id = ? AND module_id = ?',
              [enabled, JSON.stringify(moduleConfig), tenantId, module_id],
            );

            // 如果模块被启用，同步菜单到 tenant_module_menus
            if (enabled && !wasEnabled) {
              await this._syncModuleMenus(connection, tenantId, module_id);
            }

            // 记录变更日志
            await this._logConfigChange(
              tenantId,
              tenantName,
              module_id,
              moduleName,
              'update',
              oldConfig,
              { enabled, config: moduleConfig },
              userId,
              userName,
            );
          } else {
            // 创建新配置
            // 使用更短的 ID 格式，避免数据被截断
            const configId = `config_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
            await connection.execute(
              'INSERT INTO tenant_module_configs (tenant_id, module_id, enabled, config, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
              [tenantId, module_id, enabled, JSON.stringify(moduleConfig)],
            );

            // 如果模块被启用，同步菜单到 tenant_module_menus
            if (enabled) {
              await this._syncModuleMenus(connection, tenantId, module_id);
            }

            // 记录变更日志
            await this._logConfigChange(
              tenantId,
              tenantName,
              module_id,
              moduleName,
              'create',
              null,
              { enabled, config: moduleConfig },
              userId,
              userName,
            );
          }
        }
      });
    } catch (error) {
      console.error('更新企业空间模块配置失败:', error);
      throw new Error('更新企业空间模块配置失败');
    }
  }

  /**
   * 获取配置变更日志
   * @param {Object} params - 查询参数
   * @param {string} params.tenantId - 企业空间ID
   * @param {string} params.moduleId - 模块ID
   * @param {string} params.startDate - 开始日期
   * @param {string} params.endDate - 结束日期
   * @param {number} params.page - 页码
   * @param {number} params.pageSize - 每页数量
   * @returns {Promise<Object>} 变更日志列表
   */
  async getConfigLogs({ tenantId, moduleId, startDate, endDate, page, pageSize }) {
    try {
      await this.ensureConfigLogTable();

      let query = `
        SELECT
          l.id,
          l.tenant_id,
          t.tenant_name,
          l.module_id,
          m.name as module_name,
          l.action,
          l.old_value,
          l.new_value,
          l.operator_id,
          l.operator_name,
          l.created_at
        FROM tenant_module_config_logs l
        LEFT JOIN tenants t ON l.tenant_id = t.id
        LEFT JOIN system_modules m ON BINARY l.module_id = BINARY m.id
        WHERE 1=1
      `;
      const params = [];

      if (tenantId) {
        query += ' AND l.tenant_id = ?';
        params.push(tenantId);
      }

      if (moduleId) {
        query += ' AND l.module_id = ?';
        params.push(moduleId);
      }

      if (startDate) {
        query += ' AND l.created_at >= ?';
        params.push(startDate);
      }

      if (endDate) {
        query += ' AND l.created_at <= ?';
        params.push(endDate);
      }

      // 获取总数
      const countQuery = `SELECT COUNT(*) as total FROM (${query}) as total`;
      const [countResult] = await this.db.execute(countQuery, params);
      const { total } = countResult[0];

      // 分页
      const offset = (page - 1) * pageSize;
      query += ' ORDER BY l.created_at DESC LIMIT ? OFFSET ?';
      params.push(pageSize, offset);

      const [records] = await this.db.execute(query, params);

      // 格式化结果
      const formattedRecords = records.map(record => ({
        id: record.id,
        tenant_id: record.tenant_id,
        tenant_name: record.tenant_name,
        module_id: record.module_id,
        module_name: record.module_name,
        action: record.action,
        old_value: record.old_value ? JSON.parse(record.old_value) : null,
        new_value: record.new_value ? JSON.parse(record.new_value) : null,
        operator_id: record.operator_id,
        operator_name: record.operator_name,
        created_at: record.created_at,
      }));

      return {
        total,
        records: formattedRecords,
      };
    } catch (error) {
      console.error('获取配置变更日志失败:', error);
      throw new Error('获取配置变更日志失败');
    }
  }

  /**
   * 获取所有可用模块
   * @returns {Promise<Array>} 模块列表
   */
  async getAllModules() {
    try {
      const [modules] = await this.db.execute(
        'SELECT id, name, version, category, type, description FROM system_modules WHERE status = ? ORDER BY category, name',
        ['stable'],
      );

      return modules;
    } catch (error) {
      console.error('获取可用模块失败:', error);
      throw new Error('获取可用模块失败');
    }
  }

  /**
   * 获取指定模块的菜单列表
   * @param {string} moduleId - 模块ID
   * @returns {Promise<Array>} 菜单列表
   */
  async getModuleMenus(moduleId) {
    try {
      return await getModuleMenuDefinitions(moduleId);
    } catch (error) {
      console.error('获取模块菜单列表失败:', error);
      throw new Error('获取模块菜单列表失败');
    }
  }

  /**
   * 获取指定企业空间的模块菜单配置
   * @param {string} tenantId - 企业空间ID
   * @param {string} moduleId - 模块ID
   * @returns {Promise<Array>} 模块菜单配置列表
   */
  async getTenantModuleMenus(tenantId, moduleId) {
    try {
      const allMenus = await getModuleMenuDefinitions(moduleId);

      // 获取企业空间的模块菜单配置
      const [tenantMenuConfigs] = await this.db.execute(
        'SELECT menu_key, is_enabled FROM tenant_module_menus WHERE tenant_id = ? AND module_id = ?',
        [tenantId, moduleId],
      );
      const hasExplicitConfigs = tenantMenuConfigs.length > 0;

      // 转换为Map便于查找
      const menuConfigMap = new Map();
      tenantMenuConfigs.forEach(config => {
        menuConfigMap.set(config.menu_key, config.is_enabled);
      });

      // 合并结果
      const result = allMenus.map(menu => {
        const isEnabled = hasExplicitConfigs ? Boolean(menuConfigMap.get(menu.menu_key)) : true;
        return {
          menu_key: menu.menu_key,
          menu_label: menu.menu_label,
          parent_key: menu.parent_key,
          icon: menu.icon,
          order_index: menu.order_index,
          is_enabled: isEnabled,
        };
      });

      return result;
    } catch (error) {
      console.error('获取企业空间模块菜单配置失败:', error);
      throw new Error('获取企业空间模块菜单配置失败');
    }
  }

  /**
   * 更新企业空间的模块菜单配置
   * @param {string} tenantId - 企业空间ID
   * @param {string} moduleId - 模块ID
   * @param {Array} menuConfigs - 菜单配置列表
   * @param {string} userId - 操作人ID
   * @param {string} userName - 操作人名称
   * @returns {Promise<void>}
   */
  async updateTenantModuleMenus(tenantId, moduleId, menuConfigs, userId, userName) {
    try {
      const allowedMenus = await getModuleMenuDefinitions(moduleId);
      const allowedKeys = new Set(allowedMenus.map(menu => menu.menu_key));
      const filteredConfigs = Array.isArray(menuConfigs)
        ? menuConfigs.filter(menu => allowedKeys.has(menu.menu_key))
        : [];

      // 使用事务处理
      await this.db.transaction(async connection => {
        // 获取企业空间名称
        const [tenantResult] = await connection.execute(
          'SELECT tenant_name as name FROM tenants WHERE id = ?',
          [tenantId],
        );
        const tenantName = tenantResult[0]?.name || '未知企业';

        // 获取模块信息
        const [moduleResult] = await connection.execute(
          'SELECT name FROM system_modules WHERE id = ?',
          [moduleId],
        );
        const moduleName = moduleResult[0]?.name || '未知模块';

        for (const config of filteredConfigs) {
          const { menu_key, is_enabled } = config;

          // 获取菜单信息
          const [menuResult] = await connection.execute(
            'SELECT menu_label FROM menu_definitions WHERE menu_key = ?',
            [menu_key],
          );
          const menuLabel = menuResult[0]?.menu_label || '未知菜单';

          // 检查是否已存在配置
          const [existingConfig] = await connection.execute(
            'SELECT id, is_enabled FROM tenant_module_menus WHERE tenant_id = ? AND module_id = ? AND menu_key = ?',
            [tenantId, moduleId, menu_key],
          );

          if (existingConfig.length > 0) {
            // 更新现有配置
            const oldIsEnabled = existingConfig[0].is_enabled;

            await connection.execute(
              'UPDATE tenant_module_menus SET is_enabled = ?, updated_at = NOW() WHERE tenant_id = ? AND module_id = ? AND menu_key = ?',
              [is_enabled, tenantId, moduleId, menu_key],
            );

            // 记录变更日志
            await this._logConfigChange(
              tenantId,
              tenantName,
              moduleId,
              moduleName,
              'update_menu',
              { menu_key, is_enabled: oldIsEnabled },
              { menu_key, is_enabled },
              userId,
              userName,
            );
          } else {
            // 创建新配置
            const menuConfigId = `menu_config_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
            await connection.execute(
              'INSERT INTO tenant_module_menus (id, tenant_id, module_id, menu_key, is_enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
              [menuConfigId, tenantId, moduleId, menu_key, is_enabled],
            );

            // 记录变更日志
            await this._logConfigChange(
              tenantId,
              tenantName,
              moduleId,
              moduleName,
              'create_menu',
              null,
              { menu_key, is_enabled },
              userId,
              userName,
            );
          }
        }
      });
    } catch (error) {
      console.error('更新企业空间模块菜单配置失败:', error);
      throw new Error('更新企业空间模块菜单配置失败');
    }
  }

  /**
   * 同步模块菜单到租户模块菜单表
   * @private
   * @param {Object} connection - 数据库连接
   * @param {string} tenantId - 企业空间ID
   * @param {string} moduleId - 模块ID
   * @returns {Promise<void>}
   */
  async _syncModuleMenus(connection, tenantId, moduleId) {
    try {
      // 获取模块的菜单定义
      const menuDefinitions = await getModuleMenuDefinitions(moduleId);

      if (!menuDefinitions || menuDefinitions.length === 0) {
        console.log(`模块 ${moduleId} 无菜单定义，跳过同步`);
        return;
      }

      // 为每个菜单创建租户模块菜单记录
      for (const menu of menuDefinitions) {
        // 检查是否已存在
        const [existing] = await connection.execute(
          'SELECT id FROM tenant_module_menus WHERE tenant_id = ? AND module_id = ? AND menu_key = ?',
          [tenantId, moduleId, menu.menu_key],
        );

        if (existing.length === 0) {
          // 不存在则插入
          await connection.execute(
            `INSERT INTO tenant_module_menus (tenant_id, module_id, menu_key, is_enabled, created_at, updated_at)
             VALUES (?, ?, ?, 1, NOW(), NOW())`,
            [tenantId, moduleId, menu.menu_key],
          );
        } else {
          // 已存在则启用
          await connection.execute(
            'UPDATE tenant_module_menus SET is_enabled = 1, updated_at = NOW() WHERE tenant_id = ? AND module_id = ? AND menu_key = ?',
            [tenantId, moduleId, menu.menu_key],
          );
        }
      }

      console.log(`已同步模块 ${moduleId} 的 ${menuDefinitions.length} 个菜单到租户 ${tenantId}`);
    } catch (error) {
      console.error('同步模块菜单失败:', error);
      // 不抛出错误，避免阻塞主流程
    }
  }

  /**
   * 记录配置变更日志
   * @private
   * @param {string} tenantId - 企业空间ID
   * @param {string} tenantName - 企业空间名称
   * @param {string} moduleId - 模块ID
   * @param {string} moduleName - 模块名称
   * @param {string} action - 操作类型
   * @param {Object} oldValue - 旧值
   * @param {Object} newValue - 新值
   * @param {string} operatorId - 操作人ID
   * @param {string} operatorName - 操作人名称
   * @returns {Promise<void>}
   */
  async _logConfigChange(
    tenantId,
    tenantName,
    moduleId,
    moduleName,
    action,
    oldValue,
    newValue,
    operatorId,
    operatorName,
  ) {
    try {
      await this.ensureConfigLogTable();

      await this.db.execute(
        `INSERT INTO tenant_module_config_logs
         (id, tenant_id, tenant_name, module_id, module_name, action, old_value, new_value, operator_id, operator_name, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          uuidv4(),
          tenantId,
          tenantName,
          moduleId,
          moduleName,
          action,
          oldValue ? JSON.stringify(oldValue) : null,
          JSON.stringify(newValue),
          operatorId,
          operatorName,
        ],
      );
    } catch (error) {
      console.error('记录配置变更日志失败:', error);
      // 日志记录失败不应影响主操作
    }
  }

  /**
   * 获取模块依赖关系
   * @param {string} moduleId - 模块ID
   * @returns {Promise<Array>} 依赖关系列表
   */
  async getModuleDependencies(moduleId) {
    try {
      const [dependencies] = await this.db.execute(
        'SELECT dependency_module_id, dependency_type FROM module_dependencies WHERE module_id = ?',
        [moduleId],
      );

      return dependencies;
    } catch (error) {
      console.error('获取模块依赖关系失败:', error);
      throw new Error('获取模块依赖关系失败');
    }
  }

  /**
   * 检查模块依赖关系
   * @param {string} moduleId - 模块ID
   * @param {string} action - 操作类型 (enable/disable)
   * @returns {Promise<{valid: boolean, message: string}>} 检查结果
   */
  async checkModuleDependencies(moduleId, action) {
    try {
      if (action === 'disable') {
        // 检查是否有其他模块依赖此模块
        const [dependentModules] = await this.db.execute(
          'SELECT module_id FROM module_dependencies WHERE dependency_id = ? AND dependency_type = ?',
          [moduleId, 'required'],
        );

        if (dependentModules.length > 0) {
          const moduleIds = dependentModules.map(dep => dep.module_id).join(', ');
          return {
            valid: false,
            message: `此模块被其他模块依赖，无法禁用。依赖模块ID: ${moduleIds}`,
          };
        }
      } else if (action === 'enable') {
        // 检查此模块的必需依赖是否已启用
        const [requiredDependencies] = await this.db.execute(
          'SELECT dependency_module_id FROM module_dependencies WHERE module_id = ? AND dependency_type = ?',
          [moduleId, 'required'],
        );

        if (requiredDependencies.length > 0) {
          for (const dep of requiredDependencies) {
            const [dependencyStatus] = await this.db.execute(
              'SELECT status FROM system_modules WHERE id = ?',
              [dep.dependency_module_id],
            );

            if (dependencyStatus.length === 0 || dependencyStatus[0].status !== 'stable') {
              return {
                valid: false,
                message: `此模块的必需依赖模块未启用或不可用。依赖模块ID: ${dep.dependency_module_id}`,
              };
            }
          }
        }
      }

      return { valid: true, message: '' };
    } catch (error) {
      console.error('检查模块依赖关系失败:', error);
      throw new Error('检查模块依赖关系失败');
    }
  }
}

module.exports = TenantModuleConfigService;
