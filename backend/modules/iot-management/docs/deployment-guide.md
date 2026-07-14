# 物联网模块部署指南

## 1. 部署环境要求

### 1.1 硬件要求

| 环境类型 | CPU | 内存  | 存储   | 网络    |
| -------- | --- | ----- | ------ | ------- |
| 开发环境 | 2核 | 4GB   | 50GB   | 100Mbps |
| 测试环境 | 4核 | 8GB   | 100GB  | 1Gbps   |
| 生产环境 | 8核 | 16GB+ | 200GB+ | 1Gbps+  |

### 1.2 软件要求

| 软件       | 版本  | 用途             |
| ---------- | ----- | ---------------- |
| Node.js    | 14.0+ | 运行环境         |
| MySQL      | 5.7+  | 数据库           |
| Redis      | 6.0+  | 缓存服务         |
| Nginx      | 1.18+ | 反向代理         |
| Docker     | 20.0+ | 容器化部署       |
| Kubernetes | 1.19+ | 容器编排（可选） |

### 1.3 依赖包

| 依赖包       | 版本  | 用途         |
| ------------ | ----- | ------------ |
| express      | 4.17+ | Web框架      |
| mysql2       | 2.2+  | 数据库连接   |
| sequelize    | 6.6+  | ORM框架      |
| jsonwebtoken | 8.5+  | JWT认证      |
| redis        | 3.1+  | Redis客户端  |
| dotenv       | 10.0+ | 环境变量管理 |
| cors         | 2.8+  | 跨域支持     |
| morgan       | 1.10+ | 日志记录     |
| helmet       | 4.6+  | 安全增强     |

## 2. 部署方式

### 2.1 传统部署

#### 2.1.1 步骤

1. **环境准备**
   - 安装Node.js、MySQL、Redis等基础服务
   - 配置系统环境变量

2. **代码部署**
   - 克隆代码库到服务器
   - 安装依赖包
   - 配置环境变量

3. **数据库初始化**
   - 创建数据库和数据表
   - 导入初始数据

4. **服务启动**
   - 启动应用服务
   - 配置Nginx反向代理

5. **服务监控**
   - 配置日志监控
   - 设置告警机制

#### 2.1.2 配置文件

**环境变量配置** (`.env`)

```dotenv
# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=password
DB_NAME=asset_management

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# 应用配置
APP_PORT=3000
APP_ENV=production
APP_SECRET=your_secret_key

# 物联网模块配置
IOT_MODULE_ENABLED=true
IOT_DEVICE_DATA_RETENTION=30
IOT_ALERT_THRESHOLD_TEMPERATURE=35
IOT_ALERT_THRESHOLD_HUMIDITY=90
IOT_ALERT_THRESHOLD_BATTERY=20
```

### 2.2 Docker容器化部署

#### 2.2.1 Dockerfile

```dockerfile
FROM node:14-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
```

#### 2.2.2 Docker Compose

```yaml
version: '3'
services:
  app:
    build: .
    ports:
      - '3000:3000'
    environment:
      - DB_HOST=db
      - DB_PORT=3306
      - DB_USER=root
      - DB_PASSWORD=password
      - DB_NAME=asset_management
      - REDIS_HOST=redis
      - REDIS_PORT=6379
    depends_on:
      - db
      - redis

  db:
    image: mysql:5.7
    environment:
      - MYSQL_ROOT_PASSWORD=password
      - MYSQL_DATABASE=asset_management
    volumes:
      - db_data:/var/lib/mysql
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql

  redis:
    image: redis:6-alpine

volumes:
  db_data:
```

### 2.3 Kubernetes部署

#### 2.3.1 部署文件

**Deployment**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: iot-module
spec:
  replicas: 3
  selector:
    matchLabels:
      app: iot-module
  template:
    metadata:
      labels:
        app: iot-module
    spec:
      containers:
        - name: iot-module
          image: your-registry/iot-module:latest
          ports:
            - containerPort: 3000
          env:
            - name: DB_HOST
              value: 'mysql-service'
            - name: DB_PORT
              value: '3306'
            - name: DB_USER
              value: 'root'
            - name: DB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: db-secret
                  key: password
            - name: DB_NAME
              value: 'asset_management'
            - name: REDIS_HOST
              value: 'redis-service'
            - name: REDIS_PORT
              value: '6379'
