#!/bin/bash
# AssetHub 飞牛 NAS 启动脚本
# 在飞牛 NAS 上 SSH 进入后执行此脚本

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_DIR="$(dirname "$SCRIPT_DIR")"

cd "$COMPOSE_DIR"

echo "=== AssetHub 飞牛 NAS 部署 ==="
echo "工作目录: $COMPOSE_DIR"
echo ""

# 创建数据目录
mkdir -p data/backend/{uploads,backups,logs}
echo "✅ 数据目录已创建"

# 检查 docker compose 命令
if ! command -v docker &> /dev/null; then
  echo "❌ 未找到 docker，请先安装 Docker"
  exit 1
fi

if docker compose version &> /dev/null; then
  COMPOSE_CMD="docker compose"
elif command -v docker-compose &> /dev/null; then
  COMPOSE_CMD="docker-compose"
else
  echo "❌ 未找到 docker compose，请先安装"
  exit 1
fi

echo "使用命令: $COMPOSE_CMD"
echo ""

# 询问是否重建
read -p "是否清理旧容器并重建？(y/N): " REBUILD
if [[ "$REBUILD" =~ ^[Yy]$ ]]; then
  $COMPOSE_CMD down -v --remove-orphans 2>/dev/null || true
  $COMPOSE_CMD build --no-cache backend frontend
fi

echo ""
echo "🚀 启动服务..."
$COMPOSE_CMD up -d

echo ""
echo "⏳ 等待服务就绪..."
sleep 10

echo ""
echo "📊 容器状态："
$COMPOSE_CMD ps

echo ""
echo "✅ 部署完成！"
echo "🌐 局域网访问地址: http://192.168.1.132:5666"
echo "👤 默认账号: admin"
echo ""
echo "查看日志: $COMPOSE_CMD logs -f backend"