const db = require('../config/database');

async function createSentencesTable() {
  try {
    // 创建sentences表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS sentences (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sentence TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT NULL,
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log('sentences表创建成功');

    // 插入一些示例句子（可选）
    const sampleSentences = [
      'The quick brown fox jumps over the lazy dog.',
      'To be or not to be, that is the question.',
      'In the middle of difficulty lies opportunity.',
      'The only way to do great work is to love what you do.',
      'Success is not final, failure is not fatal: it is the courage to continue that counts.',
    ];

    // 检查是否已有数据
    const [existing] = await db.execute('SELECT COUNT(*) as count FROM sentences');
    if (existing[0].count === 0) {
      for (const sentence of sampleSentences) {
        await db.execute('INSERT INTO sentences (sentence) VALUES (?)', [sentence]);
      }
      console.log('示例句子插入成功');
    }

    process.exit(0);
  } catch (error) {
    console.error('创建表失败:', error);
    process.exit(1);
  }
}

createSentencesTable();
