const db = require('../config/database');

async function importDepartments() {
  try {
    // 用户提供的科室数据
    const departments = [
      { id: 1, name: '第一呼吸与危重症病房' },
      { id: 2, name: '呼吸重症监护病房/内科重症监护室（RICU/MICU）' },
      { id: 3, name: '第二呼吸内科病房' },
      { id: 4, name: '肺功能室' },
      { id: 5, name: '第一心血管内科病房' },
      { id: 6, name: '第二心血管内科病房' },
      { id: 7, name: '第三心血管内科病房' },
      { id: 8, name: '心脏重症监护病房（CCU）' },
      { id: 9, name: '心功能诊断中心' },
      { id: 10, name: '第一消化内镜内科病房' },
      { id: 11, name: '第二消化内镜内科病房' },
      { id: 12, name: '第三消化内镜内科病房（内镜微创综合治疗病房）' },
      { id: 13, name: '发热肠道门诊' },
      { id: 14, name: '内镜中心' },
      { id: 15, name: '内镜微创诊疗中心' },
      { id: 16, name: '肾内科病房' },
      { id: 17, name: '血液净化中心' },
      { id: 18, name: '血液内科病房' },
      { id: 19, name: '第一内分泌代谢内科病房' },
      { id: 20, name: '第二内分泌代谢内科病房' },
      { id: 21, name: '风湿免疫科病房' },
      { id: 22, name: '感染科病房' },
      { id: 23, name: '第一普通外科(肝胆脾外科、血管外科)病房' },
      { id: 24, name: '第二普通外科(胃肠外科、微创外科)病房' },
      { id: 25, name: '第三普通外科(结直肠外科、疝及腹壁外科)病房' },
      { id: 26, name: '第四普通外科(甲状腺外科、胆道外科、减重代谢外科)病房' },
      { id: 27, name: '第五普通外科(乳腺外科、肝胰外科)病房' },
      { id: 28, name: '第六普通外科(肛肠外科)病房' },
      { id: 29, name: '第七普通外科（日间外科、甲状腺外科、减重代谢外科）病房' },
      { id: 30, name: '第九普通外科（乳腺外科）病房' },
      { id: 31, name: '第一骨外科病房' },
      { id: 32, name: '第二骨外科病房' },
      { id: 33, name: '第一泌尿外科病房' },
      { id: 34, name: '第二泌尿外科病房' },
      { id: 35, name: '第三泌尿外科病房' },
      { id: 36, name: '男科中心' },
      { id: 37, name: '第一胸外科、心脏外科病房' },
      { id: 38, name: '第二胸外科病房' },
      { id: 39, name: '神经外科病房' },
      { id: 40, name: '局部解剖教研室' },
      { id: 41, name: '烧伤整形显微外科' },
      { id: 42, name: '妇科病房' },
      { id: 43, name: '产科病房' },
      { id: 44, name: '儿科门诊' },
      { id: 45, name: '儿科（新生儿科）病房' },
      { id: 46, name: '第一神经内科病房' },
      { id: 47, name: '第二神经内科病房' },
      { id: 48, name: '第三神经内科病房' },
      { id: 49, name: '神经重症监护病房（NICU）' },
      { id: 50, name: '第一肿瘤内科病房' },
      { id: 51, name: '第二肿瘤内科病房' },
      { id: 52, name: '胃肠肿瘤外科病房、第八普通外科病房' },
      { id: 53, name: '放射治疗科病房' },
      { id: 54, name: '放射治疗室' },
      { id: 55, name: '中医科' },
      { id: 56, name: '眼一病房' },
      { id: 57, name: '眼二病房' },
      { id: 58, name: '眼三病房' },
      { id: 59, name: '眼四病房' },
      { id: 60, name: '眼科特检科' },
      { id: 61, name: '眼科门诊' },
      { id: 62, name: '耳鼻咽喉科病房' },
      { id: 63, name: '口腔科' },
      { id: 64, name: '皮肤科' },
      { id: 65, name: '麻醉科' },
      { id: 66, name: '第一急诊科' },
      { id: 67, name: '第二急诊科' },
      { id: 68, name: '第一ICU' },
      { id: 69, name: '心理卫生精神科' },
      { id: 70, name: '康复医学科病房（北塔）' },
      { id: 71, name: '和平康复综合病房（中西医结合）' },
      { id: 72, name: '检验科' },
      { id: 73, name: '转化医学中心' },
      { id: 74, name: '中心实验室' },
      { id: 75, name: '实验动物中心（由辽宁省晶状体学实验室管理）' },
      { id: 76, name: '生物医学创新中心' },
      { id: 77, name: '病案科' },
      { id: 78, name: '输血科' },
      { id: 79, name: '病理科' },
      { id: 80, name: '放射诊断科' },
      { id: 81, name: '介入科病房' },
      { id: 82, name: '超声科' },
      { id: 83, name: '核医学病房' },
      { id: 84, name: '临床药学科' },
      { id: 85, name: '静脉用药调制中心（简称配置中心）' },
      { id: 86, name: '老年医学病房' },
      { id: 87, name: '全科医学科病房' },
      { id: 88, name: '临床营养科' },
      { id: 89, name: '综合医疗病房' },
      { id: 90, name: '手术室' },
    ];

    console.log('准备导入科室数据，共', departments.length, '条');

    // 使用事务批量插入
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // 清空现有科室数据
      await connection.execute('TRUNCATE TABLE departments');

      const insertSQL = `
        INSERT INTO departments (department_code, department_name, parent_code, level)
        VALUES (?, ?, ?, ?)
      `;

      let importedCount = 0;

      for (const dept of departments) {
        const [result] = await connection.execute(insertSQL, [
          `DEP${dept.id}`, // 生成部门编码
          dept.name, // 部门名称
          null, // 上级编码
          1, // 级别
        ]);
        importedCount += result.affectedRows;
      }

      await connection.commit();
      console.log('科室数据导入成功，共导入:', importedCount, '条');
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('导入科室数据失败:', error);
  }
}

// 执行导入
importDepartments();
