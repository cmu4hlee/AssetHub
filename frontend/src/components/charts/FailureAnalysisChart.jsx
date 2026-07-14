/**
 * 设备故障分析图
 * 展示设备故障类型分布和趋势
 */

import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

// 故障类型饼图
export const FailureTypePieChart = ({ data = [], height = 300 }) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    if (!chartRef.current) return;

    chartInstance.current = echarts.init(chartRef.current);

    const colors = ['#ff4d4f', '#faad14', '#1890ff', '#52c41a', '#722ed1', '#13c2c2', '#eb2f96'];

    const option = {
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c}次 ({d}%)',
      },
      legend: {
        orient: 'vertical',
        right: 10,
        top: 'center',
      },
      color: colors,
      series: [
        {
          name: '故障类型',
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['40%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 10,
            borderColor: '#fff',
            borderWidth: 2,
          },
          label: {
            show: false,
            position: 'center',
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 18,
              fontWeight: 'bold',
            },
          },
          labelLine: {
            show: false,
          },
          data: data,
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

// 故障趋势柱状图
export const FailureTrendBarChart = ({ data = [], height = 300 }) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    if (!chartRef.current) return;

    chartInstance.current = echarts.init(chartRef.current);

    const option = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '10%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: data.map(d => d.month || d.date),
        axisTick: { alignWithLabel: true },
      },
      yAxis: {
        type: 'value',
        name: '故障次数',
      },
      series: [
        {
          name: '故障次数',
          type: 'bar',
          barWidth: '60%',
          data: data.map(d => d.count || d.value),
          itemStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: '#ff4d4f' },
                { offset: 1, color: '#ff7875' },
              ],
            },
            borderRadius: [4, 4, 0, 0],
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

// 故障处理时间分析图
export const FailureResolutionTimeChart = ({ data = [], height = 300 }) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    if (!chartRef.current) return;

    chartInstance.current = echarts.init(chartRef.current);

    const option = {
      tooltip: {
        trigger: 'axis',
        formatter: '{b}<br/>平均处理时间: {c}小时',
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '10%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: data.map(d => d.type || d.name),
        axisLabel: {
          rotate: 30,
          interval: 0,
        },
      },
      yAxis: {
        type: 'value',
        name: '小时',
      },
      series: [
        {
          name: '平均处理时间',
          type: 'bar',
          data: data.map(d => d.avgTime || d.value),
          itemStyle: {
            color: function(params) {
              const colors = ['#52c41a', '#52c41a', '#faad14', '#faad14', '#ff4d4f', '#ff4d4f'];
              return colors[params.dataIndex % colors.length];
            },
            borderRadius: [4, 4, 0, 0],
          },
          markLine: {
            data: [
              {
                type: 'average',
                name: '平均值',
                label: {
                  formatter: '平均: {c}小时',
                },
              },
            ],
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
  FailureTypePieChart,
  FailureTrendBarChart,
  FailureResolutionTimeChart,
};
