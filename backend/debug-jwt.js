const jwt = require('jsonwebtoken');
const config = require('./config/app.config').jwt;

console.log('JWT配置:', config);

// 测试令牌
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoiYWRtaW4iLCJyb2xlIjoic3lzdGVtX2FkbWluIiwiaWF0IjoxNzcwMTY3NzMxLCJleHAiOjE3NzAyNTQxMzF9.hK6zg5enaG7UiMQ0XQTES7dPYzJ6tdthXKKVWjqZH8o';

console.log('测试令牌:', token);

try {
  const decoded = jwt.verify(token, config.secret);
  console.log('✅ JWT验证成功');
  console.log('解码结果:', decoded);
} catch (error) {
  console.error('❌ JWT验证失败:', error.message);
  console.error('错误详情:', error);
}
