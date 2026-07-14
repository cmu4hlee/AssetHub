#!/usr/bin/env node

/**
 * 阿里云短信认证服务 - 使用专用API
 * 控制台: https://dypns.console.aliyun.com
 */

const crypto = require('crypto');
const https = require('https');

const config = {
  accessKeyId: 'LTAI5t77Vhimvhksx1dMsmc9',
  accessKeySecret: 'gZbt2Dg8H2xxougBhHMUPXocKanChC',
};

async function sendVerifyCode(phone) {
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  console.log('\n🔧 阿里云短信认证服务 (dypns)');
  console.log('='.repeat(50));
  console.log('📱 手机:', phone);
  console.log('🔢 验证码:', code);

  // 短信认证服务使用Dypns API
  const params = {
    AccessKeyId: config.accessKeyId,
    Action: 'SendSmsVerifyCode',
    Format: 'JSON',
    PhoneNumber: phone,
    SignName: '验证码',
    TemplateCode: 'SMS_1',
    TemplateParam: JSON.stringify({ code }),
    SignatureMethod: 'HMAC-SHA1',
    SignatureNonce: Math.random().toString(36),
    SignatureVersion: '1.0',
    Timestamp: new Date().toISOString().replace(/\.\d{3}/, '').replace('Z', 'Z'),
    Version: '2017-05-25',
  };

  const sortedKeys = Object.keys(params).sort();
  const sortedParams = sortedKeys.map(k => `${encodeURIComponent(k)  }=${  encodeURIComponent(params[k])}`).join('&');
  const stringToSign = `POST&%2F&${  encodeURIComponent(sortedParams)}`;
  const signature = crypto.createHmac('sha1', `${config.accessKeySecret  }&`).update(stringToSign).digest('base64');

  params.Signature = signature;
  const postData = Object.keys(params).map(k => `${k  }=${  encodeURIComponent(params[k])}`).join('&');

  console.log('📤 发送中...\n');

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'dysmsapi.aliyuncs.com',
      path: '/',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        console.log('📨 响应:', data);
        resolve();
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

sendVerifyCode(process.argv[2] || '18900915666');
