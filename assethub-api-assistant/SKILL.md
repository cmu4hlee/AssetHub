---
name: assethub-api-assistant
description: AssetHub 资产管理系统 API 助手。当用户需要查询资产信息、管理维修工单、处理采购申请、操作库存物料、生成分析报表、或与 AssetHub 后台 API 交互时使用此技能。支持资产管理、维修管理、采购管理、库存管理、合规管理等完整功能。
---

# AssetHub API Assistant

## Overview

This skill enables Claude to act as an AssetHub asset management system assistant, providing comprehensive API access for:

- Asset lifecycle management (create, read, update, delete)
- Maintenance workflow management (requests, workorders, plans)
- Procurement and inventory operations
- Compliance tracking (special equipment, safety inspections)
- Dashboard analytics and reporting
- AI-powered assistance (Ollama integration)

## Core Capabilities

### 1. Authentication & Multi-Tenancy

- JWT Bearer token authentication
- Multi-tenant isolation via `X-Tenant-Id` header
- User roles: `system_admin`, `asset_admin`, `user`
- Department-based access control

### 2. Asset Management

- CRUD operations for assets
- Batch import/export (Excel)
- Barcode generation and scanning
- Asset transfer workflow
- Asset status lifecycle: 在用 → 闲置 → 维修 → 调配中 → 报废

### 3. Maintenance Management

- Fault repair requests with AI natural language processing
- Workorder assignment and tracking
- Preventive maintenance planning
- Cost tracking and analytics
- Template-based maintenance procedures

### 4. Procurement & Inventory

- Purchase request workflow with approval
- Material inventory tracking
- Inbound/outbound operations
- Low stock alerts and warnings

### 5. Compliance Management

- Special equipment registration and inspection tracking
- Safety inspections (electrical, radiation, mechanical)
- Staff qualification management
- Uptime statistics and reporting

### 6. Document Management

- Technical document upload and categorization
- Document review workflow
- External sharing with upload tokens
- AI-powered document analysis

### 7. Analytics & Reporting

- Dashboard statistics
- Depreciation calculation
- Maintenance efficiency analytics
- Asset value distribution

## Quick Start

### Authentication

```javascript
// Include in request headers
{
  "Authorization": "Bearer <jwt_token>",
  "X-Tenant-Id": "<tenant_id>"  // For multi-tenant systems
}
```

### Common Response Format

```json
{
  "success": true,
  "message": "操作成功",
  "data": { ... },
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

## Workflows

### Create Asset

1. Validate required fields: `asset_code`, `asset_name`, `category_id`
2. POST to `/api/assets`
3. Handle duplicate code error (HTTP 409)

### Process Maintenance Request

1. Receive fault report (text or structured)
2. Extract: asset_code, fault_description, contact_phone
3. POST to `/api/maintenance/requests`
4. Return request ID for tracking

### Asset Transfer

1. POST to `/api/transfer` with transfer details
2. PUT to `/api/transfer/:id/approve` for approval
3. PUT to `/api/transfer/:id/complete` to execute
4. Asset status automatically updates

### Inventory Operations

1. Inbound: POST to `/api/materials/inventory/inbound`
2. Outbound: POST to `/api/materials/inventory/outbound`
3. Check warnings: GET `/api/materials/inventory/warnings`

## Important Conventions

### Asset Identification

- **Always use `asset_code` as identifier**, not `asset_id`
- Example: GET `/api/assets/ZC20240001`

### Database Configuration

- Host: `127.0.0.1`
- Port: `3306`
- User: `root`
- Database: Per-tenant isolation

### Date Formats

- Request: `YYYY-MM-DD` or `YYYY-MM-DD HH:mm:ss`
- Response: `YYYY-MM-DD HH:mm:ss`

### Status Values

| Entity | Values |
|--------|--------|
| Asset | 在用, 闲置, 维修, 报废, 调配中 |
| Maintenance | pending, in_progress, completed, cancelled |
| Transfer | pending, approved, rejected, completed |
| Scrapping | pending, appraising, approved, disposing, completed |

## API Reference

For complete API documentation including all endpoints, parameters, and response formats, refer to:

- `references/api_reference.md` - Full API documentation (~400+ endpoints)

### Quick API Lookup

| Category | Base Path | Key Operations |
|----------|-----------|----------------|
| Assets | `/api/assets` | GET list, POST create, PUT update, DELETE remove |
| Maintenance | `/api/maintenance` | requests, workorders, plans, logs |
| Inventory | `/api/inventory` | plans, tasks, discrepancies |
| Transfer | `/api/transfer` | create, approve, complete |
| Scrapping | `/api/scrapping` | create, appraise, approve, dispose |
| Procurement | `/api/procurement` | create, approve, files |
| Materials | `/api/materials` | CRUD, inventory, inbound, outbound |
| Compliance | `/api/compliance` | special-equipment, safety-inspection, staff, uptime |
| Documents | `/api/technical-documents` | upload, download, share, review |
| Dashboard | `/api/dashboard` | statistics, realtime |
| AI | `/api/ai-assistant` | query with modes: sqlbot, documents, maintenance, search |

## Resources

### references/

- `api_reference.md` - Complete AssetHub API documentation with all 400+ endpoints
- `schemas.md` - Database schema reference (asset_code conventions, tenant isolation)

### scripts/

- `api_tester.py` - Utility for testing API endpoints during development

## Error Handling

| Code | Meaning |
|------|---------|
| 1001 | Authentication required |
| 1002 | Service unavailable (DB connection failed) |
| 1003 | User not found or disabled |
| 2001 | Missing tenant information |
| 2002 | Invalid tenant ID |

## Usage Examples

### Query Assets

User: "查询研发部所有在用的电子设备"
→ GET `/api/assets?status=在用&department=研发部&category=电子设备`

### Create Maintenance Request

User: "设备 ZC001 出现故障，无法开机，需要维修"
→ POST `/api/maintenance/requests` with extracted asset_code and fault description

### Check Dashboard

User: "查看本月资产统计概览"
→ GET `/api/dashboard`

### AI Query

User: "帮我查询保修期即将到期的资产"
→ POST `/api/ai-assistant/query` with mode "search" and message about warranty expiration
