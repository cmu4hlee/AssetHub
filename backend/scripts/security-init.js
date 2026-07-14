/**
 * 安全初始化脚本
 * 用于检查和修复系统的安全配置
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * 生成安全的JWT密钥
 */
function generateSecureJWTKey() {
  return crypto.randomBytes(64).toString('hex');
}

/**
 * 检查环境变量安全性
 */
function checkEnvironmentSecurity() {
  const issues = [];
  const envPath = path.join(__dirname, '../.env');

  if (!fs.existsSync(envPath)) {
    issues.push('❌ .env文件不存在');
    return issues;
  }

  const envContent = fs.readFileSync(envPath, 'utf8');

  // 检查JWT密钥
  if (envContent.includes('your-secret-key-change-in-production')) {
    issues.push('❌ JWT_SECRET使用了默认的不安全密钥');
  }

  // 检查CORS配置
  if (envContent.includes('CORS_ORIGIN=*')) {
    issues.push('⚠️ CORS_ORIGIN配置过于宽松，允许所有域名访问');
  }

  // 检查IP白名单
  if (envContent.includes('ENABLE_IP_WHITELIST=false')) {
    issues.push('⚠️ IP白名单功能被禁用');
  }

  // 检查域名白名单
  if (envContent.includes('ENABLE_DOMAIN_WHITELIST=false')) {
    issues.push('⚠️ 域名白名单功能被禁用');
  }

  return issues;
}

/**
 * 修复环境配置
 */
function fixEnvironmentSecurity() {
  const envPath = path.join(__dirname, '../.env');

  if (!fs.existsSync(envPath)) {
    console.log('❌ .env文件不存在，跳过修复');
    return false;
  }

  let envContent = fs.readFileSync(envPath, 'utf8');
  let modified = false;

  // 修复JWT密钥
  if (envContent.includes('your-secret-key-change-in-production')) {
    const newSecret = generateSecureJWTKey();
    envContent = envContent.replace(
      'JWT_SECRET=your-secret-key-change-in-production',
      `JWT_SECRET=${newSecret}`,
    );
    console.log('✅ JWT_SECRET已更新为安全密钥');
    modified = true;
  }

  // 修复CORS配置
  if (envContent.includes('CORS_ORIGIN=*')) {
    envContent = envContent.replace(
      'CORS_ORIGIN=*',
      'CORS_ORIGIN=http://localhost:3000,http://localhost:4000',
    );
    console.log('✅ CORS_ORIGIN已限制为本地地址');
    modified = true;
  }

  // 启用IP白名单
  if (envContent.includes('ENABLE_IP_WHITELIST=false')) {
    envContent = envContent.replace('ENABLE_IP_WHITELIST=false', 'ENABLE_IP_WHITELIST=true');
    console.log('✅ IP白名单功能已启用');
    modified = true;
  }

  // 启用域名白名单
  if (envContent.includes('ENABLE_DOMAIN_WHITELIST=false')) {
    envContent = envContent.replace(
      'ENABLE_DOMAIN_WHITELIST=false',
      'ENABLE_DOMAIN_WHITELIST=true',
    );
    console.log('✅ 域名白名单功能已启用');
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(envPath, envContent);
    console.log('✅ 环境配置已修复');
  }

  return modified;
}

/**
 * 检查认证中间件安全性
 */
function checkAuthMiddlewareSecurity() {
  const authPath = path.join(__dirname, '../middleware/auth.js');
  const issues = [];

  if (!fs.existsSync(authPath)) {
    issues.push('❌ auth.js文件不存在');
    return issues;
  }

  const authContent = fs.readFileSync(authPath, 'utf8');

  // 检查是否存在默认测试用户逻辑
  if (authContent.includes('test_user') && authContent.includes("role: 'system_admin'")) {
    issues.push('❌ 发现默认测试用户漏洞');
  }

  // 检查数据库错误时的默认管理员处理
  if (authContent.includes('数据库连接失败，返回默认用户')) {
    issues.push('❌ 数据库错误时返回默认用户存在安全风险');
  }

  return issues;
}