```

**Service**

```yaml
apiVersion: v1
kind: Service
metadata:
  name: iot-module-service
spec:
  selector:
    app: iot-module
  ports:
    - port: 80
      targetPort: 3000
  type: LoadBalancer
```

## 3. 模块初始化

### 3.1 数据库初始化

#### 3.1.1 创建数据表

```sql
-- 设备表
CREATE TABLE IF NOT EXISTS iot_devices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  device_id VARCHAR(50) UNIQUE NOT NULL,
  device_name VARCHAR(100) NOT NULL,
  device_type VARCHAR(20) NOT NULL,
  manufacturer VARCHAR(100),
  model VARCHAR(100),
  serial_number VARCHAR(100),
  mac_address VARCHAR(50),
  firmware_version VARCHAR(50),
  status VARCHAR(20) NOT NULL DEFAULT '离线',
  last_online_time DATETIME,
  remark TEXT,
  tenant_id INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_device_id (device_id),
  INDEX idx_status (status)
);

-- 设备数据表
CREATE TABLE IF NOT EXISTS iot_device_data (
  id INT AUTO_INCREMENT PRIMARY KEY,
  device_id VARCHAR(50) NOT NULL,
  latitude DOUBLE,
  longitude DOUBLE,
  altitude DOUBLE,
  signal_strength INT,
  battery_level INT,
  temperature DOUBLE,
  humidity DOUBLE,
  other_data JSON,
  record_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  tenant_id INT NOT NULL,
  INDEX idx_device_id (device_id),
  INDEX idx_record_time (record_time),
  INDEX idx_tenant_id (tenant_id)
);

-- 预警表
CREATE TABLE IF NOT EXISTS iot_alerts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  device_id VARCHAR(50) NOT NULL,
  type VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  severity VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT '未处理',
  handler VARCHAR(50),
  handle_time DATETIME,
  remark TEXT,
  timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  tenant_id INT NOT NULL,
  INDEX idx_device_id (device_id),
  INDEX idx_status (status),
  INDEX idx_severity (severity),
  INDEX idx_timestamp (timestamp),
  INDEX idx_tenant_id (tenant_id)
);

-- 模块配置表
CREATE TABLE IF NOT EXISTS iot_module_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  module_name VARCHAR(50) NOT NULL,
  config_key VARCHAR(50) NOT NULL,
  config_value JSON NOT NULL,
  tenant_id INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY idx_module_config (module_name, config_key, tenant_id),
  INDEX idx_tenant_id (tenant_id)
);
```

#### 3.1.2 导入初始数据

```sql
-- 插入模块配置数据
INSERT INTO iot_module_config (module_name, config_key, config_value, tenant_id) VALUES
('iot-management', 'device_types', '["RFID", "GPS", "蓝牙", "WiFi", "UWB", "其他"]', 1),
('iot-management', 'device_statuses', '["在线", "离线", "故障", "维护中"]', 1),
('iot-management', 'monitoring_thresholds', '{"temperature": 35, "humidity": 90, "battery": 20}', 1),
('iot-management', 'data_retention', '{"device_data": 30, "alert_history": 90}', 1);
```

### 3.2 模块配置

#### 3.2.1 配置文件

**模块配置** (`backend/modules/iot-management/config/module.config.js`)

```javascript
module.exports = {
  moduleName: 'iot-management',
  moduleVersion: '1.0.0',
  dependencies: ['location-management'],
  routes: {
    basePath: '/api/iot',
    routes: [
      {
        path: '/devices',
        controller: 'deviceController',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
      },
      {
        path: '/devices/:id/data',
        controller: 'dataController',
        methods: ['GET', 'POST'],
      },
      {
        path: '/alerts',
        controller: 'alertController',
        methods: ['GET', 'PUT'],
      },
      {
        path: '/location/*',
        controller: 'locationController',
        methods: ['GET', 'POST'],
      },
    ],
  },
  menus: [
    {
      name: '物联网设备管理',
      icon: 'device',
      children: [
        {
          name: '设备列表',
          path: '/iot/devices',
        },
        {
          name: '设备数据',
          path: '/iot/data',
        },
        {
          name: '监控预警',
          path: '/iot/alerts',
        },
        {
          name: '资产定位',
          path: '/iot/location',
        },
      ],
    },
  ],
  permissions: [
    {
      name: 'iot_device_read',
      description: '读取设备信息',
    },
    {
      name: 'iot_device_write',
      description: '修改设备信息',
    },
    {
      name: 'iot_data_read',
      description: '读取设备数据',
    },
    {
      name: 'iot_alert_manage',
      description: '管理预警信息',
    },
    {
      name: 'iot_location_manage',
      description: '管理位置信息',
    },
  ],
  deviceTypes: ['RFID', 'GPS', '蓝牙', 'WiFi', 'UWB', '其他'],
  deviceStatuses: ['在线', '离线', '故障', '维护中'],
  monitoringThresholds: {
    temperature: 35,
    humidity: 90,
    battery: 20,
  },
  security: {
    deviceAuth: true,
    dataEncryption: true,
    accessControl: true,
  },
};
```

#### 3.2.2 集成配置

**系统集成配置** (`backend/config/modules.js`)

```javascript
module.exports = {
  modules: [
    {
      name: 'iot-management',
      enabled: true,
      path: './modules/iot-management',
      config: require('./modules/iot-management/config/module.config'),
    },
    {
      name: 'location-management',
      enabled: true,
      path: './modules/location-management',
      config: require('./modules/location-management/config/module.config'),
    },
  ],
};
```

## 4. 服务管理

### 4.1 启动服务

#### 4.1.1 开发环境

```bash
# 启动开发服务器
npm run dev

