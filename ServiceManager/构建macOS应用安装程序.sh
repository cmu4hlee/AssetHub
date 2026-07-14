#!/bin/bash

# 资产管理系统服务管理器 - macOS 应用安装程序构建脚本
# 此脚本将 Electron 应用打包成 macOS .pkg 安装程序，安装后可在应用程序列表中找到

echo "=========================================="
echo "构建 macOS 应用安装程序 (.pkg)"
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

# 设置国内镜像源（解决网络问题）
export ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
export ELECTRON_CACHE="/tmp/electron-cache"
echo "🌐 已设置 Electron 镜像源"
echo ""

# 备份原始配置
if [ ! -f "package.json.backup" ]; then
    cp package.json package.json.backup
fi

# 临时修改 package.json 只构建 pkg
echo "📝 配置构建目标为 pkg..."
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.build.mac.target = [{target: 'pkg', arch: ['x64', 'arm64']}];
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
"

echo "🔨 开始构建安装程序..."
echo ""

# 构建 .pkg 安装程序
npx electron-builder --mac

BUILD_RESULT=$?

# 恢复配置
echo "📝 恢复配置..."
if [ -f "package.json.backup" ]; then
    mv package.json.backup package.json
fi

if [ $BUILD_RESULT -eq 0 ]; then
    echo ""
    echo "=========================================="
    echo "✅ 构建成功！"
    echo "=========================================="
    echo ""
    echo "📦 安装程序位置: dist/资产管理服务管理器-*.pkg"
    echo ""
    echo "💡 安装说明:"
    echo "   1. 双击 .pkg 文件开始安装"
    echo "   2. 按照安装向导完成安装"
    echo "   3. 安装完成后，应用会出现在："
    echo "      • 应用程序文件夹 (/Applications)"
    echo "      • 启动台 (Launchpad)"
    echo "      • Spotlight 搜索"
    echo ""
    echo "📱 查找应用:"
    echo "   • 打开 Finder，前往「应用程序」文件夹"
    echo "   • 或在启动台中找到「资产管理服务管理器」"
    echo "   • 或使用 Spotlight (Cmd+Space) 搜索「资产管理」"
    echo ""
    echo "⚠️  注意:"
    echo "   - 首次运行可能需要允许系统权限"
    echo "   - 如果遇到安全提示，请在系统偏好设置 > 安全性与隐私中允许"
    echo ""
else
    echo ""
    echo "❌ 构建失败，请检查错误信息"
    exit 1
fi
