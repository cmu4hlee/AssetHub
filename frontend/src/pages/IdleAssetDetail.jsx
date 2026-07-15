import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Descriptions, Tag, Button, Space, Spin, message,
  Typography, Divider, Timeline, Modal, Input, DatePicker,
} from 'antd';
import {
  ArrowLeftOutlined, GiftOutlined, CheckCircleOutlined,
  StopOutlined, DeleteOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { idleAPI } from '../utils/api';

const { Title, Text } = Typography;
const { confirm } = Modal;

const statusColorMap = {
  发布中: 'processing',
  已分配: 'success',
  已取消: 'default',
};

const IdleAssetDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [assignModalVisible, setAssignModalVisible] = useState(false);

  const loadDetail = async () => {
    try {
      setLoading(true);
      const result = await idleAPI.getIdleAsset(id);
      if (result.success) {
        setRecord(result.data);
      } else {
        message.error('获取详情失败');
        navigate('/idle');
      }
    } catch (error) {
      message.error('获取详情失败');
      navigate('/idle');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
  }, [id]);

  const handleAssign = async values => {
    try {
      const dateStr = values.allocated_date
        ? values.allocated_date.format('YYYY-MM-DD')
        : dayjs().format('YYYY-MM-DD');
      const result = await idleAPI.allocateIdleAsset(id, {
        allocated_to: values.allocated_to,
        allocated_date: dateStr,
      });
      if (result.success) {
        message.success('分配成功');
        setAssignModalVisible(false);
        loadDetail();
      }
    } catch (error) {
      message.error(error.response?.data?.message || '分配失败');
    }
  };

  const handleCancel = () => {
    confirm({
      title: '确定取消此闲置资产发布？',
      content: '取消后，该资产将不再出现在发布列表中。',
      okText: '确定取消',
      cancelText: '返回',
      onOk: async () => {
        try {
          const result = await idleAPI.cancelIdleAsset(id);
          if (result.success) {
            message.success('已取消发布');
            loadDetail();
          }
        } catch (error) {
          message.error('取消失败');
        }
      },
    });
  };

  const handleDelete = () => {
    confirm({
      title: '确定删除此闲置资产记录？',
      content: '此操作不可恢复。',
      okText: '确定删除',
      okType: 'danger',
      cancelText: '返回',
      onOk: async () => {
        try {
          const result = await idleAPI.deleteIdleAsset(id);
          if (result.success) {
            message.success('删除成功');
            navigate('/idle');
          }
        } catch (error) {
          message.error('删除失败');
        }
      },
    });
  };

  if (loading) {
    return (
      <div className="p-4" style={{ textAlign: 'center', paddingTop: 100 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!record) return null;

  const idleDays = record.idle_days !== undefined && record.idle_days !== null
    ? record.idle_days
    : (record.publish_date ? dayjs().diff(dayjs(record.publish_date), 'day') : 0);

  const isPublishing = record.status === '发布中';
  const isAllocated = record.status === '已分配';
  const isCancelled = record.status === '已取消';
  const isTempAsset = record.asset_source === '临时' || (record.asset_code && record.asset_code.startsWith('TEMP_'));

  return (
    <div className="p-4">
      <div className="flex items-center mb-4">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/idle')} className="mr-2">
          返回列表
        </Button>
        <Title level={4} style={{ margin: 0 }}>
          闲置资产详情
        </Title>
      </div>

      <Card>
        <div className="flex justify-between items-start mb-4">
          <div>
            <Space size="middle">
              <Title level={4} style={{ margin: 0 }}>
                {record.asset_code || '临时资产'}
              </Title>
              <Tag color={statusColorMap[record.status]}>{record.status}</Tag>
              {isTempAsset && <Tag color="purple">临时资产</Tag>}
            </Space>
            <div style={{ marginTop: 4 }}>
              <Text type="secondary">{record.asset_name || ''}</Text>
            </div>
          </div>

          {isPublishing && (
            <Space>
              <Button type="primary" icon={<CheckCircleOutlined />}
                onClick={() => setAssignModalVisible(true)}>
                分配
              </Button>
              <Button icon={<StopOutlined />} onClick={handleCancel}>
                取消发布
              </Button>
              <Button danger icon={<DeleteOutlined />} onClick={handleDelete}>
                删除
              </Button>
            </Space>
          )}
        </div>

        <Divider />

        <Descriptions bordered column={{ xs: 1, sm: 2, md: 3 }}>
          <Descriptions.Item label="资产编号">
            {record.asset_code || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="资产名称">
            {record.asset_name || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="资产类型">
            {record.asset_type || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="品牌">
            {record.brand || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="型号">
            {record.model || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="规格">
            {record.specification || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="所属部门">
            {record.department || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="存放位置">
            {record.location || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="当前价值">
            {record.current_value ? `¥${Number(record.current_value).toLocaleString()}` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="购入日期">
            {record.purchase_date || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="购入价格">
            {record.purchase_price ? `¥${Number(record.purchase_price).toLocaleString()}` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="资产原状态">
            {record.asset_status || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="发布日期">
            {record.publish_date || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="发布人">
            {record.publish_person || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="闲置天数">
            <Tag color={idleDays >= 30 ? 'red' : idleDays >= 7 ? 'orange' : 'blue'}>
              {idleDays} 天
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="用途">
            {record.expected_use || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="联系人">
            {record.contact_person || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="联系电话">
            {record.contact_phone || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="备注" span={2}>
            {record.remark || '-'}
          </Descriptions.Item>
          {isAllocated && (
            <>
              <Descriptions.Item label="分配对象">
                {record.allocated_to || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="分配日期">
                {record.allocated_date || '-'}
              </Descriptions.Item>
            </>
          )}
        </Descriptions>

        <Divider />

        {/* 简单的时间线 */}
        <Title level={5}>发布记录</Title>
        <Timeline
          items={[
            {
              color: isCancelled ? 'gray' : (isAllocated ? 'green' : 'blue'),
              children: (
                <div>
                  <Text strong>{record.publish_date || '-'}</Text>
                  <br />
                  <Text type="secondary">{record.publish_person} 发布了闲置资产</Text>
                </div>
              ),
            },
            ...(isAllocated
              ? [{
                  color: 'green',
                  children: (
                    <div>
                      <Text strong>{record.allocated_date || '-'}</Text>
                      <br />
                      <Text type="secondary">分配给 {record.allocated_to}</Text>
                    </div>
                  ),
                }]
              : []),
            ...(isCancelled
              ? [{
                  color: 'gray',
                  children: (
                    <div>
                      <Text type="secondary">发布已取消</Text>
                    </div>
                  ),
                }]
              : []),
            {
              color: 'gray',
              children: (
                <Text type="secondary">
                  创建于 {record.created_at ? dayjs(record.created_at).format('YYYY-MM-DD HH:mm') : '-'}
                </Text>
              ),
            },
          ].filter(Boolean)}
        />
      </Card>

      {/* 分配弹窗 */}
      <Modal
        title="分配闲置资产"
        open={assignModalVisible}
        onCancel={() => setAssignModalVisible(false)}
        footer={null}
        destroyOnHidden
      >
        <AssignForm onSubmit={handleAssign} onCancel={() => setAssignModalVisible(false)} />
      </Modal>
    </div>
  );
};

const AssignForm = ({ onSubmit, onCancel }) => {
  const [allocatedTo, setAllocatedTo] = useState('');
  const [allocatedDate, setAllocatedDate] = useState(dayjs());
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!allocatedTo.trim()) {
      message.error('请输入分配对象');
      return;
    }
    setLoading(true);
    await onSubmit({ allocated_to: allocatedTo.trim(), allocated_date: allocatedDate });
    setLoading(false);
  };

  return (
    <div style={{ padding: '16px 0' }}>
      <div style={{ marginBottom: 16 }}>
        <Text strong>分配对象：</Text>
        <Input
          placeholder="请输入接收部门或人员"
          value={allocatedTo}
          onChange={e => setAllocatedTo(e.target.value)}
          style={{ marginTop: 8 }}
        />
      </div>
      <div style={{ marginBottom: 16 }}>
        <Text strong>分配日期：</Text>
        <DatePicker
          value={allocatedDate}
          onChange={d => setAllocatedDate(d)}
          style={{ marginTop: 8, width: '100%' }}
        />
      </div>
      <div style={{ textAlign: 'right' }}>
        <Space>
          <Button onClick={onCancel}>取消</Button>
          <Button type="primary" onClick={handleSubmit} loading={loading}>
            确认分配
          </Button>
        </Space>
      </div>
    </div>
  );
};

export default IdleAssetDetail;
