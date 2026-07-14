/**
 * PDF 计量报告分析服务
 * 流程: PDF → 提取文本 → MiniMax AI 解析 → 结构化数据
 */

// Polyfill: pdf-parse v2 需要浏览器 DOM API（DOMMatrix），在 Node.js 中模拟
if (typeof globalThis.DOMMatrix === 'undefined') {
  globalThis.DOMMatrix = class DOMMatrix {
    constructor() { this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0; }
    static fromMatrix() { return new DOMMatrix(); }
  };
}
if (typeof globalThis.ImageData === 'undefined') {
  globalThis.ImageData = class ImageData {
    constructor(data, width, height) { this.data = data; this.width = width; this.height = height; }
  };
}
if (typeof globalThis.Path2D === 'undefined') {
  globalThis.Path2D = class Path2D {
    constructor() {}
    addPath() {}
    closePath() {}
    moveTo() {}
    lineTo() {}
    bezierCurveTo() {}
    arc() {}
    rect() {}
    ellipse() {}
  };
}

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const pdfParse = require('pdf-parse');
const { AppError, ValidationUtil, DataAccessUtil } = require('../utils/error-handler');
const MetrologyService = require('./metrology-service');
const config = require('../config/app.config');

function resolveTenantId(tenantFilter) {
  return tenantFilter?.tenantId || tenantFilter?.params?.[0] || null;
}

class PdfAnalysisService {
  constructor() {
    // 复用 MiniMax 配置
    this.minimaxConfig = config.minimax || {};
    this.useMinimax = this.minimaxConfig.enabled && this.minimaxConfig.apiKey;

    if (this.useMinimax) {
      this.apiBaseUrl = this.minimaxConfig.apiBaseUrl || 'https://api.minimaxi.com';
      this.modelName = this.minimaxConfig.model || 'MiniMax-M3';
      this.apiKey = this.minimaxConfig.apiKey;
      this.timeout = this.minimaxConfig.timeout || 180000;
      console.log('✅ PDF分析服务已启用 MiniMax 模型:', this.modelName);
    } else {
      this.apiBaseUrl = 'http://localhost:1234/v1';
      this.modelName = 'qwen/qwen3-vl-8b';
      this.timeout = 180000;
      console.log('⚠️ PDF分析服务使用本地 LM Studio 模型（MiniMax 未启用）');
    }
  }

  /**
   * 提取PDF文本内容
   */
  async extractPdfText(pdfPath) {
    if (!fs.existsSync(pdfPath)) {
      throw new AppError('PDF文件不存在', 400, 'PDF_FILE_NOT_FOUND');
    }
    const dataBuffer = fs.readFileSync(pdfPath);
    const result = await pdfParse(dataBuffer);
    return result.text || '';
  }

  /**
   * 分析计量报告PDF
   */
  async analyzeMetrologyReportPdf(pdfPath, tenantFilter) {
    try {
      // Step 1: 提取 PDF 文本
      console.log('📄 正在提取 PDF 文本...');
      const pdfText = await this.extractPdfText(pdfPath);

      if (!pdfText || pdfText.trim().length === 0) {
        throw new AppError('PDF文件中没有可识别的文本内容', 400, 'PDF_NO_TEXT');
      }

      console.log(`📄 PDF文本长度: ${pdfText.length} 字符`);

      // 截取前 4000 字符（足够提取关键信息）
      const trimmedText = pdfText.substring(0, 4000);

      // Step 2: 构建分析提示
      const prompt = `你是一个专业的计量报告数据提取助手。请从以下计量报告/检定证书文本中提取信息，返回纯JSON格式。

需要提取的字段：
- asset_code: 资产编号/设备编号
- asset_name: 资产名称/设备名称
- metrology_type: 计量类型（强制检定/非强制检定/校准/测试等）
- metrology_date: 计量/检定/校准日期
- metrology_agency: 计量机构/检定机构
- result: 检定结果（合格/不合格）
- certificate_number: 证书编号/报告编号
- next_metrology_date: 下次检定日期/有效期至
- cost: 费用
- accuracy_level: 精度等级/准确度等级

如果某个字段无法识别，请设置为null。只返回JSON，不要其他内容。

=== 报告文本 ===
${trimmedText}`;

      let aiResponse;

      if (this.useMinimax) {
        aiResponse = await this.callMinimaxAPI(prompt);
      } else {
        aiResponse = await this.callLocalAI(prompt);
      }

      // Step 3: 解析 AI 返回的 JSON
      let extractedData;
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          extractedData = JSON.parse(jsonMatch[0]);
        } else {
          extractedData = JSON.parse(aiResponse);
        }
      } catch (parseError) {
        // JSON解析失败，用正则兜底
        extractedData = this.extractFromText(pdfText);
      }

