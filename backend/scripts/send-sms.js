#!/usr/bin/env node

/**
 * 阿里云短信服务测试 - 最终版本
 */

const crypto = require('crypto');
const https = require('https');

async function sendCode(phone) {
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  // 可用的签名列表（请选择正确的）
  const signatures = ['阿里云', 'AssetHub', '验证码', '验证码通知'];
  const templates = ['SMS_333876683'];

  for (const signName of signatures) {
    console.log(`\n📱 尝试签名: ${signName}`);
    console.log(`🔢 验证码: ${code}`);

    const params = {
      AccessKeyId: 'LTAI5t77Vhimvhksx1dMsmc9',
      Action: 'SendSms',
      Format: 'JSON',
      PhoneNumbers: phone,
      SignatureMethod: 'HMAC-SHA1',
      SignatureNonce: Math.random().toString(36),
      SignatureVersion: '1.0',
      SignName: signName,
      TemplateCode: templates[0],
      TemplateParam: JSON.stringify({ code }),
      Timestamp: new Date().toISOString().replace(/\.\d{3}/, '').replace('Z', 'Z'),
      Version: '2017-05-25',
    };

    const sortedKeys = Object.keys(params).sort();
    const sortedParams = sortedKeys.map(k => `${encodeURIComponent(k)  }=${  encodeURIComponent(params[k])}`).join('&');

    const stringToSign = `POST&%2F&${  encodeURIComponent(sortedParams)}`;
    const signature = crypto.createHmac('sha1', 'gZbt2Dg8H2xxougBhHMUPXocKanChC&').update(stringToSign).digest('base64');

    params.Signature = signature;
    const postData = Object.keys(params).map(k => `${k  }=${  encodeURIComponent(params[k])}`).join('&');

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

      if (result.Code === 'OK') {
        console.log('\n✅ ✅ ✅ 验证码发送成功！');
        console.log('📋 BizId:', result.BizId);
        console.log(`\n请检查手机 ${phone} 的短信！`);
        return;
      } else if (result.Code === 'isv.SMS_SIGNATURE_ILLEGAL') {
        console.log('  ❌ 签名不存在');
      } else {
        console.log('  ❌ 错误:', result.Message);
      }
    } catch (e) {
      console.log('  ❌ 请求失败:', e.message);
    }
  }

  console.log('\n❌ 所有签名都失败了');
  console.log('\n💡 请确认:');
  console.log('1. 签名已在阿里云控制台审核通过');
  console.log('2. 签名名称完全匹配（区分大小写）');
  console.log('3. 模板已正确配置');
}

const phone = process.argv[2] || '18900915666';
console.log('🔧 阿里云短信验证码测试');
console.log('='.repeat(50));
console.log('📱 目标手机:', phone);
sendCode(phone);
