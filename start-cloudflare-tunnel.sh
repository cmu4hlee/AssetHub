#!/bin/bash

# Cloudflare Tunnel 启动脚本
# AssetHub 项目外网访问

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  AssetHub Cloudflare Tunnel 启动器${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 检查 cloudflared
if ! command -v cloudflared &> /dev/null; then
    echo -e "${RED}❌ cloudflared 未安装${NC}"
    echo ""
    echo "安装方法:"
    echo "  macOS:    brew install cloudflared"
    echo "  Linux:    wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -O /usr/local/bin/cloudflared && chmod +x /usr/local/bin/cloudflared"
    echo "  Windows:  winget install --id Cloudflare.cloudflared"
    echo ""
    exit 1
fi

echo -e "${GREEN}✅ cloudflared 已安装: $(cloudflared --version)${NC}"
echo ""

# 检查本地服务状态
echo -e "${YELLOW}▶ 检查本地服务...${NC}"

# 检查后端
if lsof -i :5183 -P 2>/dev/null | grep -q LISTEN; then
    echo -e "${GREEN}  ✅ 后端服务运行中 (端口 5183)${NC}"
else
    echo -e "${RED}  ❌ 后端服务未运行 (端口 5183)${NC}"
    echo "     请先启动后端: cd backend && npm start"
    exit 1
fi

# 检查前端
if lsof -i :13579 -P 2>/dev/null | grep -q LISTEN; then
    echo -e "${GREEN}  ✅ 前端服务运行中 (端口 13579)${NC}"
else
    echo -e "${RED}  ❌ 前端服务未运行 (端口 13579)${NC}"
    echo "     请先启动前端: cd frontend && npm run dev"
    exit 1
fi

echo ""

# 检查是否已登录
if [ ! -f ~/.cloudflared/cert.pem ] && [ ! -f ~/.cloudflared/*.json ]; then
    echo -e "${YELLOW}⚠️  未检测到 Cloudflare 登录凭证${NC}"
    echo ""
    echo "请执行以下命令登录:"
    echo -e "  ${BLUE}cloudflared tunnel login${NC}"
    echo ""
    echo "这将打开浏览器让你登录 Cloudflare 账号"
    exit 1
fi

# 方案选择
echo -e "${YELLOW}▶ 选择暴露方案:${NC}"
echo ""
echo "  [1] 开发模式 - 分别暴露前端和后端（推荐开发调试）"
echo "      前端: https://assethub-frontend.your-domain.workers.dev"
echo "      后端: https://assethub-api.your-domain.workers.dev"
echo ""
echo "  [2] 生产模式 - 只暴露前端，API通过前端代理"
echo "      访问: https://assethub.your-domain.workers.dev"
echo ""
echo "  [3] 快速模式 - 使用临时域名（无需配置）"
echo "      自动生成临时域名，有效期24小时"
echo ""

read -p "请选择 [1/2/3]: " choice

case $choice in
    1)
        MODE="dev"
        CONFIG_FILE=".cloudflared/config-dev.yml"
        ;;
    2)
        MODE="prod"
        CONFIG_FILE=".cloudflared/config-prod.yml"
        ;;
    3)
        MODE="quick"
        ;;
    *)
        echo -e "${RED}❌ 无效选择${NC}"
        exit 1
        ;;
esac

# 创建配置目录
mkdir -p ~/.cloudflared

# 快速模式
if [ "$MODE" = "quick" ]; then
    echo ""
    echo -e "${YELLOW}▶ 启动快速隧道...${NC}"
    echo -e "${GREEN}✅ 访问地址将在启动后显示${NC}"
    echo ""
    echo -e "${YELLOW}提示: 按 Ctrl+C 停止隧道${NC}"
    echo ""
    
    # quick tunnel 模式强制忽略 ~/.cloudflared/config.yml，
    # 避免已配置的命名隧道 ingress 覆盖随机 trycloudflare 域名导致 404
    cloudflared --config /dev/null tunnel --url http://localhost:13579
    exit 0
fi

# 开发模式配置
if [ "$MODE" = "dev" ]; then
    cat > ~/.cloudflared/config-dev.yml << 'EOF'
# AssetHub 开发模式配置
# 同时暴露前端和后端

ingress:
  # 后端 API
  - hostname: assethub-api.your-domain.workers.dev
    service: http://localhost:5183
    
  # 前端页面
  - hostname: assethub-frontend.your-domain.workers.dev
    service: http://localhost:13579
    
  # 兜底
  - service: http_status:404

logfile: /Users/cjlee/.cloudflared/cloudflared-dev.log
EOF

    echo -e "${YELLOW}▶ 配置说明:${NC}"
    echo ""
    echo "请修改配置文件 ~/.cloudflared/config-dev.yml"
    echo "将 your-domain.workers.dev 替换为你的实际域名"
    echo ""
    echo -e "${BLUE}配置步骤:${NC}"
    echo "1. 登录 Cloudflare Dashboard: https://dash.cloudflare.com"
    echo "2. 选择你的域名"
    echo "3. 创建 Tunnel: Zero Trust -> Access -> Tunnels -> Create a tunnel"
    echo "4. 复制 Tunnel ID 和 credentials file 路径到配置文件"
    echo ""
fi

# 生产模式配置
if [ "$MODE" = "prod" ]; then
    cat > ~/.cloudflared/config-prod.yml << 'EOF'
# AssetHub 生产模式配置
# 只暴露前端，后端通过前端代理访问

ingress:
  # 前端页面（包含 API 代理）
  - hostname: assethub.your-domain.workers.dev
    service: http://localhost:13579
    
  # 兜底
  - service: http_status:404

logfile: /Users/cjlee/.cloudflared/cloudflared-prod.log
EOF

    echo -e "${YELLOW}▶ 配置说明:${NC}"
    echo ""
    echo "请修改配置文件 ~/.cloudflared/config-prod.yml"
    echo "将 your-domain.workers.dev 替换为你的实际域名"
    echo ""
fi

# 检查配置文件
if [ -f ~/.cloudflared/$CONFIG_FILE ]; then
    echo -e "${GREEN}✅ 配置文件已创建: ~/.cloudflared/$CONFIG_FILE${NC}"
else
    echo -e "${RED}❌ 配置文件创建失败${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}▶ 启动隧道...${NC}"
echo ""

# 启动隧道
if [ "$MODE" = "dev" ]; then
    echo -e "${GREEN}启动开发模式隧道${NC}"
    echo -e "  前端: https://assethub-frontend.your-domain.workers.dev"
    echo -e "  后端: https://assethub-api.your-domain.workers.dev"
    echo ""
    cloudflared tunnel --config ~/.cloudflared/config-dev.yml run
elif [ "$MODE" = "prod" ]; then
    echo -e "${GREEN}启动生产模式隧道${NC}"
    echo -e "  访问: https://assethub.your-domain.workers.dev"
    echo ""
    cloudflared tunnel --config ~/.cloudflared/config-prod.yml run
fi
