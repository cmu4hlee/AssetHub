#!/bin/bash
# AssetHub 飞牛服务器部署 - 加载镜像脚本

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=========================================="
echo "  AssetHub 飞牛部署 - 加载镜像"
echo "=========================================="
echo ""

# 查找最新的镜像文件
LATEST_ARCHIVE=$(ls -t assethub-images-*.tar.gz 2>/dev/null | head -1)

if [ -z "$LATEST_ARCHIVE" ]; then
    echo "❌ 错误: 找不到镜像文件"
    echo "请先上传 assethub-images-*.tar.gz 文件到当前目录"
    exit 1
fi

echo "找到镜像文件: ${LATEST_ARCHIVE}"
echo "正在加载镜像..."
echo ""

gunzip -c ${LATEST_ARCHIVE} | docker load

echo ""
echo "=========================================="
echo "  ✅ 镜像加载完成！"
echo "=========================================="
echo ""
echo "已加载镜像："
docker images "assethub/*"
echo ""
echo "下一步："
echo "  运行 ./deploy.sh 部署服务"
echo ""
