import React, { useState, useEffect, useCallback } from 'react';
import { useCan } from '../hooks';
import {
  Card, Descriptions, Tag, Button, Space, Spin, message, Typography,
  Progress, Table, Empty, List, Collapse, Popconfirm,
} from 'antd';
import {
  ArrowLeftOutlined, PrinterOutlined, FileTextOutlined, TeamOutlined,
  ReloadOutlined, EditOutlined, FilePdfOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { acceptanceManagementAPI } from '../utils/api';
import { printAcceptanceReport } from '../utils/printReport';
import useIsMobile from '../hooks/useIsMobile';

const { Text } = Typography;

const statusColorMap = {
  待验收: 'blue',
  验收中: 'orange',
  已验收: 'green',
  验收不合格: 'red',
};

const resultColorMap = {
  1: 'green',
  0: 'red',
};

const AcceptanceReport = () => {
  const canGenerate = useCan('acceptance', 'report:generate');
  const isMobile = useIsMobile();
  const { id: recordId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [data, setData] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await acceptanceManagementAPI.getReport(recordId);
      if (resp.success) {
        setData(resp.data || null);
      } else {
        message.error(resp.message || '获取验收报告失败');
      }
    } catch (error) {
      console.error('获取验收报告失败:', error);
      message.error('获取验收报告失败');
    } finally {
      setLoading(false);
    }
  }, [recordId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const resp = await acceptanceManagementAPI.generateReport(recordId);
      if (resp.success) {
        message.success('验收报告已生成');
        loadData();
      } else {
        message.error(resp.message || '生成失败');
      }
    } catch (e) {
      message.error('生成失败');
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = () => {
    if (!data) {
      message.warning('暂无数据可打印');
      return;
    }
    printAcceptanceReport(data, { generatedBy: '系统' });
  };

  const [exporting, setExporting] = useState(false);
  const handleExportPdf = async () => {
    if (!data) {
      message.warning('暂无数据可导出');
      return;
    }
    setExporting(true);
    try {
      await acceptanceManagementAPI.exportReportPdf(recordId);
      message.success('PDF 已下载');
    } catch (error) {
      console.error('导出 PDF 失败:', error);
      message.error(error?.response?.data?.message || error?.message || '导出 PDF 失败');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (!data) {
    return <Empty description="验收报告不存在" style={{ marginTop: 60 }} />;
  }

  const { record, checklist = [], files = [], team = [], summary } = data;

  const groupedChecklist = checklist.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  const progressPercent = summary?.total > 0
    ? Math.round(((summary.passed + summary.failed) / summary.total) * 100)
    : 0;

  const checklistColumns = [
    { title: '项目', dataIndex: 'item_name', key: 'item_name', render: t => <Text strong>{t}</Text> },
    { title: '描述', dataIndex: 'item_description', key: 'item_description', render: t => t || '-' },
    {
      title: '结果',
      dataIndex: 'is_passed',
      key: 'is_passed',
      width: 100,
      render: v => (
        v === 1 ? <Tag color="green">通过</Tag>
          : v === 0 ? <Tag color="red">不通过</Tag>
            : <Tag color="blue">未检查</Tag>
      ),
    },
    { title: '检查人', dataIndex: 'checked_by', key: 'checked_by', width: 120, render: t => t || '-' },
    { title: '备注', dataIndex: 'remark', key: 'remark', render: t => t || '-' },
  ];

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/acceptance/${recordId}`)}>返回详情</Button>
          <Typography.Title level={2} style={{ margin: 0 }}>验收报告</Typography.Title>
        </Space>
        <Space wrap>
          <Button icon={<TeamOutlined />} onClick={() => navigate(`/acceptance/teams/${recordId}`)}>验收小组</Button>
          <Button icon={<ReloadOutlined />} onClick={loadData}>刷新</Button>
          {canGenerate && (
            <Button icon={<EditOutlined />} loading={generating} onClick={handleGenerate}>生成报告</Button>
          )}
          <Button type="primary" icon={<PrinterOutlined />} onClick={handlePrint}>打印报告</Button>
          <Button icon={<FilePdfOutlined />} loading={exporting} onClick={handleExportPdf}>导出 PDF</Button>
        </Space>
      </div>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Descriptions column={isMobile ? 1 : 3} bordered size="small">
          <Descriptions.Item label="资产编号">{record.asset_code || '-'}</Descriptions.Item>
          <Descriptions.Item label="资产名称">{record.asset_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="供应商">{record.supplier || '-'}</Descriptions.Item>
          <Descriptions.Item label="验收日期">
            {record.acceptance_date ? dayjs(record.acceptance_date).format('YYYY-MM-DD') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="验收人">{record.acceptance_person || '-'}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={statusColorMap[record.status]}>{record.status}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="使用科室">{record.department || '-'}</Descriptions.Item>
          <Descriptions.Item label="职能部门">{record.functional_department || '-'}</Descriptions.Item>
          <Descriptions.Item label="备注" span={3}>{record.remark || '-'}</Descriptions.Item>
        </Descriptions>
      </Card>

      {summary && (
        <Card size="small" style={{ marginBottom: 16 }} title="验收合格率">
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
            <Progress
              type="dashboard"
              percent={progressPercent}
              status={(summary.failed ?? 0) > 0 ? 'exception' : 'normal'}
              format={() => `${summary.passRate || '0.0'}%`}
            />
            <Space size="large" wrap>
              <Stat label="检查项" value={summary.total || 0} />
              <Stat label="通过" value={summary.passed || 0} color="#52c41a" />
              <Stat label="不通过" value={summary.failed || 0} color="#f5222d" />
              <Stat label="未检查" value={summary.unchecked || 0} color="#fa8c16" />
            </Space>
          </div>
        </Card>
      )}

      <Card size="small" style={{ marginBottom: 16 }} title="检查清单">
        {checklist.length === 0 ? (
          <Empty description="暂无检查项" />
        ) : (
          <div className="hide-on-mobile">
            <Table
              rowKey="id"
              dataSource={checklist}
              columns={checklistColumns}
              pagination={false}
              size="small"
              scroll={{ x: 600 }}
            />
          </div>
        )}
        <div className="mobile-table-cards show-on-mobile">
          {checklist.length === 0 ? (
            <Empty description="暂无检查项" />
          ) : (
            <Collapse defaultActiveKey={Object.keys(groupedChecklist)}>
              {Object.entries(groupedChecklist).map(([category, items]) => (
                <Collapse.Panel key={category} header={category}>
                  {items.map(item => (
                    <List.Item key={item.id} style={{ display: 'block', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Text strong>{item.item_name}</Text>
                        {item.is_passed === 1 ? <Tag color="green">通过</Tag>
                          : item.is_passed === 0 ? <Tag color="red">不通过</Tag>
                            : <Tag color="blue">未检查</Tag>}
                      </div>
                      <div style={{ color: '#8c8c8c', fontSize: 12, marginTop: 4 }}>
                        {item.item_description || '-'}
                        {item.remark ? ` ｜ 备注：${item.remark}` : ''}
                      </div>
                    </List.Item>
                  ))}
                </Collapse.Panel>
              ))}
            </Collapse>
          )}
        </div>
      </Card>

      <Card size="small" style={{ marginBottom: 16 }} title={`验收小组（${team.length}）`}>
        {team.length === 0 ? (
          <Empty description="暂无小组成员" />
        ) : (
          <div className="hide-on-mobile">
            <Table
              rowKey="id"
              dataSource={team}
              columns={[
                { title: '姓名', dataIndex: 'member_name', key: 'member_name', render: t => <Text strong>{t}</Text> },
                { title: '角色', dataIndex: 'role', key: 'role', width: 100, render: r => <Tag>{r}</Tag> },
                { title: '所属科室', dataIndex: 'department', key: 'department', render: t => t || '-' },
                { title: '加入时间', dataIndex: 'assigned_at', key: 'assigned_at', width: 160, render: t => (t ? dayjs(t).format('YYYY-MM-DD HH:mm') : '-') },
              ]}
              pagination={false}
              size="small"
            />
          </div>
        )}
        <div className="mobile-table-cards show-on-mobile">
          {team.length === 0 ? (
            <Empty description="暂无小组成员" />
          ) : (
            team.map(m => (
              <div key={m.id} className="mobile-card-item">
                <div className="mobile-card-header">
                  <span className="mobile-card-title">{m.member_name}</span>
                  <Tag>{m.role}</Tag>
                </div>
                <div className="mobile-card-body">
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">科室</span>
                    <span className="mobile-card-value">{m.department || '-'}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">加入</span>
                    <span className="mobile-card-value">{m.assigned_at ? dayjs(m.assigned_at).format('YYYY-MM-DD HH:mm') : '-'}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <Card size="small" title={`相关文件（${files.length}）`}>
        {files.length === 0 ? (
          <Empty description="暂无文件" />
        ) : (
          <List
            dataSource={files}
            renderItem={file => (
              <List.Item>
                <List.Item.Meta
                  title={<Space><FileTextOutlined />{file.file_name}</Space>}
                  description={
                    <Space>
                      <Tag>{file.file_type}</Tag>
                      <Text type="secondary">{file.file_size ? `${(file.file_size / 1024).toFixed(1)} KB` : '-'}</Text>
                      <Text type="secondary">{file.uploaded_at ? dayjs(file.uploaded_at).format('YYYY-MM-DD HH:mm') : '-'}</Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>
    </div>
  );
};

const Stat = ({ label, value, color }) => (
  <div style={{ textAlign: 'center' }}>
    <div style={{ fontSize: 24, fontWeight: 600, color: color || '#1f1f1f' }}>{value}</div>
    <div style={{ color: '#8c8c8c', fontSize: 12 }}>{label}</div>
  </div>
);

export default AcceptanceReport;
