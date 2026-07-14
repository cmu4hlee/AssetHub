# AssetTube 国际化 (i18n) 实现总结

## 概述
AssetTube 资产管理系统现已完整支持中文/英文双语切换，实现了前后端全面的国际化支持。

## 功能特性

### 🌐 语言支持
- **简体中文 (zh-CN)**: 默认语言
- **英文 (en-US)**: 完整英文界面

### 🔄 语言切换
- **切换位置**: 页面顶部导航栏 (Header)
- **切换方式**: 点击语言按钮即可在中文/英文间切换
- **持久化**: 语言偏好保存在 localStorage，刷新页面后保持
- **后端同步**: 登录用户可将语言偏好同步到后端数据库

## 前端实现

### 依赖安装
```bash
npm install react-i18next i18next i18next-browser-languagedetector
```

### 文件结构
```
frontend/src/i18n/
├── index.js              # i18n 初始化配置
└── locales/
    ├── zh-CN/            # 中文翻译
    │   ├── index.js
    │   ├── common.json   # 通用翻译
    │   ├── auth.json     # 认证相关
    │   ├── asset.json    # 资产相关
    │   ├── maintenance.json  # 维保相关
    │   ├── quality.json  # 质控相关
    │   ├── message.json  # 消息相关
    │   └── system.json   # 系统相关
    └── en-US/            # 英文翻译
        └── ... (同上)
```

### 使用方式

#### 1. Hook 方式 (函数组件)
```jsx
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation();
  return <h1>{t('common.welcome')}</h1>;
}
```

#### 2. 命名空间
```jsx
const { t } = useTranslation('asset');  // 使用 asset 命名空间
return <span>{t('assetName')}</span>;    // 无需前缀
```

#### 3. 插值
```jsx
const { t } = useTranslation();
return <span>{t('validation.required', { field: '用户名' })}</span>;
// 输出: 用户名是必填项
```

## 后端实现

### 文件结构
```
backend/
├── services/i18n.service.js      # 国际化服务
├── middleware/i18n.middleware.js # i18n 中间件
├── routes/i18n.routes.js         # i18n API 路由
└── locales/                      # 翻译文件
    ├── zh/common.json
    └── en/common.json
```

### API 接口

| 接口 | 方法 | 描述 | 权限 |
|------|------|------|------|
| `/api/i18n/locales` | GET | 获取支持的语言列表 | 公开 |
| `/api/i18n/messages/:locale` | GET | 获取指定语言的翻译 | 公开 |
| `/api/i18n/translate` | POST | 翻译指定键值 | 公开 |
| `/api/i18n/switch` | POST | 切换用户语言偏好 | 需登录 |

### 后端使用

```javascript
// 在中间件中自动注入
app.use(i18nMiddleware);

// 路由中使用
router.get('/example', (req, res) => {
  const message = req.t('common.success');  // 根据请求语言返回翻译
  res.json({ message });
});
```

## 数据库变更

### 新增字段
```sql
ALTER TABLE users ADD COLUMN preferred_language VARCHAR(10) DEFAULT NULL COMMENT '用户语言偏好(zh/en)';
CREATE INDEX idx_users_preferred_language ON users(preferred_language);
```

### 运行迁移
```bash
cd backend
cd database/migrations
node run_i18n_migration.js
```

## 翻译键命名规范

### 命名空间
- `common`: 通用翻译
- `auth`: 认证登录
- `asset`: 资产管理
- `maintenance`: 维保管理
- `quality`: 质量管理
- `message`: 消息通知
- `system`: 系统管理

### 键名规范
- 使用小写字母
- 单词间用下划线分隔
- 按功能分组，用点号分隔层级

示例:
```json
{
  "asset": {
    "title": "资产管理",
    "create": "新建资产",
    "assetName": "资产名称"
  }
}
```

## 组件说明

### LanguageSwitcher 组件
```jsx
import LanguageSwitcher from './components/LanguageSwitcher';

// 按钮样式 (默认)
<LanguageSwitcher type="button" size="small" />

// 下拉菜单样式
<LanguageSwitcher type="dropdown" size="middle" />
```

## 测试

### 运行测试
```bash
# 后端测试
cd backend
npm test

# 前端构建测试
cd frontend
npm run build
```

### 测试结果
- ✅ 25 个测试套件全部通过
- ✅ 186 个测试用例全部通过
- ✅ 前端构建成功

## 后续扩展

### 添加新语言
1. 在 `frontend/src/i18n/locales/` 创建新语言目录
2. 复制 en-US 或 zh-CN 的 JSON 文件并翻译
3. 在 `frontend/src/i18n/index.js` 中添加语言配置
4. 在 `backend/locales/` 创建对应翻译文件
5. 更新 `i18n.service.js` 的支持语言列表

### 添加新翻译
1. 在对应命名空间的 JSON 文件中添加键值
2. 确保中英文文件同步更新
3. 在组件中使用 `t('namespace.key')` 调用

## 注意事项

1. **浏览器缓存**: 修改翻译文件后，用户可能需要清除浏览器缓存才能看到更新
2. **翻译缺失**: 如果某个键在当前语言中不存在，会自动回退到默认语言(中文)
3. **性能优化**: 翻译文件按需加载，不会影响首屏加载速度
4. **代码分割**: 各模块的翻译文件可独立维护，便于团队协作

## 总结

AssetTube 现已实现:
- ✅ 完整的前后端国际化架构
- ✅ 中英文双语支持
- ✅ 用户语言偏好持久化
- ✅ 语言切换UI组件
- ✅ 翻译键值规范管理
- ✅ 易于扩展的架构设计
