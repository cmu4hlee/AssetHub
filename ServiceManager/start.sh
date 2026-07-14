#!/bin/bash

# 资产管理系统服务管理器启动脚本

echo "========================================"
echo "启动资产管理服务管理器"
echo "========================================"
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未检测到 Node.js"
    echo "请先安装 Node.js: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js 版本: $(node --version)"
echo ""

# 进入脚本所在目录
cd "$(dirname "$0")"

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo "📦 正在安装依赖..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ 依赖安装失败"
        exit 1
    fi
    echo ""
fi

# 启动应用
echo "🚀 启动服务管理器..."
echo ""
npm start
