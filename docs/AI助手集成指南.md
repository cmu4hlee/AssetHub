# 资产AI助手集成方案

## 一、集成概述

### 1.1 集成目标

将以下四个独立的AI功能模块整合为统一的"资产AI助手"入口：

| 原模块 | 功能描述 | 路由 |
|-------|---------|-----|
| AI智能助手 | 技术文档问答、知识检索 | `/technical-documents/ai` |
| AI资产分析 | SQL智能分析、自然语言查询 | `/asset-ai-analysis` |
| AI维修助手 | 维修日志智能分析 | `/ai-maintenance` |
| 智能搜索 | 历史问答记录检索 | `/ai-question-records` |

### 1.2 集成方式

采用 iframe 嵌入方式，集成本地 SQLBot 服务（`http://localhost:8000/#/zcgl`），实现统一入口访问所有AI功能。

## 二、文件清单

### 2.1 新增文件

| 文件路径 | 说明 |
|--------|------|
| `frontend/src/pages/AssetAIAssistant.jsx` | 统一AI助手入口页面 |
| `backend/routes/ai-assistant.js` | AI助手统一API路由 |
| `backend/scripts/create-asset-ai-assistant-module.sql` | 模块配置SQL |

### 2.2 修改文件

| 文件路径 | 修改内容 |
|--------|---------|
| `frontend/src/App.jsx` | 添加路由配置 |
| `frontend/src/components/Layout.jsx` | 添加菜单配置 |
| `backend/server.js` | 注册新路由 |

## 三、使用说明

### 3.1 访问路径

集成完成后，用户可以通过以下方式访问统一的AI助手：

1. **主菜单访问**：系统菜单 → 资产AI助手 → 统一AI入口
2. **直接访问**：浏览器输入 `/ai-assistant`

### 3.2 功能切换

在统一界面中，用户可以：
- 通过顶部切换不同AI模式（SQL智能分析、文档智能助手、维修AI助手、智能搜索）
- 点击快捷问题快速提问
- 使用语音输入功能
- 全屏模式查看

### 3.3 传统模式兼容

如果集成界面出现问题，用户可以通过以下方式切换到传统独立页面：
- 在统一界面中切换到"功能选择"Tab
- 点击相应功能的卡片跳转到独立页面

## 四、技术架构

### 4.1 前端架构

```
┌─────────────────────────────────────────────────────┐
│                  AssetAIAssistant                    │
│  ┌─────────────────────────────────────────────┐ │
│  │  Tab: 统一入口 | 功能选择                    │ │
│  ├─────────────────────────────────────────────┤ │
│  │  ┌─────────┐  ┌─────────────────────────┐  │ │
│  │  │ SQLBot  │  │    iframe 嵌入区域      │  │ │
│  │  │ iframe  │  │  localhost:8000/#/zcgl   │  │ │
│  │  └─────────┘  └─────────────────────────┘  │ │
│  ├─────────────────────────────────────────────┤ │
│  │  快捷提问 | API状态 | 快捷操作按钮         │ │
│  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### 4.2 API架构

```
前端请求                    后端服务
   │                          │
   ├─ GET /api/ai-assistant/modes        → 返回所有AI模式
   ├─ GET /api/ai-assistant/quick-questions → 返回快捷问题
   ├─ POST /api/ai-assistant/query        → 统一查询接口
   └─ GET /api/ai-assistant/config       → AI助手配置

