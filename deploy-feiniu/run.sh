#!/bin/bash
# AssetHub 飞牛服务器部署 - 本地运行脚本

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=========================================="
echo "  AssetHub 飞牛部署 - 本地运行"
echo "=========================================="
echo ""

# 创建必要的目录
mkdir -p data/uploads data/backups data/logs nginx

# 复制 nginx 配置（如果不存在）
if [ ! -f nginx/default.conf ]; then
    if [ -f default.conf ]; then
        cp default.conf nginx/default.conf
    fi
fi

# 启动服务
echo "启动服务..."
docker-compose up -d

echo ""
echo "等待服务启动..."
sleep 10

# 检查服务状态
echo ""
echo "服务状态检查："
docker-compose ps

echo ""
echo "=========================================="
echo "  ✅ 服务启动完成！"
echo "=========================================="
echo ""
echo "访问地址："
echo "  前端: http://localhost"
echo "  后端: http://localhost:5183"
echo ""
echo "查看日志："
echo "  docker-compose logs -f"
echo ""
echo "停止服务："
echo "  ./stop.sh"
echo ""
