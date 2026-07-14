# Runtime Context

Use this reference when the task needs the real OpenClaw + AssetHub runtime chain, auth inheritance rules, or fixed tool workflows.

## Runtime chain

1. Frontend AI page calls `POST /api/ai/chat/completions`.
2. Backend resolves JWT and `X-Tenant-ID`.
3. Backend registers short-lived `_auth_context_id`.
4. Backend injects session helper context and tool runtime context.
5. Backend forwards to OpenClaw Gateway `/v1/chat/completions`.
6. OpenClaw decides whether to call `assethub_*` MCP tools.
7. `mcp-assethub` restores token / tenant from `_auth_context_id` and calls real AssetHub REST APIs.
8. Tool results return to OpenClaw and are summarized into Chinese.

## Runtime rules

- `_auth_context_id` is mandatory whenever runtime context provides it.
- If runtime context also provides `tenant_id` and the tool supports `tenant_id`, pass it through unchanged.
- Runtime context is dynamic input, not long-term memory.
- Do not treat Web session helper JSON as final truth; MCP results are the factual source.
- Do not expose `_auth_context_id`, token, or internal runtime JSON in user-facing replies.

## Tenant / role handling

- AssetHub is multi-tenant; tenant binding is required for queries and writes.
- If role is `super_admin` and tenant is not explicit, do not perform tenant-scoped reads or writes.
- Do not guess tenant values from earlier conversation or UI labels.

## Fixed workflows

### Identity / scope questions

First tool: `assethub_get_current_auth_context`

Use it for:

- current username
- current role
- current tenant
- menus / permissions / enabled modules

### Business queries

1. If tenant / permission boundary matters, call `assethub_get_current_auth_context` first.
2. Then call the direct business tool.
3. If multiple candidate targets exist, ask for confirmation before acting.

### Write operations

Always use:

1. confirm auth / tenant scope
2. query target first
3. confirm ambiguity if needed
4. execute write
5. re-query and report result

If the write is still blocked by a repeated high-risk confirmation / approval response after the explicit confirmation step:

- stop retrying
- tell the user query APIs are normal
- tell the user the write must continue in the Web management UI or via administrator-approved API access

## Tool routing hints

- Prefer direct business tools such as:
  - `assethub_list_assets`
  - `assethub_get_asset`
  - `assethub_list_users`
  - `assethub_transfer_asset`
  - `assethub_update_role_permissions`

## IoT / location notes

- Prefer new environment tools:
  - `assethub_get_environment_latest_by_device`
  - `assethub_get_environment_latest_by_asset`
  - `assethub_get_environment_asset_series`
- Treat `assethub_get_environment_records` and `assethub_get_environment_alerts` as compatibility placeholders.
- For zone-location writes:
  - `assethub_ingest_zone_location_sample` is the management-side sample writer.
  - `assethub_ingest_zone_location_batch` is the hardware/gateway ingest path and usually needs a separate IoT ingest token.

## Canonical source

If you need the full original detail, read:

- [openclaw-assethub-runtime-memory.md](/Users/cjlee/PJ/AssetHub/docs/openclaw-assethub-runtime-memory.md)
