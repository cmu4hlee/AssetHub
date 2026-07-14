#!/bin/bash
# AssetHub 飞牛服务器部署 - 保存镜像脚本

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=========================================="
echo "  AssetHub 飞牛部署 - 保存镜像"
echo "=========================================="
echo ""

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKEND_IMAGE="assethub/backend:feiniu"
FRONTEND_IMAGE="assethub/frontend:feiniu"
ARCHIVE_FILE="assethub-images-${TIMESTAMP}.tar.gz"

echo "正在保存镜像..."
echo "  后端镜像: ${BACKEND_IMAGE}"
echo "  前端镜像: ${FRONTEND_IMAGE}"
echo "  输出文件: ${ARCHIVE_FILE}"
echo ""

docker save ${BACKEND_IMAGE} ${FRONTEND_IMAGE} | gzip > ${ARCHIVE_FILE}

echo ""
echo "=========================================="
echo "  ✅ 镜像保存完成！"
echo "=========================================="
echo ""
echo "文件信息："
echo "  文件: ${ARCHIVE_FILE}"
echo "  大小: $(du -h ${ARCHIVE_FILE} | cut -f1)"
echo ""
echo "下一步："
echo "  1. 将 ${ARCHIVE_FILE} 上传到飞牛服务器 (192.168.1.132)"
echo "  2. 在飞牛服务器上运行 ./load-images.sh 加载镜像"
echo ""
