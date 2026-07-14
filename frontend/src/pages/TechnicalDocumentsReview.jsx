import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Input,
  Select,
  Space,
  Tag,
  message,
  Modal,
  Form,
  Descriptions,
  Tooltip,
  Empty,
} from 'antd';

import {
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { technicalDocumentsAPI } from '../utils/api';
import { useCurrentUser } from '../hooks';
import dayjs from 'dayjs';
import useIsMobile from '../hooks/useIsMobile';

const { Option } = Select;
const { TextArea } = Input;

const TechnicalDocumentsReview = () => {
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
    review_status: 'pending', // 默认显示待审核的文档
  });
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
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
      review_status: 'pending', // 默认显示待审核的文档
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
      ellipsis: false,
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
      title: '型号',
      dataIndex: 'model',
      key: 'model',
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
      title: '操作',
      key: 'action',
      width: 200,
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

          {/* 审核操作 - 只显示给系统管理员和资产管理员 */}
          {(userRole === 'system_admin' || userRole === 'asset_admin') && (
            <>
              {record.review_status === 'pending' && (
                <>
                  <Tooltip title="审核通过">
                    <Button
                      type="primary"
                      icon={<CheckCircleOutlined />}
                      onClick={() => handleReview(record, 'approved')}
                      style={{ marginRight: 8 }}
                    >
                      通过
                    </Button>
                  </Tooltip>
                  <Tooltip title="审核拒绝">
                    <Button
                      danger
                      icon={<CloseCircleOutlined />}
                      onClick={() => handleReview(record, 'rejected')}
                    >
                      拒绝
                    </Button>
                  </Tooltip>
                </>
              )}

              {/* 已审核的文档显示状态 */}
              {record.review_status === 'approved' && (
                <Tag color="success" icon={<CheckCircleOutlined />}>
                  已通过
                </Tag>
              )}

              {record.review_status === 'rejected' && (
                <Tag color="error" icon={<CloseCircleOutlined />}>
                  已拒绝
                </Tag>
              )}
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card
        title="技术资料审核管理"
        extra={
          <Space>
            <Tooltip title="只显示待审核的文档">
              <Tag color="warning" icon={<ClockCircleOutlined />}>
                待审核
              </Tag>
            </Tooltip>
          </Space>
        }
      >
        {/* 搜索栏 */}
        <Space style={{ marginBottom: 16, width: '100%' }} orientation={isMobile ? 'vertical' : 'horizontal'} wrap>
          <Input
            placeholder="搜索标题、描述、文件名"
            value={filters.keyword}
            onChange={e => setFilters(prev => ({ ...prev, keyword: e.target.value }))}
            style={{ width: isMobile ? '100%' : 200 }}
            allowClear
            onPressEnter={handleSearch}
          />
          <Select
            placeholder="分类"
            value={filters.category || undefined}
            onChange={value => setFilters(prev => ({ ...prev, category: value }))}
            style={{ width: isMobile ? '100%' : 150 }}
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
            placeholder="资产类型"
            value={filters.asset_type || undefined}
            onChange={value => setFilters(prev => ({ ...prev, asset_type: value }))}
            style={{ width: isMobile ? '100%' : 150 }}
            allowClear
          >
            <Option value="医疗设备">医疗设备</Option>
            <Option value="普通设备">普通设备</Option>
            <Option value="房产建筑">房产建筑</Option>
            <Option value="办公家具">办公家具</Option>
            <Option value="其他">其他</Option>
          </Select>
          <Select
            placeholder="审核状态"
            value={filters.review_status}
            onChange={value => setFilters(prev => ({ ...prev, review_status: value }))}
            style={{ width: isMobile ? '100%' : 120 }}
          >
            <Option value="pending">待审核</Option>
            <Option value="approved">已通过</Option>
            <Option value="rejected">已拒绝</Option>
          </Select>
          <Button icon={<SearchOutlined />} onClick={handleSearch} block={isMobile}>
            搜索
          </Button>
          <Button icon={<ReloadOutlined />} onClick={handleReset} block={isMobile}>
            重置
          </Button>
        </Space>

        {/* 桌面端表格 */}
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

        {/* 移动端卡片列表 */}
        <div className="mobile-table-cards show-on-mobile">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>加载中...</div>
          ) : Array.isArray(documents) && documents.length > 0 ? (
            <>
              {documents.map(record => {
                const reviewTag = record.review_status === 'approved' ? (
                  <Tag color="success" icon={<CheckCircleOutlined />}>已通过</Tag>
                ) : record.review_status === 'rejected' ? (
                  <Tag color="error" icon={<CloseCircleOutlined />}>已拒绝</Tag>
                ) : (
                  <Tag color="warning" icon={<ClockCircleOutlined />}>待审核</Tag>
                );
                return (
                  <div key={record.id} className="mobile-card-item">
                    <div className="mobile-card-header">
                      <span className="mobile-card-title">{record.title || '-'}</span>
                      {reviewTag}
                    </div>
                    <div className="mobile-card-body">
                      <div className="mobile-card-field mobile-card-field--full">
                        <span className="mobile-card-label">文件名</span>
                        <span className="mobile-card-value">{record.file_name || '-'}</span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">分类</span>
                        <span className="mobile-card-value">{record.category || '-'}</span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">资产类型</span>
                        <span className="mobile-card-value">{record.asset_type || '-'}</span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">品牌</span>
                        <span className="mobile-card-value">{record.brand || '-'}</span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">型号</span>
                        <span className="mobile-card-value">{record.model || '-'}</span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">文件大小</span>
                        <span className="mobile-card-value">{formatFileSize(record.file_size)}</span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">上传来源</span>
                        <span className="mobile-card-value"><Tag color={record.upload_source === '内部上传' ? 'blue' : 'green'}>{record.upload_source}</Tag></span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">上传人</span>
                        <span className="mobile-card-value">{record.uploaded_by || '-'}</span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">上传日期</span>
                        <span className="mobile-card-value">{record.upload_date ? dayjs(record.upload_date).format('YYYY-MM-DD HH:mm') : '-'}</span>
                      </div>
                    </div>
                    <div className="mobile-card-actions">
                      <Button
                        type="primary"
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => handleViewDetail(record.id)}
                        block
                      >
                        详情
                      </Button>
                      {(userRole === 'system_admin' || userRole === 'asset_admin') && record.review_status === 'pending' && (
                        <>
                          <Button
                            type="primary"
                            size="small"
                            icon={<CheckCircleOutlined />}
                            onClick={() => handleReview(record, 'approved')}
                            block
                          >
                            通过
                          </Button>
                          <Button
                            type="primary"
                            danger
                            size="small"
                            icon={<CloseCircleOutlined />}
                            onClick={() => handleReview(record, 'rejected')}
                            block
                          >
                            拒绝
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
              {/* 移动端分页 */}
              <div style={{ marginTop: '16px', textAlign: 'center' }}>
                <Space>
                  <Button disabled={pagination.current === 1} onClick={() => setPagination(prev => ({ ...prev, current: prev.current - 1 }))}>
                    上一页
                  </Button>
                  <span>
                    第 {pagination.current} / {Math.ceil(pagination.total / pagination.pageSize) || 1} 页
                  </span>
                  <Button
                    disabled={pagination.current >= Math.ceil(pagination.total / pagination.pageSize)}
                    onClick={() => setPagination(prev => ({ ...prev, current: prev.current + 1 }))}
                  >
                    下一页
                  </Button>
                </Space>
                <div style={{ marginTop: '8px', color: '#8c8c8c', fontSize: '12px' }}>
                  共 {pagination.total} 条
                </div>
              </div>
            </>
          ) : (
            <Empty description="暂无数据" />
          )}
        </div>
      </Card>

      {/* 详情模态框 */}
      <Modal
        title="技术资料详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>,
        ]}
        width={isMobile ? '95vw' : 800}
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
          </Descriptions>
        )}
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
        width={isMobile ? '95vw' : 600}
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

export default TechnicalDocumentsReview;
