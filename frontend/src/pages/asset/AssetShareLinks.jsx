/**
 * 资产详情 - 分享链接模块
 */
import { useCan } from '../../hooks';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  DatePicker,
  InputNumber,
  Space,
  Tag,
  Popconfirm,
  message,
  Tooltip,
  Empty,
} from 'antd';

import {
  ShareAltOutlined,
  DeleteOutlined,
  CopyOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { assetAPI } from '../../utils/api';
import useIsMobile from '../../hooks/useIsMobile';

const AssetShareLinks = ({ assetId, asset, onRefresh }) => {
  const canDelete = useCan('asset', 'delete');
  const canEdit = useCan('asset', 'edit');
  const isMobile = useIsMobile();
  const [shareLinkModalVisible, setShareLinkModalVisible] = useState(false);
  const [shareLinkForm] = Form.useForm();
  const [shareLinks, setShareLinks] = useState([]);
  const [shareLinkLoading, setShareLinkLoading] = useState(false);

  const loadShareLinks = async () => {
    if (!assetId) return;
    try {
      setShareLinkLoading(true);
      const result = await assetAPI.getAssetShareLinks(assetId);
      if (result.success) {
        setShareLinks(result.data || []);
      }
    } catch (error) {
      console.error('加载分享链接失败:', error);
    } finally {
      setShareLinkLoading(false);
    }
  };

  useEffect(() => {
    if (assetId) {
      loadShareLinks();
    }
  }, [assetId]);

  const handleCreateShareLink = async () => {
    try {
      const values = await shareLinkForm.validateFields();
      if (!assetId) return;

      const result = await assetAPI.createAssetShareLink(assetId, values);
      if (result.success) {
        message.success('分享链接创建成功');
        setShareLinkModalVisible(false);
        shareLinkForm.resetFields();
        loadShareLinks();

        Modal.info({
          title: '分享链接已创建',
          width: isMobile ? '95vw' : 700,
          content: (
            <div>
              <p style={{ marginBottom: 8 }}>
                <strong>厂家信息：</strong>
              </p>
              <p style={{ marginBottom: 16, paddingLeft: 16 }}>
                {values.supplier_name || '未填写'}
                {values.supplier_contact && `（${values.supplier_contact}）`}
              </p>
              <p style={{ marginBottom: 8 }}>
                <strong>分享链接：</strong>
              </p>
              <Space.Compact style={{ marginBottom: 16, width: '100%' }}>
                <Input
                  value={result.data.share_url}
                  readOnly
                  style={{ width: 'calc(100% - 60px)' }}
                />
                <Button
                  type="default"
                  onClick={() => {
                    navigator.clipboard.writeText(result.data.share_url);
                    message.success('链接已复制到剪贴板');
                  }}
                >
                  复制
                </Button>
              </Space.Compact>
              <p style={{ marginBottom: 4 }}>
                <strong>有效期至：</strong>
                {dayjs(result.data.expires_at).format('YYYY-MM-DD HH:mm:ss')}
              </p>
              <p style={{ marginBottom: 4 }}>
                <strong>最大上传次数：</strong>
                {result.data.max_uploads}
              </p>
              <p style={{ marginTop: 16, color: '#999', fontSize: '12px' }}>
                提示：请将此链接发送给厂家工程师，工程师可以通过此链接查看资产基本信息并上传技术资料。
              </p>
            </div>
          ),
        });
      }
    } catch (error) {
      console.error('创建分享链接失败:', error);
      if (error.errorFields) return;
      if (error.response?.status === 403) {
        message.error('权限不足，只有系统管理员和资产管理员可以创建分享链接');
      } else {
        message.error(error.response?.data?.message || '创建分享链接失败');
      }
    }
  };

  const handleDeleteShareLink = async shareId => {
    try {
      const result = await assetAPI.deleteAssetShareLink(shareId);
      if (result.success) {
        message.success('分享链接已删除');
        loadShareLinks();
      }
    } catch (error) {
      console.error('删除分享链接失败:', error);
      message.error('删除分享链接失败');
    }
  };

  const shareLinkColumns = [
    {
      title: '分享URL',
      dataIndex: 'share_url',
      key: 'share_url',
      width: 200,
      ellipsis: true,
      render: url => (
        <Space.Compact size="small">
          <Input value={url} readOnly />
          <Button
            type="text"
            icon={<CopyOutlined />}
            onClick={() => {
              navigator.clipboard.writeText(url);
              message.success('链接已复制');
            }}
          />
        </Space.Compact>
      ),
    },
    {
      title: '接收方',
      dataIndex: 'supplier_name',
      key: 'supplier_name',
      width: 120,
    },
    {
      title: '联系人',
      dataIndex: 'supplier_contact',
      key: 'supplier_contact',
      width: 100,
    },
    {
      title: '有效期至',
      dataIndex: 'expires_at',
      key: 'expires_at',
      width: 150,
      render: date => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '已上传',
      dataIndex: 'upload_count',
      key: 'upload_count',
      width: 80,
      align: 'center',
      render: (count, record) => (
        <span>
          {count || 0} / {record.max_uploads}
        </span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: status => (
        <Tag color={status === 'active' ? 'green' : 'red'}>
          {status === 'active' ? '有效' : '已过期'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: date => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Popconfirm
            title="确定删除此分享链接?"
            onConfirm={() => handleDeleteShareLink(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger size="small" icon={<DeleteOutlined />} disabled={!canDelete}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title={
        <Space>
          <ShareAltOutlined />
          资产分享
        </Space>
      }
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setShareLinkModalVisible(true)}
          block={isMobile}
        >
          创建分享链接
        </Button>
      }
      style={{ marginBottom: 16 }}
    >
      <div className="hide-on-mobile">
        <Table
          columns={shareLinkColumns}
          dataSource={shareLinks}
          rowKey="id"
          loading={shareLinkLoading}
          pagination={false}
          scroll={{ x: 900 }}
          size="small"
        />
      </div>
      <div className="mobile-table-cards show-on-mobile">
        {shareLinkLoading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>加载中...</div>
        ) : Array.isArray(shareLinks) && shareLinks.length > 0 ? (
          <>
            {shareLinks.map(record => (
              <div key={record.id} className="mobile-card-item">
                <div className="mobile-card-header">
                  <span className="mobile-card-title">{record.supplier_name || '未填写'}</span>
                  <Tag color={record.status === 'active' ? 'green' : 'red'}>
                    {record.status === 'active' ? '有效' : '已过期'}
                  </Tag>
                </div>
                <div className="mobile-card-body">
                  {record.supplier_contact && (
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">联系人</span>
                      <span className="mobile-card-value">{record.supplier_contact}</span>
                    </div>
                  )}
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">有效期至</span>
                    <span className="mobile-card-value">{dayjs(record.expires_at).format('YYYY-MM-DD HH:mm')}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">已上传</span>
                    <span className="mobile-card-value">{record.upload_count || 0} / {record.max_uploads}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">创建时间</span>
                    <span className="mobile-card-value">{dayjs(record.created_at).format('YYYY-MM-DD HH:mm')}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">分享链接</span>
                    <span className="mobile-card-value" style={{ wordBreak: 'break-all' }}>
                      <Space.Compact size="small">
                        <Input value={record.share_url} readOnly />
                        <Button
                          type="text"
                          icon={<CopyOutlined />}
                          onClick={() => {
                            navigator.clipboard.writeText(record.share_url);
                            message.success('链接已复制');
                          }}
                        />
                      </Space.Compact>
                    </span>
                  </div>
                </div>
                <div className="mobile-card-actions">
                  <Popconfirm
                    title="确定删除此分享链接?"
                    onConfirm={() => handleDeleteShareLink(record.id)}
                    okText="确定"
                    cancelText="取消"
                  >
                    <Button type="primary" danger size="small" block icon={<DeleteOutlined />}>
                      删除
                    </Button>
                  </Popconfirm>
                </div>
              </div>
            ))}
          </>
        ) : (
          <Empty description="暂无数据" />
        )}
      </div>

      <Modal
        title="创建资产分享链接"
        open={shareLinkModalVisible}
        onCancel={() => {
          setShareLinkModalVisible(false);
          shareLinkForm.resetFields();
        }}
        onOk={handleCreateShareLink}
        okText="创建"
        cancelText="取消"
        width={isMobile ? '95vw' : 600}
      >
        <Form
          form={shareLinkForm}
          layout="vertical"
          initialValues={{
            expires_at: dayjs().add(7, 'day'),
            max_uploads: 5,
          }}
        >
          <Form.Item
            name="supplier_name"
            label="厂家名称"
            rules={[{ required: true, message: '请输入厂家名称' }]}
          >
            <Input placeholder="请输入接收方厂家名称" />
          </Form.Item>

          <Form.Item name="supplier_contact" label="联系人/联系方式">
            <Input placeholder="请输入联系人或联系方式" />
          </Form.Item>

          <Form.Item
            name="expires_at"
            label="有效期至"
            rules={[{ required: true, message: '请选择有效期' }]}
          >
            <DatePicker
              showTime
              format="YYYY-MM-DD HH:mm"
              style={{ width: '100%' }}
              placeholder="选择有效期"
            />
          </Form.Item>

          <Form.Item
            name="max_uploads"
            label="最大上传次数"
            rules={[{ required: true, message: '请输入最大上传次数' }]}
          >
            <InputNumber
              min={1}
              max={100}
              style={{ width: '100%' }}
              placeholder="允许上传的最大次数"
            />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default AssetShareLinks;
