import React, { useState } from 'react';
import {
  Form, Select, InputNumber, Button, Space, message, Card, Row, Col,
} from 'antd';
import { RobotOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { PageHeader } from '../../components/tendering';
import TenderApprovalAI from './TenderApprovalAI';

const ENTITY_OPTIONS = [
  { value: 'tender_projects',   label: '招标项目' },
  { value: 'tender_contracts',  label: '合同' },
  { value: 'tender_invoices',   label: '发票' },
  { value: 'tender_payments',   label: '付款单' },
  { value: 'tender_acceptances', label: '验收单' },
];

export default function TenderApprovalAICenter() {
  const [form] = Form.useForm();
  const [target, setTarget] = useState(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async values => {
    if (!values.entity_id) {
      message.warning('请填写业务对象 ID');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/tendering/approvals/ai/assist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
        body: JSON.stringify({
          entity_type: values.entity_type,
          entity_id: values.entity_id,
          context: { budget_amount: values.budget_amount, amount: values.amount },
          approver_hint: values.approver_hint,
        }),
      });
      const json = await res.json().catch(() => null);
      setTarget({
        entityType: values.entity_type,
        entityId: values.entity_id,
        context: { budget_amount: values.budget_amount, amount: values.amount },
        approverHint: values.approver_hint,
        instant: json?.data || json,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={
          <Space><RobotOutlined /> AI 辅助审批中心</Space>
        }
        description="选择业务对象，由 MiniMax 模型给出审批建议"
        extra={
          <span style={{ color: '#8c8c8c', fontSize: 13 }}>MiniMax · human-in-loop</span>
        }
      />

      <Card style={{ marginBottom: 16 }}>
        <Form
          form={form}
          layout="vertical"
          onFinish={onSubmit}
          initialValues={{ entity_type: 'tender_projects' }}
        >
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item label="对象类型" name="entity_type" rules={[{ required: true }]}>
                <Select options={ENTITY_OPTIONS} placeholder="选择类型" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item label="对象 ID" name="entity_id" rules={[{ required: true }]}>
                <InputNumber min={1} style={{ width: '100%' }} placeholder="业务对象 ID" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item label="审批人提示" name="approver_hint">
                <Select
                  allowClear
                  placeholder="可选"
                  options={[
                    { value: 'strict', label: '严格' },
                    { value: 'balanced', label: '平衡' },
                    { value: 'lenient', label: '宽松' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item label="预算金额" name="budget_amount">
                <InputNumber
                  min={0}
                  style={{ width: '100%' }}
                  placeholder="0.00"
                  formatter={v => `¥ ${v || ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={v => v.replace(/¥\s?|,/g, '')}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label="实际金额" name="amount">
                <InputNumber
                  min={0}
                  style={{ width: '100%' }}
                  placeholder="0.00"
                  formatter={v => `¥ ${v || ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={v => v.replace(/¥\s?|,/g, '')}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              icon={<ThunderboltOutlined />}
              size="large"
            >
              AI 分析
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {target ? (
        <TenderApprovalAI
          entityType={target.entityType}
          entityId={target.entityId}
          context={target.context}
          approverHint={target.approverHint}
        />
      ) : null}
    </div>
  );
}
