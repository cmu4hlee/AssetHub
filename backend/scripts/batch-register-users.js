const db = require('../config/database');
const bcrypt = require('bcryptjs');

// 用户提供的科室统计明细数据
const userData = [
  { seq: 1, department: '第一呼吸与危重症病房', name: '杭帆', phone: '18900912267' },
  {
    seq: 2,
    department: '呼吸重症监护病房/内科重症监护室（RICU/MICU）',
    name: '李美琪',
    phone: '18900913124',
  },
  { seq: 3, department: '第二呼吸内科病房', name: '李诗', phone: '18900913410' },
  { seq: 4, department: '肺功能室', name: '', phone: '' },
  { seq: 5, department: '第一心血管内科病房', name: '王霞', phone: '' },
  { seq: 6, department: '第二心血管内科病房', name: '王霞', phone: '' },
  { seq: 7, department: '第三心血管内科病房', name: '车梦昕', phone: '18900912150' },
  { seq: 8, department: '心脏重症监护病房（CCU）', name: '孙振男', phone: '18900915400' },
  { seq: 9, department: '心功能诊断中心', name: '', phone: '' },
  { seq: 10, department: '第一消化内镜内科病房', name: '吴迪', phone: '18900913371' },
  { seq: 11, department: '第二消化内镜内科病房', name: '段丽鑫', phone: '18900912619' },
  {
    seq: 12,
    department: '第三消化内镜内科病房（内镜微创综合治疗病房）',
    name: '阎昭辰',
    phone: '18900912264',
  },
  { seq: 13, department: '发热肠道门诊', name: '马君倩', phone: '18900912153' },
  { seq: 14, department: '内镜中心', name: '赵爽', phone: '18900912140' },
  { seq: 15, department: '内镜微创诊疗中心', name: '赵爽', phone: '18900912140' },
  { seq: 16, department: '肾内科病房', name: '付瑶', phone: '18900912071' },
  { seq: 17, department: '血液净化中心', name: '王驰', phone: '18900916027' },
  { seq: 18, department: '血液内科病房', name: '王美玲', phone: '18900912276' },
  { seq: 19, department: '第一内分泌代谢内科病房', name: '朱晓明', phone: '18900912082' },
  { seq: 20, department: '第二内分泌代谢内科病房', name: '朱晓明', phone: '18900912082' },
  { seq: 21, department: '风湿免疫科病房', name: '黄弘', phone: '18900912157' },
  { seq: 22, department: '感染科病房', name: '', phone: '' },
  {
    seq: 23,
    department: '第一普通外科(肝胆脾外科、血管外科)病房',
    name: '徐红艳 9A病区（3077）；朱莉思9B病区（2159）',
    phone: '18900913077/18900912159',
  },
  {
    seq: 24,
    department: '第二普通外科(胃肠外科、微创外科)病房',
    name: '高云',
    phone: '18900912425',
  },
  {
    seq: 25,
    department: '第三普通外科(结直肠外科、疝及腹壁外科)病房',
    name: '张惜妍',
    phone: '18900913150',
  },
  {
    seq: 26,
    department: '第四普通外科(甲状腺外科、胆道外科、减重代谢外科)病房',
    name: '徐红艳 9A病区（3077）；朱莉思9B病区（2159）',
    phone: '18900913077/18900912159',
  },
  { seq: 27, department: '第五普通外科(乳腺外科、肝胰外科)病房', name: '王丹秋', phone: '' },
  { seq: 28, department: '第六普通外科(肛肠外科)病房', name: '何帅', phone: '18900913726' },
  {
    seq: 29,
    department: '第七普通外科（日间外科、甲状腺外科、减重代谢外科）病房',
    name: '徐红艳 9A病区（3077）；朱莉思9B病区（2159）',
    phone: '18900913077/18900912159',
  },
  { seq: 30, department: '第九普通外科（乳腺外科）病房', name: '王丽', phone: '189 0091 3001' },
  { seq: 31, department: '第一骨外科病房', name: '张迎春', phone: '18900913569' },
  { seq: 32, department: '第二骨外科病房', name: '邹素云', phone: '18900912399' },
  { seq: 33, department: '第一泌尿外科病房', name: '刘威', phone: '18900912728' },
  { seq: 34, department: '第二泌尿外科病房', name: '邹素云', phone: '18900912399' },
  { seq: 35, department: '第三泌尿外科病房', name: '王晓桐', phone: '18900915815' },
  { seq: 36, department: '男科中心', name: '', phone: '' },
  { seq: 37, department: '第一胸外科、心脏外科病房', name: '冯秀琴', phone: '18900912599' },
  {
    seq: 38,
    department: '第二胸外科病房',
    name: '王丹秋8A病区.高云8B病区',
    phone: '18900913082/18900912425',
  },
  { seq: 39, department: '神经外科病房', name: '梁杰', phone: '18900913233' },
  { seq: 40, department: '局部解剖教研室', name: '', phone: '' },
  { seq: 41, department: '烧伤整形显微外科', name: '王亮', phone: '18900916336' },
  { seq: 42, department: '妇科病房', name: '王雪飞', phone: '18900913198' },
  { seq: 43, department: '产科病房', name: '张敏', phone: '18900913226' },
  { seq: 44, department: '儿科门诊', name: '李月', phone: '18900913146' },
  { seq: 45, department: '儿科（新生儿科）病房', name: '王琳琳', phone: '18900912368' },
  { seq: 46, department: '第一神经内科病房', name: '李奕诺', phone: '18900915811' },
  { seq: 47, department: '第二神经内科病房', name: '于淼', phone: '18900913185' },
  { seq: 48, department: '第三神经内科病房', name: '于淼', phone: '18900913185' },
  { seq: 49, department: '神经重症监护病房（NICU）', name: '李晓瑛/未丽', phone: '18900913368' },
  { seq: 50, department: '第一肿瘤内科病房', name: '张晓丹', phone: '18900913570' },
  { seq: 51, department: '第二肿瘤内科病房', name: '刘欣', phone: '18900913393' },
  { seq: 52, department: '胃肠肿瘤外科病房、第八普通外科病房', name: '李艳', phone: '18900913311' },
  { seq: 53, department: '放射治疗科病房', name: '宋彦杰', phone: '18900912319' },
  { seq: 54, department: '放射治疗室', name: '刘大伟', phone: '18900913007' },
  { seq: 55, department: '中医科', name: '', phone: '' },
  { seq: 56, department: '第一眼科病房', name: '董莹', phone: '18900912212' },
  { seq: 57, department: '第二眼科病房', name: '安波', phone: '18900913002' },
  { seq: 58, department: '眼三病房', name: '', phone: '' },
  { seq: 59, department: '眼四病房', name: '', phone: '' },
  { seq: 60, department: '眼科特检科', name: '史铭宇', phone: '18900913663' },
  { seq: 61, department: '眼科门诊', name: '王秀贤', phone: '18940035567' },
  { seq: 62, department: '耳鼻咽喉科病房', name: '安晶', phone: '18040051088' },
  { seq: 63, department: '口腔科', name: '王诗宇/付静', phone: '18900912056' },
  { seq: 64, department: '皮肤科', name: '付明媚', phone: '18900913144' },
  { seq: 65, department: '麻醉科', name: '刘莉', phone: '18900912653' },
  { seq: 66, department: '第一急诊科', name: '刘哲', phone: '18900912963' },
  { seq: 67, department: '第二急诊科', name: '刘微', phone: '18900916102' },
  { seq: 68, department: '第一ICU', name: '刘丽红/关冬梅', phone: '18900913839' },
  { seq: 69, department: '心理卫生精神科', name: '', phone: '' },
  { seq: 70, department: '康复医学科病房（北塔）', name: '姚佳', phone: '18900912891' },
  { seq: 71, department: '和平康复综合病房（中西医结合）', name: '张晓君', phone: '18900913060' },
  { seq: 72, department: '检验科', name: '', phone: '' },
  { seq: 73, department: '转化医学中心', name: '于涛/李嵚', phone: '18900912976/18900916689' },
  { seq: 74, department: '中心实验室', name: '', phone: '' },
  { seq: 75, department: '实验动物中心（由辽宁省晶状体学实验室管理）', name: '', phone: '' },
  { seq: 76, department: '生物医学创新中心', name: '', phone: '' },
  { seq: 77, department: '病案科', name: '', phone: '' },
  { seq: 78, department: '输血科', name: '张毅', phone: '18900913183' },
  { seq: 79, department: '病理科', name: '李悦', phone: '18900913104' },
  { seq: 80, department: '放射诊断科', name: '李艾彤/贾中文/黎秋菊', phone: '18900912259' },
  { seq: 81, department: '介入科病房', name: '时明霞', phone: '18900912691' },
  { seq: 82, department: '超声科', name: '', phone: '' },
  { seq: 83, department: '核医学病房', name: '孙诗琪', phone: '18900916254' },
  { seq: 84, department: '临床药学科', name: '', phone: '' },
  { seq: 85, department: '静脉用药调制中心（简称配置中心）', name: '', phone: '' },
  { seq: 86, department: '老年医学病房', name: '王艺潼', phone: '18900912032' },
  {
    seq: 87,
    department: '全科医学科病房',
    name: '孙晓琳/洪晓雪',
    phone: '18900913605/18900915830',
  },
  { seq: 88, department: '临床营养科', name: '', phone: '' },
  { seq: 89, department: '综合医疗病房', name: '黄弘', phone: '18900912157' },
  { seq: 90, department: '第一手术室', name: '李冰蕊/王靖', phone: '18900913700/18900913678' },
  { seq: 91, department: '崇山门诊', name: '于胜淼/王艺锦/赵莹莹', phone: '18900915969' },
  { seq: 92, department: '消毒供应中心', name: '张爱君', phone: '18900913693' },
  { seq: 93, department: '体检中心', name: '王玉丹', phone: '18900912256' },
  { seq: 94, department: '沈北门诊部', name: '张洋', phone: '18900913023' },
  { seq: 95, department: '第二手术室', name: '康冬雪', phone: '18900913698' },
  { seq: 96, department: '和平眼科门诊', name: '胡静', phone: '18900913565' },
  { seq: 97, department: '耳鼻咽喉门诊', name: '衡秀程/曹红梅', phone: '18900913711/18900913708' },
  {
    seq: 98,
    department: '第一介入治疗中心',
    name: '梁冬梅/杨丽',
    phone: '18900912086/18900912112',
  },
];

