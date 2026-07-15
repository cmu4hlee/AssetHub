import React, { useState, useEffect, useCallback } from 'react';
import { useCan } from '../hooks';
import { Form, Input, Button, DatePicker, Select, AutoComplete, message, Space, Spin, Divider, Row, Col, Tag, Alert } from 'antd';
import { SearchOutlined, CheckCircleOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useParams, useLocation } from 'react-router-dom';
import dayjs from 'dayjs';
import { acceptanceAPI } from '../utils/api';
import { useCurrentUser } from '../hooks';

const { Option } = Select;

const AcceptanceForm = ({ record: propRecord, onSuccess, onCancel, ...rest }) => {
  const { id: paramId } = useParams();
  const location = useLocation();
  const record = propRecord || location.state?.record || (paramId ? { id: paramId } : null);
  const canDelete = useCan('acceptance', 'delete');
  const canEdit = useCan('acceptance', 'edit');
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [assetLoading, setAssetLoading] = useState(false);
  const [assetInfo, setAssetInfo] = useState(null);
  const [assetOptions, setAssetOptions] = useState([]);
  const [initChecklistLoading, setInitChecklistLoading] = useState(false);
  const { user: currentUser } = useCurrentUser();

  useEffect(() => {
    let cancelled = false;
    const isEdit = !!record?.id;

    const applyValues = (full) => {
      form.setFieldsValue({
        asset_code: full.asset_code || undefined,
        asset_name: full.asset_name || undefined,
        supplier: full.supplier || undefined,
        acceptance_date: full.acceptance_date ? dayjs(full.acceptance_date) : dayjs(),
        acceptance_person: full.acceptance_person || currentUser?.real_name || '',
        department: full.department || undefined,
        functional_department: full.functional_department || undefined,
        status: full.status || '待验收',
        remark: full.remark || undefined,
      });
    };

    const loadInitial = async () => {
      if (!isEdit) {
        // 新建模式：仅填默认值
        form.setFieldsValue({
          acceptance_date: dayjs(),
          acceptance_person: currentUser?.real_name || '',
          status: '待验收',
        });
        return;
      }
      // 编辑模式：若调用方已传完整记录（如列表弹窗），直接使用；
      // 若为路由进入（仅含 id），则拉取完整记录回填。
      const hasFullData = record.asset_code || record.asset_name || record.department;
      let full = record;
      if (!hasFullData) {
        try {
          const resp = await acceptanceAPI.getAcceptanceRecord(record.id);
          if (resp?.success && resp.data) {
            full = resp.data.record || resp.data;
          }
        } catch (e) {
          console.error('加载验收记录失败:', e);
        }
      }
      if (!cancelled) applyValues(full);
    };

    loadInitial();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record?.id, form, currentUser]);

  const handleAssetSearch = useCallback(async (value) => {
    if (!value || value.length < 2) {
      setAssetOptions([]);
      return;
    }
    setAssetLoading(true);
    try {
      const resp = await fetch(`/api/assets?pageSize=50&keyword=${encodeURIComponent(value)}&page=1`);
      const json = await resp.json();
      if (json.success) {
        setAssetOptions(json.data.data.map(a => ({
          value: a.asset_code,
          label: `${a.asset_code} - ${a.asset_name}`,
          ...a,
        })));
      }
    } catch (error) {
      console.error('搜索资产失败:', error);
    } finally {
      setAssetLoading(false);
    }
  }, []);

  const handleAssetSelect = useCallback(async (value) => {
    const selected = assetOptions.find(o => o.value === value);
    if (selected) {
      form.setFieldsValue({
        asset_code: selected.asset_code || selected.value,
        asset_name: selected.asset_name || selected.label,
      });
      // 自动填充供应商等信息
      try {
        const fillResp = await acceptanceAPI.getAssetFillInfo(value);
        if (fillResp.success) {
          setAssetInfo(fillResp.data);
          form.setFieldsValue({
            supplier: fillResp.data.supplier,
            department: fillResp.data.department,
          });
        }
      } catch (e) {
        console.error('自动填充资产信息失败:', e);
      }
    }
  }, [assetOptions, form]);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const payload = {
        assetCode: values.asset_code,
        assetName: values.asset_name,
        supplier: values.supplier,
        acceptanceDate: values.acceptance_date.format('YYYY-MM-DD'),
        acceptancePerson: values.acceptance_person,
        department: values.department,
        functionalDepartment: values.functional_department,
        status: values.status,
        remark: values.remark,
      };

      if (record?.id) {
        const resp = await acceptanceAPI.updateAcceptanceRecord(record.id, payload);
        if (resp.success) {
          message.success('更新成功');
          onSuccess?.();
        } else {
          message.error(resp.message || '更新失败');
        }
      } else {
        const resp = await acceptanceAPI.createAcceptanceRecord(payload);
        if (resp.success) {
          message.success('创建成功');
          // 询问是否初始化检查清单
          const newId = resp.data?.id;
          if (newId && values.status !== '已验收') {
            setInitChecklistLoading(true);
            try {
              const clResp = await acceptanceAPI.initChecklist(newId);
              if (clResp.success) {
                message.success(clResp.message);
              }
            } catch (e) {
              // 忽略清单初始化错误
            } finally {
              setInitChecklistLoading(false);
            }
          }
          onSuccess?.();
        } else {
          message.error(resp.message || '创建失败');
        }
      }
    } catch (error) {
      message.error(record?.id ? '更新失败' : '创建失败');
    } finally {
      setLoading(false);
    }
  };

  const departments = ['骨科', '内科', '外科', '儿科', '妇产科', 'ICU', '手术室', '急诊科', '康复科', '检验科', '影像科'];
  const functionalDepts = ['医务科', '护理部', '设备科', '后勤科', '信息科'];

  return (
    <Form form={form} onFinish={onFinish} layout="vertical" disabled={loading}>
      {assetInfo && (
        <Alert title="已从资产库自动填充信息"
          description={`资产编号：${assetInfo.assetCode}，资产名称：${assetInfo.assetName}`}
          type="success"
          icon={<CheckCircleOutlined />}
          style={{ marginBottom: 16 }}
          closable
          onClose={() => setAssetInfo(null)}
        />
      )}

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item label="资产编号" name="asset_code" rules={[{ required: true, message: '请输入资产编号' }]}>
            <AutoComplete
              options={assetOptions}
              onSearch={handleAssetSearch}
              onSelect={handleAssetSelect}
              notFoundContent={assetLoading ? <Spin size="small" /> : null}
              placeholder="搜索或输入资产编号"
              style={{ width: '100%' }}
              suffixIcon={<SearchOutlined />}
            />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item label="资产名称" name="asset_name" rules={[{ required: true, message: '请输入资产名称' }]}>
            <Input placeholder="请输入资产名称" />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item label="供应商" name="supplier">
            <Input placeholder="请输入供应商" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item label="验收日期" name="acceptance_date" rules={[{ required: true, message: '请选择验收日期' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item label="验收人" name="acceptance_person" rules={[{ required: true, message: '请输入验收人' }]}>
            <Input placeholder="请输入验收人" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item label="使用科室" name="department" rules={[{ required: true, message: '请选择使用科室' }]}>
            <Select placeholder="请选择使用科室" showSearch>
              {departments.map(dept => <Option key={dept} value={dept}>{dept}</Option>)}
            </Select>
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item label="职能部门" name="functional_department">
            <Select placeholder="请选择职能部门" allowClear showSearch>
              {functionalDepts.map(dept => <Option key={dept} value={dept}>{dept}</Option>)}
            </Select>
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item label="状态" name="status" rules={[{ required: true }]}>
            <Select>
              <Option value="待验收">待验收</Option>
              <Option value="验收中">验收中</Option>
              <Option value="已验收">已验收</Option>
              <Option value="验收不合格">验收不合格</Option>
            </Select>
          </Form.Item>
        </Col>
      </Row>

      <Form.Item label="备注" name="remark">
        <Input.TextArea rows={3} placeholder="请输入备注信息" />
      </Form.Item>

      <Form.Item style={{ marginBottom: 0 }}>
        <Space>
          <Button type="primary" htmlType="submit" loading={loading || initChecklistLoading}>
            {record ? '更新' : '创建验收记录'}
          </Button>
          <Button onClick={() => onCancel?.()}>取消</Button>
        </Space>
      </Form.Item>
    </Form>
  );
};

export default AcceptanceForm;
