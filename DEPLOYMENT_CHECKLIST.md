# AssetHub 生产环境部署检查清单

**版本**: v1.0  
**更新日期**: 2026-05-01  
**检查人员**: ___________  
**部署日期**: ___________

---

## 一、部署前检查

### 1.1 环境准备 ✅
- [ ] 目标服务器已准备就绪
- [ ] 操作系统版本确认（推荐 Ubuntu 22.04 / CentOS 8+）
- [ ] 磁盘空间充足（建议 100GB+）
- [ ] 网络配置正确（端口开放）
- [ ] 防火墙规则已配置

### 1.2 依赖检查 ✅
- [ ] Node.js 版本: >= 18.0.0
- [ ] npm 版本: >= 9.0.0
- [ ] MySQL 版本: >= 8.0
- [ ] Redis 版本: >= 6.0（可选）
- [ ] Git 已安装
- [ ] Docker 已安装（如果使用容器部署）

### 1.3 数据库准备 ✅
- [ ] MySQL 服务已启动
- [ ] 数据库已创建
- [ ] 数据库用户权限已配置
- [ ] SSL 连接已配置（如需要）
- [ ] 初始数据已导入
- [ ] 数据库备份机制已配置

---

## 二、安全配置检查

### 2.1 环境变量配置 ✅
- [ ] `.env` 文件已创建
- [ ] `NODE_ENV=production` 已设置
- [ ] 数据库密码已设置（强密码）
- [ ] `JWT_SECRET` 已设置为强随机密钥（32+字符）
- [ ] 所有 API 密钥已配置
- [ ] Redis 密码已配置（如启用）
- [ ] CORS 白名单已配置

**环境变量检查命令**:
```bash
# 检查关键环境变量
grep -E "(JWT_SECRET|DB_PASSWORD|API_KEY)" .env
# 应该看到设置的密钥（不应该是默认值）
```

### 2.2 HTTPS 配置 ✅
- [ ] SSL 证书已获取
- [ ] 证书文件路径已配置
- [ ] HTTPS 已启用
- [ ] HTTP 自动重定向到 HTTPS

**SSL 检查命令**:
```bash
# 测试 SSL 证书
openssl s_client -connect your-domain.com:443 -servername your-domain.com
```

### 2.3 防火墙和访问控制 ✅
- [ ] 只开放必要端口
- [ ] IP 白名单已配置（如启用）
- [ ] DDoS 防护已配置
- [ ] WAF 已配置（推荐）

### 2.4 文件权限 ✅
- [ ] 应用目录权限正确
- [ ] 上传目录权限正确（可写）
- [ ] 日志目录权限正确
- [ ] 备份目录权限正确

---

## 三、应用配置检查

### 3.1 后端配置 ✅
- [ ] 端口配置正确（生产环境建议 443）
- [ ] 日志级别设置正确（info）
- [ ] 文件上传大小限制合理
- [ ] 请求超时设置合理
- [ ] 数据库连接池配置优化

**后端配置检查清单**:
```javascript
// 检查 backend/config/app.config.js
{
  server: {
    port: 443,  // HTTPS 端口
    https: true,
  },
  jwt: {
    expiresIn: 86400,  // 1天
  },
  cors: {
    origin: ['https://your-domain.com'],  // 生产环境不要用 *
  },
  log: {
    level: 'info',
    enableFileLog: true,
  }
}
```

### 3.2 前端配置 ✅
- [ ] API 地址指向正确的后端
- [ ] 环境变量正确配置
- [ ] 构建版本正确
- [ ] 静态资源已压缩
- [ ] CDN 配置（如使用）

**前端环境变量**:
```bash
# .env.production
VITE_API_BASE_URL=https://your-api-domain.com/api
VITE_APP_TITLE=AssetHub
```

### 3.3 数据库连接 ✅
- [ ] 主库连接正常
- [ ] 从库连接正常（如配置）
- [ ] 读写分离配置正确
- [ ] 连接池参数优化

---

## 四、构建和部署

### 4.1 构建前检查 ✅
- [ ] 所有依赖已安装
- [ ] 代码已通过 lint 检查
- [ ] 代码已通过测试
- [ ] 没有未提交的敏感信息
- [ ] 生产构建正常完成

