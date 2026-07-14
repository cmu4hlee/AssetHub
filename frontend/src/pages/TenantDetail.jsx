import { useState, useEffect } from 'react';
import { Descriptions, Button, Card, Tag, Spin, message, Space, Statistic, Row, Col } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { tenantAPI } from '../utils/api';
import dayjs from 'dayjs';

const TenantDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [tenant, setTenant] = useState(null);

  useEffect(() => {
    loadTenant();
  }, [id]);

  const loadTenant = async () => {
    try {
      setLoading(true);
      const result = await tenantAPI.getTenant(id);
      if (result.success) {
        setTenant(result.data);
      }
    } catch (error) {
      message.error(error.response?.data?.message || '加载企业信息失败');
      navigate('/tenants');
    } finally {
      setLoading(false);
    }
  };

  const getStatusTag = status => {
    return status === 'active' ? <Tag color="success">启用</Tag> : <Tag color="error">停用</Tag>;
  };

  const getSubscriptionTypeTag = type => {
    const typeMap = {
      free: { text: '免费版', color: 'default' },
      basic: { text: '基础版', color: 'blue' },
      premium: { text: '高级版', color: 'purple' },
      enterprise: { text: '企业版', color: 'gold' },
    };
    const config = typeMap[type] || { text: type, color: 'default' };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!tenant) {
    return null;
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button onClick={() => navigate('/tenants')}>返回列表</Button>
        <Button
          type="primary"
          style={{ marginLeft: 8 }}
          onClick={() => navigate(`/tenants/edit/${id}`)}
        >
          编辑
        </Button>
      </div>

      <Card title="企业基本信息">
        <Descriptions bordered column={{ xxl: 2, xl: 2, lg: 2, md: 1, sm: 1, xs: 1 }}>
          <Descriptions.Item label="企业编码">{tenant.tenant_code}</Descriptions.Item>
          <Descriptions.Item label="企业名称">{tenant.tenant_name}</Descriptions.Item>
          <Descriptions.Item label="状态">{getStatusTag(tenant.status)}</Descriptions.Item>
          <Descriptions.Item label="订阅类型">
            {getSubscriptionTypeTag(tenant.subscription_type)}
          </Descriptions.Item>
          <Descriptions.Item label="联系人">{tenant.contact_person || '-'}</Descriptions.Item>
          <Descriptions.Item label="联系电话">{tenant.contact_phone || '-'}</Descriptions.Item>
          <Descriptions.Item label="联系邮箱">{tenant.contact_email || '-'}</Descriptions.Item>
          <Descriptions.Item label="企业地址" span={1}>
            {tenant.address || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="营业执照号">{tenant.license_no || '-'}</Descriptions.Item>
          <Descriptions.Item label="最大用户数">{tenant.max_users || '-'}</Descriptions.Item>
          <Descriptions.Item label="最大资产数">{tenant.max_assets || '-'}</Descriptions.Item>
          <Descriptions.Item label="订阅开始日期">
            {tenant.subscription_start_date
              ? dayjs(tenant.subscription_start_date).format('YYYY-MM-DD')
              : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="订阅结束日期">
            {tenant.subscription_end_date
              ? dayjs(tenant.subscription_end_date).format('YYYY-MM-DD')
              : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {tenant.created_at ? dayjs(tenant.created_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="更新时间">
            {tenant.updated_at ? dayjs(tenant.updated_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
          </Descriptions.Item>
          {tenant.remark && (
            <Descriptions.Item label="备注" span={1}>
              {tenant.remark}
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      {tenant.statistics && (
        <Card title="统计信息" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={12} lg={8}>
              <Statistic
                title="用户数量"
                value={tenant.statistics.user_count || 0}
                styles={{ content: { color: '#1890ff' } }}
              />
            </Col>
            <Col xs={24} sm={12} md={12} lg={8}>
              <Statistic
                title="资产数量"
                value={tenant.statistics.asset_count || 0}
                styles={{ content: { color: '#52c41a' } }}
              />
            </Col>
          </Row>
        </Card>
      )}
    </div>
  );
};

export default TenantDetail;
