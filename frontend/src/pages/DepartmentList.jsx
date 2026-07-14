import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, message, Popconfirm, Input, Form } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { departmentsAPI } from '../utils/api';
import { useIsMobile, useCan } from '../hooks';

const DepartmentList = () => {
  const canDelete = useCan('department', 'delete');
  const canEdit = useCan('department', 'edit');
  const isMobile = useIsMobile();
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filteredDepartments, setFilteredDepartments] = useState([]);
  const navigate = useNavigate();

  // 加载部门列表
  const fetchDepartments = async () => {
    setLoading(true);
    try {
      const result = await departmentsAPI.getDepartments();
      if (result.success) {
        setDepartments(result.data);
        setFilteredDepartments(result.data);
      } else {
        message.error('获取部门列表失败: ' + result.message);
      }
    } catch (error) {
      message.error('获取部门列表失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 删除部门
  const handleDeleteDepartment = async (id, name) => {
    try {
      const result = await departmentsAPI.deleteDepartment(id);
      if (result.success) {
        message.success(`删除部门 "${name}" 成功`);
        fetchDepartments();
      } else {
        message.error('删除部门失败: ' + result.message);
      }
    } catch (error) {
      message.error('删除部门失败: ' + error.message);
    }
  };

  // 搜索过滤
  const handleSearch = value => {
    setSearchText(value);
    if (value) {
      const filtered = departments.filter(
        dept =>
          dept.department_name.toLowerCase().includes(value.toLowerCase()) ||
          dept.department_code.toLowerCase().includes(value.toLowerCase()) ||
          dept.description?.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredDepartments(filtered);
    } else {
      setFilteredDepartments(departments);
    }
  };

  // 初始化加载数据
  useEffect(() => {
    fetchDepartments();
  }, []);

  // 表格列定义
  const columns = [
    {
      title: '部门编码',
      dataIndex: 'department_code',
      key: 'department_code',
      width: 120,
      sorter: (a, b) => a.department_code.localeCompare(b.department_code),
    },
    {
      title: '部门名称',
      dataIndex: 'department_name',
      key: 'department_name',
      sorter: (a, b) => a.department_name.localeCompare(b.department_name),
    },
    {
      title: '部门类型',
      dataIndex: 'department_type',
      key: 'department_type',
      width: 120,
      sorter: (a, b) => (a.department_type || '').localeCompare(b.department_type || ''),
    },
    {
      title: '负责人',
      dataIndex: 'manager',
      key: 'manager',
      width: 120,
    },
    {
      title: '联系方式',
      dataIndex: 'contact_info',
      key: 'contact_info',
      width: 150,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space size="middle">
          <Button
            type="link"
            icon={<EditOutlined />}
            size="small"
            onClick={() => navigate(`/departments/edit/${record.id}`)}
          >
            编辑
          </Button>
          <Popconfirm
            title={`确定要删除部门 "${record.department_name}" 吗？`}
            onConfirm={() => handleDeleteDepartment(record.id, record.department_name)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />} disabled={!canDelete} size="small">
              删除
            </Button>
          </Popconfirm>
          <Button type="link" size="small" onClick={() => navigate(`/departments/${record.id}`)}>
            详情
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <h2 style={{ margin: 0 }}>部门管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/departments/new')}>
          新增部门
        </Button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Form layout="inline">
          <Form.Item>
            <Input
              placeholder="搜索部门名称、编码或描述"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={e => handleSearch(e.target.value)}
              allowClear
            />
          </Form.Item>
        </Form>
      </div>

      <div className="hide-on-mobile">
        <Table
          columns={columns}
          dataSource={filteredDepartments}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: total => `共 ${total} 个部门`,
          }}
          bordered
        />
      </div>
      <div className="mobile-table-cards show-on-mobile">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>加载中...</div>
        ) : Array.isArray(filteredDepartments) && filteredDepartments.length > 0 ? (
          filteredDepartments.map(record => (
            <div key={record.id} className="mobile-card-item">
              <div className="mobile-card-header">
                <span className="mobile-card-title">{record.department_name}</span>
              </div>
              <div className="mobile-card-body">
                <div className="mobile-card-field">
                  <span className="mobile-card-label">部门编码</span>
                  <span className="mobile-card-value">{record.department_code || '-'}</span>
                </div>
                <div className="mobile-card-field">
                  <span className="mobile-card-label">部门类型</span>
                  <span className="mobile-card-value">{record.department_type || '-'}</span>
                </div>
                <div className="mobile-card-field">
                  <span className="mobile-card-label">负责人</span>
                  <span className="mobile-card-value">{record.manager || '-'}</span>
                </div>
                <div className="mobile-card-field">
                  <span className="mobile-card-label">联系方式</span>
                  <span className="mobile-card-value">{record.contact_info || '-'}</span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>暂无数据</div>
        )}
      </div>
    </div>
  );
};

export default DepartmentList;
