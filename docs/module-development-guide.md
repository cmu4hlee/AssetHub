# 模块化开发规范

## 1. 模块概述

### 1.1 模块定义
模块是系统中可独立部署、配置和管理的功能单元。每个模块具有明确的职责边界、标准化的接口和完整的生命周期管理。

### 1.2 模块分类

#### 按功能分类
- **核心模块**: 系统基础功能，如用户管理、权限管理、租户管理
- **业务模块**: 特定业务功能，如资产管理、维护管理、采购管理
- **扩展模块**: 可选功能，如AI分析、报表导出、第三方集成
- **工具模块**: 辅助功能，如日志管理、备份恢复、性能监控

#### 按类型分类
- **系统模块**: 由系统提供的内置模块
- **自定义模块**: 用户或第三方开发的自定义模块
- **集成模块**: 与外部系统集成的模块

### 1.3 模块版本规范

采用语义化版本号（Semantic Versioning）：
- **主版本号（MAJOR）**: 不兼容的API修改
- **次版本号（MINOR）**: 向下兼容的功能性新增
- **修订号（PATCH）**: 向下兼容的问题修正

示例：`1.2.3`
- `1`: 主版本号
- `2`: 次版本号
- `3`: 修订号

## 2. 模块结构规范

### 2.1 后端模块结构

```
backend/modules/{module-id}/
├── config/
│   ├── module.config.js       # 模块配置
│   ├── permissions.js         # 权限定义
│   └── routes.js            # 路由配置
├── controllers/
│   └── {feature}.controller.js
├── services/
│   └── {feature}.service.js
├── models/
│   └── {feature}.model.js
├── routes/
│   └── {feature}.routes.js
├── middleware/
│   └── {feature}.middleware.js
├── database/
│   └── migrations/
│       └── create_{table}_table.sql
├── tests/
│   ├── unit/
│   │   └── {feature}.test.js
│   └── integration/
│       └── {feature}.test.js
├── package.json              # 模块依赖
├── README.md                # 模块文档
└── index.js                 # 模块入口
```

### 2.2 前端模块结构

```
frontend/src/modules/{module-id}/
├── components/
│   ├── {Feature}List.jsx
│   ├── {Feature}Form.jsx
│   └── {Feature}Detail.jsx
├── pages/
│   ├── {Feature}List.jsx
│   ├── {Feature}Form.jsx
│   └── {Feature}Detail.jsx
├── services/
│   └── {feature}.api.js
├── store/
│   ├── actions.js
│   ├── reducers.js
│   └── selectors.js
├── utils/
│   └── {feature}.helper.js
├── constants/
│   └── {feature}.constants.js
├── styles/
│   └── {feature}.css
├── tests/
│   ├── components/
│   │   └── {Feature}.test.jsx
│   └── utils/
│       └── {feature}.test.js
├── package.json
├── README.md
└── index.js
```

## 3. 模块元数据规范

### 3.1 模块基本信息

```javascript
{
  id: 'asset-management',
  name: '资产管理',
  version: '1.2.3',
  description: '提供资产的完整生命周期管理功能，包括资产入库、使用、维护、调拨、报废等。',
  category: 'business',
  type: 'system',
  status: 'stable',
  author: 'System Team',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-15T00:00:00Z'
}
```

### 3.2 依赖关系

```javascript
{
  dependencies: [
    {
      module_id: 'user-management',
      dependency_type: 'required',
      min_version: '1.0.0',
      max_version: '2.0.0'
    },
    {
      module_id: 'department-management',
      dependency_type: 'optional',
      min_version: '1.0.0'
    }
  ],
  compatibility: [
    {
      type: 'mutually_exclusive',
      modules: ['module-a', 'module-b'],
      description: '这两个模块不能同时启用'
    },
    {
      type: 'required_together',
      modules: ['module-c', 'module-d'],
      description: '这两个模块需要一起启用'
    }
  ]
}
```

### 3.3 前端配置

```javascript
{
  frontend_config: {
    menu_routes: [
      {
        key: '/assets',
        icon: 'AppstoreOutlined',
        label: '资产管理',
        path: '/assets',
        component: 'AssetList',
        permissions: ['asset:read']
      },
      {
        key: '/assets/new',
        icon: 'PlusOutlined',
        label: '新增资产',
        path: '/assets/new',
        component: 'AssetForm',
        permissions: ['asset:create'],
        parent: '/assets'
      }
    ],
    components: [
      {
        name: 'AssetList',
        path: 'components/AssetList',
        export: 'default'
      },
      {
        name: 'AssetForm',
        path: 'components/AssetForm',
        export: 'default'
      }
    ],
    permissions: [
      'asset:read',
      'asset:create',
      'asset:update',
      'asset:delete'
    ]
  }
}
```

