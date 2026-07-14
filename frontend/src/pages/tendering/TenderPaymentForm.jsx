import React, { useEffect, useState } from 'react';
import {
  Form, Input, InputNumber, Select, DatePicker, Button, Space, message,
  Card, Row, Col,
} from 'antd';
import { SaveOutlined, RollbackOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { tenderingAPI } from '../../api/domains/tendering';
import { PAYMENT_METHOD, formatMoney } from '../../constants/tendering';
import { PageHeader } from '../../components/tendering';

const METHOD_OPTIONS = Object.entries(PAYMENT_METHOD).map(([k, v]) => ({ value: k, label: v.text }));

export default function TenderPaymentForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      setLoading(true);
      try {
        const res = await tenderingAPI.getPayment(id);
        const row = res?.data?.id ? res.data : res;
        form.setFieldsValue({
          contract_id: row.contract_id,
          milestone_id: row.milestone_id,
          invoice_id: row.invoice_id,
          tender_id: row.tender_id,
          supplier_id: row.supplier_id,
          payee_name: row.payee_name,
          amount: row.amount != null ? Number(row.amount) : undefined,
          currency: row.currency || 'CNY',
          pay_method: row.pay_method,
          bank_name: row.bank_name,
          bank_account: row.bank_account,
          pay_date: row.pay_date ? dayjs(row.pay_date) : null,
          remark: row.remark,
        });
      } catch (e) {
        message.error('加载付款单失败');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isEdit, form]);

  const onSubmit = async values => {
    setLoading(true);
    try {
      const payload = {
        ...values,
        pay_date: values.pay_date ? values.pay_date.format('YYYY-MM-DD') : null,
      };
      if (isEdit) {
        await tenderingAPI.updatePayment(id, payload);
        message.success('保存成功');
      } else {
        const r = await tenderingAPI.createPayment(payload);
        navigate(`/tendering/payments/${r?.data?.id || r.id}`);
        return;
      }
      navigate('/tendering/payments');
    } catch (e) {
      message.error(e.response?.data?.message || '保存失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={isEdit ? '编辑付款单' : '新增付款单'}
        description="填写付款信息，保存后可提交进入付款流程"
        onBack={() => navigate('/tendering/payments')}
      />

      <Form
        form={form}
        layout="vertical"
        onFinish={onSubmit}
        initialValues={{ currency: 'CNY', pay_method: 'bank_transfer' }}
      >
        <Row gutter={16}>
          <Col xs={24} lg={16}>
            {/* 基础信息 */}
            <Card size="small" title="基础信息" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label="收款方"
                    name="payee_name"
                    extra="留空自动取供应商名称"
                  >
                    <Input placeholder="如未填自动取供应商名称" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label="付款金额"
                    name="amount"
                    rules={[{ required: true, message: '请填写金额' }]}
                    extra="含税金额"
                  >
                    <InputNumber
                      min={0}
                      precision={2}
                      step={1000}
                      style={{ width: '100%' }}
                      placeholder="0.00"
                      formatter={v => `¥ ${v || ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={v => v.replace(/¥\s?|,/g, '')}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} sm={8}>
                  <Form.Item label="币种" name="currency">
                    <Input placeholder="CNY" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item label="付款方式" name="pay_method">
                    <Select options={METHOD_OPTIONS} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item label="计划付款日" name="pay_date">
                    <DatePicker style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            {/* 银行账户 */}
            <Card size="small" title="银行账户" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item label="开户银行" name="bank_name">
                    <Input placeholder="如：中国工商银行北京分行" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item label="收款账号" name="bank_account">
                    <Input placeholder="银行账号" />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            {/* 业务关联 */}
            <Card size="small" title="业务关联（可选）" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item label="关联合同ID" name="contract_id">
                    <InputNumber style={{ width: '100%' }} placeholder="合同 ID" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item label="关联里程碑ID" name="milestone_id">
                    <InputNumber style={{ width: '100%' }} placeholder="付款里程碑 ID" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item label="关联发票ID" name="invoice_id">
                    <InputNumber style={{ width: '100%' }} placeholder="发票 ID" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item label="关联供应商ID" name="supplier_id">
                    <InputNumber style={{ width: '100%' }} placeholder="供应商 ID" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item label="备注" name="remark">
                <Input.TextArea rows={3} placeholder="其他需要说明的事项" />
              </Form.Item>
            </Card>
          </Col>

          <Col xs={24} lg={8}>
            <Card size="small" title="操作指引" style={{ marginBottom: 16 }}>
              <Space orientation="vertical" size="small" style={{ width: '100%' }}>
                <div style={{ fontSize: 13, lineHeight: 1.7, color: '#595959' }}>
                  <strong>1. 填写收款方和金额</strong>
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.7, color: '#595959' }}>
                  <strong>2. 选择付款方式</strong>
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.7, color: '#595959' }}>
                  <strong>3. 保存后提交</strong>，进入付款流程
                </div>
                <div style={{ fontSize: 12, lineHeight: 1.7, color: '#8c8c8c' }}>
                  草稿状态下可修改；提交后需要先撤回才能编辑
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
              loading={loading}
            >
              {isEdit ? '保存' : '创建付款单'}
            </Button>
            <Button
              icon={<RollbackOutlined />}
              onClick={() => navigate('/tendering/payments')}
            >
              返回
            </Button>
          </Space>
        </Card>
      </Form>
    </div>
  );
}
