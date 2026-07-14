const fs = require('fs');

/**
 * 计算token数量的简单估算函数
 * 基于OpenAI的估算：1个token ≈ 4个字符
 * @param {string} text - 文本内容
 * @returns {number} 估算的token数量
 */
function estimateTokenCount(text) {
  if (!text) return 0;
  // 简单估算：1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
}

/**
 * 模拟构建AI分析提示词的过程
 */
async function calculateAIPromptTokenCount() {
  try {
    console.log('=== 计算AI分析提示词Token数量 ===\n');

    // 从MD文件读取数据库结构
    const mdFilePath =
      '/Users/cjlee/Desktop/Mac_Win_share/AssetHub/资产管理vite/zcgl-database-structure.md';
    let dbStructureContent;
    try {
      dbStructureContent = fs.readFileSync(mdFilePath, 'utf8');
      console.log(`成功读取数据库结构文件: ${mdFilePath}`);
    } catch (error) {
      console.log(`数据库结构文件不存在，使用默认结构描述: ${error.message}`);
      // 使用默认的数据库结构描述
      dbStructureContent = `# 资产管理系统数据库结构

## 核心表结构

### 资产主表（assets）
- id: 资产ID，主键
- asset_code: 资产编号
- asset_name: 资产名称
- brand: 品牌
- model: 型号
- specification: 规格
- department: 所属科室
- department_new: 新所属科室
- status: 资产状态
- purchase_date: 购买日期
- purchase_price: 购买价格

### 科室表（departments）
- id: 科室ID，主键
- department_code: 科室编码
- department_name: 科室名称
- tenant_id: 租户ID

### 资产分类表（asset_categories）
- id: 分类ID，主键
- category_code: 分类编码
- category_name: 分类名称

### 资产变更日志表（asset_change_logs）
- id: 日志ID，主键
- asset_id: 资产ID
- change_type: 变更类型
- change_content: 变更内容
- created_at: 创建时间`;
    }

    console.log(`1. 原始数据库结构文件大小: ${dbStructureContent.length} 字符`);
    console.log(`   估算token数: ${estimateTokenCount(dbStructureContent)}`);

    // 只保留与资产分析相关的核心表结构
    const coreTables = [
      '资产主表（assets）',
      '科室表（departments）',
      '资产分类表（asset_categories）',
      '资产变更日志表（asset_change_logs）',
    ];

    // 解析并过滤数据库结构，只保留核心表
    const lines = dbStructureContent.split('\n');
    const filteredLines = [];
    let includeLine = false;

    for (const line of lines) {
      // 检查是否是表定义行
      const tableMatch = line.match(/^表\d+：(.*?)$/);
      if (tableMatch) {
        const tableName = tableMatch[1];
        includeLine = coreTables.some(coreTable => tableName.includes(coreTable));
      }

      // 如果包含当前行或者是标题行，添加到过滤后的内容中
      if (includeLine || line.startsWith('#') || line.startsWith('数据库名：')) {
        filteredLines.push(line);
      }
    }

    // 重新构建过滤后的数据库结构内容
    dbStructureContent = filteredLines.join('\n');

    console.log(`\n2. 过滤后核心表结构大小: ${dbStructureContent.length} 字符`);
    console.log(`   估算token数: ${estimateTokenCount(dbStructureContent)}`);

    // 构建约束条件
    const constraints = `
## 指令约束
0.不可以生成增加、删除和更新的数据库语句
1. 严格根据上述数据库结构生成SQL，禁止使用未定义的表/字段/关联关系；
2. 生成的SQL为标准[MySQL]语法，适配对应数据库版本，无需额外注释；
3. 处理时间/数值字段时保留原字段类型，无需类型转换，条件判断使用精准运算符；
4. 若用户需求涉及多表关联，必须使用显式JOIN（INNER JOIN/LEFT JOIN），禁止隐式连接；
5. 若用户需求模糊（如未指定时间范围），仅生成基础SQL框架，不随意补充条件；
6. 直接输出SQL语句，无其他多余文字（如"以下是生成的SQL"）；
7. 当需要查询科室资产时，科室的匹配使用LIKE而不使用=。

### 示例查询
1.查询某资产明细，以病理科为例：SELECT a.*
 FROM assets a
 INNER JOIN departments d ON a.department = d.department_name
 WHERE d.department_name LIKE '%病理科%';

2.查询资产总明细，以显微镜为例：SELECT 
     a.asset_name,
     a.asset_code,
     a.brand,
     a.model,
     a.department,
     a.use_department,
     a.location,
     a.status,
     a.purchase_date,
     a.purchase_price,
     a.current_value,
     a.depreciation_method,
     a.depreciation_years,
     a.warranty_period,
     a.warranty_end_date,
     a.created_at
 FROM assets a
 WHERE a.asset_name LIKE '%显微镜%'
    `.trim();

    console.log(`\n3. 指令约束和示例查询大小: ${constraints.length} 字符`);
    console.log(`   估算token数: ${estimateTokenCount(constraints)}`);

    // 用户问题
    const userPrompt = '病理科资产情况';

    console.log(`\n4. 用户问题大小: ${userPrompt.length} 字符`);
    console.log(`   估算token数: ${estimateTokenCount(userPrompt)}`);

    // 构建完整提示词
    const fullPrompt = `
## 数据库结构信息
${dbStructureContent}

${constraints}

## 用户问题
${userPrompt}
    `.trim();

    console.log(`\n5. 完整提示词大小: ${fullPrompt.length} 字符`);
    console.log(`   估算token数: ${estimateTokenCount(fullPrompt)}`);

    // 计算总token数
    const totalTokens = estimateTokenCount(fullPrompt);

    console.log('\n=== 最终估算结果 ===');
    console.log(`发送"病理科资产情况"分析请求需要上传的token数: ${totalTokens}`);
    console.log('\n注意: 这是基于字符数的估算值，实际token数可能会有所不同。');
    console.log('不同AI模型的token计算方式可能略有差异。');
  } catch (error) {
    console.error('计算token数量失败:', error.message);
  }
}

// 运行计算
calculateAIPromptTokenCount();
