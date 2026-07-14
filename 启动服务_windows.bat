@echo off
REM ============================================
REM 资产管理系统 - 同时启动前端和后端服务
REM ============================================
REM 设置代码页为UTF-8，解决中文乱码问题
chcp 65001 >nul 2>&1
if errorlevel 1 (
    chcp 936 >nul 2>&1
)

REM 启用延迟变量扩展
setlocal enabledelayedexpansion

echo ========================================
echo 资产管理系统 - 服务启动器
echo ========================================
echo.

REM 检查Node.js是否安装
where node >nul 2>&1
if errorlevel 1 (
    echo [错误] 未检测到Node.js，请先安装Node.js
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)

echo [信息] Node.js 版本:
node --version
echo.

REM 获取当前脚本所在目录
cd /d "%~dp0"

REM 检查后端目录是否存在
if not exist "backend" (
    echo [错误] 未找到backend目录
    pause
    exit /b 1
)

REM 检查前端目录是否存在
if not exist "frontend" (
    echo [错误] 未找到frontend目录
    pause
    exit /b 1
)

REM ============================================
REM 检查并启动Redis服务
REM ============================================
echo [1/5] 检查Redis服务状态...

REM 检查Redis是否已安装
where redis-server >nul 2>&1
if errorlevel 1 (
    echo [警告] Redis服务未安装
    echo [警告] 系统将以降级模式运行，Redis缓存功能不可用
    echo [提示] 如需启用Redis缓存，请先安装Redis服务
    echo [提示] Redis安装地址: https://redis.io/docs/getting-started/
) else (
    REM 尝试连接Redis，如果失败则启动Redis服务
    redis-cli ping >nul 2>&1
    if errorlevel 1 (
        echo [信息] Redis服务未运行，正在启动Redis服务...
        REM 启动Redis服务（隐藏窗口，在后台运行）
        start "Redis-Service" /b redis-server
        echo [信息] Redis服务启动中...
        REM 等待Redis服务启动
        timeout /t 2 /nobreak >nul

        REM 再次检查Redis连接状态
        redis-cli ping >nul 2>&1
        if errorlevel 1 (
            echo [警告] Redis服务启动失败
            echo [警告] 系统将以降级模式运行，Redis缓存功能不可用
        ) else (
            echo [成功] Redis服务已启动
        )
    ) else (
        echo [成功] Redis服务已运行
    )
)
cd /d "%~dp0"

REM ============================================
REM 检查并安装后端依赖
REM ============================================
echo [2/5] 检查后端依赖...
cd /d "%~dp0backend"
if not exist "node_modules" (
    echo [信息] 正在安装后端依赖，请稍候...
    call npm install
    if errorlevel 1 (
        echo [错误] 后端依赖安装失败
        cd ..
        pause
        exit /b 1
    )
    echo [成功] 后端依赖安装完成
) else (
    echo [成功] 后端依赖已存在
)
cd /d "%~dp0"

REM ============================================
REM 检查并安装前端依赖
REM ============================================
echo [3/5] 检查前端依赖...
cd /d "%~dp0frontend"
if not exist "node_modules" (
    echo [信息] 正在安装前端依赖，请稍候...
    call npm install
    if errorlevel 1 (
        echo [错误] 前端依赖安装失败
        cd ..
        pause
        exit /b 1
    )
    echo [成功] 前端依赖安装完成
) else (
    echo [成功] 前端依赖已存在
)
cd /d "%~dp0"

REM ============================================
REM 启动后端服务
REM ============================================
echo [4/5] 正在启动后端服务...
start "Backend-Service" cmd /k "chcp 65001 >nul 2>&1 && title Backend-Service-Port-5174 && color 0A && echo ======================================== && echo Backend Service - Port 5174 && echo ======================================== && echo. && cd /d %~dp0backend && npm start"
cd /d "%~dp0"

REM 等待后端服务启动
echo [信息] 等待后端服务启动（3秒）...
timeout /t 3 /nobreak >nul

REM ============================================
REM 启动前端服务
REM ============================================
echo [5/5] 正在启动前端服务...
start "Frontend-Service" cmd /k "chcp 65001 >nul 2>&1 && title Frontend-Service-Port-5173 && color 0B && echo ======================================== && echo Frontend Service - Port 5173 && echo ======================================== && echo. && cd /d %~dp0frontend && npm run dev"
cd /d "%~dp0"

REM ============================================
REM 显示启动信息
REM ============================================
echo.
echo ========================================
echo 服务启动完成！
echo ========================================
echo.
echo 后端服务: http://localhost:5174
echo 前端服务: http://localhost:5173
echo.
echo 提示:
echo   - 两个服务窗口已打开，请勿关闭
echo   - 关闭窗口即可停止对应的服务
echo   - 如果服务启动失败，请检查端口是否被占用
echo   - 确保数据库配置正确（backend/.env 或 backend/config/database.js）
echo.
echo 正在打开浏览器访问前端...
timeout /t 2 /nobreak >nul
start http://localhost:5173
echo.
echo 按任意键关闭此窗口（服务将继续运行）...
pause >nul

