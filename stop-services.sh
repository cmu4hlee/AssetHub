#!/usr/bin/env bash

set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$ROOT_DIR/logs"
STOP_LOG="$LOG_DIR/stop-services.log"

BACKEND_PORT=5183
FRONTEND_PORT=13579
REDIS_PORT=6379

mkdir -p "$LOG_DIR"

ts() {
  date +"%Y-%m-%d %H:%M:%S"
}

log() {
  local level="$1"
  shift
  local line="[$(ts)] [$level] $*"
  echo "$line"
  echo "$line" >>"$STOP_LOG"
}

stop_port_node_processes() {
  local port="$1"
  local name="$2"
  local pids
  pids="$(lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [ -z "$pids" ]; then
    log INFO "$name 未监听端口 $port"
    return 0
  fi

  local pid cmd
  for pid in $pids; do
    cmd="$(ps -p "$pid" -o command= 2>/dev/null || true)"
    if echo "$cmd" | grep -Eiq "node|nodemon|vite"; then
      log INFO "停止 $name 进程 PID=$pid (port=$port)"
      kill "$pid" 2>/dev/null || true
      sleep 1
      kill -9 "$pid" 2>/dev/null || true
    else
      log WARN "$name 端口 $port 被非 Node 进程占用，未自动停止: PID=$pid CMD=$cmd"
    fi
  done
}

stop_redis() {
  if ! command -v redis-cli >/dev/null 2>&1; then
    log WARN "未找到 redis-cli，尝试按端口清理 redis-server 进程"
  fi

  if redis-cli -p "$REDIS_PORT" ping >/dev/null 2>&1; then
    if redis-cli -p "$REDIS_PORT" shutdown nosave >/dev/null 2>&1; then
      log INFO "Redis 已停止 (port=$REDIS_PORT)"
      return 0
    fi
    log WARN "redis-cli shutdown 失败，尝试按进程终止"
  else
    log INFO "Redis 未运行 (port=$REDIS_PORT)"
  fi

  local redis_pids
  redis_pids="$(pgrep -f "redis-server.*:${REDIS_PORT}|redis-server" || true)"
  if [ -n "$redis_pids" ]; then
    log INFO "终止 redis-server 进程: $redis_pids"
    kill $redis_pids 2>/dev/null || true
    sleep 1
    kill -9 $redis_pids 2>/dev/null || true
  fi
}

main() {
  : >"$STOP_LOG"
  log INFO "开始停止 AssetTube 服务..."

  stop_port_node_processes "$BACKEND_PORT" "后端"
  stop_port_node_processes "$FRONTEND_PORT" "前端"
  stop_redis

  sleep 1
  if lsof -iTCP:"$BACKEND_PORT" -sTCP:LISTEN -n -P >/dev/null 2>&1; then
    log WARN "后端端口仍在监听: $BACKEND_PORT"
  else
    log INFO "后端端口已释放: $BACKEND_PORT"
  fi

  if lsof -iTCP:"$FRONTEND_PORT" -sTCP:LISTEN -n -P >/dev/null 2>&1; then
    log WARN "前端端口仍在监听: $FRONTEND_PORT"
  else
    log INFO "前端端口已释放: $FRONTEND_PORT"
  fi

  if redis-cli -p "$REDIS_PORT" ping >/dev/null 2>&1; then
    log WARN "Redis 仍可访问: $REDIS_PORT"
  else
    log INFO "Redis 已不可访问: $REDIS_PORT"
  fi

  log INFO "停止流程完成。日志: $STOP_LOG"
}

main "$@"
