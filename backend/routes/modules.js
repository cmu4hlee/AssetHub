const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');

const getTenantId = req => {
  return req.user?.tenant_id || req.body?.tenant_id || req.query?.tenant_id;
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

// 根路由
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Modules API',
    endpoints: {
      list: '/api/modules/list',
      'check-conflicts': '/api/modules/check-conflicts',
      'dependency-graph': '/api/modules/dependency-graph',
    },
  });
});

router.post('/register', authenticate, async (req, res) => {
  try {
    const {
      id,
      name,
      version,
      description,
      category,
      type,
      status,
      author,
      dependencies,
      compatibility,
      frontend_config,
      backend_config,
      config_schema,
      default_config,
      interfaces,
    } = req.body;

    if (!id || !name || !version) {
      return res.status(400).json({
        success: false,
        message: '模块ID、名称和版本为必填项',
      });
    }

    await db.execute(
      `INSERT INTO system_modules (
        id, name, version, description, category, type, status, author,
        dependencies, compatibility, frontend_config, backend_config,
        config_schema, default_config, interfaces
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        name,
        version,
        description,
        category,
        type,
        status || 'stable',
        author,
        stringifyJSONField(dependencies),
        stringifyJSONField(compatibility),
        stringifyJSONField(frontend_config),
        stringifyJSONField(backend_config),
        stringifyJSONField(config_schema),
        stringifyJSONField(default_config),
        stringifyJSONField(interfaces),
      ],
    );

    res.json({
      success: true,
      message: '模块注册成功',
      data: { id, name, version },
    });
  } catch (error) {
    console.error('模块注册失败:', error);
    res.status(500).json({
      success: false,
      message: '模块注册失败',
      error: error.message,
    });
  }
});

router.get('/list', authenticate, async (req, res) => {
  try {
    console.log('====================================');
    console.log('模块列表接口被调用!');
    console.log('请求路径:', req.path);
    console.log('请求方法:', req.method);
    console.log('请求查询参数:', req.query);
    console.log('请求头:', req.headers);
    console.log('用户信息:', req.user);
    console.log('====================================');

    const { category, type, status } = req.query;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (category) {
      whereClause += ' AND category = ?';
      params.push(category);
    }
    if (type) {
      whereClause += ' AND type = ?';
      params.push(type);
    }
    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    const sql = `SELECT * FROM system_modules ${whereClause} ORDER BY category, name`;
    console.log('执行SQL查询:', sql);
    console.log('查询参数:', params);
    console.log('查询参数类型:', typeof params);
    console.log('查询参数是否为数组:', Array.isArray(params));

    // 确保params是一个数组，即使它是空的
    const queryParams = Array.isArray(params) ? params : [];
    console.log('最终查询参数:', queryParams);

    console.log('开始执行SQL查询...');
    let rawRows;
    if (queryParams.length > 0) {
      [rawRows] = await db.execute(sql, queryParams);
    } else {
      // 对无绑定参数的查询，使用 query 避免 execute 在部分环境下的异常
      const connection = await db.getConnection();
      try {
        [rawRows] = await connection.query(sql);
      } finally {
        connection.release();
      }
    }
    const modules = Array.isArray(rawRows) ? rawRows : [];
    console.log('SQL查询执行完成!');

    console.log('查询结果长度:', modules.length);
    console.log('查询结果是否为数组:', Array.isArray(modules));

    const formattedModules = modules.map(module => {
      console.log('处理模块:', module.id, module.name);
      return {
        ...module,
        dependencies: parseJSONField(module.dependencies),
        compatibility: parseJSONField(module.compatibility),
        frontend_config: parseJSONField(module.frontend_config),
        backend_config: parseJSONField(module.backend_config),
        config_schema: parseJSONField(module.config_schema),
        default_config: parseJSONField(module.default_config),
        interfaces: parseJSONField(module.interfaces),
      };
    });

    console.log('格式化后的模块数量:', formattedModules.length);
    console.log('准备返回响应...');

    res.json({
      success: true,
      data: formattedModules,
      message: '获取模块列表成功',
      total: formattedModules.length,
    });
  } catch (error) {
    console.error('====================================');
    console.error('获取模块列表失败:', error);
    console.error('错误堆栈:', error.stack);
    console.error('====================================');
    res.status(500).json({
      success: false,
      message: '获取模块列表失败',
      error: error.message,
    });
  }
});

router.get('/:moduleId', authenticate, async (req, res) => {
  try {
    const { moduleId } = req.params;

    const [modules] = await db.execute('SELECT * FROM system_modules WHERE id = ?', [moduleId]);

    if (modules.length === 0) {
      return res.status(404).json({
        success: false,
        message: '模块不存在',
      });
    }

    const module = modules[0];
    const formattedModule = {
      ...module,
      dependencies: parseJSONField(module.dependencies),
      compatibility: parseJSONField(module.compatibility),
      frontend_config: parseJSONField(module.frontend_config),
      backend_config: parseJSONField(module.backend_config),
      config_schema: parseJSONField(module.config_schema),
      default_config: parseJSONField(module.default_config),
      interfaces: parseJSONField(module.interfaces),
    };

    res.json({
      success: true,
      data: formattedModule,
      message: '获取模块信息成功',
    });
  } catch (error) {
    console.error('获取模块信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取模块信息失败',
      error: error.message,
    });
  }
});

router.put('/:moduleId', authenticate, async (req, res) => {
  try {
    const { moduleId } = req.params;
    const {
      name,
      version,
      description,
      category,
      type,
      status,
      author,
      dependencies,
      compatibility,
      frontend_config,
      backend_config,
      config_schema,
      default_config,
      interfaces,
    } = req.body;

    const [result] = await db.execute(
      `UPDATE system_modules SET
        name = ?, version = ?, description = ?, category = ?, type = ?, status = ?, author = ?,
        dependencies = ?, compatibility = ?, frontend_config = ?, backend_config = ?,
        config_schema = ?, default_config = ?, interfaces = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [
        name,
        version,
        description,
        category,
        type,
        status,
        author,
        stringifyJSONField(dependencies),
        stringifyJSONField(compatibility),
        stringifyJSONField(frontend_config),
        stringifyJSONField(backend_config),
        stringifyJSONField(config_schema),
        stringifyJSONField(default_config),
        stringifyJSONField(interfaces),
        moduleId,
      ],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: '模块不存在',
      });
    }

    res.json({
      success: true,
      message: '模块更新成功',
    });
  } catch (error) {
    console.error('模块更新失败:', error);
    res.status(500).json({
      success: false,
      message: '模块更新失败',
      error: error.message,
    });
  }
});