**构建命令**:
```bash
# 后端构建
cd backend
npm install --production
npm run lint
npm test

# 前端构建
cd frontend
npm install
npm run lint
npm run build
```

### 4.2 部署方式选择

#### 方式一：直接部署
```bash
# 1. 停止现有服务
pm2 stop assethub-backend
pm2 stop assethub-frontend

# 2. 备份当前版本
cp -r backend backend.backup.$(date +%Y%m%d)
cp -r frontend frontend.backup.$(date +%Y%m%d)

# 3. 上传新版本
rsync -avz --exclude='node_modules' --exclude='.env' new-backend/ backend/
rsync -avz --exclude='node_modules' --exclude='.env' new-frontend/ frontend/

# 4. 安装依赖
cd backend && npm install --production
cd frontend && npm install

# 5. 启动服务
pm2 start backend/server.js --name assethub-backend
pm2 serve frontend/dist 4000 --name assethub-frontend

# 6. 检查服务状态
pm2 status
pm2 logs assethub-backend
pm2 logs assethub-frontend
```

#### 方式二：Docker 部署
```bash
# 1. 构建镜像
docker build -t assethub/backend:latest ./backend
docker build -t assethub/frontend:latest ./frontend

# 2. 停止旧容器
docker-compose down

# 3. 启动新容器
docker-compose up -d

# 4. 检查日志
docker-compose logs -f
```

### 4.3 Nginx 配置检查 ✅
- [ ] 反向代理配置正确
- [ ] SSL 证书路径正确
- [ ] 静态文件缓存配置
- [ ] Gzip 压缩已启用
- [ ] WebSocket 配置（如使用）

**Nginx 配置示例**:
```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # SSL 优化
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;

    # 前端静态文件
    location / {
        root /var/www/assethub/frontend/dist;
        try_files $uri $uri/ /index.html;
        expires 7d;
        add_header Cache-Control "public, immutable";
    }

    # API 代理
    location /api {
        proxy_pass http://localhost:5183;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
```

---

## 五、部署后验证

### 5.1 服务状态检查 ✅
- [ ] 后端服务运行正常
- [ ] 前端服务运行正常
- [ ] Nginx 服务运行正常
- [ ] 数据库连接正常

**检查命令**:
```bash
# 检查服务状态
systemctl status nginx
pm2 status
mysql -u assethub -p -e "SELECT 1"

# 检查端口监听
netstat -tlnp | grep -E "(443|5183|4000)"

# 检查日志
tail -f /var/log/nginx/error.log
pm2 logs assethub-backend --lines 100
```

### 5.2 功能验证 ✅

#### 基础功能
- [ ] 首页可以访问
- [ ] 登录功能正常
- [ ] 注册功能正常
- [ ] 退出登录正常

#### 资产管理
- [ ] 资产列表加载正常
- [ ] 资产详情查看正常
- [ ] 资产新增功能正常
- [ ] 资产编辑功能正常
- [ ] 资产删除功能正常

#### 维护管理
- [ ] 维修工单列表正常
- [ ] 维修工单新增正常
- [ ] 维修工单状态更新正常

#### 系统管理
- [ ] 用户管理正常
- [ ] 角色权限正常
- [ ] 模块配置正常

### 5.3 性能验证 ✅
- [ ] 页面加载时间 < 3秒
- [ ] API 响应时间 < 1秒
- [ ] 并发用户数正常
- [ ] 数据库查询性能正常

**性能测试命令**:
```bash
# 响应时间测试
curl -w "@curl-format.txt" -o /dev/null -s http://your-domain.com/api/health

# 并发测试
ab -n 1000 -c 100 http://your-domain.com/api/health

# 数据库慢查询检查
mysql -u root -p -e "SHOW GLOBAL STATUS LIKE 'Slow_queries';"
```

### 5.4 安全验证 ✅
- [ ] HTTPS 证书有效
- [ ] 敏感信息不暴露
- [ ] SQL 注入防护正常
- [ ] XSS 防护正常
- [ ] CSRF 防护正常
- [ ] 速率限制生效

**安全测试命令**:
```bash
# HTTPS 证书检查
openssl s_client -connect your-domain.com:443 </dev/null 2>/dev/null | openssl x509 -noout -dates

# 响应头检查
curl -I https://your-domain.com

# SQL 注入测试（谨慎）
curl "http://your-domain.com/api/assets?id=1' OR '1'='1"
# 应该返回空结果或错误，而不是所有数据
```

