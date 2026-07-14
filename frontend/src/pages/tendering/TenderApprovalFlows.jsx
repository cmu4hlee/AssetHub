import React, { useState, useEffect } from 'react';
import { Tag, Space, message } from 'antd';
import { tenderingAPI } from '../../api/domains/tendering';
import {
  PageHeader, StatusTag, ResponsiveTable,
} from '../../components/tendering';

const ENTITY_LABELS = {
  tender_projects: '招标项目',
  tender_contracts: '合同',
  tender_invoices: '发票',
  tender_payments: '付款单',
  tender_acceptances: '验收单',
};

export default function TenderApprovalFlows() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await tenderingAPI.listApprovalFlows();
      setData(Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []));
    } catch (e) {
      setData([]);
      message.error(e.response?.data?.message || '获取流程模板失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, []);

  const columns = [
    { title: '流程编码', dataIndex: 'flow_code', width: 200, fixed: 'left', ellipsis: true },
    { title: '流程名称', dataIndex: 'flow_name', width: 200, ellipsis: true },
    {
      title: '对象',
      dataIndex: 'entity_type',
      width: 130,
      render: v => <StatusTag status={v} statusMap={ENTITY_LABELS} bordered size="small" />,
    },
    { title: '触发动作', dataIndex: 'trigger_action', width: 150, render: v => v ? <Tag>{v}</Tag> : '-' },
    {
      title: '节点数',
      dataIndex: 'nodes',
      width: 90,
      align: 'right',
      render: v => Array.isArray(v) ? v.length : 0,
    },
    {
      title: '节点',
      dataIndex: 'nodes',
      render: nodes => (
        <Space wrap size={4}>
          {(nodes || []).map(n => (
            <Tag
              key={n.id}
              color={n.required ? 'cyan' : 'default'}
              style={{ margin: 0 }}
            >
              {n.seq}. {n.node_name} {n.approver_role ? `(${n.approver_role})` : '(auto)'}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      width: 90,
      render: v => v
        ? <StatusTag status="1" statusMap={{ 1: { text: '已启用', color: 'success' } }} size="small" />
        : <StatusTag status="0" statusMap={{ 0: { text: '停用', color: 'default' } }} size="small" />,
    },
  ];

  const mobileFields = [
    { label: '流程名称', key: 'flow_name', span: 2 },
    { label: '对象', key: 'entity_type', render: v => <StatusTag status={v} statusMap={ENTITY_LABELS} bordered size="small" /> },
    { label: '动作', key: 'trigger_action' },
    {
      label: '节点',
      key: 'nodes',
      span: 2,
      render: nodes => (nodes || []).length,
    },
  ];

  return (
    <div>
      <PageHeader
        title="审批流程模板"
        count={data.length}
        description="配置每类业务对象在不同动作下的审批节点和审批人规则"
      />

      <ResponsiveTable
        dataSource={data}
        columns={columns}
        loading={loading}
        rowKey="id"
        scroll={{ x: 1300 }}
        pagination={false}
        expandable={{
          expandedRowRender: row => (
            <pre style={{
              margin: 0, padding: 12, background: '#fafafa',
              fontSize: 12, maxHeight: 200, overflow: 'auto',
            }}>
              {JSON.stringify(row, null, 2)}
            </pre>
          ),
        }}
        mobileTitleKey="flow_name"
        mobileStatusRender={r => r.enabled
          ? <StatusTag status="1" statusMap={{ 1: { text: '已启用', color: 'success' } }} size="small" />
          : <StatusTag status="0" statusMap={{ 0: { text: '停用', color: 'default' } }} size="small" />}
        mobileFields={mobileFields}
      />
    </div>
  );
}
