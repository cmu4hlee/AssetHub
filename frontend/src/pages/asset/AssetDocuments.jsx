/**
 * 资产详情 - 技术资料模块
 */
import { useCan } from '../../hooks';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Space,
  Tag,
  Popconfirm,
  message,
  Tooltip,
  Descriptions,
  Row,
  Col,
  Empty,
} from 'antd';

import {
  FileOutlined,
  UploadOutlined,
  DeleteOutlined,
  DownloadOutlined,
  LinkOutlined,
  SearchOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { technicalDocumentsAPI } from '../../utils/api';
import useIsMobile from '../../hooks/useIsMobile';

const { Search } = Input;
const { Option } = Select;

const AssetDocuments = ({ assetId, asset }) => {
  const canDelete = useCan('asset', 'delete');
  const canEdit = useCan('asset', 'edit');
  const isMobile = useIsMobile();
  const [documents, setDocuments] = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [linkModalVisible, setLinkModalVisible] = useState(false);
  const [linkForm] = Form.useForm();
  const [availableDocuments, setAvailableDocuments] = useState([]);
  const [linkDocumentLoading, setLinkDocumentLoading] = useState(false);
  const [linkFilters, setLinkFilters] = useState({
    keyword: '',
    category: '',
    brand: '',
    model: '',
  });
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [linkDocMobilePage, setLinkDocMobilePage] = useState(1);
  const linkDocPageSize = 10;
  const fileInputRef = React.useRef(null);

  const loadDocuments = async () => {
    if (!asset) return;
    try {
      setDocumentsLoading(true);
      const result = await technicalDocumentsAPI.getAssetTechnicalDocuments(asset.asset_code);
      if (result.success) {
        setDocuments(result.data || []);
      }
    } catch (error) {
      console.error('加载技术资料失败:', error);
    } finally {
      setDocumentsLoading(false);
    }
  };

  const loadAvailableDocuments = async () => {
    try {
      setLinkDocumentLoading(true);
      const result = await technicalDocumentsAPI.getTechnicalDocuments({ pageSize: 100 });
      if (result.success) {
        setAvailableDocuments(result.data?.list || []);
      }
    } catch (error) {
      console.error('加载可选技术资料失败:', error);
    } finally {
      setLinkDocumentLoading(false);
    }
  };

  useEffect(() => {
    if (asset) {
      loadDocuments();
    }
  }, [asset]);

  const handleLinkDocument = async docId => {
    try {
      const result = await technicalDocumentsAPI.linkDocumentToAsset(asset.asset_code, docId);
      if (result.success) {
        message.success('技术资料关联成功');
        setLinkModalVisible(false);
        linkForm.resetFields();
        loadDocuments();
      }
    } catch (error) {
      console.error('关联技术资料失败:', error);
      message.error('关联失败');
    }
  };

  const handleUnlinkDocument = async docId => {
    try {
      const result = await technicalDocumentsAPI.unlinkDocumentFromAsset(asset.asset_code, docId);
      if (result.success) {
        message.success('已取消关联');
        loadDocuments();
      }
    } catch (error) {
      console.error('取消关联失败:', error);
      message.error('取消关联失败');
    }
  };

  const handleDownload = async doc => {
    try {
      const response = await technicalDocumentsAPI.downloadTechnicalDocument(doc.id);
      // blob 响应直接返回 axios response 对象（拦截器对 blob 不解包）
      const blob = response?.data || response;
      if (blob instanceof Blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = doc.title || doc.file_name || 'document';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('下载失败:', error);
      message.error('下载失败');
    }
  };

  const handleUpload = async file => {
    if (!asset) return;
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('asset_code', asset.asset_code);
      formData.append('title', file.name.replace(/\.[^/.]+$/, ''));

      const result = await technicalDocumentsAPI.uploadTechnicalDocument(formData);
      if (result.success) {
        message.success('上传成功');
        loadDocuments();
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    } catch (error) {
      console.error('上传失败:', error);
      message.error('上传失败');
    } finally {
      setUploading(false);
    }
  };

  const filteredDocuments = useMemo(() => {
    let filtered = [...availableDocuments];
    if (linkFilters.keyword) {
      const kw = linkFilters.keyword.toLowerCase();
      filtered = filtered.filter(
        doc =>
          (doc.title && doc.title.toLowerCase().includes(kw)) ||
          (doc.description && doc.description.toLowerCase().includes(kw))
      );
    }
    if (linkFilters.category) {
      filtered = filtered.filter(doc => doc.category === linkFilters.category);
    }
    return filtered;
  }, [availableDocuments, linkFilters]);

  const documentColumns = [
    {
      title: '文档名称',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (text, record) => (
        <Button type="link" onClick={() => {
          setSelectedDocument(record);
          setDetailModalVisible(true);
        }}>
          {text}
        </Button>
      ),
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: cat => <Tag>{cat || '-'}</Tag>,
    },
    {
      title: '品牌/型号',
      key: 'brand_model',
      width: 150,
      render: (_, record) => (
        <span>
          {record.brand || '-'}
          {record.model && ` / ${record.model}`}
        </span>
      ),
    },
    {
      title: '上传人',
      dataIndex: 'uploaded_by',
      key: 'uploaded_by',
      width: 80,
    },
    {
      title: '上传时间',
      dataIndex: 'uploaded_at',
      key: 'uploaded_at',
      width: 150,
      render: date => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<DownloadOutlined />}
            onClick={() => handleDownload(record)}
          >
            下载
          </Button>
          <Popconfirm
            title="确定取消关联此文档?"
            onConfirm={() => handleUnlinkDocument(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger size="small" icon={<DeleteOutlined />} disabled={!canDelete}>
              取消关联
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const availableDocColumns = [
    {
      title: '文档名称',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 100,
    },
    {
      title: '品牌',
      dataIndex: 'brand',
      key: 'brand',
      width: 100,
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          icon={<LinkOutlined />}
          onClick={() => handleLinkDocument(record.id)}
        >
          关联
        </Button>
      ),
    },
  ];

  const categories = [...new Set(availableDocuments.map(d => d.category).filter(c => c))];

  return (
    <Card
      title={
        <Space>
          <FileOutlined />
          技术资料
        </Space>
      }
      extra={
        <Space orientation={isMobile ? 'vertical' : 'horizontal'} style={{ width: isMobile ? '100%' : 'auto' }}>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
            }}
          />
          <Button
            icon={<UploadOutlined />}
            onClick={() => fileInputRef.current?.click()}
            loading={uploading}
            block={isMobile}
          >
            上传资料
          </Button>
          <Button
            type="primary"
            icon={<LinkOutlined />}
            onClick={() => {
              setLinkModalVisible(true);
              loadAvailableDocuments();
            }}
            block={isMobile}
          >
            关联已有资料
          </Button>
        </Space>
      }
      style={{ marginBottom: 16 }}
    >
      <div className="hide-on-mobile">
        <Table
          columns={documentColumns}
          dataSource={documents}
          rowKey="id"
          loading={documentsLoading}
          pagination={false}
          size="small"
          scroll={{ x: 800 }}
          locale={{ emptyText: '暂无技术资料' }}
        />
      </div>
      <div className="mobile-table-cards show-on-mobile">
        {documentsLoading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>加载中...</div>
        ) : Array.isArray(documents) && documents.length > 0 ? (
          <>
            {documents.map(record => (
              <div key={record.id} className="mobile-card-item">
                <div className="mobile-card-header">
                  <span className="mobile-card-title">{record.title}</span>
                  {record.category && <Tag>{record.category}</Tag>}
                </div>
                <div className="mobile-card-body">
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">品牌/型号</span>
                    <span className="mobile-card-value">
                      {record.brand || '-'}
                      {record.model && ` / ${record.model}`}
                    </span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">上传人</span>
                    <span className="mobile-card-value">{record.uploaded_by || '-'}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">上传时间</span>
                    <span className="mobile-card-value">{dayjs(record.uploaded_at).format('YYYY-MM-DD HH:mm')}</span>
                  </div>
                </div>
                <div className="mobile-card-actions">
                  <Space orientation="vertical" style={{ width: '100%' }}>
                    <Button
                      type="primary"
                      size="small"
                      block
                      icon={<DownloadOutlined />}
                      onClick={() => handleDownload(record)}
                    >
                      下载
                    </Button>
                    <Popconfirm
                      title="确定取消关联此文档?"
                      onConfirm={() => handleUnlinkDocument(record.id)}
                      okText="确定"
                      cancelText="取消"
                    >
                      <Button type="primary" danger size="small" block icon={<DeleteOutlined />}>
                        取消关联
                      </Button>
                    </Popconfirm>
                  </Space>
                </div>
              </div>
            ))}
          </>
        ) : (
          <Empty description="暂无技术资料" />
        )}
      </div>

      <Modal
        title="关联技术资料"
        open={linkModalVisible}
        onCancel={() => {
          setLinkModalVisible(false);
          linkForm.resetFields();
          setLinkFilters({ keyword: '', category: '', brand: '', model: '' });
          setLinkDocMobilePage(1);
        }}
        footer={null}
        width={isMobile ? '95vw' : 900}
      >
        <Space orientation={isMobile ? 'vertical' : 'horizontal'} style={{ marginBottom: 16, width: isMobile ? '100%' : 'auto' }}>
          <Search
            placeholder="搜索文档名称"
            onChange={e => setLinkFilters(f => ({ ...f, keyword: e.target.value }))}
            style={{ width: isMobile ? '100%' : 200 }}
          />
          <Select
            placeholder="按分类筛选"
            allowClear
            style={{ width: isMobile ? '100%' : 150 }}
            onChange={val => setLinkFilters(f => ({ ...f, category: val }))}
          >
            {categories.map(cat => (
              <Option key={cat} value={cat}>{cat}</Option>
            ))}
          </Select>
        </Space>

        <div className="hide-on-mobile">
          <Table
            columns={availableDocColumns}
            dataSource={filteredDocuments}
            rowKey="id"
            loading={linkDocumentLoading}
            pagination={{ pageSize: 10 }}
            size="small"
            scroll={{ y: 400 }}
          />
        </div>
        <div className="mobile-table-cards show-on-mobile">
          {linkDocumentLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>加载中...</div>
          ) : Array.isArray(filteredDocuments) && filteredDocuments.length > 0 ? (
            <>
              {filteredDocuments
                .slice((linkDocMobilePage - 1) * linkDocPageSize, linkDocMobilePage * linkDocPageSize)
                .map(record => (
                  <div key={record.id} className="mobile-card-item">
                    <div className="mobile-card-header">
                      <span className="mobile-card-title">{record.title}</span>
                      {record.category && <Tag>{record.category}</Tag>}
                    </div>
                    <div className="mobile-card-body">
                      {record.brand && (
                        <div className="mobile-card-field">
                          <span className="mobile-card-label">品牌</span>
                          <span className="mobile-card-value">{record.brand}</span>
                        </div>
                      )}
                    </div>
                    <div className="mobile-card-actions">
                      <Button
                        type="primary"
                        size="small"
                        block
                        icon={<LinkOutlined />}
                        onClick={() => handleLinkDocument(record.id)}
                      >
                        关联
                      </Button>
                    </div>
                  </div>
                ))}
              {filteredDocuments.length > linkDocPageSize && (
                <div style={{ marginTop: '16px', textAlign: 'center' }}>
                  <Space>
                    <Button
                      disabled={linkDocMobilePage === 1}
                      onClick={() => setLinkDocMobilePage(p => Math.max(1, p - 1))}
                    >
                      上一页
                    </Button>
                    <span>
                      第 {linkDocMobilePage} / {Math.ceil(filteredDocuments.length / linkDocPageSize)} 页
                    </span>
                    <Button
                      disabled={linkDocMobilePage >= Math.ceil(filteredDocuments.length / linkDocPageSize)}
                      onClick={() => setLinkDocMobilePage(p => p + 1)}
                    >
                      下一页
                    </Button>
                  </Space>
                  <div style={{ marginTop: '8px', color: '#8c8c8c', fontSize: '12px' }}>
                    共 {filteredDocuments.length} 条
                  </div>
                </div>
              )}
            </>
          ) : (
            <Empty description="暂无数据" />
          )}
        </div>
      </Modal>

      <Modal
        title="技术资料详情"
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false);
          setSelectedDocument(null);
        }}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>,
          <Button
            key="download"
            type="primary"
            icon={<DownloadOutlined />}
            onClick={() => selectedDocument && handleDownload(selectedDocument)}
          >
            下载
          </Button>,
        ]}
        width={isMobile ? '95vw' : 700}
      >
        {selectedDocument && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="文档名称">{selectedDocument.title}</Descriptions.Item>
            <Descriptions.Item label="分类">{selectedDocument.category || '-'}</Descriptions.Item>
            <Descriptions.Item label="品牌">{selectedDocument.brand || '-'}</Descriptions.Item>
            <Descriptions.Item label="型号">{selectedDocument.model || '-'}</Descriptions.Item>
            <Descriptions.Item label="上传人">{selectedDocument.uploaded_by || '-'}</Descriptions.Item>
            <Descriptions.Item label="上传时间">
              {selectedDocument.uploaded_at ? dayjs(selectedDocument.uploaded_at).format('YYYY-MM-DD HH:mm') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="描述">{selectedDocument.description || '-'}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </Card>
  );
};

export default AssetDocuments;
