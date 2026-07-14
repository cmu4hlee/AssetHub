#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
LOG_DIR="$ROOT_DIR/logs"
BACKEND_LOG="$LOG_DIR/backend-foreground.log"
FRONTEND_LOG="$LOG_DIR/frontend-foreground.log"

BACKEND_PORT="${BACKEND_PORT:-5183}"
FRONTEND_PORT="${FRONTEND_PORT:-13579}"
BACKEND_HOST="${BACKEND_BIND_HOST:-0.0.0.0}"
FRONTEND_HOST="${FRONTEND_BIND_HOST:-0.0.0.0}"

mkdir -p "$LOG_DIR"

stop_children() {
  if [[ -n "${FRONT_PID:-}" ]]; then
    kill "$FRONT_PID" 2>/dev/null || true
  fi
  if [[ -n "${BACK_PID:-}" ]]; then
    kill "$BACK_PID" 2>/dev/null || true
  fi
}

trap stop_children INT TERM EXIT

echo "[foreground] 启动后端: host=$BACKEND_HOST port=$BACKEND_PORT"
(
  cd "$BACKEND_DIR"
  SERVER_HOST="$BACKEND_HOST" PORT="$BACKEND_PORT" npm start
) >"$BACKEND_LOG" 2>&1 &
BACK_PID=$!

echo "[foreground] 构建前端..."
(
  cd "$FRONTEND_DIR"
  npm run build
) >/dev/null 2>&1

echo "[foreground] 启动前端: host=$FRONTEND_HOST port=$FRONTEND_PORT"
(
  cd "$FRONTEND_DIR"
  npm run preview -- --host "$FRONTEND_HOST" --port "$FRONTEND_PORT"
) >"$FRONTEND_LOG" 2>&1 &
FRONT_PID=$!

echo "[foreground] 服务已启动（前台守护）"
echo "[foreground] 前端: http://localhost:$FRONTEND_PORT"
echo "[foreground] 后端: http://localhost:$BACKEND_PORT/api/health"
echo "[foreground] 日志: $FRONTEND_LOG | $BACKEND_LOG"
echo "[foreground] 按 Ctrl+C 停止服务"

while true; do
  if ! kill -0 "$BACK_PID" 2>/dev/null; then
    echo "[foreground] 后端进程已退出，正在停止其余进程"
    stop_children
    exit 1
  fi

  if ! kill -0 "$FRONT_PID" 2>/dev/null; then
    echo "[foreground] 前端进程已退出，正在停止其余进程"
    stop_children
    exit 1
  fi

  sleep 1
done
