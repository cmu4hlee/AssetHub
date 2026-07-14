#!/bin/bash
# AssetHub 飞牛服务器部署 - 部署脚本

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=========================================="
echo "  AssetHub 飞牛服务器部署"
echo "  目标: 192.168.1.132"
echo "=========================================="
echo ""

# 检查环境
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

# 检查镜像是否存在
if ! docker image inspect assethub/backend:feiniu &> /dev/null || \
   ! docker image inspect assethub/frontend:feiniu &> /dev/null; then
    echo "⚠️  镜像不存在，尝试加载..."
    if ls assethub-images-*.tar.gz &> /dev/null; then
        ./load-images.sh
    else
        echo "❌ 错误: 找不到镜像，请先加载镜像"
        exit 1
    fi
fi

# 停止现有服务
echo "停止现有服务..."
docker-compose down 2>/dev/null || true
echo ""

# 启动服务
echo "启动服务..."
docker-compose up -d

echo ""
echo "等待服务启动..."
sleep 15

# 检查服务状态
echo ""
echo "服务状态："
docker-compose ps

echo ""
echo "检查健康状态..."
sleep 5

HEALTHY_COUNT=0
for i in {1..10}; do
    HEALTHY_COUNT=$(docker-compose ps --filter health=healthy --format json | wc -l)
    if [ "$HEALTHY_COUNT" -ge 2 ]; then
        break
    fi
    echo "  等待健康检查... ($i/10)"
    sleep 5
done

if [ "$HEALTHY_COUNT" -ge 2 ]; then
    echo ""
    echo "=========================================="
    echo "  ✅ 部署完成！"
    echo "=========================================="
    echo ""
    
    # 初始化用户
    echo "正在初始化用户..."
    if [ -f "./init-users.sh" ]; then
        chmod +x ./init-users.sh 2>/dev/null || true
        ./init-users.sh
    fi
    
    echo ""
    echo "=========================================="
    echo "  系统已就绪！"
    echo "=========================================="
    echo ""
    echo "访问地址："
    echo "  前端: http://192.168.1.132"
    echo "  后端: http://192.168.1.132:5183"
    echo ""
    echo "常用命令："
    echo "  查看日志: docker-compose logs -f"
    echo "  重启服务: docker-compose restart"
    echo "  停止服务: ./stop.sh"
    echo "  重新初始化用户: ./init-users.sh"
    echo ""
else
    echo ""
    echo "⚠️  服务可能未完全启动，请检查日志"
    echo "  查看日志: docker-compose logs"
    echo ""
fi
