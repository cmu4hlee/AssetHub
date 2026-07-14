/**
 * 阿里云短信认证服务
 * 使用 Dypns API SDK
 */

let Dypnsapi20170525, OpenApi, Util;
let smsSdkAvailable = false;

try {
  Dypnsapi20170525 = require('@alicloud/dypnsapi20170525');
  OpenApi = require('@alicloud/openapi-client');
  Util = require('@alicloud/tea-util');
  smsSdkAvailable = true;
} catch (error) {
  console.warn('⚠️ 短信SDK未安装或加载失败，将使用模拟模式（验证码将在控制台打印）:', error.message);
}

const SMS_CONFIG = {
  accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID || '',
  accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET || '',
  signName: process.env.ALIYUN_SMS_SIGN_NAME || '',
  templateCode: process.env.ALIYUN_SMS_TEMPLATE_CODE || '',
};

let client = null;
const lastSendTime = {};

function assertSmsConfig() {
  const missing = [];
  if (!SMS_CONFIG.accessKeyId) missing.push('ALIYUN_ACCESS_KEY_ID');
  if (!SMS_CONFIG.accessKeySecret) missing.push('ALIYUN_ACCESS_KEY_SECRET');
  if (!SMS_CONFIG.signName) missing.push('ALIYUN_SMS_SIGN_NAME');
  if (!SMS_CONFIG.templateCode) missing.push('ALIYUN_SMS_TEMPLATE_CODE');

  if (missing.length > 0) {
    throw new Error(`短信服务配置缺失: ${missing.join(', ')}`);
  }
}

function getClient() {
  if (!client && Dypnsapi20170525 && OpenApi) {
    try {
      assertSmsConfig();
      const config = new OpenApi.Config({
        accessKeyId: SMS_CONFIG.accessKeyId,
        accessKeySecret: SMS_CONFIG.accessKeySecret,
      });
      config.endpoint = 'dypnsapi.aliyuncs.com';
      client = new Dypnsapi20170525.default(config);
      console.log('✅ SMS Client initialized');
    } catch (error) {
      console.error('❌ SMS Client创建失败:', error.message);
    }
  }
  return client;
}

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function canSend(phone) {
  const now = Date.now();
  const lastTime = lastSendTime[phone] || 0;
  if (now - lastTime < 60000) {
    return false;
  }
  return true;
}

async function sendVerificationCode(phone) {
  const maskedPhone = typeof phone === 'string' ? phone.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2') : '';
  console.log('📱 发送验证码到:', maskedPhone);

  if (!canSend(phone)) {
    const error = new Error('发送太频繁，请1分钟后再试');
    console.error('❌', error.message);
    throw error;
  }

  const code = generateCode();

  if (!smsSdkAvailable) {
    console.log('🔔 【模拟模式】验证码: ' + code + ' (手机尾号: ' + maskedPhone + ')');
    lastSendTime[phone] = Date.now();
    setTimeout(() => {
      delete lastSendTime[phone];
    }, 60000);
    return {
      success: true,
      code: 'MOCK',
      message: '模拟模式：验证码已打印到控制台',
      bizId: 'mock-' + Date.now(),
      codeValue: code,
    };
  }

  assertSmsConfig();

  const clientInstance = getClient();

  if (!clientInstance) {
    const error = new Error('短信客户端未初始化');
    console.error('❌', error.message);
    throw error;
  }

  try {
    const request = new Dypnsapi20170525.SendSmsVerifyCodeRequest({
      signName: SMS_CONFIG.signName,
      templateCode: SMS_CONFIG.templateCode,
      phoneNumber: phone,
      templateParam: JSON.stringify({ code, min: '5' }),
    });

    const runtime = new Util.RuntimeOptions({});

    const response = await clientInstance.sendSmsVerifyCodeWithOptions(request, runtime);

    console.log('📨 短信服务响应:', response.body?.success ? 'success' : response.body?.code || 'failed');

    if (response.body.success) {
      lastSendTime[phone] = Date.now();
      setTimeout(() => {
        delete lastSendTime[phone];
      }, 60000);

      return {
        success: true,
        code: response.body.code,
        message: response.body.message,
        bizId: response.body.model?.bizId,
        codeValue: code,
      };
    } else {
      if (response.body.code === 'biz.FREQUENCY') {
        throw new Error('发送太频繁，请稍后再试');
      }
      throw new Error(response.body.message || '发送失败');
    }
  } catch (error) {
    console.error('❌ 发送失败:', error.message);
    throw error;
  }
}

async function verifyCode(phone, inputCode) {
  if (!smsSdkAvailable) {
    return {
      success: true,
      code: 'MOCK',
      message: '模拟模式：验证码自动通过',
    };
  }

  const clientInstance = getClient();

  if (!clientInstance) {
    throw new Error('短信客户端未初始化');
  }

  const request = new Dypnsapi20170525.CheckSmsVerifyCodeRequest({
    phoneNumber: phone,
    templateCode: SMS_CONFIG.templateCode,
    code: inputCode,
  });

  const runtime = new Util.RuntimeOptions({});

  const response = await clientInstance.checkSmsVerifyCodeWithOptions(request, runtime);

  return {
    success: response.body.success,
    code: response.body.code,
    message: response.body.message,
  };
}

module.exports = {
  sendVerificationCode,
  verifyCode,
  generateCode,
  SMS_CONFIG,
};
