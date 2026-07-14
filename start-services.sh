#!/usr/bin/env bash

set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
LOG_DIR="$ROOT_DIR/logs"
BACKEND_LOG="$LOG_DIR/backend-start.log"
FRONTEND_LOG="$LOG_DIR/frontend-start.log"
REDIS_LOG="$LOG_DIR/redis-start.log"

BACKEND_PORT=5183
FRONTEND_PORT=13579
REDIS_PORT=6379
BACKEND_BIND_HOST="${BACKEND_BIND_HOST:-0.0.0.0}"
FRONTEND_BIND_HOST="${FRONTEND_BIND_HOST:-0.0.0.0}"
BACKEND_START_CMD="${BACKEND_START_CMD:-SERVER_HOST=$BACKEND_BIND_HOST npm start}"
FRONTEND_MODE="${FRONTEND_MODE:-preview}"
if [ "$FRONTEND_MODE" = "dev" ]; then
  FRONTEND_START_CMD="${FRONTEND_START_CMD:-npm run dev -- --host $FRONTEND_BIND_HOST --port $FRONTEND_PORT}"
else
  FRONTEND_START_CMD="${FRONTEND_START_CMD:-npm run preview -- --host $FRONTEND_BIND_HOST --port $FRONTEND_PORT}"
fi
FRONTEND_BUILD_ON_START="${FRONTEND_BUILD_ON_START:-true}"

# macOS GUI 启动（如双击 .app）时，PATH 常不包含 npm 的安装目录。
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.npm-global/bin:$PATH"

mkdir -p "$LOG_DIR"

ts() {
  date +"%Y-%m-%d %H:%M:%S"
}

log_info() {
  echo "[$(ts)] [INFO] $*"
}

log_warn() {
  echo "[$(ts)] [WARN] $*"
}

