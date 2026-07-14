#!/usr/bin/env bash
set -euo pipefail

API_URL="${ASSETHUB_API_URL:-http://localhost:5183/api}"
SESSION_FILE="${ASSETHUB_SESSION_FILE:-/tmp/assethub-direct-api-session.json}"

print_help() {
  cat <<'EOF'
AssetHub direct API helper

Usage:
  bash scripts/assethub_api.sh login
  bash scripts/assethub_api.sh modules
  bash scripts/assethub_api.sh module <path>
  bash scripts/assethub_api.sh request <METHOD> <PATH> [JSON_BODY]

Environment:
  ASSETHUB_API_URL
  ASSETHUB_API_USERNAME
  ASSETHUB_API_PASSWORD
  ASSETHUB_TENANT_ID
  ASSETHUB_SESSION_FILE
  ASSETHUB_IDEMPOTENCY_KEY
  ASSETHUB_HIGH_RISK_CONFIRM

Examples:
  bash scripts/assethub_api.sh login
  bash scripts/assethub_api.sh modules
  bash scripts/assethub_api.sh module assets
  bash scripts/assethub_api.sh request GET /assets?page=1&pageSize=20
  bash scripts/assethub_api.sh request POST /maintenance/ai/submit-request '{"asset_code":"A001","fault_description":"无法开机","issue_description":"无法开机","source":"assetclaw","intent":"repair_request"}'
  ASSETHUB_HIGH_RISK_CONFIRM=YES bash scripts/assethub_api.sh request DELETE /assets/123
EOF
}