# 启动数据库服务
sudo systemctl start mysql

# 启动Redis服务
sudo systemctl start redis
```

#### 4.1.2 生产环境

```bash
# 启动应用服务
npm start

# 或使用PM2管理
pm install pm2 -g
pm run build
pm run start:prod

# 或使用systemd管理
sudo systemctl start iot-module
```

### 4.2 停止服务

```bash
# 停止应用服务
Ctrl+C 或 npm stop

# 使用PM2停止
pm run stop:prod

# 使用systemd停止
sudo systemctl stop iot-module
```

### 4.3 重启服务

```bash
# 重启应用服务
npm run restart

# 使用PM2重启
npm run restart:prod

# 使用systemd重启
sudo systemctl restart iot-module
```

### 4.4 状态检查

```bash
# 检查应用状态
npm run status

# 使用PM2检查
pm run status:prod

# 使用systemd检查
sudo systemctl status iot-module

# 检查API健康状态
curl http://localhost:3000/api/iot/health
```

## 5. 监控与维护

### 5.1 日志管理

#### 5.1.1 日志配置

**日志配置** (`backend/config/logs.js`)

```javascript
module.exports = {
  format: 'combined',
  accessLog: './logs/access.log',
  errorLog: './logs/error.log',
  iotLog: './logs/iot.log',
  maxSize: '10m',
  maxFiles: '7d',
};
```

#### 5.1.2 日志查看

```bash
# 查看访问日志
tail -f logs/access.log

# 查看错误日志
tail -f logs/error.log

# 查看物联网模块日志
tail -f logs/iot.log

# 查看设备数据上报日志
grep "device-data" logs/iot.log

