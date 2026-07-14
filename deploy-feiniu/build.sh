#!/bin/bash
# AssetHub 飞牛服务器部署 - 构建脚本

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=========================================="
echo "  AssetHub 飞牛部署 - 镜像构建"
echo "=========================================="
echo ""

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ 错误: Docker 未安装"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ 错误: Docker Compose 未安装"
    exit 1
fi

echo "✅ 环境检查通过"
echo ""

# 创建必要的目录
mkdir -p data/uploads data/backups data/logs nginx
echo "✅ 目录结构创建完成"
echo ""

# 复制 nginx 配置（如果不存在）
if [ ! -f nginx/default.conf ]; then
    if [ -f default.conf ]; then
        cp default.conf nginx/default.conf
        echo "✅ Nginx 配置已复制"
    fi
fi

# 构建镜像
echo "开始构建 Docker 镜像..."
echo ""

docker-compose build

echo ""
echo "=========================================="
echo "  ✅ 镜像构建完成！"
echo "=========================================="
echo ""
echo "下一步操作："
echo "  1. 本地测试: ./run.sh"
echo "  2. 保存镜像: ./save-images.sh"
echo "  3. 上传到飞牛服务器后运行: ./deploy.sh"
echo ""
