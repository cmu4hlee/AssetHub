# Windows 环境部署说明

## 快速安装

### 方法1：使用安装脚本（推荐）

1. 双击运行 `install-windows.bat`
2. 等待安装完成
3. 配置 `.env` 文件
4. 运行 `npm start` 启动服务

### 方法2：手动安装

```bash
# 1. 进入后端目录
cd Asset\backend

# 2. 安装依赖
npm install

# 3. 如果安装失败，使用国内镜像
npm install --registry=https://registry.npmmirror.com
```

## 如果遇到 "缺少 axios" 错误

### 解决方案1：重新安装依赖

```bash
cd Asset\backend

# 删除旧的依赖
rmdir /s /q node_modules
del package-lock.json

# 重新安装
npm install
```

### 解决方案2：单独安装 axios

```bash
cd Asset\backend
npm install axios
```

### 解决方案3：使用 npm ci（确保版本一致）

```bash
cd Asset\backend
npm ci
```

### 解决方案4：使用国内镜像

```bash
cd Asset\backend
npm config set registry https://registry.npmmirror.com
npm install
```

## 验证安装

检查 axios 是否已正确安装：

```bash
cd Asset\backend
npm list axios
```

应该显示：

```
asset-management-backend@1.0.0
└── axios@1.13.2
```

## 启动服务

```bash
cd Asset\backend
npm start
```

## 常见问题

### 问题1：npm install 很慢或失败

**解决方案**：使用国内镜像

```bash
npm config set registry https://registry.npmmirror.com
npm install
```

### 问题2：权限错误

**解决方案**：以管理员身份运行命令提示符或 PowerShell

### 问题3：node_modules 损坏

**解决方案**：

```bash
rmdir /s /q node_modules
del package-lock.json
npm install
```

### 问题4：提示缺少其他模块

**解决方案**：确保运行了 `npm install`，所有依赖都在 `package.json` 中定义

## 依赖列表

后端主要依赖：

- axios (HTTP 客户端)
- express (Web 框架)
- mysql2 (MySQL 驱动)
- jsonwebtoken (JWT 认证)
- bcryptjs (密码加密)
- multer (文件上传)
- 等等...

所有依赖都在 `package.json` 中定义，运行 `npm install` 会自动安装。
