/**
 * 质量报告生成器 - 修复版
 * 修复了500错误和空值处理问题
 */

const fs = require('fs');
const path = require('path');
const { AppError } = require('../utils/error-handler');
const MetrologyService = require('../services/metrology-service');
const QualityControlService = require('../services/quality-control-service');

class QualityReportGenerator {
  /**
   * 生成计量质量报告
   */
  static async generateMetrologyReport(params, tenantFilter) {
    const { start_date, end_date, format = 'json' } = params || {};

    try {
      const stats = await MetrologyService.getAdvancedMetrologyStatistics(
        { start_date, end_date },
        tenantFilter,
      );

      const report = {
        title: '计量质量分析报告',
        period: {
          startDate: start_date || '不限',
          endDate: end_date || '不限',
        },
        summary: stats.summary || { total: 0, passRate: 0, avgCost: 0 },
        byAgency: stats.byAgency || [],
        trends: stats.trends || [],
        byAccuracyLevel: stats.byAccuracyLevel || [],
        createdAt: new Date(),
        generatedBy: 'System',
      };

      if (format === 'json') {
        return report;
      } else if (format === 'chart') {
        return this.formatChartData(report);
      } else {
        throw new AppError('不支持的报告格式', 400, 'UNSUPPORTED_FORMAT');
      }
    } catch (error) {
      console.error('生成计量报告错误:', error);
      throw new AppError(`生成计量报告失败: ${error.message}`, 500, 'REPORT_GENERATION_ERROR');
    }
  }

  /**
   * 生成质量控制报告
   */
  static async generateQualityControlReport(params, tenantFilter) {
    const { start_date, end_date, format = 'json' } = params || {};

    try {
      const stats = await QualityControlService.getAdvancedQualityControlStatistics(
        { start_date, end_date },
        tenantFilter,
      );

      const report = {
        title: '质量控制分析报告',
        period: {
          startDate: start_date || '不限',
          endDate: end_date || '不限',
        },
        summary: stats.summary || { total: 0, passRate: 0 },
        byPerson: stats.byPerson || [],
        trends: stats.trends || [],
        byItem: stats.byItem || [],
        defects: stats.defects || [],
        createdAt: new Date(),
        generatedBy: 'System',
      };

      if (format === 'json') {
        return report;
      } else if (format === 'chart') {
        return this.formatChartData(report);
      } else {
        throw new AppError('不支持的报告格式', 400, 'UNSUPPORTED_FORMAT');
      }
    } catch (error) {
      console.error('生成质控报告错误:', error);
      throw new AppError(`生成质控报告失败: ${error.message}`, 500, 'REPORT_GENERATION_ERROR');
    }
  }

  /**
   * 生成综合质量报告 - 修复版
   * 增加了空值检查和错误处理
   */
  static async generateComprehensiveQualityReport(params, tenantFilter) {
    const { start_date, end_date, format = 'json' } = params || {};

    try {
      // 并行获取数据，添加超时和错误处理
      let metrologyStats, qualityControlStats;

      try {
        metrologyStats = await MetrologyService.getAdvancedMetrologyStatistics(
          { start_date, end_date },
          tenantFilter,
        );
      } catch (e) {
        console.error('获取计量统计失败:', e);
        metrologyStats = {
          summary: { total: 0, passRate: 0, avgCost: 0, totalCost: 0 },
          byAgency: [],
          trends: [],
          byAccuracyLevel: [],
        };
      }

      try {
        qualityControlStats = await QualityControlService.getAdvancedQualityControlStatistics(
          { start_date, end_date },
          tenantFilter,
        );
      } catch (e) {
        console.error('获取质控统计失败:', e);
        qualityControlStats = {
          summary: { total: 0, passRate: 0 },
          byPerson: [],
          trends: [],
          byItem: [],
          defects: [],
        };
      }

      // 安全生成对比数据
      const comparison = this.safeGenerateComparisonData(metrologyStats, qualityControlStats);

      // 安全生成建议
      const recommendations = this.safeGenerateRecommendations(metrologyStats, qualityControlStats);

      const report = {
        title: '综合质量分析报告',
        period: {
          startDate: start_date || '不限',
          endDate: end_date || '不限',
        },
        metrology: {
          summary: metrologyStats.summary || { total: 0, passRate: 0 },
          byAgency: metrologyStats.byAgency || [],
          trends: metrologyStats.trends || [],
          byAccuracyLevel: metrologyStats.byAccuracyLevel || [],
        },
        qualityControl: {
          summary: qualityControlStats.summary || { total: 0, passRate: 0 },
          byPerson: qualityControlStats.byPerson || [],
          trends: qualityControlStats.trends || [],
          byItem: qualityControlStats.byItem || [],
          defects: qualityControlStats.defects || [],
        },
        comparison,
        recommendations,
        createdAt: new Date(),
        generatedBy: 'System',
      };

      if (format === 'json') {
        return report;
      } else if (format === 'chart') {
        return this.formatChartData(report);
      } else {
        throw new AppError('不支持的报告格式', 400, 'UNSUPPORTED_FORMAT');
      }
    } catch (error) {
      console.error('生成综合报告错误:', error);
      throw new AppError(`生成综合报告失败: ${error.message}`, 500, 'REPORT_GENERATION_ERROR');
    }
  }

