# 模块模板

## 使用说明

本模板用于快速创建新的功能模块。请按照以下步骤操作：

1. 复制本模板到新模块目录
2. 替换所有占位符（如 `{module-id}`、`{ModuleName}` 等）
3. 根据实际需求修改配置和代码
4. 运行测试确保功能正常
5. 更新文档和版本信息

## 后端模块模板

### 目录结构

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
├── package.json
├── README.md
└── index.js
```

### 模块配置模板

```javascript
// config/module.config.js
module.exports = {
  // 基本信息
  id: '{module-id}',
  name: '{模块名称}',
  version: '1.0.0',
  description: '{模块描述}',
  category: 'business',
  type: 'system',
  status: 'stable',
  author: 'Your Name',

  // 依赖关系
  dependencies: [
    // {
    //   module_id: 'user-management',
    //   dependency_type: 'required',
    //   min_version: '1.0.0',
    //   max_version: '2.0.0'
    // }
  ],

  // 兼容性规则
  compatibility: [
    // {
    //   type: 'mutually_exclusive',
    //   modules: ['module-a', 'module-b'],
    //   description: '这两个模块不能同时启用'
    // }
  ],

  // 前端配置
  frontend_config: {
    menu_routes: [
      {
        key: '/{route-path}',
        icon: 'AppstoreOutlined',
        label: '{菜单名称}',
        path: '/{route-path}',
        component: '{ComponentName}',
        permissions: ['{permission}:read']
      }
    ],
    components: [
      {
        name: '{ComponentName}',
        path: 'components/{ComponentName}',
        export: 'default'
      }
    ],
    permissions: [
      '{permission}:read',
      '{permission}:create',
      '{permission}:update',
      '{permission}:delete'
    ]
  },

  // 后端配置
  backend_config: {
    api_endpoints: [
      {
        method: 'GET',
        path: '/api/{route-path}',
        handler: 'get{Feature}s',
        permissions: ['{permission}:read']
      },
      {
        method: 'POST',
        path: '/api/{route-path}',
        handler: 'create{Feature}',
        permissions: ['{permission}:create']
      },
      {
        method: 'PUT',
        path: '/api/{route-path}/:id',
        handler: 'update{Feature}',
        permissions: ['{permission}:update']
      },
      {
        method: 'DELETE',
        path: '/api/{route-path}/:id',
        handler: 'delete{Feature}',
        permissions: ['{permission}:delete']
      }
    ],
    database_tables: [
      '{table_name}'
    ],
    services: [
      {
        name: '{Feature}Service',
        path: 'services/{feature}.service'
      }
    ],
    permissions: [
      '{permission}:read',
      '{permission}:create',
      '{permission}:update',
      '{permission}:delete'
    ]
  },

  // 配置项定义
  config_schema: [
    {
      key: 'enable_feature',
      name: '启用功能',
      type: 'boolean',
      required: false,
      default: true,
      description: '是否启用该功能'
    }
  ],
  default_config: {
    enable_feature: true
  },

  // 接口定义
  interfaces: [
    {
      name: 'I{Feature}Service',
      type: 'service',
      methods: [
        {
          name: 'get{Feature}ById',
          input: { id: 'number' },
          output: '{Feature}',
          description: '根据ID获取{功能}'
        },
        {
          name: 'create{Feature}',
          input: { data: '{Feature}Data' },
          output: '{Feature}',
          description: '创建{功能}'
        }
      ]
    }
  ]
};
```

### 控制器模板

```javascript
// controllers/{feature}.controller.js
const { FeatureService } = require('../services/{feature}.service');

