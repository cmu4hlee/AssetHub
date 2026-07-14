/**
 * 为标签模板添加示例元素
 * 解决标签预览为空白的问题
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const { database: databaseConfig } = require('../config/app.config');

async function addTemplateElements() {
  let connection;
  try {
    console.log('开始为标签模板添加示例元素...\n');

    connection = await mysql.createConnection({
      host: databaseConfig.host,
      port: databaseConfig.port,
      user: databaseConfig.user,
      password: databaseConfig.password,
      database: databaseConfig.database,
      connectTimeout: 10000,
    });

    console.log('✓ 数据库连接成功\n');

    // 获取所有模板
    const [templates] = await connection.execute(
      'SELECT id, name, width, height, elements FROM asset_label_templates',
    );

    console.log(`✓ 找到 ${templates.length} 个模板\n`);

    // 示例元素配置
    const sampleElements = [
      {
        id: 1,
        type: 'text',
        x: 10,
        y: 10,
        width: 80,
        height: 6,
        text: '资产编号',
        field: 'asset_code',
        fontSize: 14,
        color: '#000000',
        fontWeight: 'bold',
        fontFamily: 'Arial',
      },
      {
        id: 2,
        type: 'text',
        x: 10,
        y: 20,
        width: 80,
        height: 5,
        text: '',
        field: 'asset_code',
        fontSize: 12,
        color: '#000000',
        fontFamily: 'Arial',
      },
      {
        id: 3,
        type: 'text',
        x: 10,
        y: 30,
        width: 80,
        height: 6,
        text: '资产名称',
        field: 'asset_name',
        fontSize: 14,
        color: '#000000',
        fontWeight: 'bold',
        fontFamily: 'Arial',
      },
      {
        id: 4,
        type: 'text',
        x: 10,
        y: 40,
        width: 80,
        height: 5,
        text: '',
        field: 'asset_name',
        fontSize: 12,
        color: '#000000',
        fontFamily: 'Arial',
      },
      {
        id: 5,
        type: 'barcode',
        x: 10,
        y: 50,
        width: 80,
        height: 20,
        text: '',
        field: 'asset_code',
        fontSize: 10,
        color: '#000000',
      },
    ];

    for (const template of templates) {
      try {
        console.log(`正在处理模板: ${template.name} (ID: ${template.id})`);

        // 解析现有元素
        let currentElements = [];
        if (template.elements && template.elements !== '[]') {
          try {
            currentElements = JSON.parse(template.elements);
          } catch (error) {
            console.error(`  ⚠️  解析现有元素失败，使用示例元素: ${error.message}`);
            currentElements = [];
          }
        }

        // 如果元素为空，添加示例元素
        if (currentElements.length === 0) {
          // 根据模板尺寸调整元素位置和大小
          const adjustedElements = sampleElements.map(el => ({
            ...el,
            // 根据模板高度调整垂直位置
            y: Math.min(el.y, parseFloat(template.height) - 10),
          }));

          // 更新模板元素
          await connection.execute('UPDATE asset_label_templates SET elements = ? WHERE id = ?', [
            JSON.stringify(adjustedElements),
            template.id,
          ]);
          console.log('  ✅ 已添加示例元素');
        } else {
          console.log(`  ✅ 模板已有 ${currentElements.length} 个元素，跳过`);
        }
      } catch (error) {
        console.error(`  ❌ 处理模板失败: ${error.message}`);
      }

      console.log('');
    }

    await connection.end();
    console.log('✅ 所有模板处理完成！');
    return true;
  } catch (error) {
    console.error('\n❌ 执行失败:');
    console.error('错误代码:', error.code);
    console.error('错误消息:', error.message);
    if (connection) {
      try {
        await connection.end();
      } catch (e) {
        // 忽略关闭错误
      }
    }
    return false;
  }
}

// 运行脚本
addTemplateElements()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('脚本执行异常:', error);
    process.exit(1);
  });
