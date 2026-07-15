const assetService = require('../services/asset.service');
const logger = require('../../../config/logger');

const ERROR_TYPES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE_ERROR: 'DUPLICATE_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};

// 已知的业务验证错误信息，命中则返回 400
const VALIDATION_ERROR_MESSAGES = new Set([
  '资产编码、名称和分类不能为空',
  '资产标识不能为空',
  '没有要更新的字段',
  '购置日期不能是未来日期',
  '采购价格不能为负数',
  '缺少租户ID',
  '资产编号不能为空',
  '资产编号长度不能超过 64 个字符',
  // 来自 normalizeAssetCreatePayload 的校验
  '资产名称不能为空',
  '资产分类不能为空',
  '二级分类格式无效',
  '购置日期格式无效',
  '购置价格必须是大于等于0的数字',
  '当前价值必须是大于等于0的数字',
  '折旧年限必须是大于等于0的整数',
  '原始创建时间格式无效',
  '保修期必须是大于等于0的整数',
  '保修到期日格式无效',
  '当前价值不能大于购置价格',
  '保修到期日不能早于购置日期',
  // 来自 createAsset/updateAsset 的存在性校验
  '所选使用部门不存在或不属于当前租户',
  '所选二级分类不存在',
  '二级分类不属于所选一级分类',
  // 来自 updateAsset _validateUpdateFields 的校验
  'purchase_price 必须是大于等于0的数字',
  'current_value 必须是大于等于0的数字',
  'depreciation_years 必须是大于等于0的数字',
  'warranty_period 必须是大于等于0的数字',
  'depreciation_years 必须是整数',
  'warranty_period 必须是整数',
]);

// 以这些前缀开头的错误信息也视为验证错误
const VALIDATION_ERROR_PREFIXES = [
  '无效的资产状态',
  'purchase_price 必须是',
  'current_value 必须是',
  'depreciation_years 必须',
  'warranty_period 必须',
];

const DUPLICATE_ERROR_MESSAGES = new Set(['资产编码已存在']);

const NOT_FOUND_ERROR_MESSAGES = new Set(['资产不存在']);

/**
 * 统一错误响应：根据错误信息映射 HTTP 状态码与 errorType
 */
function sendErrorResponse(res, error, defaultMessage) {
  const message = error?.message || defaultMessage;

  if (DUPLICATE_ERROR_MESSAGES.has(message)) {
    return res.status(409).json({
      success: false,
      message,
      errorType: ERROR_TYPES.DUPLICATE_ERROR,
    });
  }

  if (NOT_FOUND_ERROR_MESSAGES.has(message)) {
    return res.status(404).json({
      success: false,
      message,
      errorType: ERROR_TYPES.NOT_FOUND,
    });
  }

  if (VALIDATION_ERROR_MESSAGES.has(message)) {
    return res.status(400).json({
      success: false,
      message,
      errorType: ERROR_TYPES.VALIDATION_ERROR,
    });
  }

  if (VALIDATION_ERROR_PREFIXES.some(prefix => message.startsWith(prefix))) {
    return res.status(400).json({
      success: false,
      message,
      errorType: ERROR_TYPES.VALIDATION_ERROR,
    });
  }

  return res.status(500).json({
    success: false,
    message: defaultMessage,
    error: message,
    errorType: ERROR_TYPES.INTERNAL_ERROR,
  });
}