// 清理电话号码，提取数字
function cleanPhone(phone) {
  if (!phone) return '';
  // 移除所有非数字字符
  return phone.replace(/\D/g, '');
}

// 获取电话号码后四位作为密码
function getPasswordFromPhone(phone) {
  const cleaned = cleanPhone(phone);
  if (cleaned.length >= 4) {
    return cleaned.slice(-4);
  }
  // 如果电话号码不足4位，使用默认密码
  return '1234';
}

// 解析姓名（处理多个姓名的情况，如"徐红艳 9A病区（3077）；朱莉思9B病区（2159）"或"于胜淼/王艺锦/赵莹莹"）
function parseNames(nameStr) {
  if (!nameStr || nameStr.trim() === '') return [];

  // 先按分号或斜杠分割
  const parts = nameStr.split(/[；;/]/);
  const names = [];

  for (const part of parts) {
    // 提取中文姓名（通常2-4个字符）
    const match = part.match(/[\u4e00-\u9fa5]{2,4}/);
    if (match) {
      names.push(match[0]);
    }
  }

  return names.length > 0 ? names : [nameStr.trim()];
}

// 解析电话号码（处理多个电话号码的情况）
function parsePhones(phoneStr) {
  if (!phoneStr || phoneStr.trim() === '') return [];

  // 按斜杠或分号分割
  const parts = phoneStr.split(/[/;；]/);
  const phones = [];

  for (const part of parts) {
    const cleaned = cleanPhone(part);
    if (cleaned.length >= 11) {
      // 手机号通常是11位
      phones.push(cleaned);
    }
  }

  return phones;
}

