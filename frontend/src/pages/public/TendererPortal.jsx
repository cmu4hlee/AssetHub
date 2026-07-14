import React, { useState, useEffect, useCallback } from 'react';
import { Card, Tabs, Form, Input, InputNumber, Select, DatePicker, Button, Upload, Spin, message, Empty, List, Tag, Result, Descriptions, Space, Statistic, Alert } from 'antd';
import { FileTextOutlined, UploadOutlined, DownloadOutlined, FileOutlined, TrophyOutlined, SafetyCertificateOutlined, ArrowLeftOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { tenderingPublicAPI } from '../../api/domains/tendering';
import { TENDER_STATUS, TENDER_TYPE, QUALIFICATION_TYPE_LABELS } from '../../constants/tendering';

const { TextArea } = Input;
const { Option } = Select;

// 由集中常量派生资质类型选项，确保与后端字典一致
const QUALIFICATION_TYPES = Object.entries(QUALIFICATION_TYPE_LABELS).map(
  ([value, label]) => ({ value, label })
);

export default function TendererPortal() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [meta, setMeta] = useState({ tender: null, permissions: [] });
  const [files, setFiles] = useState([]);
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [qualForm] = Form.useForm();
  const [bidForm] = Form.useForm();
  const [qualFileList, setQualFileList] = useState([]);
  const [bidFileList, setBidFileList] = useState([]);

  const loadMeta = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tenderRes, filesRes] = await Promise.all([
        tenderingPublicAPI.getTender(token),
        tenderingPublicAPI.listFiles(token).catch(() => ({ data: { data: [] } })),
      ]);
      const tenderPayload = tenderRes.data?.data ?? tenderRes.data;
      const filesPayload = filesRes.data?.data ?? filesRes.data;
      setMeta({
        tender: tenderPayload?.tender,
        permissions: tenderPayload?.permissions || [],
      });
      setFiles(Array.isArray(filesPayload) ? filesPayload : []);
    } catch (err) {
      const msg = err.response?.data?.message || '二维码无效、已过期或已被撤销';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadMeta(); }, [loadMeta]);

  // 提交资质
  const handleSubmitQual = async (file) => {
    try {
      const values = await qualForm.validateFields();
      // 处理日期字段
      const validUntil = values.valid_until ? dayjs(values.valid_until).format('YYYY-MM-DD') : null;
      const data = { ...values, valid_until: validUntil };
      setSubmitting(true);
      await tenderingPublicAPI.uploadQualificationByProject(token, file, data);
      message.success('资质上传成功，请等待审核');
      qualForm.resetFields();
      setQualFileList([]);
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err.response?.data?.message || '上传失败');
    } finally {
      setSubmitting(false);
    }
  };

  // 提交投标
  const handleSubmitBid = async (filesArr) => {
    try {
      const values = await bidForm.validateFields();
      setSubmitting(true);
      const data = {
        ...values,
        bid_amount: values.bid_amount,
        bid_currency: values.bid_currency || 'CNY',
      };
      const res = await tenderingPublicAPI.submitBid(token, data, filesArr);
      message.success('投标提交成功');
      setSubmitted(true);
      bidForm.resetFields();
      setBidFileList([]);
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err.response?.data?.message || '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 1200, margin: '40px auto', padding: '0 16px' }}>
        <Card><Spin  description="加载招标信息..." /></Card>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: 720, margin: '40px auto', padding: '0 16px' }}>
        <Card>
          <Result
            status="error"
            title="无法访问该招标"
            subTitle={error}
            extra={<Button type="primary" onClick={() => navigate('/')}>返回首页</Button>}
          />
        </Card>
      </div>
    );
  }

  if (!meta.tender) return null;
  const tender = meta.tender;
  const permissions = meta.permissions;
  const tenderStatusInfo = TENDER_STATUS[tender.status] || { text: tender.status, color: 'default' };
  const tenderTypeInfo = TENDER_TYPE[tender.tender_type] || { text: tender.tender_type, color: 'default' };

  const hasView = permissions.includes('view');
  const hasDownload = permissions.includes('download');
  const hasQualify = permissions.includes('qualify');
  const hasBid = permissions.includes('bid');

  const tabs = [];

  if (hasView) {
    tabs.push({
      key: 'detail',
      label: <span><FileTextOutlined /> 招标详情</span>,
      children: (
        <Card>
          <Descriptions bordered column={2} size="middle">
            <Descriptions.Item label="招标编号" span={2}>
              <Tag color="blue" style={{ fontSize: 14 }}>{tender.tender_code}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="项目名称" span={2}>
              <strong style={{ fontSize: 16 }}>{tender.title}</strong>
            </Descriptions.Item>
            <Descriptions.Item label="类型">
              <Tag color={tenderTypeInfo.color}>{tenderTypeInfo.text}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={tenderStatusInfo.color}>{tenderStatusInfo.text}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="预算金额">
              <Statistic
                value={tender.budget_amount || 0}
                prefix={tender.currency || 'CNY'}
                precision={2}
                styles={{ content: { fontSize: 16, color: '#fa8c16' } }}
              />
            </Descriptions.Item>
            <Descriptions.Item label="采购方式">
              {tender.tender_method === 'public' ? '公开招标' :
               tender.tender_method === 'invite' ? '邀请招标' : '竞争性谈判'}
            </Descriptions.Item>
            <Descriptions.Item label="投标截止">
              {tender.deadline ? dayjs(tender.deadline).format('YYYY-MM-DD HH:mm') : '未设置'}
            </Descriptions.Item>
            <Descriptions.Item label="开标时间">
              {tender.open_bid_date ? dayjs(tender.open_bid_date).format('YYYY-MM-DD HH:mm') : '未设置'}
            </Descriptions.Item>
            <Descriptions.Item label="联系人">{tender.contact_person || '-'}</Descriptions.Item>
            <Descriptions.Item label="联系电话">{tender.contact_phone || '-'}</Descriptions.Item>
            <Descriptions.Item label="关联资产" span={2}>
              {tender.asset_code || tender.asset_name ? (
                <Tag color="purple">{tender.asset_code || ''} {tender.asset_name || ''}</Tag>
              ) : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="项目描述" span={2}>
              <div style={{ whiteSpace: 'pre-wrap' }}>{tender.description || '暂无描述'}</div>
            </Descriptions.Item>
          </Descriptions>
        </Card>
      ),
    });
  }

  if (hasDownload || hasView) {
    tabs.push({
      key: 'files',
      label: <span><DownloadOutlined /> 招标文件 ({files.length})</span>,
      children: (
        <Card>
          {files.length === 0 ? (
            <Empty description="暂无招标文件附件" />
          ) : (
            <List
              dataSource={files}
              renderItem={item => (
                <List.Item
                  actions={[
                    hasDownload ? (
                      <Button
                        key="download"
                        type="link"
                        icon={<DownloadOutlined />}
                        onClick={() => window.open(`/api/tendering/public/tender/${token}/files/${item.id}`, '_blank')}
                      >
                        下载
                      </Button>
                    ) : null,
                  ].filter(Boolean)}
                >
                  <List.Item.Meta
                    avatar={<FileOutlined style={{ fontSize: 24, color: '#1890ff' }} />}
                    title={item.original_name || item.file_name}
                    description={
                      <Space>
                        <span>{(item.file_size / 1024).toFixed(1)} KB</span>
                        <span>·</span>
                        <span>{item.created_at ? item.created_at.replace('T', ' ').slice(0, 16) : ''}</span>
                        {item.file_type && <Tag>{item.file_type}</Tag>}
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          )}
        </Card>
      ),
    });
  }

  if (hasQualify) {
    tabs.push({
      key: 'qualify',
      label: <span><SafetyCertificateOutlined /> 上传资质</span>,
      children: (
        <Card title="上传资质材料" extra={<Tag color="blue">无需登录，扫码直接上传</Tag>}>
          <Alert
            message="温馨提示"
            description="上传的资质材料将进入待审核状态，审核通过后将显示在您的供应商资料中。"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Form form={qualForm} layout="vertical">
            <Form.Item
              name="supplier_name"
              label="公司名称"
              rules={[{ required: true, message: '请填写公司名称' }]}
            >
              <Input placeholder="请填写公司全称" />
            </Form.Item>
            <Form.Item
              name="unified_code"
              label="统一社会信用代码"
              tooltip="填写后可关联已有供应商记录，避免重复登记"
            >
              <Input placeholder="可选项，例如 91110000123456789X" />
            </Form.Item>
            <Form.Item
              name="qualification_type"
              label="资质类型"
              rules={[{ required: true, message: '请选择资质类型' }]}
              initialValue="business_license"
            >
              <Select placeholder="选择资质类型">
                {QUALIFICATION_TYPES.map(t => <Option key={t.value} value={t.value}>{t.label}</Option>)}
              </Select>
            </Form.Item>
            <Form.Item
              name="qualification_name"
              label="资质名称"
              rules={[{ required: true, message: '请填写资质名称' }]}
            >
              <Input placeholder="例如：营业执照副本" />
            </Form.Item>
            <Form.Item name="valid_until" label="有效期至">
              <DatePicker style={{ width: '100%' }} placeholder="长期有效可不填" />
            </Form.Item>
            <Form.Item
              name="contact_person"
              label="联系人"
            >
              <Input placeholder="姓名" />
            </Form.Item>
            <Form.Item
              name="contact_phone"
              label="联系电话"
            >
              <Input placeholder="手机或座机" />
            </Form.Item>
            <Form.Item
              name="contact_email"
              label="邮箱"
              rules={[
                { required: true, message: '请输入邮箱（用于接收中标/资质审核/招标邀请等邮件通知）' },
                { type: 'email', message: '请输入合法邮箱' },
              ]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              label="资质文件"
              required
            >
              <Upload
                beforeUpload={(file) => {
                  setQualFileList([file]);
                  return false; // 阻止自动上传
                }}
                fileList={qualFileList}
                onRemove={() => setQualFileList([])}
                maxCount={1}
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              >
                <Button icon={<UploadOutlined />}>选择文件</Button>
              </Upload>
            </Form.Item>
            <Form.Item>
              <Button
                type="primary"
                icon={<UploadOutlined />}
                loading={submitting}
                disabled={qualFileList.length === 0}
                onClick={() => {
                  const file = qualFileList[0];
                  const validUntil = qualForm.getFieldValue('valid_until');
                  handleSubmitQual(file);
                  // validUntil 在表单中，需要在 handleSubmitQual 中处理
                }}
              >
                提交资质上传
              </Button>
            </Form.Item>
          </Form>
        </Card>
      ),
    });
  }

  if (hasBid) {
    tabs.push({
      key: 'bid',
      label: <span><TrophyOutlined /> 提交投标</span>,
      children: (
        <Card title="投标提交" extra={<Tag color="blue">无需登录，扫码直接投标</Tag>}>
          {submitted ? (
            <Result
              status="success"
              icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              title="投标提交成功"
              subTitle="感谢您的参与！招标方将进入评标流程，请留意通知。"
              extra={<Button onClick={() => setSubmitted(false)}>再次查看</Button>}
            />
          ) : (
            <Form form={bidForm} layout="vertical">
              <Alert
                message="温馨提示"
                description={
                  tender.status === 'bidding' || tender.status === 'published'
                    ? `当前招标处于${tenderStatusInfo.text}状态，您可以提交或更新投标。`
                    : `当前招标处于${tenderStatusInfo.text}状态，已无法提交投标。`
                }
                type={tender.status === 'bidding' || tender.status === 'published' ? 'success' : 'warning'}
                showIcon
                style={{ marginBottom: 16 }}
              />
              <Form.Item
                name="supplier_name"
                label="公司名称"
                rules={[{ required: true, message: '请填写公司名称' }]}
              >
                <Input placeholder="请填写公司全称" />
              </Form.Item>
              <Form.Item
                name="unified_code"
                label="统一社会信用代码"
              >
                <Input placeholder="可选项" />
              </Form.Item>
              <Form.Item
                name="contact_person"
                label="联系人"
                rules={[{ required: true, message: '请填写联系人' }]}
              >
                <Input placeholder="姓名" />
              </Form.Item>
              <Form.Item
                name="contact_phone"
                label="联系电话"
                rules={[{ required: true, message: '请填写联系电话' }]}
              >
                <Input placeholder="手机或座机" />
              </Form.Item>
              <Form.Item
                name="contact_email"
                label="邮箱"
                rules={[
                  { required: true, message: '请输入邮箱（用于接收中标/资质审核/招标邀请等邮件通知）' },
                  { type: 'email', message: '请输入合法邮箱' },
                ]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                name="bid_amount"
                label="投标报价"
                rules={[{ type: 'number', min: 0, message: '金额必须 ≥ 0' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  precision={2}
                  placeholder="0.00"
                  prefix={tender.currency || 'CNY'}
                />
              </Form.Item>
              <Form.Item
                name="bid_currency"
                label="币种"
                initialValue={tender.currency || 'CNY'}
              >
                <Select style={{ width: 120 }}>
                  <Option value="CNY">CNY</Option>
                  <Option value="USD">USD</Option>
                  <Option value="EUR">EUR</Option>
                </Select>
              </Form.Item>
              <Form.Item
                name="bid_desc"
                label="投标说明"
              >
                <TextArea rows={4} placeholder="技术方案、服务承诺、交付期等" />
              </Form.Item>
              <Form.Item label="投标附件（可选，最多 5 个文件）">
                <Upload
                  multiple
                  beforeUpload={(file) => {
                    setBidFileList(prev => [...prev, file].slice(0, 5));
                    return false;
                  }}
                  fileList={bidFileList}
                  onRemove={(file) => {
                    setBidFileList(prev => prev.filter(f => f.uid !== file.uid));
                  }}
                >
                  <Button icon={<UploadOutlined />}>选择文件</Button>
                </Upload>
              </Form.Item>
              <Form.Item>
                <Button
                  type="primary"
                  icon={<TrophyOutlined />}
                  loading={submitting}
                  disabled={!['published', 'bidding'].includes(tender.status)}
                  onClick={() => handleSubmitBid(bidFileList)}
                >
                  提交投标
                </Button>
              </Form.Item>
            </Form>
          )}
        </Card>
      ),
    });
  }

  if (tabs.length === 0) {
    return (
      <div style={{ maxWidth: 720, margin: '40px auto', padding: '0 16px' }}>
        <Card>
          <Result
            status="warning"
            title="二维码未开放任何权限"
            subTitle="请联系招标方获取有效二维码"
          />
        </Card>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: '24px auto', padding: '0 16px' }}>
      <Card
        title={
          <Space>
            <span>🏷️ 招标方共享二维码</span>
            <Tag color="blue" style={{ marginLeft: 8 }}>扫码访问</Tag>
          </Space>
        }
        extra={
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>返回首页</Button>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Alert
          message={tender.title}
          description={
            <Space size="large" wrap>
              <span>招标编号：<strong>{tender.tender_code}</strong></span>
              <span>状态：<Tag color={tenderStatusInfo.color}>{tenderStatusInfo.text}</Tag></span>
              <span>预算：<strong>{tender.currency || 'CNY'} {Number(tender.budget_amount || 0).toLocaleString()}</strong></span>
            </Space>
          }
          type="info"
          showIcon
        />
      </Card>
      <Card>
        <Tabs items={tabs} defaultActiveKey="detail" />
      </Card>
    </div>
  );
}
