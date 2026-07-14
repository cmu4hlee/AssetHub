#!/usr/bin/env node

/**
 * 阿里云短信认证服务 - 使用官方SDK和AccessKey
 */

const Dypnsapi20170525 = require('@alicloud/dypnsapi20170525');
const OpenApi = require('@alicloud/openapi-client');
const Util = require('@alicloud/tea-util');

const config = {
  accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID || '',
  accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET || '',
};

async function sendVerifyCode(phone) {
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  console.log('\n🔧 阿里云短信认证服务 (Dypns)');
  console.log('='.repeat(50));
  console.log('📱 手机:', phone);
  console.log('🔢 验证码:', code);

  // 使用AccessKey初始化Client
  const openApiConfig = new OpenApi.Config({
    accessKeyId: config.accessKeyId,
    accessKeySecret: config.accessKeySecret,
  });
  openApiConfig.endpoint = 'dypnsapi.aliyuncs.com';
  const client = new Dypnsapi20170525.default(openApiConfig);

  // 创建请求
  const sendSmsVerifyCodeRequest = new Dypnsapi20170525.SendSmsVerifyCodeRequest({
    signName: '速通互联验证码',
    templateCode: '100001',
    phoneNumber: phone,
    templateParam: JSON.stringify({ code, min: '5' }),
  });
  const runtime = new Util.RuntimeOptions({});

  console.log('📤 发送中...\n');

  try {
    const resp = await client.sendSmsVerifyCodeWithOptions(sendSmsVerifyCodeRequest, runtime);
    console.log('📨 响应:', JSON.stringify(resp, null, 2));

    if (resp.body && resp.body.code === 'OK') {
      console.log('\n✅ ✅ ✅ 验证码发送成功！');
      console.log('📋 BizId:', resp.body.bizId);
      console.log(`\n请检查手机 ${  phone  } 的短信！`);
      console.log('\n🔢 验证码:', code);
    } else {
      console.log('\n❌ 失败:', resp.body?.message || resp.body?.code);
    }
  } catch (error) {
    console.log('\n❌ 错误:', error.message);
    if (error.data && error.data.Recommend) {
      console.log('💡 诊断:', error.data.Recommend);
    }
  }
}

const phone = process.argv[2] || '18900915666';
sendVerifyCode(phone);
