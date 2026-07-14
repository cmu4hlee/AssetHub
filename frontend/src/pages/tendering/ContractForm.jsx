import React, { useState, useEffect, useCallback } from 'react';
import {
  Form, Input, Select, DatePicker, InputNumber, Button, Space, message,
  Card, Row, Col, Spin, Alert, Descriptions,
} from 'antd';
import { SaveOutlined, RollbackOutlined, FileTextOutlined } from '@ant-design/icons';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { tenderingAPI } from '../../api/domains/tendering';
import {
  CONTRACT_TYPE,
  CONTRACT_STATUS,
  TENDER_STATUS,
  formatMoney,
} from '../../constants/tendering';
import { PageHeader, StatusTag } from '../../components/tendering';

const TYPE_OPTIONS = Object.entries(CONTRACT_TYPE).map(([k, v]) => ({ value: k, label: v.text }));
const CURRENCY_OPTIONS = [
  { value: 'CNY', label: '人民币 CNY' },
  { value: 'USD', label: '美元 USD' },
  { value: 'EUR', label: '欧元 EUR' },
];

export default function ContractForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(id);
  const presetTenderId = searchParams.get('tender_id');
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [tenderContext, setTenderContext] = useState(null);
  const [wonBids, setWonBids] = useState([]);
  const [contract, setContract] = useState(null);

  // 编辑模式加载
  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      setLoading(true);
      try {
        const res = await tenderingAPI.getContract(id);
        const data = res?.data ?? res;
        setContract(data);
        form.setFieldsValue({
          ...data,
          sign_date: data.sign_date ? dayjs(data.sign_date) : null,
          start_date: data.start_date ? dayjs(data.start_date) : null,
          end_date: data.end_date ? dayjs(data.end_date) : null,
        });
        if (data.tender_id) {
          try {
            const tRes = await tenderingAPI.getProject(data.tender_id);
            setTenderContext(tRes?.data ?? tRes);
          } catch (e) { /* ignore */ }
        }
      } catch (err) {
        message.error(err.response?.data?.message || '获取合同失败');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isEdit, form]);

  // 创建模式：从招标项目带入
  const loadTenderContext = useCallback(async tenderId => {
    if (!tenderId) {
      setTenderContext(null);
      setWonBids([]);
      return;
    }
    try {
      const [tRes, bidsRes] = await Promise.all([
        tenderingAPI.getProject(tenderId),
        tenderingAPI.listBids(tenderId, { status: 'won' }),
      ]);
      const tender = tRes?.data ?? tRes;
      setTenderContext(tender);
      const bids = (bidsRes?.data ?? bidsRes) || [];
      const won = Array.isArray(bids) ? bids.filter(b => b.status === 'won') : [];
      setWonBids(won);
      if (won.length === 1) {
        form.setFieldsValue({
          supplier_id: won[0].supplier_id,
          bid_id: won[0].id,
          contract_name: `${tender.title || ''}采购合同`.trim(),
          contract_amount: won[0].bid_amount != null ? Number(won[0].bid_amount) : undefined,
          department: tender.department,
          contact_person: tender.contact_person,
          contact_phone: tender.contact_phone,
        });
      } else {
        form.setFieldsValue({
          contract_name: `${tender.title || ''}采购合同`.trim(),
          department: tender.department,
          contact_person: tender.contact_person,
          contact_phone: tender.contact_phone,
        });
      }
    } catch (err) {
      message.error(err.response?.data?.message || '获取招标项目失败');
      setTenderContext(null);
      setWonBids([]);
    }
  }, [form]);

  useEffect(() => {
    if (!isEdit && presetTenderId) {
      loadTenderContext(presetTenderId);
    }
  }, [isEdit, presetTenderId, loadTenderContext]);

  const handleSubmit = async values => {
    setSubmitting(true);
    try {
      const payload = {
        ...values,
        tender_id: values.tender_id || presetTenderId || tenderContext?.id,
        sign_date: values.sign_date ? values.sign_date.format('YYYY-MM-DD') : null,
        start_date: values.start_date ? values.start_date.format('YYYY-MM-DD') : null,
        end_date: values.end_date ? values.end_date.format('YYYY-MM-DD') : null,
      };
      if (isEdit) {
        await tenderingAPI.updateContract(id, payload);
        message.success('保存成功');
        navigate(`/tendering/contracts/${id}`);
      } else {
        const res = await tenderingAPI.createContract(payload);
        message.success('合同创建成功');
        const newId = res?.data?.id ?? res?.id;
        if (newId) {
          navigate(`/tendering/contracts/${newId}`);
          return;
        }
        navigate('/tendering/contracts');
      }
    } catch (err) {
      message.error(err.response?.data?.message || '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Card><Spin /> 正在加载…</Card>;

  const isLocked = contract && contract.status !== 'draft' && contract.status !== 'rejected';

  return (
    <div>
      <PageHeader
        title={isEdit ? '编辑合同' : '起草合同'}
        description={isEdit && contract?.contract_code ? `合同编号：${contract.contract_code}` : '填写合同基本信息'}
        onBack={() => navigate(isEdit ? `/tendering/contracts/${id}` : '/tendering/contracts')}
        statusTag={contract ? <StatusTag status={contract.status} statusMap={CONTRACT_STATUS} /> : null}
      />

      {isLocked ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={`此合同状态为"${CONTRACT_STATUS[contract.status]?.text}",关键字段已锁定`}
        />
      ) : null}

      {/* 关联招标项目上下文 */}
      {tenderContext ? (
        <Card size="small" title="关联招标项目" style={{ marginBottom: 16 }}>
          <Descriptions size="small" column={{ xs: 1, sm: 2 }} colon>
            <Descriptions.Item label="招标编号">{tenderContext.tender_code}</Descriptions.Item>
            <Descriptions.Item label="招标项目">
              <a onClick={() => navigate(`/tendering/projects/${tenderContext.id}`)}>
                {tenderContext.title}
              </a>
            </Descriptions.Item>
            <Descriptions.Item label="招标状态">
              <StatusTag status={tenderContext.status} statusMap={TENDER_STATUS} size="small" />
            </Descriptions.Item>
            <Descriptions.Item label="预算金额">
              {formatMoney(tenderContext.budget_amount)}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      ) : null}

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{ contract_type: 'purchase', currency: 'CNY' }}
        disabled={isLocked}
      >
        <Row gutter={16}>
          <Col xs={24} lg={16}>
            {/* 基础信息 */}
            <Card size="small" title="基础信息" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label="关联招标项目ID"
                    name="tender_id"
                    rules={[{ required: !presetTenderId, message: '请输入招标项目ID' }]}
                    extra={presetTenderId ? '已从招标项目带入' : '输入后失焦加载招标信息'}
                  >
                    <Input
                      placeholder="招标项目ID"
                      disabled={!!presetTenderId || isEdit}
                      onBlur={e => !isEdit && loadTenderContext(e.target.value)}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label="供应商"
                    name="supplier_id"
                    rules={[{ required: true, message: '请选择供应商' }]}
                    extra={
                      wonBids.length > 0
                        ? `中标供应商：${wonBids.map(b => b.supplier_name).join('、')}`
                        : '请填写供应商ID'
                    }
                  >
                    <Select
                      placeholder="选择中标供应商"
                      showSearch
                      optionFilterProp="label"
                      disabled={isEdit}
                      options={wonBids.map(b => ({
                        value: b.supplier_id,
                        label: `${b.supplier_name}（报价 ${formatMoney(b.bid_amount)}）`,
                        raw: b,
                      }))}
                      onChange={(_, opt) => {
                        if (opt?.raw?.id) form.setFieldsValue({ bid_id: opt.raw.id });
                      }}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                label="合同名称"
                name="contract_name"
                rules={[
                  { required: true, message: '请输入合同名称' },
                  { max: 255, message: '不能超过 255 字' },
                ]}
              >
                <Input placeholder="如：服务器机柜采购合同" showCount maxLength={255} />
              </Form.Item>

              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item label="合同类型" name="contract_type" rules={[{ required: true }]}>
                    <Select options={TYPE_OPTIONS} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item label="币种" name="currency" rules={[{ required: true }]}>
                    <Select options={CURRENCY_OPTIONS} />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            {/* 金额与日期 */}
            <Card size="small" title="金额与日期" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col xs={24} sm={8}>
                  <Form.Item
                    label="合同金额"
                    name="contract_amount"
                    rules={[
                      { required: true, message: '请输入合同金额' },
                      { type: 'number', min: 0, message: '金额必须≥0' },
                    ]}
                  >
                    <InputNumber
                      style={{ width: '100%' }}
                      placeholder="0.00"
                      precision={2}
                      min={0}
                      formatter={v => `¥ ${v || ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={v => v.replace(/¥\s?|,/g, '')}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item label="签订日期" name="sign_date">
                    <DatePicker style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item label="需求部门" name="department">
                    <Input placeholder="需求部门" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} sm={8}>
                  <Form.Item label="履行开始" name="start_date">
                    <DatePicker style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item label="履行结束" name="end_date">
                    <DatePicker style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item label="联系人" name="contact_person">
                    <Input placeholder="联系人" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item label="联系电话" name="contact_phone">
                <Input placeholder="如：13800000000" />
              </Form.Item>
            </Card>

            {/* 合同条款 */}
            <Card size="small" title="合同条款" style={{ marginBottom: 16 }}>
              <Form.Item
                label="付款条款"
                name="payment_terms"
                extra="例如：合同签订后7日内支付30%预付款，验收合格后支付尾款"
              >
                <Input.TextArea rows={2} />
              </Form.Item>

              <Form.Item label="合同主要内容" name="description">
                <Input.TextArea rows={3} placeholder="合同标的、规格、数量、服务要求等" />
              </Form.Item>

              <Form.Item label="备注" name="remark">
                <Input.TextArea rows={2} placeholder="其他需要说明的事项" />
              </Form.Item>

              <Form.Item name="bid_id" hidden>
                <Input />
              </Form.Item>
            </Card>
          </Col>

          <Col xs={24} lg={8}>
            <Card size="small" title="操作指引" style={{ marginBottom: 16 }}>
              <Space orientation="vertical" size="small" style={{ width: '100%' }}>
                <div style={{ fontSize: 13, lineHeight: 1.7, color: '#595959' }}>
                  <strong>1. 关联招标</strong>：从已定标的招标项目创建，自动带入供应商
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.7, color: '#595959' }}>
                  <strong>2. 填写条款</strong>：付款方式、履行期限、违约责任
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.7, color: '#595959' }}>
                  <strong>3. 提交审批</strong>：合同进入待审批状态
                </div>
              </Space>
            </Card>
          </Col>
        </Row>

        <Card size="small" style={{ background: '#fafbfc' }}>
          <Space wrap>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              htmlType="submit"
              loading={submitting}
              disabled={isLocked}
            >
              {isEdit ? '保存' : '创建合同'}
            </Button>
            <Button
              icon={<RollbackOutlined />}
              onClick={() => navigate(isEdit ? `/tendering/contracts/${id}` : '/tendering/contracts')}
            >
              返回
            </Button>
          </Space>
        </Card>
      </Form>
    </div>
  );
}
