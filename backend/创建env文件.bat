@echo off
chcp 65001 >nul
echo ========================================
echo 创建 .env 配置文件
echo ========================================
echo.

:: 检查是否已存在 .env 文件
if exist .env (
    echo ⚠️  警告: .env 文件已存在
    set /p overwrite="是否覆盖现有文件? (Y/N): "
    if /i not "%overwrite%"=="Y" (
        echo 已取消操作
        pause
        exit /b 0
    )
)

echo.
echo 请输入数据库配置信息：
echo.

set /p DB_HOST="数据库主机 [localhost]: "
if "%DB_HOST%"=="" set DB_HOST=localhost

set /p DB_PORT="数据库端口 [3306]: "
if "%DB_PORT%"=="" set DB_PORT=3306

set /p DB_USER="数据库用户名 [root]: "
if "%DB_USER%"=="" set DB_USER=root

set /p DB_PASSWORD="数据库密码 (必填): "
if "%DB_PASSWORD%"=="" (
    echo ❌ 错误: 数据库密码不能为空
    pause
    exit /b 1
)

set /p DB_NAME="数据库名称 [zcgl]: "
if "%DB_NAME%"=="" set DB_NAME=zcgl

echo.
set /p NODE_ENV="运行环境 [production]: "
if "%NODE_ENV%"=="" set NODE_ENV=production

echo.
set /p PORT="服务器端口 [4001]: "
if "%PORT%"=="" set PORT=4001

echo.
echo 正在生成 JWT 密钥...
:: 使用 PowerShell 生成随机密钥
for /f "delims=" %%i in ('powershell -Command "[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))"') do set JWT_SECRET=%%i

echo.
echo ========================================
echo 正在创建 .env 文件...
echo ========================================

(
echo # ============================================
echo # 环境配置
echo # ============================================
echo NODE_ENV=%NODE_ENV%
echo.
echo # ============================================
echo # 数据库配置
echo # ============================================
echo DB_HOST=%DB_HOST%
echo DB_PORT=%DB_PORT%
echo DB_USER=%DB_USER%
echo DB_PASSWORD=%DB_PASSWORD%
echo DB_NAME=%DB_NAME%
echo.
echo # ============================================
echo # 服务器配置
echo # ============================================
echo PORT=%PORT%
echo SERVER_HOST=0.0.0.0
echo.
echo # ============================================
echo # JWT 配置
echo # ============================================
echo JWT_SECRET=%JWT_SECRET%
echo.
echo # ============================================
echo # CORS 跨域配置
echo # ============================================
echo CORS_ORIGIN=*
) > .env

echo ✅ .env 文件创建成功！
echo.
echo 配置信息：
echo   数据库主机: %DB_HOST%
echo   数据库端口: %DB_PORT%
echo   数据库用户: %DB_USER%
echo   数据库名称: %DB_NAME%
echo   运行环境: %NODE_ENV%
echo   服务端口: %PORT%
echo   JWT密钥: %JWT_SECRET%
echo.
echo 提示: 如需修改配置，请编辑 .env 文件
echo.
pause
