import React, { useState, useEffect, useCallback } from 'react';
import { useCan } from '../../hooks';
import {
  Button, Space, message, Spin, Tabs, Input, Form, Modal, Upload, List, Empty, Checkbox, Popconfirm, Card, Row, Col,
} from 'antd';
import {
  PlusOutlined, SaveOutlined, DeleteOutlined, UploadOutlined, FileOutlined,
  ArrowLeftOutlined, FileTextOutlined, DownloadOutlined, ReloadOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { tenderingAPI } from '../../api/domains/tendering';
import auth from '../../utils/auth';
import { PageHeader, StatusTag } from '../../components/tendering';

export default function XXX() {
  const canDelete = useCan('tender', 'delete');
  const canEdit = useCan('tender', 'edit');
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const [tender, setTender] = useState(null);
  const [sections, setSections] = useState([]);
  const [activeKey, setActiveKey] = useState(null);
  const [editing, setEditing] = useState({ section_code: '', section_title: '', section_content: '', section_order: 0, required: false });
  const [saving, setSaving] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [files, setFiles] = useState([]);
  const [fileUploading, setFileUploading] = useState(false);
  const [addForm] = Form.useForm();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [tenderRes, sectionsRes, filesRes] = await Promise.all([
        tenderingAPI.getProject(id),
        tenderingAPI.listSections(id),
        tenderingAPI.listTenderFiles(id),
      ]);
      const tenderData = tenderRes?.data ?? tenderRes;
      const sectionsData = Array.isArray(sectionsRes?.data) ? sectionsRes.data : [];
      const filesData = Array.isArray(filesRes?.data) ? filesRes.data : [];
      setTender(tenderData);
      setSections(sectionsData);
      setFiles(filesData);
      if (sectionsData.length > 0) {
        setActiveKey(sectionsData[0].section_code);
        setEditing(sectionsData[0]);
      }
    } catch (err) {
      message.error(err.response?.data?.message || '加载招标文件失败');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleTabChange = key => {
    setActiveKey(key);
    const sec = sections.find(s => s.section_code === key);
    if (sec) setEditing(sec);
  };

  const handleFieldChange = (field, value) => {
    setEditing(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!editing.section_code) {
      message.warning('请选择一个章节');
      return;
    }
    setSaving(true);
    try {
      await tenderingAPI.upsertSection(id, editing);
      message.success('章节保存成功');
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSection = async sectionCode => {
    Modal.confirm({
      title: '确认删除该章节？',
      okText: '确认删除',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await tenderingAPI.deleteSection(id, sectionCode);
          message.success('删除成功');
          fetchData();
        } catch (err) {
          message.error(err.response?.data?.message || '删除失败');
        }
      },
    });
  };

  const handleAddSection = async () => {
    try {
      const values = await addForm.validateFields();
      await tenderingAPI.upsertSection(id, {
        section_code: values.section_code,
        section_title: values.section_title,
        section_content: '',
        section_order: sections.length,
        required: !!values.required,
      });
      message.success('章节添加成功');
      setAddModalVisible(false);
      addForm.resetFields();
      fetchData();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err.response?.data?.message || '添加失败');
    }
  };

  const handleUploadFile = info => {
    if (info.file.status === 'uploading') {
      setFileUploading(true);
      return;
    }
    if (info.file.status === 'done') {
      setFileUploading(false);
      message.success('附件上传成功');
      fetchData();
    } else if (info.file.status === 'error') {
      setFileUploading(false);
      message.error('附件上传失败');
    }
  };

  const uploadProps = {
    name: 'file',
    action: `/api/tendering/projects/${id}/files`,
    withCredentials: true,
    headers: {
      Authorization: `Bearer ${auth.getToken() || ''}`,
      'X-Tenant-ID': String(auth.getSelectedEnterprise()?.id || ''),
    },
    showUploadList: false,
    onChange: handleUploadFile,
  };

  if (loading && !tender) {
    return <Card><Spin /> 正在加载…</Card>;
  }

  const requiredCount = sections.filter(s => s.required).length;
  const totalSize = files.reduce((sum, f) => sum + (Number(f.file_size) || 0), 0);

  const tabItems = sections.map(sec => ({
    key: sec.section_code,
    label: (
      <span>
        {sec.required && <span style={{ color: '#ff4d4f' }}>*</span>} {sec.section_title}
      </span>
    ),
    children: (
      <div>
        <Space wrap style={{ marginBottom: 12 }}>
          <Input
            placeholder="章节标题"
            value={editing.section_title}
            onChange={e => handleFieldChange('section_title', e.target.value)}
            style={{ width: 320 }}
          />
          <StatusTag
            status={editing.required ? '1' : '0'}
            statusMap={{
              '0': { text: '可选章节', color: 'default' },
              '1': { text: '必填章节', color: 'red' },
            }}
            size="small"
          />
          <Button
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteSection(editing.section_code)}
          >
            删除章节
          </Button>
        </Space>
        <Input.TextArea
          value={editing.section_content}
          onChange={e => handleFieldChange('section_content', e.target.value)}
          rows={18}
          placeholder="请输入该章节的招标文件内容（支持纯文本，可粘贴格式化内容）"
        />
        <Space style={{ marginTop: 12 }}>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            onClick={handleSave}
          >
            保存章节
          </Button>
        </Space>
      </div>
    ),
  }));

  return (
    <div>
      <PageHeader
        title="招标文件制作"
        description={tender ? `${tender.title} · ${tender.tender_code}` : '加载中...'}
        onBack={() => navigate(`/tendering/projects/${id}`)}
        extra={
          <Space wrap>
            <Button
              icon={<PlusOutlined />}
              onClick={() => setAddModalVisible(true)}
            >
              新增章节
            </Button>
            <Upload {...uploadProps}>
              <Button icon={<UploadOutlined />} loading={fileUploading}>
                上传招标附件
              </Button>
            </Upload>
          </Space>
        }
      />

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <StatusTag
            status="count"
            statusMap={{ count: { text: `共 ${sections.length} 个章节`, color: 'blue' } }}
            size="small"
          />
        </Col>
        <Col xs={12} sm={6}>
          <StatusTag
            status="required"
            statusMap={{ required: { text: `必填 ${requiredCount}`, color: 'red' } }}
            size="small"
          />
        </Col>
        <Col xs={12} sm={6}>
          <StatusTag
            status="files"
            statusMap={{ files: { text: `${files.length} 个附件`, color: 'cyan' } }}
            size="small"
          />
        </Col>
        <Col xs={12} sm={6}>
          <StatusTag
            status="size"
            statusMap={{ size: { text: `${(totalSize / 1024).toFixed(1)} KB`, color: 'default' } }}
            size="small"
          />
        </Col>
      </Row>

      <Card size="small" style={{ marginBottom: 16 }}>
        {sections.length === 0 ? (
          <Empty
            description={'暂无章节，点击右上角"新增章节"开始'}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <Tabs
            tabPosition="left"
            items={tabItems}
            activeKey={activeKey}
            onChange={handleTabChange}
            style={{ minHeight: 400 }}
          />
        )}
      </Card>

      <Card
        size="small"
        title={
          <Space>
            <FileTextOutlined /> 招标附件
          </Space>
        }
      >
        {files.length === 0 ? (
          <Empty description="暂无附件" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <List
            dataSource={files}
            renderItem={item => (
              <List.Item
                actions={[
                  <a
                    key="download"
                    href={`/uploads/tendering/${item.file_name}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <DownloadOutlined /> 下载
                  </a>,
                  <Popconfirm
                    key="delete"
                    title="确认删除该附件？"
                    onConfirm={async () => {
                      try {
                        await tenderingAPI.deleteTenderFile(item.id);
                        message.success('附件已删除');
                        fetchData();
                      } catch (err) {
                        message.error(err.response?.data?.message || '删除失败');
                      }
                    }}
                  >
                    <Button type="link" danger size="small" icon={<DeleteOutlined />} disabled={!canDelete}>
                      删除
                    </Button>
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta
                  avatar={<FileOutlined style={{ fontSize: 24, color: '#1677ff' }} />}
                  title={item.original_name || item.file_name}
                  description={`${item.file_type || '附件'} · ${(item.file_size / 1024).toFixed(1)} KB · ${item.created_at?.replace('T', ' ').slice(0, 16) || ''}`}
                />
              </List.Item>
            )}
          />
        )}
      </Card>

      <Modal
        title="新增招标文件章节"
        open={addModalVisible}
        onOk={handleAddSection}
        onCancel={() => { setAddModalVisible(false); addForm.resetFields(); }}
        okText="添加"
        cancelText="取消"
      >
        <Form form={addForm} layout="vertical">
          <Form.Item
            name="section_code"
            label="章节编码（英文标识）"
            rules={[{ required: true, message: '请输入章节编码' }]}
            extra="用于在 URL/数据中引用该章节，如：scope、qualification"
          >
            <Input placeholder="如：scope、qualification" />
          </Form.Item>
          <Form.Item
            name="section_title"
            label="章节标题"
            rules={[{ required: true, message: '请输入章节标题' }]}
          >
            <Input placeholder="如：技术规格要求" />
          </Form.Item>
          <Form.Item name="required" valuePropName="checked">
            <Checkbox>必填章节（投标方必须响应）</Checkbox>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
