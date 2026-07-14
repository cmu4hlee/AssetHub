import React, { useState, useEffect } from 'react';
import { Descriptions, Button, message, Divider } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeftOutlined, EditOutlined } from '@ant-design/icons';
import { departmentsAPI } from '../utils/api';

const DepartmentDetail = () => {
  const [department, setDepartment] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { id } = useParams();

  // 加载部门详情
  const fetchDepartmentDetail = async () => {
    if (!id) return;

    setLoading(true);
    try {
      const result = await departmentsAPI.getDepartmentById(id);
      if (result.success) {
        setDepartment(result.data);
      } else {
        message.error('获取部门详情失败: ' + result.message);
        navigate('/departments');
      }
    } catch (error) {
      message.error('获取部门详情失败: ' + error.message);
      navigate('/departments');
    } finally {
      setLoading(false);
    }
  };

  // 初始化加载数据
  useEffect(() => {
    fetchDepartmentDetail();
  }, [id]);

  // 部门类型中文映射
  const departmentTypeMap = {
    technical: '技术部门',
    management: '管理部门',
    financial: '财务部门',
    human_resources: '人事部门',
    sales: '销售部门',
    operations: '运营部门',
    other: '其他部门',
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px 0' }}>加载中...</div>;
  }

  if (!department) {
    return <div style={{ textAlign: 'center', padding: '40px 0' }}>部门不存在</div>;
  }

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
        <h2 style={{ margin: 0 }}>部门详情</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/departments')}>
            返回列表
          </Button>
          <Button
            type="primary"
            icon={<EditOutlined />}
            onClick={() => navigate(`/departments/edit/${id}`)}
          >
            编辑部门
          </Button>
        </div>
      </div>

      <Divider titlePlacement="left">基本信息</Divider>

      <Descriptions bordered column={2} size="middle">
        <Descriptions.Item label="部门编码">{department.department_code}</Descriptions.Item>
        <Descriptions.Item label="部门名称">{department.department_name}</Descriptions.Item>
        <Descriptions.Item label="部门类型">
          {departmentTypeMap[department.department_type] || department.department_type}
        </Descriptions.Item>
        <Descriptions.Item label="负责人">{department.manager}</Descriptions.Item>
        <Descriptions.Item label="联系方式">{department.contact_info}</Descriptions.Item>
        <Descriptions.Item label="创建时间">
          {department.created_at ? new Date(department.created_at).toLocaleString() : '-'}
        </Descriptions.Item>
        <Descriptions.Item label="更新时间" span={2}>
          {department.updated_at ? new Date(department.updated_at).toLocaleString() : '-'}
        </Descriptions.Item>
      </Descriptions>

      {department.description && (
        <>
          <Divider titlePlacement="left">部门描述</Divider>
          <div
            style={{
              padding: '16px',
              border: '1px solid #f0f0f0',
              borderRadius: '4px',
              backgroundColor: '#fafafa',
            }}
          >
            {department.description}
          </div>
        </>
      )}

      {department.remarks && (
        <>
          <Divider titlePlacement="left">备注</Divider>
          <div
            style={{
              padding: '16px',
              border: '1px solid #f0f0f0',
              borderRadius: '4px',
              backgroundColor: '#fafafa',
            }}
          >
            {department.remarks}
          </div>
        </>
      )}
    </div>
  );
};

export default DepartmentDetail;
