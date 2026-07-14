#!/bin/bash
# ============================================
# 资产管理系统 - 生产环境启动脚本 (macOS/Linux)
# ============================================

echo "========================================"
echo "资产管理系统 - 生产环境启动器"
echo "========================================"
echo ""

# 检查Node.js是否安装
if ! command -v node &> /dev/null; then
    echo "[错误] 未检测到Node.js，请先安装Node.js"
    echo "下载地址: https://nodejs.org/"
    exit 1
fi

echo "[信息] Node.js 版本:"
node --version
echo ""

# 获取当前脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# 检查后端目录是否存在
if [ ! -d "backend" ]; then
    echo "[错误] 未找到backend目录"
    exit 1
fi

# 检查前端目录是否存在
if [ ! -d "frontend" ]; then
    echo "[错误] 未找到frontend目录"
    exit 1
fi

# ============================================
# 检查前端是否已构建
# ============================================
echo "[1/5] 检查前端构建..."
cd "$SCRIPT_DIR/frontend"
if [ ! -d "dist" ]; then
    echo "[信息] 前端未构建，正在构建生产版本..."
    npm run build
    if [ $? -ne 0 ]; then
        echo "[错误] 前端构建失败"
        exit 1
    fi
    echo "[成功] 前端构建完成"
else
    echo "[信息] 前端已构建，跳过构建步骤"
    echo "[提示] 如需重新构建，请删除 frontend/dist 目录后重新运行此脚本"
fi
cd "$SCRIPT_DIR"

# ============================================
# 检查并安装后端依赖
# ============================================
echo "[2/5] 检查后端依赖..."
cd "$SCRIPT_DIR/backend"
if [ ! -d "node_modules" ]; then
    echo "[信息] 正在安装后端依赖，请稍候..."
    npm install
    if [ $? -ne 0 ]; then
        echo "[错误] 后端依赖安装失败"
        exit 1
    fi
    echo "[成功] 后端依赖安装完成"
else
    echo "[成功] 后端依赖已存在"
fi
cd "$SCRIPT_DIR"

# ============================================
# 检查并安装前端依赖
# ============================================
echo "[3/5] 检查前端依赖..."
cd "$SCRIPT_DIR/frontend"
if [ ! -d "node_modules" ]; then
    echo "[信息] 正在安装前端依赖，请稍候..."
    npm install
    if [ $? -ne 0 ]; then
        echo "[错误] 前端依赖安装失败"
        exit 1
    fi
    echo "[成功] 前端依赖安装完成"
else
    echo "[成功] 前端依赖已存在"
fi
cd "$SCRIPT_DIR"

# ============================================
# 启动后端服务
# ============================================
echo "[4/5] 正在启动后端服务..."
cd "$SCRIPT_DIR/backend"
npm start &
BACKEND_PID=$!
echo "[信息] 后端服务已启动，PID: $BACKEND_PID"
cd "$SCRIPT_DIR"

# 等待后端服务启动
echo "[信息] 等待后端服务启动（3秒）..."
sleep 3

# ============================================
# 启动前端生产环境预览服务器
# ============================================
echo "[5/5] 正在启动前端生产环境服务器（优先4000端口，如被占用则自动尝试4001、4002...）..."
cd "$SCRIPT_DIR/frontend"
npm run preview &
FRONTEND_PID=$!
echo "[信息] 前端服务已启动，PID: $FRONTEND_PID"
echo "[提示] 如果4000端口被占用，服务会自动尝试下一个可用端口"
cd "$SCRIPT_DIR"

# 等待一下让服务启动，然后检查实际使用的端口
sleep 2
ACTUAL_PORT=$(lsof -ti:4000 2>/dev/null && echo "4000" || (lsof -ti:4001 2>/dev/null && echo "4001" || echo "未知"))
echo "[信息] 前端服务实际运行端口: $ACTUAL_PORT"

# ============================================
# 显示启动信息
# ============================================
echo ""
echo "========================================"
echo "生产环境服务启动完成！"
echo "========================================"
echo ""
echo "后端服务: http://localhost:4001"
echo "前端服务: http://localhost:$ACTUAL_PORT"
echo ""
echo "提示:"
echo "  - 后端服务 PID: $BACKEND_PID"
echo "  - 前端服务 PID: $FRONTEND_PID"
echo "  - 前端实际端口: $ACTUAL_PORT"
echo "  - 停止服务: kill $BACKEND_PID $FRONTEND_PID"
echo "  - 如果服务启动失败，请检查端口是否被占用"
echo "  - 确保数据库配置正确（backend/.env）"
echo "  - 如果4000端口被占用，前端会自动尝试4001、4002等端口"
echo ""
echo "正在打开浏览器访问前端..."
sleep 2

# 根据操作系统打开浏览器
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    open http://localhost:4000
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    xdg-open http://localhost:4000 2>/dev/null || echo "请手动访问: http://localhost:4000"
else
    echo "请手动访问: http://localhost:4000"
fi

echo ""
echo "按 Ctrl+C 停止所有服务..."
echo ""

# 等待用户中断
wait