### 3.4 后端配置

```javascript
{
  backend_config: {
    api_endpoints: [
      {
        method: 'GET',
        path: '/api/assets',
        handler: 'getAssets',
        permissions: ['asset:read']
      },
      {
        method: 'POST',
        path: '/api/assets',
        handler: 'createAsset',
        permissions: ['asset:create']
      }
    ],
    database_tables: [
      'assets',
      'asset_categories',
      'asset_locations'
    ],
    services: [
      {
        name: 'AssetService',
        path: 'services/asset.service'
      }
    ],
    permissions: [
      'asset:read',
      'asset:create',
      'asset:update',
      'asset:delete'
    ]
  }
}
```

### 3.5 配置项定义

```javascript
{
  config_schema: [
    {
      key: 'enable_auto_numbering',
      name: '启用自动编号',
      type: 'boolean',
      required: false,
      default: true,
      description: '是否启用资产自动编号功能'
    },
    {
      key: 'number_prefix',
      name: '编号前缀',
      type: 'string',
      required: false,
      default: 'ASSET',
      description: '资产编号的前缀',
      validation: {
        pattern: '^[A-Z]{2,10}$',
        message: '前缀必须为2-10个大写字母'
      }
    },
    {
      key: 'approval_required',
      name: '需要审批',
      type: 'select',
      required: false,
      default: 'all',
      description: '哪些操作需要审批',
      options: [
        { label: '全部操作', value: 'all' },
        { label: '仅删除操作', value: 'delete_only' },
        { label: '不需要审批', value: 'none' }
      ]
    },
    {
      key: 'max_assets_per_department',
      name: '部门最大资产数',
      type: 'number',
      required: false,
      default: 1000,
      description: '每个部门最多可以拥有的资产数量',
      validation: {
        min: 1,
        max: 10000
      }
    }
  ],
  default_config: {
    enable_auto_numbering: true,
    number_prefix: 'ASSET',
    approval_required: 'all',
    max_assets_per_department: 1000
  }
}
```

### 3.6 接口定义

```javascript
{
  interfaces: [
    {
      name: 'IAssetService',
      type: 'service',
      methods: [
        {
          name: 'getAsset',
          input: { assetCode: 'string' },
          output: 'Asset',
          description: '根据资产编码获取资产信息'
        },
        {
          name: 'createAsset',
          input: { assetData: 'AssetData' },
          output: 'Asset',
          description: '创建新资产'
        }
      ]
    },
    {
      name: 'IAssetRepository',
      type: 'repository',
      methods: [
        {
          name: 'findByCode',
          input: { code: 'string' },
          output: 'Asset',
          description: '根据编码查找资产'
        }
      ]
    }
  ]
}
```

## 4. 模块开发规范

### 4.1 命名规范

#### 模块ID
- 使用小写字母、数字和连字符
- 格式：`{category}-{feature}`
- 示例：`asset-management`, `maintenance-preventive`, `report-export`

#### 文件命名
- 后端：使用小写字母和下划线
  - 示例：`asset_controller.js`, `asset_service.js`
- 前端：使用大驼峰命名法
  - 示例：`AssetList.jsx`, `AssetForm.jsx`

#### 函数/方法命名
- 使用小驼峰命名法
- 动词开头，清晰表达意图
- 示例：`getAssetById`, `createAsset`, `updateAssetStatus`

#### 变量命名
- 使用小驼峰命名法
- 布尔值以`is`、`has`、`can`开头
- 示例：`assetData`, `isLoading`, `hasPermission`

#### 常量命名
- 使用大写字母和下划线
- 示例：`MAX_ASSETS_PER_DEPARTMENT`, `DEFAULT_PAGE_SIZE`

### 4.2 代码风格规范

#### JavaScript/Node.js
- 使用ES6+语法
- 使用async/await处理异步操作
- 使用箭头函数
- 使用解构赋值
- 使用模板字符串

#### React
- 使用函数组件和Hooks
- 使用TypeScript类型定义（可选）
- 遵循单一职责原则
- 组件拆分合理

