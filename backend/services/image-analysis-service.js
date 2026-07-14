const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const { AppError, ValidationUtil, DataAccessUtil } = require('../utils/error-handler');
const MetrologyService = require('./metrology-service');
const config = require('../config/app.config');

function resolveTenantId(tenantFilter) {
  return tenantFilter?.tenantId || tenantFilter?.params?.[0] || null;
}

class ImageAnalysisService {
  constructor() {
    // MiniMax API 配置
    this.minimaxConfig = config.minimax || {};
    this.useMinimax = this.minimaxConfig.enabled && this.minimaxConfig.apiKey;

    if (this.useMinimax) {
      // MiniMax API 配置
      this.apiBaseUrl = this.minimaxConfig.apiBaseUrl || 'https://api.minimax.io';
      this.modelName = this.minimaxConfig.model || 'MiniMax-M3';
      this.apiKey = this.minimaxConfig.apiKey;
      this.timeout = this.minimaxConfig.timeout || 180000;
      console.log('✅ 图像识别服务已启用 MiniMax 模型:', this.modelName);
    } else {
      // LM Studio 本地模型配置（备用）
      this.apiBaseUrl = 'http://localhost:1234/v1';
      this.modelName = 'qwen/qwen3-vl-8b';
      this.timeout = 180000;
      console.log('⚠️ 图像识别服务使用本地 LM Studio 模型（MiniMax 未启用）');
    }
  }

