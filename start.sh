#!/bin/bash
# ====================================
# AssetHub 服务启动脚本（带自动重启）
# 后端修改自动重启，前端 HMR 自动热更新
# ====================================

PROJECT_DIR="/Volumes/移动硬盘（500）/AssetHub"

# 使用 Node 22 自带的 --watch 模式
BIN="/Users/cjlee/.workbuddy/binaries/node/versions/22.22.2/bin/node"

cleanup() {
  echo "停止服务..."
  kill $BACKEND_PID 2>/dev/null
  kill $FRONTEND_PID 2>/dev/null
  exit 0
}
trap cleanup SIGINT SIGTERM

while true; do
  echo "[$(date '+%H:%M:%S')] 启动后端 (5183)..."
  cd "$PROJECT_DIR/backend"
  $BIN --watch --watch-path=./services --watch-path=./routes --watch-path=./config --watch-path=./middleware server.js &
  BACKEND_PID=$!

  echo "[$(date '+%H:%M:%S')] 启动前端 (13579)..."
  cd "$PROJECT_DIR/frontend"
  npm run dev &
  FRONTEND_PID=$!

  wait $BACKEND_PID $FRONTEND_PID
  echo "[$(date '+%H:%M:%S')] 进程退出，5秒后自动重启..."
  sleep 5
done