normalize_url() {
  local raw="${1:-/}"
  raw="${raw## }"
  raw="${raw%% }"

  if [[ "$raw" =~ ^https?:// ]]; then
    printf '%s\n' "$raw"
    return
  fi

  if [[ "$raw" != /* ]]; then
    raw="/$raw"
  fi

  if [[ "$raw" == /api/* ]]; then
    raw="${raw:4}"
  fi

  printf '%s%s\n' "${API_URL%/}" "$raw"
}

read_session_field() {
  local field="$1"
  SESSION_FILE="$SESSION_FILE" FIELD_NAME="$field" node <<'NODE'
const fs = require('node:fs');
const sessionFile = process.env.SESSION_FILE;
const fieldName = process.env.FIELD_NAME;

if (!fs.existsSync(sessionFile)) {
  process.exit(1);
}

const session = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
const value = session[fieldName];
if (value === undefined || value === null) {
  process.exit(1);
}
process.stdout.write(String(value));
NODE
}

is_write_method() {
  local method
  method="$(printf '%s' "${1:-}" | tr '[:lower:]' '[:upper:]')"
  case "$method" in
    POST|PUT|PATCH|DELETE)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

generate_idempotency_key() {
  node <<'NODE'
const crypto = require('node:crypto');
const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '');
process.stdout.write(`assethub-${timestamp}-${crypto.randomUUID()}`);
NODE
}

extract_confirm_token() {
  local payload="${1:-}"
  PAYLOAD_JSON="$payload" node <<'NODE'
try {
  const payload = JSON.parse(process.env.PAYLOAD_JSON || '{}');
  if (payload && typeof payload.confirmToken === 'string') {
    process.stdout.write(payload.confirmToken);
  }
} catch (error) {}
NODE
}

high_risk_confirm_enabled() {
  local value="${ASSETHUB_HIGH_RISK_CONFIRM:-}"
  case "$value" in
    YES|yes|true|TRUE|1)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

login() {
  local username="${ASSETHUB_API_USERNAME:-}"
  local password="${ASSETHUB_API_PASSWORD:-}"

  if [[ -z "$username" || -z "$password" ]]; then
    echo "Missing ASSETHUB_API_USERNAME or ASSETHUB_API_PASSWORD" >&2
    exit 1
  fi

  local response
  response="$(curl -sS -X POST "$(normalize_url /users/login)" \
    -H 'Content-Type: application/json' \
    --data-binary "{\"username\":\"${username}\",\"password\":\"${password}\"}")"

  RESPONSE_JSON="$response" SESSION_FILE="$SESSION_FILE" API_URL="$API_URL" ASSETHUB_TENANT_ID="${ASSETHUB_TENANT_ID:-}" node <<'NODE'
const fs = require('node:fs');
const raw = process.env.RESPONSE_JSON || '';
const payload = JSON.parse(raw);

if (!payload || payload.success === false || !payload.data || !payload.data.token) {
  console.error(raw);
  process.exit(1);
}

const tenantFromEnv = process.env.ASSETHUB_TENANT_ID || '';
const session = {
  apiUrl: process.env.API_URL,
  token: payload.data.token,
  user: payload.data.user || null,
  enterprises: payload.data.enterprises || [],
  tenant_id: tenantFromEnv || payload.data.user?.tenant_id || null,
  saved_at: new Date().toISOString(),
};

fs.writeFileSync(process.env.SESSION_FILE, `${JSON.stringify(session, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  success: true,
  session_file: process.env.SESSION_FILE,
  tenant_id: session.tenant_id,
  user: session.user,
}, null, 2));
NODE
}

ensure_session() {
  if [[ ! -f "$SESSION_FILE" ]]; then
    login >/dev/null
  fi
}

perform_request() {
  local method="$1"
  local target_path="$2"
  local body="${3:-}"
  local idempotency_key="${4:-${ASSETHUB_IDEMPOTENCY_KEY:-}}"
  local confirm_token="${5:-}"

  ensure_session

  local token
  token="$(read_session_field token)"

  local tenant_id="${ASSETHUB_TENANT_ID:-}"
  if [[ -z "$tenant_id" ]]; then
    tenant_id="$(read_session_field tenant_id || true)"
  fi

  local url
  url="$(normalize_url "$target_path")"

  local -a curl_args
  curl_args=(
    -sS
    -X "$method"
    "$url"
    -H "Authorization: Bearer $token"
    -w $'\n__STATUS__:%{http_code}'
  )

  if [[ -n "$tenant_id" ]]; then
    curl_args+=(-H "X-Tenant-ID: $tenant_id")
  fi

  if is_write_method "$method"; then
    if [[ -z "$idempotency_key" ]]; then
      idempotency_key="$(generate_idempotency_key)"
    fi
    curl_args+=(-H "Idempotency-Key: $idempotency_key")
  fi

  if [[ -n "$confirm_token" ]]; then
    curl_args+=(-H "X-Risk-Confirm-Token: $confirm_token")
  fi

  if [[ -n "$body" ]]; then
    curl_args+=(-H 'Content-Type: application/json' --data-binary "$body")
  fi

  local response
  response="$(curl "${curl_args[@]}")"

  local status="${response##*$'\n'__STATUS__:}"
  local payload="${response%$'\n'__STATUS__:*}"

  if [[ "$status" == "401" ]]; then
    rm -f "$SESSION_FILE"
    login >/dev/null
    perform_request "$method" "$target_path" "$body" "$idempotency_key" "$confirm_token"
    return
  fi

  if [[ "$status" == "428" ]]; then
    local next_confirm_token=""
    next_confirm_token="$(extract_confirm_token "$payload" || true)"

    if high_risk_confirm_enabled && [[ -z "$confirm_token" && -n "$next_confirm_token" ]]; then
      perform_request "$method" "$target_path" "$body" "$idempotency_key" "$next_confirm_token"
      return
    fi

    printf '%s\n' "$payload"
    if [[ -n "$confirm_token" ]]; then
      echo "High-risk write is still gated after the confirmation replay. Continue in the Web management UI or contact an administrator to enable API write access for this path." >&2
    else
      echo "High-risk confirmation required. Re-run the same request with ASSETHUB_HIGH_RISK_CONFIRM=YES to replay it using the returned confirm token." >&2
    fi
    exit 1
  fi

  printf '%s\n' "$payload"

  if [[ "$status" -ge 400 ]]; then
    exit 1
  fi
}

main() {
  local command="${1:-}"

  case "$command" in
    ""|-h|--help)
      print_help
      ;;
    login)
      login
      ;;
    modules)
      perform_request GET /api-documentation/modules
      ;;
    module)
      local module_path="${2:-}"
      if [[ -z "$module_path" ]]; then
        echo "module path is required" >&2
        exit 1
      fi
      perform_request GET "/api-documentation/module/$module_path"
      ;;
    request)
      local method="${2:-}"
      local target_path="${3:-}"
      local body="${4:-}"
      if [[ -z "$method" || -z "$target_path" ]]; then
        echo "request requires METHOD and PATH" >&2
        exit 1
      fi
      method="$(printf '%s' "$method" | tr '[:lower:]' '[:upper:]')"
      perform_request "$method" "$target_path" "$body"
      ;;
    *)
      echo "Unknown command: $command" >&2
      exit 1
      ;;
  esac
}

main "$@"