# 查看预警日志
grep "alert" logs/iot.log
```

### 5.2 监控指标

| 指标         | 描述                  | 阈值             | 监控方式   |
| ------------ | --------------------- | ---------------- | ---------- |
| 设备在线率   | 在线设备数/总设备数   | >95%             | 定时检查   |
| 数据上报频率 | 设备数据上报次数/分钟 | 正常范围         | 实时监控   |
| API响应时间  | API请求响应时间       | <500ms           | 性能监控   |
| 错误率       | 错误请求数/总请求数   | <1%              | 日志分析   |
| 系统负载     | CPU/内存使用率        | <70%             | 系统监控   |
| 数据库连接   | 数据库连接数          | <最大连接数的80% | 数据库监控 |

### 5.3 故障排查

#### 5.3.1 常见问题

| 问题             | 可能原因             | 解决方案                       |
| ---------------- | -------------------- | ------------------------------ |
| 设备无法上报数据 | 网络连接问题         | 检查网络连接和防火墙设置       |
| 设备离线         | 设备电池耗尽或信号弱 | 检查设备状态和信号强度         |
| API响应缓慢      | 数据库查询效率低     | 优化数据库查询和添加缓存       |
| 预警信息过多     | 阈值设置不合理       | 调整预警阈值和规则             |
| 系统崩溃         | 内存泄漏或资源耗尽   | 检查系统资源使用情况和代码优化 |

#### 5.3.2 排查步骤

1. **查看日志**
   - 检查应用日志、错误日志和系统日志
   - 分析错误信息和异常堆栈

2. **检查服务状态**
   - 检查应用服务是否正常运行
   - 检查数据库和Redis服务状态

3. **网络诊断**
   - 检查网络连接和端口状态
   - 测试API接口响应

4. **资源监控**
   - 检查CPU、内存和磁盘使用情况
   - 检查数据库连接和查询性能

5. **代码分析**
   - 检查代码逻辑和错误处理
   - 分析性能瓶颈和内存泄漏

## 6. 安全管理

### 6.1 认证与授权

#### 6.1.1 认证配置

**认证配置** (`backend/config/auth.js`)

```javascript
module.exports = {
  jwt: {
    secret: process.env.APP_SECRET,
    expiresIn: '24h',
  },
  deviceAuth: {
    enabled: true,
    secretKey: process.env.DEVICE_AUTH_SECRET,
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000,
    max: 100,
  },
};
```

#### 6.1.2 授权管理

- **基于角色的权限控制**
  - 系统管理员：所有权限
  - 资产管理员：设备管理和位置管理权限
  - 普通用户：只读权限

- **API权限控制**
  - 使用中间件验证API访问权限
  - 记录权限验证日志

### 6.2 数据安全

#### 6.2.1 加密配置

**加密配置** (`backend/config/security.js`)

```javascript
module.exports = {
  encryption: {
    enabled: true,
    algorithm: 'aes-256-cbc',
    key: process.env.ENCRYPTION_KEY,
  },
  ssl: {
    enabled: true,
    certPath: './ssl/cert.pem',
    keyPath: './ssl/key.pem',
  },
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  },
};
```

#### 6.2.2 安全措施

- **数据传输加密**：使用HTTPS加密传输
- **敏感数据加密**：加密存储设备密钥等敏感信息
- **访问控制**：限制API访问频率和来源IP
- **日志脱敏**：对敏感信息进行脱敏处理
- **定期安全审计**：检查系统安全漏洞和风险

### 6.3 备份与恢复

#### 6.3.1 备份策略

| 备份类型     | 频率     | 保留时间 | 备份方式 |
| ------------ | -------- | -------- | -------- |
| 数据库备份   | 每日     | 30天     | 自动备份 |
| 配置文件备份 | 每周     | 90天     | 手动备份 |
| 代码备份     | 每次部署 | 180天    | 版本控制 |
| 设备数据备份 | 每周     | 30天     | 自动备份 |

#### 6.3.2 恢复步骤

1. **数据库恢复**
   - 停止应用服务
   - 恢复数据库备份
   - 启动应用服务

2. **配置恢复**
   - 停止应用服务
   - 恢复配置文件
   - 重启应用服务

3. **灾难恢复**
   - 切换到备用服务器
   - 恢复最新备份
   - 验证服务可用性

## 7. 性能优化

### 7.1 数据库优化

- **索引优化**：为常用查询字段添加索引
- **查询优化**：优化SQL查询语句，减少全表扫描
- **连接池**：配置合理的数据库连接池大小
- **分区表**：对大表进行分区管理

### 7.2 缓存优化

- **Redis缓存**：缓存热点数据和设备状态
- **本地缓存**：缓存高频访问的配置信息
- **缓存策略**：合理设置缓存过期时间
- **缓存一致性**：确保缓存与数据库数据一致性

### 7.3 代码优化

- **异步处理**：使用异步/await处理IO操作
- **批量处理**：批量处理设备数据和预警信息
- **内存管理**：避免内存泄漏和过度使用
- **代码拆分**：合理拆分模块和函数

### 7.4 系统优化

- **负载均衡**：使用Nginx或Kubernetes进行负载均衡
- **水平扩展**：根据负载情况扩展应用实例
- **资源限制**：合理设置容器资源限制
- **网络优化**：优化网络配置和连接管理

## 8. 部署验证

### 8.1 功能验证

| 功能     | 验证步骤                         | 预期结果                   |
| -------- | -------------------------------- | -------------------------- |
| 设备管理 | 创建设备、修改设备信息、删除设备 | 操作成功，数据正确         |
| 数据上报 | 模拟设备数据上报                 | 数据接收成功，状态更新     |
| 预警管理 | 触发预警、处理预警               | 预警生成，状态更新         |
| 位置管理 | 查看资产位置、位置历史           | 位置信息正确，历史记录完整 |
| 权限控制 | 使用不同角色访问API              | 权限验证正确，无越权访问   |

### 8.2 性能验证

| 指标         | 验证方法           | 预期结果          |
| ------------ | ------------------ | ----------------- |
| API响应时间  | 压测工具测试       | <500ms            |
| 并发处理能力 | 模拟多设备并发上报 | 稳定处理1000+/秒  |
| 系统资源使用 | 监控系统负载       | CPU<70%，内存<80% |
| 数据库性能   | 执行复杂查询       | <1s               |

### 8.3 安全性验证

| 项目     | 验证方法         | 预期结果     |
| -------- | ---------------- | ------------ |
| 认证安全 | 尝试未授权访问   | 访问被拒绝   |
| 数据安全 | 检查数据传输加密 | 数据加密传输 |
| 权限控制 | 测试越权操作     | 操作被拒绝   |
| 输入验证 | 提交恶意输入     | 输入被过滤   |

## 9. 升级与维护

### 9.1 版本升级

#### 9.1.1 升级步骤

1. **备份数据**
   - 备份数据库
   - 备份配置文件

2. **代码更新**
   - 拉取最新代码
   - 安装依赖包

3. **数据库迁移**
   - 执行数据库迁移脚本
   - 验证数据完整性

4. **服务重启**
   - 重启应用服务
   - 验证服务可用性

#### 9.1.2 版本兼容性

- **API版本控制**：使用版本号区分API接口
- **向后兼容**：保持旧版本API的兼容性
- **废弃通知**：提前通知API废弃计划

### 9.2 日常维护

| 维护项     | 频率 | 维护内容                   |
| ---------- | ---- | -------------------------- |
| 日志清理   | 每周 | 清理过期日志，保持存储空间 |
| 数据库优化 | 每月 | 优化数据库表结构和索引     |
| 安全更新   | 季度 | 更新依赖包，修复安全漏洞   |
| 性能调优   | 半年 | 分析系统性能，进行优化调整 |
| 全面检查   | 每年 | 系统全面检查和维护         |

## 10. 常见问题与解决方案

### 10.1 部署问题

| 问题           | 原因                     | 解决方案                       |
| -------------- | ------------------------ | ------------------------------ |
| 依赖包安装失败 | 网络问题或版本冲突       | 使用国内镜像源，检查版本兼容性 |
| 数据库连接失败 | 连接参数错误或服务未启动 | 检查数据库配置和服务状态       |
| Redis连接失败  | 服务未启动或配置错误     | 检查Redis服务状态和配置        |
| 端口被占用     | 其他服务占用端口         | 修改端口配置或停止占用服务     |

### 10.2 运行问题

| 问题             | 原因                       | 解决方案               |
| ---------------- | -------------------------- | ---------------------- |
| 设备无法上报数据 | 网络问题或认证失败         | 检查网络连接和设备密钥 |
| 预警信息不生成   | 阈值设置错误或数据异常     | 检查预警配置和设备数据 |
| 位置信息不准确   | 定位设备故障或信号弱       | 检查设备状态和信号强度 |
| API响应缓慢      | 数据库查询效率低或缓存失效 | 优化查询和检查缓存配置 |

### 10.3 安全问题

| 问题       | 原因           | 解决方案               |
| ---------- | -------------- | ---------------------- |
| 未授权访问 | 认证机制失效   | 检查认证中间件配置     |
| 数据泄露   | 敏感信息未加密 | 加强数据加密和访问控制 |
| 暴力攻击   | 缺少访问限制   | 配置API限流和IP黑名单  |
| 注入攻击   | 输入验证不足   | 加强输入验证和参数过滤 |

## 11. 总结

本部署指南提供了物联网模块的完整部署方案，包括环境准备、代码部署、数据库初始化、服务管理、监控维护等方面。通过遵循本指南，可以确保物联网模块的顺利部署和稳定运行，为企业资产管理提供可靠的物联网支持。

---

**文档版本**：1.0.0
**最后更新**：2024-01-01
**作者**：系统架构组