log_error() {
  echo "[$(ts)] [ERROR] $*" >&2
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

show_last_log_lines() {
  local file="$1"
  local lines="${2:-80}"
  if [ -f "$file" ]; then
    echo "----- $file (last $lines lines) -----"
    tail -n "$lines" "$file"
    echo "----- end -----"
  fi
}

kill_if_our_node_process() {
  local port="$1"
  local pids
  pids="$(lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  [ -z "$pids" ] && return 0

  local pid cmd
  for pid in $pids; do
    cmd="$(ps -p "$pid" -o command= 2>/dev/null || true)"
    if [ -z "$cmd" ]; then
      cmd="$(lsof -nP -p "$pid" 2>/dev/null | awk 'NR==2 {print $1}' || true)"
    fi
    if echo "$cmd" | grep -Eiq "node|nodemon|vite"; then
      log_warn "端口 $port 被旧 Node 进程占用，正在终止 PID=$pid"
      kill "$pid" 2>/dev/null || true
      sleep 1
      kill -9 "$pid" 2>/dev/null || true
    else
      log_error "端口 ${port} 被非 Node 进程占用 (PID=${pid}, CMD=${cmd})，请先手动释放。"
      return 1
    fi
  done

  return 0
}

wait_for_port() {
  local port="$1"
  local timeout="${2:-30}"
  local waited=0
  while [ "$waited" -lt "$timeout" ]; do
    if lsof -iTCP:"$port" -sTCP:LISTEN -n -P >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
    waited=$((waited + 1))
  done
  return 1
}

wait_for_http_ok() {
  local url="$1"
  local timeout="${2:-30}"
  local waited=0
  while [ "$waited" -lt "$timeout" ]; do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
    waited=$((waited + 1))
  done
  return 1
}

ensure_dependencies() {
  if ! command_exists npm; then
    log_error "未检测到 npm，请先安装 Node.js。"
    exit 1
  fi

  if [ ! -d "$BACKEND_DIR/node_modules" ]; then
    log_info "后端依赖缺失，正在安装..."
    (cd "$BACKEND_DIR" && npm install) || {
      log_error "后端依赖安装失败。"
      exit 1
    }
  fi

  if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    log_info "前端依赖缺失，正在安装..."
    (cd "$FRONTEND_DIR" && npm install) || {
      log_error "前端依赖安装失败。"
      exit 1
    }
  fi
}

start_redis() {
  if redis-cli -p "$REDIS_PORT" ping >/dev/null 2>&1; then
    log_info "Redis 已运行在端口 $REDIS_PORT"
    return 0
  fi

  if ! command_exists redis-server; then
    log_warn "未找到 redis-server。后端可能降级为内存缓存模式。"
    return 0
  fi

  log_info "Redis 未运行，正在启动..."
  redis-server --daemonize yes >"$REDIS_LOG" 2>&1 || {
    log_warn "Redis 启动命令返回失败，继续尝试检查状态。"
  }

  if redis-cli -p "$REDIS_PORT" ping >/dev/null 2>&1; then
    log_info "Redis 启动成功"
    return 0
  fi

  sleep 1
  if redis-cli -p "$REDIS_PORT" ping >/dev/null 2>&1; then
    log_info "Redis 启动成功"
    return 0
  fi

  log_warn "Redis 仍不可用。后端可继续启动，但缓存/队列能力可能受限。"
  return 0
}

start_backend() {
  log_info "启动后端服务..."
  log_info "后端启动命令: $BACKEND_START_CMD"
  nohup bash -lc "cd \"$BACKEND_DIR\" && $BACKEND_START_CMD" >"$BACKEND_LOG" 2>&1 </dev/null &
  BACKEND_PID=$!
  disown "$BACKEND_PID" 2>/dev/null || true

  if ! wait_for_port "$BACKEND_PORT" 35 || ! wait_for_http_ok "http://localhost:$BACKEND_PORT/api/health" 35; then
    log_warn "后端首次启动未通过健康检查，尝试重启一次..."
    kill "$BACKEND_PID" 2>/dev/null || true
    sleep 1
    nohup bash -lc "cd \"$BACKEND_DIR\" && $BACKEND_START_CMD" >"$BACKEND_LOG" 2>&1 </dev/null &
    BACKEND_PID=$!
    disown "$BACKEND_PID" 2>/dev/null || true
    if ! wait_for_port "$BACKEND_PORT" 35 || ! wait_for_http_ok "http://localhost:$BACKEND_PORT/api/health" 35; then
      log_error "后端启动失败。"
      show_last_log_lines "$BACKEND_LOG"
      return 1
    fi
  fi

  log_info "后端启动成功: http://localhost:$BACKEND_PORT (PID=$BACKEND_PID)"
  return 0
}

prepare_frontend() {
  if ! echo "$FRONTEND_START_CMD" | grep -q "npm run preview"; then
    return 0
  fi

  if [ "$FRONTEND_BUILD_ON_START" = "true" ] || [ ! -f "$FRONTEND_DIR/dist/index.html" ]; then
    log_info "构建前端产物（preview 模式）..."
    if ! (cd "$FRONTEND_DIR" && npm run build >"$LOG_DIR/frontend-build.log" 2>&1); then
      log_error "前端构建失败。"
      show_last_log_lines "$LOG_DIR/frontend-build.log" 120
      return 1
    fi
    log_info "前端构建完成。"
  fi

  return 0
}

start_frontend() {
  log_info "启动前端服务..."
  log_info "前端启动命令: $FRONTEND_START_CMD"
  nohup bash -lc "cd \"$FRONTEND_DIR\" && $FRONTEND_START_CMD" >"$FRONTEND_LOG" 2>&1 </dev/null &
  FRONTEND_PID=$!
  disown "$FRONTEND_PID" 2>/dev/null || true

  if ! wait_for_port "$FRONTEND_PORT" 30 || ! wait_for_http_ok "http://localhost:$FRONTEND_PORT" 30; then
    log_warn "前端首次启动未通过检查，尝试重启一次..."
    kill "$FRONTEND_PID" 2>/dev/null || true
    sleep 1
    nohup bash -lc "cd \"$FRONTEND_DIR\" && $FRONTEND_START_CMD" >"$FRONTEND_LOG" 2>&1 </dev/null &
    FRONTEND_PID=$!
    disown "$FRONTEND_PID" 2>/dev/null || true
    if ! wait_for_port "$FRONTEND_PORT" 30 || ! wait_for_http_ok "http://localhost:$FRONTEND_PORT" 30; then
      log_error "前端启动失败。"
      show_last_log_lines "$FRONTEND_LOG"
      return 1
    fi
  fi

  log_info "前端启动成功: http://localhost:$FRONTEND_PORT (PID=$FRONTEND_PID)"
  return 0
}

main() {
  log_info "开始启动 AssetTube 前端、后端与 Redis..."

  kill_if_our_node_process "$BACKEND_PORT" || exit 1
  kill_if_our_node_process "$FRONTEND_PORT" || exit 1

  ensure_dependencies
  start_redis

  start_backend || exit 1
  prepare_frontend || exit 1
  start_frontend || exit 1

  log_info "全部服务启动完成。"
  log_info "前端: http://localhost:$FRONTEND_PORT"
  log_info "后端: http://localhost:$BACKEND_PORT/api/health"
  log_info "日志目录: $LOG_DIR"
}

main "$@"
