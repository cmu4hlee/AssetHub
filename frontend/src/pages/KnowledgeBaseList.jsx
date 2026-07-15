/**
 * 知识库管理页
 *
 * 功能:
 * - 知识库列表 / 新建 / 编辑 / 删除
 * - 文档上传(支持 PDF / DOCX / TXT / MD)
 * - 文档解析状态展示
 * - 重新解析 / 删除
 * - 知识库设置
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card, Button, Table, Tag, Space, Modal, Form, Input, Select, message, Popconfirm,
  Row, Col, Statistic, Drawer, Empty, Tooltip, Upload, Tabs, Alert, Skeleton, Switch, InputNumber, Divider,
  Descriptions,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, BookOutlined,
  FileTextOutlined, CloudUploadOutlined, InboxOutlined, SettingOutlined,
  CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined, EyeOutlined,
} from '@ant-design/icons';
import { knowledgeBaseAPI } from '../api/domains/knowledgeBase';

const { Dragger } = Upload;
const { TextArea } = Input;

const PARSE_STATUS = {
  pending: { text: '待解析', color: 'default' },
  parsing: { text: '解析中', color: 'processing', icon: <LoadingOutlined /> },
  ready: { text: '已就绪', color: 'success', icon: <CheckCircleOutlined /> },
  failed: { text: '解析失败', color: 'error', icon: <CloseCircleOutlined /> },
};

const SCOPE_OPTIONS = [
  { value: 'general', label: '通用' },
  { value: 'asset', label: '资产管理' },
  { value: 'maintenance', label: '维修维护' },
  { value: 'sop', label: 'SOP 规范' },
  { value: 'policy', label: '制度规范' },
];

const KnowledgeBaseList = () => {
  const [loading, setLoading] = useState(false);
  const [kbs, setKbs] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [filters, setFilters] = useState({ keyword: '', status: 'active' });

  const [kbForm] = Form.useForm();
  const [kbModalOpen, setKbModalOpen] = useState(false);
  const [editingKb, setEditingKb] = useState(null);

  const [activeKb, setActiveKb] = useState(null); // 当前选中的知识库
  const [docs, setDocs] = useState([]);
  const [docLoading, setDocLoading] = useState(false);
  const [docPagination, setDocPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [docFilters, setDocFilters] = useState({ keyword: '', parse_status: '' });
  const [docDetail, setDocDetail] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsForm] = Form.useForm();

  // ============= 知识库 =============

  const loadKbs = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const result = await knowledgeBaseAPI.listKnowledgeBases({
        page, pageSize: pagination.pageSize, ...filters,
      });
      if (result.success) {
        setKbs(result.data || []);
        setPagination(p => ({ ...p, current: page, total: result.pagination?.total || 0 }));
      } else {
        message.error(result.message || '加载知识库失败');
      }
    } catch (e) {
      message.error('加载知识库失败: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.pageSize]);

  useEffect(() => {
    loadKbs(1);
  }, [filters]); // eslint-disable-line

  const handleCreateKb = () => {
    setEditingKb(null);
    kbForm.resetFields();
    kbForm.setFieldsValue({ scope: 'general', icon: 'book', sort_order: 0, status: 'active' });
    setKbModalOpen(true);
  };

  const handleEditKb = record => {
    setEditingKb(record);
    kbForm.setFieldsValue(record);
    setKbModalOpen(true);
  };

  const handleSubmitKb = async () => {
    try {
      const values = await kbForm.validateFields();
      if (editingKb) {
        await knowledgeBaseAPI.updateKnowledgeBase(editingKb.id, values);
        message.success('更新成功');
      } else {
        await knowledgeBaseAPI.createKnowledgeBase(values);
        message.success('创建成功');
      }
      setKbModalOpen(false);
      loadKbs(pagination.current);
    } catch (e) {
      if (e.errorFields) return;
      message.error((e.response?.data?.message) || e.message || '操作失败');
    }
  };

  const handleDeleteKb = async id => {
    try {
      await knowledgeBaseAPI.deleteKnowledgeBase(id);
      message.success('已归档');
      if (activeKb?.id === id) setActiveKb(null);
      loadKbs(pagination.current);
    } catch (e) {
      message.error('删除失败: ' + (e.response?.data?.message || e.message));
    }
  };

  // ============= 文档 =============

  const loadDocs = useCallback(async (page = 1) => {
    if (!activeKb) {
      setDocs([]);
      return;
    }
    setDocLoading(true);
    try {
      const result = await knowledgeBaseAPI.listDocuments({
        page, pageSize: docPagination.pageSize, kb_id: activeKb.id, ...docFilters,
      });
      if (result.success) {
        setDocs(result.data || []);
        setDocPagination(p => ({ ...p, current: page, total: result.pagination?.total || 0 }));
      }
    } catch (e) {
      message.error('加载文档失败: ' + e.message);
    } finally {
      setDocLoading(false);
    }
  }, [activeKb, docFilters, docPagination.pageSize]);

  useEffect(() => {
    loadDocs(1);
  }, [activeKb, docFilters]); // eslint-disable-line

  const handleReupload = () => {
    loadDocs(1);
  };

  const handleReparse = async id => {
    const hide = message.loading('正在重新解析...', 0);
    try {
      await knowledgeBaseAPI.reparseDocument(id);
      message.success('解析完成');
      loadDocs(docPagination.current);
      loadKbs(pagination.current);
    } catch (e) {
      message.error('解析失败: ' + (e.response?.data?.message || e.message));
    } finally {
      hide();
    }
  };

  const handleDeleteDoc = async id => {
    try {
      await knowledgeBaseAPI.deleteDocument(id);
      message.success('已删除');
      loadDocs(docPagination.current);
      loadKbs(pagination.current);
    } catch (e) {
      message.error('删除失败: ' + (e.response?.data?.message || e.message));
    }
  };

  const handleViewDoc = async id => {
    try {
      const result = await knowledgeBaseAPI.getDocument(id);
      if (result.success) {
        setDocDetail(result.data);
        setDetailOpen(true);
      }
    } catch (e) {
      message.error('加载详情失败');
    }
  };

  const handleDownloadDoc = async id => {
    try {
      const response = await knowledgeBaseAPI.downloadDocument(id);
      const blob = response.data instanceof Blob ? response.data : new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = docDetail?.file_name || `doc-${id}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (e) {
      message.error('下载失败');
    }
  };

  // ============= 设置 =============

  const openSettings = async () => {
    setSettingsOpen(true);
    setSettingsLoading(true);
    try {
      const result = await knowledgeBaseAPI.getSettings();
      if (result.success) {
        setSettings(result.data);
        settingsForm.setFieldsValue({
          chunk_size: result.data.chunk_size,
          chunk_overlap: result.data.chunk_overlap,
          top_k: result.data.top_k,
          min_score: Number(result.data.min_score),
          ai_enabled: !!result.data.ai_enabled,
          ai_provider: result.data.ai_provider,
          ai_model: result.data.ai_model,
          max_context_chars: result.data.max_context_chars,
          system_prompt: result.data.system_prompt,
        });
      }
    } catch (e) {
      message.error('加载设置失败');
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      const values = await settingsForm.validateFields();
      await knowledgeBaseAPI.updateSettings(values);
      message.success('设置已保存');
      setSettingsOpen(false);
    } catch (e) {
      if (e.errorFields) return;
      message.error('保存失败: ' + (e.response?.data?.message || e.message));
    }
  };

  // ============= 渲染 =============

  const kbColumns = [
    {
      title: '名称', dataIndex: 'kb_name', key: 'kb_name',
      render: (text, record) => (
        <a onClick={() => setActiveKb(record)}>
          <BookOutlined style={{ marginRight: 6, color: '#1890ff' }} />
          {text}
        </a>
      ),
    },
    { title: '编码', dataIndex: 'kb_code', key: 'kb_code', width: 140 },
    {
      title: '用途', dataIndex: 'scope', key: 'scope', width: 110,
      render: v => {
        const opt = SCOPE_OPTIONS.find(o => o.value === v);
        return opt ? <Tag>{opt.label}</Tag> : <Tag>{v}</Tag>;
      },
    },
    { title: '文档', dataIndex: 'doc_count', key: 'doc_count', width: 80, align: 'center' },
    { title: '分块', dataIndex: 'chunk_count', key: 'chunk_count', width: 80, align: 'center' },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: v => v === 'active' ? <Tag color="green">启用</Tag> : <Tag>已归档</Tag>,
    },
    {
      title: '操作', key: 'actions', width: 200,
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<FileTextOutlined />} onClick={() => setActiveKb(record)}>
            文档
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditKb(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确认归档该知识库?"
            description="归档后不可在 AI 问答中使用,文档会被一并归档"
            onConfirm={() => handleDeleteKb(record.id)}
            okText="归档" cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              归档
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const docColumns = [
    { title: '标题', dataIndex: 'title', key: 'title' },
    { title: '文件名', dataIndex: 'file_name', key: 'file_name', ellipsis: true },
    {
      title: '大小', dataIndex: 'file_size', key: 'file_size', width: 100,
      render: v => v ? `${(v / 1024).toFixed(1)} KB` : '-',
    },
    {
      title: '分块', dataIndex: 'chunk_count', key: 'chunk_count', width: 80, align: 'center',
      render: v => v || '-',
    },
    {
      title: '解析状态', dataIndex: 'parse_status', key: 'parse_status', width: 120,
      render: v => {
        const s = PARSE_STATUS[v] || { text: v, color: 'default' };
        return <Tag color={s.color} icon={s.icon}>{s.text}</Tag>;
      },
    },
    { title: '上传人', dataIndex: 'uploaded_by', key: 'uploaded_by', width: 100 },
    {
      title: '上传时间', dataIndex: 'uploaded_at', key: 'uploaded_at', width: 160,
      render: v => v ? new Date(v).toLocaleString('zh-CN') : '-',
    },
    {
      title: '操作', key: 'actions', width: 240, fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDoc(record.id)}>
            详情
          </Button>
          <Tooltip title="重新解析">
            <Button type="link" size="small" icon={<ReloadOutlined />} onClick={() => handleReparse(record.id)} />
          </Tooltip>
          <Popconfirm title="确认删除该文档?" onConfirm={() => handleDeleteDoc(record.id)} okText="删除" cancelText="取消">
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const draggerProps = {
    name: 'file',
    multiple: false,
    accept: '.pdf,.docx,.doc,.txt,.md,.markdown,.log,.html,.htm',
    showUploadList: false,
    customRequest: async ({ file, onSuccess, onError }) => {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('kb_id', activeKb.id);
        formData.append('title', file.name.replace(/\.[^.]+$/, ''));
        const hide = message.loading(`正在上传并解析: ${file.name}`, 0);
        try {
          const result = await knowledgeBaseAPI.uploadDocument(formData);
          if (result.success) {
            message.success(`上传成功: ${file.name}`);
            onSuccess(result);
            loadDocs(1);
            loadKbs(pagination.current);
          } else {
            message.error(result.message || '上传失败');
            onError(new Error(result.message));
          }
        } finally {
          hide();
        }
      } catch (e) {
        message.error('上传失败: ' + (e.response?.data?.message || e.message));
        onError(e);
      }
    },
  };

  const docStats = useMemo(() => {
    return {
      total: docs.length,
      ready: docs.filter(d => d.parse_status === 'ready').length,
      failed: docs.filter(d => d.parse_status === 'failed').length,
      parsing: docs.filter(d => d.parse_status === 'parsing').length,
    };
  }, [docs]);

  return (
    <div style={{ padding: 24 }}>
      <Card
        title={
          <Space>
            <BookOutlined style={{ color: '#1890ff' }} />
            <span>知识库管理</span>
          </Space>
        }
        extra={
          <Space>
            <Button icon={<SettingOutlined />} onClick={openSettings}>
              知识库设置
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateKb}>
              新建知识库
            </Button>
          </Space>
        }
      >
        <Space style={{ marginBottom: 16 }} wrap>
          <Input.Search
            placeholder="搜索知识库"
            allowClear
            style={{ width: 240 }}
            onSearch={v => setFilters(f => ({ ...f, keyword: v }))}
          />
          <Select
            value={filters.status}
            style={{ width: 120 }}
            onChange={v => setFilters(f => ({ ...f, status: v }))}
            options={[
              { value: 'active', label: '启用' },
              { value: 'archived', label: '已归档' },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={() => loadKbs(pagination.current)}>
            刷新
          </Button>
        </Space>

        <Table
          rowKey="id"
          loading={loading}
          columns={kbColumns}
          dataSource={kbs}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: t => `共 ${t} 个知识库`,
            onChange: loadKbs,
          }}
          size="middle"
        />
      </Card>

      {activeKb && (
        <Card
          style={{ marginTop: 16 }}
          title={
            <Space>
              <BookOutlined style={{ color: '#1890ff' }} />
              <span>知识库文档 — {activeKb.kb_name}</span>
              <Tag color="blue">{activeKb.kb_code}</Tag>
            </Space>
          }
          extra={
            <Button onClick={() => setActiveKb(null)}>返回知识库列表</Button>
          }
        >
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <Statistic title="文档总数" value={docStats.total} prefix={<FileTextOutlined />} />
            </Col>
            <Col span={6}>
              <Statistic title="已就绪" value={docStats.ready} styles={{ content: { color: '#52c41a' } }} prefix={<CheckCircleOutlined />} />
            </Col>
            <Col span={6}>
              <Statistic title="解析中" value={docStats.parsing} styles={{ content: { color: '#1890ff' } }} />
            </Col>
            <Col span={6}>
              <Statistic title="解析失败" value={docStats.failed} styles={{ content: { color: '#ff4d4f' } }} />
            </Col>
          </Row>

          <Tabs
            defaultActiveKey="upload"
            items={[
              {
                key: 'upload',
                label: '上传文档',
                children: (
                  <Dragger {...draggerProps} style={{ padding: 20 }}>
                    <p className="ant-upload-drag-icon">
                      <InboxOutlined style={{ color: '#1890ff' }} />
                    </p>
                    <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
                    <p className="ant-upload-hint">
                      支持 PDF / DOCX / DOC / TXT / MD / HTML 格式,单文件不超过 50MB
                      <br />
                      上传后会自动进行解析与分块
                    </p>
                  </Dragger>
                ),
              },
              {
                key: 'list',
                label: `文档列表 (${docStats.total})`,
                children: (
                  <>
                    <Space style={{ marginBottom: 12 }} wrap>
                      <Input.Search
                        placeholder="搜索文档" allowClear style={{ width: 200 }}
                        onSearch={v => setDocFilters(f => ({ ...f, keyword: v }))}
                      />
                      <Select
                        value={docFilters.parse_status}
                        style={{ width: 140 }}
                        onChange={v => setDocFilters(f => ({ ...f, parse_status: v }))}
                        options={[
                          { value: '', label: '全部状态' },
                          { value: 'ready', label: '已就绪' },
                          { value: 'pending', label: '待解析' },
                          { value: 'parsing', label: '解析中' },
                          { value: 'failed', label: '失败' },
                        ]}
                      />
                      <Button icon={<ReloadOutlined />} onClick={handleReupload}>刷新</Button>
                    </Space>
                    <Table
                      rowKey="id"
                      loading={docLoading}
                      columns={docColumns}
                      dataSource={docs}
                      scroll={{ x: 1100 }}
                      pagination={{
                        ...docPagination,
                        showSizeChanger: true,
                        showTotal: t => `共 ${t} 个文档`,
                        onChange: loadDocs,
                      }}
                      size="middle"
                    />
                  </>
                ),
              },
            ]}
          />
        </Card>
      )}

      {/* 知识库 新建/编辑 */}
      <Modal
        title={editingKb ? '编辑知识库' : '新建知识库'}
        open={kbModalOpen}
        onCancel={() => setKbModalOpen(false)}
        onOk={handleSubmitKb}
        okText={editingKb ? '保存' : '创建'}
        width={560}
      >
        <Form form={kbForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="kb_code" label="编码"
            rules={[
              { required: true, message: '请输入编码' },
              { pattern: /^[a-zA-Z0-9_-]{2,64}$/, message: '仅支持字母数字 _- 长度 2-64' },
            ]}
          >
            <Input placeholder="例如: ct-equipment / lab-sop" disabled={!!editingKb} />
          </Form.Item>
          <Form.Item name="kb_name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="例如:CT 设备资料库" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={2} placeholder="可选,描述知识库用途" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="scope" label="用途">
                <Select options={SCOPE_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="sort_order" label="排序">
                <InputNumber style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          {editingKb && (
            <Form.Item name="status" label="状态">
              <Select
                options={[
                  { value: 'active', label: '启用' },
                  { value: 'archived', label: '归档' },
                ]}
              />
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* 文档详情 */}
      <Drawer
        title="文档详情"
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        size="large"
      >
        {docDetail && (
          <div>
            <Descriptions size="small" column={1} bordered>
              <Descriptions.Item label="标题">{docDetail.title}</Descriptions.Item>
              <Descriptions.Item label="文件名">{docDetail.file_name}</Descriptions.Item>
              <Descriptions.Item label="大小">
                {docDetail.file_size ? `${(docDetail.file_size / 1024).toFixed(1)} KB` : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="字符数">{docDetail.char_count || 0}</Descriptions.Item>
              <Descriptions.Item label="分块数">{docDetail.chunk_count || 0}</Descriptions.Item>
              <Descriptions.Item label="解析状态">
                <Tag color={PARSE_STATUS[docDetail.parse_status]?.color || 'default'}>
                  {PARSE_STATUS[docDetail.parse_status]?.text || docDetail.parse_status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="上传人">{docDetail.uploaded_by || '-'}</Descriptions.Item>
              <Descriptions.Item label="上传时间">
                {docDetail.uploaded_at ? new Date(docDetail.uploaded_at).toLocaleString('zh-CN') : '-'}
              </Descriptions.Item>
              {docDetail.parse_error && (
                <Descriptions.Item label="解析错误">
                  <span style={{ color: '#ff4d4f' }}>{docDetail.parse_error}</span>
                </Descriptions.Item>
              )}
            </Descriptions>
            <Divider />
            <Button type="primary" icon={<CloudUploadOutlined />} onClick={() => handleDownloadDoc(docDetail.id)}>
              下载原文
            </Button>
          </div>
        )}
      </Drawer>

      {/* 设置 */}
      <Modal
        title="知识库设置"
        open={settingsOpen}
        onCancel={() => setSettingsOpen(false)}
        onOk={handleSaveSettings}
        okText="保存"
        width={680}
        confirmLoading={settingsLoading}
      >
        {settingsLoading ? (
          <Skeleton active />
        ) : (
          <Form form={settingsForm} layout="vertical" style={{ marginTop: 16 }}>
            <Alert
              type="info" showIcon style={{ marginBottom: 16 }}
              message="这些设置会影响文档分块与 AI 问答效果,修改后新上传的文档才会生效"
            />

            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="chunk_size" label="分块大小(字符)" tooltip="推荐 400-800">
                  <InputNumber min={200} max={2000} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="chunk_overlap" label="分块重叠(字符)" tooltip="推荐 size 的 10-20%">
                  <InputNumber min={0} max={400} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="top_k" label="检索 topK" tooltip="每次问答取的相关分块数">
                  <InputNumber min={1} max={20} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="min_score" label="最低分阈值" tooltip="低于此分视为不相关,0-1">
                  <InputNumber min={0} max={1} step={0.01} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="max_context_chars" label="上下文最大字符" tooltip="注入 prompt 的总字符上限">
                  <InputNumber min={1000} max={20000} step={500} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="ai_enabled" label="启用 AI 问答" valuePropName="checked">
                  <Switch />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="ai_provider" label="AI Provider">
                  <Input placeholder="openclaw" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="ai_model" label="AI 模型">
                  <Input placeholder="openclaw" />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item name="system_prompt" label="系统提示" tooltip="回答时的角色约束,留空使用默认">
              <TextArea rows={4} placeholder="可选,自定义系统提示" />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
};

export default KnowledgeBaseList;
