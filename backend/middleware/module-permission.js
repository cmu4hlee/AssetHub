const db = require('../config/database');

// 数据库查询辅助函数（带重试机制）
async function executeQuery(query, params, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const result = await db.execute(query, params);
      return result;
    } catch (error) {
      // 如果是连接丢失错误，尝试重试
      if (
        (error.code === 'PROTOCOL_CONNECTION_LOST' || error.code === 'ECONNREFUSED') &&
        i < retries - 1
      ) {
        console.log(`数据库连接丢失，正在重试 (${i + 1}/${retries})...`);
        // 等待一段时间后重试
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        continue;
      }
      // 其他错误或已达到最大重试次数，抛出错误
      throw error;
    }
  }
}

/**
 * 模块权限验证中间件
 * 验证用户是否有权访问指定模块
 * @param {string} moduleId - 模块ID
 */
const requireModuleAccess = moduleId => {
  return async (req, res, next) => {
    try {
      // 首先检查是否已认证
      if (!req.user) {
        return res.status(401).json({ success: false, message: '需要先登录' });
      }

      // 超级管理员拥有所有模块的访问权限
      if (req.user.is_super_admin) {
        return next();
      }

      // 检查租户ID是否存在
      if (!req.user.tenant_id) {
        return res.status(403).json({ success: false, message: '租户信息不存在' });
      }

      // 检查用户是否有权访问该模块
      const [moduleConfig] = await executeQuery(
        'SELECT enabled FROM tenant_module_configs WHERE tenant_id = ? AND module_id = ?',
        [req.user.tenant_id, moduleId],
      );

      if (moduleConfig.length === 0 || !moduleConfig[0].enabled) {
        return res.status(403).json({ success: false, message: '模块未启用或无权限访问' });
      }

      // 验证通过，继续处理请求
      next();
    } catch (error) {
      console.error('模块权限验证失败:', error);
      return res.status(500).json({ success: false, message: '模块权限验证失败' });
    }
  };
};

/**
 * 菜单权限验证中间件
 * 验证用户是否有权访问指定菜单
 * @param {string} menuKey - 菜单键值
 */
const requireMenuAccess = menuKey => {
  return async (req, res, next) => {
    try {
      // 首先检查是否已认证
      if (!req.user) {
        return res.status(401).json({ success: false, message: '需要先登录' });
      }

      // 超级管理员拥有所有菜单的访问权限
      if (req.user.is_super_admin) {
        return next();
      }

      // 检查租户ID是否存在
      if (!req.user.tenant_id) {
        return res.status(403).json({ success: false, message: '租户信息不存在' });
      }

      // 检查用户是否有权访问该菜单
      // 由于菜单是与模块关联的，我们需要检查所有启用的模块中是否有该菜单的权限
      const [enabledModules] = await executeQuery(
        'SELECT module_id FROM tenant_module_configs WHERE tenant_id = ? AND enabled = ?',
        [req.user.tenant_id, 1],
      );

      if (enabledModules.length === 0) {
        return res.status(403).json({ success: false, message: '无可用模块' });
      }

      const moduleIds = enabledModules.map(m => m.module_id);

      const placeholders = moduleIds.map(() => '?').join(',');
      const [menuAccess] = await executeQuery(
        `SELECT COUNT(*) as count
         FROM tenant_module_menus
         WHERE tenant_id = ? AND is_enabled = ? AND menu_key = ? AND module_id IN (${placeholders})`,
        [req.user.tenant_id, 1, menuKey, ...moduleIds],
      );

      if (menuAccess[0].count === 0) {
        return res.status(403).json({ success: false, message: '菜单未启用或无权限访问' });
      }

      // 验证通过，继续处理请求
      next();
    } catch (error) {
      console.error('菜单权限验证失败:', error);
      return res.status(500).json({ success: false, message: '菜单权限验证失败' });
    }
  };
};

/**
 * 获取租户启用的模块和菜单
 * @param {number} tenantId - 租户ID
 * @returns {Promise<Object>} 租户模块和菜单配置
 */
async function getTenantModuleMenuConfig(tenantId) {
  try {
    // 获取租户启用的模块
    const [enabledModules] = await executeQuery(
      'SELECT module_id FROM tenant_module_configs WHERE tenant_id = ? AND enabled = ?',
      [tenantId, 1],
    );

    const moduleIds = enabledModules.map(m => m.module_id);

    if (moduleIds.length === 0) {
      return {
        enabled_modules: [],
        module_menus: new Map(),
      };
    }

    // 获取租户启用的模块菜单
    const placeholders = moduleIds.map(() => '?').join(',');
    const [enabledMenus] = await executeQuery(
      `SELECT module_id, menu_key
       FROM tenant_module_menus
       WHERE tenant_id = ? AND is_enabled = ? AND module_id IN (${placeholders})`,
      [tenantId, 1, ...moduleIds],
    );

    // 构建模块菜单映射
    const moduleMenuMap = new Map();
    enabledMenus.forEach(item => {
      if (!moduleMenuMap.has(item.module_id)) {
        moduleMenuMap.set(item.module_id, []);
      }
      moduleMenuMap.get(item.module_id).push(item.menu_key);
    });

    return {
      enabled_modules: moduleIds,
      module_menus: moduleMenuMap,
    };
  } catch (error) {
    console.error('获取租户模块菜单配置失败:', error);
    return {
      enabled_modules: [],
      module_menus: new Map(),
    };
  }
}

module.exports = {
  requireModuleAccess,
  requireMenuAccess,
  getTenantModuleMenuConfig,
};