---

## 六、监控和告警配置

### 6.1 日志监控 ✅
- [ ] 应用日志收集正常
- [ ] Nginx 日志收集正常
- [ ] 错误日志告警配置
- [ ] 日志保留策略配置

### 6.2 性能监控 ✅
- [ ] CPU 使用率监控
- [ ] 内存使用率监控
- [ ] 磁盘使用率监控
- [ ] 数据库连接数监控
- [ ] API 响应时间监控

### 6.3 告警配置 ✅
- [ ] 服务宕机告警
- [ ] 错误率阈值告警
- [ ] 响应时间阈值告警
- [ ] 磁盘空间告警
- [ ] 数据库连接告警

**建议的告警阈值**:
```
CPU 使用率 > 80% 持续 5 分钟
内存使用率 > 85% 持续 5 分钟
磁盘使用率 > 90%
API 错误率 > 5%
API 响应时间 > 3秒
数据库连接数 > 80%
```

---

## 七、备份和恢复

### 7.1 备份策略 ✅
- [ ] 数据库每日备份
- [ ] 备份文件异地存储
- [ ] 备份保留策略（建议 30天）
- [ ] 备份完整性验证

### 7.2 恢复测试 ✅
- [ ] 数据库恢复流程已测试
- [ ] 应用恢复流程已测试
- [ ] 恢复时间在可接受范围内

**备份脚本示例**:
```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/backup/assethub
DB_NAME=zcgl
DB_USER=assethub
DB_PASS='your-password'

# 数据库备份
mysqldump -u$DB_USER -p$DB_PASS $DB_NAME | gzip > $BACKUP_DIR/db_${DATE}.sql.gz

# 文件备份
tar -czf $BACKUP_DIR/files_${DATE}.tar.gz /var/www/assethub

# 清理旧备份（保留30天）
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete

# 上传到对象存储
# aws s3 cp $BACKUP_DIR/db_${DATE}.sql.gz s3://your-bucket/backup/
```

---

## 八、回滚计划

### 8.1 回滚触发条件 ✅
- [ ] 服务不可用 > 10 分钟
- [ ] 错误率 > 20%
- [ ] 数据丢失或损坏
- [ ] 安全漏洞

### 8.2 回滚流程 ✅
```bash
# 1. 立即停止当前版本
pm2 stop assethub-backend
pm2 stop assethub-frontend

# 2. 恢复数据库（如需要）
gunzip < /backup/assethub/db_YYYYMMDD_HHMMSS.sql.gz | mysql -u assethub -p zcgl

# 3. 恢复上一版本
cp -r /backup/assethub/backend-v1.0 /var/www/assethub/backend
cp -r /backup/assethub/frontend-v1.0 /var/www/assethub/frontend

# 4. 重启服务
pm2 restart all

# 5. 验证服务
curl http://localhost:5183/api/health
```

---

## 九、部署完成确认

### 9.1 最终检查 ✅
- [ ] 所有服务运行正常
- [ ] 所有功能验证通过
- [ ] 性能指标达标
- [ ] 安全配置验证通过
- [ ] 监控告警正常

### 9.2 文档更新 ✅
- [ ] 部署文档已更新
- [ ] 配置文件已记录
- [ ] 访问地址已记录
- [ ] 维护人员已通知

### 9.3 交接确认
- [ ] 运维团队已培训
- [ ] 值班安排已确认
- [ ] 紧急联系方式已共享
- [ ] 监控仪表盘已共享

---

## 十、后续维护

### 10.1 定期维护任务
- [ ] 每周：日志审查
- [ ] 每周：性能报告
- [ ] 每月：安全更新
- [ ] 每季度：灾难恢复演练
- [ ] 每年：安全审计

### 10.2 版本更新流程
1. 测试环境完整测试
2. 预发布环境验证
3. 生产环境灰度发布
4. 全量发布
5. 监控和反馈

---

## 签名确认

**部署人员**: _______________  
**日期**: _______________  
**审批人员**: _______________  
**日期**: _______________  

---

**版本历史**:
- v1.0 (2026-05-01): 初始版本