iframe 内部请求（localhost:8000）
   │
   ├─ /api/v1/open/*  → SQLBot API
   └─ 其他            → 对应AI服务
```

## 五、配置项说明

### 5.1 环境变量

| 变量名 | 说明 | 默认值 |
|-------|------|--------|
| SQLBOT_BASE_URL | SQLBot服务地址 | http://localhost:8000 |
| DASHSCOPE_API_KEY | 阿里百炼API密钥 | - |
| LM_STUDIO_API_URL | LM Studio API地址 | http://192.168.1.80:1234 |

### 5.2 前端配置

```javascript
// AI助手默认配置
const DEFAULT_CONFIG = {
  baseUrl: 'http://localhost:8000',
  integratedPath: '/#/zcgl',
  supportedModes: ['sqlbot', 'documents', 'maintenance', 'search'],
  features: {
    voiceInput: true,
    historyRecord: true,
    quickQuestions: true,
    fullscreen: true
  }
};
```

## 六、功能说明

### 6.1 SQL智能分析模式

**功能特点：**
- 自然语言查询资产数据
- 自动生成SQL语句
- 数据可视化分析报告
- 支持复杂统计分析

**使用示例：**
- "查询各部门在用资产数量"
- "统计各类设备的折旧情况"
- "生成月度资产报表"

### 6.2 文档智能助手模式

**功能特点：**
- 技术文档智能问答
- 文档内容检索
- 知识推荐
- 多文档对比分析

**使用示例：**
- "查找CT设备使用手册"
- "医疗设备维护规范有哪些"
- "比较不同设备的参数差异"

### 6.3 维修AI助手模式

**功能特点：**
- 维修日志智能分析
- 故障诊断建议
- 保养计划推荐
- 维修成本分析

**使用示例：**
- "本月维修记录统计"
- "分析设备故障原因"
- "推荐下月保养计划"

### 6.4 智能搜索模式

**功能特点：**
- 历史问答检索
- 快速定位问题
- 查询历史管理
- 问答记录导出

**使用示例：**
- "搜索关于资产调配的问题"
- "查看历史分析记录"
- "导出本月所有问答"

## 七、权限配置

### 7.1 菜单权限

| 菜单 | 角色 | 权限说明 |
|-----|------|---------|
| 资产AI助手 | 所有用户 | 查看菜单 |
| 统一AI入口 | 所有用户 | 使用AI助手 |
| SQL智能分析 | 所有用户 | 数据查询权限 |
| 维修AI助手 | 维修人员 | 维修日志权限 |
| 智能搜索 | 所有用户 | 记录查看权限 |

### 7.2 角色配置

```sql
-- 超级管理员和系统管理员拥有所有权限
INSERT INTO role_permissions (role_name, permission_key, menu_key)
VALUES
    ('super_admin', 'ai-assistant:view', 'ai-assistant-parent'),
    ('system_admin', 'ai-assistant:view', 'ai-assistant-parent'),
    ('maintenance_staff', 'ai-assistant:maintenance:use', 'ai-maintenance');
```

## 八、部署步骤

### 8.1 前端部署

1. 确保安装了依赖：
```bash
cd frontend
npm install
```

2. 启动开发服务器：
```bash
npm run dev
```

3. 构建生产版本：
```bash
npm run build
```

### 8.2 后端部署

1. 执行数据库配置脚本：
```bash
mysql -u root -p zcgl < backend/scripts/create-asset-ai-assistant-module.sql
```

2. 重启后端服务：
```bash
cd backend
node server.js
```

### 8.3 SQLBot服务

确保SQLBot服务正常运行：
```bash
# 启动SQLBot服务（端口8000）
cd /path/to/sqlbot
npm start
```

## 九、常见问题

### Q1: iframe无法加载？

**解决方法：**
1. 检查SQLBot服务是否正常运行
2. 确认防火墙允许8000端口访问
3. 检查浏览器控制台是否有跨域错误
4. 尝试使用传统模式访问

### Q2: API请求返回401？

**解决方法：**
1. 确保用户已登录系统
2. 检查token是否过期
3. 确认用户有相应权限

### Q3: 快捷提问无响应？

**解决方法：**
1. 检查网络连接
2. 确认AI服务正常运行
3. 查看浏览器控制台错误信息

### Q4: 如何切换到传统模式？

**解决方法：**
1. 在统一界面点击"功能选择"Tab
2. 点击需要的功能卡片
3. 系统会自动跳转到独立页面

## 十、监控与维护

### 10.1 API状态监控

系统会自动检查以下API状态：
- SQLBot服务（`/api/v1/health`）
- 阿里百炼（`/api/asset-ai-analysis/dimensions`）
- 维修AI（`/api/maintenance/ai/analysis`）

### 10.2 日志记录

AI助手的所有请求都会记录到系统日志，包括：
- 请求时间
- 用户ID
- 使用的模式
- 查询内容
- 响应状态

### 10.3 性能优化

- iframe加载优化（加载状态显示）
- API请求缓存
- 快捷问题预加载
- 历史记录本地缓存

## 十一、后续优化建议

### 11.1 功能增强

- [ ] 添加语音识别和合成
- [ ] 支持多轮对话上下文
- [ ] 添加对话历史导出
- [ ] 集成更多AI模型

### 11.2 性能优化

- [ ] 实现服务端渲染
- [ ] 添加请求超时处理
- [ ] 优化iframe加载速度
- [ ] 实现请求队列管理

### 11.3 用户体验

- [ ] 添加个性化设置
- [ ] 支持自定义快捷问题
- [ ] 添加使用引导教程
- [ ] 优化移动端适配

---

## 附录A：文件完整代码

### A.1 AssetAIAssistant.jsx

详见 `frontend/src/pages/AssetAIAssistant.jsx`

### A.2 ai-assistant.js

详见 `backend/routes/ai-assistant.js`

### A.3 SQL配置脚本

详见 `backend/scripts/create-asset-ai-assistant-module.sql`

---

**文档版本：** 1.0
**更新日期：** 2026-02-13
**维护人员：** 系统管理员
