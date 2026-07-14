#!/usr/bin/env node

/**
 * 阿里云短信认证服务 - 直接使用
 * 模板: SMS_1 (登录/注册模板)
 */

const crypto = require('crypto');
const https = require('https');

const config = {
  accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID || '',
  accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET || '',
};

async function sendVerifyCode(phone) {
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  console.log('\n🔧 阿里云短信认证服务');
  console.log('='.repeat(50));
  console.log('📱 手机:', phone);
  console.log('🔢 验证码:', code);

  // 使用短信认证服务的固定参数
  const params = {
    AccessKeyId: config.accessKeyId,
    Action: 'SendSms',
    Format: 'JSON',
    PhoneNumbers: phone,
    SignName: '速通互联验证码',
    TemplateCode: '100001',
    // Note: Template 100001 may require {code} parameter only, not {code,min}
    // Try adjusting TemplateParam to just {code: code} if API returns error
    TemplateParam: JSON.stringify({ code }),
    SignatureMethod: 'HMAC-SHA1',
    SignatureNonce: Math.random().toString(36),
    SignatureVersion: '1.0',
    Timestamp: new Date().toISOString().replace(/\.\d{3}/, '').replace('Z', 'Z'),
    Version: '2017-05-25',
  };

  // 生成签名
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
