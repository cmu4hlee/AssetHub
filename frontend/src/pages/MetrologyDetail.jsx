import React, { useState, useEffect } from 'react';
import { useIsMobile, useCan } from '../hooks';
import { Card, Descriptions, Button, message, Space, Tag, Upload, Spin, Row, Col } from 'antd';
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

const MetrologyDetail = () => {
  const canDelete = useCan('metrology', 'delete');
  const canEdit = useCan('metrology', 'edit');
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
      const result = await qualityControlAPI.getMetrologyRecord(id);
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
      const result = await qualityControlAPI.deleteMetrologyRecord(id);
      if (result.success) {
        message.success('删除成功');
        navigate('/quality-control/metrology');
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleUpload = async fileList => {
    try {
      const files = fileList.map(item => item.originFileObj || item);
      const result = await qualityControlAPI.uploadMetrologyAttachments(id, files);
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
      限用: 'orange',
      待检: 'default',
    };
    return colorMap[result] || 'default';
  };

  const getStatusColor = status => {
    const colorMap = {
      待检: 'default',
      进行中: 'processing',
      已完成: 'success',
      已取消: 'error',
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
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/quality-control/metrology')}
            >
              返回
            </Button>
            <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={() => navigate(`/quality-control/metrology/edit/${id}`)}
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
          title="计量记录详情"
          bordered
          column={isMobile ? 1 : 2}
          size={isMobile ? 'small' : 'default'}
        >
          <Descriptions.Item label="计量单号">{record.record_no}</Descriptions.Item>
          <Descriptions.Item label="资产编号">{record.asset_code}</Descriptions.Item>
          <Descriptions.Item label="资产名称">{record.asset_name}</Descriptions.Item>
          <Descriptions.Item label="计量类型">{record.metrology_type}</Descriptions.Item>
          <Descriptions.Item label="计量日期">{record.metrology_date}</Descriptions.Item>
          <Descriptions.Item label="下次计量日期">
            {record.next_metrology_date || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="计量机构">{record.metrology_agency || '-'}</Descriptions.Item>
          <Descriptions.Item label="证书编号">{record.certificate_no || '-'}</Descriptions.Item>
          <Descriptions.Item label="证书有效期">
            {record.certificate_validity_date || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="计量结果">
            <Tag color={getResultColor(record.result)}>{record.result}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={getStatusColor(record.status)}>{record.status}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="操作人">{record.operator || '-'}</Descriptions.Item>
          <Descriptions.Item label="批准人">{record.approver || '-'}</Descriptions.Item>
          <Descriptions.Item label="计量费用">
            {record.cost ? `¥${record.cost}` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="准确度等级">{record.accuracy_level || '-'}</Descriptions.Item>
          <Descriptions.Item label="测量范围">{record.measurement_range || '-'}</Descriptions.Item>
          <Descriptions.Item label="扩展不确定度">{record.uncertainty || '-'}</Descriptions.Item>
          <Descriptions.Item label="校准环境">
            {record.calibration_environment || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="标准器具">
            {record.standard_instrument || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="标准证书编号">
            {record.standard_certificate_no || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="标准有效期">
            {record.standard_validity || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="创建人">{record.created_by || '-'}</Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {record.created_at ? dayjs(record.created_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="更新时间">
            {record.updated_at ? dayjs(record.updated_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="校准项目" span={2}>
            {record.calibration_items || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="校准数据" span={2}>
            {record.calibration_data || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="校准结论" span={2}>
            {record.calibration_conclusion || '-'}
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

export default MetrologyDetail;
