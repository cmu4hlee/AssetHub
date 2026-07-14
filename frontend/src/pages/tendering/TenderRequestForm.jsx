import React, { useEffect, useState } from 'react';
import {
  Form, Input, InputNumber, Select, DatePicker, Button, Space, message,
  Card, Row, Col, Alert,
} from 'antd';
import {
  SaveOutlined, RollbackOutlined, SendOutlined, EditOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { tenderingAPI } from '../../api/domains/tendering';
import {
  TENDER_CATEGORY,
  REQUEST_STATUS,
  formatMoney,
} from '../../constants/tendering';
import { PageHeader, StatusTag } from '../../components/tendering';

const CATEGORY_OPTIONS = Object.entries(TENDER_CATEGORY).map(([k, v]) => ({
  value: k,
  label: v.text,
}));

export default function TenderRequestForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [initial, setInitial] = useState(null);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      setLoading(true);
      try {
        const res = await tenderingAPI.getProcurementRequest(id);
        const row = Array.isArray(res?.data) ? res.data[0] : res?.data || res;
        setInitial(row);
        form.setFieldsValue({
          title: row.title,
          tender_category: row.tender_category,
          requestor_name: row.requestor_name,
          request_department: row.request_department,
          budget_amount: row.request_budget != null ? Number(row.request_budget) : undefined,
          expected_delivery_date: row.expected_delivery_date ? dayjs(row.expected_delivery_date) : null,
          asset_specification: row.asset_specification,
        });
      } catch (err) {
        message.error('加载采购申请失败');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isEdit, form]);

  // 暂存：只保存为草稿，不提交审批
  const onSave = async (values, { submitForReview = false } = {}) => {
    setLoading(true);
    try {
      const payload = {
        ...values,
        expected_delivery_date: values.expected_delivery_date
          ? values.expected_delivery_date.format('YYYY-MM-DD')
          : null,
      };
      if (isEdit) {
        await tenderingAPI.updateProcurementRequest(id, payload);
        if (submitForReview) {
          await tenderingAPI.submitProcurementRequest(id).catch(() => null);
        }
        message.success(submitForReview ? '已保存并提交审批' : '保存成功');
      } else {
        const create = await tenderingAPI.createProcurementRequest(payload);
        if (submitForReview && create?.data?.id) {
          await tenderingAPI.submitProcurementRequest(create.data.id).catch(() => null);
        }
        message.success(submitForReview ? '已创建并提交审批' : '创建成功');
        navigate(`/tendering/requests/${create.data?.id || create.id}`);
        return;
      }
      navigate('/tendering/requests');
    } catch (err) {
      message.error(err.response?.data?.message || '保存失败');
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = !initial || initial.status === 'draft';

  return (
    <div>
      <PageHeader
        title={isEdit ? '编辑采购申请' : '发起采购申请'}
        description={
          isEdit && initial?.request_code
            ? `申请编号：${initial.request_code}`
            : '填写采购需求，提交后将进入审批流程'
        }
        onBack={() => navigate('/tendering/requests')}
        statusTag={
          initial ? <StatusTag status={initial.status} statusMap={REQUEST_STATUS} /> : null
        }
      />

      {isEdit && initial && !canSubmit ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="此申请已进入审批流程，仅查看字段。如需修改请联系审批人驳回后再编辑。"
        />
      ) : null}

      <Form
        form={form}
        layout="vertical"
        onFinish={values => onSave(values, { submitForReview: false })}
        initialValues={{ tender_category: 'simple' }}
        disabled={isEdit && !canSubmit}
      >
        <Row gutter={16}>
          <Col xs={24} lg={16}>
            {/* 基本信息 */}
            <Card
              size="small"
              title={<Space><EditOutlined />基本信息</Space>}
              style={{ marginBottom: 16 }}
            >
              <Form.Item
                label="采购标题"
                name="title"
                rules={[
                  { required: true, message: '请填写采购标题' },
                  { max: 100, message: '标题不能超过 100 字' },
                ]}
                extra="清晰概括采购内容，如：服务器机柜采购、年度办公耗材采购"
              >
                <Input placeholder="例如：服务器机柜采购" showCount maxLength={100} />
              </Form.Item>

              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label="流程分类"
                    name="tender_category"
                    rules={[{ required: true, message: '请选择流程分类' }]}
                    extra="简易采购小额快速，招标采购金额较大需走完整流程"
                  >
                    <Select options={CATEGORY_OPTIONS} placeholder="请选择流程分类" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label="期望到货日期"
                    name="expected_delivery_date"
                    extra="影响后续合同签订与验收排期"
                  >
                    <DatePicker
                      style={{ width: '100%' }}
                      disabledDate={current => current && current < dayjs().startOf('day')}
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            {/* 采购参数 */}
            <Card
              size="small"
              title="采购参数"
              style={{ marginBottom: 16 }}
            >
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label="申请人"
                    name="requestor_name"
                    extra="留空则使用当前登录用户"
                  >
                    <Input placeholder="如：张三" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label="申请部门"
                    name="request_department"
                    extra="便于后续按部门统计"
                  >
                    <Input placeholder="如：信息中心" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                label="预算金额"
                name="budget_amount"
                rules={[
                  { required: true, message: '请填写预算' },
                  {
                    type: 'number',
                    min: 0,
                    message: '预算必须大于 0',
                  },
                ]}
                extra="采购金额将以此为上限，超出需走变更流程"
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
            </Card>

            {/* 规格要求 */}
            <Card
              size="small"
              title="规格要求"
              style={{ marginBottom: 16 }}
            >
              <Form.Item
                label="规格说明"
                name="asset_specification"
                extra="详细描述型号、参数、品牌、数量、技术要求等"
              >
                <Input.TextArea
                  rows={5}
                  placeholder="例如：&#10;• 42U 标准服务器机柜 × 2 台&#10;• 600×1000×2000mm&#10;• 含 PDU 电源分配单元&#10;• 品牌要求：图腾 / 威图"
                />
              </Form.Item>
            </Card>
          </Col>

          {/* 侧栏：操作指引 */}
          <Col xs={24} lg={8}>
            <Card size="small" title="操作指引" style={{ marginBottom: 16 }}>
              <Space orientation="vertical" size="small" style={{ width: '100%' }}>
                <div style={{ fontSize: 13, lineHeight: 1.7, color: '#595959' }}>
                  <strong>1. 暂存</strong>：保存为草稿，可稍后继续编辑
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.7, color: '#595959' }}>
                  <strong>2. 提交审批</strong>：保存后直接进入审批流程，状态变为"待审批"
                </div>
                <div style={{ fontSize: 12, lineHeight: 1.7, color: '#8c8c8c' }}>
                  提交后不能再修改，如需调整请联系审批人驳回
                </div>
              </Space>
            </Card>

            {initial?.request_budget ? (
              <Card size="small" title="预算概览">
                <div style={{ fontSize: 24, fontWeight: 600, color: '#fa8c16' }}>
                  {formatMoney(initial.request_budget)}
                </div>
                <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>
                  {initial.requestor_name || '当前用户'} · {initial.request_department || '-'}
                </div>
              </Card>
            ) : null}
          </Col>
        </Row>

        {/* 底部操作区 */}
        <Card size="small" style={{ background: '#fafbfc' }}>
          <Space wrap>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              htmlType="submit"
              loading={loading}
              disabled={isEdit && !canSubmit}
            >
              {isEdit ? '保存' : '暂存草稿'}
            </Button>
            {canSubmit ? (
              <Button
                type="primary"
                ghost
                icon={<SendOutlined />}
                loading={loading}
                onClick={() => {
                  form
                    .validateFields()
                    .then(values => onSave(values, { submitForReview: true }))
                    .catch(() => null);
                }}
              >
                保存并提交审批
              </Button>
            ) : null}
            <Button
              icon={<RollbackOutlined />}
              onClick={() => navigate('/tendering/requests')}
            >
              返回列表
            </Button>
          </Space>
        </Card>
      </Form>
    </div>
  );
}
