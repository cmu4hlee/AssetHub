import React, { useEffect, useState } from 'react';
import { Card, Form, Input, InputNumber, Select, DatePicker, Button, Space, message } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { tenderingAPI } from '../../api/domains/tendering';

export default function TenderAcceptanceForm() {
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
        const res = await tenderingAPI.getAcceptance(id);
        const row = res?.data?.id ? res.data : res;
        form.setFieldsValue({
          contract_id: row.contract_id, tender_id: row.tender_id,
          asset_id: row.asset_id, invoice_id: row.invoice_id,
          inspector_id: row.inspector_id,
          scheduled_date: row.scheduled_date ? dayjs(row.scheduled_date) : null,
          accepted_quantity: row.accepted_quantity || 0,
          rejected_quantity: row.rejected_quantity || 0,
          inspection_note: row.inspection_note,
          remark: row.remark,
        });
      } catch (e) { message.error('加载失败'); }
      finally { setLoading(false); }
    })();
  }, [id, isEdit, form]);

  const onSubmit = async values => {
    setLoading(true);
    try {
      const payload = { ...values, scheduled_date: values.scheduled_date ? values.scheduled_date.format('YYYY-MM-DD') : null };
      if (isEdit) {
        await tenderingAPI.updateAcceptance(id, payload);
        message.success('保存成功');
      } else {
        const r = await tenderingAPI.createAcceptance(payload);
        navigate(`/tendering/acceptances/${r?.data?.id || r.id}`);
        return;
      }
      navigate('/tendering/acceptances');
    } catch (e) { message.error(e.response?.data?.message || '保存失败'); }
    finally { setLoading(false); }
  };

  return (
    <Card title={isEdit ? '编辑验收单' : '新增验收单'}>
      <Form form={form} layout="vertical" onFinish={onSubmit} style={{ maxWidth: 760 }}
        initialValues={{ accepted_quantity: 0, rejected_quantity: 0 }}>
        <Space wrap>
          <Form.Item label="合同ID" name="contract_id" style={{ width: 180 }}><InputNumber style={{ width: '100%' }} /></Form.Item>
          <Form.Item label="招标ID" name="tender_id" style={{ width: 180 }}><InputNumber style={{ width: '100%' }} /></Form.Item>
          <Form.Item label="资产ID" name="asset_id" style={{ width: 180 }}><InputNumber style={{ width: '100%' }} /></Form.Item>
          <Form.Item label="发票ID" name="invoice_id" style={{ width: 180 }}><InputNumber style={{ width: '100%' }} /></Form.Item>
        </Space>
        <Space wrap>
          <Form.Item label="验收人ID" name="inspector_id" style={{ width: 240 }}><InputNumber style={{ width: '100%' }} /></Form.Item>
          <Form.Item label="计划验收日" name="scheduled_date"><DatePicker style={{ width: '100%' }} /></Form.Item>
        </Space>
        <Space wrap>
          <Form.Item label="合格数量" name="accepted_quantity" style={{ width: 240 }}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item label="不合格数量" name="rejected_quantity" style={{ width: 240 }}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
        </Space>
        <Form.Item label="验收意见" name="inspection_note"><Input.TextArea rows={3} /></Form.Item>
        <Form.Item label="备注" name="remark"><Input.TextArea rows={3} /></Form.Item>
        <Space>
          <Button type="primary" htmlType="submit" loading={loading}>保存</Button>
          <Button onClick={() => navigate('/tendering/acceptances')}>返回</Button>
        </Space>
      </Form>
    </Card>
  );
}
