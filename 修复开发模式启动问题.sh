#!/bin/bash

# 开发模式启动问题修复脚本

echo "========================================"
echo "开发模式启动问题修复"
echo "========================================"
echo ""

# 检查并停止占用端口的进程
echo "[1/4] 检查端口占用情况..."

# 检查6000端口（前端端口）
if lsof -ti:6000 > /dev/null 2>&1; then
    echo "⚠️  端口6000被占用"
    lsof -i:6000 | head -3
    echo ""
fi

# 检查6001端口（后端端口）
if lsof -ti:6001 > /dev/null 2>&1; then
    PID=$(lsof -ti:6001 | head -1)
    PROCESS=$(ps -p $PID -o comm= 2>/dev/null)
    echo "⚠️  端口6001被占用 (PID: $PID, 进程: $PROCESS)"
    
    # 如果是Vite进程占用6001，提示用户
    if echo "$PROCESS" | grep -q "vite\|node"; then
        echo "❌ 前端进程占用了后端端口6001！"
        echo "正在停止该进程..."
        kill $PID 2>/dev/null
        sleep 1
        echo "✅ 已停止占用6001的进程"
    fi
    echo ""
fi

# 检查6002端口
if lsof -ti:6002 > /dev/null 2>&1; then
    echo "⚠️  端口6002被占用"
    lsof -i:6002 | head -3
    echo ""
fi

echo "[2/4] 端口检查完成"
echo ""

# 提供启动建议
echo "[3/4] 启动建议："
echo ""
echo "方案1：使用默认端口启动（推荐）"
echo "  前端：cd frontend && npm run dev (端口6000)"
echo "  后端：cd backend && npm start (端口6001)"
echo ""

echo "方案2：使用指定端口启动"
echo "  前端：cd frontend && VITE_FRONTEND_PORT=6002 npm run dev"
echo "  后端：cd backend && PORT=6002 npm start"
echo ""

echo "[4/4] 准备启动服务..."
echo ""
read -p "是否现在启动服务？(y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "启动后端服务..."
    cd "$(dirname "$0")/backend"
    npm start &
    BACKEND_PID=$!
    echo "后端PID: $BACKEND_PID"
    
    sleep 3
    
    echo "启动前端服务..."
    cd "../frontend"
    npm run dev &
    FRONTEND_PID=$!
    echo "前端PID: $FRONTEND_PID"
    
    echo ""
    echo "✅ 服务已启动"
    echo "后端: http://localhost:6001"
    echo "前端: http://localhost:6000 (如果被占用会自动切换)"
    echo ""
    echo "按 Ctrl+C 停止所有服务"
    
    trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT
    wait
else
    echo "已取消启动"
fi
