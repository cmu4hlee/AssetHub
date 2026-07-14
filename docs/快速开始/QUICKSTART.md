# 快速启动指南

## 前置要求

1. Node.js (推荐 v16 或更高版本)
2. MySQL 数据库访问权限
3. npm 或 yarn 包管理器

## 快速开始

### 步骤 1: 初始化数据库

首先需要创建数据库表结构。你可以通过以下方式之一执行：

**方式一：使用 MySQL 命令行**
```bash
mysql -h 101.37.236.101 -u root -p
# 输入密码: Cmu19801008
source backend/config/init.sql
```

**方式二：直接导入 SQL 文件**
```bash
mysql -h 101.37.236.101 -u root -pCmu19801008 zcgl < backend/config/init.sql
```

### 步骤 2: 安装依赖

**安装后端依赖**
```bash
cd backend
npm install
cd ..
```

**安装前端依赖**
```bash
cd frontend
npm install
cd ..
```

### 步骤 3: 启动服务

**方式一：分别启动（推荐用于开发）**

启动后端服务：
```bash
cd backend
npm start
# 或开发模式（自动重启）
npm run dev
```

在另一个终端启动前端服务：
```bash
cd frontend
npm run dev
```

**方式二：使用启动脚本**
```bash
./start.sh
```

### 步骤 4: 访问应用

**开发模式**：
- 前端应用: http://localhost:6000
- 后端API: http://localhost:6001/api

**生产模式**：
- 前端应用: http://localhost:4000
- 后端API: http://localhost:4001/api

## 数据库配置

如果 `.env` 文件无法使用，数据库配置在 `backend/config/database.js` 中：

```javascript
host: '101.37.236.101',
port: 3306,
user: 'root',
password: 'Cmu19801008',
database: 'zcgl'
```

## 功能测试

1. **资产管理**
   - 访问 http://localhost:6000/assets（开发模式）或 http://localhost:4000/assets（生产模式）
   - 点击"添加资产"创建新资产
   - 使用搜索和筛选功能查找资产

2. **资产盘点**
   - 访问 http://localhost:6000/inventory（开发模式）或 http://localhost:4000/inventory（生产模式）
   - 创建新的盘点记录
   - 添加盘点明细

3. **资产调配**
   - 访问 http://localhost:6000/transfer（开发模式）或 http://localhost:4000/transfer（生产模式）
   - 创建调配申请
   - 查看调配状态

4. **闲置资产**
   - 访问 http://localhost:6000/idle（开发模式）或 http://localhost:4000/idle（生产模式）
   - 发布闲置资产
   - 查看发布列表

## 常见问题

### 1. 数据库连接失败
- 检查数据库服务器是否可访问
- 确认用户名和密码正确
- 检查防火墙设置

### 2. 端口冲突
- **开发模式**：后端默认使用 6001 端口，前端默认使用 6000 端口
- **生产模式**：后端默认使用 4001 端口，前端默认使用 4000 端口
- 可在配置文件中修改端口，或通过环境变量覆盖

### 3. 前端无法连接后端
- 确认后端服务已启动
- 检查 `frontend/src/utils/api.js` 中的 API_BASE_URL
- 确认 CORS 配置正确

## 开发说明

- 后端使用 Express + MySQL
- 前端使用 Vite + React + Ant Design
- 所有 API 调用通过 `frontend/src/utils/api.js` 统一管理
- 数据库表结构在 `backend/config/init.sql` 中定义

