@echo off
REM ============================================
REM 资产管理系统服务管理器 - Windows 快速启动脚本
REM 双击此文件即可启动应用（开发模式）
REM ============================================
chcp 65001 >nul 2>&1
if errorlevel 1 (
    chcp 936 >nul 2>&1
)

cd /d "%~dp0"

echo ========================================
echo 启动服务管理器
echo ========================================
echo.

REM 检查 Node.js 是否安装
where node >nul 2>&1
if errorlevel 1 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)

echo [信息] 检测到 Node.js 版本:
node --version
echo.

REM 检查是否安装了依赖
if not exist "node_modules" (
    echo [信息] 首次运行，正在安装依赖...
    call npm install
    if errorlevel 1 (
        echo [错误] 依赖安装失败
        pause
        exit /b 1
    )
)

echo [信息] 正在启动服务管理器...
echo.

REM 启动应用
call npm start

if errorlevel 1 (
    echo.
    echo [错误] 启动失败
    echo.
    echo 可能的原因:
    echo   1. 未安装 Node.js
    echo   2. 项目依赖未安装
    echo   3. 端口被占用
    echo.
    pause
    exit /b 1
)
