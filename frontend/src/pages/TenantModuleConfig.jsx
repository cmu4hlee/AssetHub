import React, { useState, useEffect } from 'react';
import { Tooltip } from 'antd';
import { tenantModuleConfigAPI } from '../api/tenantModuleConfigApi';

const TenantModuleConfig = () => {
  const [tenants, setTenants] = useState([]);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [modules, setModules] = useState([]);
  const [selectedModule, setSelectedModule] = useState(null);
  const [moduleMenus, setModuleMenus] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  const [menuSaveLoading, setMenuSaveLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [logs, setLogs] = useState([]);
  const [showLogs, setShowLogs] = useState(false);
  const [showMenuConfig, setShowMenuConfig] = useState(false);
  const [moduleDependencies, setModuleDependencies] = useState({});
  const [dependencyCheckLoading, setDependencyCheckLoading] = useState(false);

  // 加载企业空间列表
  const loadTenants = async () => {
    try {
      setLoading(true);
      const response = await tenantModuleConfigAPI.getTenants({
        search: searchTerm,
        page: 1,
        pageSize: 100,
      });
      setTenants(Array.isArray(response?.records) ? response.records : []);
    } catch (error) {
      console.error('加载企业空间列表失败:', error);
      setMessage('加载企业空间列表失败');
      // 显示错误信息
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  // 加载模块配置
  const loadModuleConfig = async tenantId => {
    try {
      setLoading(true);
      const response = await tenantModuleConfigAPI.getTenantModules(tenantId);
      const moduleList = Array.isArray(response) ? response : [];
      setModules(moduleList);
      // 加载每个模块的依赖关系
      const dependenciesMap = {};
      for (const module of moduleList) {
        try {
          const depResponse = await tenantModuleConfigAPI.getModuleDependencies(module.module_id);
          dependenciesMap[module.module_id] = Array.isArray(depResponse) ? depResponse : [];
        } catch (error) {
          console.error(`加载模块 ${module.module_id} 依赖关系失败:`, error);
          dependenciesMap[module.module_id] = [];
        }
      }
      setModuleDependencies(dependenciesMap);
    } catch (error) {
      console.error('加载模块配置失败:', error);
      setMessage('加载模块配置失败');
      // 显示错误信息
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  // 加载模块菜单配置
  const loadModuleMenus = async (tenantId, moduleId) => {
    try {
      setLoading(true);
      const response = await tenantModuleConfigAPI.getModuleMenus(tenantId, moduleId);
      setModuleMenus(Array.isArray(response) ? response : []);
    } catch (error) {
      console.error('加载模块菜单配置失败:', error);
      setMessage('加载模块菜单配置失败');
      // 显示错误信息
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  // 加载配置变更日志
  const loadConfigLogs = async () => {
    if (!selectedTenant) return;

    try {
      setLoading(true);
      const response = await tenantModuleConfigAPI.getConfigLogs({
        tenantId: selectedTenant.id,
        page: 1,
        pageSize: 50,
      });
      setLogs(Array.isArray(response?.records) ? response.records : []);
    } catch (error) {
      console.error('加载配置变更日志失败:', error);
      setMessage('加载配置变更日志失败');
      // 显示错误信息
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  // 检查模块依赖关系
  const checkModuleDependencies = async (moduleId, action) => {
    try {
      setDependencyCheckLoading(true);
      return await tenantModuleConfigAPI.checkModuleDependencies(moduleId, action);
    } catch (error) {
      console.error('检查模块依赖关系失败:', error);
      return { valid: true, message: '' };
    } finally {
      setDependencyCheckLoading(false);
    }
  };

  // 保存模块配置
  const saveModuleConfig = async () => {
    if (!selectedTenant) return;

    try {
      setSaveLoading(true);
      await tenantModuleConfigAPI.updateTenantModules(selectedTenant.id, modules);
      setMessage('模块配置保存成功');
      // 重新加载日志
      loadConfigLogs();
      // 显示成功信息
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('保存模块配置失败:', error);
      setMessage('保存模块配置失败');
      // 显示错误信息
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setSaveLoading(false);
    }
  };

  // 保存模块菜单配置
  const saveModuleMenuConfig = async () => {
    if (!selectedTenant || !selectedModule) return;

    try {
      setMenuSaveLoading(true);
      await tenantModuleConfigAPI.updateTenantModuleMenus(
        selectedTenant.id,
        selectedModule.module_id,
        moduleMenus
      );
      setMessage('模块菜单配置保存成功');
      // 重新加载日志
      loadConfigLogs();
      // 显示成功信息
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('保存模块菜单配置失败:', error);
      setMessage('保存模块菜单配置失败');
      // 显示错误信息
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setMenuSaveLoading(false);
    }
  };

  // 切换模块启用状态
  const toggleModuleEnabled = async moduleId => {
    const module = modules.find(m => m.module_id === moduleId);
    const newEnabledState = !module.enabled;
    const action = newEnabledState ? 'enable' : 'disable';

    // 检查依赖关系
    const dependencyCheck = await checkModuleDependencies(moduleId, action);
    if (!dependencyCheck.valid) {
      setMessage(dependencyCheck.message);
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    setModules(prevModules =>
      prevModules.map(module =>
        module.module_id === moduleId ? { ...module, enabled: newEnabledState } : module
      )
    );
  };

  // 切换菜单启用状态
  const toggleMenuEnabled = menuKey => {
    setModuleMenus(prevMenus =>
      prevMenus.map(menu =>
        menu.menu_key === menuKey ? { ...menu, is_enabled: !menu.is_enabled } : menu
      )
    );
  };

  // 处理企业空间选择
  const handleTenantSelect = tenant => {
    setSelectedTenant(tenant);
    loadModuleConfig(tenant.id);
    setSelectedModule(null);
    setModuleMenus([]);
    setShowLogs(false);
    setShowMenuConfig(false);
  };

  // 处理模块选择
  const handleModuleSelect = module => {
    setSelectedModule(module);
    loadModuleMenus(selectedTenant.id, module.module_id);
    setShowMenuConfig(true);
  };

  // 初始化
  useEffect(() => {
    loadTenants();
  }, [searchTerm]);

  // 当选中企业空间变化时加载日志
  useEffect(() => {
    if (selectedTenant && showLogs) {
      loadConfigLogs();
    }
  }, [selectedTenant, showLogs]);

  // 获取模块依赖关系文本
  const getDependencyText = moduleId => {
    const dependencies = moduleDependencies[moduleId] || [];
    if (dependencies.length === 0) {
      return '无依赖';
    }
    return dependencies
      .map(dep => (dep.dependency_type === 'required' ? '必需' : '可选'))
      .join(', ');
  };

  return (
    <div className="container mt-4">
      <h2>企业空间模块配置管理</h2>

      {message && (
        <div
          className={`alert ${message.includes('成功') ? 'alert-success' : 'alert-danger'} mt-3`}
        >
          {message}
        </div>
      )}

      {/* 企业空间搜索和选择 */}
      <div className="card mb-4 shadow-sm">
        <div className="card-header bg-primary text-white">企业空间选择</div>
        <div className="card-body">
          <div className="mb-3">
            <input
              type="text"
              className="form-control form-control-lg"
              placeholder="按企业名称或代码搜索"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="text-center py-4">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">加载中...</span>
              </div>
              <p className="mt-2">加载企业空间中...</p>
            </div>
          ) : (
            <div className="row">
              {tenants.length === 0 ? (
                <div className="col-12 text-center py-4">
                  <p className="text-muted">未找到企业空间</p>
                </div>
              ) : (
                tenants.map(tenant => (
                  <div
                    key={tenant.id}
                    className={`col-md-3 mb-3 cursor-pointer ${
                      selectedTenant?.id === tenant.id
                        ? 'border-2 border-primary rounded-lg p-3 bg-primary bg-opacity-5'
                        : 'border border-light rounded-lg p-3 hover:bg-light'
                    }`}
                    onClick={() => handleTenantSelect(tenant)}
                  >
                    <h5 className="card-title">{tenant.name}</h5>
                    <p className="text-muted">代码: {tenant.code}</p>
                    <p
                      className={`text-sm font-medium ${
                        tenant.status === 'active' ? 'text-success' : 'text-danger'
                      }`}
                    >
                      状态: {tenant.status === 'active' ? '启用' : '禁用'}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* 模块配置 */}
      {selectedTenant && (
        <div className="card mb-4 shadow-sm">
          <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
            <h3 className="mb-0">{selectedTenant.name} - 模块配置</h3>
            <div>
              <button
                className="btn btn-light text-primary me-2"
                onClick={saveModuleConfig}
                disabled={saveLoading || dependencyCheckLoading}
              >
                {saveLoading ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-1"
                      role="status"
                      aria-hidden="true"
                    ></span>
                    保存中...
                  </>
                ) : (
                  '保存配置'
                )}
              </button>
              <button className="btn btn-light text-primary" onClick={() => setShowLogs(!showLogs)}>
                {showLogs ? '隐藏日志' : '查看变更日志'}
              </button>
            </div>
          </div>
          <div className="card-body">
            {showLogs ? (
              <div>
                <h4 className="mb-4">配置变更日志</h4>
                {loading ? (
                  <div className="text-center py-4">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">加载中...</span>
                    </div>
                    <p className="mt-2">加载日志中...</p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-striped table-hover">
                      <thead className="table-dark">
                        <tr>
                          <th>操作时间</th>
                          <th>操作人</th>
                          <th>模块</th>
                          <th>操作</th>
                          <th>变更内容</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logs.length === 0 ? (
                          <tr>
                            <td colSpan="5" className="text-center text-muted">
                              无变更日志
                            </td>
                          </tr>
                        ) : (
                          logs.map(log => (
                            <tr key={log.id}>
                              <td>{new Date(log.created_at).toLocaleString()}</td>
                              <td>{log.operator_name}</td>
                              <td>{log.module_name}</td>
                              <td>
                                <span
                                  className={`badge ${log.action.includes('create') ? 'bg-success' : log.action.includes('update') ? 'bg-primary' : 'bg-warning'}`}
                                >
                                  {log.action === 'create'
                                    ? '创建'
                                    : log.action === 'update'
                                      ? '更新'
                                      : log.action === 'create_menu'
                                        ? '创建菜单'
                                        : '更新菜单'}
                                </span>
                              </td>
                              <td>
                                <div>
                                  {log.action.includes('menu') ? (
                                    <div>
                                      <strong>菜单:</strong> {log.new_value.menu_key}
                                      <br />
                                      <strong>状态:</strong>{' '}
                                      {log.new_value.is_enabled ? '启用' : '禁用'}
                                    </div>
                                  ) : (
                                    <div>
                                      <strong>状态:</strong>{' '}
                                      {log.new_value.enabled ? '启用' : '禁用'}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : showMenuConfig && selectedModule ? (
              <div>
                <div className="d-flex justify-content-between align-items-center mb-4">
                  <h4>{selectedModule.module_name} - 菜单配置</h4>
                  <button
                    className="btn btn-primary"
                    onClick={saveModuleMenuConfig}
                    disabled={menuSaveLoading}
                  >
                    {menuSaveLoading ? (
                      <>
                        <span
                          className="spinner-border spinner-border-sm me-1"
                          role="status"
                          aria-hidden="true"
                        ></span>
                        保存中...
                      </>
                    ) : (
                      '保存菜单配置'
                    )}
                  </button>
                </div>

                {!selectedModule.enabled && (
                  <div className="alert alert-warning mb-4" role="alert">
                    <strong>提示：</strong> 该模块已禁用。菜单配置已锁定，如需使用请先启用该模块。
                  </div>
                )}

                {loading ? (
                  <div className="text-center py-4">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">加载中...</span>
                    </div>
                    <p className="mt-2">加载菜单中...</p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-striped table-hover">
                      <thead className="table-dark">
                        <tr>
                          <th>菜单名称</th>
                          <th>菜单键值</th>
                          <th>父菜单</th>
                          <th>图标</th>
                          <th>排序</th>
                          <th>状态</th>
                          <th>操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {moduleMenus.length === 0 ? (
                          <tr>
                            <td colSpan="7" className="text-center text-muted">
                              无菜单配置
                            </td>
                          </tr>
                        ) : (
                          moduleMenus.map(menu => (
                            <tr key={menu.menu_key}>
                              <td>{menu.menu_label}</td>
                              <td>{menu.menu_key}</td>
                              <td>{menu.parent_key || '-'}</td>
                              <td>{menu.icon || '-'}</td>
                              <td>{menu.order_index}</td>
                              <td>
                                <span
                                  className={`badge ${menu.is_enabled ? 'bg-success' : 'bg-secondary'}`}
                                >
                                  {menu.is_enabled ? '已启用' : '已禁用'}
                                </span>
                              </td>
                              <td>
                                <div className="form-check form-switch">
                                  <input
                                    className="form-check-input"
                                    type="checkbox"
                                    checked={menu.is_enabled}
                                    onChange={() => toggleMenuEnabled(menu.menu_key)}
                                  />
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="mt-4">
                  <button className="btn btn-secondary" onClick={() => setShowMenuConfig(false)}>
                    返回模块列表
                  </button>
                </div>
              </div>
            ) : (
              <div>
                {loading ? (
                  <div className="text-center py-4">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">加载中...</span>
                    </div>
                    <p className="mt-2">加载模块中...</p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-striped table-hover">
                      <thead className="table-dark">
                        <tr>
                          <th>模块名称</th>
                          <th>版本</th>
                          <th>分类</th>
                          <th>类型</th>
                          <th>依赖关系</th>
                          <th>状态</th>
                          <th>操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {modules.length === 0 ? (
                          <tr>
                            <td colSpan="7" className="text-center text-muted">
                              无模块配置
                            </td>
                          </tr>
                        ) : (
                          modules.map(module => (
                            <tr
                              key={module.module_id}
                              style={{
                                opacity: module.enabled ? 1 : 0.6,
                                backgroundColor: module.enabled ? 'transparent' : '#f5f5f5',
                              }}
                              title={!module.enabled ? `${module.module_name} 模块已禁用，启用后可使用相关菜单和功能` : ''}
                            >
                              <td>
                                {!module.enabled && (
                                  <Tooltip title="该模块已禁用，启用后可使用相关菜单和功能">
                                    <span style={{ marginRight: 8 }}>{module.module_name}</span>
                                  </Tooltip>
                                )}
                                {module.enabled && module.module_name}
                              </td>
                              <td>{module.version}</td>
                              <td>{module.category}</td>
                              <td>{module.type}</td>
                              <td>
                                <span className="text-sm">
                                  {getDependencyText(module.module_id)}
                                </span>
                              </td>
                              <td>
                                <span
                                  className={`badge ${module.enabled ? 'bg-success' : 'bg-secondary'}`}
                                >
                                  {module.enabled ? '已启用' : '已禁用'}
                                </span>
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <Tooltip title={module.enabled ? '点击禁用该模块' : '点击启用该模块'}>
                                    <div className="form-check form-switch me-3">
                                      <input
                                        className="form-check-input"
                                        type="checkbox"
                                        checked={module.enabled}
                                        onChange={() => toggleModuleEnabled(module.module_id)}
                                        disabled={dependencyCheckLoading}
                                      />
                                    </div>
                                  </Tooltip>
                                  <Tooltip title={!module.enabled ? '请先启用该模块' : ''}>
                                    <button
                                      className={`btn btn-sm btn-info ${!module.enabled ? 'disabled' : ''}`}
                                      onClick={() => handleModuleSelect(module)}
                                      disabled={!module.enabled}
                                    >
                                      配置菜单
                                    </button>
                                  </Tooltip>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TenantModuleConfig;
