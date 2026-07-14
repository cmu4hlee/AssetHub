# Windows 生产环境部署说明

**最后更新**: 2026-01-14

---

## 🎯 问题说明

在 Windows 生产环境下，如果前端仍然通过 4001 端口访问，可能的原因：

1. **使用了开发模式启动**：使用了 `npm run dev` 而不是 `npm run preview`
2. **80端口被占用**：Windows 上80端口可能被 IIS 或其他服务占用
3. **直接访问了后端端口**：误将后端端口（4001）当作前端访问

---

## ✅ 正确的生产环境启动方式

### 方式1：使用生产环境启动脚本（推荐）

```batch
# 运行生产环境启动脚本
启动生产环境_windows.bat
```

这个脚本会：
1. 检查并构建前端（如果未构建）
2. 启动后端服务（4001端口）
3. 启动前端预览服务器（80端口）

### 方式2：手动启动

```batch
# 1. 构建前端（如果未构建）
cd Asset\frontend
npm run build

# 2. 启动后端（新窗口）
cd Asset\backend
npm start

# 3. 启动前端预览（新窗口）
cd Asset\frontend
npm run preview
```

---

## 🔍 问题排查

### 问题1：前端显示在4001端口

**原因**：可能使用了开发模式（`npm run dev`）而不是生产模式（`npm run preview`）

**解决**：
1. 确保使用 `npm run preview` 启动前端
2. 检查启动脚本是否使用了正确的命令

### 问题2：80端口无法访问

**可能原因**：
1. **80端口被占用**（常见于 Windows Server）
   ```batch
   # 检查端口占用
   netstat -ano | findstr :80
   
   # 如果被占用，可以：
   # 方案1：停止占用80端口的服务（如IIS）
   # 方案2：使用其他端口
   cd Asset\frontend
   set VITE_PREVIEW_PORT=8080
   npm run preview
   ```

2. **防火墙阻止**
   ```batch
   # 允许80端口通过防火墙
   netsh advfirewall firewall add rule name="Frontend Port 80" dir=in action=allow protocol=TCP localport=80
   ```

3. **权限问题**（Windows 通常不需要）
   - Windows 10/11 通常不需要管理员权限
   - Windows Server 可能需要管理员权限

### 问题3：前端启动失败

**检查清单**：
- [ ] 前端是否已构建（`frontend\dist` 目录存在）
- [ ] 前端依赖是否已安装（`frontend\node_modules` 存在）
- [ ] 端口是否被占用
- [ ] 查看前端服务窗口的错误信息

---

## 📋 启动脚本对比

### 开发环境脚本（`启动服务_windows.bat`）

```batch
# 使用开发模式
npm run dev
# 端口：80（根据 vite.config.js 配置）
```

### 生产环境脚本（`启动生产环境_windows.bat`）

```batch
# 1. 先构建
npm run build

# 2. 使用预览模式
npm run preview
# 端口：80（根据 vite.config.js 配置）
```

---

## 🔧 配置说明

### vite.config.js 配置

```javascript
// 开发环境
server: {
  port: 80,  // 默认80端口
}

// 生产环境预览
preview: {
  port: 80,  // 默认80端口
}
```

### package.json 脚本

```json
{
  "scripts": {
    "dev": "vite",                    // 开发模式
    "build": "vite build",            // 构建生产版本
    "preview": "vite preview --port 80 --host 0.0.0.0"  // 预览生产版本
  }
}
```

---

## 🚀 完整部署流程

### 1. 首次部署

```batch
# 1. 安装依赖
cd Asset\backend
npm install

cd ..\frontend
npm install

# 2. 构建前端
cd Asset\frontend
npm run build

# 3. 配置后端环境变量
# 编辑 Asset\backend\.env 文件

# 4. 启动服务
# 使用 启动生产环境_windows.bat
```

### 2. 更新部署

```batch
# 1. 重新构建前端
cd Asset\frontend
npm run build

# 2. 重启服务
# 停止旧服务，然后运行 启动生产环境_windows.bat
```

---

## 📝 常见问题

### Q1: 为什么前端访问的是4001端口？

**A**: 可能原因：
1. 使用了开发模式（`npm run dev`）而不是生产模式（`npm run preview`）
2. 直接访问了后端端口（4001）而不是前端端口（80）
3. 80端口被占用，Vite 自动切换到了其他端口

**解决**：
- 确保使用 `npm run preview` 启动
- 访问 http://localhost:80 或 http://localhost
- 检查前端服务窗口显示的端口号

### Q2: 如何确认前端运行在哪个端口？

**A**: 
1. 查看前端服务窗口的输出信息
2. 检查浏览器地址栏显示的端口
3. 使用 `netstat -ano | findstr :80` 检查80端口

### Q3: Windows Server 上80端口被IIS占用怎么办？

**A**: 
1. **停止IIS服务**（如果不需要）：
   ```batch
   net stop w3svc
   ```

2. **使用其他端口**：
   ```batch
   cd Asset\frontend
   set VITE_PREVIEW_PORT=8080
   npm run preview
   ```
   然后访问 http://localhost:8080

3. **使用IIS反向代理**（推荐）：
   配置IIS将80端口代理到前端预览服务器

---

## ✅ 验证清单

部署完成后，验证以下内容：

- [ ] 后端服务运行在 4001 端口
- [ ] 前端服务运行在 80 端口
- [ ] 可以通过 http://localhost 访问前端
- [ ] 前端可以正常调用后端API（/api/*）
- [ ] 文件上传/下载功能正常
- [ ] 登录功能正常

---

## 📞 需要帮助？

如果问题仍未解决，请检查：
1. 前端服务窗口的错误信息
2. 后端服务窗口的错误信息
3. 浏览器控制台的错误信息
4. Windows 事件查看器中的相关错误
