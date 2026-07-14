@echo off
REM ============================================
REM 资产管理系统服务管理器 - Windows 应用构建脚本
REM 此脚本将 Electron 应用打包成 Windows exe 程序
REM ============================================
chcp 65001 >nul 2>&1
if errorlevel 1 (
    chcp 936 >nul 2>&1
)

echo ==========================================
echo 构建 Windows 应用
echo ==========================================
echo.

REM 检查是否在正确的目录
if not exist "package.json" (
    echo ❌ 错误: 请在 ServiceManager 目录下运行此脚本
    pause
    exit /b 1
)

REM 检查是否安装了依赖
if not exist "node_modules" (
    echo 📦 正在安装依赖...
    call npm install
    if errorlevel 1 (
        echo ❌ 依赖安装失败
        pause
        exit /b 1
    )
)

REM 检查 electron-builder
if not exist "node_modules\.bin\electron-builder.cmd" (
    echo 📦 正在安装 electron-builder...
    call npm install --save-dev electron-builder
    if errorlevel 1 (
        echo ❌ electron-builder 安装失败
        pause
        exit /b 1
    )
)

echo 🔨 开始构建 Windows 应用...
echo.

REM 设置国内镜像源（解决网络问题）
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
set ELECTRON_CACHE=%TEMP%\electron-cache
echo 🌐 已设置 Electron 镜像源
echo.

REM 构建 Windows 应用
call npm run build:win

if errorlevel 1 (
    echo.
    echo ❌ 构建失败，请检查错误信息
    pause
    exit /b 1
)

echo.
echo ==========================================
echo ✅ 构建成功！
echo ==========================================
echo.
echo 📦 应用位置: dist-new\win-unpacked\资产管理服务管理器.exe
echo.
echo 💡 使用说明:
echo    1. 找到 dist-new\win-unpacked\资产管理服务管理器.exe
echo    2. 双击即可运行
echo    3. 或者运行 dist-new\资产管理服务管理器 Setup *.exe 进行安装
echo    4. 便携版: dist-new\资产管理服务管理器 *.exe (无需安装)
echo.
pause
