/**
 * 开机率趋势图
 * 展示设备开机率的历史趋势
 */

import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

const UptimeTrendChart = ({ data = [], height = 300 }) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    if (!chartRef.current) return;

    // 初始化图表
    chartInstance.current = echarts.init(chartRef.current);

    const option = {
      tooltip: {
        trigger: 'axis',
        formatter: function(params) {
          let result = `<strong>${params[0].axisValue}</strong><br/>`;
          params.forEach(param => {
            const marker = `<span style="display:inline-block;margin-right:5px;border-radius:10px;width:10px;height:10px;background-color:${param.color};"></span>`;
            result += `${marker}${param.seriesName}: ${param.value}%<br/>`;
          });
          return result;
        }
      },
      legend: {
        data: ['开机率', '目标线'],
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
        axisLine: { lineStyle: { color: '#d9d9d9' } },
        axisLabel: { color: '#666' },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 100,
        axisLabel: {
          formatter: '{value}%',
          color: '#666',
        },
        splitLine: { lineStyle: { color: '#f0f0f0' } },
      },
      series: [
        {
          name: '开机率',
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 8,
          lineStyle: {
            width: 3,
            color: '#1890ff',
          },
          itemStyle: {
            color: '#1890ff',
            borderWidth: 2,
            borderColor: '#fff',
          },
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
          data: data.map(d => d.uptime_rate || d.value),
          markLine: {
            silent: true,
            data: [{
              yAxis: 95,
              label: {
                formatter: '目标95%',
                position: 'end',
              },
              lineStyle: {
                color: '#52c41a',
                type: 'dashed',
              },
            }],
          },
          markPoint: {
            data: [
              { type: 'max', name: '最高' },
              { type: 'min', name: '最低' },
            ],
          },
        },
        {
          name: '目标线',
          type: 'line',
          smooth: false,
          symbol: 'none',
          lineStyle: {
            width: 2,
            color: '#52c41a',
            type: 'dashed',
          },
          data: data.map(() => 95),
        },
      ],
    };

    chartInstance.current.setOption(option);

    // 响应式处理
    const handleResize = () => {
      chartInstance.current?.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chartInstance.current?.dispose();
    };
  }, [data]);

  return <div ref={chartRef} style={{ width: '100%', height }} />;
};

export default UptimeTrendChart;