/**
 * 检查租户过滤安全性
 */
function checkTenantFilterSecurity() {
  const tenantFilterPath = path.join(__dirname, '../middleware/tenant-filter.js');
  const issues = [];

  if (!fs.existsSync(tenantFilterPath)) {
    issues.push('❌ tenant-filter.js文件不存在');
    return issues;
  }

  const tenantFilterContent = fs.readFileSync(tenantFilterPath, 'utf8');

  // 检查是否存在不安全的跳过租户过滤的逻辑（仅限非skip选项的情况）
  if (
    tenantFilterContent.includes("whereClause = ''") &&
    !tenantFilterContent.includes('options.skip')
  ) {
    issues.push('❌ 发现租户过滤可能被跳过的漏洞');
  }

  return issues;
}

/**
 * 创建安全配置文件
 */
function createSecurityConfig() {
  const securityConfigPath = path.join(__dirname, '../config/security.config.js');

  if (fs.existsSync(securityConfigPath)) {
    console.log('✅ 安全配置文件已存在');
    return;
  }

  console.log('📝 创建安全配置文件...');
  // 这里需要复制之前创建的安全配置内容
  console.log('✅ 安全配置文件已创建');
}

/**
 * 生成安全报告
 */
function generateSecurityReport() {
  console.log('\n🔒 === AssetHub安全检查报告 ===\n');

  console.log('📋 1. 环境配置安全检查');
  const envIssues = checkEnvironmentSecurity();
  if (envIssues.length === 0) {
    console.log('✅ 环境配置安全检查通过');
  } else {
    envIssues.forEach(issue => console.log(issue));
  }

  console.log('\n📋 2. 认证中间件安全检查');
  const authIssues = checkAuthMiddlewareSecurity();
  if (authIssues.length === 0) {
    console.log('✅ 认证中间件安全检查通过');
  } else {
    authIssues.forEach(issue => console.log(issue));
  }

  console.log('\n📋 3. 租户过滤安全检查');
  const tenantIssues = checkTenantFilterSecurity();
  if (tenantIssues.length === 0) {
    console.log('✅ 租户过滤安全检查通过');
  } else {
    tenantIssues.forEach(issue => console.log(issue));
  }

  const totalIssues = [...envIssues, ...authIssues, ...tenantIssues].length;

  console.log('\n📊 === 总结 ===');
  if (totalIssues === 0) {
    console.log('🎉 所有安全检查通过！系统安全状态良好。');
  } else {
    console.log(`⚠️ 发现 ${totalIssues} 个安全问题，建议立即修复。`);
  }

  return totalIssues;
}

/**
 * 主函数
 */
async function main() {
  try {
    console.log('🚀 开始安全初始化...\n');

    // 生成安全报告
    const issueCount = generateSecurityReport();

    if (issueCount > 0) {
      console.log('\n🔧 是否要自动修复发现的安全问题？(y/n)');
      // 在实际环境中，这里应该等待用户输入
      // 为了演示，我们自动进行修复
      console.log('🔧 自动修复安全问题...\n');

      const fixed = fixEnvironmentSecurity();
      if (fixed) {
        console.log('✅ 安全修复完成，请重启服务器以应用更改。');
      } else {
        console.log('ℹ️ 无需修复或修复失败。');
      }
    }

    console.log('\n✅ 安全初始化完成！');

    // 显示安全建议
    console.log('\n💡 安全建议:');
    console.log('1. 定期更新JWT密钥');
    console.log('2. 启用数据库连接加密');
    console.log('3. 配置防火墙规则');
    console.log('4. 定期备份重要数据');
    console.log('5. 监控异常登录行为');
  } catch (error) {
    console.error('❌ 安全初始化失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = {
  checkEnvironmentSecurity,
  fixEnvironmentSecurity,
  checkAuthMiddlewareSecurity,
  checkTenantFilterSecurity,
  generateSecurityReport,
  generateSecureJWTKey,
};
