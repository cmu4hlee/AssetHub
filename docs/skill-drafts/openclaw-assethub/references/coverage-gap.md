# Coverage Gap

Use this reference when the task is to decide whether `mcp-assethub` already covers a user-facing feature, or when planning the next MCP tools to add.

## Current summary

`mcp-assethub` now covers the main OpenClaw-facing paths for:

- asset base management
- transfer / idle / scrapping core flows
- maintenance core flows
- asset workflow definitions and default workflow transitions
- technical-document enhanced flows
- module management
- most IoT / location / alert flows that matter to AI operations

Still incomplete overall: the MCP layer does not yet cover the entire main application.

## Modules that are relatively complete

- Asset base management
- Asset workflows
- Transfer / idle / scrapping
- Maintenance core flows
- Technical documents
- Module management
- IoT / location / alert core flows

## Modules still only partially covered

- Inventory: main plan/task/discrepancy flow is covered, but report/export and some detail-management tools are missing.
- Quality control: only core QC list/create/statistics are present.
- User / tenant / department management: basic user/role/tenant tools exist, but more CRUD/admin coverage is still missing.
- Risk management: query/update basics exist, full lifecycle is still incomplete.
- Acceptance and depreciation: usable, but not fully feature-complete.

## Modules still largely uncovered

- Temporary assets
- Staff qualification / training
- Uptime management
- Dashboard config / backup / integration admin flows
- Materials / barcode and other edge modules

## IoT / location status

The IoT/location area is now much stronger. Current MCP coverage includes:

- location codes CRUD
- location alerts list / stats / handle / batch handle / delete
- environment latest-by-device / latest-by-asset / asset-series / pipeline health / docs
- beacon asset list
- zone-location latest / series / pipeline health / docs
- asset-in-area query
- beacon location report
- device location data report
- zone-location sample ingest
- zone-location batch ingest

Remaining location-side finishing work is mostly:

- manual asset location update
- batch asset location query
- single-event zone ingest tool if needed

## Known placeholder / unavailable tools

These exist as compatibility names or placeholders and should not be treated as real primary coverage:

- `get_environment_records`
- `get_environment_alerts`
- `get_todo_tasks`
- `complete_task`
- several AI prediction / health tools whose backend routes are not actually mounted

## Planning guidance

If the question is “does MCP already cover this?”, check in this order:

1. `tools/mcp-assethub/` current code
2. `docs/openclaw-assethub-runtime-memory.md`
3. `docs/mcp-coverage-gap-matrix.md`

If the question is “what should we add next?”, current highest-value follow-up after recent work is:

1. location finishing tools
2. quality-control gaps
3. temporary assets
4. more tenant / department / admin management coverage

## Canonical source

If you need the full matrix, read:

- [mcp-coverage-gap-matrix.md](/Users/cjlee/PJ/AssetHub/docs/mcp-coverage-gap-matrix.md)