#### SQL
- 使用大写关键字
- 使用反引号包裹表名和字段名
- 添加适当的注释
- 使用索引优化查询

### 4.3 错误处理规范

#### 后端错误处理
```javascript
try {
  const result = await someOperation();
  return { success: true, data: result };
} catch (error) {
  console.error('操作失败:', error);
  return {
    success: false,
    message: '操作失败',
    error: error.message
  };
}
```

#### 前端错误处理
```javascript
try {
  const response = await api.getAssets();
  if (response.success) {
    setAssets(response.data);
  } else {
    message.error(response.message || '获取资产列表失败');
  }
} catch (error) {
  console.error('获取资产列表失败:', error);
  message.error('网络错误，请稍后重试');
}
```

### 4.4 日志规范

#### 日志级别
- **ERROR**: 错误信息，需要立即处理
- **WARN**: 警告信息，需要关注
- **INFO**: 一般信息，记录系统运行状态
- **DEBUG**: 调试信息，用于问题排查

#### 日志格式
```javascript
console.log('[模块名] [级别] 操作描述', data);
// 示例
console.log('[AssetManagement] [INFO] 创建资产', assetData);
console.error('[AssetManagement] [ERROR] 创建资产失败', error);
```

## 5. 模块测试规范

### 5.1 单元测试

#### 后端单元测试
```javascript
describe('AssetService', () => {
  describe('getAssetById', () => {
    it('应该返回正确的资产信息', async () => {
      const asset = await assetService.getAssetById('ASSET001');
      expect(asset).toBeDefined();
      expect(asset.code).toBe('ASSET001');
    });

    it('当资产不存在时应该返回null', async () => {
      const asset = await assetService.getAssetById('NONEXISTENT');
      expect(asset).toBeNull();
    });
  });
});
```

#### 前端单元测试
```javascript
describe('AssetList', () => {
  it('应该渲染资产列表', () => {
    const assets = [
      { id: 1, name: '资产1', code: 'ASSET001' },
      { id: 2, name: '资产2', code: 'ASSET002' }
    ];
    render(<AssetList assets={assets} />);
    expect(screen.getByText('资产1')).toBeInTheDocument();
    expect(screen.getByText('资产2')).toBeInTheDocument();
  });
});
```

### 5.2 集成测试

```javascript
describe('Asset API Integration', () => {
  it('应该能够创建并获取资产', async () => {
    const createResponse = await api.createAsset({
      name: '测试资产',
      code: 'TEST001'
    });
    expect(createResponse.success).toBe(true);

    const getResponse = await api.getAsset('TEST001');
    expect(getResponse.success).toBe(true);
    expect(getResponse.data.name).toBe('测试资产');
  });
});
```

### 5.3 测试覆盖率要求

- 单元测试覆盖率 ≥ 80%
- 关键业务逻辑覆盖率 ≥ 95%
- 集成测试覆盖主要业务流程

## 6. 模块文档规范

### 6.1 README.md模板

```markdown
# {模块名称}

## 模块概述
{模块的功能描述}

## 版本信息
- 当前版本: {version}
- 最后更新: {updated_at}

## 功能特性
- {功能1}
- {功能2}
- {功能3}

## 依赖关系
- {依赖模块1} (required)
- {依赖模块2} (optional)

## 配置说明
{配置项说明}

## API接口
{API接口文档}

## 使用示例
{使用示例代码}

## 常见问题
{常见问题解答}

## 更新日志
### {version}
- {变更1}
- {变更2}
```

### 6.2 API文档规范

```javascript
/**
 * 获取资产列表
 * @route GET /api/assets
 * @param {Object} params - 查询参数
 * @param {number} params.page - 页码，默认1
 * @param {number} params.pageSize - 每页数量，默认10
 * @param {string} params.keyword - 搜索关键词
 * @returns {Promise<Object>} 返回资产列表
 * @returns {boolean} success - 是否成功
 * @returns {Array} data - 资产列表
 * @returns {number} total - 总数量
 * @example
 * const result = await assetAPI.getAssets({ page: 1, pageSize: 10 });
 */
```

## 7. 模块发布规范

### 7.1 发布前检查清单

- [ ] 代码审查通过
- [ ] 单元测试全部通过
- [ ] 集成测试全部通过
- [ ] 测试覆盖率达标
- [ ] 文档完整且准确
- [ ] 版本号更新
- [ ] 变更日志更新
- [ ] 依赖关系检查
- [ ] 兼容性测试

