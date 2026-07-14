/**
 * 资产详情页面 - 主容器组件
 *
 * 职责:
 * - 加载和管理资产数据
 * - 协调各个子模块
 * - 处理全局状态
 *
 * 已拆分的子组件:
 * - AssetOverview: 基础信息
 * - AssetImages: 图片管理
 * - AssetLocation: 位置信息
 * - AssetDocuments: 技术资料
 * - AssetStatusTransition: 状态迁移
 * - AssetShareLinks: 分享链接
 * - AssetChangeLogs: 变更日志
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Spin, message, Button, Space } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import { assetAPI } from '../utils/api';
import { useIsMobile, useCurrentUser } from '../hooks';
import { tenderingAPI } from '../api/domains/tendering';
import {
  AssetOverview,
  AssetImages,
  AssetLocation,
  AssetDocuments,
  AssetStatusTransition,
  AssetShareLinks,
  AssetChangeLogs,
  AssetMaintenanceRecords,
  AssetQualityManagement,
} from './asset';

const AssetDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { user: currentUser } = useCurrentUser();

  const [asset, setAsset] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadAssetDetail = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const result = await assetAPI.getAsset(id);
      if (result.success) {
        setAsset(result.data);
      } else {
        message.error(result.message || '加载失败');
        navigate('/assets');
      }
    } catch (error) {
      console.error('加载资产详情失败:', error);
      message.error('加载资产详情失败');
      navigate('/assets');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    loadAssetDetail();
  }, [loadAssetDetail]);

  const handleBack = () => {
    navigate('/assets');
  };

  const handleEdit = () => {
    navigate(`/assets/edit/${asset?.id || id}`);
  };

  const handleRefresh = () => {
    loadAssetDetail();
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '400px'
      }}>
        <Spin size="large" description="加载中..." />
      </div>
    );
  }

  if (!asset) {
    return null;
  }

  return (
    <div style={{ padding: isMobile ? 8 : 16 }}>
      <div style={{ marginBottom: 8 }}>
        <Space>
          <Button
            icon={<FileTextOutlined />}
            onClick={async () => {
              try {
                const res = await tenderingAPI.createInvoiceFromAsset(asset.id, {
                  amount: asset.original_value,
                  supplier_id: asset.supplier_id,
                  remark: `资产入账发票 - ${asset.asset_name || asset.asset_code}`,
                });
                const invId = res?.data?.id || res?.id;
                message.success('已生成资产入账发票草稿');
                navigate(`/tendering/invoices/${invId}`);
              } catch (err) {
                message.error(err.response?.data?.message || '生成发票失败');
              }
            }}
          >
            立即入账开发票
          </Button>
        </Space>
      </div>
      <AssetOverview
        asset={asset}
        onBack={handleBack}
        onEdit={handleEdit}
      />

      <AssetImages
        assetId={asset.asset_code}
        asset={asset}
        onRefresh={handleRefresh}
      />

      <AssetLocation
        assetId={asset.asset_code}
        asset={asset}
      />

      <AssetDocuments
        assetId={asset.asset_code}
        asset={asset}
      />

      <AssetStatusTransition
        assetId={asset.asset_code}
        asset={asset}
        onRefresh={handleRefresh}
      />

      <AssetShareLinks
        assetId={asset.id}
        asset={asset}
        onRefresh={handleRefresh}
      />

      <AssetChangeLogs
        assetId={asset.asset_code}
        asset={asset}
      />

      <AssetMaintenanceRecords
        assetId={asset.asset_code}
        asset={asset}
      />

      <AssetQualityManagement
        assetId={asset.asset_code}
        asset={asset}
      />
    </div>
  );
};

export default AssetDetail;
