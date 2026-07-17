# AssetHub 文档中心

> 80+ 文档分类导航 · 最后更新 2026-07-18

---

## 🚀 快速开始 (新成员)

1. [项目介绍](../README.md) — AssetHub 全景
2. [项目介绍中文版](project-introduction.zh-CN.md) — 详细产品介绍
3. [模块化架构设计](modular-architecture-design.md) — 必读! 理解 48 模块怎么组织
4. [模块开发指南](module-development-guide.md) — 创建一个新模块的完整步骤
5. [模块模板](module-template.md) — copy-paste 模板
6. [API 完整文档](API完整文档.md) — 所有 API 速查

## 🏗️ 架构设计

| 文档 | 说明 |
|------|------|
| [modular-architecture-design.md](modular-architecture-design.md) | 模块化架构总设计 (48 模块的拆分原则) |
| [module-dependencies.md](module-dependencies.md) | 模块依赖关系图 |
| [module-classification-proposal.md](module-classification-proposal.md) | 模块分类方案 |
| [module-template.md](module-template.md) | 新模块的代码模板 |
| [module-development-guide.md](module-development-guide.md) | 模块开发完整指南 |
| [module-system-test-cases.md](module-system-test-cases.md) | 模块系统化测试用例 |
| [agent-mesh-architecture.md](agent-mesh-architecture.md) | AI agent mesh 微服务架构 |
| [quality-management-architecture.md](quality-management-architecture.md) | 质量管理模块架构 |
| [quality-management-interfaces.md](quality-management-interfaces.md) | 质量管理模块接口 |
| [component-refactoring-plan.md](component-refactoring-plan.md) | 组件重构计划 |
| [long-term-roadmap.md](long-term-roadmap.md) | 长期路线图 |

## 📘 API 文档

| 文档 | 说明 |
|------|------|
| [API.md](API.md) | API 概览 |
| [API完整文档.md](API完整文档.md) | **完整 API 速查 (推荐)** |
| [API_全量接口说明_供AI读取.md](API_全量接口说明_供AI读取.md) | AI 读取的全量接口 |
| [AssetHub_API_Documentation.md](AssetHub_API_Documentation.md) | 完整 API 文档 (Postman 友好) |
| [open-api-usage.zh-CN.md](open-api-usage.zh-CN.md) | OpenAPI 使用说明 |
| [swagger.json](swagger.json) | Swagger 完整 spec |
| **在线文档** | 启动后访问 <http://localhost:5183/api-docs> |
| **完整后端 API 文档** | [backend/docs/api-documentation.md](../backend/docs/api-documentation.md) (28,714 行) |

## 🔐 多租户与安全

| 文档 | 说明 |
|------|------|
| [多租户改造说明.md](多租户改造说明.md) | 多租户架构改造 |
| [多企业隔离完整分析报告.md](多企业隔离完整分析报告.md) | 隔离分析 |
| [多企业隔离改造完成总结.md](多企业隔离改造完成总结.md) | 改造总结 |
| [多企业隔离改造最终报告.md](多企业隔离改造最终报告.md) | 最终报告 |
| [多企业隔离改造进度.md](多企业隔离改造进度.md) | 进度跟踪 |
| [租户隔离完善进度报告.md](租户隔离完善进度报告.md) | 完善进度 |
| [租户隔离遗漏点检查报告.md](租户隔离遗漏点检查报告.md) | 遗漏点检查 |
| [PERMISSIONS_SYSTEM_ENHANCEMENT.md](PERMISSIONS_SYSTEM_ENHANCEMENT.md) | 权限系统增强 |
| [角色系统调整说明.md](角色系统调整说明.md) | 角色调整说明 |
| [multi-tenant-login-design.md](../backend/docs/multi-tenant-login-design.md) | 多租户登录设计 (backend) |

## 🤖 AI / 智能助手

| 文档 | 说明 |
|------|------|
| [AI助手集成指南.md](AI助手集成指南.md) | AI 助手集成 (OpenAI/通义/Ollama) |
| [AI助手全面整理与适配说明.md](AI助手全面整理与适配说明.md) | AI 助手完整整理 |
| [AI助手可扩展功能模块分析.md](AI助手可扩展功能模块分析.md) | 可扩展功能分析 |
| [AI工具扩展方案.md](AI工具扩展方案.md) | 工具扩展方案 |
| [OpenClaw技能调用说明.md](OpenClaw技能调用说明.md) | OpenClaw 技能调用 |
| [OpenClaw系统提示词与技能模板.md](OpenClaw系统提示词与技能模板.md) | OpenClaw 提示词模板 |
| [OpenClaw设备监测与故障上报说明.md](OpenClaw设备监测与故障上报说明.md) | 设备监测集成 |
| [OpenClaw长期记忆与角色权限模板.md](OpenClaw长期记忆与角色权限模板.md) | 长期记忆 |
| [openclaw-assethub-runtime-memory.md](openclaw-assethub-runtime-memory.md) | OpenClaw 运行时记忆 |
| [opencode-assethub-mcp-integration.md](opencode-assethub-mcp-integration.md) | OpenCode MCP 集成 |
| [open-api-usage.zh-CN.md](open-api-usage.zh-CN.md) | OpenAPI 中文用法 |
| [AssetHub直连API技能生成说明.md](AssetHub直连API技能生成说明.md) | 技能生成 |
| [mcp-coverage-gap-matrix.md](mcp-coverage-gap-matrix.md) | MCP 覆盖矩阵 |
| [编程辅助插件推荐.md](编程辅助插件推荐.md) | IDE 插件推荐 |
| [llm-finetune/](llm-finetune/) | LLM 微调数据 |