class {Feature}Controller {
  async get{Feature}s(req, res) {
    try {
      const { page = 1, pageSize = 10, keyword } = req.query;
      const result = await {Feature}Service.get{Feature}s({
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        keyword
      });
      res.json({
        success: true,
        data: result.data,
        total: result.total,
        message: '获取{功能}列表成功'
      });
    } catch (error) {
      console.error('获取{功能}列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取{功能}列表失败',
        error: error.message
      });
    }
  }

  async get{Feature}ById(req, res) {
    try {
      const { id } = req.params;
      const result = await {Feature}Service.get{Feature}ById(id);
      if (!result) {
        return res.status(404).json({
          success: false,
          message: '{功能}不存在'
        });
      }
      res.json({
        success: true,
        data: result,
        message: '获取{功能}成功'
      });
    } catch (error) {
      console.error('获取{功能}失败:', error);
      res.status(500).json({
        success: false,
        message: '获取{功能}失败',
        error: error.message
      });
    }
  }

  async create{Feature}(req, res) {
    try {
      const data = req.body;
      const result = await {Feature}Service.create{Feature}(data);
      res.json({
        success: true,
        data: result,
        message: '创建{功能}成功'
      });
    } catch (error) {
      console.error('创建{功能}失败:', error);
      res.status(500).json({
        success: false,
        message: '创建{功能}失败',
        error: error.message
      });
    }
  }

  async update{Feature}(req, res) {
    try {
      const { id } = req.params;
      const data = req.body;
      const result = await {Feature}Service.update{Feature}(id, data);
      if (!result) {
        return res.status(404).json({
          success: false,
          message: '{功能}不存在'
        });
      }
      res.json({
        success: true,
        data: result,
        message: '更新{功能}成功'
      });
    } catch (error) {
      console.error('更新{功能}失败:', error);
      res.status(500).json({
        success: false,
        message: '更新{功能}失败',
        error: error.message
      });
    }
  }

  async delete{Feature}(req, res) {
    try {
      const { id } = req.params;
      const result = await {Feature}Service.delete{Feature}(id);
      if (!result) {
        return res.status(404).json({
          success: false,
          message: '{功能}不存在'
        });
      }
      res.json({
        success: true,
        message: '删除{功能}成功'
      });
    } catch (error) {
      console.error('删除{功能}失败:', error);
      res.status(500).json({
        success: false,
        message: '删除{功能}失败',
        error: error.message
      });
    }
  }
}

module.exports = new {Feature}Controller();
```

### 服务模板

```javascript
// services/{feature}.service.js
const db = require('../../config/database');

class {Feature}Service {
  async get{Feature}s({ page, pageSize, keyword }) {
    try {
      let whereClause = 'WHERE 1=1';
      const params = [];

      if (keyword) {
        whereClause += ' AND name LIKE ?';
        params.push(`%${keyword}%`);
      }

      const offset = (page - 1) * pageSize;

      const [data] = await db.execute(
        `SELECT * FROM {table_name} ${whereClause} ORDER BY id DESC LIMIT ? OFFSET ?`,
        [...params, pageSize, offset]
      );

      const [countResult] = await db.execute(
        `SELECT COUNT(*) as total FROM {table_name} ${whereClause}`,
        params
      );

      return {
        data,
        total: countResult[0].total
      };
    } catch (error) {
      console.error('获取{功能}列表失败:', error);
      throw error;
    }
  }

  async get{Feature}ById(id) {
    try {
      const [data] = await db.execute(
        'SELECT * FROM {table_name} WHERE id = ?',
        [id]
      );
      return data[0] || null;
    } catch (error) {
      console.error('获取{功能}失败:', error);
      throw error;
    }
  }

  async create{Feature}(data) {
    try {
      const [result] = await db.execute(
        `INSERT INTO {table_name} ({fields}) VALUES ({placeholders})`,
        [values]
      );
      return await this.get{Feature}ById(result.insertId);
    } catch (error) {
      console.error('创建{功能}失败:', error);
      throw error;
    }
  }

  async update{Feature}(id, data) {
    try {
      const [result] = await db.execute(
        `UPDATE {table_name} SET {updates} WHERE id = ?`,
        [...values, id]
      );
      if (result.affectedRows === 0) {
        return null;
      }
      return await this.get{Feature}ById(id);
    } catch (error) {
      console.error('更新{功能}失败:', error);
      throw error;
    }
  }

