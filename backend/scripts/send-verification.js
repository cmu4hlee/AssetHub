#!/usr/bin/env node

/**
 * 阿里云短信认证服务 - 使用正确的API
 * 根据文档：https://help.aliyun.com/document_detail/179846.html
 */

const crypto = require('crypto');
const https = require('https');

const config = {
  accessKeyId: 'LTAI5t77Vhimvhksx1dMsmc9',
  accessKeySecret: 'gZbt2Dg8H2xxougBhHMUPXocKanChC',
};

async function sendVerifyCode(phone) {
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  console.log('\n🔧 阿里云短信认证服务测试');
  console.log('='.repeat(50));
  console.log('📱 目标手机:', phone);
  console.log('🔢 验证码:', code);

  // 正确的API参数
  const params = {
    AccessKeyId: config.accessKeyId,
    Action: 'SendSms',
    Format: 'JSON',
    PhoneNumbers: phone,
    SignName: '速通互联验证码',
    TemplateCode: 'SMS_100001',
    TemplateParam: JSON.stringify({ code, min: '5' }),
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

  try {
    const result = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'dysmsapi.aliyuncs.com',
        path: '/',
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }, res => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => resolve(JSON.parse(data)));
      });
      req.on('error', reject);
      req.write(postData);
      req.end();
    });

    console.log('📨 响应:', JSON.stringify(result, null, 2));

    if (result.Code === 'OK') {
      console.log('\n✅ ✅ ✅ 验证码发送成功！');
      console.log('📋 BizId:', result.BizId);
      console.log(`\n请检查手机 ${  phone  } 的短信！`);
    } else {
      console.log('\n❌ 发送失败');
      console.log('错误:', result.Code, result.Message);
    }
  } catch (e) {
    console.log('❌ 请求失败:', e.message);
  }
}

const phone = process.argv[2] || '18900915666';
sendVerifyCode(phone);
