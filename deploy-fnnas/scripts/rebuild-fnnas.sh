#!/bin/bash
# AssetHub 飞牛 NAS 重新构建并部署
# 用法: bash scripts/rebuild-fnnas.sh
#       （按提示输入 SSH 密码）

set -e

NAS_HOST="192.168.1.132"
NAS_USER="admin"
NAS_DEPLOY_DIR="/vol1/1000/assethub/deploy-fnnas"
LOCAL_PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

echo "=== AssetHub 飞牛 NAS 重新构建并部署 ==="
echo "NAS: $NAS_USER@$NAS_HOST"
echo "本地工程: $LOCAL_PROJECT_DIR"
echo "NAS 部署目录: $NAS_DEPLOY_DIR"
echo ""

# ============================================
# 第 1 步：同步最新代码到 NAS
# ============================================
echo "📦 [1/5] 同步最新代码到 NAS ..."
ssh -o StrictHostKeyChecking=no "$NAS_USER@$NAS_HOST" "mkdir -p $NAS_DEPLOY_DIR"

# 只同步 deploy-fnnas 目录（包含 docker-compose、env、Dockerfile、SQL）
rsync -avz --delete \
  -e "ssh -o StrictHostKeyChecking=no" \
  "$LOCAL_PROJECT_DIR/deploy-fnnas/" \
  "$NAS_USER@$NAS_HOST:$NAS_DEPLOY_DIR/"

# 同时同步 backend 和 frontend 源码（Dockerfile 上下文需要）
echo "📦 同步 backend 源码 ..."
ssh -o StrictHostKeyChecking=no "$NAS_USER@$NAS_HOST" "mkdir -p $NAS_DEPLOY_DIR/../backend $NAS_DEPLOY_DIR/../frontend"
rsync -avz --delete \
  --exclude 'node_modules' --exclude 'uploads' --exclude 'logs' --exclude 'backups' \
  --exclude '.git' --exclude '*.log' \
  -e "ssh -o StrictHostKeyChecking=no" \
  "$LOCAL_PROJECT_DIR/backend/" \
  "$NAS_USER@$NAS_HOST:$NAS_DEPLOY_DIR/../backend/"

echo "📦 同步 frontend 源码 ..."
rsync -avz --delete \
  --exclude 'node_modules' --exclude 'dist' \
  --exclude '.git' --exclude '*.log' \
  -e "ssh -o StrictHostKeyChecking=no" \
  "$LOCAL_PROJECT_DIR/frontend/" \
  "$NAS_USER@$NAS_HOST:$NAS_DEPLOY_DIR/../frontend/"

echo "✅ 代码同步完成"
echo ""

# ============================================
# 第 2 步：在 NAS 上停止并删除旧容器（保留数据卷）
# ============================================
echo "🛑 [2/5] 停止旧容器（保留 mysql-data / redis-data 卷，避免丢数据）..."
ssh -o StrictHostKeyChecking=no "$NAS_USER@$NAS_HOST" "cd $NAS_DEPLOY_DIR && \
  docker compose down --remove-orphans 2>/dev/null || true"
echo "✅ 旧容器已停止"
echo ""

# ============================================
# 第 3 步：清理旧的后端 / 前端镜像（强制重建）
# ============================================
echo "🧹 [3/5] 清理旧镜像..."
ssh -o StrictHostKeyChecking=no "$NAS_USER@$NAS_HOST" "docker rmi assethub-backend assethub-frontend 2>/dev/null || true"
echo "✅ 旧镜像已清理"
echo ""

# ============================================
# 第 4 步：在 NAS 上重新构建后端 + 前端镜像
# ============================================
echo "🔨 [4/5] 重新构建镜像（首次约 5-10 分钟，请耐心等待）..."
ssh -o StrictHostKeyChecking=no "$NAS_USER@$NAS_HOST" "cd $NAS_DEPLOY_DIR && \
  docker compose build --no-cache --pull backend frontend 2>&1 | tail -40"
echo "✅ 镜像构建完成"
echo ""

# ============================================
# 第 5 步：启动服务并验证健康状态
# ============================================
echo "🚀 [5/5] 启动服务..."
ssh -o StrictHostKeyChecking=no "$NAS_USER@$NAS_HOST" "cd $NAS_DEPLOY_DIR && \
  docker compose up -d"

echo "⏳ 等待 15 秒让 MySQL 初始化..."
sleep 15

echo ""
echo "📊 容器状态："
ssh -o StrictHostKeyChecking=no "$NAS_USER@$NAS_HOST" "cd $NAS_DEPLOY_DIR && docker compose ps"

echo ""
echo "🔍 健康检查（最多等 60 秒）："
for i in $(seq 1 12); do
  HEALTH=$(curl -sS --max-time 5 http://$NAS_HOST:5666/api/health 2>/dev/null || echo "")
  if echo "$HEALTH" | grep -q '"database":"ok"'; then
    echo "✅ 健康检查通过！"
    echo "$HEALTH"
    break
  fi
  echo "  第 $i 次尝试：服务尚未就绪..."
  sleep 5
done

echo ""
echo "================================================"
echo "✅ 部署完成！"
echo "🌐 访问地址: http://$NAS_HOST:5666"
echo "🔧 查看实时日志: ssh $NAS_USER@$NAS_HOST 'cd $NAS_DEPLOY_DIR && docker compose logs -f backend'"
echo "================================================"