// 科室名称映射表（处理数据库中的名称与用户提供的数据不一致的情况）
const departmentNameMap = {
  第一眼科病房: '眼一病房',
  第二眼科病房: '眼二病房',
  // 注意：以下科室已添加到数据库：
  // '第一手术室', '第二手术室', '崇山门诊', '和平眼科门诊',
  // '耳鼻咽喉门诊', '第一介入治疗中心', '消毒供应中心',
  // '体检中心', '沈北门诊部' - 已添加到数据库
};

// 根据科室名称查找科室ID
async function findDepartmentId(departmentName) {
  try {
    // 先尝试使用映射表
    const mappedName = departmentNameMap[departmentName] || departmentName;

    // 精确匹配
    const [departments] = await db.execute('SELECT id FROM departments WHERE department_name = ?', [
      mappedName,
    ]);

    if (departments.length > 0) {
      return departments[0].id;
    }

    // 如果精确匹配失败，尝试模糊匹配
    const [fuzzyDepartments] = await db.execute(
      'SELECT id, department_name FROM departments WHERE department_name LIKE ?',
      [`%${mappedName}%`],
    );

    if (fuzzyDepartments.length === 1) {
      console.log(
        `  科室名称匹配: "${departmentName}" -> "${fuzzyDepartments[0].department_name}"`,
      );
      return fuzzyDepartments[0].id;
    }

    // 如果映射后的名称也找不到，尝试用原始名称模糊匹配
    if (mappedName !== departmentName) {
      const [originalFuzzy] = await db.execute(
        'SELECT id, department_name FROM departments WHERE department_name LIKE ?',
        [`%${departmentName}%`],
      );

      if (originalFuzzy.length === 1) {
        console.log(`  科室名称匹配: "${departmentName}" -> "${originalFuzzy[0].department_name}"`);
        return originalFuzzy[0].id;
      }
    }

    return null;
  } catch (error) {
    console.error(`查找科室失败: ${departmentName}`, error);
    return null;
  }
}

