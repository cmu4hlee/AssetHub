import React, { useState, useEffect, useCallback } from 'react';
import { useCan } from '../hooks';
import {
  Card, Descriptions, Tag, Button, Spin, message, Space, Tabs,
  Progress, Select, Input, Collapse, Modal, Upload,
  Popconfirm, Empty, List, Typography,
} from 'antd';
import {
  ArrowLeftOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ClockCircleOutlined, LoadingOutlined, EditOutlined, DownloadOutlined,
  DeleteOutlined, PlusOutlined, ReloadOutlined,
  CheckOutlined, UndoOutlined, UploadOutlined, PrinterOutlined,
  TeamOutlined, FileTextOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { acceptanceAPI } from '../utils/api';
import { printAcceptanceDetailReport } from '../utils/printReport';

const { TextArea } = Input;
const { Panel } = Collapse;
const { Text } = Typography;

const statusColorMap = {
  待验收: 'blue',
  验收中: 'orange',
  已验收: 'green',
  验收不合格: 'red',
};

const statusIconMap = {
  待验收: <ClockCircleOutlined />,
  验收中: <LoadingOutlined />,
  已验收: <CheckCircleOutlined />,
  验收不合格: <CloseCircleOutlined />,
};

const categoryIconMap = {
  外观检查: '🔍',
  配件核对: '📦',
  资料核对: '📄',
  功能测试: '⚙️',
  安装验收: '🔧',
  安全验收: '🛡️',
};

const AcceptanceDetail = () => {
  const canDelete = useCan('acceptance', 'delete');
  const canEdit = useCan('acceptance', 'edit');
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState(null);
  const [files, setFiles] = useState([]);
  const [checklist, setChecklist] = useState([]);
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState('basic');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editRemark, setEditRemark] = useState('');
  const [initLoading, setInitLoading] = useState(false);
  const [passAllLoading, setPassAllLoading] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [fileUploading, setFileUploading] = useState(false);
  const [fileType, setFileType] = useState('验收资料');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [recResp, filesResp, checklistResp, statsResp] = await Promise.all([
        acceptanceAPI.getAcceptanceRecord(id),
        acceptanceAPI.getAcceptanceFiles(id),
        acceptanceAPI.getChecklist(id),
        acceptanceAPI.getChecklistStats(id),
      ]);
      if (recResp.success) setRecord(recResp.data.record);
      if (filesResp.success) setFiles(filesResp.data);
      if (checklistResp.success) setChecklist(checklistResp.data || []);
      if (statsResp.success) setStats(statsResp.data);
    } catch (error) {
      console.error('加载验收详情失败:', error);
      message.error('加载验收详情失败');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleInitChecklist = async () => {
    setInitLoading(true);
    try {
      const resp = await acceptanceAPI.initChecklist(id);
      if (resp.success) {
        message.success(resp.message);
        fetchData();
      } else {
        message.error(resp.message || '初始化失败');
      }
    } catch (error) {
      message.error('初始化检查清单失败');
    } finally {
      setInitLoading(false);
    }
  };

  const handleCheckItem = async (checkId, isPassed) => {
    try {
      const resp = await acceptanceAPI.updateChecklistItem(id, checkId, {
        is_passed: isPassed ? 1 : 0,
      });
      if (resp.success) {
        message.success(isPassed ? '已标记为通过' : '已标记为不通过');
        fetchData();
      }
    } catch (error) {
      message.error('更新失败');
    }
  };

  const handlePassAll = async () => {
    setPassAllLoading(true);
    try {
      const resp = await acceptanceAPI.passAllChecklist(id);
      if (resp.success) {
        message.success(resp.message);
        fetchData();
      } else {
        message.error(resp.message || '操作失败');
      }
    } catch (error) {
      message.error('操作失败');
    } finally {
      setPassAllLoading(false);
    }
  };

  const handleStatusUpdate = async (status) => {
    setStatusUpdating(true);
    try {
      const resp = await acceptanceAPI.updateAcceptanceStatus(id, status);
      if (resp.success) {
        message.success('状态更新成功');
        fetchData();
      } else {
        message.error(resp.message || '更新失败');
      }
    } catch (error) {
      message.error(error?.response?.data?.message || '更新状态失败');
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleDelete = async () => {
    try {
      const resp = await acceptanceAPI.deleteAcceptanceRecord(id);
      if (resp.success) {
        message.success('删除成功');
        navigate('/acceptance');
      } else {
        message.error(resp.message || '删除失败');
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleFileUpload = async ({ fileList }) => {
    const uploadFiles = fileList.map(item => item.originFileObj).filter(Boolean);
    if (uploadFiles.length === 0) {
      return;
    }

    setFileUploading(true);
    try {
      const resp = await acceptanceAPI.uploadFiles(id, uploadFiles, fileType);
      if (resp.success) {
        message.success(resp.message || '文件上传成功');
        fetchData();
      } else {
        message.error(resp.message || '文件上传失败');
      }
    } catch (error) {
      message.error('文件上传失败');
    } finally {
      setFileUploading(false);
    }
  };

  const handleFileDownload = async file => {
    try {
      const resp = await acceptanceAPI.downloadAcceptanceFile(file.id);
      const blob = new Blob([resp.data], { type: file.mime_type || 'application/octet-stream' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.file_name || '验收文件';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      message.error('文件下载失败');
    }
  };

  const handleFileDelete = async fileId => {
    try {
      const resp = await acceptanceAPI.deleteAcceptanceFile(fileId);
      if (resp.success) {
        message.success(resp.message || '文件删除成功');
        fetchData();
      } else {
        message.error(resp.message || '文件删除失败');
      }
    } catch (error) {
      message.error('文件删除失败');
    }
  };

  const handlePrintReport = () => {
    if (!record) {
      message.warning('暂无数据可打印');
      return;
    }
    printAcceptanceDetailReport(record, checklist, stats);
  };

  const groupedChecklist = checklist.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  const progressPercent = stats?.total > 0
    ? Math.round(((stats.passed + stats.failed) / stats.total) * 100)
    : 0;

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <Spin size="large" /><p style={{ marginTop: 16, color: '#999' }}>加载中...</p>
      </div>
    );
  }

  if (!record) {
    return <Empty description="验收记录不存在" />;
  }

  const renderBasicInfo = () => (
    <div>
    <div style={{ marginBottom: 16, textAlign: 'right' }}>
      <Button icon={<PrinterOutlined />} onClick={handlePrintReport}>
        打印报表
      </Button>
    </div>
    <Card title="基本信息" style={{ marginBottom: 16 }}>
      <Descriptions column={2} bordered>
        <Descriptions.Item label="资产编号">{record.asset_code}</Descriptions.Item>
        <Descriptions.Item label="资产名称">{record.asset_name}</Descriptions.Item>
        <Descriptions.Item label="供应商">{record.supplier || '-'}</Descriptions.Item>
        <Descriptions.Item label="验收日期">
          {record.acceptance_date ? dayjs(record.acceptance_date).format('YYYY-MM-DD') : '-'}
        </Descriptions.Item>
        <Descriptions.Item label="验收人">{record.acceptance_person}</Descriptions.Item>
        <Descriptions.Item label="状态">
          <Tag color={statusColorMap[record.status]} icon={statusIconMap[record.status]}>
            {record.status}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="使用科室">{record.department}</Descriptions.Item>
        <Descriptions.Item label="职能部门">{record.functional_department || '-'}</Descriptions.Item>
        <Descriptions.Item label="创建人">{record.created_by || '-'}</Descriptions.Item>
        <Descriptions.Item label="创建时间">
          {record.created_at ? dayjs(record.created_at).format('YYYY-MM-DD HH:mm') : '-'}
        </Descriptions.Item>
        <Descriptions.Item label="更新时间">
          {record.updated_at ? dayjs(record.updated_at).format('YYYY-MM-DD HH:mm') : '-'}
        </Descriptions.Item>
        <Descriptions.Item label="备注" span={2}>{record.remark || '-'}</Descriptions.Item>
      </Descriptions>
    </Card>
    </div>
  );

  const renderChecklist = () => {
    if (checklist.length === 0) {
      return (
        <Card title="验收检查清单">
          <Empty description="检查清单未初始化" image={Empty.PRESENTED_IMAGE_SIMPLE}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleInitChecklist}
              loading={initLoading}
            >
              从模板初始化检查清单
            </Button>
          </Empty>
        </Card>
      );
    }

    return (
      <Card
        title="验收检查清单"
        extra={
          <Space>
            <Tag color={stats?.passed ? 'green' : 'default'}>
              <CheckCircleOutlined /> 通过 {stats?.passed || 0}/{stats?.total || 0}
            </Tag>
            <Tag color={stats?.failed ? 'red' : 'default'}>
              <CloseCircleOutlined /> 不通过 {stats?.failed || 0}
            </Tag>
            <Tag color={stats?.unchecked ? 'orange' : 'default'}>
              <ClockCircleOutlined /> 未检查 {stats?.unchecked || 0}
            </Tag>
            <Button icon={<ReloadOutlined />} onClick={fetchData} size="small">刷新</Button>
            <Button type="primary" icon={<CheckOutlined />} onClick={handlePassAll} loading={passAllLoading} size="small">
              一键通过
            </Button>
          </Space>
        }
      >
        <Progress
          percent={progressPercent}
          status={(stats?.failed ?? 0) > 0 ? 'exception' : 'active'}
          strokeColor={(stats?.failed ?? 0) > 0 ? '#ff4d4f' : '#52c41a'}
          style={{ marginBottom: 16 }}
          format={(p) => `${p}% 已完成`}
        />

        <Collapse defaultActiveKey={Object.keys(groupedChecklist)}>
          {Object.entries(groupedChecklist).map(([category, items]) => {
            return (
              <Panel
                key={category}
                header={
                  <Space>
                    <span>{categoryIconMap[category] || '📋'} {category}</span>
                  </Space>
                }
              >
                <List
                  dataSource={items}
                  renderItem={item => (
                    <List.Item
                      actions={[
                        item.is_passed !== 1 ? (
                          <Button
                            type="link"
                            icon={<CheckCircleOutlined />}
                            style={{ color: '#52c41a' }}
                            onClick={() => handleCheckItem(item.id, true)}
                          >
                            通过
                          </Button>
                        ) : null,
                        item.is_passed !== 0 ? (
                          <Button
                            type="link"
                            danger
                            icon={<CloseCircleOutlined />}
                            onClick={() => handleCheckItem(item.id, false)}
                          >
                            不通过
                          </Button>
                        ) : null,
                        <Button
                          type="link"
                          icon={<EditOutlined />}
                          onClick={() => {
                            setEditingItem(item);
                            setEditRemark(item.remark || '');
                            setEditModalVisible(true);
                          }}
                        >
                          备注
                        </Button>,
                      ]}
                    >
                      <List.Item.Meta
                        title={
                          <Space>
                            {item.item_name}
                            {item.is_passed === 1 && <Tag color="green" icon={<CheckCircleOutlined />}>通过</Tag>}
                            {item.is_passed === 0 && <Tag color="red" icon={<CloseCircleOutlined />}>不通过</Tag>}
                            {item.is_passed === null && <Tag color="blue" icon={<ClockCircleOutlined />}>未检查</Tag>}
                          </Space>
                        }
                        description={
                          <Space direction="vertical" size={0}>
                            {item.item_description && <Text type="secondary">{item.item_description}</Text>}
                            {item.remark && <Text type="warning">备注：{item.remark}</Text>}
                            {item.checked_by && (
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                {item.checked_by} 于 {item.checked_at ? dayjs(item.checked_at).format('YYYY-MM-DD HH:mm') : ''} 检查
                              </Text>
                            )}
                          </Space>
                        }
                      />
                    </List.Item>
                  )}
                />
              </Panel>
            );
          })}
        </Collapse>

        <Modal
          title="修改备注"
          open={editModalVisible}
          onOk={async () => {
            if (editingItem) {
              await acceptanceAPI.updateChecklistItem(id, editingItem.id, {
                is_passed: editingItem.is_passed,
                remark: editRemark,
              });
              message.success('备注已更新');
              setEditModalVisible(false);
              fetchData();
            }
          }}
          onCancel={() => setEditModalVisible(false)}
        >
          <TextArea
            rows={3}
            value={editRemark}
            onChange={e => setEditRemark(e.target.value)}
            placeholder="请输入备注信息"
          />
        </Modal>
      </Card>
    );
  };

  const renderFiles = () => (
    <Card
      title="相关文件"
      extra={
        <Space>
          <Select value={fileType} onChange={setFileType} style={{ width: 140 }}>
            <Select.Option value="验收资料">验收资料</Select.Option>
            <Select.Option value="合同附件">合同附件</Select.Option>
            <Select.Option value="检测报告">检测报告</Select.Option>
            <Select.Option value="现场照片">现场照片</Select.Option>
            <Select.Option value="其他">其他</Select.Option>
          </Select>
          <Upload multiple showUploadList={false} beforeUpload={() => false} onChange={handleFileUpload}>
            <Button icon={<UploadOutlined />} loading={fileUploading}>上传文件</Button>
          </Upload>
        </Space>
      }
    >
      {files.length === 0 ? (
        <Empty description="暂无文件" />
      ) : (
        <List
          dataSource={files}
          renderItem={file => (
            <List.Item
              actions={[
                <Button size="small" icon={<DownloadOutlined />} onClick={() => handleFileDownload(file)}>
                  下载
                </Button>,
                <Popconfirm title="确定要删除这个文件吗？" onConfirm={() => handleFileDelete(file.id)}>
                  <Button size="small" icon={<DeleteOutlined />} danger>删除</Button>
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                title={file.file_name}
                description={
                  <Space>
                    <Tag>{file.file_type}</Tag>
                    <Text type="secondary">
                      {file.file_size ? `${(file.file_size / 1024).toFixed(1)} KB` : '-'}
                    </Text>
                    <Text type="secondary">
                      {file.uploaded_at ? dayjs(file.uploaded_at).format('YYYY-MM-DD HH:mm') : '-'}
                    </Text>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      )}
    </Card>
  );

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/acceptance')}>
            返回列表
          </Button>
          <h2 style={{ margin: 0 }}>验收详情 - {record.asset_name}</h2>
        </Space>
        <Space>
          <Button
            icon={<TeamOutlined />}
            onClick={() => navigate(`/acceptance/teams/${id}`)}
          >
            验收小组
          </Button>
          <Button
            icon={<FileTextOutlined />}
            onClick={() => navigate(`/acceptance/report/${id}`)}
          >
            验收报告
          </Button>
          <Button
            icon={<EditOutlined />}
            onClick={() => navigate(`/acceptance/edit/${id}`)}
          >
            编辑
          </Button>
          {(record.status === '待验收' || record.status === '验收中') && (
            <Button
              icon={<CheckCircleOutlined />}
              type="primary"
              loading={statusUpdating}
              onClick={() => handleStatusUpdate('已验收')}
            >
              完成验收
            </Button>
          )}
          {(record.status === '待验收' || record.status === '验收中') && (
            <Button
              danger
              icon={<CloseCircleOutlined />}
              loading={statusUpdating}
              onClick={() => handleStatusUpdate('验收不合格')}
            >
              标记不合格
            </Button>
          )}
          {record.status === '验收不合格' && (
            <Button
              icon={<UndoOutlined />}
              loading={statusUpdating}
              onClick={() => handleStatusUpdate('验收中')}
            >
              重新验收
            </Button>
          )}
          <Popconfirm title="确定要删除这条验收记录吗？" onConfirm={handleDelete}>
            <Button danger icon={<DeleteOutlined />} disabled={!canDelete}>删除</Button>
          </Popconfirm>
        </Space>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          { key: 'basic', label: '基本信息', children: renderBasicInfo() },
          { key: 'checklist', label: '检查清单', children: renderChecklist() },
          { key: 'files', label: '相关文件', children: renderFiles() },
        ]}
      />
    </div>
  );
};

export default AcceptanceDetail;