### 7.2 版本发布流程

1. **开发阶段**
   - 创建功能分支
   - 开发新功能或修复问题
   - 编写测试
   - 提交代码审查

2. **测试阶段**
   - 运行单元测试
   - 运行集成测试
   - 进行兼容性测试
   - 修复发现的问题

3. **发布阶段**
   - 更新版本号
   - 更新变更日志
   - 合并到主分支
   - 打包发布
   - 更新模块注册表

### 7.3 变更日志格式

```markdown
## [1.2.3] - 2024-01-15

### Added
- 新增资产批量导入功能
- 新增资产二维码生成功能

### Changed
- 优化资产列表查询性能
- 改进资产表单验证逻辑

### Fixed
- 修复资产编辑时分类丢失的问题
- 修复资产删除时的权限检查问题

### Deprecated
- 废弃旧的资产编号生成方式

### Removed
- 移除不再使用的资产标签功能

### Security
- 修复资产导出的权限漏洞
```

## 8. 模块维护规范

### 8.1 问题修复流程

1. **问题报告**
   - 收集问题详细信息
   - 记录复现步骤
   - 提交问题跟踪

2. **问题分析**
   - 定位问题根因
   - 评估影响范围
   - 制定修复方案

3. **问题修复**
   - 编写修复代码
   - 编写测试用例
   - 验证修复效果

4. **发布修复**
   - 更新版本号（PATCH）
   - 更新变更日志
   - 发布补丁版本

### 8.2 性能优化规范

- 定期进行性能分析
- 识别性能瓶颈
- 优化数据库查询
- 优化前端渲染
- 使用缓存机制

### 8.3 安全规范

- 定期进行安全审计
- 修复已知安全漏洞
- 遵循最小权限原则
- 加密敏感数据
- 记录安全日志

## 9. 模块最佳实践

### 9.1 设计原则

- **单一职责**: 每个模块只负责一个业务领域
- **开闭原则**: 对扩展开放，对修改关闭
- **依赖倒置**: 依赖抽象而非具体实现
- **接口隔离**: 使用最小化接口

### 9.2 性能优化

- 使用数据库索引
- 实现查询缓存
- 优化前端渲染
- 使用懒加载
- 实现分页加载

### 9.3 可维护性

- 编写清晰的代码
- 添加必要的注释
- 保持代码简洁
- 遵循DRY原则
- 定期重构

### 9.4 可扩展性

- 设计灵活的配置
- 提供扩展点
- 支持插件机制
- 预留接口
- 文档完善

## 10. 模块示例

### 10.1 简单模块示例

```javascript
// backend/modules/simple-module/config/module.config.js
module.exports = {
  id: 'simple-module',
  name: '简单模块',
  version: '1.0.0',
  description: '一个简单的示例模块',
  category: 'example',
  type: 'system',
  status: 'stable',
  author: 'System Team',
  dependencies: [],
  compatibility: [],
  frontend_config: {
    menu_routes: [
      {
        key: '/simple',
        icon: 'AppstoreOutlined',
        label: '简单模块',
        path: '/simple',
        component: 'SimpleList'
      }
    ],
    components: [
      {
        name: 'SimpleList',
        path: 'components/SimpleList',
        export: 'default'
      }
    ],
    permissions: ['simple:read']
  },
  backend_config: {
    api_endpoints: [
      {
        method: 'GET',
        path: '/api/simple',
        handler: 'getSimpleData',
        permissions: ['simple:read']
      }
    ],
    database_tables: ['simple_data'],
    services: [
      {
        name: 'SimpleService',
        path: 'services/simple.service'
      }
    ],
    permissions: ['simple:read']
  },
  config_schema: [],
  default_config: {},
  interfaces: []
};
```

### 10.2 复杂模块示例