  async delete{Feature}(id) {
    try {
      const [result] = await db.execute(
        'DELETE FROM {table_name} WHERE id = ?',
        [id]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error('删除{功能}失败:', error);
      throw error;
    }
  }
}

module.exports = { FeatureService };
```

### 路由模板

```javascript
// routes/{feature}.routes.js
const express = require('express');
const router = express.Router();
const { FeatureController } = require('../controllers/{feature}.controller');
const { authenticate } = require('../../middleware/auth');

router.get('/', authenticate, {Feature}Controller.get{Feature}s.bind({Feature}Controller));
router.get('/:id', authenticate, {Feature}Controller.get{Feature}ById.bind({Feature}Controller));
router.post('/', authenticate, {Feature}Controller.create{Feature}.bind({Feature}Controller));
router.put('/:id', authenticate, {Feature}Controller.update{Feature}.bind({Feature}Controller));
router.delete('/:id', authenticate, {Feature}Controller.delete{Feature}.bind({Feature}Controller));

module.exports = router;
```

### 数据库迁移模板

```sql
-- database/migrations/create_{table}_table.sql
-- 创建{表名}表
CREATE TABLE IF NOT EXISTS `{table_name}` (
  `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  `name` VARCHAR(255) NOT NULL COMMENT '名称',
  `description` TEXT COMMENT '描述',
  `status` VARCHAR(50) DEFAULT 'active' COMMENT '状态',
  `tenant_id` INT NOT NULL COMMENT '租户ID',
  `created_by` VARCHAR(100) COMMENT '创建人',
  `updated_by` VARCHAR(100) COMMENT '更新人',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP NOT NULL DEFAULT '0000-00-00 00:00:00' COMMENT '更新时间',
  INDEX `idx_tenant_id` (`tenant_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='{表描述}';
```

### 单元测试模板

```javascript
// tests/unit/{feature}.test.js
const { FeatureService } = require('../../services/{feature}.service');

describe('{Feature}Service', () => {
  describe('get{Feature}s', () => {
    it('应该返回{功能}列表', async () => {
      const result = await {Feature}Service.get{Feature}s({
        page: 1,
        pageSize: 10
      });
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('total');
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('应该支持关键词搜索', async () => {
      const result = await {Feature}Service.get{Feature}s({
        page: 1,
        pageSize: 10,
        keyword: 'test'
      });
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('total');
    });
  });

  describe('get{Feature}ById', () => {
    it('应该返回指定的{功能}', async () => {
      const result = await {Feature}Service.get{Feature}ById(1);
      expect(result).toBeDefined();
      expect(result.id).toBe(1);
    });

    it('当{功能}不存在时应该返回null', async () => {
      const result = await {Feature}Service.get{Feature}ById(999999);
      expect(result).toBeNull();
    });
  });

  describe('create{Feature}', () => {
    it('应该创建新的{功能}', async () => {
      const data = {
        name: '测试{功能}',
        description: '这是一个测试{功能}'
      };
      const result = await {Feature}Service.create{Feature}(data);
      expect(result).toBeDefined();
      expect(result.name).toBe(data.name);
    });
  });

  describe('update{Feature}', () => {
    it('应该更新{功能}', async () => {
      const data = {
        name: '更新后的{功能}'
      };
      const result = await {Feature}Service.update{Feature}(1, data);
      expect(result).toBeDefined();
      expect(result.name).toBe(data.name);
    });
  });

  describe('delete{Feature}', () => {
    it('应该删除{功能}', async () => {
      const result = await {Feature}Service.delete{Feature}(1);
      expect(result).toBe(true);
    });
  });
});
```

### 集成测试模板

```javascript
// tests/integration/{feature}.test.js
const request = require('supertest');
const app = require('../../../server');

describe('{Feature} API Integration Tests', () => {
  let authToken;
  let createdId;

  beforeAll(async () => {
    // 获取认证令牌
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'admin',
        password: 'admin123'
      });
    authToken = loginResponse.body.data.token;
  });

  describe('GET /api/{route-path}', () => {
    it('应该返回{功能}列表', async () => {
      const response = await request(app)
        .get('/api/{route-path}')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('POST /api/{route-path}', () => {
    it('应该创建新的{功能}', async () => {
      const data = {
        name: '测试{功能}',
        description: '这是一个测试{功能}'
      };

      const response = await request(app)
        .post('/api/{route-path}')
        .set('Authorization', `Bearer ${authToken}`)
        .send(data)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.name).toBe(data.name);
      createdId = response.body.data.id;
    });
  });

  describe('GET /api/{route-path}/:id', () => {
    it('应该返回指定的{功能}', async () => {
      const response = await request(app)
        .get(`/api/{route-path}/${createdId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.id).toBe(createdId);
    });
  });

  describe('PUT /api/{route-path}/:id', () => {
    it('应该更新{功能}', async () => {
      const data = {
        name: '更新后的{功能}'
      };

      const response = await request(app)
        .put(`/api/{route-path}/${createdId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(data)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.name).toBe(data.name);
    });
  });

  describe('DELETE /api/{route-path}/:id', () => {
    it('应该删除{功能}', async () => {
      const response = await request(app)
        .delete(`/api/{route-path}/${createdId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});
```

### README.md 模板

```markdown
# {模块名称}

## 模块概述
{模块的功能描述}

## 版本信息
- 当前版本: 1.0.0
- 最后更新: {date}

## 功能特性
- {功能1}
- {功能2}
- {功能3}

## 依赖关系
- {依赖模块1} (required)
- {依赖模块2} (optional)

## 配置说明

### 配置项

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| enable_feature | boolean | true | 是否启用该功能 |

## API接口

### 获取{功能}列表
```
GET /api/{route-path}
```

**请求参数:**
- page: 页码，默认1
- pageSize: 每页数量，默认10
- keyword: 搜索关键词

**响应示例:**
```json
{
  "success": true,
  "data": [...],
  "total": 100,
  "message": "获取{功能}列表成功"
}
```

### 创建{功能}
```
POST /api/{route-path}
```

**请求体:**
```json
{
  "name": "{功能名称}",
  "description": "{功能描述}"
}
```

### 更新{功能}
```
PUT /api/{route-path}/:id
```

### 删除{功能}
```
DELETE /api/{route-path}/:id
```

## 使用示例

### 后端使用示例
```javascript
const { FeatureService } = require('./services/{feature}.service');

// 获取{功能}列表
const result = await {Feature}Service.get{Feature}s({
  page: 1,
  pageSize: 10
});

// 创建{功能}
const new{Feature} = await {Feature}Service.create{Feature}({
  name: '测试{功能}',
  description: '这是一个测试{功能}'
});
```

### 前端使用示例
```javascript
import { featureAPI } from '../utils/api';

// 获取{功能}列表
const response = await featureAPI.get{Feature}s({ page: 1, pageSize: 10 });
if (response.success) {
  set{Feature}s(response.data);
}

// 创建{功能}
const response = await featureAPI.create{Feature}({
  name: '测试{功能}',
  description: '这是一个测试{功能}'
});
```

## 常见问题

### Q: 如何启用该模块？
A: 在模块管理页面找到该模块，点击启用开关即可。

### Q: 如何配置该模块？
A: 在模块管理页面点击配置按钮，根据配置项说明进行配置。

## 更新日志

### 1.0.0 - {date}
- 初始版本发布
- 实现基本的CRUD功能
- 实现搜索和分页功能

## 许可证
MIT License

## 作者
Your Name <your.email@example.com>
```

### package.json 模板

```json
{
  "name": "{module-id}",
  "version": "1.0.0",
  "description": "{模块描述}",
  "main": "index.js",
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  },
  "keywords": [
    "asset",
    "management"
  ],
  "author": "Your Name",
  "license": "MIT",
  "dependencies": {},
  "devDependencies": {
    "jest": "^29.0.0",
    "supertest": "^6.0.0"
  }
}
```

### index.js 模板

```javascript
// index.js - 模块入口文件
const moduleConfig = require('./config/module.config');
const routes = require('./routes/{feature}.routes');

/**
 * 模块初始化函数
 * @param {Object} app - Express应用实例
 * @param {Object} db - 数据库连接实例
 */
function init(app, db) {
  console.log(`[${moduleConfig.name}] 正在初始化模块...`);

  // 注册路由
  app.use('/api/{route-path}', routes);

  console.log(`[${moduleConfig.name}] 模块初始化完成`);
}

/**
 * 模块卸载函数
 */
function destroy() {
  console.log(`[${moduleConfig.name}] 正在卸载模块...`);

  // 清理资源

  console.log(`[${moduleConfig.name}] 模块卸载完成`);
}

module.exports = {
  config: moduleConfig,
  init,
  destroy
};
```

## 前端模块模板

### 目录结构

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

### 组件模板

```jsx
// components/{Feature}List.jsx
import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  message,
  Card,
  Row,
  Col,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { featureAPI } from '../../utils/api';
import { FEATURE_CONSTANTS } from '../constants/{feature}.constants';

const {Feature}List = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keyword, setKeyword] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchData();
  }, [page, pageSize, keyword]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await featureAPI.get{Feature}s({
        page,
        pageSize,
        keyword,
      });
      if (response.success) {
        setData(response.data);
        setTotal(response.total);
      } else {
        message.error(response.message || '获取{功能}列表失败');
      }
    } catch (error) {
      console.error('获取{功能}列表失败:', error);
      message.error('获取{功能}列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingItem(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    form.setFieldsValue(item);
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      setLoading(true);
      const response = await featureAPI.delete{Feature}(id);
      if (response.success) {
        message.success('删除成功');
        fetchData();
      } else {
        message.error(response.message || '删除失败');
      }
    } catch (error) {
      console.error('删除{功能}失败:', error);
      message.error('删除{功能}失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      let response;
      if (editingItem) {
        response = await featureAPI.update{Feature}(editingItem.id, values);
      } else {
        response = await featureAPI.create{Feature}(values);
      }

      if (response.success) {
        message.success(editingItem ? '更新成功' : '创建成功');
        setModalVisible(false);
        fetchData();
      } else {
        message.error(response.message || '操作失败');
      }
    } catch (error) {
      console.error('操作失败:', error);
      message.error('操作失败');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => (
        <span
          style={{
            color: status === FEATURE_CONSTANTS.STATUS.ACTIVE ? 'green' : 'red',
          }}
        >
          {status === FEATURE_CONSTANTS.STATUS.ACTIVE ? '启用' : '禁用'}
        </span>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card
        title="{功能}管理"
        extra={
          <Space>
            <Input.Search
              placeholder="搜索{功能}"
              allowClear
              enterButton={<SearchOutlined />}
              onSearch={setKeyword}
              style={{ width: 250 }}
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreate}
            >
              新增
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (page, pageSize) => {
              setPage(page);
              setPageSize(pageSize);
            },
          }}
        />
      </Card>

      <Modal
        title={editingItem ? '编辑{功能}' : '新增{功能}'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        confirmLoading={loading}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="名称"
            name="name"
            rules={[
              { required: true, message: '请输入名称' },
              { max: 100, message: '名称不能超过100个字符' },
            ]}
          >
            <Input placeholder="请输入名称" />
          </Form.Item>
          <Form.Item
            label="描述"
            name="description"
            rules={[{ max: 500, message: '描述不能超过500个字符' }]}
          >
            <Input.TextArea
              rows={4}
              placeholder="请输入描述"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default {Feature}List;
```

### API服务模板

```javascript
// services/{feature}.api.js
import api from '../api';

export const featureAPI = {
  get{Feature}s: (params) => api.get('/{route-path}', { params }),
  get{Feature}: (id) => api.get(`/{route-path}/${id}`),
  create{Feature}: (data) => api.post('/{route-path}', data),
  update{Feature}: (id, data) => api.put(`/{route-path}/${id}`, data),
  delete{Feature}: (id) => api.delete(`/{route-path}/${id}`),
};
```

### 常量模板

```javascript
// constants/{feature}.constants.js
export const FEATURE_CONSTANTS = {
  STATUS: {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
  },
  PAGE_SIZE_OPTIONS: [10, 20, 50, 100],
};
```

### 测试模板

```jsx
// tests/components/{Feature}.test.jsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import {Feature}List from '../components/{Feature}List';
import { featureAPI } from '../../utils/api';

jest.mock('../../utils/api');

describe('{Feature}List', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应该渲染{功能}列表', async () => {
    const mockData = [
      { id: 1, name: '{功能}1', description: '描述1', status: 'active' },
      { id: 2, name: '{功能}2', description: '描述2', status: 'active' },
    ];

    featureAPI.get{Feature}s.mockResolvedValue({
      success: true,
      data: mockData,
      total: 2,
    });

    render(<{Feature}List />);

    await waitFor(() => {
      expect(screen.getByText('{功能}1')).toBeInTheDocument();
      expect(screen.getByText('{功能}2')).toBeInTheDocument();
    });
  });

  it('应该能够搜索{功能}', async () => {
    featureAPI.get{Feature}s.mockResolvedValue({
      success: true,
      data: [],
      total: 0,
    });

    render(<{Feature}List />);

    const searchInput = screen.getByPlaceholderText('搜索{功能}');
    fireEvent.change(searchInput, { target: { value: 'test' } });
    fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(featureAPI.get{Feature}s).toHaveBeenCalledWith({
        page: 1,
        pageSize: 10,
        keyword: 'test',
      });
    });
  });
});
```

## 快速开始指南

### 1. 创建新模块

```bash
# 复制模板
cp -r module-template backend/modules/your-new-module

# 替换占位符
cd backend/modules/your-new-module
find . -type f -exec sed -i 's/{module-id}/your-new-module/g' {} \;
find . -type f -exec sed -i 's/{ModuleName}/YourNewModule/g' {} \;
```

### 2. 配置模块

编辑 `config/module.config.js`，设置模块的基本信息、依赖关系、配置项等。

### 3. 实现功能

根据实际需求实现控制器、服务、路由等代码。

### 4. 创建数据库表

运行数据库迁移脚本创建所需的表。

### 5. 编写测试

编写单元测试和集成测试，确保功能正常。

### 6. 更新文档

更新 README.md 文档，说明模块的功能和使用方法。

### 7. 注册模块

在系统中注册模块，使其可以被启用和配置。

## 注意事项

1. **命名规范**: 严格遵循命名规范，保持代码一致性
2. **错误处理**: 所有API调用都应该有适当的错误处理
3. **日志记录**: 记录关键操作和错误信息
4. **测试覆盖**: 确保测试覆盖率达到要求
5. **文档完整**: 保持文档的完整性和准确性
6. **版本管理**: 使用语义化版本号管理模块版本
7. **依赖管理**: 明确声明模块的依赖关系
8. **性能优化**: 注意查询性能和前端渲染性能
9. **安全考虑**: 遵循安全最佳实践，防止安全漏洞
10. **兼容性**: 确保与系统其他模块的兼容性

## 获取帮助

如果在开发过程中遇到问题，请参考：

- [模块化开发规范](./module-development-guide.md)
- [模块架构设计文档](./modular-architecture-design.md)
- 系统技术文档

## 许可证

MIT License