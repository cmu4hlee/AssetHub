# Asset Management Endpoints

This file keeps the core endpoint map for the direct API skill.

If current backend behavior conflicts with older prompt docs, trust the current code implementation first.

## 1. Identity and discovery

| Purpose | Method | Path | Notes |
|---|---|---|---|
| Login | `POST` | `/api/users/login` | Get JWT and default tenant |
| Module list | `GET` | `/api/api-documentation/modules` | Runtime discovery |
| Endpoint list | `GET` | `/api/api-documentation/endpoints` | Runtime discovery |
| Module detail | `GET` | `/api/api-documentation/module/{path}` | Runtime discovery |

## 2. Assets

| Purpose | Method | Path | Notes |
|---|---|---|---|
| List assets | `GET` | `/api/assets` | Supports paging and search |
| Get asset | `GET` | `/api/assets/{id}` | Use after narrowing candidates |
| Create asset | `POST` | `/api/assets` | Known minimum fields: `asset_code`, `asset_name`, `category_id` |
| Update asset | `PUT` | `/api/assets/{id}` | Update asset record |
| Delete asset | `DELETE` | `/api/assets/{id}` | Remove asset |

Suggested list pattern:

```http
GET /api/assets?page=1&pageSize=20&search=<keyword>
```

## 3. Transfers

| Purpose | Method | Path | Notes |
|---|---|---|---|
| List transfer requests | `GET` | `/api/assets/transfer-requests` | Use before approval |
| Apply transfer | `POST` | `/api/assets/{id}/transfer-apply` | Current code accepts numeric `id` or `asset_code` |
| Approve transfer | `POST` | `/api/assets/transfer-requests/{request_id}/approve` | Supports `approved` or `action` |

### Transfer apply body

Current route requires:

- `reason`
- one of:
  - `target_department`
  - `to_department`
  - `to_department_id`

Recommended flow:

1. Query asset first
2. Confirm target department
3. Submit transfer
4. Query transfer requests again

## 4. Maintenance requests

| Purpose | Method | Path | Notes |
|---|---|---|---|
| List requests | `GET` | `/api/maintenance/requests` | Query repair requests |
| Create request (AI/skill safe entry) | `POST` | `/api/maintenance/ai/submit-request` | Preferred for AI/skill submitted repair requests; no second risk confirmation; creates a pending request with `asset_code` + `fault_description` |
| Get request | `GET` | `/api/maintenance/requests/{id}` | Request detail |
| Update request | `PUT` | `/api/maintenance/requests/{id}` | Update request |
| Approve request | `POST` | `/api/maintenance/requests/{id}/approve` | Approval endpoint |

### Compatibility note

Older generated docs sometimes mention `issue_description`.

Current service implementation requires:

- `asset_code`
- `fault_description`

Behavior note:

- use this safe entry for skill, MCP, and Web AI repair creation
- it does not bypass human approval; the created request still enters `待审批`
- original guarded write paths such as `/api/maintenance/requests` may still have separate high-risk protection semantics

Recommended request body:

```json
{
  "asset_code": "A001",
  "fault_description": "无法开机",
  "issue_description": "无法开机",
  "fault_level": "一般"
}
```

## 5. Maintenance logs

| Purpose | Method | Path | Notes |
|---|---|---|---|
| List logs | `GET` | `/api/maintenance/logs` | Query maintenance logs |
| Create log | `POST` | `/api/maintenance/logs` | Record maintenance action |
| Get log | `GET` | `/api/maintenance/logs/{id}` | Log detail |
| Update log | `PUT` | `/api/maintenance/logs/{id}` | Update log |

## 6. Inventory

| Purpose | Method | Path | Notes |
|---|---|---|---|
| List inventory records | `GET` | `/api/inventory` | Query inventory records |
| Create inventory record | `POST` | `/api/inventory` | Create inventory |
| Get inventory detail | `GET` | `/api/inventory/{id}` | Record detail |
| Add inventory detail | `POST` | `/api/inventory/{id}/details` | Append asset detail |
| Batch add details | `POST` | `/api/inventory/{id}/details/batch` | Bulk append |
| Complete inventory | `POST` | `/api/inventory/{id}/complete` | Complete record |
| Inventory statistics | `GET` | `/api/inventory/{id}/statistics` | Per-record stats |

Recommended flow:

1. Create or find inventory record
2. Add detail rows
3. Review statistics
4. Complete the record

## 7. Idle assets

| Purpose | Method | Path | Notes |
|---|---|---|---|
| List idle assets | `GET` | `/api/idle` | Query idle list |
| Publish idle asset | `POST` | `/api/idle` | `publish_person` required |
| Get idle detail | `GET` | `/api/idle/{id}` | Detail |
| Allocate idle asset | `PUT` | `/api/idle/{id}/allocate` | Re-allocation |
| Cancel idle | `PUT` | `/api/idle/{id}/cancel` | Cancel publish |

### Publish idle minimum rule

- `publish_person` is required
- at least one of:
  - `asset_code`
  - `asset_name`

## 8. Scrapping

| Purpose | Method | Path | Notes |
|---|---|---|---|
| List scrapping records | `GET` | `/api/scrapping` | Query scrapping requests |
| Create scrapping request | `POST` | `/api/scrapping` | Create request |
| Get scrapping detail | `GET` | `/api/scrapping/{id}` | Detail |
| Update scrapping request | `PUT` | `/api/scrapping/{id}` | Update request |
| Approve scrapping | `POST` | `/api/scrapping/{id}/approve` | Approval |
| Complete scrapping | `POST` | `/api/scrapping/{id}/complete` | Complete flow |

### Create scrapping minimum rule

Current route requires:

- `asset_code`
- `asset_name`
- `applicant`
- `scrapping_reason`

## 9. Suggested verification reads

After each write, re-check using one of:

- the detail endpoint
- the list endpoint with a narrow filter
- the module statistics endpoint when status changes matter

Examples:

- after transfer apply: `GET /api/assets/transfer-requests`
- after maintenance request create: `GET /api/maintenance/requests?asset_code=A001`
- after idle publish: `GET /api/idle`
- after scrapping create: `GET /api/scrapping?asset_code=A001`

## 10. What not to assume

- Do not assume older generated docs are fully aligned with current service logic.
- Do not assume transfer apply only accepts numeric IDs; current code also supports `asset_code`.
- Do not assume `issue_description` alone is enough for maintenance request create.
