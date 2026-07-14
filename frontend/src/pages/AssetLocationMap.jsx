import React, { useState, useEffect, useRef } from 'react';
import { useIsMobile } from '../hooks';
import {
  Card,
  Table,
  Button,
  Input,
  Space,
  message,
  Row,
  Col,
  Spin,
} from 'antd';

import {
  SearchOutlined,
} from '@ant-design/icons';
import { assetLocationAPI } from '../utils/api';

const AMAP_API_KEY = import.meta.env.VITE_AMAP_API_KEY || '';

const AssetLocationMap = () => {
  const [loading, setLoading] = useState(false);
  const [assets, setAssets] = useState([]);
  const [mapLoading, setMapLoading] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const [searchParams, setSearchParams] = useState({
    keyword: '',
  });
  const isMobile = useIsMobile();

  const scriptLoadedRef = useRef(false);
  const cleanupRef = useRef(null);

  useEffect(() => {
    const handleResize = () => {
      if (mapInstanceRef.current) {
        setTimeout(() => {
          try {
            mapInstanceRef.current.resize();
          } catch (e) {
            console.warn('地图 resize 失败:', e);
          }
        }, 300);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    let timeoutId = null;
    let scriptElement = null;
    let timerId = null;
    let isMounted = true;

    const checkAMap = () => {
      if (!isMounted) return;

      if (window.AMap) {
        setMapReady(true);
        return;
      }

      if (scriptLoadedRef.current) {
        return;
      }

      scriptLoadedRef.current = true;
      console.log('高德地图未加载，尝试动态加载...');

      if (!AMAP_API_KEY) {
        console.warn('⚠️ 未配置 VITE_AMAP_API_KEY，将使用演示 Key（可能受限）。请在 .env.development 中设置 VITE_AMAP_API_KEY');
      }

      scriptElement = document.createElement('script');
      scriptElement.src = AMAP_API_KEY
        ? `https://webapi.amap.com/maps?v=2.0&key=${AMAP_API_KEY}&plugin=AMap.Geocoder,AMap.PlaceSearch`
        : 'https://webapi.amap.com/maps?v=2.0&key=3d577064bbe6bcd829b0881f04037fef&plugin=AMap.Geocoder,AMap.PlaceSearch';
      scriptElement.async = true;
      scriptElement.defer = true;

      timeoutId = setTimeout(() => {
        if (!isMounted) return;
        console.warn('高德地图脚本加载超时');
        if (window.AMap) {
          setMapReady(true);
        }
      }, 10000);

      scriptElement.onload = () => {
        if (!isMounted) return;
        clearTimeout(timeoutId);
        console.log('高德地图脚本加载成功');
        setTimeout(() => {
          if (isMounted) {
            if (window.AMap) {
              setMapReady(true);
            } else {
              console.error('高德地图脚本加载后，window.AMap 仍为 undefined');
              message.error('高德地图加载失败，请检查 API Key 配置');
            }
          }
        }, 100);
      };

      scriptElement.onerror = (error) => {
        if (!isMounted) return;
        clearTimeout(timeoutId);
        console.error('高德地图脚本加载失败:', error);
        message.error('高德地图加载失败，请检查网络或配置 API Key');
      };

      document.head.appendChild(scriptElement);
    };

    timerId = setTimeout(checkAMap, 500);

    cleanupRef.current = () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      if (timerId) clearTimeout(timerId);
      if (scriptElement && document.head.contains(scriptElement)) {
        document.head.removeChild(scriptElement);
      }
      scriptLoadedRef.current = false;
    };

    return cleanupRef.current;
  }, []);

  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.destroy();
        } catch (e) {
          console.warn('地图销毁失败:', e);
        }
      }
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    setMapLoading(true);
    try {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.destroy();
      }

      mapInstanceRef.current = new window.AMap.Map(mapRef.current, {
        zoom: 11,
        center: [116.397428, 39.90923],
        viewMode: '2D',
      });

      mapInstanceRef.current.on('complete', () => {
        setMapLoading(false);
      });
    } catch (error) {
      console.error('初始化地图失败:', error);
      setMapLoading(false);
      message.error('初始化地图失败');
    }
  }, [mapReady]);

  // 加载资产列表（含位置信息）
  useEffect(() => {
    loadAssets();
  }, [searchParams]);

  const loadAssets = async () => {
    try {
      setLoading(true);
      const params = {
        page: 1,
        pageSize: 50,
        keyword: searchParams.keyword || undefined,
      };
      const result = await assetLocationAPI.getLocations(params);
      if (result.success) {
        setAssets(result.data || []);
      }
    } catch (error) {
      console.error('加载资产位置列表失败:', error);
      message.error('加载资产位置列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAssetSelect = record => {
    if (record.latitude && record.longitude && mapInstanceRef.current) {
      if (markerRef.current) {
        mapInstanceRef.current.remove(markerRef.current);
      }

      markerRef.current = new window.AMap.Marker({
        position: new window.AMap.LngLat(parseFloat(record.longitude), parseFloat(record.latitude)),
        title: record.asset_name,
      });

      mapInstanceRef.current.add(markerRef.current);
      mapInstanceRef.current.setFitView(markerRef.current);
    }
  };

  const columns = [
    { title: '资产编号', dataIndex: 'asset_code', key: 'asset_code', width: 120 },
    { title: '资产名称', dataIndex: 'asset_name', key: 'asset_name', width: 150, ellipsis: true },
    {
      title: '位置信息',
      key: 'location',
      ellipsis: true,
      render: (_, record) => {
        const parts = [];
        if (record.building_name) parts.push(record.building_name);
        if (record.floor_number) parts.push(`${record.floor_number}楼`);
        if (record.room_number) parts.push(record.room_number);
        if (record.area_name) parts.push(record.area_name);
        if (parts.length === 0 && record.latitude && record.longitude) {
          return `${parseFloat(record.latitude).toFixed(4)}, ${parseFloat(record.longitude).toFixed(4)}`;
        }
        return parts.length > 0 ? parts.join(' ') : '-';
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          disabled={!record.latitude || !record.longitude}
          onClick={() => handleAssetSelect(record)}
        >
          定位
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: isMobile ? 8 : 16 }}>
      <Card title="资产位置管理" size="small">
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} md={6}>
            <Input
              placeholder="搜索资产编号/名称"
              prefix={<SearchOutlined />}
              value={searchParams.keyword}
              onChange={e => setSearchParams(p => ({ ...p, keyword: e.target.value }))}
              allowClear
            />
          </Col>
        </Row>

        <div className="hide-on-mobile">
          <Table
            columns={columns}
            dataSource={assets}
            rowKey="id"
            loading={loading}
            size="small"
            pagination={{ pageSize: 10 }}
            scroll={{ x: 600 }}
          />
        </div>

        {/* 移动端卡片列表 */}
        <div className="mobile-table-cards show-on-mobile">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>加载中...</div>
          ) : Array.isArray(assets) && assets.length > 0 ? (
            assets.map(record => (
              <div key={record.id} className="mobile-card-item">
                <div className="mobile-card-header">
                  <span className="mobile-card-title">{record.asset_code || `#${record.id}`}</span>
                </div>
                <div className="mobile-card-body">
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">资产名称</span>
                    <span className="mobile-card-value">{record.asset_name || '-'}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">位置信息</span>
                    <span className="mobile-card-value">
                      {[record.building_name, record.floor_number ? `${record.floor_number}楼` : '', record.room_number, record.area_name].filter(Boolean).join(' ') || '-'}
                    </span>
                  </div>
                </div>
                <div className="mobile-card-actions">
                  <Button
                    type="primary"
                    size="small"
                    block
                    onClick={() => handleAssetSelect(record)}
                  >
                    定位
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>暂无数据</div>
          )}
        </div>

        <div style={{ marginTop: 16 }}>
          <Spin spinning={mapLoading} description="地图加载中...">
            <div
              ref={mapRef}
              style={{
                width: '100%',
                height: isMobile ? 300 : 400,
                borderRadius: 8,
                overflow: 'hidden',
              }}
            />
          </Spin>
        </div>
      </Card>
    </div>
  );
};

export default AssetLocationMap;
