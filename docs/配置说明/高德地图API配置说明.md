# 高德地图 API Key 配置说明

## 📍 获取高德地图 API Key

### 步骤 1：注册/登录高德开放平台

1. 访问高德开放平台：**https://console.amap.com/**
2. 使用手机号或邮箱注册/登录账号
3. 完成实名认证（个人或企业）

### 步骤 2：创建应用

1. 登录后，进入 **控制台** → **应用管理**
2. 点击 **创建新应用**
3. 填写应用信息：
   - **应用名称**：资产管理系统（或自定义）
   - **应用类型**：Web 服务
   - **应用描述**：资产定位管理（可选）

### 步骤 3：添加 Key

1. 在创建的应用中，点击 **添加 Key**
2. 填写 Key 信息：
   - **Key 名称**：资产定位 Key（或自定义）
   - **服务平台**：选择 **Web 服务（JS API）**
   - **IP 白名单**：
     - 开发环境：可以留空或填写 `*`（允许所有 IP）
     - 生产环境：建议填写服务器 IP 地址
3. 点击 **提交**，系统会生成 API Key

### 步骤 4：查看 API Key

创建成功后，在应用列表中可以看到生成的 Key，格式类似：
```
xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## ⚙️ 配置 API Key

### 方式一：在 index.html 中直接配置（推荐用于开发）

1. 打开文件：`Asset/frontend/index.html`
2. 找到第 9 行：
   ```html
   <script type="text/javascript" src="https://webapi.amap.com/maps?v=2.0&key=YOUR_AMAP_KEY&plugin=AMap.Geocoder,AMap.PlaceSearch"></script>
   ```
3. 将 `YOUR_AMAP_KEY` 替换为您的实际 API Key：
   ```html
   <script type="text/javascript" src="https://webapi.amap.com/maps?v=2.0&key=您的实际API_KEY&plugin=AMap.Geocoder,AMap.PlaceSearch"></script>
   ```

### 方式二：使用环境变量（推荐用于生产）

#### 1. 创建配置文件

在 `Asset/frontend` 目录下创建 `.env` 文件：

```env
VITE_AMAP_KEY=您的实际API_KEY
```

#### 2. 修改 index.html

将 API Key 改为从环境变量读取：

```html
<script type="text/javascript" src="https://webapi.amap.com/maps?v=2.0&key=%VITE_AMAP_KEY%&plugin=AMap.Geocoder,AMap.PlaceSearch"></script>
```

#### 3. 修改 AssetLocationMap.jsx

在组件中动态加载地图脚本：

```javascript
useEffect(() => {
  const amapKey = import.meta.env.VITE_AMAP_KEY || 'YOUR_AMAP_KEY';
  const script = document.createElement('script');
  script.src = `https://webapi.amap.com/maps?v=2.0&key=${amapKey}&plugin=AMap.Geocoder,AMap.PlaceSearch`;
  script.async = true;
  script.onload = () => {
    setMapReady(true);
  };
  document.head.appendChild(script);
}, []);
```

## 🔍 验证配置

1. 启动前端服务：
   ```bash
   cd Asset/frontend
   npm run dev
   ```

2. 打开浏览器访问：`http://localhost:4000`

3. 进入 **资产定位** 页面

4. 如果配置正确，应该能看到：
   - ✅ 地图正常加载
   - ✅ 可以选择资产并显示位置
   - ✅ 可以点击地图选择位置

5. 如果配置错误，可能会看到：
   - ❌ 地图无法加载
   - ❌ 控制台报错：`INVALID_USER_KEY` 或 `INVALID_USER_SCODE`

## 📋 API 配额说明

### 免费配额（个人开发者）

- **日调用量**：30 万次/天
- **并发量**：300 QPS
- **适用场景**：个人学习、小型项目

### 企业配额

- 需要企业认证
- 更高的调用量和并发
- 技术支持服务

## 🛡️ 安全建议

1. **不要将 API Key 提交到代码仓库**
   - 使用 `.env` 文件（已添加到 `.gitignore`）
   - 或使用环境变量

2. **设置 IP 白名单**
   - 生产环境建议设置服务器 IP
   - 限制 Key 的使用范围

3. **定期更换 Key**
   - 如果 Key 泄露，及时在高德控制台删除并重新创建

4. **监控使用量**
   - 定期查看控制台的使用统计
   - 避免超出配额导致服务中断

## 🔧 常见问题

### Q1: 地图无法加载，提示 "INVALID_USER_KEY"

**原因**：API Key 配置错误或未生效

**解决方案**：
1. 检查 Key 是否正确复制（注意前后空格）
2. 确认 Key 的服务平台选择为 "Web 服务（JS API）"
3. 清除浏览器缓存后重新加载
4. 检查 IP 白名单设置

### Q2: 地图显示正常，但无法点击选择位置

**原因**：可能是地图初始化时机问题

**解决方案**：
1. 确保先选择了资产
2. 等待地图完全加载后再操作
3. 检查浏览器控制台是否有错误信息

### Q3: 逆地理编码（获取地址）功能不工作

**原因**：可能未启用相关服务

**解决方案**：
1. 确认在 Key 配置中启用了 "Web 服务 API"
2. 检查脚本 URL 中是否包含 `AMap.Geocoder` 插件

### Q4: 开发环境正常，生产环境报错

**原因**：可能是 IP 白名单限制

**解决方案**：
1. 在高德控制台添加生产服务器 IP 到白名单
2. 或临时设置为 `*`（允许所有 IP，仅用于测试）

## 📚 相关资源

- **高德开放平台**：https://console.amap.com/
- **JS API 文档**：https://lbs.amap.com/api/javascript-api/summary
- **API 配额说明**：https://lbs.amap.com/api/webservice/summary
- **错误码说明**：https://lbs.amap.com/api/webservice/guide/tools/info

## 📝 配置检查清单

- [ ] 已注册高德开放平台账号
- [ ] 已完成实名认证
- [ ] 已创建应用并添加 Key
- [ ] Key 的服务平台选择为 "Web 服务（JS API）"
- [ ] 已在 `index.html` 中配置 API Key
- [ ] 已测试地图加载功能
- [ ] 已测试资产定位功能
- [ ] 已测试位置更新功能
- [ ] 已设置 IP 白名单（生产环境）

---

**配置完成后，请重启前端服务使配置生效！**
