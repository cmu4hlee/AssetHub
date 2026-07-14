---
name: "openclaw-assethub-direct-api"
description: "Use when the task is to query or operate on AssetHub by making direct HTTP API calls instead of `assethub` MCP tools, especially when the runtime only supports shell/HTTP execution and needs explicit login, tenant headers, guarded-write idempotency handling, AI-safe repair submission, and query-before-write workflows."
---

# OpenClaw AssetHub Direct API Skill

Use this skill when the runtime should call AssetHub REST APIs directly rather than using the `assethub_*` MCP tools.

## When to use

- The task explicitly asks for direct API calling.
- The runtime does not provide `assethub` MCP tools.
- You need deterministic HTTP request control, custom headers, explicit confirmation handshakes, or direct replayable request logs.
- You need to complete AssetHub asset-management actions through `/api/*`.

## Core rules

- Treat AssetHub as a multi-tenant system.
- Prefer direct HTTP calls to AssetHub business APIs over simulated answers.
- Do not hardcode username, password, token, or tenant into the skill body.
- Final user-facing replies should be in Chinese.
- Do not claim a write succeeded until you re-query the target object or list.
- Guarded or destructive writes should use a stable `Idempotency-Key`.
- AI or skill created repair requests must use `POST /api/maintenance/ai/submit-request`.
- `POST /api/maintenance/ai/submit-request` is the safe repair entry: it should not require a second high-risk confirmation and still creates a request in `待审批`.
- If a guarded write returns `HIGH_RISK_CONFIRMATION_REQUIRED`, ask for an explicit second confirmation before replaying the same request.
- If the same guarded write still returns `HIGH_RISK_CONFIRMATION_REQUIRED` after the confirmation replay, stop automation and tell the user the action must continue in the Web admin UI or through an administrator-granted API write path.

## Runtime contract

- Read connection settings from environment:
  - `ASSETHUB_API_URL`
  - `ASSETHUB_API_USERNAME`
  - `ASSETHUB_API_PASSWORD`
  - `ASSETHUB_TENANT_ID` when an explicit tenant is needed
  - `ASSETHUB_IDEMPOTENCY_KEY` when the caller must pin a write key across retries
  - `ASSETHUB_HIGH_RISK_CONFIRM=YES` only after an explicit second confirmation for the same guarded write, not for `/maintenance/ai/submit-request`
  - `ASSETHUB_IOT_TOKEN` only for device ingest paths
- Use `scripts/assethub_api.sh` for login, module discovery, and generic requests.
- If the current user is `super_admin` and the task is tenant-scoped, require an explicit tenant before reading or writing tenant data.

## Default workflow

### Login

1. Run `bash scripts/assethub_api.sh login`
2. Save the returned token and tenant context

### Discover

Before non-core or unfamiliar operations, inspect runtime docs:

- `bash scripts/assethub_api.sh modules`
- `bash scripts/assethub_api.sh module assets`
- `bash scripts/assethub_api.sh module maintenance`

### Query-before-write

For writes, always follow:

1. Query the target object first
2. Confirm the object ID or code
3. If the task is AI or skill submitted repair creation, call `/maintenance/ai/submit-request`
4. For other guarded writes, send the write with a stable `Idempotency-Key`
5. If the backend requires high-risk confirmation for a guarded write, ask the user to confirm again before replaying the same request
6. If the confirmed replay is still blocked, stop and hand off to the Web approval or admin authorization flow
7. Query again and summarize the final state when the write actually succeeds

### Generic request template

```bash
bash scripts/assethub_api.sh request GET /assets?page=1&pageSize=20
bash scripts/assethub_api.sh request POST /maintenance/ai/submit-request '{"asset_code":"A001","fault_description":"无法开机","issue_description":"无法开机","source":"assetclaw","intent":"repair_request"}'
```

## Tool-selection rules inside this skill

- Use the helper script first:
  - `login`
  - `modules`
  - `module <path>`
  - `request <METHOD> <PATH> [JSON_BODY]`
- The helper script auto-adds `Idempotency-Key` on writes; this is fine for `/maintenance/ai/submit-request`, but the safe repair entry does not rely on that header to bypass the high-risk gate.
- The helper script only auto-replays one `428 HIGH_RISK_CONFIRMATION_REQUIRED` challenge when `ASSETHUB_HIGH_RISK_CONFIRM=YES` is explicitly set for that exact guarded-write retry.
- If the confirmed replay is still rejected with the same high-risk response, treat the write as locked behind Web approval or administrator enablement.
- If the runtime restricts script-based networking, drop to raw top-level `curl` commands from `references/auth-and-workflows.md`.

## Domain hints

### Assets

- Start with `/assets` for list, detail, create, update, delete.
- If multiple assets match, ask the user to confirm which asset to operate on.

### Transfers

- Query asset first.
- Then use `/assets/{id}/transfer-apply`.
- Re-check with `/assets/transfer-requests`.

### Maintenance

- For create request, send `fault_description`.
- For AI or skill submitted repair requests, always use `/maintenance/ai/submit-request`.
- This safe repair path does not need a second high-risk confirmation and the created request still remains in `待审批`.
- To stay compatible with older docs, also include `issue_description` with the same value when helpful.

### Inventory / idle / scrapping

- Use the core module endpoints directly.
- Keep the same query-before-write pattern.

## Guardrails

- Do not guess missing tenant context for `super_admin`.
- Do not tell the user that repair creation through `/api/maintenance/ai/submit-request` needs a second risk confirmation.
- Do not treat older docs as stronger than current route implementation.
- Do not send IoT ingest traffic with ordinary user JWT unless the interface explicitly supports that mode.
- Do not skip post-write verification for transfer, scrapping, inventory, or maintenance actions.
- Do not reuse one `Idempotency-Key` across different write payloads.
- Do not silently auto-confirm destructive or approval-style actions from a single user instruction.
- Do not keep retrying a guarded write after a confirmed replay is still blocked; report that query APIs are available but high-risk writes are currently gated.

## References

Open only what you need:

- Authentication model, headers, error handling, and common workflows:
  `references/auth-and-workflows.md`
- Core asset-management endpoint map and field compatibility notes:
  `references/asset-management-endpoints.md`

If behavior looks inconsistent, inspect the current implementation in:

- `backend/routes/`
- `backend/services/`
- `docs/API_全量接口说明_供AI读取.md`
