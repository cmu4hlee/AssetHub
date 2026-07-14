#!/bin/bash
# AssetHub 飞牛服务器一键部署脚本

set -e

echo "=========================================="
echo "  AssetHub 飞牛服务器一键部署"
echo "=========================================="
echo ""

DEPLOY_DIR="/tmp/assethub"
BACKEND_IMAGE="assethub-backend-feiniu.tar"
FRONTEND_IMAGE="assethub-frontend-feiniu.tar"

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ 错误: Docker 未安装"
    echo "请先安装 Docker: https://docs.docker.com/engine/install/"
    exit 1
fi

# 检查镜像文件
if [ ! -f "$DEPLOY_DIR/$BACKEND_IMAGE" ]; then
    echo "❌ 错误: 后端镜像文件不存在: $DEPLOY_DIR/$BACKEND_IMAGE"
    exit 1
fi

if [ ! -f "$DEPLOY_DIR/$FRONTEND_IMAGE" ]; then
    echo "❌ 错误: 前端镜像文件不存在: $DEPLOY_DIR/$FRONTEND_IMAGE"
    exit 1
fi

echo "✅ 环境检查通过"
echo ""

# 创建目录
mkdir -p $DEPLOY_DIR/data/uploads $DEPLOY_DIR/data/backups $DEPLOY_DIR/data/logs $DEPLOY_DIR/nginx $DEPLOY_DIR/scripts

# 加载镜像
echo "正在加载前端镜像..."
docker load -i $DEPLOY_DIR/$FRONTEND_IMAGE

echo ""
echo "正在加载后端镜像..."
docker load -i $DEPLOY_DIR/$BACKEND_IMAGE

echo ""
echo "✅ 镜像加载完成"

# 检查镜像
echo ""
echo "已加载的镜像:"
docker images | grep assethub

echo ""
echo "=========================================="
echo "  ✅ 部署准备完成！"
echo "=========================================="
echo ""
echo "下一步操作:"
echo "  1. 创建 docker-compose.yml"
echo "  2. 启动服务"
echo ""
echo "你可以继续运行:"
echo "  vim $DEPLOY_DIR/docker-compose.yml"
echo "  docker-compose -f $DEPLOY_DIR/docker-compose.yml up -d"
echo ""
