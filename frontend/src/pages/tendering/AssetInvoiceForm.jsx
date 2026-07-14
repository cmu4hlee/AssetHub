import React, { useEffect, useState } from 'react';
import {
  Form, Input, InputNumber, Select, DatePicker, Button, Space, message,
  Card, Row, Col, Descriptions, Alert,
} from 'antd';
import { SaveOutlined, RollbackOutlined, FileTextOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { tenderingAPI } from '../../api/domains/tendering';
import { INVOICE_KIND } from '../../constants/tendering';
import { PageHeader } from '../../components/tendering';

const KIND_OPTIONS = Object.entries(INVOICE_KIND).map(([k, v]) => ({ value: k, label: v.text }));

// 资产侧入账发票生成：基于资产 ID 创建一个资本化发票草稿
export default function AssetInvoiceForm() {
  const { assetId } = useParams();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [asset, setAsset] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setAsset({ id: assetId });
  }, [assetId]);

  const onSubmit = async values => {
    setLoading(true);
    try {
      const payload = {
        ...values,
        issue_date: values.issue_date ? values.issue_date.format('YYYY-MM-DD') : null,
        asset_id: Number(assetId),
        accounting_kind: 'capitalize', // 资产入账发票强制资本化
      };
      const res = await tenderingAPI.createInvoiceFromAsset(assetId, payload);
      message.success('已生成资产入账发票草稿');
      navigate(`/tendering/invoices/${res?.data?.id || res.id}`);
    } catch (err) {
      message.error(err.response?.data?.message || '创建失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="资产入账发票生成"
        description={`基于资产 #${assetId} 创建资本化入账发票`}
        onBack={() => navigate(-1)}
        statusTag={
          <StatusTagLite
            status="capitalize"
            statusMap={{ capitalize: { text: '资本化', color: 'green' } }}
          />
        }
      />

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="资产入账发票"
        description="此发票将记入资产原值，提升资产账面价值。提交后进入核验流程，核验通过后完成入账。"
      />

      <Card size="small" title="资产信息" style={{ marginBottom: 16 }}>
        <Descriptions column={{ xs: 1, sm: 3 }} size="small" colon>
          <Descriptions.Item label="资产 ID">{assetId}</Descriptions.Item>
          <Descriptions.Item label="来源">资产主数据</Descriptions.Item>
          <Descriptions.Item label="入账属性">资本化（默认）</Descriptions.Item>
        </Descriptions>
      </Card>

      <Form
        form={form}
        layout="vertical"
        onFinish={onSubmit}
        initialValues={{ invoice_kind: 'vat_special', tax_rate: 13 }}
      >
        <Row gutter={16}>
          <Col xs={24} lg={16}>
            <Card size="small" title="发票信息" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label="发票类型"
                    name="invoice_kind"
                    rules={[{ required: true, message: '请选择发票类型' }]}
                  >
                    <Select options={KIND_OPTIONS} placeholder="请选择" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label="开票日期"
                    name="issue_date"
                    rules={[{ required: true, message: '请选择开票日期' }]}
                  >
                    <DatePicker style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item label="实际发票号" name="invoice_no">
                <Input placeholder="票面发票号（留空可在核验时补）" />
              </Form.Item>
              <Form.Item
                label="含税金额"
                name="amount"
                rules={[{ required: true, message: '请填写金额' }]}
                extra="此金额将记入资产原值"
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
              <Form.Item label="税率(%)" name="tax_rate">
                <InputNumber min={0} max={100} precision={2} step={0.5} style={{ width: '100%' }} />
              </Form.Item>
            </Card>

            <Card size="small" title="业务关联（可选）" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item label="关联合同ID" name="contract_id">
                    <InputNumber style={{ width: '100%' }} placeholder="可选" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item label="关联里程碑ID" name="milestone_id">
                    <InputNumber style={{ width: '100%' }} placeholder="可选" />
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
                  <strong>1. 选择发票类型</strong>：增值税专票最常用
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.7, color: '#595959' }}>
                  <strong>2. 填写金额</strong>：含税金额即入账金额
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.7, color: '#595959' }}>
                  <strong>3. 关联合同</strong>：如有对应合同建议关联
                </div>
                <div style={{ fontSize: 12, lineHeight: 1.7, color: '#8c8c8c' }}>
                  创建后进入草稿状态，可继续编辑或提交核验
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
              生成发票草稿
            </Button>
            <Button
              icon={<RollbackOutlined />}
              onClick={() => navigate(-1)}
            >
              返回
            </Button>
          </Space>
        </Card>
      </Form>
    </div>
  );
}

// 内联轻量 StatusTag(避免循环依赖)
import { Tag } from 'antd';
function StatusTagLite({ status, statusMap }) {
  const info = statusMap?.[status] || { text: status, color: 'default' };
  return <Tag color={info.color}>{info.text}</Tag>;
}
