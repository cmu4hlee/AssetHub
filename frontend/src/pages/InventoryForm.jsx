import React, { useState, useEffect } from 'react';
import { Form, Input, DatePicker, Button, message, Select, Card, Space, Switch } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { inventoryAPI, assetAPI } from '../utils/api';
import { useCurrentUser } from '../hooks';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

const InventoryForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [form] = Form.useForm();
  const { user, loading: userLoading } = useCurrentUser();
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState([]);
  const isEdit = !!id;

  // 加载用户信息
  useEffect(() => {
    if (user) {
      // 如果是新建，自动填充盘点人
      if (!isEdit && user.real_name) {
        form.setFieldsValue({ inventory_person: user.real_name });
      }
    }
  }, [isEdit, user, userLoading]);

  // 加载科室列表
  useEffect(() => {
    loadDepartments();
  }, []);

  const loadDepartments = async () => {
    try {
      const result = await assetAPI.getDepartments();
      if (result.success) {
        setDepartments(result.data);
      }
    } catch (error) {
      console.error('加载科室列表失败:', error);
    }
  };

  // 生成盘点单号 - 使用时间戳+计数器避免高并发重复
  const generateInventoryNo = () => {
    const date = dayjs().format('YYYYMMDD');
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 100)
      .toString()
      .padStart(2, '0');
    return `PD${date}${timestamp}${random}`;
  };

  // 加载盘点记录数据（编辑模式下）
  const loadInventoryData = async () => {
    if (!isEdit) {
      // 新建时自动生成盘点单号
      const inventoryNo = generateInventoryNo();
      form.setFieldsValue({ inventory_no: inventoryNo });
      return;
    }

    try {
      setLoading(true);
      const result = await inventoryAPI.getInventory(id);
      if (result.success) {
        const inventory = result.data;
        form.setFieldsValue({
          ...inventory,
          inventory_date: inventory.inventory_date ? dayjs(inventory.inventory_date) : null,
          self_check_start: inventory.self_check_start ? dayjs(inventory.self_check_start) : null,
          self_check_end: inventory.self_check_end ? dayjs(inventory.self_check_end) : null,
          self_check_enabled: !!inventory.self_check_enabled,
        });
      } else {
        message.error('获取盘点记录失败');
        navigate('/inventory');
      }
    } catch (error) {
      message.error('获取盘点记录失败');
      navigate('/inventory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInventoryData();
  }, [id]);

  // 处理表单提交
  const handleSubmit = async values => {
    try {
      setLoading(true);

      const submitData = {
        ...values,
        inventory_date: values.inventory_date ? values.inventory_date.format('YYYY-MM-DD') : null,
        self_check_start: values.self_check_start
          ? values.self_check_start.format('YYYY-MM-DD HH:mm:ss')
          : null,
        self_check_end: values.self_check_end
          ? values.self_check_end.format('YYYY-MM-DD HH:mm:ss')
          : null,
      };

      if (isEdit) {
        // 更新盘点记录
        const result = await inventoryAPI.updateInventory(id, submitData);
        if (result.success) {
          message.success('盘点记录更新成功');
          navigate('/inventory');
        } else {
          message.error(result.message || '更新失败');
        }
      } else {
        // 创建新盘点记录
        const result = await inventoryAPI.createInventory(submitData);
        if (result.success) {
          message.success('盘点记录创建成功');
          navigate(`/inventory/${result.data.id}`);
        } else {
          message.error(result.message || '创建失败');
        }
      }
    } catch (error) {
      message.error('操作失败，请稍后重试');
      console.error('操作失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 取消操作
  const handleCancel = () => {
    navigate('/inventory');
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button onClick={handleCancel}>返回列表</Button>
      </div>

      <Card title={isEdit ? '编辑盘点记录' : '新建盘点记录'}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          style={{ maxWidth: 600 }}
          initialValues={{
            inventory_date: dayjs(),
            status: '进行中',
            self_check_enabled: false,
            self_check_scope: 'mine',
          }}
        >
          <Form.Item
            name="inventory_no"
            label="盘点单号"
            rules={[{ required: true, message: '请输入盘点单号' }]}
          >
            <Input placeholder="请输入盘点单号" disabled={isEdit} />
          </Form.Item>

          <Form.Item
            name="inventory_date"
            label="盘点日期"
            rules={[{ required: true, message: '请选择盘点日期' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="inventory_type"
            label="盘点类型"
            rules={[{ required: true, message: '请选择盘点类型' }]}
          >
            <Select placeholder="请选择盘点类型">
              <Option value="全面盘点">全面盘点</Option>
              <Option value="抽查盘点">抽查盘点</Option>
              <Option value="专项盘点">专项盘点</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="inventory_person"
            label="盘点人"
            rules={[{ required: true, message: '请输入盘点人' }]}
          >
            <Input placeholder="请输入盘点人" />
          </Form.Item>

          <Form.Item name="remark" label="备注">
            <TextArea rows={3} placeholder="请输入备注（可选）" />
          </Form.Item>

          <Form.Item label="启用自助盘点" name="self_check_enabled" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item shouldUpdate={(prev, cur) => prev.self_check_enabled !== cur.self_check_enabled}>
            {({ getFieldValue }) =>
              getFieldValue('self_check_enabled') ? (
                <>
                  <Form.Item
                    name="self_check_scope"
                    label="自助盘点范围"
                    rules={[{ required: true, message: '请选择盘点范围' }]}
                  >
                    <Select placeholder="选择范围">
                      <Option value="mine">仅我的资产</Option>
                      <Option value="department">本科室资产</Option>
                      <Option value="all">全量资产</Option>
                    </Select>
                  </Form.Item>
                  <Form.Item name="self_check_start" label="盘点开始时间">
                    <DatePicker showTime style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item name="self_check_end" label="盘点结束时间">
                    <DatePicker showTime style={{ width: '100%' }} />
                  </Form.Item>
                </>
              ) : null
            }
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>
                {isEdit ? '保存更新' : '创建盘点记录'}
              </Button>
              <Button onClick={handleCancel} loading={loading}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default InventoryForm;