router.delete('/:moduleId', authenticate, async (req, res) => {
  try {
    const { moduleId } = req.params;

    const [result] = await db.execute('DELETE FROM system_modules WHERE id = ?', [moduleId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: '模块不存在',
      });
    }

    res.json({
      success: true,
      message: '模块删除成功',
    });
  } catch (error) {
    console.error('模块删除失败:', error);
    res.status(500).json({
      success: false,
      message: '模块删除失败',
      error: error.message,
    });
  }
});

router.get('/:moduleId/dependencies', authenticate, async (req, res) => {
  try {
    const { moduleId } = req.params;

    const [dependencies] = await db.execute(
      `SELECT md.*, sm.name as module_name, sm.version as module_version
       FROM module_dependencies md
       JOIN system_modules sm ON md.dependency_module_id = sm.id
       WHERE md.module_id = ?`,
      [moduleId],
    );

    res.json({
      success: true,
      data: dependencies,
      message: '获取模块依赖成功',
    });
  } catch (error) {
    console.error('获取模块依赖失败:', error);
    res.status(500).json({
      success: false,
      message: '获取模块依赖失败',
      error: error.message,
    });
  }
});

router.post('/:moduleId/dependencies', authenticate, async (req, res) => {
  try {
    const { moduleId } = req.params;
    const { dependencies } = req.body;

    if (!Array.isArray(dependencies)) {
      return res.status(400).json({
        success: false,
        message: '依赖列表格式错误',
      });
    }

    for (const dep of dependencies) {
      await db.execute(
        `INSERT INTO module_dependencies (module_id, dependency_module_id, dependency_type, min_version, max_version)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
         dependency_type = VALUES(dependency_type),
         min_version = VALUES(min_version),
         max_version = VALUES(max_version)`,
        [
          moduleId,
          dep.module_id,
          dep.dependency_type,
          dep.min_version || null,
          dep.max_version || null,
        ],
      );
    }

    res.json({
      success: true,
      message: '模块依赖添加成功',
    });
  } catch (error) {
    console.error('添加模块依赖失败:', error);
    res.status(500).json({
      success: false,
      message: '添加模块依赖失败',
      error: error.message,
    });
  }
});

router.delete('/:moduleId/dependencies/:depId', authenticate, async (req, res) => {
  try {
    const { moduleId, depId } = req.params;

    await db.execute('DELETE FROM module_dependencies WHERE id = ? AND module_id = ?', [
      depId,
      moduleId,
    ]);

    res.json({
      success: true,
      message: '模块依赖删除成功',
    });
  } catch (error) {
    console.error('删除模块依赖失败:', error);
    res.status(500).json({
      success: false,
      message: '删除模块依赖失败',
      error: error.message,
    });
  }
});

