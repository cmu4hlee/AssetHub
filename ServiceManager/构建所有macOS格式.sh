#!/bin/bash

# 资产管理系统服务管理器 - 构建所有 macOS 格式
# 此脚本将同时构建 .pkg 安装程序和 .dmg 磁盘映像

echo "=========================================="
echo "构建所有 macOS 格式"
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

echo "🔨 开始构建所有格式..."
echo ""

# 构建所有格式（.pkg 和 .dmg）
npm run build:all

if [ $? -eq 0 ]; then
    echo ""
    echo "=========================================="
    echo "✅ 构建成功！"
    echo "=========================================="
    echo ""
    echo "📦 生成的文件:"
    echo "   • .pkg 安装程序: dist/资产管理服务管理器-*.pkg"
    echo "   • .dmg 磁盘映像: dist/资产管理服务管理器-*.dmg"
    echo ""
    echo "💡 使用说明:"
    echo ""
    echo "   📦 .pkg 安装程序（推荐用于正式安装）:"
    echo "      1. 双击 .pkg 文件开始安装"
    echo "      2. 按照安装向导完成安装"
    echo "      3. 安装到 /Applications 目录"
    echo ""
    echo "   💿 .dmg 磁盘映像（推荐用于快速分发）:"
    echo "      1. 双击 .dmg 文件挂载磁盘"
    echo "      2. 将应用拖拽到应用程序文件夹"
    echo "      3. 弹出磁盘映像"
    echo ""
else
    echo ""
    echo "❌ 构建失败，请检查错误信息"
    exit 1
fi
