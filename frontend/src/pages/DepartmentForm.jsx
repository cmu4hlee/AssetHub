import React, { useState, useEffect } from 'react';
import { Form, Input, Button, message, Select, Space } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { departmentsAPI } from '../utils/api';

const { Option } = Select;

const DepartmentForm = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const navigate = useNavigate();
  const { id } = useParams();

  // 表单验证规则
  const formRules = {
    department_code: [
      { required: true, message: '请输入部门编码' },
      { min: 2, max: 20, message: '部门编码长度在 2 到 20 个字符' },
      { pattern: /^[a-zA-Z0-9-_]+$/, message: '部门编码只能包含字母、数字、- 和 _' },
    ],
    department_name: [
      { required: true, message: '请输入部门名称' },
      { min: 2, max: 50, message: '部门名称长度在 2 到 50 个字符' },
    ],
  };

  // 加载部门数据（编辑模式）
  const loadDepartmentData = async () => {
    if (!id) return;

    setLoading(true);
    try {
      const result = await departmentsAPI.getDepartmentById(id);
      if (result.success) {
        form.setFieldsValue(result.data);
        setIsEditing(true);
      } else {
        message.error('获取部门数据失败: ' + result.message);
        navigate('/departments');
      }
    } catch (error) {
      message.error('获取部门数据失败: ' + error.message);
      navigate('/departments');
    } finally {
      setLoading(false);
    }
  };

  // 保存部门数据
  const handleSave = async values => {
    setLoading(true);
    try {
      let result;
      if (isEditing) {
        result = await departmentsAPI.updateDepartment(id, values);
      } else {
        result = await departmentsAPI.createDepartment(values);
      }

      if (result.success) {
        message.success(isEditing ? '部门更新成功' : '部门创建成功');
        navigate('/departments');
      } else {
        message.error((isEditing ? '更新' : '创建') + '部门失败: ' + result.message);
      }
    } catch (error) {
      message.error((isEditing ? '更新' : '创建') + '部门失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 初始化
  useEffect(() => {
    loadDepartmentData();
  }, [id]);

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>{isEditing ? '编辑部门' : '新增部门'}</h2>
      </div>

      <Form form={form} layout="vertical" onFinish={handleSave} loading={loading}>
        <Form.Item label="部门编码" name="department_code" rules={formRules.department_code}>
          <Input placeholder="请输入部门编码（如：tech-001）" />
        </Form.Item>

        <Form.Item label="部门名称" name="department_name" rules={formRules.department_name}>
          <Input placeholder="请输入部门名称" />
        </Form.Item>

        <Form.Item label="描述" name="description">
          <Input.TextArea placeholder="请输入部门描述（可选）" rows={4} />
        </Form.Item>

        <Form.Item label="备注" name="remarks">
          <Input.TextArea placeholder="请输入备注信息（可选）" rows={3} />
        </Form.Item>

        <Form.Item>
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={() => navigate('/departments')} style={{ marginRight: 8 }}>
              取消
            </Button>
            <Button type="primary" htmlType="submit" loading={loading}>
              {isEditing ? '更新部门' : '创建部门'}
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </div>
  );
};

export default DepartmentForm;