class AssetController {
  /**
   * 获取资产列表
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async getAssets(req, res) {
    try {
      const { page, pageSize, status, department_id, category_id } = req.query;
      // 兼容前端资产选择关键字筛选使用的 keyword 参数（主列表页使用 search）
      const search = (req.query.search ?? req.query.keyword ?? '').toString().trim();
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const result = await assetService.getAssets({
        page,
        pageSize,
        search,
        status,
        department_id,
        category_id,
        tenantId,
      });

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error('获取资产列表失败', {
        error: error.message,
        stack: error.stack,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });

      sendErrorResponse(res, error, '获取资产列表失败');
    }
  }

  /**
   * 获取资产详情（支持数字 id 与 asset_code）
   */
  async getAssetById(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
      const identifier = assetService.resolveAssetIdentifier(id);

      if (!identifier) {
        return res.status(400).json({
          success: false,
          message: '资产标识不能为空',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const asset = identifier.column === 'id'
        ? await assetService.getAssetById(identifier.value, tenantId)
        : await assetService.getAssetByCode(identifier.value, tenantId);

      if (!asset) {
        return res.status(404).json({
          success: false,
          message: '资产不存在',
          errorType: ERROR_TYPES.NOT_FOUND,
        });
      }

      res.json({ success: true, data: asset });
    } catch (error) {
      logger.error('获取资产详情失败', {
        error: error.message,
        stack: error.stack,
        assetId: req.params?.id,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      sendErrorResponse(res, error, '获取资产详情失败');
    }
  }

  /**
   * 创建资产
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async createAsset(req, res) {
    try {
      const assetData = req.body;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
      const userId = req.user?.id;

      // Validate required fields
      if (!assetData.asset_code || !assetData.asset_name || !assetData.category_id) {
        return res.status(400).json({
          success: false,
          message: '资产编码、名称和分类不能为空',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const result = await assetService.createAsset(assetData, tenantId, userId);

      res.status(201).json({
        success: true,
        message: '资产创建成功',
        data: result,
      });
    } catch (error) {
      logger.error('创建资产失败', {
        error: error.message,
        stack: error.stack,
        assetCode: req.body?.asset_code,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });

      sendErrorResponse(res, error, '创建资产失败');
    }
  }

  /**
   * 更新资产
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async updateAsset(req, res) {
    try {
      const { id } = req.params;
      const assetData = req.body;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
      const userId = req.user?.id;

      await assetService.updateAsset(id, assetData, tenantId, userId);

      res.json({ success: true, message: '资产更新成功' });
    } catch (error) {
      logger.error('更新资产失败', {
        error: error.message,
        stack: error.stack,
        assetId: req.params?.id,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });

      sendErrorResponse(res, error, '更新资产失败');
    }
  }

  /**
   * 删除资产（软删除）
   */
  async deleteAsset(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
      const userId = req.user?.id;
      const force = req.query?.force === 'true' || req.body?.force === true;

      await assetService.deleteAsset(id, tenantId, userId, { force });

      res.json({ success: true, message: '资产删除成功' });
    } catch (error) {
      logger.error('删除资产失败', {
        error: error.message,
        code: error.code,
        blockers: error.blockers,
        stack: error.stack,
        assetId: req.params?.id,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });

      // 反向引用校验失败：返回 409 + 详细阻塞列表
      if (error.code === 'ASSET_HAS_ACTIVE_REFERENCES') {
        return res.status(409).json({
          success: false,
          message: error.message,
          errorType: 'ASSET_HAS_ACTIVE_REFERENCES',
          blockers: error.blockers || [],
        });
      }

      sendErrorResponse(res, error, '删除资产失败');
    }
  }

  /**
   * 获取资产分类列表
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async getCategories(req, res) {
    try {
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      const categories = await assetService.getCategories(tenantId);

      res.json({ success: true, data: categories });
    } catch (error) {
      logger.error('获取资产分类失败', {
        error: error.message,
        stack: error.stack,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });

      sendErrorResponse(res, error, '获取资产分类失败');
    }
  }

  /**
   * 获取资产位置列表
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async getLocations(req, res) {
    try {
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      const locations = await assetService.getLocations(tenantId);

      res.json({ success: true, data: locations });
    } catch (error) {
      logger.error('获取资产位置失败', {
        error: error.message,
        stack: error.stack,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });

      sendErrorResponse(res, error, '获取资产位置失败');
    }
  }

  /**
   * 校验资产编号是否重复
   * GET /api/assets/duplicate-check?asset_code=XXX[&exclude_id=YYY]
   */
  async checkAssetCodeDuplicate(req, res) {
    try {
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
      const rawCode = (req.query.asset_code || '').toString().trim();
      const rawExclude = (req.query.exclude_id ?? '').toString().trim();

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }
      if (!rawCode) {
        return res.status(400).json({
          success: false,
          message: '资产编号不能为空',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }
      if (rawCode.length > 64) {
        return res.status(400).json({
          success: false,
          message: '资产编号长度不能超过 64 个字符',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const existing = await assetService.getAssetByCode(rawCode, tenantId);
      const exists = Boolean(
        existing && (!rawExclude || String(existing.id) !== rawExclude),
      );

      res.json({
        success: true,
        data: {
          exists,
          asset_code: rawCode,
          ...(exists
            ? { id: existing.id, asset_name: existing.asset_name }
            : {}),
        },
      });
    } catch (error) {
      logger.error('资产编号校验失败', {
        error: error.message,
        stack: error.stack,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
        assetCode: req.query?.asset_code,
      });
      sendErrorResponse(res, error, '资产编号校验失败');
    }
  }
}

module.exports = new AssetController();
