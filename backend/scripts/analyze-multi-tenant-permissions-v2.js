// 多租户权限合理性分析脚本

// 模拟不同角色和租户场景
const scenarios = [
  {
    name: '超级管理员访问自己的企业',
    user: {
      id: 1,
      username: 'superadmin',
      role: 'super_admin',
      tenant_id: 1,
      managed_departments: null,
    },
    targetTenantId: 1,
    expectedCanAccess: true,
    expectedRole: 'super_admin',
    expectedManagedDepts: '所有科室',
  },
  {
    name: '超级管理员访问其他企业',
    user: {
      id: 1,
      username: 'superadmin',
      role: 'super_admin',
      tenant_id: 1,
      managed_departments: null,
    },
    targetTenantId: 2,
    expectedCanAccess: true,
    expectedRole: 'super_admin',
    expectedManagedDepts: '所有科室',
  },
  {
    name: '系统管理员访问自己的企业',
    user: {
      id: 2,
      username: 'sysadmin',
      role: 'system_admin',
      tenant_id: 1,
      managed_departments: '[1, 2, 3]',
    },
    targetTenantId: 1,
    expectedCanAccess: true,
    expectedRole: 'system_admin',
    expectedManagedDepts: '租户内所有科室',
  },
  {
    name: '系统管理员访问其他企业',
    user: {
      id: 2,
      username: 'sysadmin',
      role: 'system_admin',
      tenant_id: 1,
      managed_departments: '[1, 2, 3]',
    },
    targetTenantId: 2,
    expectedCanAccess: true,
    expectedRole: 'asset_admin',
    expectedManagedDepts: '[1, 2, 3]',
  },
  {
    name: '资产管理员访问自己的企业',
    user: {
      id: 3,
      username: 'assetadmin',
      role: 'asset_admin',
      tenant_id: 1,
      managed_departments: '[1, 2]',
    },
    targetTenantId: 1,
    expectedCanAccess: true,
    expectedRole: 'asset_admin',
    expectedManagedDepts: '[1, 2]',
  },
  {
    name: '资产管理员访问其他企业',
    user: {
      id: 3,
      username: 'assetadmin',
      role: 'asset_admin',
      tenant_id: 1,
      managed_departments: '[1, 2]',
    },
    targetTenantId: 2,
    expectedCanAccess: false,
    expectedRole: 'asset_admin',
    expectedManagedDepts: '[1, 2]',
  },
  {
    name: '部门管理员访问自己的企业',
    user: {
      id: 4,
      username: 'deptadmin',
      role: 'department_admin',
      tenant_id: 1,
      managed_departments: '[1]',
    },
    targetTenantId: 1,
    expectedCanAccess: true,
    expectedRole: 'department_admin',
    expectedManagedDepts: '[1]',
  },
  {
    name: '部门管理员访问其他企业',
    user: {
      id: 4,
      username: 'deptadmin',
      role: 'department_admin',
      tenant_id: 1,
      managed_departments: '[1]',
    },
    targetTenantId: 2,
    expectedCanAccess: false,
    expectedRole: 'department_admin',
    expectedManagedDepts: '[1]',
  },
];

// 模拟权限检查逻辑
function canAccessTenant(user, tenantId) {
  if (!user) {
    return false;
  }
  if (user.role === 'super_admin') {
    return true;
  }
  return user.tenant_id === tenantId;
}

// 模拟角色动态调整逻辑
function getEffectiveRole(user, targetTenantId) {
  if (user.role === 'super_admin') {
    return 'super_admin';
  }
  if (user.role === 'system_admin' && targetTenantId !== user.tenant_id) {
    return 'asset_admin';
  }
  return user.role;
}

// 模拟管理科室计算逻辑
function getManagedDepartments(user, effectiveRole) {
  if (user.role === 'super_admin') {
    return '所有科室';
  }
  if (user.role === 'system_admin') {
    if (effectiveRole === 'system_admin') {
      return '租户内所有科室';
    } else {
      try {
        return JSON.parse(user.managed_departments) || [];
      } catch (e) {
        return [];
      }
    }
  }
  try {
    return JSON.parse(user.managed_departments) || [];
  } catch (e) {
    return [];
  }
}

// 分析每个场景
function analyzeScenarios() {
  console.log('📋 多租户权限合理性分析');
  console.log('='.repeat(60));

  let passedTests = 0;
  let failedTests = 0;

  scenarios.forEach((scenario, index) => {
    console.log(`\n${index + 1}. ${scenario.name}`);
    console.log('-'.repeat(40));

    // 测试租户访问权限
    const canAccess = canAccessTenant(scenario.user, scenario.targetTenantId);
    const accessTest = canAccess === scenario.expectedCanAccess;

    console.log(`   用户角色: ${scenario.user.role}`);
    console.log(`   用户所属租户: ${scenario.user.tenant_id}`);
    console.log(`   目标租户: ${scenario.targetTenantId}`);
    console.log(`   实际访问权限: ${canAccess ? '允许' : '拒绝'}`);
    console.log(`   预期访问权限: ${scenario.expectedCanAccess ? '允许' : '拒绝'}`);
    console.log(`   租户访问测试: ${accessTest ? '✅ 通过' : '❌ 失败'}`);

    // 测试角色调整
    const effectiveRole = getEffectiveRole(scenario.user, scenario.targetTenantId);
    const roleTest = effectiveRole === scenario.expectedRole;

    console.log(`   实际角色: ${effectiveRole}`);
    console.log(`   预期角色: ${scenario.expectedRole}`);
    console.log(`   角色调整测试: ${roleTest ? '✅ 通过' : '❌ 失败'}`);

    // 测试管理科室
    const managedDepts = getManagedDepartments(scenario.user, effectiveRole);
    let deptTest = false;

    if (typeof managedDepts === 'string') {
      deptTest = managedDepts === scenario.expectedManagedDepts;
    } else {
      deptTest = JSON.stringify(managedDepts) === scenario.expectedManagedDepts;
    }

    console.log(
      `   实际管理科室: ${typeof managedDepts === 'string' ? managedDepts : JSON.stringify(managedDepts)}`,
    );
    console.log(`   预期管理科室: ${scenario.expectedManagedDepts}`);
    console.log(`   管理科室测试: ${deptTest ? '✅ 通过' : '❌ 失败'}`);

    // 综合测试结果
    const allPassed = accessTest && roleTest && deptTest;
    if (allPassed) {
      passedTests++;
      console.log('   综合结果: ✅ 通过');
    } else {
      failedTests++;
      console.log('   综合结果: ❌ 失败');
    }
  });

  // 总结
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 测试总结');
  console.log(`   总测试数: ${scenarios.length}`);
  console.log(`   通过测试: ${passedTests}`);
  console.log(`   失败测试: ${failedTests}`);
  console.log(`   通过率: ${((passedTests / scenarios.length) * 100).toFixed(2)}%`);

  if (failedTests === 0) {
    console.log('\n✅ 所有测试通过，多租户权限设计合理');
  } else {
    console.log('\n❌ 存在测试失败，多租户权限设计需要调整');
  }
}

// 运行分析
analyzeScenarios();
