# Auth And Workflows

## 1. Base URL

- Default local API base: `http://localhost:5183/api`
- In skill runtime, prefer `ASSETHUB_API_URL`

The helper script normalizes both styles:

- `/assets`
- `/api/assets`

## 2. Login

### Endpoint

- `POST /api/users/login`

### Request

```json
{
  "username": "your-user",
  "password": "your-password"
}
```

### Save from response

- `data.token`
- `data.user`
- `data.user.tenant_id`
- `data.enterprises`

## 3. Common headers

Business APIs usually need:

```http
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

When tenant switching is required:

```http
X-Tenant-ID: <tenant_id>
```

For guarded write requests, also send:

```http
Idempotency-Key: <stable_key_for_this_operation>
```

The AI or skill repair safe entry is the exception:

- use `POST /api/maintenance/ai/submit-request`
- this path is whitelisted by the backend high-risk gate
- it should not require `HIGH_RISK_CONFIRMATION_REQUIRED`
- a successful submit still creates a repair request in `待审批`

## 4. Write safety restrictions

- Generate one `Idempotency-Key` per logical write operation.
- Reuse the same key for retries, token-refresh replays, and high-risk confirmation replays of the same guarded write.
- Never reuse the same key for a different payload.

High-risk writes may return:

```json
{
  "success": false,
  "code": "HIGH_RISK_CONFIRMATION_REQUIRED",
  "message": "高风险操作需要二次确认后才能执行",
  "requiresConfirmation": true,
  "actionId": "hra_xxx",
  "confirmToken": "<confirm_token>",
  "confirmTokenHeader": "X-Risk-Confirm-Token",
  "idempotencyHeader": "Idempotency-Key",
  "expiresInMs": 300000
}
```

To execute the second step, resend the same method, path, query, body, and `Idempotency-Key`, then add:

```http
X-Risk-Confirm-Token: <confirm_token>
```

- For agent flows, do not auto-confirm destructive or approval-style writes from one ambiguous instruction.
- Ask the user to confirm again before replaying a guarded high-risk write.
- If the confirmed replay still returns `HIGH_RISK_CONFIRMATION_REQUIRED`, treat the action as locked behind manual Web approval or administrator-granted API write permission.

## 5. Tenant rules

- Normal users: default to `data.user.tenant_id`
- `super_admin`: require explicit tenant selection before tenant-scoped reads or writes
- Non-admin users: do not switch `X-Tenant-ID` unless the runtime explicitly authorizes it

## 6. Standard response parsing

Treat responses with the following order:

1. `success === true` means the call succeeded
2. Read real payload from `data`
3. List payloads may appear in:
   - `data`
   - `data.list`
   - `data.records`
4. Pagination may appear in:
   - `pagination`
   - `data.pagination`

## 7. Standard error handling

- `400`: missing or invalid parameters, or missing / invalid `Idempotency-Key` on guarded writes; collect missing fields from the user
- `401`: token expired or invalid; log in again
- `403`: permission, tenant, or module restriction; do not retry the write blindly
- `409`: idempotency conflict or in-progress duplicate; do not change the payload under the same key
- `428`: guarded high-risk confirmation required; ask for a second confirmation, then resend the same request with the same `Idempotency-Key` plus `X-Risk-Confirm-Token`
- repeated `428` after the confirmation replay: stop retrying; tell the user query APIs are normal but this guarded write path is currently gated and must continue in the Web admin UI or via admin authorization
- `404`: target not found; re-run the query step
- `500`: backend error; keep request context and tell the user to retry later

## 8. Query-before-write pattern

Use this sequence for transfers, maintenance, inventory updates, idle publishing, and scrapping:

1. Query the target first
2. Confirm the target identifier
3. If this is AI or skill repair creation, use `/api/maintenance/ai/submit-request` and do not ask for a second risk confirmation
4. For other guarded writes, generate or reuse a stable `Idempotency-Key`
5. Execute the write request
6. If the backend returns `HIGH_RISK_CONFIRMATION_REQUIRED` for a guarded write, ask for a second confirmation and replay the same write with `X-Risk-Confirm-Token`
7. If the confirmed replay is still blocked, stop and report that this guarded write must go through Web approval or admin enablement
8. Query again
9. Report the final state, not just the success message

## 9. Discovery endpoints

Use runtime discovery before unfamiliar calls:

- `GET /api/api-documentation/modules`
- `GET /api/api-documentation/endpoints`
- `GET /api/api-documentation/module/{path}`

Examples:

```bash
bash scripts/assethub_api.sh modules
bash scripts/assethub_api.sh module assets
bash scripts/assethub_api.sh module maintenance
```

## 10. Helper script commands

The helper script automatically:

- caches login session state
- adds `Authorization` / `X-Tenant-ID`
- adds `Idempotency-Key` to write requests
- replays one `428 HIGH_RISK_CONFIRMATION_REQUIRED` challenge only when `ASSETHUB_HIGH_RISK_CONFIRM=YES` is explicitly set
- stops after a second `428` and reports that the guarded write is gated behind Web approval or admin authorization
- should not need the `428` replay path for `/maintenance/ai/submit-request`

### Login

```bash
bash scripts/assethub_api.sh login
```

### Modules

```bash
bash scripts/assethub_api.sh modules
```

### Single module doc

```bash
bash scripts/assethub_api.sh module assets
```

### Generic GET

```bash
bash scripts/assethub_api.sh request GET /assets?page=1&pageSize=20&search=CT
```

### Generic POST

```bash
bash scripts/assethub_api.sh request POST /maintenance/ai/submit-request '{"asset_code":"A001","fault_description":"无法开机","issue_description":"无法开机","source":"assetclaw","intent":"repair_request"}'
```

### High-risk replay

```bash
ASSETHUB_HIGH_RISK_CONFIRM=YES \
bash scripts/assethub_api.sh request DELETE /assets/123
```

## 11. Raw curl fallback

If the runtime blocks helper-script networking, call the APIs directly with top-level `curl`.

### Login with curl

```bash
curl -sS -X POST http://localhost:5183/api/users/login \
  -H 'Content-Type: application/json' \
  --data-binary '{"username":"<username>","password":"<password>"}'
