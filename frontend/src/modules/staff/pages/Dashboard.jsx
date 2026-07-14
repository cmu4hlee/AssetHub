/**
 * 人员资质管理仪表盘
 */

import React, { useState, useEffect } from 'react';
import { useCan } from '../../../hooks';
import { Card, Row, Col, Statistic, Table, Tag, Spin, Button, message, Space, Popconfirm, Modal, Form, Input, Select } from 'antd';
import { TeamOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { staffAPI, userAPI } from '../../../utils/api';

const StaffDashboard = () => {
  const canDelete = useCan('staff', 'delete');
  const canEdit = useCan('staff', 'edit');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [stats, setStats] = useState({ total: 0, valid: 0, expiring: 0, expired: 0 });
  const [staffList, setStaffList] = useState([]);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchData();
    fetchStaffList();
  }, []);

  const fetchStaffList = async () => {
    try {
      const response = await userAPI.getUsers({ pageSize: 100, status: 'active' });
      if (response?.data) {
        setStaffList(response.data);
      } else if (Array.isArray(response)) {
        setStaffList(response);
      }
    } catch (_error) {
      console.error('获取员工列表失败');
    }
  };

  const fetchData = async () => {
    try {
      const response = await staffAPI.getQualifications({ pageSize: 500 });
      if (response?.success) {
        const qualifications = response.data || [];
        // 按员工分组统计
        const staffMap = new Map();
        qualifications.forEach(q => {
          const staffId = q.staff_id || q.user_id;
          if (!staffMap.has(staffId)) {
            staffMap.set(staffId, {
              id: staffId,
              name: q.staff_name || '未知',
              staff_code: q.staff_code || `ST-${String(staffId).padStart(6, '0')}`,
              position: q.qualification_type || '-',
              department: '-',
              status: q.status || 'active',
              qualification_count: 0
            });
          }
          const staff = staffMap.get(staffId);
          staff.qualification_count++;
          // 优先使用过期的状态
          if (q.status === 'expired') staff.status = 'expired';
          else if (q.status === 'expiring' && staff.status !== 'expired') staff.status = 'expiring';
        });
        const staffList = Array.from(staffMap.values());
        setData(staffList);
        setStats({
          total: staffList.length,
          valid: staffList.filter(s => s.status === 'active').length,
          expiring: staffList.filter(s => s.status === 'expiring').length,
          expired: staffList.filter(s => s.status === 'expired').length
        });
      }
    } catch (_error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await staffAPI.deleteStaff(id);
      message.success('删除成功');
      fetchData();
    } catch (_error) {
      message.error('删除失败');
    }
  };

  const handleAddStaff = async () => {
    try {
      const values = await form.validateFields();
      // 使用资质创建接口创建第一个资质记录来关联员工
      if (values.qualification_name) {
        await staffAPI.createQualification({
          staff_id: values.user_id,
          qualification_type: values.qualification_type || 'professional',
          qualification_name: values.qualification_name,
          issue_date: values.issue_date || new Date().toISOString().split('T')[0],
          status: 'active'
        });
        message.success('添加成功');
        setAddModalVisible(false);
        form.resetFields();
        fetchData();
      }
    } catch (_error) {
      message.error('添加失败');
    }
  };

  const columns = [
    { title: '员工编号', dataIndex: 'staff_code', key: 'staff_code' },
    { title: '姓名', dataIndex: 'name', key: 'name' },
    { title: '岗位', dataIndex: 'position', key: 'position' },
    { title: '资质数量', dataIndex: 'qualification_count', key: 'qualification_count', render: v => v || 0 },
    { title: '状态', dataIndex: 'status', key: 'status', render: (v) => {
      const status = { active: { color: 'green', text: '有效' }, expiring: { color: 'orange', text: '即将过期' }, expired: { color: 'red', text: '已过期' } };
      return <Tag color={status[v]?.color}>{status[v]?.text}</Tag>;
    }},
    { title: '操作', key: 'action', render: (_, record) => (
      <Space>
        <Popconfirm title="确认删除?" onConfirm={() => handleDelete(record.id)} disabled={!canDelete}>
          <Button type="link" danger icon={<DeleteOutlined />} disabled={!canDelete}>删除</Button>
        </Popconfirm>
      </Space>
    )}
  ];

  return (
    <div style={{ padding: 24 }}>
      <h1><TeamOutlined /> 人员资质管理</h1>
      <Spin spinning={loading}>
        <Row gutter={16} style={{ marginTop: 24 }}>
          <Col span={6}><Card><Statistic title="员工总数" value={stats.total} /></Card></Col>
          <Col span={6}><Card><Statistic title="资质有效" value={stats.valid} styles={{ content: { color: '#3f8600' } }} /></Card></Col>
          <Col span={6}><Card><Statistic title="即将过期" value={stats.expiring} styles={{ content: { color: '#faad14' } }} /></Card></Col>
          <Col span={6}><Card><Statistic title="已过期" value={stats.expired} styles={{ content: { color: '#cf1322' } }} /></Card></Col>
        </Row>

        <Card title="人员资质列表" extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => { fetchStaffList(); setAddModalVisible(true); }}>新增人员</Button>} style={{ marginTop: 24 }}>
          <Table columns={columns} dataSource={data} rowKey="id" />
        </Card>
      </Spin>

      <Modal
        title="新增人员"
        open={addModalVisible}
        onOk={handleAddStaff}
        onCancel={() => { setAddModalVisible(false); form.resetFields(); }}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="user_id" label="选择员工" rules={[{ required: true }]}>
            <Select placeholder="请选择员工" showSearch optionFilterProp="label">
              {staffList.map(staff => (
                <Select.Option key={staff.id} value={staff.id} label={staff.real_name || staff.username || staff.name}>
                  {staff.real_name || staff.username || staff.name} {staff.department ? `- ${staff.department}` : ''}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="qualification_name" label="初始资质名称" rules={[{ required: true }]}>
            <Input placeholder="请输入资质名称" />
          </Form.Item>
          <Form.Item name="qualification_type" label="资质类型">
            <Select placeholder="请选择资质类型">
              <Select.Option value="professional">专业资质</Select.Option>
              <Select.Option value="skill">技能资质</Select.Option>
              <Select.Option value="safety">安全资质</Select.Option>
              <Select.Option value="special">特殊资质</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default StaffDashboard;