router.get('/:moduleId/status', authenticate, async (req, res) => {
  try {
    const { moduleId } = req.params;
    const tenantId = getTenantId(req);

    const [statuses] = await db.execute(
      `SELECT * FROM module_runtime_status WHERE module_id = ? ${tenantId ? 'AND tenant_id = ?' : ''}`,
      tenantId ? [moduleId, tenantId] : [moduleId],
    );

    res.json({
      success: true,
      data: statuses.length > 0 ? statuses[0] : null,
      message: '获取模块状态成功',
    });
  } catch (error) {
    console.error('获取模块状态失败:', error);
    res.status(500).json({
      success: false,
      message: '获取模块状态失败',
      error: error.message,
    });
  }
});

router.put('/:moduleId/status', authenticate, async (req, res) => {
  try {
    const { moduleId } = req.params;
    const { status, health_status, error_message, metrics } = req.body;
    const tenantId = getTenantId(req);

    const [result] = await db.execute(
      `UPDATE module_runtime_status SET
        status = ?, health_status = ?, error_message = ?, metrics = ?,
        last_heartbeat = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE module_id = ? ${tenantId ? 'AND tenant_id = ?' : ''}`,
      tenantId
        ? [status, health_status, error_message, stringifyJSONField(metrics), moduleId, tenantId]
        : [status, health_status, error_message, stringifyJSONField(metrics), moduleId],
    );

    if (result.affectedRows === 0) {
      await db.execute(
        `INSERT INTO module_runtime_status (module_id, tenant_id, status, health_status, error_message, metrics, last_heartbeat)
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [moduleId, tenantId, status, health_status, error_message, stringifyJSONField(metrics)],
      );
    }

    res.json({
      success: true,
      message: '模块状态更新成功',
    });
  } catch (error) {
    console.error('更新模块状态失败:', error);
    res.status(500).json({
      success: false,
      message: '更新模块状态失败',
      error: error.message,
    });
  }
});

router.get('/:moduleId/logs', authenticate, async (req, res) => {
  try {
    const { moduleId } = req.params;
    const { operation, limit = 50, offset = 0 } = req.query;

    let whereClause = 'WHERE module_id = ?';
    const params = [moduleId];

    if (operation) {
      whereClause += ' AND operation = ?';
      params.push(operation);
    }

    const [logs] = await db.execute(
      `SELECT * FROM module_operation_logs ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), parseInt(offset)],
    );

    const [countResult] = await db.execute(
      `SELECT COUNT(*) as total FROM module_operation_logs ${whereClause}`,
      params,
    );

    res.json({
      success: true,
      data: logs,
      total: countResult[0].total,
      message: '获取模块日志成功',
    });
  } catch (error) {
    console.error('获取模块日志失败:', error);
    res.status(500).json({
      success: false,
      message: '获取模块日志失败',
      error: error.message,
    });
  }
});

router.get('/check-conflicts', authenticate, async (req, res) => {
  try {
    const { module_ids } = req.query;

    if (!module_ids) {
      return res.status(400).json({
        success: false,
        message: '模块ID列表为必填项',
      });
    }

    const moduleIds = module_ids.split(',').map(id => id.trim());

    const conflicts = [];
    const warnings = [];

    for (const moduleId of moduleIds) {
      const [module] = await db.execute('SELECT * FROM system_modules WHERE id = ?', [moduleId]);

      if (module.length === 0) {
        conflicts.push({
          type: 'module_not_found',
          module_id: moduleId,
          message: `模块 ${moduleId} 不存在`,
        });
        continue;
      }

      const moduleData = module[0];
      const dependencies = parseJSONField(moduleData.dependencies) || [];

      for (const dep of dependencies) {
        const [depModule] = await db.execute(
          'SELECT * FROM system_modules WHERE id = ?',
          dep.module_id,
        );

        if (depModule.length === 0) {
          conflicts.push({
            type: 'dependency_not_found',
            module_id: moduleId,
            dependency_id: dep.module_id,
            message: `模块 ${moduleId} 的依赖模块 ${dep.module_id} 不存在`,
          });
          continue;
        }

        const depModuleData = depModule[0];

        if (!moduleIds.includes(dep.module_id)) {
          warnings.push({
            type: 'missing_dependency',
            module_id: moduleId,
            dependency_id: dep.module_id,
            dependency_name: depModuleData.name,
            message: `模块 ${moduleId} 依赖的模块 ${depModuleData.name} 未包含在选中的模块中`,
          });
        }

        if (dep.min_version || dep.max_version) {
          const currentVersion = depModuleData.version;
          const isVersionCompatible = checkVersionCompatibility(
            currentVersion,
            dep.min_version,
            dep.max_version,
          );

          if (!isVersionCompatible) {
            conflicts.push({
              type: 'version_incompatible',
              module_id: moduleId,
              dependency_id: dep.module_id,
              dependency_name: depModuleData.name,
              current_version: currentVersion,
              required_min_version: dep.min_version,
              required_max_version: dep.max_version,
              message: `模块 ${moduleId} 依赖的模块 ${depModuleData.name} 版本不兼容`,
            });
          }
        }
      }

      const compatibility = parseJSONField(moduleData.compatibility) || [];

      for (const rule of compatibility) {
        if (rule.type === 'mutually_exclusive') {
          const conflictingModules = moduleIds.filter(id => rule.modules.includes(id));
          if (conflictingModules.length > 1) {
            conflicts.push({
              type: 'mutually_exclusive',
              modules: conflictingModules,
              message: `以下模块不能同时启用: ${conflictingModules.join(', ')}`,
            });
          }
        } else if (rule.type === 'required_together') {
          const requiredModules = rule.modules.filter(id => !moduleIds.includes(id));
          if (requiredModules.length > 0) {
            warnings.push({
              type: 'required_together',
              module_id: moduleId,
              required_modules: requiredModules,
              message: `模块 ${moduleId} 需要与以下模块一起启用: ${requiredModules.join(', ')}`,
            });
          }
        }
      }
    }

    const [allModules] = await db.execute('SELECT * FROM system_modules WHERE id IN (?)', [
      moduleIds,
    ]);

    const moduleNames = {};
    allModules.forEach(m => {
      moduleNames[m.id] = m.name;
    });

    res.json({
      success: true,
      data: {
        conflicts,
        warnings,
        modules: allModules.map(m => ({
          id: m.id,
          name: m.name,
          version: m.version,
          category: m.category,
          type: m.type,
        })),
      },
      message: '依赖冲突检测完成',
    });
  } catch (error) {
    console.error('检测依赖冲突失败:', error);
    res.status(500).json({
      success: false,
      message: '检测依赖冲突失败',
      error: error.message,
    });
  }
});

