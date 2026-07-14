const cacheManager = require('../services/cache-manager');
const db = require('../config/database');

async function warmupAssetListCache() {
  console.log('预热资产列表缓存...');

  try {
    // 获取所有租户
    const [tenants] = await db.execute('SELECT tenant_id FROM tenants');

    for (const tenant of tenants) {
      const tenantId = tenant.tenant_id;
      console.log(`  预热租户 ${tenantId} 的资产列表缓存`);

      // 预热默认资产列表
      const defaultQuery = {
        page: 1,
        pageSize: 20,
        status: '',
        department: '',
        keyword: '',
        selectedDepartmentId: '',
      };

      // 获取资产列表数据
      const [assets] = await db.execute(`
        SELECT a.* 
        FROM assets a 
        WHERE a.tenant_id = ? 
        ORDER BY a.created_at DESC 
        LIMIT 20
      `, [tenantId]);

      const [countResult] = await db.execute(`
        SELECT COUNT(*) as total 
        FROM assets a 
        WHERE a.tenant_id = ?
      `, [tenantId]);

      const total = countResult[0]?.total || 0;

      const data = {
        success: true,
        data: assets,
        pagination: {
          page: 1,
          pageSize: 20,
          total,
          totalPages: Math.ceil(total / 20),
        },
      };

      // 设置缓存
      await cacheManager.setAssetListCache(tenantId, defaultQuery, data);
      console.log(`  ✅ 租户 ${tenantId} 的资产列表缓存预热成功`);
    }
  } catch (error) {
    console.error('❌ 资产列表缓存预热失败:', error.message);
  }
}

async function warmupStatisticsCache() {
  console.log('预热统计数据缓存...');

  try {
    // 获取所有租户
    const [tenants] = await db.execute('SELECT tenant_id FROM tenants');

    for (const tenant of tenants) {
      const tenantId = tenant.tenant_id;
      console.log(`  预热租户 ${tenantId} 的统计数据缓存`);

      // 预热资产分类统计
      const [categoryStats] = await db.execute(`
        SELECT category, COUNT(*) as count 
        FROM assets 
        WHERE tenant_id = ? 
        GROUP BY category
      `, [tenantId]);

      const categoryData = {};
      categoryStats.forEach(item => {
        categoryData[item.category] = item.count;
      });

      await cacheManager.setStatisticsCache(tenantId, 'asset_category', categoryData);

      // 预热部门资产分布统计
      const [departmentStats] = await db.execute(`
        SELECT department, COUNT(*) as count 
        FROM assets 
        WHERE tenant_id = ? 
        GROUP BY department
      `, [tenantId]);

      const departmentData = {};
      departmentStats.forEach(item => {
        departmentData[item.department] = item.count;
      });

      await cacheManager.setStatisticsCache(tenantId, 'department_distribution', departmentData);

      console.log(`  ✅ 租户 ${tenantId} 的统计数据缓存预热成功`);
    }
  } catch (error) {
    console.error('❌ 统计数据缓存预热失败:', error.message);
  }
}

async function warmupCache() {
  console.log('开始缓存预热...');

  await warmupAssetListCache();
  await warmupStatisticsCache();

  console.log('\n=== 缓存预热完成 ===');
  console.log('✅ 已预热常用数据到缓存');
  console.log('✅ 系统启动后将直接使用缓存数据');
}

// 运行缓存预热
warmupCache();
