import React, { useState, useEffect } from 'react';
import { useIsMobile, useCan } from '../hooks';
import { Card, Descriptions, Button, message, Space, Tag, Upload, Spin } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeftOutlined,
  EditOutlined,
  DeleteOutlined,
  UploadOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { qualityControlAPI } from '../utils/api';
import { Popconfirm } from 'antd';
import dayjs from 'dayjs';

const QualityControlDetail = () => {
  const canDelete = useCan('quality', 'delete');
  const canEdit = useCan('quality', 'edit');
  const { id } = useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [attachments, setAttachments] = useState([]);
  const isMobile = useIsMobile();

  useEffect(() => {
    loadRecord();
  }, [id]);

  const loadRecord = async () => {
    try {
      setLoading(true);
      const result = await qualityControlAPI.getQualityControlRecord(id);
      if (result.success) {
        setRecord(result.data);
        setAttachments(result.data.attachments || []);
      }
    } catch (error) {
      message.error('加载记录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      const result = await qualityControlAPI.deleteQualityControlRecord(id);
      if (result.success) {
        message.success('删除成功');
        navigate('/quality-control/qc');
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleUpload = async fileList => {
    try {
      const files = fileList.map(item => item.originFileObj || item);
      const result = await qualityControlAPI.uploadQualityControlAttachments(id, files);
      if (result.success) {
        message.success('上传成功');
        loadRecord();
      }
    } catch (error) {
      message.error('上传失败');
    }
  };

  const handleDownload = filePath => {
    window.open(filePath, '_blank');
  };

  const getResultColor = result => {
    const colorMap = {
      合格: 'green',
      不合格: 'red',
      待检: 'default',
      整改中: 'orange',
    };
    return colorMap[result] || 'default';
  };

  const getStatusColor = status => {
    const colorMap = {
      待检: 'default',
      进行中: 'processing',
      已完成: 'success',
      已取消: 'error',
      整改中: 'warning',
    };
    return colorMap[status] || 'default';
  };

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!record) {
    return (
      <div style={{ padding: '24px' }}>
        <Card>
          <div style={{ textAlign: 'center', padding: '40px' }}>记录不存在</div>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: isMobile ? '12px' : '24px' }}>
      <Card>
        <div style={{ marginBottom: '16px' }}>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/quality-control/qc')}>
              返回
            </Button>
            <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={() => navigate(`/quality-control/qc/edit/${id}`)}
            >
              编辑
            </Button>
            <Popconfirm
              title="确定要删除这条记录吗？"
              onConfirm={handleDelete}
              okText="确定"
              cancelText="取消"
            >
              <Button danger icon={<DeleteOutlined />} disabled={!canDelete}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        </div>

        <Descriptions
          title="质控记录详情"
          bordered
          column={isMobile ? 1 : 2}
          size={isMobile ? 'small' : 'default'}
        >
          <Descriptions.Item label="质控单号">{record.record_no}</Descriptions.Item>
          <Descriptions.Item label="资产编号">{record.asset_code}</Descriptions.Item>
          <Descriptions.Item label="资产名称">{record.asset_name}</Descriptions.Item>
          <Descriptions.Item label="质控类型">{record.qc_type}</Descriptions.Item>
          <Descriptions.Item label="质控日期">{record.qc_date}</Descriptions.Item>
          <Descriptions.Item label="下次质控日期">{record.next_qc_date || '-'}</Descriptions.Item>
          <Descriptions.Item label="质控项目">{record.qc_item || '-'}</Descriptions.Item>
          <Descriptions.Item label="质控方法">{record.qc_method || '-'}</Descriptions.Item>
          <Descriptions.Item label="质控标准">{record.qc_standard || '-'}</Descriptions.Item>
          <Descriptions.Item label="质控结果">
            <Tag color={getResultColor(record.result)}>{record.result}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={getStatusColor(record.status)}>{record.status}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="质控数值">{record.qc_value || '-'}</Descriptions.Item>
          <Descriptions.Item label="标准值">{record.standard_value || '-'}</Descriptions.Item>
          <Descriptions.Item label="偏差">{record.deviation || '-'}</Descriptions.Item>
          <Descriptions.Item label="操作人">{record.operator || '-'}</Descriptions.Item>
          <Descriptions.Item label="审核人">{record.reviewer || '-'}</Descriptions.Item>
          <Descriptions.Item label="审核日期">{record.review_date || '-'}</Descriptions.Item>
          <Descriptions.Item label="创建人">{record.created_by || '-'}</Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {record.created_at ? dayjs(record.created_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="更新时间">
            {record.updated_at ? dayjs(record.updated_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="备注" span={2}>
            {record.remark || '-'}
          </Descriptions.Item>
        </Descriptions>

        {attachments.length > 0 && (
          <Card title="附件" style={{ marginTop: '16px' }}>
            <Space orientation="vertical" style={{ width: '100%' }}>
              {attachments.map(att => (
                <div
                  key={att.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px',
                    border: '1px solid #f0f0f0',
                    borderRadius: '4px',
                  }}
                >
                  <span>{att.file_name}</span>
                  <Button
                    type="link"
                    icon={<DownloadOutlined />}
                    onClick={() => handleDownload(att.file_path)}
                  >
                    下载
                  </Button>
                </div>
              ))}
            </Space>
          </Card>
        )}

        <Card title="上传附件" style={{ marginTop: '16px' }}>
          <Upload
            multiple
            beforeUpload={() => false}
            onChange={({ fileList }) => {
              if (fileList.length > 0) {
                handleUpload(fileList);
              }
            }}
          >
            <Button icon={<UploadOutlined />}>选择文件</Button>
          </Upload>
        </Card>
      </Card>
    </div>
  );
};

export default QualityControlDetail;