router.get('/dependency-graph', authenticate, async (req, res) => {
  try {
    const { module_id } = req.query;

    const nodes = [];
    const edges = [];

    const [modules] = await db.execute('SELECT * FROM system_modules');

    modules.forEach(module => {
      nodes.push({
        id: module.id,
        name: module.name,
        version: module.version,
        category: module.category,
        type: module.type,
      });
    });

    const [dependencies] = await db.execute('SELECT * FROM module_dependencies');

    dependencies.forEach(dep => {
      edges.push({
        source: dep.module_id,
        target: dep.dependency_module_id,
        type: dep.dependency_type,
        label: `${dep.dependency_type}${dep.min_version ? ` >=${dep.min_version}` : ''}${dep.max_version ? ` <=${dep.max_version}` : ''}`,
      });
    });

    const graph = {
      nodes,
      edges,
    };

    if (module_id) {
      const visited = new Set();
      const subGraphNodes = [];
      const subGraphEdges = [];

      const traverse = nodeId => {
        if (visited.has(nodeId)) return;
        visited.add(nodeId);

        const node = nodes.find(n => n.id === nodeId);
        if (node) {
          subGraphNodes.push(node);
        }

        const relatedEdges = edges.filter(e => e.source === nodeId || e.target === nodeId);
        relatedEdges.forEach(edge => {
          subGraphEdges.push(edge);
          if (edge.source === nodeId) {
            traverse(edge.target);
          } else if (edge.target === nodeId) {
            traverse(edge.source);
          }
        });
      };

      traverse(module_id);

      return res.json({
        success: true,
        data: {
          nodes: subGraphNodes,
          edges: subGraphEdges,
        },
        message: '获取模块依赖图成功',
      });
    }

    res.json({
      success: true,
      data: graph,
      message: '获取模块依赖图成功',
    });
  } catch (error) {
    console.error('获取模块依赖图失败:', error);
    res.status(500).json({
      success: false,
      message: '获取模块依赖图失败',
      error: error.message,
    });
  }
});

function checkVersionCompatibility(currentVersion, minVersion, maxVersion) {
  if (!minVersion && !maxVersion) return true;

  const parseVersion = version => {
    const parts = version.split('.').map(Number);
    while (parts.length < 3) {
      parts.push(0);
    }
    return parts;
  };

  const current = parseVersion(currentVersion);

  if (minVersion) {
    const min = parseVersion(minVersion);
    for (let i = 0; i < 3; i++) {
      if (current[i] > min[i]) break;
      if (current[i] < min[i]) return false;
    }
  }

  if (maxVersion) {
    const max = parseVersion(maxVersion);
    for (let i = 0; i < 3; i++) {
      if (current[i] < max[i]) break;
      if (current[i] > max[i]) return false;
    }
  }

  return true;
}

module.exports = router;
