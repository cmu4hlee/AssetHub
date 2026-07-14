import React, { useState, useEffect } from 'react';

import {
  Form, Input, Select, Button, Table, Tag, Space, Modal, DatePicker, InputNumber, message,
  Popconfirm, Row, Col, Statistic, Drawer, Tooltip, Empty, Descriptions, Pagination, Card, Divider, Tabs, Badge, Progress, Alert, Tree, Upload, Cascader, AutoComplete, ConfigProvider, Result, Skeleton, Spin, Switch, Slider, Radio, Checkbox, Mentions, Rate, TimePicker, Timeline, Transfer, Anchor, Affix, BackTop, Breadcrumb, Steps, Calendar, Carousel, Collapse, Image, Layout, List, Menu, TreeSelect, Typography, Popover, Avatar, Badge as AntBadge, Segmented, Watermark, Tour, Flex,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  DownloadOutlined,
  ShareAltOutlined,
  FileOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { technicalDocumentsAPI } from '../utils/api';
import auth from '../utils/auth';
import dayjs from 'dayjs';
import { useCan, useCurrentUser } from '../hooks';
import useIsMobile from '../hooks/useIsMobile';

const { Option } = Select;
const { TextArea } = Input;

const TechnicalDocumentsList = () => {
  const canDelete = useCan('asset', 'delete');
  const canEdit = useCan('asset', 'edit');
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState([]);
  const { user } = useCurrentUser();
  const userRole = user?.role || '';
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });
  const [filters, setFilters] = useState({
    keyword: '',
    category: '',
    asset_type: '',
    brand: '',
    status: 'active',
    review_status: '', // 审核状态筛选
  });
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [shareForm] = Form.useForm();
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editForm] = Form.useForm();
  const [editingDocument, setEditingDocument] = useState(null);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [reviewForm] = Form.useForm();
  const [reviewingDocument, setReviewingDocument] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(false);

  // 加载分类列表
  useEffect(() => {
    const loadCategories = async () => {
      try {
        setLoadingCategories(true);
        const result = await technicalDocumentsAPI.getCategories();
        if (result.success && result.data) {
          setCategories(result.data);
        }
      } catch (error) {
        console.error('加载分类失败:', error);
      } finally {
        setLoadingCategories(false);
      }
    };
    loadCategories();
  }, []);

  useEffect(() => {
    loadData();
  }, [pagination.current, pagination.pageSize, filters]);

  const loadData = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.current,
        pageSize: pagination.pageSize,
        ...filters,
      };
      const result = await technicalDocumentsAPI.getTechnicalDocuments(params);
      if (result.success) {
        setDocuments(result.data);
        setPagination(prev => ({
          ...prev,
          total: result.pagination.total,
        }));
      }
    } catch (error) {
      console.error('加载技术资料列表失败:', error);
      message.error('加载技术资料列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, current: 1 }));
    loadData();
  };

  const handleReset = () => {
    setFilters({
      keyword: '',
      category: '',
      asset_type: '',
      brand: '',
      status: 'active',
      review_status: '',
    });
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const handleReview = (record, status) => {
    setReviewingDocument({ ...record, reviewAction: status });
    reviewForm.setFieldsValue({
      review_status: status,
      review_comment: '',
    });
    setReviewModalVisible(true);
  };

  const handleReviewSubmit = async () => {
    try {
      const values = await reviewForm.validateFields();
      const result = await technicalDocumentsAPI.reviewTechnicalDocument(
        reviewingDocument.id,
        values
      );
      if (result.success) {
        message.success(result.message);
        setReviewModalVisible(false);
        reviewForm.resetFields();
        setReviewingDocument(null);
        loadData();
      }
    } catch (error) {
      console.error('审核失败:', error);
      if (error.errorFields) {
        return; // 表单验证错误
      }
      message.error(error.response?.data?.message || '审核失败');
    }
  };

  const handleDelete = async id => {
    try {
      const result = await technicalDocumentsAPI.deleteTechnicalDocument(id);
      if (result.success) {
        message.success('删除成功');
        loadData();
      }
    } catch (error) {
      console.error('删除失败:', error);
      message.error('删除失败');
    }
  };

  const handleDownload = async (id, fileName) => {
    try {
      const token = auth.getToken();
      if (!token) {
        message.error('请先登录');
        return;
      }
      const tenantId = auth.getEffectiveTenantId();
      const headers = { Authorization: `Bearer ${token}` };
      if (tenantId) headers['X-Tenant-ID'] = tenantId;

      const response = await fetch(`/api/technical-documents/${id}/file`, {
        method: 'GET',
        headers,
      });

      // 206 (Partial Content) 也是成功状态，用于范围请求
      if (!response.ok && response.status !== 206) {
        if (response.status === 401) {
          message.error('认证失败，请重新登录');
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
          return;
        }
        const errorData = await response.json().catch(() => ({ message: '下载失败' }));
        throw new Error(errorData.message || `下载失败: ${response.status}`);
      }

      const blob = await response.blob();
      if (!blob || blob.size === 0) {
        throw new Error('下载的文件为空');
      }

      // 从响应头获取文件名
      const contentDisposition = response.headers.get('Content-Disposition');
      let finalFileName = fileName;
      if (contentDisposition) {
        const fileNameMatch =
          contentDisposition.match(/filename\*=UTF-8''(.+)/i) ||
          contentDisposition.match(/filename="(.+)"/i);
        if (fileNameMatch) {
          finalFileName = decodeURIComponent(fileNameMatch[1]);
        }
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = finalFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      message.success('下载成功');
    } catch (error) {
      console.error('下载失败:', error);
      message.error(error.message || '下载失败');
    }
  };

  const handleViewDetail = async id => {
    try {
      const result = await technicalDocumentsAPI.getTechnicalDocument(id);
      if (result.success) {
        setSelectedDocument(result.data);
        setDetailModalVisible(true);
      }
    } catch (error) {
      console.error('获取详情失败:', error);
      message.error('获取详情失败');
    }
  };

  const handleEdit = record => {
    setEditingDocument(record);
    editForm.setFieldsValue({
      title: record.title,
      brand: record.brand || '',
      model: record.model || '',
      category: record.category || '',
      asset_type: record.asset_type || '',
    });
    setEditModalVisible(true);
  };

  const handleUpdate = async () => {
    try {
      const values = await editForm.validateFields();
      if (!editingDocument) return;

      console.log('[前端] 准备更新技术资料:', {
        id: editingDocument.id,
        values,
      });

      // 处理空字符串：将空字符串转换为 null 或 undefined，让后端处理
      const updateData = {
        title: values.title,
        brand: values.brand || null,
        model: values.model || null,
        category: values.category || null,
        asset_type: values.asset_type || null,
      };

      console.log('[前端] 发送更新数据:', updateData);

      const result = await technicalDocumentsAPI.updateTechnicalDocument(
        editingDocument.id,
        updateData
      );
      if (result.success) {
        message.success('更新成功');
        setEditModalVisible(false);
        editForm.resetFields();
        setEditingDocument(null);
        loadData();
      }
    } catch (error) {
      console.error('[前端] 更新失败:', error);
      if (error.errorFields) {
        return; // 表单验证错误
      }
      const errorMessage = error.response?.data?.message || error.message || '更新失败';
      const errorDetail = error.response?.data?.error;
      console.error('[前端] 错误详情:', {
        message: errorMessage,
        error: errorDetail,
        code: error.response?.data?.code,
        sqlState: error.response?.data?.sqlState,
      });
      message.error(errorDetail ? `${errorMessage}: ${errorDetail}` : errorMessage);
    }
  };

  const handleCreateShare = async id => {
    try {
      const values = await shareForm.validateFields();

      // 权限检查
      if (userRole !== 'system_admin' && userRole !== 'asset_admin') {
        message.error('权限不足，只有系统管理员和资产管理员可以创建分享链接');
        return;
      }

      const result = await technicalDocumentsAPI.createShareLink(id, values);
      if (result.success) {
        message.success('分享链接创建成功');
        setShareModalVisible(false);
        shareForm.resetFields();
        // 显示分享链接
        Modal.info({
          title: '分享链接已创建',
          width: 700,
          content: (
            <div>
              <p style={{ marginBottom: 8 }}>
                <strong>供应商信息：</strong>
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
                提示：请将此链接发送给供应商，供应商可以通过此链接上传技术资料。
              </p>
            </div>
          ),
        });
      }
    } catch (error) {
      console.error('创建分享链接失败:', error);
      if (error.errorFields) {
        return; // 表单验证错误
      }
      if (error.response?.status === 403) {
        message.error('权限不足，只有系统管理员和资产管理员可以创建分享链接');
      } else {
        message.error(error.response?.data?.message || '创建分享链接失败');
      }
    }
  };

  const formatFileSize = bytes => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const columns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 300,
      ellipsis: false, // 允许换行显示完整标题
      render: (text, record) => (
        <Button
          type="link"
          onClick={() => handleViewDetail(record.id)}
          style={{
            padding: 0,
            height: 'auto',
            whiteSpace: 'normal',
            wordBreak: 'break-word',
            textAlign: 'left',
            lineHeight: '1.5',
          }}
        >
          {text || '-'}
        </Button>
      ),
    },
    {
      title: '文件名',
      dataIndex: 'file_name',
      key: 'file_name',
      ellipsis: true,
      render: text => (
        <Space>
          <FileOutlined />
          <span>{text}</span>
        </Space>
      ),
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: text => text || '-',
    },
    {
      title: '资产类型',
      dataIndex: 'asset_type',
      key: 'asset_type',
      width: 120,
      render: text => text || '-',
    },
    {
      title: '品牌',
      dataIndex: 'brand',
      key: 'brand',
      width: 100,
      render: text => text || '-',
    },
    {
      title: '文件大小',
      dataIndex: 'file_size',
      key: 'file_size',
      width: 100,
      render: size => formatFileSize(size),
    },
    {
      title: '上传来源',
      dataIndex: 'upload_source',
      key: 'upload_source',
      width: 100,
      render: source => <Tag color={source === '内部上传' ? 'blue' : 'green'}>{source}</Tag>,
    },
    {
      title: '上传人',
      dataIndex: 'uploaded_by',
      key: 'uploaded_by',
      width: 100,
    },
    {
      title: '上传日期',
      dataIndex: 'upload_date',
      key: 'upload_date',
      width: 180,
      render: date => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '下载次数',
      dataIndex: 'download_count',
      key: 'download_count',
      width: 100,
      align: 'center',
    },
    {
      title: '审核状态',
      dataIndex: 'review_status',
      key: 'review_status',
      width: 120,
      render: status => {
        if (status === 'approved') {
          return (
            <Tag color="success" icon={<CheckCircleOutlined />}>
              已通过
            </Tag>
          );
        } else if (status === 'rejected') {
          return (
            <Tag color="error" icon={<CloseCircleOutlined />}>
              已拒绝
            </Tag>
          );
        } else {
          return (
            <Tag color="warning" icon={<ClockCircleOutlined />}>
              待审核
            </Tag>
          );
        }
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 250,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Tooltip title="查看详情">
            <Button
              type="link"
              icon={<EyeOutlined />}
              onClick={() => handleViewDetail(record.id)}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          </Tooltip>
          <Tooltip title="下载">
            <Button
              type="link"
              icon={<DownloadOutlined />}
              onClick={() => handleDownload(record.id, record.file_name)}
            />
          </Tooltip>
          {/* 只有系统管理员和资产管理员可以创建分享链接 */}
          {(userRole === 'system_admin' || userRole === 'asset_admin') && (
            <Tooltip title="分享">
              <Button
                type="link"
                icon={<ShareAltOutlined />}
                onClick={() => {
                  setSelectedDocument(record);
                  setShareModalVisible(true);
                }}
              />
            </Tooltip>
          )}
          {/* 只有系统管理员和资产管理员可以审核 */}
          {(userRole === 'system_admin' || userRole === 'asset_admin') && (
            <>
              {record.review_status === 'pending' && (
                <>
                  <Tooltip title="审核通过">
                    <Button
                      type="link"
                      style={{ color: '#52c41a' }}
                      icon={<CheckCircleOutlined />}
                      onClick={() => handleReview(record, 'approved')}
                    />
                  </Tooltip>
                  <Tooltip title="审核拒绝">
                    <Button
                      type="link"
                      danger
                      icon={<CloseCircleOutlined />}
                      onClick={() => handleReview(record, 'rejected')}
                    />
                  </Tooltip>
                </>
              )}
              {/* 已审核的文档显示审核状态详情 */}
              {(record.review_status === 'approved' || record.review_status === 'rejected') && (
                <Tooltip
                  title={`${record.review_status === 'approved' ? '已通过' : '已拒绝'} 由 ${record.reviewed_by || '系统'} 于 ${record.reviewed_at ? dayjs(record.reviewed_at).format('YYYY-MM-DD HH:mm') : '未知时间'} 审核`}
                >
                  <span style={{ color: '#999', fontSize: '12px' }}>
                    {record.review_status === 'approved' ? '已通过' : '已拒绝'}
                  </span>
                </Tooltip>
              )}
            </>
          )}
          {/* 只有系统管理员可以删除技术资料 */}
          {userRole === 'system_admin' && (
            <Popconfirm
              title="确定要删除这个技术资料吗？"
              onConfirm={() => handleDelete(record.id)} disabled={!canDelete}
              okText="确定"
              cancelText="取消"
            >
              <Tooltip title="删除">
                <Button type="link" danger icon={<DeleteOutlined />} disabled={!canDelete} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card
        title="技术资料管理"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => (window.location.href = '/technical-documents/upload')}
          >
            上传资料
          </Button>
        }
      >
        {/* 搜索栏 */}
        <Space style={{ marginBottom: 16 }} wrap>
          <Input
            placeholder="搜索标题、描述、文件名"
            value={filters.keyword}
            onChange={e => setFilters(prev => ({ ...prev, keyword: e.target.value }))}
            style={{ width: 200 }}
            allowClear
            onPressEnter={handleSearch}
          />
          <Select
            placeholder="分类"
            value={filters.category || undefined}
            onChange={value => setFilters(prev => ({ ...prev, category: value }))}
            style={{ width: 150 }}
            allowClear
            loading={loadingCategories}
          >
            {categories.map(cat => (
              <Option key={cat} value={cat}>{cat}</Option>
            ))}
            <Option value="使用手册">使用手册</Option>
            <Option value="维修手册">维修手册</Option>
            <Option value="技术规范">技术规范</Option>
            <Option value="操作指南">操作指南</Option>
            <Option value="其他">其他</Option>
          </Select>
          <Select
            placeholder="状态"
            value={filters.status}
            onChange={value => setFilters(prev => ({ ...prev, status: value }))}
            style={{ width: 120 }}
          >
            <Option value="active">启用</Option>
            <Option value="archived">已归档</Option>
            <Option value="deleted">已删除</Option>
          </Select>
          <Select
            placeholder="审核状态"
            value={filters.review_status || undefined}
            onChange={value => setFilters(prev => ({ ...prev, review_status: value }))}
            style={{ width: 120 }}
            allowClear
          >
            <Option value="pending">待审核</Option>
            <Option value="approved">已通过</Option>
            <Option value="rejected">已拒绝</Option>
          </Select>
          <Button icon={<SearchOutlined />} onClick={handleSearch}>
            搜索
          </Button>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>
            重置
          </Button>
        </Space>

        {/* 表格 */}
        <div className="hide-on-mobile">
          <Table
            columns={columns}
            dataSource={documents}
            rowKey="id"
            loading={loading}
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: pagination.total,
              showSizeChanger: true,
              showTotal: total => `共 ${total} 条`,
              onChange: (page, pageSize) => {
                setPagination(prev => ({ ...prev, current: page, pageSize }));
              },
            }}
            scroll={{ x: 1500 }}
            components={{
              body: {
                cell: props => {
                  // 允许单元格内容换行，特别是标题列
                  const isTitleCell = props.children?.props?.onClick !== undefined;
                  return (
                    <td
                      {...props}
                      style={{
                        ...props.style,
                        whiteSpace: isTitleCell ? 'normal' : props.style?.whiteSpace || 'nowrap',
                        wordBreak: isTitleCell ? 'break-word' : 'normal',
                        verticalAlign: 'top',
                      }}
                    />
                  );
                },
              },
            }}
          />
        </div>
        <div className="mobile-table-cards show-on-mobile">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>加载中...</div>
          ) : Array.isArray(documents) && documents.length > 0 ? (
            documents.map(record => (
              <div key={record.id} className="mobile-card-item">
                <div className="mobile-card-header">
                  <span className="mobile-card-title">{record.title}</span>
                  {record.review_status === 'approved' ? (
                    <Tag color="success">已通过</Tag>
                  ) : record.review_status === 'rejected' ? (
                    <Tag color="error">已拒绝</Tag>
                  ) : (
                    <Tag color="warning">待审核</Tag>
                  )}
                </div>
                <div className="mobile-card-body">
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">文件名</span>
                    <span className="mobile-card-value">{record.file_name || '-'}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">分类</span>
                    <span className="mobile-card-value">{record.category || '-'}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">上传日期</span>
                    <span className="mobile-card-value">
                      {record.upload_date ? dayjs(record.upload_date).format('YYYY-MM-DD') : '-'}
                    </span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">上传人</span>
                    <span className="mobile-card-value">{record.uploaded_by || '-'}</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>暂无数据</div>
          )}
        </div>
      </Card>

      {/* 详情模态框 */}
      <Modal
        title="技术资料详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button
            key="download"
            type="primary"
            icon={<DownloadOutlined />}
            onClick={() => {
              if (selectedDocument) {
                handleDownload(selectedDocument.id, selectedDocument.file_name);
              }
            }}
          >
            下载
          </Button>,
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>,
        ]}
        width={800}
      >
        {selectedDocument && (
          <Descriptions column={2} bordered>
            <Descriptions.Item label="标题" span={2}>
              {selectedDocument.title}
            </Descriptions.Item>
            <Descriptions.Item label="描述" span={2}>
              {selectedDocument.description || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="文件名">{selectedDocument.file_name}</Descriptions.Item>
            <Descriptions.Item label="文件大小">
              {formatFileSize(selectedDocument.file_size)}
            </Descriptions.Item>
            <Descriptions.Item label="分类">{selectedDocument.category || '-'}</Descriptions.Item>
            <Descriptions.Item label="资产类型">
              {selectedDocument.asset_type || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="品牌">{selectedDocument.brand || '-'}</Descriptions.Item>
            <Descriptions.Item label="型号">{selectedDocument.model || '-'}</Descriptions.Item>
            <Descriptions.Item label="版本">{selectedDocument.version || '-'}</Descriptions.Item>
            <Descriptions.Item label="语言">{selectedDocument.language || '-'}</Descriptions.Item>
            <Descriptions.Item label="上传来源">
              <Tag color={selectedDocument.upload_source === '内部上传' ? 'blue' : 'green'}>
                {selectedDocument.upload_source}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="上传人">{selectedDocument.uploaded_by}</Descriptions.Item>
            <Descriptions.Item label="上传日期">
              {dayjs(selectedDocument.upload_date).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="下载次数">
              {selectedDocument.download_count || 0}
            </Descriptions.Item>
            <Descriptions.Item label="查看次数">
              {selectedDocument.view_count || 0}
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={selectedDocument.status === 'active' ? 'green' : 'default'}>
                {selectedDocument.status === 'active'
                  ? '启用'
                  : selectedDocument.status === 'archived'
                    ? '已归档'
                    : '已删除'}
              </Tag>
            </Descriptions.Item>
            {/* 显示审核信息 */}
            <Descriptions.Item label="审核状态">
              {selectedDocument.review_status === 'approved' ? (
                <Tag color="success" icon={<CheckCircleOutlined />}>
                  已通过
                </Tag>
              ) : selectedDocument.review_status === 'rejected' ? (
                <Tag color="error" icon={<CloseCircleOutlined />}>
                  已拒绝
                </Tag>
              ) : (
                <Tag color="warning" icon={<ClockCircleOutlined />}>
                  待审核
                </Tag>
              )}
            </Descriptions.Item>
            {selectedDocument.reviewed_at && (
              <Descriptions.Item label="审核时间">
                {dayjs(selectedDocument.reviewed_at).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
            )}
            {selectedDocument.reviewed_by && (
              <Descriptions.Item label="审核人">{selectedDocument.reviewed_by}</Descriptions.Item>
            )}
            {selectedDocument.review_comment && (
              <Descriptions.Item label="审核意见" span={2}>
                {selectedDocument.review_comment}
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>

      {/* 分享链接模态框 */}
      <Modal
        title="创建分享链接（给供应商）"
        open={shareModalVisible}
        onCancel={() => {
          setShareModalVisible(false);
          shareForm.resetFields();
        }}
        onOk={() => {
          if (selectedDocument) {
            handleCreateShare(selectedDocument.id);
          }
        }}
        width={600}
      >
        <Form
          form={shareForm}
          layout="vertical"
          initialValues={{ expires_days: 7, max_uploads: 1 }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="expires_days"
                label="有效期（天）"
                rules={[{ required: true, message: '请输入有效期' }]}
              >
                <InputNumber min={1} max={365} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="max_uploads"
                label="最大上传次数"
                rules={[{ required: true, message: '请输入最大上传次数' }]}
              >
                <InputNumber min={1} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="supplier_name"
            label="供应商名称"
            rules={[{ required: true, message: '请输入供应商名称' }]}
          >
            <Input placeholder="例如：XX设备有限公司" />
          </Form.Item>
          <Form.Item name="supplier_contact" label="供应商联系方式">
            <Input placeholder="可选：联系人姓名、电话、邮箱等" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <TextArea rows={3} placeholder="可选：其他备注信息" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑模态框 */}
      <Modal
        title="编辑技术资料"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          editForm.resetFields();
          setEditingDocument(null);
        }}
        onOk={handleUpdate}
        width={600}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item
            name="title"
            label="资料名称"
            rules={[{ required: true, message: '请输入资料名称' }]}
          >
            <Input placeholder="请输入资料名称" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="brand" label="品牌">
                <Input placeholder="例如：西门子" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="model" label="型号">
                <Input placeholder="例如：CT-XXX" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="category" label="分类">
                <Select placeholder="选择分类" allowClear showSearch>
                  {categories.map(cat => (
                    <Option key={cat} value={cat}>{cat}</Option>
                  ))}
                  <Option value="使用手册">使用手册</Option>
                  <Option value="维修手册">维修手册</Option>
                  <Option value="技术规范">技术规范</Option>
                  <Option value="操作指南">操作指南</Option>
                  <Option value="其他">其他</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="asset_type" label="资产类型">
                <Select placeholder="选择资产类型" allowClear>
                  <Option value="医疗设备">医疗设备</Option>
                  <Option value="普通设备">普通设备</Option>
                  <Option value="房产建筑">房产建筑</Option>
                  <Option value="办公家具">办公家具</Option>
                  <Option value="其他">其他</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* 审核模态框 */}
      <Modal
        title={reviewingDocument?.reviewAction === 'approved' ? '审核通过' : '审核拒绝'}
        open={reviewModalVisible}
        onCancel={() => {
          setReviewModalVisible(false);
          reviewForm.resetFields();
          setReviewingDocument(null);
        }}
        onOk={handleReviewSubmit}
        width={600}
      >
        {reviewingDocument && (
          <>
            <div
              style={{ marginBottom: 16, padding: 12, backgroundColor: '#f5f5f5', borderRadius: 4 }}
            >
              <p style={{ margin: 0 }}>
                <strong>资料标题：</strong>
                {reviewingDocument.title}
              </p>
              <p style={{ margin: '8px 0 0 0' }}>
                <strong>文件名：</strong>
                {reviewingDocument.file_name}
              </p>
            </div>
            <Form form={reviewForm} layout="vertical">
              <Form.Item
                name="review_status"
                label="审核结果"
                rules={[{ required: true, message: '请选择审核结果' }]}
              >
                <Select disabled>
                  <Option value="approved">通过</Option>
                  <Option value="rejected">拒绝</Option>
                </Select>
              </Form.Item>
              <Form.Item
                name="review_comment"
                label="审核意见"
                rules={[
                  {
                    required: reviewingDocument?.reviewAction === 'rejected',
                    message: '拒绝时必须填写审核意见',
                  },
                ]}
              >
                <TextArea
                  rows={4}
                  placeholder={
                    reviewingDocument?.reviewAction === 'rejected'
                      ? '请填写拒绝原因（必填）'
                      : '可选：填写审核意见'
                  }
                />
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>
    </div>
  );
};

export default TechnicalDocumentsList;
