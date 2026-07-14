const swaggerJsdoc = require('swagger-jsdoc');
const path = require('path');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'AssetHub API',
      version: '1.0.0',
      description: '资产管理系统后端 API 文档',
      contact: {
        name: 'API Support',
        email: 'support@example.com',
      },
      license: {
        name: 'ISC',
        url: 'https://opensource.org/licenses/ISC',
      },
    },
    servers: [
      {
        url: (() => {
          const config = require('./app.config');
          const protocol = config.server.https ? 'https' : 'http';
          const host = config.server.host === '0.0.0.0' ? 'localhost' : config.server.host;
          return `${protocol}://${host}:${config.server.port}`;
        })(),
        description: '开发环境',
      },
      {
        url: 'https://api.example.com',
        description: '生产环境',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT 认证令牌，格式：Bearer {token}',
        },
      },
      schemas: {
        // 通用响应结构
        SuccessResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            message: {
              type: 'string',
              example: '操作成功',
            },
            data: {
              type: 'object',
            },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            message: {
              type: 'string',
              example: '操作失败',
            },
            error: {
              type: 'string',
              example: '错误详情',
            },
          },
        },
        // 分页响应
        PaginationResponse: {
          type: 'object',
          properties: {
            page: {
              type: 'integer',
              example: 1,
            },
            pageSize: {
              type: 'integer',
              example: 20,
            },
            total: {
              type: 'integer',
              example: 100,
            },
            totalPages: {
              type: 'integer',
              example: 5,
            },
          },
        },
        // 资产模型
        Asset: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1,
            },
            asset_code: {
              type: 'string',
              example: 'ZC20240101001',
            },
            asset_name: {
              type: 'string',
              example: 'CT扫描仪',
            },
            brand: {
              type: 'string',
              example: '西门子',
            },
            model: {
              type: 'string',
              example: 'SOMATOM Definition AS',
            },
            asset_type: {
              type: 'string',
              example: '医疗设备',
            },
            status: {
              type: 'string',
              example: '在用',
            },
            department: {
              type: 'string',
              example: '放射科',
            },
            location: {
              type: 'string',
              example: '一楼CT室',
            },
          },
        },
        // 技术资料模型
        TechnicalDocument: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1,
            },
            title: {
              type: 'string',
              example: 'CT设备操作手册',
            },
            file_name: {
              type: 'string',
              example: 'CT操作手册.pdf',
            },
            file_path: {
              type: 'string',
              example: '/uploads/technical-documents/xxx.pdf',
            },
            category: {
              type: 'string',
              example: '使用手册',
            },
            brand: {
              type: 'string',
              example: '西门子',
            },
            model: {
              type: 'string',
              example: 'SOMATOM Definition AS',
            },
            review_status: {
              type: 'string',
              enum: ['pending', 'approved', 'rejected'],
              example: 'approved',
            },
            uploaded_by: {
              type: 'string',
              example: '张三',
            },
            upload_date: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T10:00:00Z',
            },
          },
        },
        // 用户模型
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1,
            },
            username: {
              type: 'string',
              example: 'admin',
            },
            real_name: {
              type: 'string',
              example: '管理员',
            },
            role: {
              type: 'string',
              enum: ['system_admin', 'asset_admin', 'department_admin', 'user'],
              example: 'system_admin',
            },
            department: {
              type: 'string',
              example: '信息科',
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: [
    path.join(__dirname, '../routes/*.js'),
    path.join(__dirname, '../routes/**/*.js'),
    path.join(__dirname, '../modules/**/*.js'),
    path.join(__dirname, '../docs/swagger/**/*.js'),
    path.join(__dirname, '../server.js'),
  ],
};

const swaggerSpec = swaggerJsdoc(options);
const { buildAutoSwaggerPaths } = require('../docs/swagger/route-catalog');

const autoDiscoveredPaths = buildAutoSwaggerPaths();
swaggerSpec.paths = swaggerSpec.paths || {};

Object.entries(autoDiscoveredPaths).forEach(([apiPath, pathItem]) => {
  swaggerSpec.paths[apiPath] = swaggerSpec.paths[apiPath] || {};

  Object.entries(pathItem).forEach(([method, operation]) => {
    if (!swaggerSpec.paths[apiPath][method]) {
      swaggerSpec.paths[apiPath][method] = operation;
    }
  });
});

module.exports = swaggerSpec;
