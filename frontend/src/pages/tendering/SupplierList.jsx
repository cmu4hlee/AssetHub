import React, { useState, useEffect, useCallback } from 'react';
import { useCan } from '../../hooks';
import { Button, Space, Popconfirm, message, Row, Col, Modal, Form, Input, Select, List, Drawer, Empty } from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, QrcodeOutlined,
  CheckCircleOutlined, CloseCircleOutlined, FileOutlined, TeamOutlined,
  ClockCircleOutlined, CheckOutlined, StopOutlined,
} from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { tenderingAPI } from '../../api/domains/tendering';
import {
  SUPPLIER_STATUS,
  SUPPLIER_CATEGORIES,
  REVIEW_STATUS,
  QUALIFICATION_TYPE_LABELS,
} from '../../constants/tendering';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import {
  PageHeader,
  FilterBar,
  StatusTag,
  KpiCard,
  ResponsiveTable,
} from '../../components/tendering';

const STATUS_OPTIONS = Object.entries(SUPPLIER_STATUS).map(([k, v]) => ({ value: k, label: v.text }));
const CATEGORY_OPTIONS = Object.entries(SUPPLIER_CATEGORIES).map(([k, v]) => ({ value: k, label: v.text }));

const parseCategories = v => {
  if (!v) return [];
  return String(v).split(',').map(x => x.trim()).filter(Boolean);
};

const renderCategories = v => {
  const arr = parseCategories(v);
  if (arr.length === 0) return '-';
  return (
    <Space size={4} wrap>
      {arr.map(k => {
        const info = SUPPLIER_CATEGORIES[k];
        return (
          <StatusTag key={k} status={k} statusMap={SUPPLIER_CATEGORIES} size="small" bordered />
        );
      })}
    </Space>
  );
};

