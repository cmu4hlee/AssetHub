import React, { useEffect, useState, useCallback } from 'react';
import {
  Form, Input, InputNumber, Select, DatePicker, Button, Space, message,
  Card, Row, Col, Divider,
} from 'antd';
import { SaveOutlined, RollbackOutlined, CameraOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { tenderingAPI } from '../../api/domains/tendering';
import { INVOICE_KIND, formatMoney } from '../../constants/tendering';
import { PageHeader } from '../../components/tendering';
import InvoicePhotoCapture from '../../components/Scanner/InvoicePhotoCapture';

const KIND_OPTIONS = Object.entries(INVOICE_KIND).map(([k, v]) => ({ value: k, label: v.text }));
const ACCOUNTING_OPTIONS = [
  { value: 'capitalize', label: '资本化入账（计入资产）' },
  { value: 'expense', label: '费用化入账（计入当期费用）' },
];

export default function TenderInvoiceForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      setLoading(true);
      try {
        const res = await tenderingAPI.getInvoice(id);
        const row = res?.data?.id ? res.data : res;
        form.setFieldsValue({
          invoice_kind: row.invoice_kind,
          invoice_no: row.invoice_no,
          invoice_code_str: row.invoice_code_str,
          issue_date: row.issue_date ? dayjs(row.issue_date) : null,
          amount: row.amount != null ? Number(row.amount) : undefined,
          tax_rate: row.tax_rate != null ? Number(row.tax_rate) : 13,
          tax_amount: row.tax_amount != null ? Number(row.tax_amount) : undefined,
          excluding_amount: row.excluding_amount != null ? Number(row.excluding_amount) : undefined,
          accounting_kind: row.accounting_kind,
          contract_id: row.contract_id,
          milestone_id: row.milestone_id,
          tender_id: row.tender_id,
          supplier_id: row.supplier_id,
          asset_id: row.asset_id,
          remark: row.remark,
        });
      } catch (e) {
        message.error('加载发票失败');
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
        issue_date: values.issue_date ? values.issue_date.format('YYYY-MM-DD') : null,
      };
      if (isEdit) {
        await tenderingAPI.updateInvoice(id, payload);
        message.success('保存成功');
      } else {
        const res = await tenderingAPI.createInvoice(payload);
        message.success('创建成功');
        navigate(`/tendering/invoices/${res?.data?.id || res.id}`);
        return;
      }
      navigate('/tendering/invoices');
    } catch (err) {
      message.error(err.response?.data?.message || '保存失败');
    } finally {
      setLoading(false);
    }
  };

  // 拍照录入回调：将 OCR 识别的字段填入表单
  const handlePhotoConfirm = useCallback(data => {
    form.setFieldsValue({
      invoice_kind: data.invoice_kind,
      invoice_no: data.invoice_no || '',
      invoice_code_str: data.invoice_code_str || '',
      issue_date: data.issue_date ? dayjs(data.issue_date) : null,
      amount: data.amount,
      tax_rate: data.tax_rate ?? 13,
      tax_amount: data.tax_amount,
      excluding_amount: data.excluding_amount,
      remark: data.remark || '',
    });
    message.success('发票信息已自动填入');
    setPhotoModalOpen(false);
  }, [form]);

  return (
    <div>
      <PageHeader
        title={isEdit ? '编辑发票' : '新增发票'}
        description="填写发票信息，提交后进入核验流程"
        onBack={() => navigate('/tendering/invoices')}
      />

      <Form
        form={form}
        layout="vertical"
        onFinish={onSubmit}
        initialValues={{ invoice_kind: 'vat_special', tax_rate: 13, accounting_kind: 'capitalize' }}
      >
        <Row gutter={16}>
          <Col xs={24} lg={16}>
            {/* 发票信息 */}
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
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item label="实际发票号" name="invoice_no" extra="票面发票号，留空可在核验时补">
                    <Input placeholder="票面发票号" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item label="发票代码" name="invoice_code_str" extra="纸质票必填，电子发票可空">
                    <Input placeholder="纸质发票代码" />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            {/* 金额信息 */}
            <Card size="small" title="金额信息" style={{ marginBottom: 16 }}>
              <Form.Item
                label="含税金额"
                name="amount"
                rules={[{ required: true, message: '请填写含税金额' }]}
                extra="含税总金额"
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
              <Row gutter={16}>
                <Col xs={24} sm={8}>
                  <Form.Item label="税率(%)" name="tax_rate">
                    <InputNumber min={0} max={100} precision={2} step={0.5} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item label="税额" name="tax_amount" extra="留空按税率自动计算">
                    <InputNumber
                      min={0}
                      precision={2}
                      style={{ width: '100%' }}
                      placeholder="0.00"
                      formatter={v => `¥ ${v || ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={v => v.replace(/¥\s?|,/g, '')}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item label="不含税金额" name="excluding_amount" extra="留空自动计算">
                    <InputNumber
                      min={0}
                      precision={2}
                      style={{ width: '100%' }}
                      placeholder="0.00"
                      formatter={v => `¥ ${v || ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={v => v.replace(/¥\s?|,/g, '')}
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item
                label="入账属性"
                name="accounting_kind"
                extra="资本化：计入资产原值；费用化：计入当期费用"
              >
                <Select options={ACCOUNTING_OPTIONS} />
              </Form.Item>
            </Card>

            {/* 业务关联 */}
            <Card size="small" title="业务关联（可选）" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item label="关联招标ID" name="tender_id">
                    <InputNumber style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item label="关联合同ID" name="contract_id">
                    <InputNumber style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item label="里程碑ID" name="milestone_id">
                    <InputNumber style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item label="供应商ID" name="supplier_id">
                    <InputNumber style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item label="资产ID" name="asset_id" extra="资产入账发票必填">
                <InputNumber style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label="备注" name="remark">
                <Input.TextArea rows={3} placeholder="其他需要说明的事项" />
              </Form.Item>
            </Card>
          </Col>

          <Col xs={24} lg={8}>
            <Card size="small" title="操作指引" style={{ marginBottom: 16 }}>
              <Space orientation="vertical" size="small" style={{ width: '100%' }}>
                <div style={{ fontSize: 13, lineHeight: 1.7, color: '#595959' }}>
                  <strong>1. 选择发票类型</strong>：增值税专票/普票/电子发票/收据
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.7, color: '#595959' }}>
                  <strong>2. 填写金额</strong>：含税金额必填，税额可自动计算
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.7, color: '#595959' }}>
                  <strong>3. 选择入账属性</strong>：资产入账或费用化
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.7, color: '#595959' }}>
                  <strong>4. 关联业务</strong>：可选关联合同/招标/资产
                </div>
              </Space>
              <Divider style={{ margin: '12px 0' }} />
              <Button
                type="primary"
                ghost
                icon={<CameraOutlined />}
                onClick={() => setPhotoModalOpen(true)}
                block
                size="large"
                style={{ height: 44, fontSize: 14 }}
              >
                拍照录入发票
              </Button>
              <div style={{ marginTop: 8, fontSize: 12, color: '#999', textAlign: 'center' }}>
                拍照或上传发票图片，AI 自动识别填写
              </div>
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
              {isEdit ? '保存' : '创建发票'}
            </Button>
            <Button
              icon={<RollbackOutlined />}
              onClick={() => navigate('/tendering/invoices')}
            >
              返回
            </Button>
          </Space>
        </Card>
      </Form>

      <InvoicePhotoCapture
        open={photoModalOpen}
        onClose={() => setPhotoModalOpen(false)}
        onConfirm={handlePhotoConfirm}
      />
    </div>
  );
}