async function batchRegisterUsers() {
  try {
    console.log('开始批量注册用户...\n');

    // 第一步：整理用户数据，合并同一用户管理的多个科室
    const userMap = new Map(); // key: 用户名, value: { name, phone, departments: [] }

    for (const item of userData) {
      // 跳过没有姓名的记录
      if (!item.name || item.name.trim() === '') {
        console.log(`跳过序号 ${item.seq}：${item.department}（无联系人）`);
        continue;
      }

      // 解析姓名和电话
      const names = parseNames(item.name);
      const phones = parsePhones(item.phone);

      // 查找科室ID
      const departmentId = await findDepartmentId(item.department);
      if (!departmentId) {
        console.log(`警告：未找到科室 "${item.department}"，跳过`);
        continue;
      }

      // 处理每个姓名（一个姓名对应一个用户）
      for (let i = 0; i < names.length; i++) {
        const name = names[i];
        // 优先使用对应位置的电话，如果没有则使用第一个电话，再没有则为空
        const phone = phones.length > i ? phones[i] : phones.length > 0 ? phones[0] : '';

        // 使用用户名作为唯一标识（因为用户名是登录账号）
        const key = name;

        if (!userMap.has(key)) {
          userMap.set(key, {
            name,
            phone,
            departments: [],
          });
        }

        // 添加科室ID（避免重复）
        const userInfo = userMap.get(key);
        if (!userInfo.departments.includes(departmentId)) {
          userInfo.departments.push(departmentId);
        }

        // 如果该用户还没有电话，但当前记录有电话，则更新电话
        if (!userInfo.phone && phone) {
          userInfo.phone = phone;
        }
      }
    }

    console.log(`\n整理完成，共 ${userMap.size} 个用户需要注册\n`);

    // 第二步：批量注册用户
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      let successCount = 0;
      let skipCount = 0;
      let errorCount = 0;

      for (const [key, userInfo] of userMap.entries()) {
        try {
          // 确定最终的用户名（如果重名，添加手机后四位）
          let finalUsername = userInfo.name;

          // 检查用户名是否已存在
          const [existingUsers] = await connection.execute(
            'SELECT id FROM users WHERE username = ?',
            [finalUsername],
          );

          // 如果用户名已存在，且用户有电话号码，则在用户名后添加手机后四位
          if (existingUsers.length > 0 && userInfo.phone) {
            const phoneSuffix = getPasswordFromPhone(userInfo.phone);
            finalUsername = `${userInfo.name}${phoneSuffix}`;

            // 再次检查新用户名是否也存在
            const [existingUsers2] = await connection.execute(
              'SELECT id FROM users WHERE username = ?',
              [finalUsername],
            );

            if (existingUsers2.length > 0) {
              console.log(`跳过：用户 "${userInfo.name}" 和 "${finalUsername}" 都已存在`);
              skipCount++;
              continue;
            } else {
              console.log(`用户名 "${userInfo.name}" 已存在，使用 "${finalUsername}" 作为用户名`);
            }
          } else if (existingUsers.length > 0) {
            console.log(`跳过：用户 "${userInfo.name}" 已存在且无电话号码，无法生成唯一用户名`);
            skipCount++;
            continue;
          }

          // 生成密码（电话号码后四位）
          const password = getPasswordFromPhone(userInfo.phone);

          // 加密密码
          const hashedPassword = await bcrypt.hash(password, 10);

          // 准备管理科室JSON
          const managedDepartmentsJson =
            userInfo.departments.length > 0 ? JSON.stringify(userInfo.departments) : null;

          // 插入用户
          await connection.execute(
            `INSERT INTO users (
              username, password, real_name, managed_departments, role, phone, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              finalUsername, // 用户名（登录账号，如果重名则加手机后四位）
              hashedPassword, // 加密后的密码
              userInfo.name, // 真实姓名（保持原姓名）
              managedDepartmentsJson, // 管理科室（JSON数组）
              'asset_admin', // 角色：资产管理员
              userInfo.phone || null, // 电话号码
              'active', // 状态：激活
            ],
          );

          const usernameNote = finalUsername !== userInfo.name ? ` (用户名: ${finalUsername})` : '';
          console.log(
            `✓ 注册成功：${userInfo.name}${usernameNote}，管理 ${userInfo.departments.length} 个科室，初始密码：${password}`,
          );
          successCount++;
        } catch (error) {
          console.error(`✗ 注册失败：${userInfo.name}`, error.message);
          errorCount++;
        }
      }

      await connection.commit();

      console.log('\n批量注册完成！');
      console.log(`成功：${successCount} 个`);
      console.log(`跳过：${skipCount} 个（已存在）`);
      console.log(`失败：${errorCount} 个`);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('批量注册用户失败:', error);
  } finally {
    process.exit(0);
  }
}

// 执行脚本
batchRegisterUsers();
