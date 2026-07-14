# Windows 服务器部署指南

## 📋 部署前准备

### 1. 系统要求
- Windows Server 2012 或更高版本（或 Windows 10/11）
- Node.js 16.0.0 或更高版本
- MySQL 5.7 或更高版本
- 至少 2GB 可用内存
- 至少 5GB 可用磁盘空间

### 2. 安装 Node.js
1. 访问 [Node.js 官网](https://nodejs.org/)
2. 下载 Windows 安装包（推荐 LTS 版本）
3. 运行安装程序，按默认设置安装
4. 验证安装：
   ```cmd
   node --version
   npm --version
   ```

### 3. 安装 MySQL
1. 访问 [MySQL 官网](https://dev.mysql.com/downloads/mysql/)
2. 下载 Windows 安装包
3. 运行安装程序，记住 root 密码
4. 创建数据库：
   ```sql
   CREATE DATABASE zcgl CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

---

## 🚀 部署步骤

### 步骤 1：上传项目文件

将整个项目文件夹上传到 Windows 服务器，建议路径：
```
C:\AssetManagement\
```

项目结构：
```
C:\AssetManagement\
├── backend\          # 后端代码
├── frontend\         # 前端代码
└── dist\            # 前端构建文件（可选，如果单独部署）
```

### 步骤 2：构建前端生产版本

在服务器上打开命令提示符（CMD）或 PowerShell：

```cmd
cd C:\AssetManagement\frontend
npm install
npm run build
```

构建完成后，会在 `frontend\dist` 目录生成生产版本文件。

### 步骤 3：安装后端依赖

```cmd
cd C:\AssetManagement\backend
npm install
```

### 步骤 4：配置后端环境变量

在 `backend` 目录创建 `.env` 文件：

```env
# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=你的数据库密码
DB_NAME=zcgl

# 服务器配置
PORT=4001
NODE_ENV=production

# JWT 密钥（请修改为随机字符串）
JWT_SECRET=your-secret-key-here-change-this

# CORS 配置（允许访问的域名）
CORS_ORIGIN=*
```

### 步骤 5：初始化数据库

运行数据库初始化脚本（如果有）：

```cmd
cd C:\AssetManagement\backend
node scripts/create-tables.js
```

### 步骤 6：启动后端服务

#### 方式一：直接启动（测试用）

```cmd
cd C:\AssetManagement\backend
node server.js
```

#### 方式二：使用 PM2（推荐，生产环境）

1. 安装 PM2：
   ```cmd
   npm install -g pm2
   ```

2. 启动服务：
   ```cmd
   cd C:\AssetManagement\backend
   pm2 start server.js --name asset-backend
   ```

3. 设置开机自启：
   ```cmd
   pm2 startup
   pm2 save
   ```

#### 方式三：使用 Windows 服务（推荐，更稳定）

1. 安装 `node-windows`：
   ```cmd
   npm install -g node-windows
   ```

2. 创建服务脚本 `install-service.js`：
   ```javascript
   const Service = require('node-windows').Service;
   const path = require('path');

   const svc = new Service({
     name: 'AssetManagement Backend',
     description: '资产管理系统后端服务',
     script: path.join(__dirname, 'server.js'),
     nodeOptions: [
       '--max_old_space_size=4096'
     ]
   });

   svc.on('install', function() {
     svc.start();
     console.log('服务安装成功！');
   });

   svc.install();
   ```

3. 运行安装脚本：
   ```cmd
   cd C:\AssetManagement\backend
   node install-service.js
   ```

4. 管理服务：
   - 启动：`net start "AssetManagement Backend"`
   - 停止：`net stop "AssetManagement Backend"`
   - 卸载：运行 `uninstall-service.js`

---

## 🌐 配置 Web 服务器（可选）

### 选项 1：使用后端直接提供前端文件（推荐）

后端已经配置为自动提供前端静态文件，无需额外配置。

访问地址：`http://服务器IP:4001`

### 选项 2：使用 IIS（Internet Information Services）

1. 安装 IIS：
   - 控制面板 → 程序 → 启用或关闭 Windows 功能
   - 勾选 "Internet Information Services"

2. 创建网站：
   - 打开 IIS 管理器
   - 右键 "网站" → "添加网站"
   - 网站名称：`AssetManagement`
   - 物理路径：`C:\AssetManagement\frontend\dist`
   - 绑定：端口 `80` 或 `8080`

3. 配置 URL 重写（支持前端路由）：
   - 安装 [URL Rewrite 模块](https://www.iis.net/downloads/microsoft/url-rewrite)
   - 在网站根目录创建 `web.config`：
   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <configuration>
     <system.webServer>
       <rewrite>
         <rules>
           <rule name="React Routes" stopProcessing="true">
             <match url=".*" />
             <conditions logicalGrouping="MatchAll">
               <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
               <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
               <add input="{REQUEST_URI}" pattern="^/api" negate="true" />
             </conditions>
             <action type="Rewrite" url="/index.html" />
           </rule>
         </rules>
       </rewrite>
     </system.webServer>
   </configuration>
   ```

4. 配置 API 代理：
   - 安装 [Application Request Routing](https://www.iis.net/downloads/microsoft/application-request-routing)
   - 在 IIS 中配置反向代理到 `http://localhost:4001`

### 选项 3：使用 Nginx for Windows

1. 下载 [Nginx for Windows](http://nginx.org/en/download.html)

2. 解压到 `C:\nginx`

3. 编辑 `C:\nginx\conf\nginx.conf`：
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       # 前端静态文件
       location / {
           root C:/AssetManagement/frontend/dist;
           try_files $uri $uri/ /index.html;
           index index.html;
       }

       # API 代理
       location /api {
           proxy_pass http://localhost:4001;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }

       # 上传文件代理
       location /uploads {
           proxy_pass http://localhost:4001;
       }
   }
   ```

4. 启动 Nginx：
   ```cmd
   cd C:\nginx
   start nginx
   ```

---

## 🔧 防火墙配置

### 开放端口

1. 打开 Windows 防火墙：
   - 控制面板 → 系统和安全 → Windows Defender 防火墙
   - 高级设置

2. 添加入站规则：
   - 新建规则 → 端口
   - TCP，特定本地端口：`4001`（后端）或 `80`（Web 服务器）
   - 允许连接
   - 应用到所有配置文件

---

## ✅ 验证部署

### 1. 检查后端服务

访问：`http://服务器IP:4001/api/health`

应该返回：
```json
{
  "status": "ok",
  "message": "资产管理服务运行正常",
  "database": "connected"
}
```

### 2. 检查前端

访问：`http://服务器IP:4001`（如果使用后端提供前端）
或：`http://服务器IP`（如果使用 IIS/Nginx）

应该看到登录页面。

### 3. 测试功能

1. 登录系统
2. 测试各个功能模块
3. 检查文件上传功能
4. 检查数据库连接

---

## 🔄 更新部署

### 更新前端

```cmd
cd C:\AssetManagement\frontend
git pull  # 如果有使用 Git
npm install
npm run build
```

重启后端服务（如果使用 PM2）：
```cmd
pm2 restart asset-backend
```

### 更新后端

```cmd
cd C:\AssetManagement\backend
git pull  # 如果有使用 Git
npm install
```

重启服务：
```cmd
pm2 restart asset-backend
# 或
net stop "AssetManagement Backend"
net start "AssetManagement Backend"
```

---

## 🐛 常见问题

### 1. 端口被占用

```cmd
netstat -ano | findstr :4001
taskkill /PID <进程ID> /F
```

### 2. 数据库连接失败

- 检查 MySQL 服务是否运行
- 检查 `.env` 文件中的数据库配置
- 检查防火墙是否阻止了数据库端口

### 3. 前端路由 404

- 确保配置了 URL 重写规则
- 检查 `web.config`（IIS）或 `nginx.conf`（Nginx）

### 4. 文件上传失败

- 检查 `backend\uploads` 目录权限
- 确保目录存在且有写入权限

---

## 📞 技术支持

如遇到问题，请检查：
1. 后端日志：`backend\logs\`
2. 系统事件查看器
3. PM2 日志：`pm2 logs asset-backend`

---

## 📝 部署检查清单

- [ ] Node.js 已安装
- [ ] MySQL 已安装并运行
- [ ] 数据库已创建
- [ ] 后端依赖已安装
- [ ] 前端已构建
- [ ] `.env` 文件已配置
- [ ] 后端服务已启动
- [ ] 防火墙端口已开放
- [ ] 健康检查通过
- [ ] 前端页面可访问
- [ ] 登录功能正常
- [ ] 文件上传功能正常
