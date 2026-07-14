#!/bin/bash
# AssetHub 飞牛服务器部署 - 停止服务脚本

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=========================================="
echo "  AssetHub 飞牛部署 - 停止服务"
echo "=========================================="
echo ""

docker-compose down

echo ""
echo "✅ 服务已停止"
echo ""
