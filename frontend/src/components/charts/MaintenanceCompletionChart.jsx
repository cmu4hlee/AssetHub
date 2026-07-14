/**
 * 保养完成率图表
 * 展示保养计划的完成情况统计
 */

import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

// 保养完成率仪表盘
export const MaintenanceGaugeChart = ({ value = 0, height = 250 }) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    if (!chartRef.current) return;

    chartInstance.current = echarts.init(chartRef.current);

    const option = {
      series: [
        {
          type: 'gauge',
          startAngle: 180,
          endAngle: 0,
          min: 0,
          max: 100,
          splitNumber: 10,
          radius: '90%',
          center: ['50%', '70%'],
          axisLine: {
            lineStyle: {
              width: 20,
              color: [
                [0.7, '#ff4d4f'],
                [0.9, '#faad14'],
                [1, '#52c41a'],
              ],
            },
          },
          pointer: {
            icon: 'path://M12.8,0.7l12,40.1H0.7L12.8,0.7z',
            length: '12%',
            width: 20,
            offsetCenter: [0, '-60%'],
            itemStyle: {
              color: 'auto',
            },
          },
          axisTick: {
            length: 12,
            lineStyle: {
              color: 'auto',
              width: 2,
            },
          },
          splitLine: {
            length: 20,
            lineStyle: {
              color: 'auto',
              width: 5,
            },
          },
          axisLabel: {
            color: '#464646',
            fontSize: 12,
            distance: -50,
            formatter: function (value) {
              if (value === 0 || value === 100) {
                return value + '%';
              }
              return '';
            },
          },
          title: {
            offsetCenter: [0, '-20%'],
            fontSize: 16,
            color: '#666',
          },
          detail: {
            fontSize: 36,
            offsetCenter: [0, '0%'],
            valueAnimation: true,
            formatter: function (value) {
              return value.toFixed(1) + '%';
            },
            color: 'auto',
          },
          data: [
            {
              value: value,
              name: '保养完成率',
            },
          ],
        },
      ],
    };

    chartInstance.current.setOption(option);

    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chartInstance.current?.dispose();
    };
  }, [value]);

  return <div ref={chartRef} style={{ width: '100%', height }} />;
};

// 各部门保养完成率对比
export const MaintenanceDeptComparisonChart = ({ data = [], height = 300 }) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    if (!chartRef.current) return;

    chartInstance.current = echarts.init(chartRef.current);

    const option = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: function(params) {
          const d = params[0];
          return `${d.name}<br/>完成率: ${d.value}%<br/>计划数: ${d.data.total}项`;
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '10%',
        containLabel: true,
      },
      xAxis: {
        type: 'value',
        min: 0,
        max: 100,
        axisLabel: {
          formatter: '{value}%',
        },
      },
      yAxis: {
        type: 'category',
        data: data.map(d => d.department || d.name),
      },
      series: [
        {
          name: '完成率',
          type: 'bar',
          data: data.map(d => ({
            value: d.completion_rate || d.value,
            total: d.total || 0,
          })),
          itemStyle: {
            color: function(params) {
              const val = params.value;
              if (val >= 95) return '#52c41a';
              if (val >= 80) return '#faad14';
              return '#ff4d4f';
            },
            borderRadius: [0, 4, 4, 0],
          },
          label: {
            show: true,
            position: 'right',
            formatter: '{c}%',
          },
        },
      ],
    };

    chartInstance.current.setOption(option);

    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chartInstance.current?.dispose();
    };
  }, [data]);

  return <div ref={chartRef} style={{ width: '100%', height }} />;
};

// 保养类型完成情况堆叠图
export const MaintenanceTypeStackChart = ({ data = [], height = 300 }) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    if (!chartRef.current) return;

    chartInstance.current = echarts.init(chartRef.current);

    const statusTypes = ['completed', 'pending', 'overdue'];
    const statusLabels = { completed: '已完成', pending: '待执行', overdue: '已逾期' };
    const statusColors = { completed: '#52c41a', pending: '#faad14', overdue: '#ff4d4f' };

    const series = statusTypes.map(status => ({
      name: statusLabels[status],
      type: 'bar',
      stack: 'total',
      emphasis: { focus: 'series' },
      data: data.map(d => d[status] || 0),
      itemStyle: { color: statusColors[status] },
    }));

    const option = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
      },
      legend: {
        data: Object.values(statusLabels),
        bottom: 0,
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        top: '10%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: data.map(d => d.type || d.name),
      },
      yAxis: {
        type: 'value',
        name: '数量',
      },
      series,
    };

    chartInstance.current.setOption(option);

    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chartInstance.current?.dispose();
    };
  }, [data]);

  return <div ref={chartRef} style={{ width: '100%', height }} />;
};

// 保养月度趋势图
export const MaintenanceMonthlyTrendChart = ({ data = [], height = 300 }) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    if (!chartRef.current) return;

    chartInstance.current = echarts.init(chartRef.current);

    const option = {
      tooltip: {
        trigger: 'axis',
      },
      legend: {
        data: ['计划数', '完成数'],
        bottom: 0,
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        top: '10%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: data.map(d => d.month || d.date),
      },
      yAxis: {
        type: 'value',
        name: '数量',
      },
      series: [
        {
          name: '计划数',
          type: 'line',
          smooth: true,
          data: data.map(d => d.planned || d.total || 0),
          lineStyle: { color: '#1890ff', width: 3 },
          itemStyle: { color: '#1890ff' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(24, 144, 255, 0.3)' },
                { offset: 1, color: 'rgba(24, 144, 255, 0.05)' },
              ],
            },
          },
        },
        {
          name: '完成数',
          type: 'line',
          smooth: true,
          data: data.map(d => d.completed || 0),
          lineStyle: { color: '#52c41a', width: 3 },
          itemStyle: { color: '#52c41a' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(82, 196, 26, 0.3)' },
                { offset: 1, color: 'rgba(82, 196, 26, 0.05)' },
              ],
            },
          },
        },
      ],
    };

    chartInstance.current.setOption(option);

    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chartInstance.current?.dispose();
    };
  }, [data]);

  return <div ref={chartRef} style={{ width: '100%', height }} />;
};

export default {
  MaintenanceGaugeChart,
  MaintenanceDeptComparisonChart,
  MaintenanceTypeStackChart,
  MaintenanceMonthlyTrendChart,
};
