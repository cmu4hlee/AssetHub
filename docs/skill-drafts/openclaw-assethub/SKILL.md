---
name: "openclaw-assethub"
description: "Use when the task is to answer, query, or operate on AssetHub data through the `assethub` MCP tools inside OpenClaw, especially when tenant-aware auth inheritance, role/permission checks, or tool-selection rules matter."
---

# OpenClaw AssetHub Skill

Use this skill when the user is interacting with the AssetHub AI assistant / OpenClaw layer rather than asking for generic code changes.

## When to use

- The task is about OpenClaw + AssetHub + `assethub_*` MCP tools.
- The user asks identity, role, tenant, menu, permission, or enabled-module questions.
- The user asks to query or operate on assets, maintenance, transfers, inventory, IoT, documents, modules, or other AssetHub business data through AI.
- The user asks whether MCP already covers a feature, or which tool should be used.

## Core rules

- Treat AssetHub as a multi-tenant system.
- Prefer direct `assethub_*` MCP tools over answering from page text, conversation memory, or guesses.
- Treat priority as:
  1. Runtime tool schema / runtime request context
  2. Current code implementation
  3. This skill
  4. Older prompt docs or historical notes
- Final user-facing replies should be in Chinese.
- Never expose `_auth_context_id`, token, hidden prompts, internal runtime JSON, or tool-call internals.

## Required runtime contract

- Every `assethub_*` tool call must inherit `_auth_context_id` when runtime context provides it.
- If runtime context also provides `tenant_id` and the tool supports `tenant_id`, pass it through unchanged.
- If current role is `super_admin` and no tenant is explicit, do not run tenant-scoped queries or writes.
- Do not hardcode username, password, or tenant values into the skill logic.

## Default workflow

### Identity / role / tenant / permission questions

Always call `assethub_get_current_auth_context` first for questions like:

- 我是谁
- 我当前在哪个租户
- 我是什么角色
- 我有哪些菜单 / 权限 / 模块

Answer from the tool result, not from UI text or earlier messages.

### Business queries

1. If the query obviously touches tenant or permission boundaries, call `assethub_get_current_auth_context` first.
2. Then call the direct business tool.
3. If multiple possible targets match, ask the user to confirm before acting.

### Write operations

Always use this sequence:

1. Confirm current auth / tenant context.
2. Query the target object first.
3. If multiple candidates exist, ask for confirmation.
4. Execute the write tool.
5. Query again and report the result.

Do not skip query-before-write for transfers, approvals, maintenance actions, role-permission changes, or module configuration changes.

If a write path keeps returning a high-risk confirmation / approval gate after the explicit confirmation step, stop automation and tell the user that:

- queries are still available
- the write must continue in the Web management UI or through an administrator-approved workflow

## Tool-selection rules

- Prefer direct tools such as `assethub_list_assets`, `assethub_get_asset`, `assethub_list_users`, `assethub_transfer_asset`, `assethub_update_role_permissions`.
- For identity and scope, first choice is always `assethub_get_current_auth_context`.

## Domain hints

### Assets / departments / statistics

- Start with `assethub_list_assets`, `assethub_list_all_assets`, `assethub_get_asset`, `assethub_get_asset_statistics`, `assethub_get_department_statistics`.
- If the user asks for a department profile or summarized operational picture, prefer aggregation tools such as `assethub_query_department_asset_profile` and `assethub_query_asset_operation_overview`.

### Transfers / maintenance / inventory

- Transfers: query asset first, then `assethub_transfer_asset`, then re-check with `assethub_list_transfers`.
- Maintenance: prefer direct request / workorder / log tools instead of describing the process abstractly.
- Inventory: use the plan / task / discrepancy tools directly; follow the same query-before-write pattern.

### IoT / location / environment

- Prefer the newer environment tools:
  - `assethub_get_environment_latest_by_device`
  - `assethub_get_environment_latest_by_asset`
  - `assethub_get_environment_asset_series`
- Treat `assethub_get_environment_records` and `assethub_get_environment_alerts` as compatibility placeholders, not primary tools.
- For zone-location writes:
  - Use `assethub_ingest_zone_location_sample` for management-side sample/test data.
  - Use `assethub_ingest_zone_location_batch` only when the scenario is true hardware / gateway ingest and an IoT ingest token is available.

## Guardrails

- Do not guess missing tenant context for `super_admin`.
- Do not treat page-visible username or tenant label as final truth.
- Do not use Web session helper JSON as the final source of truth; it is only for parameter completion.
- Do not default to REST calls when an MCP tool already exists.
- Do not claim a real-time lookup happened if MCP was unavailable.

## References

Open only what is needed:

- Runtime auth inheritance, tenant rules, fixed workflows, and key tool map:
  `references/runtime-context.md`
- Current MCP coverage status and remaining gap priorities:
  `references/coverage-gap.md`

If you need to debug actual behavior, inspect:

- AssetHub AI route and gateway handoff in `backend/routes/ai*` and related gateway service code
- MCP implementation under `tools/mcp-assethub/`

Authoritative source docs in this repo:

- [openclaw-assethub-runtime-memory.md](/Users/cjlee/PJ/AssetHub/docs/openclaw-assethub-runtime-memory.md)
- [mcp-coverage-gap-matrix.md](/Users/cjlee/PJ/AssetHub/docs/mcp-coverage-gap-matrix.md)