```

### Discover asset module with curl

```bash
curl -sS http://localhost:5183/api/api-documentation/module/assets
```

### Query assets with curl

```bash
curl -sS 'http://localhost:5183/api/assets?page=1&pageSize=20&keyword=CT' \
  -H 'Authorization: Bearer <JWT_TOKEN>' \
  -H 'X-Tenant-ID: <tenant_id>'
```

### Create maintenance request with curl

```bash
curl -sS -X POST http://localhost:5183/api/maintenance/ai/submit-request \
  -H 'Authorization: Bearer <JWT_TOKEN>' \
  -H 'X-Tenant-ID: <tenant_id>' \
  -H 'Content-Type: application/json' \
  --data-binary '{"asset_code":"A001","fault_description":"无法开机","issue_description":"无法开机","source":"assetclaw","intent":"repair_request"}'
```

This safe path should succeed or fail with ordinary validation or permission errors. It should not require a second high-risk confirmation.

### High-risk second confirmation with curl

First attempt:

```bash
curl -sS -X DELETE http://localhost:5183/api/assets/123 \
  -H 'Authorization: Bearer <JWT_TOKEN>' \
  -H 'X-Tenant-ID: <tenant_id>' \
  -H 'Idempotency-Key: <write_key>'
```

If the response returns `HIGH_RISK_CONFIRMATION_REQUIRED`, replay the same request with the same key and the returned confirm token:

```bash
curl -sS -X DELETE http://localhost:5183/api/assets/123 \
  -H 'Authorization: Bearer <JWT_TOKEN>' \
  -H 'X-Tenant-ID: <tenant_id>' \
  -H 'Idempotency-Key: <write_key>' \
  -H 'X-Risk-Confirm-Token: <confirm_token>'
```

If this second request still returns `HIGH_RISK_CONFIRMATION_REQUIRED`, do not keep replaying it. Treat the operation as requiring:

- manual confirmation in the Web management UI
- or an administrator to enable / grant API write access for that high-risk path

Current operational interpretation:

- API queries are working normally
- repair requests submitted through `/api/maintenance/ai/submit-request` should create pending requests without a second risk confirmation
- guarded raw write paths can still remain behind approval flow

## 12. IoT exception

For device / gateway ingest interfaces, prefer IoT token mode rather than ordinary login mode.

Do not treat the ordinary asset-management login flow as the default for IoT ingest paths.
