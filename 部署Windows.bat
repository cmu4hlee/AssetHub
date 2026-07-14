@echo off
chcp 65001 >nul
echo ========================================
echo 资产管理系统 - Windows 部署脚本
echo ========================================
echo.

:: 检查 Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 错误: 未检测到 Node.js
    echo 请先安装 Node.js: https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js 版本:
node --version
echo.

:: 进入项目目录
cd /d "%~dp0"

:: 步骤 1: 安装后端依赖
echo [1/4] 安装后端依赖...
cd backend
if not exist node_modules (
    call npm install
    if %errorlevel% neq 0 (
        echo ❌ 后端依赖安装失败
        pause
        exit /b 1
    )
)
echo ✅ 后端依赖安装完成
echo.

:: 步骤 2: 安装前端依赖
echo [2/4] 安装前端依赖...
cd ..\frontend
if not exist node_modules (
    call npm install
    if %errorlevel% neq 0 (
        echo ❌ 前端依赖安装失败
        pause
        exit /b 1
    )
)
echo ✅ 前端依赖安装完成
echo.

:: 步骤 3: 构建前端
echo [3/4] 构建前端生产版本...
call npm run build
if %errorlevel% neq 0 (
    echo ❌ 前端构建失败
    pause
    exit /b 1
)
echo ✅ 前端构建完成
echo.

:: 步骤 4: 检查配置文件
echo [4/4] 检查配置文件...
cd ..\backend
if not exist .env (
    echo ⚠️  警告: 未找到 .env 文件
    echo 请创建 .env 文件并配置数据库连接信息
    echo 参考: .env.example
    echo.
)

echo ========================================
echo ✅ 部署准备完成！
echo ========================================
echo.
echo 下一步：
echo 1. 配置 backend\.env 文件（数据库连接等）
echo 2. 运行数据库初始化脚本（如果需要）
echo 3. 启动后端服务：
echo    - 直接启动: cd backend ^&^& node server.js
echo    - 使用 PM2: pm2 start backend/server.js --name asset-backend
echo    - 安装服务: cd backend ^&^& node install-service.js
echo.
echo.
echo ========================================
echo 启动服务说明
echo ========================================
echo.
echo 生产环境启动方式：
echo   1. 启动后端: cd backend ^&^& npm start
echo   2. 启动前端: cd frontend ^&^& npm run preview
echo.
echo 或者使用启动脚本：
echo   - 开发环境: 启动服务_windows.bat
echo   - 生产环境: 启动生产环境_windows.bat
echo.
echo 访问地址：
echo   - 前端: http://localhost:4000
echo   - 后端API: http://localhost:4001
echo.
echo.
pause