export default function SupplierList() {
  const canDelete = useCan('tender', 'delete');
  const canEdit = useCan('tender', 'edit');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tenderIdFromUrl = searchParams.get('tender');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ pending: 0, qualified: 0, rejected: 0 });
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20 });
  const [filters, setFilters] = useState({ keyword: '', status: '', category: '' });
  const debounced = useDebouncedValue(filters.keyword, 300);

  // 弹窗/抽屉状态
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [qrSupplier, setQrSupplier] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [qrLoading, setQrLoading] = useState(false);
  const [detailDrawer, setDetailDrawer] = useState(null);
  const [qualifications, setQualifications] = useState([]);
  const [qualLoading, setQualLoading] = useState(false);
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [invitingSupplier, setInvitingSupplier] = useState(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [inviteForm] = Form.useForm();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await tenderingAPI.listSuppliers({
        page: pagination.page,
        pageSize: pagination.pageSize,
        status: filters.status,
        category: filters.category,
        keyword: debounced,
      });
      const dataArr = Array.isArray(res?.data) ? res.data : [];
      setData(dataArr);
      setTotal(Number(res?.pagination?.total ?? dataArr.length));
      const counts = dataArr.reduce((acc, r) => {
        if (r.status) acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
      }, {});
      setStats({
        pending: counts.pending || 0,
        qualified: counts.qualified || 0,
        rejected: counts.rejected || 0,
      });
    } catch (err) {
      message.error(err.response?.data?.message || '获取供应商列表失败');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, filters.status, filters.category, debounced]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      await tenderingAPI.createSupplier(values);
      message.success('供应商创建成功');
      setAddModalVisible(false);
      form.resetFields();
      fetchData();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err.response?.data?.message || '创建失败');
    }
  };

  const handleEdit = async () => {
    try {
      const values = await editForm.validateFields();
      await tenderingAPI.updateSupplier(editing.id, values);
      message.success('更新成功');
      setEditModalVisible(false);
      setEditing(null);
      fetchData();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err.response?.data?.message || '更新失败');
    }
  };

  const openEdit = record => {
    setEditing(record);
    editForm.setFieldsValue({ ...record, categories: parseCategories(record.categories) });
    setEditModalVisible(true);
  };

  const handleDelete = async id => {
    try {
      await tenderingAPI.deleteSupplier(id);
      message.success('删除成功');
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.message || '删除失败');
    }
  };

  const handleSetStatus = async (id, status) => {
    try {
      await tenderingAPI.setSupplierStatus(id, status);
      message.success('状态更新成功');
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.message || '状态更新失败');
    }
  };

  const handleGenerateQR = async record => {
    setQrLoading(true);
    try {
      const res = await tenderingAPI.generateSupplierToken(record.id, 30);
      const tokenData = res?.data ?? res;
      const uploadUrl = `${window.location.origin}/supplier-upload/${tokenData.token}`;
      const dataUrl = await QRCode.toDataURL(uploadUrl, { width: 280, margin: 2 });
      setQrDataUrl(dataUrl);
      setQrSupplier({ ...record, token: tokenData.token, expires_at: tokenData.expires_at, upload_url: uploadUrl });
      setQrModalVisible(true);
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.message || '生成二维码失败');
    } finally {
      setQrLoading(false);
    }
  };

  const handleViewQualifications = async record => {
    setDetailDrawer(record);
    setQualLoading(true);
    try {
      const res = await tenderingAPI.listQualifications(record.id);
      const arr = Array.isArray(res?.data) ? res.data : [];
      setQualifications(arr);
    } catch (err) {
      message.error(err.response?.data?.message || '获取资质失败');
    } finally {
      setQualLoading(false);
    }
  };

  const handleReview = async (qualId, reviewStatus) => {
    let comment = '';
    if (reviewStatus === 'rejected') {
      comment = window.prompt('请输入驳回原因（可选）：') || '';
    }
    try {
      await tenderingAPI.reviewQualification(qualId, reviewStatus, comment);
      message.success('审核已提交');
      if (detailDrawer) handleViewQualifications(detailDrawer);
    } catch (err) {
      message.error(err.response?.data?.message || '审核失败');
    }
  };

  const handleInvite = async () => {
    try {
      const values = await inviteForm.validateFields();
      await tenderingAPI.inviteSupplier(tenderIdFromUrl, invitingSupplier.id, values.valid_days || 30);
      message.success('已邀请该供应商参与招标');
      setInviteModalVisible(false);
      setInvitingSupplier(null);
      inviteForm.resetFields();
      navigate(`/tendering/projects/${tenderIdFromUrl}`);
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err.response?.data?.message || '邀请失败');
    }
  };

  const handleReset = () => {
    setFilters({ keyword: '', status: '', category: '' });
    setPagination({ page: 1, pageSize: 20 });
  };

  const columns = [
    { title: '供应商名称', dataIndex: 'supplier_name', width: 200, fixed: 'left', ellipsis: true },
    { title: '统一信用代码', dataIndex: 'unified_code', width: 180, render: v => v || '-' },
    { title: '联系人', dataIndex: 'contact_person', width: 100, render: v => v || '-' },
    { title: '联系电话', dataIndex: 'contact_phone', width: 130, render: v => v || '-' },
    { title: '供应商类别', dataIndex: 'categories', width: 240, render: renderCategories },
    {
      title: '资质状态',
      dataIndex: 'status',
      width: 100,
      render: v => <StatusTag status={v} statusMap={SUPPLIER_STATUS} />,
    },
    {
      title: '二维码',
      dataIndex: 'register_token',
      width: 100,
      render: (v, record) => (
        <Button
          size="small"
          type={v ? 'default' : 'primary'}
          icon={<QrcodeOutlined />}
          loading={qrLoading}
          onClick={() => handleGenerateQR(record)}
        >
          {v ? '查看' : '生成'}
        </Button>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 280,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small" wrap>
          <Button size="small" icon={<EyeOutlined />} onClick={() => handleViewQualifications(record)}>
            资质
          </Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>
            编辑
          </Button>
          {record.status !== 'qualified' ? (
            <Popconfirm title="确认设为合格？" onConfirm={() => handleSetStatus(record.id, 'qualified')}>
              <Button size="small" type="link">设为合格</Button>
            </Popconfirm>
          ) : null}
          {tenderIdFromUrl ? (
            <Button
              size="small"
              type="link"
              onClick={() => {
                setInvitingSupplier(record);
                setInviteModalVisible(true);
                inviteForm.setFieldsValue({ valid_days: 30 });
              }}
            >
              邀请投标
            </Button>
          ) : null}
          <Popconfirm title="确认删除该供应商？" onConfirm={() => handleDelete(record.id)} disabled={!canDelete}>
            <Button size="small" type="link" danger icon={<DeleteOutlined />} disabled={!canDelete}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const mobileFields = [
    { label: '统一信用代码', key: 'unified_code' },
    { label: '联系人', key: 'contact_person' },
    { label: '联系电话', key: 'contact_phone' },
    { label: '类别', key: 'categories', span: 2, render: renderCategories },
  ];

  const mobileActions = row => [
    {
      key: 'view', text: '资质', icon: <EyeOutlined />, type: 'primary',
      onClick: r => handleViewQualifications(r),
    },
    {
      key: 'edit', text: '编辑', icon: <EditOutlined />,
      onClick: r => openEdit(r),
    },
    {
      key: 'qr', text: '二维码', icon: <QrcodeOutlined />, type: 'primary',
      onClick: r => handleGenerateQR(r),
    },
    {
      key: 'qualify', text: '设为合格', icon: <CheckOutlined />, type: 'primary',
      hidden: row.status === 'qualified',
      onClick: r => handleSetStatus(r.id, 'qualified'),
    },
    {
      key: 'invite', text: '邀请投标', icon: <TeamOutlined />,
      hidden: !tenderIdFromUrl,
      onClick: r => {
        setInvitingSupplier(r);
        setInviteModalVisible(true);
        inviteForm.setFieldsValue({ valid_days: 30 });
      },
    },
    {
      key: 'delete', text: '删除', icon: <DeleteOutlined />, danger: true,
      confirm: '确认删除该供应商？', onClick: r => handleDelete(r.id),
    },
  ];

  return (
    <div>
      <PageHeader
        title={tenderIdFromUrl ? '选择供应商参与招标' : '供应商管理'}
        count={total}
        description={tenderIdFromUrl ? '从合格供应商中邀请参与本次招标' : '管理所有供应商的资质和联系方式'}
        extra={
          <Space wrap>
            {tenderIdFromUrl ? (
              <Button onClick={() => navigate(`/tendering/projects/${tenderIdFromUrl}`)}>
                返回招标
              </Button>
            ) : null}
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddModalVisible(true)}>
              新增供应商
            </Button>
          </Space>
        }
      />

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={8}>
          <KpiCard
            title="待审核"
            value={stats.pending}
            tone="warning"
            icon={<ClockCircleOutlined />}
            hint="需要审核资质"
            onClick={() => setFilters(f => ({ ...f, status: 'pending' }))}
          />
        </Col>
        <Col xs={12} sm={8}>
          <KpiCard
            title="合格"
            value={stats.qualified}
            tone="success"
            icon={<CheckCircleOutlined />}
            hint="可参与投标"
            onClick={() => setFilters(f => ({ ...f, status: 'qualified' }))}
          />
        </Col>
        <Col xs={12} sm={8}>
          <KpiCard
            title="不合格"
            value={stats.rejected}
            tone="danger"
            icon={<CloseCircleOutlined />}
            hint="需重新提交资质"
            onClick={() => setFilters(f => ({ ...f, status: 'rejected' }))}
          />
        </Col>
      </Row>

      <FilterBar
        fields={[
          { name: 'keyword', type: 'input', placeholder: '搜索名称/信用代码/联系人', width: 260 },
          { name: 'status', type: 'select', placeholder: '资质状态', options: STATUS_OPTIONS, width: 140 },
          { name: 'category', type: 'select', placeholder: '供应商类别', options: CATEGORY_OPTIONS, width: 160 },
        ]}
        values={filters}
        onChange={setFilters}
        onSearch={() => setPagination(p => ({ ...p, page: 1 }))}
        onReset={handleReset}
        searchLoading={loading}
      />

      <ResponsiveTable
        dataSource={data}
        columns={columns}
        loading={loading}
        rowKey="id"
        scroll={{ x: 1500 }}
        pagination={{
          current: pagination.page,
          pageSize: pagination.pageSize,
          total,
          showSizeChanger: true,
          showTotal: t => `共 ${t} 条`,
          onChange: (page, pageSize) => setPagination({ page, pageSize }),
        }}
        mobileTitleKey="supplier_name"
        mobileStatusRender={r => <StatusTag status={r.status} statusMap={SUPPLIER_STATUS} size="small" />}
        mobileFields={mobileFields}
        mobileActions={mobileActions}
      />

      {/* 新增供应商弹窗 */}
      <Modal
        title="新增供应商"
        open={addModalVisible}
        onOk={handleCreate}
        onCancel={() => { setAddModalVisible(false); form.resetFields(); }}
        okText="创建"
        cancelText="取消"
        styles={{ wrapper: { width: 640 } }}
      >
        <SupplierForm form={form} />
      </Modal>

      {/* 编辑供应商弹窗 */}
      <Modal
        title="编辑供应商"
        open={editModalVisible}
        onOk={handleEdit}
        onCancel={() => { setEditModalVisible(false); setEditing(null); }}
        okText="保存"
        cancelText="取消"
        styles={{ wrapper: { width: 640 } }}
      >
        <SupplierForm form={editForm} />
      </Modal>

      {/* 二维码弹窗 */}
      <Modal
        title="供应商资质上传二维码"
        open={qrModalVisible}
        onCancel={() => { setQrModalVisible(false); setQrSupplier(null); setQrDataUrl(''); }}
        footer={[
          <Button key="download" onClick={() => {
            if (!qrDataUrl) return;
            const a = document.createElement('a');
            a.href = qrDataUrl;
            a.download = `供应商资质上传-${qrSupplier?.supplier_name || 'qr'}.png`;
            a.click();
          }}>下载二维码</Button>,
          <Button key="copy" onClick={() => {
            if (qrSupplier?.upload_url) {
              navigator.clipboard.writeText(qrSupplier.upload_url);
              message.success('上传链接已复制');
            }
          }}>复制上传链接</Button>,
          <Button key="close" type="primary" onClick={() => { setQrModalVisible(false); setQrSupplier(null); setQrDataUrl(''); }}>关闭</Button>,
        ]}
      >
        {qrSupplier && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 16, fontWeight: 500 }}>{qrSupplier.supplier_name}</p>
            {qrDataUrl && <img src={qrDataUrl} alt="二维码" style={{ margin: '16px auto' }} />}
            <p style={{ color: '#888' }}>请供应商使用手机扫描上方二维码，进入资质上传页面</p>
            <p style={{ fontSize: 12, color: '#aaa', wordBreak: 'break-all' }}>{qrSupplier.upload_url}</p>
            <p style={{ fontSize: 12, color: qrSupplier.expires_at ? '#faad14' : '#888' }}>
              有效期至：{qrSupplier.expires_at ? new Date(qrSupplier.expires_at).toLocaleString('zh-CN') : '未设置'}
            </p>
          </div>
        )}
      </Modal>

      {/* 邀请供应商弹窗 */}
      <Modal
        title="邀请供应商参与招标"
        open={inviteModalVisible}
        onOk={handleInvite}
        onCancel={() => { setInviteModalVisible(false); setInvitingSupplier(null); inviteForm.resetFields(); }}
        okText="发送邀请"
        cancelText="取消"
      >
        <Form form={inviteForm} layout="vertical">
          <p>将邀请 <strong>{invitingSupplier?.supplier_name}</strong> 参与本次招标</p>
          <Form.Item name="valid_days" label="邀请有效期（天）" rules={[{ required: true }]}>
            <Input type="number" min={1} max={365} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 资质详情抽屉 */}
      <Drawer
        title={detailDrawer ? `供应商资质 - ${detailDrawer.supplier_name}` : '供应商资质'}
        open={!!detailDrawer}
        onClose={() => { setDetailDrawer(null); setQualifications([]); }}
        styles={{ wrapper: { width: 620 } }}
      >
        {qualLoading ? (
          <p>加载中...</p>
        ) : qualifications.length === 0 ? (
          <Empty description="该供应商暂未上传资质材料" />
        ) : (
          <List
            itemLayout="vertical"
            dataSource={qualifications}
            renderItem={item => (
              <List.Item
                key={item.id}
                actions={[
                  <a href={`/uploads/tendering/qualifications/${item.file_name}`} target="_blank" rel="noreferrer">查看文件</a>,
                  item.review_status === 'pending' && (
                    <Space>
                      <Button size="small" type="primary" icon={<CheckCircleOutlined />} onClick={() => handleReview(item.id, 'approved')}>通过</Button>
                      <Button size="small" danger icon={<CloseCircleOutlined />} onClick={() => handleReview(item.id, 'rejected')}>驳回</Button>
                    </Space>
                  ),
                ].filter(Boolean)}
              >
                <List.Item.Meta
                  avatar={<FileOutlined />}
                  title={
                    <Space>
                      <span>{item.qualification_name || QUALIFICATION_TYPE_LABELS[item.qualification_type] || item.qualification_type}</span>
                      <Tag>{QUALIFICATION_TYPE_LABELS[item.qualification_type] || item.qualification_type}</Tag>
                      <Tag color={REVIEW_STATUS[item.review_status]?.color}>{REVIEW_STATUS[item.review_status]?.text || item.review_status}</Tag>
                    </Space>
                  }
                  description={
                    <>
                      <div>文件名：{item.original_name || item.file_name}</div>
                      <div>大小：{(item.file_size / 1024).toFixed(1)} KB · 上传时间：{item.created_at?.replace('T', ' ').slice(0, 16)}</div>
                      {item.valid_until && <div>有效期至：{item.valid_until}</div>}
                      {item.review_comment && <div>审核意见：{item.review_comment}</div>}
                    </>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Drawer>
    </div>
  );
}

// 供应商表单（抽出共用）
function SupplierForm({ form }) {
  return (
    <Form form={form} layout="vertical">
      <Form.Item name="supplier_name" label="供应商名称" rules={[{ required: true, message: '请输入供应商名称' }]}>
        <Input />
      </Form.Item>
      <Form.Item name="unified_code" label="统一社会信用代码">
        <Input />
      </Form.Item>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="contact_person" label="联系人">
            <Input />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="contact_phone" label="联系电话">
            <Input />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item
        name="contact_email"
        label="联系邮箱"
        rules={[
          { required: true, message: '请输入联系邮箱（用于接收中标/资质/邀请等邮件通知）' },
          { type: 'email', message: '请输入合法邮箱' },
        ]}
      >
        <Input />
      </Form.Item>
      <Form.Item name="address" label="地址">
        <Input />
      </Form.Item>
      <Form.Item name="bank_account" label="开户行及账号">
        <Input />
      </Form.Item>
      <Form.Item name="categories" label="供应商类别">
        <Select mode="multiple" placeholder="请选择供应商类别（可多选）" allowClear optionFilterProp="children">
          {Object.entries(SUPPLIER_CATEGORIES).map(([k, v]) => (
            <Select.Option key={k} value={k}>{v.text}</Select.Option>
          ))}
        </Select>
      </Form.Item>
      <Form.Item name="remark" label="备注">
        <Input.TextArea rows={2} />
      </Form.Item>
    </Form>
  );
}
