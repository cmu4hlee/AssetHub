@echo off
chcp 65001 >nul
echo ========================================
echo 资产管理系统 - Windows 环境安装脚本
echo ========================================
echo.

echo [1/3] 检查 Node.js 安装...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 错误：未检测到 Node.js，请先安装 Node.js
    echo 下载地址：https://nodejs.org/
    pause
    exit /b 1
)
echo ✅ Node.js 已安装
node --version
echo.

echo [2/3] 清理旧的依赖（如果存在）...
if exist node_modules (
    echo 正在删除 node_modules...
    rmdir /s /q node_modules
)
if exist package-lock.json (
    echo 正在删除 package-lock.json...
    del /q package-lock.json
)
echo ✅ 清理完成
echo.

echo [3/3] 安装依赖包...
echo 这可能需要几分钟时间，请耐心等待...
echo.
npm install
if %errorlevel% neq 0 (
    echo.
    echo ❌ 依赖安装失败
    echo.
    echo 尝试使用国内镜像...
    npm install --registry=https://registry.npmmirror.com
    if %errorlevel% neq 0 (
        echo.
        echo ❌ 安装失败，请检查网络连接
        pause
        exit /b 1
    )
)
echo.
echo ✅ 依赖安装完成
echo.

echo [验证] 检查关键依赖...
echo.
npm list axios >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ axios 已安装
) else (
    echo ❌ axios 未安装，尝试单独安装...
    npm install axios
)

npm list express >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ express 已安装
) else (
    echo ❌ express 未安装
)

npm list mysql2 >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ mysql2 已安装
) else (
    echo ❌ mysql2 未安装
)

echo.
echo ========================================
echo ✅ 安装完成！
echo ========================================
echo.
echo 下一步：
echo 1. 配置 .env 文件（数据库连接等）
echo 2. 运行 npm start 启动服务器
echo.
pause
