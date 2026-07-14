import React, { useEffect, useState } from 'react';
import {
  Form, Input, Select, DatePicker, InputNumber, Button, Space, message,
  Card, Row, Col, Alert,
} from 'antd';
import { SaveOutlined, RollbackOutlined, FileTextOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { tenderingAPI } from '../../api/domains/tendering';
import { assetAPI } from '../../utils/api';
import {
  TENDER_TYPE,
  TENDER_METHOD,
  TENDER_STATUS,
  formatMoney,
} from '../../constants/tendering';
import { PageHeader, StatusTag } from '../../components/tendering';

const TYPE_OPTIONS = Object.entries(TENDER_TYPE).map(([k, v]) => ({ value: k, label: v.text }));
const METHOD_OPTIONS = Object.entries(TENDER_METHOD).map(([k, v]) => ({ value: k, label: v.text }));
const CURRENCY_OPTIONS = [
  { value: 'CNY', label: '人民币 CNY' },
  { value: 'USD', label: '美元 USD' },
  { value: 'EUR', label: '欧元 EUR' },
];

export default function TenderProjectForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [initial, setInitial] = useState(null);
  const [assets, setAssets] = useState([]);
  const [assetLoading, setAssetLoading] = useState(false);

  // 资产可搜索下拉
  const handleAssetSearch = keyword => {
    if (!keyword || keyword.length < 1) {
      setAssets([]);
      return;
    }
    setAssetLoading(true);
    assetAPI
      .getAssets({ keyword, page: 1, pageSize: 20 })
      .then(res => setAssets(res?.data || []))
      .catch(err => console.error('搜索资产失败:', err))
      .finally(() => setAssetLoading(false));
  };
  const handleAssetSelect = value => {
    const hit = assets.find(a => a.asset_code === value);
    if (hit) {
      form.setFieldsValue({
        asset_code: hit.asset_code,
        asset_name: hit.asset_name,
      });
    }
  };

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      setLoading(true);
      try {
        const res = await tenderingAPI.getProject(id);
        const data = res?.data ?? res;
        setInitial(data);
        form.setFieldsValue({
          ...data,
          publish_date: data.publish_date ? dayjs(data.publish_date) : null,
          deadline: data.deadline ? dayjs(data.deadline) : null,
          open_bid_date: data.open_bid_date ? dayjs(data.open_bid_date) : null,
        });
      } catch (err) {
        message.error('获取招标项目失败');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isEdit, form]);

  const handleSubmit = async values => {
    setSubmitting(true);
    try {
      const payload = {
        ...values,
        publish_date: values.publish_date ? values.publish_date.format('YYYY-MM-DD') : null,
        deadline: values.deadline ? values.deadline.format('YYYY-MM-DDTHH:mm:ss') : null,
        open_bid_date: values.open_bid_date ? values.open_bid_date.format('YYYY-MM-DDTHH:mm:ss') : null,
      };
      if (isEdit) {
        await tenderingAPI.updateProject(id, payload);
        message.success('保存成功');
        navigate(`/tendering/projects/${id}`);
      } else {
        const res = await tenderingAPI.createProject(payload);
        message.success('创建成功');
        const newId = res?.data?.id ?? res?.id;
        if (newId) {
          navigate(`/tendering/projects/${newId}/document`);
          return;
        }
      }
      navigate('/tendering/projects');
    } catch (err) {
      message.error(err.response?.data?.message || '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  const isPublished = initial && initial.status !== 'draft' && initial.status !== 'cancelled';

  return (
    <div>
      <PageHeader
        title={isEdit ? '编辑招标项目' : '新建招标项目'}
        description={isEdit && initial?.tender_code ? `招标编号：${initial.tender_code}` : '填写招标项目信息，发布后供应商可见'}
        onBack={() => navigate('/tendering/projects')}
        statusTag={initial ? <StatusTag status={initial.status} statusMap={TENDER_STATUS} /> : null}
      />

      {isPublished ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="此招标项目已发布，仅关键字段可编辑。修改日期/联系人等信息请联系管理员。"
        />
      ) : null}

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          tender_type: 'asset_purchase',
          tender_method: 'public',
          currency: 'CNY',
        }}
      >
        <Row gutter={16}>
          <Col xs={24} lg={16}>
            {/* 基础信息 */}
            <Card
              size="small"
              title="基础信息"
              style={{ marginBottom: 16 }}
            >
              <Form.Item
                label="项目名称"
                name="title"
                rules={[
                  { required: true, message: '请输入项目名称' },
                  { max: 255, message: '不能超过 255 字' },
                ]}
                extra="清晰描述招标内容，如：医用CT设备采购招标"
              >
                <Input placeholder="如：医用CT设备采购招标" showCount maxLength={255} />
              </Form.Item>

              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label="招标类型"
                    name="tender_type"
                    rules={[{ required: true, message: '请选择招标类型' }]}
                  >
                    <Select options={TYPE_OPTIONS} placeholder="请选择" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label="招标方式"
                    name="tender_method"
                    extra="公开招标:面向所有合格供应商;邀请招标:定向邀请"
                  >
                    <Select options={METHOD_OPTIONS} placeholder="请选择" />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            {/* 资产关联 */}
            <Card
              size="small"
              title="资产关联"
              style={{ marginBottom: 16 }}
            >
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label="关联资产编号"
                    name="asset_code"
                    extra="配件/维修类招标必填"
                  >
                    <Select
                      showSearch
                      placeholder="输入资产编号或名称关键字"
                      loading={assetLoading}
                      filterOption={false}
                      onSearch={handleAssetSearch}
                      onChange={handleAssetSelect}
                      notFoundContent={assetLoading ? '加载中...' : '未找到匹配资产'}
                      optionLabelProp="label"
                    >
                      {assets.map(a => (
                        <Select.Option
                          key={a.asset_code}
                          value={a.asset_code}
                          label={`${a.asset_code} - ${a.asset_name}`}
                        >
                          <div>
                            <div>{a.asset_code} - {a.asset_name}</div>
                            <div style={{ color: '#8c8c8c', fontSize: 12 }}>
                              ''
                            </div>
                          </div>
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item label="关联资产名称" name="asset_name">
                    <Input placeholder="选择资产后自动填充" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item label="需求部门" name="department">
                <Input placeholder="如：放射科" />
              </Form.Item>
            </Card>

            {/* 预算与时间 */}
            <Card
              size="small"
              title="预算与时间"
              style={{ marginBottom: 16 }}
            >
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label="预算/控制金额"
                    name="budget_amount"
                    rules={[
                      { required: true, message: '请填写预算' },
                      { type: 'number', min: 0, message: '预算必须≥0' },
                    ]}
                    extra="采购金额将以此为上限"
                  >
                    <InputNumber
                      style={{ width: '100%' }}
                      min={0}
                      precision={2}
                      placeholder="0.00"
                      formatter={v => `¥ ${v || ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={v => v.replace(/¥\s?|,/g, '')}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label="币种"
                    name="currency"
                    rules={[{ required: true }]}
                  >
                    <Select options={CURRENCY_OPTIONS} />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} sm={8}>
                  <Form.Item label="发布日期" name="publish_date">
                    <DatePicker style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item
                    label="投标截止时间"
                    name="deadline"
                    extra="必须晚于发布日期"
                  >
                    <DatePicker showTime style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item label="开标时间" name="open_bid_date">
                    <DatePicker showTime style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            {/* 联系人与详情 */}
            <Card
              size="small"
              title="联系人与详情"
              style={{ marginBottom: 16 }}
            >
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item label="联系人" name="contact_person">
                    <Input placeholder="联系人姓名" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label="联系电话"
                    name="contact_phone"
                    rules={[{ pattern: /^[\d-]*$/, message: '请输入合法电话' }]}
                  >
                    <Input placeholder="如：13800000000" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                label="项目概况与需求说明"
                name="description"
                extra="详细描述技术需求、服务范围、验收标准等"
              >
                <Input.TextArea
                  rows={4}
                  placeholder="项目概况、技术参数、配置要求等"
                />
              </Form.Item>

              <Form.Item label="备注" name="remark">
                <Input.TextArea rows={2} placeholder="其他需要说明的事项" />
              </Form.Item>
            </Card>
          </Col>

          {/* 侧栏 */}
          <Col xs={24} lg={8}>
            <Card size="small" title="操作指引" style={{ marginBottom: 16 }}>
              <Space orientation="vertical" size="small" style={{ width: '100%' }}>
                <div style={{ fontSize: 13, lineHeight: 1.7, color: '#595959' }}>
                  <strong>1. 填写信息</strong>：完整填写项目信息
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.7, color: '#595959' }}>
                  <strong>2. 创建项目</strong>：保存草稿状态
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.7, color: '#595959' }}>
                  <strong>3. 制作招标文件</strong>：跳转至招标文件编辑
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.7, color: '#595959' }}>
                  <strong>4. 发布招标</strong>：发布后供应商可见并投标
                </div>
                <div style={{ fontSize: 12, lineHeight: 1.7, color: '#8c8c8c' }}>
                  发布后不能再修改关键字段
                </div>
              </Space>
            </Card>

            {initial?.budget_amount ? (
              <Card size="small" title="当前预算">
                <div style={{ fontSize: 24, fontWeight: 600, color: '#fa8c16' }}>
                  {formatMoney(initial.budget_amount)}
                </div>
                {initial.department ? (
                  <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>
                    需求部门：{initial.department}
                  </div>
                ) : null}
              </Card>
            ) : null}
          </Col>
        </Row>

        {/* 底部操作 */}
        <Card size="small" style={{ background: '#fafbfc' }}>
          <Space wrap>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              htmlType="submit"
              loading={submitting}
            >
              {isEdit ? '保存' : '创建并制作招标文件'}
            </Button>
            {isEdit ? (
              <Button
                icon={<FileTextOutlined />}
                onClick={() => navigate(`/tendering/projects/${id}/document`)}
              >
                制作招标文件
              </Button>
            ) : null}
            <Button
              icon={<RollbackOutlined />}
              onClick={() => navigate('/tendering/projects')}
            >
              返回列表
            </Button>
          </Space>
        </Card>
      </Form>
    </div>
  );
}
