import React, { useState, useEffect, useCallback } from 'react';
import { useCan } from '../hooks';
import {
  Card, Table, Tag, Button, Space, Modal, Form, Select, Input,
  message, Spin, Popconfirm, Typography, Descriptions, Empty,
} from 'antd';
import {
  ReloadOutlined, PlusOutlined, TeamOutlined, EditOutlined,
  DeleteOutlined, ArrowLeftOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { acceptanceManagementAPI, acceptanceAPI } from '../utils/api';
import useIsMobile from '../hooks/useIsMobile';

const { TextArea } = Input;
const { Title, Text } = Typography;

const TEAM_ROLES = ['组长', '成员', '观察员'];

const roleColorMap = {
  组长: 'red',
  成员: 'blue',
  观察员: 'default',
};

const AcceptanceTeam = () => {
  const canManage = useCan('acceptance', 'team:manage');
  const isMobile = useIsMobile();
  const { id: recordId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState([]);
  const [record, setRecord] = useState(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [membersResp, recResp] = await Promise.all([
        acceptanceManagementAPI.getTeamMembers(recordId),
        acceptanceAPI.getAcceptanceRecord(recordId).catch(() => null),
      ]);
      if (membersResp.success) {
        setMembers(membersResp.data || []);
      } else {
        message.error(membersResp.message || '获取小组成员失败');
      }
      if (recResp && recResp.success && recResp.data) {
        setRecord(recResp.data.record || recResp.data);
      }
    } catch (error) {
      console.error('加载验收小组失败:', error);
      message.error('加载验收小组失败');
    } finally {
      setLoading(false);
    }
  }, [recordId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ role: '成员' });
    setModalVisible(true);
  };

  const openEdit = (member) => {
    setEditing(member);
    form.setFieldsValue({
      member_name: member.member_name,
      role: member.role,
      department: member.department || undefined,
      user_id: member.user_id || undefined,
    });
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const payload = {
        member_name: values.member_name,
        role: values.role,
        department: values.department || undefined,
        user_id: values.user_id ? Number(values.user_id) : undefined,
      };
      let resp;
      if (editing) {
        resp = await acceptanceManagementAPI.updateTeamMember(recordId, editing.id, payload);
      } else {
        resp = await acceptanceManagementAPI.addTeamMember(recordId, payload);
      }
      if (resp.success) {
        message.success(editing ? '成员更新成功' : '成员添加成功');
        setModalVisible(false);
        loadData();
      } else {
        message.error(resp.message || '操作失败');
      }
    } catch (e) {
      if (e?.errorFields) return;
      message.error('操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (memberId) => {
    try {
      const resp = await acceptanceManagementAPI.deleteTeamMember(recordId, memberId);
      if (resp.success) {
        message.success('成员已移除');
        loadData();
      } else {
        message.error(resp.message || '删除失败');
      }
    } catch (e) {
      message.error('删除失败');
    }
  };

  const columns = [
    {
      title: '姓名',
      dataIndex: 'member_name',
      key: 'member_name',
      render: t => <Text strong>{t}</Text>,
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 100,
      render: r => <Tag color={roleColorMap[r] || 'default'}>{r}</Tag>,
    },
    {
      title: '所属科室',
      dataIndex: 'department',
      key: 'department',
      render: t => t || '-',
    },
    {
      title: '加入时间',
      dataIndex: 'assigned_at',
      key: 'assigned_at',
      width: 160,
      render: t => (t ? dayjs(t).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      fixed: 'right',
      render: (_, r) => (
        <Space size={4}>
          <Button size="small" type="link" icon={<EditOutlined />} onClick={() => openEdit(r)}>编辑</Button>
          <Popconfirm title="确定移除该成员？" onConfirm={() => handleDelete(r.id)}>
            <Button size="small" type="link" danger icon={<DeleteOutlined />}>移除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/acceptance/${recordId}`)}>返回详情</Button>
          <Title level={2} style={{ margin: 0 }}>验收小组</Title>
        </Space>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData}>刷新</Button>
          {canManage && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>添加成员</Button>
          )}
        </Space>
      </div>

      {record && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Descriptions column={isMobile ? 1 : 3} size="small">
            <Descriptions.Item label="资产编号">{record.asset_code || '-'}</Descriptions.Item>
            <Descriptions.Item label="资产名称">{record.asset_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag>{record.status || '-'}</Tag>
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      <Card size="small" title={`小组成员（${members.length}）`}>
        <div className="hide-on-mobile">
          <Table
            rowKey="id"
            dataSource={members}
            columns={columns}
            loading={loading}
            scroll={{ x: 700 }}
            pagination={false}
            locale={{ emptyText: '暂无小组成员，点击右上角添加' }}
          />
        </div>
        <div className="mobile-table-cards show-on-mobile">
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#8c8c8c' }}>加载中...</div>
          ) : members.length === 0 ? (
            <Empty description="暂无小组成员" />
          ) : (
            members.map(m => (
              <div key={m.id} className="mobile-card-item">
                <div className="mobile-card-header">
                  <span className="mobile-card-title">{m.member_name}</span>
                  <Tag color={roleColorMap[m.role] || 'default'}>{m.role}</Tag>
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
                  <div className="mobile-card-actions">
                    <Button size="small" type="link" icon={<EditOutlined />} onClick={() => openEdit(m)}>编辑</Button>
                    <Popconfirm title="确定移除该成员？" onConfirm={() => handleDelete(m.id)}>
                      <Button size="small" type="link" danger icon={<DeleteOutlined />}>移除</Button>
                    </Popconfirm>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <Modal
        title={editing ? '编辑成员' : '添加成员'}
        open={modalVisible}
        onOk={handleSubmit}
        confirmLoading={submitting}
        onCancel={() => { setModalVisible(false); form.resetFields(); }}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" initialValues={{ role: '成员' }}>
          <Form.Item name="member_name" label="成员姓名" rules={[{ required: true, message: '请输入成员姓名' }]}>
            <Input placeholder="请输入成员姓名" maxLength={50} />
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true }]}>
            <Select options={TEAM_ROLES.map(r => ({ label: r, value: r }))} />
          </Form.Item>
          <Form.Item name="department" label="所属科室">
            <Input placeholder="可选" maxLength={100} />
          </Form.Item>
          <Form.Item name="user_id" label="关联用户ID">
            <Input type="number" placeholder="可选，关联系统用户主键，用于飞书通知定位接收人" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AcceptanceTeam;
