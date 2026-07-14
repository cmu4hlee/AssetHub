#!/bin/bash

# 资产管理系统服务管理器 - macOS 快速启动脚本
# 双击此文件即可启动应用（开发模式）

cd "$(dirname "$0")"

# 检查是否安装了依赖
if [ ! -d "node_modules" ]; then
    echo "📦 首次运行，正在安装依赖..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ 依赖安装失败"
        read -p "按回车键退出..."
        exit 1
    fi
fi

# 启动应用
echo "🚀 启动服务管理器..."
npm start
