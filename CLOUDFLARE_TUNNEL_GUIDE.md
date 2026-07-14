# Cloudflare Tunnel 外网访问配置指南

使用 Cloudflare Tunnel 将 AssetHub 项目暴露到外网，无需公网 IP，自动 HTTPS，安全可靠。

## ✅ 优势

- 🆓 **完全免费** - Cloudflare 免费套餐足够使用
- 🔒 **自动 HTTPS** - 无需配置 SSL 证书
- 🌐 **无需公网 IP** - 穿透内网，任何地方都能访问
- 🛡️ **DDoS 防护** - 流量经过 Cloudflare 网络
- 🚀 **全球加速** - 利用 Cloudflare CDN

---

## 📋 前置要求

1. Cloudflare 账号（免费注册）
2. 已安装 cloudflared 命令行工具
3. 本地服务已启动（前端:13579, 后端:5183）

---

## 🚀 快速开始（推荐）

### 方案 1：临时域名（最快，无需配置）

适合临时演示或测试：

```bash
# 确保本地服务已启动
# 前端: npm run dev (端口 13579)
# 后端: node server.js (端口 5183)

# 启动快速隧道
cloudflared tunnel --url http://localhost:13579
```

启动后会显示类似：
```
Your quick Tunnel has been created! You can find it at:
https://your-random-name.trycloudflare.com
```

复制这个地址即可访问，有效期24小时。

---

### 方案 2：固定域名（推荐长期使用）

#### 步骤 1：登录 Cloudflare

```bash
cloudflared tunnel login
```

这会打开浏览器，登录后选择要使用的域名。

#### 步骤 2：创建 Tunnel

```bash
# 创建名为 "assethub" 的隧道
cloudflared tunnel create assethub
```

输出示例：
```
Tunnel credentials written to /Users/cjlee/.cloudflared/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.json
Tunnel ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

#### 步骤 3：创建配置文件

创建 `~/.cloudflared/config.yml`：

```yaml
tunnel: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
credentials-file: /Users/cjlee/.cloudflared/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.json

ingress:
  # 前端访问
  - hostname: assethub.yourdomain.com
    service: http://localhost:13579
    
  # 后端 API（可选，开发模式需要）
  - hostname: api-assethub.yourdomain.com
    service: http://localhost:5183
    
  # 兜底规则
  - service: http_status:404
```

#### 步骤 4：配置 DNS

```bash
# 将域名指向隧道
cloudflared tunnel route dns assethub assethub.yourdomain.com
cloudflared tunnel route dns assethub api-assethub.yourdomain.com
```

#### 步骤 5：启动隧道

```bash
cloudflared tunnel run assethub
```

---

## 📁 项目提供的快捷脚本

我们已经为您准备了快捷脚本：

```bash
# 1. 确保前后端服务已启动
# 2. 运行脚本
./start-cloudflare-tunnel.sh
```

脚本会引导您选择模式并自动配置。

---

## 🔧 手动配置详细步骤

### 安装 cloudflared

**macOS:**
```bash
brew install cloudflared
```

**Linux:**
```bash
# 下载最新版本
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
sudo mv cloudflared-linux-amd64 /usr/local/bin/cloudflared
sudo chmod +x /usr/local/bin/cloudflared
```

**Windows:**
```powershell
winget install --id Cloudflare.cloudflared
```

### 配置文件示例

#### 开发模式（分别暴露前后端）

```yaml
# ~/.cloudflared/config-dev.yml
tunnel: <your-tunnel-id>
credentials-file: /Users/cjlee/.cloudflared/<your-tunnel-id>.json

ingress:
  # 后端 API
  - hostname: assethub-api.yourdomain.com
    service: http://localhost:5183
    
  # 前端页面
  - hostname: assethub.yourdomain.com
    service: http://localhost:13579
    
  - service: http_status:404
```

#### 生产模式（只暴露前端）

```yaml
# ~/.cloudflared/config-prod.yml
tunnel: <your-tunnel-id>
credentials-file: /Users/cjlee/.cloudflared/<your-tunnel-id>.json

ingress:
  # 前端（包含 API 代理）
  - hostname: assethub.yourdomain.com
    service: http://localhost:13579
    
  - service: http_status:404
```

### 启动命令

```bash
# 开发模式
cloudflared tunnel --config ~/.cloudflared/config-dev.yml run

# 生产模式
cloudflared tunnel --config ~/.cloudflared/config-prod.yml run

# 后台运行
cloudflared tunnel --config ~/.cloudflared/config.yml run &
```

---

## 🔐 安全建议

### 1. 启用 Cloudflare Access（可选）

限制只有授权用户可以访问：

```bash
# 在 Cloudflare Zero Trust 控制台配置
# 1. 进入 Access -> Applications
# 2. 创建 Self-hosted Application
# 3. 配置身份验证方式（Google/GitHub/One-time PIN 等）
```

### 2. 配置防火墙规则

在 Cloudflare Dashboard 配置：
- Security -> WAF -> 添加规则
- 限制特定国家/地区访问
- 添加速率限制

### 3. 使用生产模式

生产环境建议：
- 只暴露前端（端口 13579）
- 不直接暴露后端 API
- 后端通过前端 Vite 代理访问

---

## 📝 常见问题

### Q1: 隧道启动失败？

检查：
```bash
# 1. 本地服务是否运行
lsof -i :13579  # 前端
lsof -i :5183   # 后端

# 2. 配置文件是否正确
cat ~/.cloudflared/config.yml

# 3. 日志查看
tail -f ~/.cloudflared/cloudflared.log
```

### Q2: 如何停止隧道？

```bash
# 按 Ctrl+C 停止前台运行的隧道

# 或查找进程并杀死
ps aux | grep cloudflared
kill <PID>
```

### Q3: 域名无法访问？

检查 DNS 配置：
```bash
# 查看隧道路由
cloudflared tunnel list
cloudflared tunnel info <tunnel-id>

# 重新配置 DNS
cloudflared tunnel route dns <tunnel-name> <hostname>
```

### Q4: 如何后台运行？

**macOS/Linux:**
```bash
# 使用 nohup
nohup cloudflared tunnel run <tunnel-name> > cloudflared.log 2>&1 &

# 或使用 Launchd/ systemd（推荐生产环境）
cloudflared service install
cloudflared service start
```

**配置为系统服务（推荐）:**

```bash
# macOS
sudo cloudflared service install
sudo launchctl start com.cloudflare.cloudflared

# Linux
sudo cloudflared service install
sudo systemctl start cloudflared
```

---

## 🎯 使用场景

| 场景 | 推荐方案 | 说明 |
|------|----------|------|
| 本地开发测试 | 临时域名 | `cloudflared tunnel --url http://localhost:13579` |
| 给客户演示 | 固定域名 | 配置固定域名，更专业 |
| 团队协作 | 固定域名 + Access | 限制团队成员访问 |
| 生产环境 | 固定域名 + WAF | 完整安全策略 |

---

## 📚 相关链接

- [Cloudflare Tunnel 官方文档](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
- [Cloudflare Dashboard](https://dash.cloudflare.com)
- [cloudflared GitHub](https://github.com/cloudflare/cloudflared)

---

## 💡 提示

1. **免费额度**: Cloudflare 免费套餐包含无限带宽和请求数
2. **性能**: 首次访问可能稍慢，后续利用 CDN 缓存很快
3. **稳定性**: 长期运行建议使用系统服务方式部署
4. **日志**: 遇到问题查看 `~/.cloudflared/cloudflared.log`

---

配置完成！现在可以从任何地方访问您的 AssetHub 项目了 🎉
