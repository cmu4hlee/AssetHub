/**
 * 网络诊断工具
 * 用于诊断网络连接问题
 */

import axios from 'axios';

const diagnosticApi = axios.create({
  baseURL: '/api',
  timeout: 5000,
});

/**
 * 诊断网络连接问题
 */
export async function diagnoseNetworkIssue() {
  const diagnostics = {
    timestamp: new Date().toISOString(),
    checks: [],
    summary: '',
  };

  // 检查1: 通过代理访问后端
  try {
    const proxyResponse = await diagnosticApi.get('/health');
    diagnostics.checks.push({
      name: '通过代理访问后端',
      status: 'success',
      message: '代理配置正常',
      details: proxyResponse.data,
    });
  } catch (error) {
    diagnostics.checks.push({
      name: '通过代理访问后端',
      status: 'failed',
      message: '代理配置可能有问题',
      error: error.message,
      code: error.code,
    });
  }

  // 检查3: 检查浏览器环境
  diagnostics.checks.push({
    name: '浏览器环境',
    status: 'info',
    message: '浏览器信息',
    details: {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      onLine: navigator.onLine,
      cookieEnabled: navigator.cookieEnabled,
    },
  });

  // 生成摘要
  const successCount = diagnostics.checks.filter(c => c.status === 'success').length;
  const failedCount = diagnostics.checks.filter(c => c.status === 'failed').length;

  if (failedCount === 0) {
    diagnostics.summary = '✅ 所有检查通过，网络连接正常';
  } else if (successCount > 0) {
    diagnostics.summary = '⚠️ 部分检查失败，可能存在配置问题';
  } else {
    diagnostics.summary = '❌ 所有检查失败，后端服务可能未运行';
  }

  return diagnostics;
}

/**
 * 打印诊断结果 - 仅在开发环境
 * @param {Object} diagnostics 诊断结果
 */
export function printDiagnostics(diagnostics) {
  if (import.meta.env.MODE === 'development') {
    console.group('🔍 网络诊断报告');
    console.log('时间:', diagnostics.timestamp);
    console.log('摘要:', diagnostics.summary);
    console.group('详细检查结果');
    diagnostics.checks.forEach(check => {
      const icon = check.status === 'success' ? '✅' : check.status === 'failed' ? '❌' : 'ℹ️';
      console.log(`${icon} ${check.name}:`, check.message);
      if (check.details) {
        console.log('  详情:', check.details);
      }
      if (check.error) {
        console.log('  错误:', check.error);
        if (check.code) {
          console.log('  错误代码:', check.code);
        }
      }
    });
    console.groupEnd();
    console.groupEnd();
  }
}

/**
 * 快速诊断并输出结果
 */
export async function quickDiagnose() {
  const diagnostics = await diagnoseNetworkIssue();
  printDiagnostics(diagnostics);
  return diagnostics;
}

// 在开发环境下，将诊断函数挂载到 window 对象，方便在控制台调用
if (import.meta.env.DEV) {
  window.networkDiagnostics = {
    diagnose: diagnoseNetworkIssue,
    quickDiagnose,
    printDiagnostics,
  };
  console.log('💡 网络诊断工具已加载，在控制台输入 networkDiagnostics.quickDiagnose() 进行诊断');
}
