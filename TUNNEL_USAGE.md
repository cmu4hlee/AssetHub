# Cloudflare Tunnel 使用说明

快速将 AssetHub 暴露到外网，无需公网 IP，自动 HTTPS。

---

## 🚀 最快方式（推荐新手）

### 1. 确保服务已启动

```bash
# 检查服务状态
lsof -i :5183   # 后端
lsof -i :13579  # 前端

# 如果未启动，先启动服务
./start-services.sh
```

### 2. 启动快速隧道

```bash
./quick-tunnel.sh
```

运行后会显示类似：
```
Your quick Tunnel has been created! You can find it at:
https://random-name-123.trycloudflare.com
```

复制这个 `https://` 链接即可访问！

**特点:**
- ✅ 无需配置
- ✅ 自动生成域名
- ✅ 有效期24小时
- ⚠️ 每次重启域名会变

---

## 🌐 固定域名方式（推荐长期使用）

### 1. 登录 Cloudflare

```bash
cloudflared tunnel login
```

按提示登录 Cloudflare 账号。

### 2. 使用交互式脚本

```bash
./start-cloudflare-tunnel.sh
```

按提示选择模式：
- **开发模式**: 分别暴露前端和后端
- **生产模式**: 只暴露前端，API 通过前端代理
- **快速模式**: 同 `./quick-tunnel.sh`

### 3. 或手动配置

```bash
# 创建隧道
cloudflared tunnel create assethub

# 编辑配置文件
vim ~/.cloudflared/config.yml

# 添加内容:
tunnel: <你的-tunnel-id>
credentials-file: ~/.cloudflared/<你的-tunnel-id>.json

ingress:
  - hostname: assethub.yourdomain.com
    service: http://localhost:13579
  - service: http_status:404

# 配置 DNS
cloudflared tunnel route dns assethub assethub.yourdomain.com

# 启动
cloudflared tunnel run assethub
```

---

## 📂 文件说明

| 文件 | 用途 |
|------|------|
| `quick-tunnel.sh` | 快速启动临时隧道 |
| `start-cloudflare-tunnel.sh` | 交互式配置向导 |
| `CLOUDFLARE_TUNNEL_GUIDE.md` | 完整配置指南 |

---

## 🔧 常用命令

```bash
# 查看隧道列表
cloudflared tunnel list

# 查看隧道信息
cloudflared tunnel info <tunnel-id>

# 后台运行隧道
nohup cloudflared tunnel run <name> > tunnel.log 2>&1 &

# 停止隧道
# 按 Ctrl+C 或查找进程 kill
ps aux | grep cloudflared
kill <PID>

# 删除隧道
cloudflared tunnel delete <name>
```

---

## 💡 提示

1. **第一次使用？** 直接运行 `./quick-tunnel.sh`，30秒内搞定
2. **需要固定域名？** 运行 `./start-cloudflare-tunnel.sh` 选择方案2
3. **域名在哪里看？** 启动后会显示在终端，以 `trycloudflare.com` 结尾
4. **访问不了？** 检查本地服务是否启动（端口 13579 和 5183）

---

## 📞 故障排查

### 问题1: cloudflared 未安装

```bash
# macOS
brew install cloudflared

# 其他系统参考 CLOUDFLARE_TUNNEL_GUIDE.md
```

### 问题2: 服务未启动

```bash
# 检查
lsof -i :13579
lsof -i :5183

# 启动
./start-services.sh
```

### 问题3: 无法访问

1. 检查本地服务是否正常
2. 查看 cloudflared 输出是否有错误
3. 尝试刷新浏览器或重启隧道

---

**现在就可以运行 `./quick-tunnel.sh` 开始体验！** 🎉
