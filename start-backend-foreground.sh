#!/bin/bash
# 在前台启动后端，便于查看启动日志或报错
cd "$(dirname "$0")/backend"
echo "工作目录: $(pwd)"
echo "正在启动后端 (PORT=5183)..."
node server.js
