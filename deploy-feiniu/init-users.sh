#!/bin/bash
# AssetHub 用户初始化脚本

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=========================================="
echo "  AssetHub 用户初始化"
echo "=========================================="
echo ""

cd scripts

if [ ! -d "node_modules" ]; then
    echo "正在安装依赖..."
    npm install
fi

echo ""
node init-users.js