  /**
   * 分析图像并提取计量报告信息
   * @param {string} imagePath 图像路径
   * @param {Object} tenantFilter 租户过滤条件
   * @returns {Promise<Object>} 提取的信息
   */
  async analyzeMetrologyReport(imagePath, tenantFilter) {
    try {
      // 验证图像文件
      if (!fs.existsSync(imagePath)) {
        throw new AppError('图像文件不存在', 400, 'IMAGE_FILE_NOT_FOUND');
      }

      // 读取图像文件
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString('base64');

      // 准备AI分析提示
      const prompt = `
        请分析这张计量报告图片，提取以下信息：
        - 资产编号 (asset_code)
        - 资产名称 (asset_name)
        - 计量类型 (metrology_type)
        - 计量日期 (metrology_date)
        - 计量机构 (metrology_agency)
        - 计量结果 (result: 合格/不合格)
        - 计量证书号 (certificate_number)
        - 下次计量日期 (next_metrology_date)
        - 计量费用 (cost)
        - 精度等级 (accuracy_level)
        - 其他相关参数

        请以JSON格式返回这些信息，如果某个字段无法识别，请设置为null。
      `;

      let aiResponse;

      if (this.useMinimax) {
        // 使用 MiniMax API
        aiResponse = await this.callMinimaxAPI(prompt, base64Image);
      } else {
        // 使用 LM Studio 本地模型
        aiResponse = await this.callLMStudioAPI(prompt, base64Image);
      }

      // 尝试解析JSON格式的响应
      let extractedData;
      try {
        // 查找JSON部分
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          extractedData = JSON.parse(jsonMatch[0]);
        } else {
          // 如果没有找到JSON，尝试直接解析整个响应
          extractedData = JSON.parse(aiResponse);
        }
      } catch (parseError) {
        // 如果解析失败，尝试从文本中提取信息
        extractedData = this.extractFromText(aiResponse);
      }

      return extractedData;
    } catch (error) {
      console.error('图像分析失败:', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        `图像分析失败: ${error.message || '未知错误'}`,
        500,
        'IMAGE_ANALYSIS_FAILED',
      );
    }
  }

  /**
   * 调用 MiniMax API 进行图像分析
   * @param {string} prompt 提示词
   * @param {string} base64Image Base64 编码的图像
   * @returns {Promise<string>} AI 响应文本
   */
  async callMinimaxAPI(prompt, base64Image) {
    const response = await axios.post(
      `${this.apiBaseUrl}/v1/chat/completions`,
      {
        model: this.modelName,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`,
                },
              },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 1000,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        timeout: this.timeout,
        // 绕过系统代理，防止代理将 HTTPS 降级为 HTTP
        proxy: false,
      },
    );

    return response.data.choices[0].message.content;
  }

  /**
   * 调用 LM Studio 本地 API 进行图像分析
   * @param {string} prompt 提示词
   * @param {string} base64Image Base64 编码的图像
   * @returns {Promise<string>} AI 响应文本
   */
  async callLMStudioAPI(prompt, base64Image) {
    const response = await axios.post(
      `${this.apiBaseUrl}/chat/completions`,
      {
        model: this.modelName,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`,
                },
              },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 1000,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: this.timeout,
      },
    );

    return response.data.choices[0].message.content;
  }

  /**
   * 从文本响应中提取信息
   * @param {string} text AI返回的文本
   * @returns {Object} 提取的数据
   */
  extractFromText(text) {
    const extracted = {};

    // 使用正则表达式提取各种信息
    const patterns = {
      asset_code: [/资产编号[:：]\s*([A-Z0-9_-]+)/i, /编号[:：]\s*([A-Z0-9_-]+)/i],
      asset_name: [/资产名称[:：]\s*([^\n\r]+)/i, /设备名称[:：]\s*([^\n\r]+)/i],
      metrology_type: [
        /计量类型[:：]\s*([^\n\r]+)/i,
        /检定类型[:：]\s*([^\n\r]+)/i,
        /校准类型[:：]\s*([^\n\r]+)/i,
      ],
      metrology_date: [
        /(?:计量|检定|校准)日期[:：]\s*([0-9]{4}[-/年][0-9]{1,2}[-/月][0-9]{1,2}日?)/,
        /日期[:：]\s*([0-9]{4}[-/年][0-9]{1,2}[-/月][0-9]{1,2}日?)/,
      ],
      metrology_agency: [
        /计量机构[:：]\s*([^\n\r]+)/i,
        /检定机构[:：]\s*([^\n\r]+)/i,
        /校准机构[:：]\s*([^\n\r]+)/i,
      ],
      result: [/(合格|不合格)/i],
      certificate_number: [/证书编号[:：]\s*([A-Z0-9_-]+)/i, /证书号[:：]\s*([A-Z0-9_-]+)/i],
      next_metrology_date: [
        /(?:下次|有效)日期[:：]\s*([0-9]{4}[-/年][0-9]{1,2}[-/月][0-9]{1,2}日?)/,
        /有效期至[:：]\s*([0-9]{4}[-/年][0-9]{1,2}[-/月][0-9]{1,2}日?)/,
      ],
      cost: [/费用[:：]\s*([0-9.]+)/, /金额[:：]\s*([0-9.]+)/],
      accuracy_level: [/精度等级[:：]\s*([^\n\r]+)/i, /准确度等级[:：]\s*([^\n\r]+)/i],
    };

    for (const [key, patternList] of Object.entries(patterns)) {
      for (const pattern of patternList) {
        const match = text.match(pattern);
        if (match) {
          extracted[key] = match[1].trim();
          break;
        }
      }
    }

    return extracted;
  }

  /**
   * 创建计量记录从图像分析结果
   * @param {Object} imageData 图像分析结果
   * @param {Object} tenantFilter 租户过滤条件
   * @param {string} createdBy 创建人
   * @returns {Promise<Object>} 创建结果
   */
  async createMetrologyRecordFromImage(imageData, tenantFilter, createdBy) {
    try {
      // 验证必要字段（资产编号可以为空，用于后续关联）
      ValidationUtil.validateRequiredFields(
        {
          metrology_type: imageData.metrology_type || imageData.meterology_type,
          metrology_date: imageData.metrology_date,
        },
        ['metrology_type', 'metrology_date'],
      );

      let assetName = imageData.asset_name || '未知资产';
      const tenantId = resolveTenantId(tenantFilter);

      if (!tenantId) {
        throw new AppError('当前用户未分配企业空间', 400, 'REQUIRE_TENANT');
      }

      // 如果提供了资产编号，尝试获取资产信息
      // AI 识别可能提取出图片中印的资产编号，但该资产在 DB 不存在 (未建档/跨租户/编号错误)
      // 此处用 soft check: 资产存在则补全名称, 不存在则**清空 asset_code** 让计量记录独立存在
      // (避免 metrology-service.createMetrologyRecord 的 strict check 抛 400 阻断整个上传流程)
      if (imageData.asset_code) {
        // 验证资产是否存在
        const assetResult = await DataAccessUtil.executeQuery(
          'SELECT id, asset_name FROM assets WHERE asset_code = ? AND tenant_id = ? LIMIT 1',
          [imageData.asset_code, tenantId],
        );

        if (assetResult && assetResult.length > 0) {
          assetName = assetResult[0].asset_name;
        } else {
          // 资产不存在 — 记录一次并清空 asset_code
          console.warn(
            `[createMetrologyRecordFromImage] AI 提取的 asset_code="${imageData.asset_code}" 在 tenant ${tenantId} 下未找到, 清空后创建独立计量记录`,
          );
          imageData.asset_code = null;
        }
      }

      // 合并图像分析数据和资产信息
      const recordData = {
        asset_code: imageData.asset_code || null,
        asset_name: assetName,
        customer_name: imageData.customer_name || null,
        specification: imageData.specification || null,
        serial_number: imageData.serial_number || null,
        technical_document: imageData.technical_document || null,
        conformance_standard: imageData.conformance_standard || null,
        metrology_type: imageData.meterology_type || imageData.metrology_type || '校准',
        metrology_date: imageData.metrology_date,
        next_metrology_date: imageData.next_metrology_date || null,
        metrology_agency: imageData.metrology_agency || '未知机构',
        result: imageData.result || '待确认',
        certificate_no: imageData.certificate_number || null, // 修正字段名，与数据库表匹配
        cost: imageData.cost ? parseFloat(imageData.cost) : null,
        accuracy_level: imageData.accuracy_level || null,
        measurement_range: imageData.measurement_range || null,
        operator: imageData.operator || null,
        status: '已完成',
        metrology_cycle: imageData.metrology_cycle || null,
        warning_days: imageData.warning_days || 30,
        remark: `通过图像识别创建，识别时间: ${new Date().toLocaleString()}`,
      };

      // 创建计量记录
      const result = await MetrologyService.createMetrologyRecord(
        recordData,
        tenantId,
        createdBy,
      );

      return result;
    } catch (error) {
      console.error('从图像创建计量记录失败:', error);
      throw error;
    }
  }
}

module.exports = new ImageAnalysisService();
