#!/usr/bin/env node

/**
 * 阿里云短信认证服务 - 使用正确的API参数
 * 基于CLI命令: aliyun dypnsapi send-sms-verify-code
 */

const crypto = require('crypto');
const https = require('https');

const config = {
  accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID || '',
  accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET || '',
  region: 'ap-southeast-1',  // 新加坡区域
};

async function sendVerifyCode(phone) {
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  console.log('\n🔧 阿里云短信认证服务 (dypns)');
  console.log('='.repeat(50));
  console.log('📱 手机:', phone);
  console.log('🔢 验证码:', code);

  // 使用CLI命令中的正确参数格式
  const params = {
    AccessKeyId: config.accessKeyId,
    Action: 'SendSmsVerifyCode',
    Format: 'JSON',
    PhoneNumber: phone,  // 不是 PhoneNumbers
    SignName: '速通互联验证码',
    TemplateCode: '100001',
    TemplateParam: JSON.stringify({ code, min: '5' }),
    SignatureMethod: 'HMAC-SHA1',
    SignatureNonce: Math.random().toString(36),
    SignatureVersion: '1.0',
    Timestamp: new Date().toISOString().replace(/\.\d{3}/, '').replace('Z', 'Z'),
    Version: '2021-01-11',
  };

  // 生成签名
  const sortedKeys = Object.keys(params).sort();
  const sortedParams = sortedKeys.map(k => `${encodeURIComponent(k)  }=${  encodeURIComponent(params[k])}`).join('&');
  const stringToSign = `POST&%2F&${  encodeURIComponent(sortedParams)}`;
  const signature = crypto.createHmac('sha1', `${config.accessKeySecret  }&`).update(stringToSign).digest('base64');

  params.Signature = signature;
  const postData = Object.keys(params).map(k => `${k  }=${  encodeURIComponent(params[k])}`).join('&');

  // 使用新加坡区域的endpoint
  const endpoint = 'dysmsapi.ap-southeast-1.aliyuncs.com';

  console.log('📤 发送中...\n');
  console.log('🌍 区域:', config.region);
  console.log('📡 Endpoint:', endpoint);

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: endpoint,
      path: '/',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        console.log('📨 响应:', data);
        try {
          const result = JSON.parse(data);
          if (result.Code === 'OK') {
            console.log('\n✅ ✅ ✅ 验证码发送成功！');
            console.log('📋 BizId:', result.BizId);
            console.log(`\n请检查手机 ${  phone  } 的短信！`);
          } else {
            console.log('\n❌ 失败:', result.Code, result.Message);
          }
        } catch (e) {
          console.log('解析错误:', e.message);
        }
        resolve();
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

sendVerifyCode(process.argv[2] || '18900915666');