  /**
   * 安全生成对比数据 - 新增方法
   */
  static safeGenerateComparisonData(metrologyStats, qualityControlStats) {
    try {
      const metrologyTotal = metrologyStats?.summary?.total || 0;
      const qualityControlTotal = qualityControlStats?.summary?.total || 0;

      // 安全计算平均通过率
      let metrologyAvgPassRate = 0;
      if (
        metrologyStats?.byAccuracyLevel &&
        Array.isArray(metrologyStats.byAccuracyLevel) &&
        metrologyStats.byAccuracyLevel.length > 0
      ) {
        metrologyAvgPassRate =
          metrologyStats.byAccuracyLevel.reduce((sum, level) => {
            return sum + (level.passRate || 0);
          }, 0) / metrologyStats.byAccuracyLevel.length;
      }

      return {
        totalRecords: {
          metrology: metrologyTotal,
          qualityControl: qualityControlTotal,
          total: metrologyTotal + qualityControlTotal,
        },
        passRates: {
          metrology: metrologyAvgPassRate,
          qualityControl: qualityControlStats?.summary?.passRate || 0,
        },
        costAnalysis: {
          metrologyTotalCost: metrologyStats?.summary?.totalCost || 0,
          metrologyAvgCost: metrologyStats?.summary?.avgCost || 0,
        },
      };
    } catch (error) {
      console.error('生成对比数据错误:', error);
      return {
        totalRecords: { metrology: 0, qualityControl: 0, total: 0 },
        passRates: { metrology: 0, qualityControl: 0 },
        costAnalysis: { metrologyTotalCost: 0, metrologyAvgCost: 0 },
      };
    }
  }

  /**
   * 安全生成建议 - 新增方法
   */
  static safeGenerateRecommendations(metrologyStats, qualityControlStats) {
    const recommendations = [];

    try {
      const metrologyTotal = metrologyStats?.summary?.total || 0;
      const qualityControlTotal = qualityControlStats?.summary?.total || 0;

      if (metrologyTotal > 0) {
        const avgCost = metrologyStats?.summary?.avgCost || 0;
        if (avgCost > 1000) {
          recommendations.push({
            category: 'cost',
            priority: 'high',
            message: '计量成本偏高，建议优化计量流程或寻找更具性价比的计量机构',
          });
        }
      }

      if (qualityControlTotal > 0) {
        const passRate = qualityControlStats?.summary?.passRate || 0;
        if (passRate < 85) {
          recommendations.push({
            category: 'quality',
            priority: 'high',
            message: '质量控制通过率偏低，建议加强质量管控措施',
          });
        }
      }

      if (
        qualityControlStats?.defects &&
        Array.isArray(qualityControlStats.defects) &&
        qualityControlStats.defects.length > 0
      ) {
        const topDefect = qualityControlStats.defects[0];
        if (topDefect && topDefect.count > 5) {
          recommendations.push({
            category: 'process',
            priority: 'high',
            message: `检测到高频缺陷项目 "${topDefect.item}"，共 ${topDefect.count} 次，建议重点改进该环节`,
          });
        }
      }
    } catch (error) {
      console.error('生成建议错误:', error);
    }

    return recommendations;
  }

  /**
   * 格式化图表数据
   */
  static formatChartData(report) {
    const chartData = {
      title: report.title,
      period: report.period,
      series: [],
      xAxis: [],
      yAxis: [],
    };

    try {
      if (report.metrology && report.qualityControl) {
        chartData.series = [
          {
            name: '计量记录数',
            type: 'line',
            data: (report.metrology.trends || []).map(t => t.count || 0),
          },
          {
            name: '质检记录数',
            type: 'line',
            data: (report.qualityControl.trends || []).map(t => t.count || 0),
          },
        ];
        chartData.xAxis = (report.metrology.trends || []).map(t => t.month || '');
      } else if (report.trends) {
        chartData.series = [
          {
            name: '记录数',
            type: 'line',
            data: (report.trends || []).map(t => t.count || 0),
          },
        ];
        chartData.xAxis = (report.trends || []).map(t => t.month || '');
      }
    } catch (error) {
      console.error('格式化图表数据错误:', error);
    }

    return chartData;
  }
}

module.exports = QualityReportGenerator;