```javascript
// backend/modules/complex-module/config/module.config.js
module.exports = {
  id: 'complex-module',
  name: '复杂模块',
  version: '2.1.0',
  description: '一个复杂的示例模块，包含多个功能和依赖',
  category: 'business',
  type: 'system',
  status: 'stable',
  author: 'System Team',
  dependencies: [
    {
      module_id: 'user-management',
      dependency_type: 'required',
      min_version: '1.0.0',
      max_version: '2.0.0'
    },
    {
      module_id: 'department-management',
      dependency_type: 'optional',
      min_version: '1.0.0'
    }
  ],
  compatibility: [
    {
      type: 'mutually_exclusive',
      modules: ['module-a', 'module-b'],
      description: '这两个模块不能同时启用'
    }
  ],
  frontend_config: {
    menu_routes: [
      {
        key: '/complex',
        icon: 'AppstoreOutlined',
        label: '复杂模块',
        path: '/complex',
        component: 'ComplexList',
        permissions: ['complex:read']
      },
      {
        key: '/complex/new',
        icon: 'PlusOutlined',
        label: '新增',
        path: '/complex/new',
        component: 'ComplexForm',
        permissions: ['complex:create'],
        parent: '/complex'
      }
    ],
    components: [
      {
        name: 'ComplexList',
        path: 'components/ComplexList',
        export: 'default'
      },
      {
        name: 'ComplexForm',
        path: 'components/ComplexForm',
        export: 'default'
      },
      {
        name: 'ComplexDetail',
        path: 'components/ComplexDetail',
        export: 'default'
      }
    ],
    permissions: [
      'complex:read',
      'complex:create',
      'complex:update',
      'complex:delete'
    ]
  },
  backend_config: {
    api_endpoints: [
      {
        method: 'GET',
        path: '/api/complex',
        handler: 'getComplexData',
        permissions: ['complex:read']
      },
      {
        method: 'POST',
        path: '/api/complex',
        handler: 'createComplexData',
        permissions: ['complex:create']
      },
      {
        method: 'PUT',
        path: '/api/complex/:id',
        handler: 'updateComplexData',
        permissions: ['complex:update']
      },
      {
        method: 'DELETE',
        path: '/api/complex/:id',
        handler: 'deleteComplexData',
        permissions: ['complex:delete']
      }
    ],
    database_tables: [
      'complex_data',
      'complex_items',
      'complex_logs'
    ],
    services: [
      {
        name: 'ComplexService',
        path: 'services/complex.service'
      },
      {
        name: 'ComplexItemService',
        path: 'services/complex-item.service'
      }
    ],
    permissions: [
      'complex:read',
      'complex:create',
      'complex:update',
      'complex:delete'
    ]
  },
  config_schema: [
    {
      key: 'enable_feature_a',
      name: '启用功能A',
      type: 'boolean',
      required: false,
      default: true,
      description: '是否启用功能A'
    },
    {
      key: 'max_items',
      name: '最大项目数',
      type: 'number',
      required: false,
      default: 100,
      description: '每个记录的最大项目数',
      validation: {
        min: 1,
        max: 1000
      }
    },
    {
      key: 'notification_type',
      name: '通知类型',
      type: 'select',
      required: false,
      default: 'email',
      description: '选择通知方式',
      options: [
        { label: '邮件', value: 'email' },
        { label: '短信', value: 'sms' },
        { label: '系统通知', value: 'system' }
      ]
    }
  ],
  default_config: {
    enable_feature_a: true,
    max_items: 100,
    notification_type: 'email'
  },
  interfaces: [
    {
      name: 'IComplexService',
      type: 'service',
      methods: [
        {
          name: 'getComplexData',
          input: { id: 'string' },
          output: 'ComplexData',
          description: '获取复杂数据'
        },
        {
          name: 'createComplexData',
          input: { data: 'ComplexDataInput' },
          output: 'ComplexData',
          description: '创建复杂数据'
        }
      ]
    }
  ]
};
```

## 11. 附录

### 11.1 术语表

- **模块**: 系统中可独立部署、配置和管理的功能单元
- **依赖**: 模块之间存在的依赖关系
- **兼容性**: 模块之间的版本兼容规则
- **配置**: 模块的运行时配置参数
- **接口**: 模块对外提供的服务接口
- **生命周期**: 模块从创建到销毁的完整过程

### 11.2 参考资料

- [语义化版本规范](https://semver.org/lang/zh-CN/)
- [RESTful API设计指南](https://restfulapi.net/)
- [React最佳实践](https://react.dev/learn)
- [Node.js最佳实践](https://github.com/goldbergyoni/nodebestpractices)

### 11.3 工具推荐

- **代码质量**: ESLint, Prettier
- **测试框架**: Jest, Mocha, Chai
- **文档生成**: JSDoc, Swagger
- **版本管理**: Git, Semantic Release
- **CI/CD**: GitHub Actions, GitLab CI