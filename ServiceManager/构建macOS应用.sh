#!/bin/bash

# 资产管理系统服务管理器 - macOS 应用构建脚本
# 此脚本将 Electron 应用打包成 macOS .app 应用程序

echo "=========================================="
echo "构建 macOS 应用"
echo "=========================================="
echo ""

# 检查是否在正确的目录
if [ ! -f "package.json" ]; then
    echo "❌ 错误: 请在 ServiceManager 目录下运行此脚本"
    exit 1
fi

# 检查是否安装了依赖
if [ ! -d "node_modules" ]; then
    echo "📦 正在安装依赖..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ 依赖安装失败"
        exit 1
    fi
fi

# 检查 electron-builder
if [ ! -f "node_modules/.bin/electron-builder" ]; then
    echo "📦 正在安装 electron-builder..."
    npm install --save-dev electron-builder
fi

echo "🔨 开始构建应用..."
echo ""

# 构建应用
npm run build

if [ $? -eq 0 ]; then
    echo ""
    echo "=========================================="
    echo "✅ 构建成功！"
    echo "=========================================="
    echo ""
    echo "📦 应用位置: dist/资产管理服务管理器-*.dmg"
    echo ""
    echo "💡 使用说明:"
    echo "   1. 双击 .dmg 文件进行安装"
    echo "   2. 将应用拖拽到应用程序文件夹"
    echo "   3. 在启动台中找到并运行应用"
    echo ""
else
    echo ""
    echo "❌ 构建失败，请检查错误信息"
    exit 1
fi