      return extractedData;
    } catch (error) {
      console.error('PDF分析失败:', error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        `PDF分析失败: ${error.message || '未知错误'}`,
        500,
        'PDF_ANALYSIS_FAILED',
      );
    }
  }

  /**
   * 调用 MiniMax API（纯文本模式）
   */
  async callMinimaxAPI(prompt) {
    const response = await axios.post(
      `${this.apiBaseUrl}/v1/chat/completions`,
      {
        model: this.modelName,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 1000,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        timeout: this.timeout,
        proxy: false,
      },
    );
    return response.data.choices[0].message.content;
  }

  /**
   * 调用本地 LM Studio API
   */
  async callLocalAI(prompt) {
    const response = await axios.post(
      `${this.apiBaseUrl}/chat/completions`,
      {
        model: this.modelName,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 1000,
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: this.timeout,
        proxy: false,
      },
    );
    return response.data.choices[0].message.content;
  }

  /**
   * 正则兜底 — 从文本中提取信息
   */
  extractFromText(text) {
    const extracted = {};
    const patterns = {
      asset_code: [/资产编号[:：]\s*([A-Za-z0-9_-]+)/, /设备编号[:：]\s*([A-Za-z0-9_-]+)/],
      asset_name: [/资产名称[:：]\s*([^\n\r]+)/, /设备名称[:：]\s*([^\n\r]+)/, /器具名称[:：]\s*([^\n\r]+)/],
      metrology_type: [/计量类型[:：]\s*([^\n\r]+)/, /检定类型[:：]\s*([^\n\r]+)/, /校准类型[:：]\s*([^\n\r]+)/],
      metrology_date: [
        /(?:计量|检定|校准)日期[:：]\s*([0-9]{4}[-/年][0-9]{1,2}[-/月][0-9]{1,2}日?)/,
        /日期[:：]\s*([0-9]{4}[-/年][0-9]{1,2}[-/月][0-9]{1,2}日?)/,
      ],
      metrology_agency: [/计量机构[:：]\s*([^\n\r]+)/, /检定机构[:：]\s*([^\n\r]+)/, /校准机构[:：]\s*([^\n\r]+)/],
      result: [/(合格|不合格|PASS|FAIL)/i],
      certificate_number: [/证书编号[:：]\s*([A-Za-z0-9_-]+)/, /证书号[:：]\s*([A-Za-z0-9_-]+)/, /报告编号[:：]\s*([A-Za-z0-9_-]+)/],
      next_metrology_date: [
        /(?:下次|有效)日期[:：]\s*([0-9]{4}[-/年][0-9]{1,2}[-/月][0-9]{1,2}日?)/,
        /有效期至[:：]\s*([0-9]{4}[-/年][0-9]{1,2}[-/月][0-9]{1,2}日?)/,
      ],
      cost: [/费用[:：]\s*([0-9.]+)/, /金额[:：]\s*([0-9.]+)/],
      accuracy_level: [/精度等级[:：]\s*([^\n\r]+)/, /准确度等级[:：]\s*([^\n\r]+)/],
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
   * 从 PDF 分析结果创建计量记录
   */
  async createMetrologyRecordFromPdf(pdfData, tenantFilter, createdBy) {
    try {
      const tenantId = resolveTenantId(tenantFilter);
      if (!tenantId) {
        throw new AppError('当前用户未分配企业空间', 400, 'REQUIRE_TENANT');
      }

      let assetName = pdfData.asset_name || '未知资产';

      if (pdfData.asset_code) {
        const assetResult = await DataAccessUtil.executeQuery(
          'SELECT id, asset_name FROM assets WHERE asset_code = ? AND tenant_id = ? LIMIT 1',
          [pdfData.asset_code, tenantId],
        );
        if (assetResult && assetResult.length > 0) {
          assetName = assetResult[0].asset_name;
        } else {
          // 资产不存在 — 清空 asset_code 让 PDF 上传也能继续
          console.warn(
            `[createMetrologyRecordFromPdf] PDF 提取的 asset_code="${pdfData.asset_code}" 在 tenant ${tenantId} 下未找到, 清空后创建独立计量记录`,
          );
          pdfData.asset_code = null;
        }
      }

      const recordData = {
        asset_code: pdfData.asset_code || null,
        asset_name: assetName,
        metrology_type: pdfData.metrology_type || '校准',
        metrology_date: pdfData.metrology_date,
        next_metrology_date: pdfData.next_metrology_date || null,
        metrology_agency: pdfData.metrology_agency || '未知机构',
        result: pdfData.result || '待确认',
        certificate_no: pdfData.certificate_number || null,
        cost: pdfData.cost ? parseFloat(pdfData.cost) : null,
        accuracy_level: pdfData.accuracy_level || null,
        status: '已完成',
        remark: `通过PDF识别创建，识别时间: ${new Date().toLocaleString()}`,
      };

      return await MetrologyService.createMetrologyRecord(recordData, tenantId, createdBy);
    } catch (error) {
      console.error('从PDF创建计量记录失败:', error);
      throw error;
    }
  }
}

module.exports = new PdfAnalysisService();
