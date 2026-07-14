/**
 * 模块配置服务
 * 管理模块的启用状态和配置
 */

const db = require('../config/database');
const logger = require('../config/logger');

class ModuleConfigService {
  /**
   * 获取租户模块配置
   */
  async getTenantModuleConfig(tenantId, moduleId) {
    try {
      const [rows] = await db.execute(
        'SELECT config FROM tenant_module_configs WHERE tenant_id = ? AND module_id = ?',
        [tenantId, moduleId],
      );

      if (rows.length === 0) {
        return null;
      }

      return typeof rows[0].config === 'string' ? JSON.parse(rows[0].config) : rows[0].config;
    } catch (error) {
      logger.error('获取租户模块配置失败:', error);
      return null;
    }
  }

  /**
   * 保存租户模块配置
   */
  async saveTenantModuleConfig(tenantId, moduleId, config) {
    try {
      await db.execute(
        `INSERT INTO tenant_module_configs (tenant_id, module_id, config, updated_at)
         VALUES (?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
         config = VALUES(config),
         updated_at = VALUES(updated_at)`,
        [tenantId, moduleId, JSON.stringify(config)],
      );
      return true;
    } catch (error) {
      logger.error('保存租户模块配置失败:', error);
      return false;
    }
  }

  /**
   * 获取模块启用状态
   */
  async getModuleEnabled(tenantId, moduleId) {
    try {
      const [rows] = await db.execute(
        'SELECT enabled FROM tenant_module_configs WHERE tenant_id = ? AND module_id = ?',
        [tenantId, moduleId],
      );

      if (rows.length === 0) {
        return true; // 默认启用
      }

      return rows[0].enabled === 1;
    } catch (error) {
      logger.error('获取模块启用状态失败:', error);
      return true;
    }
  }

  /**
   * 设置模块启用状态
   */
  async setModuleEnabled(tenantId, moduleId, enabled) {
    try {
      await db.execute(
        `INSERT INTO tenant_module_configs (tenant_id, module_id, enabled, updated_at)
         VALUES (?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
         enabled = VALUES(enabled),
         updated_at = VALUES(updated_at)`,
        [tenantId, moduleId, enabled ? 1 : 0],
      );
      return true;
    } catch (error) {
      logger.error('设置模块启用状态失败:', error);
      return false;
    }
  }

  /**
   * 获取租户所有模块配置
   */
  async getAllTenantModuleConfigs(tenantId) {
    try {
      const [rows] = await db.execute(
        'SELECT module_id, config, enabled FROM tenant_module_configs WHERE tenant_id = ?',
        [tenantId],
      );

      return rows.map(row => ({
        module_id: row.module_id,
        enabled: row.enabled === 1,
        config: typeof row.config === 'string' ? JSON.parse(row.config) : row.config,
      }));
    } catch (error) {
      logger.error('获取租户所有模块配置失败:', error);
      return [];
    }
  }

  /**
   * 初始化租户模块配置
   */
  async initTenantModuleConfigs(tenantId, moduleConfigs) {
    try {
      for (const moduleConfig of moduleConfigs) {
        const exists = await this.getTenantModuleConfig(tenantId, moduleConfig.id);
        if (!exists) {
          await db.execute(
            `INSERT INTO tenant_module_configs (tenant_id, module_id, config, enabled, created_at, updated_at)
             VALUES (?, ?, ?, ?, NOW(), NOW())`,
            [
              tenantId,
              moduleConfig.id,
              JSON.stringify(moduleConfig.default_config || {}),
              1,
            ],
          );
        }
      }
      return true;
    } catch (error) {
      logger.error('初始化租户模块配置失败:', error);
      return false;
    }
  }
}

module.exports = new ModuleConfigService();