## 🔔 通知 / 提醒

| 文档 | 说明 |
|------|------|
| [notification-system-guide.md](notification-system-guide.md) | 通知系统完整指南 |
| [in-app-notification 集成](../backend/services/in-app-notification.service.js) | 应用内通知 (backend) |

## 📊 数据 & 资产

| 文档 | 说明 |
|------|------|
| [database-documentation.md](database-documentation.md) | **完整数据库文档 (61K 行)** |
| [资产分类字段显示规则.md](资产分类字段显示规则.md) | 资产分类规则 |
| [资产调配逻辑整理.md](资产调配逻辑整理.md) | 资产调配逻辑 |
| [maintenance-analysis-2026-07-16.md](maintenance-analysis-2026-07-16.md) | 维修分析报告 (2026-07-16) |
| [质量控制模块使用说明.md](质量控制模块使用说明.md) | 质控模块用法 |
| [质量控制模块菜单配置说明.md](质量控制模块菜单配置说明.md) | 质控菜单配置 |
| [质量管理模块功能清单.md](质量管理模块功能清单.md) | 质量管理清单 |
| [质量管理模块完善说明.md](质量管理模块完善说明.md) | 质量完善 |
| [质量管理模块数据库初始化说明.md](质量管理模块数据库初始化说明.md) | 质控 DB |
| [第三方应用故障上报接口说明.md](第三方应用故障上报接口说明.md) | 第三方故障上报 |
| [第三方程序患者量上报接口说明.md](第三方程序患者量上报接口说明.md) | 第三方患者量上报 |

## 🛠️ 部署 / 运维

| 文档 | 说明 |
|------|------|
| [开发模式启动问题排查.md](开发模式启动问题排查.md) | 开发模式排查 |
| [开发模式端口配置统一完成报告.md](开发模式端口配置统一完成报告.md) | 端口配置 |
| [端口配置统一检查报告.md](端口配置统一检查报告.md) | 端口检查 |
| [外部访问配置说明.md](外部访问配置说明.md) | 外部访问 |
| [外部访问问题排查.md](外部访问问题排查.md) | 外部访问排查 |
| 部署场景 | `deploy-local/` `deploy-feiniu/` `deploy-fnnas/` (各含 docker-compose) |
| docker-compose 配置 | `docker-compose.yml` `docker-compose.prod.yml` |
| [运维文档/](运维文档/) | 监控/备份/升级等 |

## 🐛 修复报告 / 历史

| 文档 | 说明 |
|------|------|
| [Bug修复完成报告.md](Bug修复完成报告.md) | 修复完成 |
| [Bug修复报告.md](Bug修复报告.md) | 修复记录 |
| [整理完成说明.md](整理完成说明.md) | 整理记录 |
| [项目不完整功能分析报告.md](项目不完整功能分析报告.md) | 不完整功能 |
| [项目缺失文件分析报告.md](项目缺失文件分析报告.md) | 缺失文件 |

## 🎨 前端

| 文档 | 说明 |
|------|------|
| [图表组件使用指南.md](图表组件使用指南.md) | 图表组件 |
| [提问记录菜单显示问题分析报告.md](提问记录菜单显示问题分析报告.md) | 菜单问题 |
| [API.md](API.md) | 前端 API 调用 |

## 🔍 审计 / 报告

| 文档 | 说明 |
|------|------|
| [skill-drafts/](skill-drafts/) | 技能草稿 |
| [分析报告/](分析报告/) | 各类分析报告 |
| [图表组件使用指南.md](图表组件使用指南.md) | UI 图表 |
| [规范指南/](规范指南/) | 编码规范 |
| [快速开始/](快速开始/) | 快速上手 |
| [运维文档/](运维文档/) | 运维手册 |
| [优化方案/](优化方案/) | 性能优化方案 |
| [部署文档/](部署文档/) | 部署指南 |
| [配置说明/](配置说明/) | 配置手册 |
| [问题排查/](问题排查/) | 问题排查手册 |
| [文档导航.md](文档导航.md) | 另一份导航 (较旧) |
| [文档索引.md](文档索引.md) | 另一份索引 (较旧) |
| [开源资源引用文档.md](开源资源引用文档.md) | 开源引用 |
| [开源资源版本跟踪.json](开源资源版本跟踪.json) | 版本跟踪 |

## 📦 专项维护 (按需)

| 文档 | 说明 |
|------|------|
| [maintenance-analysis-2026-07-16.md](maintenance-analysis-2026-07-16.md) | 工单管理专题 |
| [资产助手日志与查库说明.md](../backend/docs/资产助手日志与查库说明.md) | 资产助手日志 |
| [scrapping-feature.md](../backend/docs/scrapping-feature.md) | 报废功能 (backend) |

---

## 文档贡献

- 新增模块时: 在 `模块化架构设计` + `模块依赖关系` 添加模块节点
- 新增 API 时: 同步到 `API完整文档.md` 或生成 swagger 自动段
- 完成重要功能: 写一份 1-2 页的"完成报告"放这里

**最后更新**: 2026-07-18 · 由工单管理补齐 + 生产级审计同步生成
