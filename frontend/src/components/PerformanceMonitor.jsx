/**
 * 前端性能监控组件
 * 监控页面加载性能、资源加载时间、Web Vitals 等
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Card, Statistic, Row, Col, Tag, Timeline, Button, Modal, Alert } from 'antd';
import {
  DashboardOutlined,
  FileOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';

const PerformanceMonitor = ({
  visible = false,
  onClose,
  threshold = {
    fcp: 1800,    // First Contentful Paint
    lcp: 2500,    // Largest Contentful Paint
    fid: 100,     // First Input Delay
    cls: 0.1,     // Cumulative Layout Shift
    ttfb: 600,    // Time to First Byte
    tti: 3500,    // Time to Interactive
  }
}) => {
  const [metrics, setMetrics] = useState({});
  const [resources, setResources] = useState([]);
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [webVitals, setWebVitals] = useState({});
  const [memoryInfo, setMemoryInfo] = useState(null);
  const metricsRef = useRef({});

  // 获取首次绘制时间
  const getFirstPaint = () => {
    const paintEntries = performance.getEntriesByType('paint');
    const fmp = paintEntries.find(entry => entry.name === 'first-contentful-paint');
    return fmp ? Math.round(fmp.startTime) : null;
  };

  // 估算 Time to Interactive
  const calculateTTI = () => {
    const navigation = performance.getEntriesByType('navigation')[0];
    if (!navigation) return null;
    return Math.round(navigation.domContentLoadedEventEnd - navigation.startTime + 5000);
  };

  // 获取资源类型
  const getResourceType = (url) => {
    if (/\.(js|css)$/i.test(url)) return 'script';
    if (/\.(png|jpg|jpeg|gif|svg|ico|webp)$/i.test(url)) return 'image';
    if (/\.(woff|woff2|ttf|eot)$/i.test(url)) return 'font';
    if (/\.(html|htm)$/i.test(url)) return 'html';
    return 'other';
  };

  // 收集内存信息
  const collectMemoryInfo = () => {
    if (performance.memory) {
      const memory = performance.memory;
      setMemoryInfo({
        used: Math.round(memory.usedJSHeapSize / 1048576),
        total: Math.round(memory.totalJSHeapSize / 1048576),
        limit: Math.round(memory.jsHeapSizeLimit / 1048576),
        usagePercent: Math.round((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100),
      });
    }
  };

  // 收集 Web Vitals
  const collectWebVitals = () => {
    // FID (First Input Delay)
    if (window.PerformanceEventTiming) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.processingStart - entry.startTime > 0) {
            const fid = entry.processingStart - entry.startTime;
            setWebVitals(prev => ({ ...prev, fid: Math.round(fid) }));
          }
        }
      });
      observer.observe({ type: 'first-input', buffered: true });
    }

    // LCP (Largest Contentful Paint)
    if (window.PerformanceObserver) {
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          if (lastEntry) {
            setWebVitals(prev => ({ ...prev, lcp: Math.round(lastEntry.renderTime || lastEntry.loadTime) }));
          }
        });
        lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
      } catch (e) {
        // 浏览器不支持
      }
    }

    // CLS (Cumulative Layout Shift)
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      }
      setWebVitals(prev => ({ ...prev, cls: clsValue.toFixed(3) }));
    });
    try {
      clsObserver.observe({ type: 'layout-shift', buffered: true });
    } catch (e) {
      // 浏览器不支持
    }
  };

  // 收集性能数据
  const collectMetrics = useCallback(() => {
    setLoading(true);

    if (!window.performance) {
      setLoading(false);
      return;
    }

    // 导航计时
    const navigation = performance.getEntriesByType('navigation')[0];
    if (navigation) {
      const newMetrics = {
        dns: Math.round(navigation.domainLookupEnd - navigation.domainLookupStart),
        tcp: Math.round(navigation.connectEnd - navigation.connectStart),
        ttfb: Math.round(navigation.responseStart - navigation.requestStart),
        download: Math.round(navigation.responseEnd - navigation.responseStart),
        dom: Math.round(navigation.domComplete - navigation.domInteractive),
        load: Math.round(navigation.loadEventEnd - navigation.startTime),
        domContentLoaded: Math.round(navigation.domContentLoadedEventEnd - navigation.startTime),
        firstPaint: getFirstPaint(),
        tti: calculateTTI(),
      };
      setMetrics(newMetrics);
      metricsRef.current = { ...metricsRef.current, ...newMetrics };
    }

    // 资源加载时间
    const resourceEntries = performance.getEntriesByType('resource');
    const slowResources = resourceEntries
      .filter(r => r.duration > 500)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10)
      .map(r => ({
        name: r.name.split('/').pop(),
        url: r.name,
        duration: Math.round(r.duration),
        size: r.transferSize,
        type: getResourceType(r.name),
      }));
    setResources(slowResources);

    // 内存信息（仅 Chrome 支持）
    collectMemoryInfo();

    // Web Vitals 手动收集
    collectWebVitals();

    setLoading(false);
  }, []);

  useEffect(() => {
    if (!visible) {
      return undefined;
    }

    const frameId = window.requestAnimationFrame(() => {
      collectMetrics();
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [visible, collectMetrics]);

  // 监控错误
  useEffect(() => {
    const handleError = (event) => {
      setErrors(prev => [...prev, {
        message: event.message,
        source: event.filename,
        line: event.lineno,
        col: event.colno,
        time: new Date().toLocaleTimeString(),
      }]);
    };

    const handleRejection = (event) => {
      setErrors(prev => [...prev, {
        message: event.reason?.message || 'Promise Rejection',
        source: 'Promise',
        time: new Date().toLocaleTimeString(),
      }]);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  // 导出性能报告
  const exportReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      url: window.location.href,
      metrics: metricsRef.current,
      webVitals,
      memory: memoryInfo,
      errors: errors.slice(-50),
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatus = (value, warnThreshold, errorThreshold) => {
    if (value <= warnThreshold * 0.7) return { color: 'success', text: '优秀' };
    if (value <= warnThreshold) return { color: 'warning', text: '良好' };
    if (value <= errorThreshold) return { color: 'warning', text: '一般' };
    return { color: 'error', text: '需优化' };
  };

  return (
    <Modal
      title={<><DashboardOutlined /> 性能监控面板</>}
      open={visible}
      onCancel={onClose}
      width={1000}
      footer={[
        <Button key="export" icon={<ThunderboltOutlined />} onClick={exportReport}>
          导出报告
        </Button>,
        <Button key="refresh" icon={<ReloadOutlined />} onClick={collectMetrics} loading={loading}>
          刷新
        </Button>,
        <Button key="close" type="primary" onClick={onClose}>
          关闭
        </Button>,
      ]}
    >
      {/* Web Vitals 概览 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="LCP (最大内容绘制)"
              value={webVitals.lcp || metrics.firstPaint || '-'}
              suffix="ms"
              styles={{ content: {
                color: webVitals.lcp > threshold.lcp ? '#ff4d4f' : webVitals.lcp > threshold.lcp * 0.8 ? '#faad14' : '#52c41a',
                fontSize: 18,
              } }}
            />
            {webVitals.lcp && (
              <Tag color={getStatus(webVitals.lcp, threshold.lcp, threshold.lcp * 1.5).color}>
                {getStatus(webVitals.lcp, threshold.lcp, threshold.lcp * 1.5).text}
              </Tag>
            )}
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="FID (首次输入延迟)"
              value={webVitals.fid || '-'}
              suffix="ms"
              styles={{ content: {
                color: webVitals.fid > threshold.fid ? '#ff4d4f' : '#52c41a',
                fontSize: 18,
              } }}
            />
            {webVitals.fid && (
              <Tag color={getStatus(webVitals.fid, threshold.fid, threshold.fid * 2).color}>
                {getStatus(webVitals.fid, threshold.fid, threshold.fid * 2).text}
              </Tag>
            )}
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="CLS (布局偏移)"
              value={webVitals.cls || '0.000'}
              suffix=""
              styles={{ content: {
                color: parseFloat(webVitals.cls || 0) > threshold.cls ? '#ff4d4f' : '#52c41a',
                fontSize: 18,
              } }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="内存使用"
              value={memoryInfo ? `${memoryInfo.used}MB` : '-'}
              suffix={memoryInfo ? `/ ${memoryInfo.total}MB` : ''}
              styles={{ content: {
                color: memoryInfo && memoryInfo.usagePercent > 80 ? '#ff4d4f' : '#52c41a',
                fontSize: 18,
              } }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col span={12}>
          <Card title={<><ClockCircleOutlined /> 页面加载时间</>} size="small">
            <Row gutter={[8, 8]}>
              <Col span={8}>
                <Statistic title="DNS" value={metrics.dns || 0} suffix="ms" styles={{ content: { fontSize: 14 } }} />
              </Col>
              <Col span={8}>
                <Statistic title="TCP" value={metrics.tcp || 0} suffix="ms" styles={{ content: { fontSize: 14 } }} />
              </Col>
              <Col span={8}>
                <Statistic
                  title="TTFB"
                  value={metrics.ttfb || 0}
                  suffix="ms"
                  styles={{ content: { fontSize: 14, color: (metrics.ttfb || 0) > threshold.ttfb ? '#ff4d4f' : '#52c41a' } }}
                />
              </Col>
              <Col span={8}>
                <Statistic title="首次绘制" value={metrics.firstPaint || 0} suffix="ms" styles={{ content: { fontSize: 14 } }} />
              </Col>
              <Col span={8}>
                <Statistic title="DOM加载" value={metrics.dom || 0} suffix="ms" styles={{ content: { fontSize: 14 } }} />
              </Col>
              <Col span={8}>
                <Statistic title="DOM就绪" value={metrics.domContentLoaded || 0} suffix="ms" styles={{ content: { fontSize: 14 } }} />
              </Col>
              <Col span={24}>
                <Statistic
                  title="总加载时间"
                  value={metrics.load || 0}
                  suffix="ms"
                  styles={{ content: {
                    color: (metrics.load || 0) > 3000 ? '#ff4d4f' : (metrics.load || 0) > 1500 ? '#faad14' : '#52c41a',
                    fontSize: 28,
                    fontWeight: 'bold'
                  } }}
                />
              </Col>
            </Row>
          </Card>
        </Col>

        <Col span={12}>
          <Card title="慢资源加载 (>500ms)" size="small">
            {resources.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 20, color: '#52c41a' }}>
                <FileOutlined style={{ fontSize: 48 }} />
                <p>所有资源加载正常</p>
              </div>
            ) : (
              <Timeline>
                {resources.map((res, index) => (
                  <Timeline.Item
                    key={index}
                    color={res.duration > 3000 ? 'red' : res.duration > 1000 ? 'orange' : 'blue'}
                  >
                    <div>
                      <Tag>{res.type}</Tag>
                      <div style={{ fontWeight: 'bold', display: 'inline', marginLeft: 8 }}>{res.name}</div>
                      <div style={{ fontSize: 12, color: '#666' }}>
                        {res.duration}ms
                        {res.size && ` · ${(res.size / 1024).toFixed(1)}KB`}
                      </div>
                    </div>
                  </Timeline.Item>
                ))}
              </Timeline>
            )}
          </Card>
        </Col>

        <Col span={24}>
          <Card
            title={
              <>
                <ExclamationCircleOutlined />
                错误日志 ({errors.length})
              </>
            }
            size="small"
          >
            {errors.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 20, color: '#52c41a' }}>
                暂无错误记录
              </div>
            ) : (
              <div style={{ maxHeight: 200, overflow: 'auto' }}>
                {errors.slice(-10).map((err, index) => (
                  <Alert
                    key={index}
                    type="error"
                    title={err.message}
                    description={`${err.source}${err.line ? `:${err.line}` : ''} · ${err.time}`}
                    style={{ marginBottom: 8 }}
                    showIcon
                  />
                ))}
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </Modal>
  );
};

export default PerformanceMonitor;
