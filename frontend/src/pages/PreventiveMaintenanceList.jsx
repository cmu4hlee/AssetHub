import React, { useState, useEffect } from 'react';
import { Card, Typography, message, Table, Input, Select, DatePicker, Button, Space, Modal, Tag, Popconfirm, Form, Drawer, Descriptions, InputNumber, Checkbox, Row, Col, Divider, Alert, Tabs, List, Spin } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ExclamationCircleOutlined, CheckCircleOutlined, ThunderboltOutlined, EyeOutlined, SwapOutlined, RocketOutlined, SearchOutlined, ApartmentOutlined, AppstoreOutlined } from '@ant-design/icons';
import { maintenanceAPI, assetAPI } from '../utils/api';
import dayjs from 'dayjs';
import { useIsMobile, useCan } from '../hooks';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;
const { Search } = Input;

const cycleTypeMap = { '按天': 'day', '按周': 'week', '按月': 'month', '按季度': 'quarter', '按年': 'year' };
const cycleValueDays = { '按天': 1, '按周': 7, '按月': 30, '按季度': 90, '按年': 365 };

const triggerTypeLabels = { time: '时间', usage: '使用量', condition: '条件' };
const triggerTypeColors = { time: 'blue', usage: 'orange', condition: 'purple' };

const modeToFilterField = mode => (mode === 'category' ? 'category_ids' : 'department_codes');

const calcNextDate = (lastDate, cycleType, cycleValue) => {
  if (!lastDate || !cycleType || !cycleValue) return null;
  const base = dayjs(lastDate);
  const v = parseInt(cycleValue, 10);
  if (isNaN(v) || v <= 0) return null;
  switch (cycleType) {
    case '按天': return base.add(v, 'day');
    case '按周': return base.add(v, 'week');
    case '按月': return base.add(v, 'month');
    case '按季度': return base.add(v * 3, 'month');
    case '按年': return base.add(v, 'year');
    default: return null;
  }
};

const getOverdueTag = (nextDate) => {
  if (!nextDate) return null;
  const today = dayjs().startOf('day');
  const next = dayjs(nextDate).startOf('day');
  const diff = next.diff(today, 'day');
  if (diff < 0) return <Tag color="red" style={{ marginLeft: 4 }}>已过期</Tag>;
  if (diff <= 7) return <Tag color="warning" style={{ marginLeft: 4 }}>即将到期</Tag>;
  return null;
};

const PreventiveMaintenanceList = () => {
  const isMobile = useIsMobile();
  const canDelete = useCan('maintenance', 'delete');
  const canEdit = useCan('maintenance', 'edit');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });
  const [searchParams, setSearchParams] = useState({
    asset_code: '',
    status: '',
    keyword: '',
    trigger_type: '',
  });
  const [form] = Form.useForm();
  const [completeForm] = Form.useForm();
  const [searchForm] = Form.useForm();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [completeModalVisible, setCompleteModalVisible] = useState(false);
  const [completingId, setCompletingId] = useState(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [drawerRecord, setDrawerRecord] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // 批量创建相关
  const [batchModalVisible, setBatchModalVisible] = useState(false);
  const [batchForm] = Form.useForm();
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchResult, setBatchResult] = useState(null); // { created, failed, ids }
  const [batchMode, setBatchMode] = useState('template'); // 'template' | 'rows' | 'category' | 'department'

  // 批量创建 - 多选筛选（按种类 / 按部门）
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [departmentOptions, setDepartmentOptions] = useState([]);
  const [filterOptionsLoading, setFilterOptionsLoading] = useState(false);
  const [previewInfo, setPreviewInfo] = useState(null); // { total, sample, by_category, by_department }
  const [previewLoading, setPreviewLoading] = useState(false);

  // 批量创建 - 预防性维护模板（选中后自动带出周期/工时/维护内容以指导执行）
  const [templateOptions, setTemplateOptions] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);

  // 加载数据
  const loadData = async () => {
    setLoading(true);
    try {
      const response = await maintenanceAPI.getMaintenancePlans({
        page: pagination.current,
        pageSize: pagination.pageSize,
        ...searchParams,
      });
      if (response.success) {
        setData(response.data || []);
        setPagination(prev => ({
          ...prev,
          total: response.pagination?.total || 0,
        }));
      } else {
        message.error('加载预防性维护计划失败');
      }
    } catch (error) {
      console.error('加载预防性维护计划失败:', error);
      message.error('网络错误，加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [pagination.current, pagination.pageSize, searchParams]);

  // 处理搜索
  const handleSearch = values => {
    setSearchParams({
      asset_code: values.asset_code || '',
      status: values.status || '',
      keyword: values.keyword || '',
      trigger_type: values.trigger_type || '',
    });
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  // 处理分页
  const handlePaginationChange = (current, pageSize) => {
    setPagination({ current, pageSize, total: pagination.total });
  };

  // 处理创建
  const handleCreate = () => {
    setEditingRecord(null);
    setIsEditing(false);
    form.resetFields();
    setIsModalVisible(true);
  };

  // 处理编辑
  const handleEdit = record => {
    setEditingRecord(record);
    setIsEditing(true);
    setIsModalVisible(true);
    form.setFieldsValue({
      ...record,
      next_maintenance_date: record.next_maintenance_date ? dayjs(record.next_maintenance_date) : undefined,
      last_maintenance_date: record.last_maintenance_date ? dayjs(record.last_maintenance_date) : undefined,
    });
  };

  // 处理删除
  const handleDelete = async id => {
    try {
      const response = await maintenanceAPI.deleteMaintenancePlan(id);
      if (response.success) {
        message.success('删除成功');
        loadData();
      } else {
        message.error('删除失败');
      }
    } catch (error) {
      console.error('删除失败:', error);
      message.error('网络错误，删除失败');
    }
  };

  // 处理完成 - 打开弹窗
  const handleOpenComplete = id => {
    setCompletingId(id);
    completeForm.resetFields();
    setCompleteModalVisible(true);
  };

  // 处理完成 - 提交
  const handleCompleteSubmit = async values => {
    try {
      const data = {
        ...values,
        maintenance_date: values.maintenance_date
          ? values.maintenance_date.format('YYYY-MM-DD')
          : dayjs().format('YYYY-MM-DD'),
        maintenance_cost: values.maintenance_cost ?? undefined,
        actual_hours: values.actual_hours ?? undefined,
      };
      const response = await maintenanceAPI.completeMaintenancePlan(completingId, data);
      if (response.success) {
        message.success('完成维护成功');
        setCompleteModalVisible(false);
        loadData();
        if (drawerVisible && drawerRecord?.id === completingId) {
          loadDrawerHistory(completingId);
        }
      } else {
        message.error(response.message || '完成维护失败');
      }
    } catch (error) {
      console.error('完成维护失败:', error);
      message.error('网络错误，完成维护失败');
    }
  };

  // 立即执行
  const handleTrigger = async id => {
    try {
      const response = await maintenanceAPI.triggerMaintenancePlan(id, { trigger_type: 'manual' });
      if (response.success) {
        message.success('已触发执行');
        loadData();
        if (drawerVisible && drawerRecord?.id === id) {
          loadDrawerHistory(id);
        }
      } else {
        message.error(response.message || '触发执行失败');
      }
    } catch (error) {
      console.error('触发执行失败:', error);
      message.error('网络错误，触发执行失败');
    }
  };

  // 启用/禁用切换
  const handleToggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === '启用' ? '禁用' : '启用';
    try {
      const response = await maintenanceAPI.updateMaintenancePlan(id, { status: newStatus });
      if (response.success) {
        message.success(`已${newStatus}`);
        loadData();
        if (drawerVisible && drawerRecord?.id === id) {
          setDrawerRecord(prev => ({ ...prev, status: newStatus }));
        }
      } else {
        message.error(response.message || '操作失败');
      }
    } catch (error) {
      console.error('操作失败:', error);
      message.error('网络错误，操作失败');
    }
  };

  // 打开详情 Drawer
  const handleOpenDrawer = async record => {
    setDrawerRecord(record);
    setDrawerVisible(true);
    loadDrawerHistory(record.id);
  };

  const loadDrawerHistory = async id => {
    setHistoryLoading(true);
    try {
      const response = await maintenanceAPI.getMaintenancePlanHistory(id);
      if (response.success) {
        setHistoryData(response.data || []);
      } else {
        setHistoryData([]);
      }
    } catch (error) {
      console.error('加载维护历史失败:', error);
      setHistoryData([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  // 处理提交
  const handleSubmit = async values => {
    try {
      const submitData = {
        ...values,
        next_maintenance_date: values.next_maintenance_date
          ? values.next_maintenance_date.format('YYYY-MM-DD')
          : undefined,
        last_maintenance_date: values.last_maintenance_date
          ? values.last_maintenance_date.format('YYYY-MM-DD')
          : undefined,
      };
      let response;
      if (isEditing && editingRecord) {
        response = await maintenanceAPI.updateMaintenancePlan(editingRecord.id, submitData);
      } else {
        response = await maintenanceAPI.createMaintenancePlan(submitData);
      }
      if (response.success) {
        message.success(isEditing ? '更新成功' : '创建成功');
        setIsModalVisible(false);
        loadData();
      } else {
        message.error(response.message || (isEditing ? '更新失败' : '创建失败'));
      }
    } catch (error) {
      console.error(isEditing ? '更新失败:' : '创建失败:', error);
      message.error('网络错误，操作失败');
    }
  };

  // 状态标签
  const statusTag = status => {
    switch (status) {
      case '启用':
        return <Tag color="green">启用</Tag>;
      case '禁用':
        return <Tag color="red">禁用</Tag>;
      default:
        return <Tag>{status}</Tag>;
    }
  };

  // 打开批量创建弹窗
  const handleOpenBatch = () => {
    setBatchResult(null);
    setBatchMode('template');
    setPreviewInfo(null);
    setSelectedTemplateId(null);
    batchForm.resetFields();
    setBatchModalVisible(true);
    loadBatchFilterOptions();
  };

  // 加载种类 / 部门 / 维护模板列表（用于多选筛选与模板套用）
  const loadBatchFilterOptions = async () => {
    setFilterOptionsLoading(true);
    try {
      const [catRes, deptRes, tplRes] = await Promise.all([
        assetAPI.getCategories({ pageSize: 500 }).catch(() => ({ data: [] })),
        assetAPI.getDepartments().catch(() => ({ data: [] })),
        maintenanceAPI.getMaintenanceTemplates({ status: '启用' }).catch(() => ({ data: [] })),
      ]);

      // 种类：API 可能是 {id,name} 或 {id,category_name,...}，做归一化
      const cats = (catRes.data || []).map(c => ({
        id: c.id,
        name: c.name || c.category_name || `分类#${c.id}`,
      }));
      setCategoryOptions(cats);

      // 部门：可能是平铺或树形，统一压平
      const flatten = items => {
        const out = [];
        const visit = arr => {
          if (!Array.isArray(arr)) return;
          arr.forEach(it => {
            out.push({
              code: it.department_code || it.code || it.id,
              name: it.department_name || it.name || it.title || String(it.id),
            });
            if (it.children && it.children.length) visit(it.children);
          });
        };
        visit(items);
        return out;
      };
      setDepartmentOptions(flatten(deptRes.data || []));

      // 维护模板：归一化并解析 JSON 字段（维护项目 / 所需材料）
      const parseArr = v => {
        if (Array.isArray(v)) return v;
        if (typeof v === 'string' && v.trim()) {
          try {
            const p = JSON.parse(v);
            return Array.isArray(p) ? p : [];
          } catch {
            return [];
          }
        }
        return [];
      };
      setTemplateOptions(
        (tplRes.data || []).map(t => ({
          id: t.id,
          template_name: t.template_name,
          asset_type: t.asset_type,
          cycle_type: t.cycle_type,
          cycle_value: t.cycle_value,
          estimated_hours: t.estimated_hours,
          maintenance_content: t.maintenance_content,
          maintenance_items: parseArr(t.maintenance_items),
          required_materials: parseArr(t.required_materials),
        })),
      );
    } catch (error) {
      console.error('加载筛选选项失败:', error);
    } finally {
      setFilterOptionsLoading(false);
    }
  };

  // 套用维护模板：选中后自动带出周期/工时/维护内容与维护项目清单（指导执行）
  const applyTemplate = templateId => {
    const tpl = templateOptions.find(t => t.id === templateId);
    if (!tpl) return;
    setSelectedTemplateId(templateId);

    const patch = { template_id: templateId };
    if (tpl.cycle_type) patch.cycle_type = tpl.cycle_type;
    if (tpl.cycle_value != null) patch.cycle_value = tpl.cycle_value;
    if (tpl.estimated_hours != null) patch.estimated_hours = tpl.estimated_hours;

    // 维护内容 = 模板维护内容 + 维护项目清单（用于指导现场执行）
    const items = Array.isArray(tpl.maintenance_items) ? tpl.maintenance_items : [];
    const parts = [];
    if (tpl.maintenance_content) parts.push(tpl.maintenance_content);
    if (items.length) {
      parts.push('维护项目：\n' + items.map((it, i) => `${i + 1}. ${it}`).join('\n'));
    }
    if (parts.length) patch.maintenance_content = parts.join('\n');

    // 计划名称为空时，用模板名生成（带 {asset_code} 占位，逐资产替换）
    if (!batchForm.getFieldValue('plan_name')) {
      patch.plan_name = `{asset_code} ${tpl.template_name}`;
    }
    // 维护类型默认「定期维护」
    if (!batchForm.getFieldValue('maintenance_type')) {
      patch.maintenance_type = '定期维护';
    }

    batchForm.setFieldsValue(patch);
    message.success(`已套用模板「${tpl.template_name}」，可在下方微调`);
  };

  // 预览：根据当前已选的 category_ids / department_codes 拉匹配资产数
  const handlePreviewBatch = async (values, mode) => {
    if (mode !== 'category' && mode !== 'department' && mode !== 'combo') return;
    setPreviewLoading(true);
    try {
      const params = {};
      if (mode === 'category') {
        params.category_ids = values.category_ids || [];
      } else if (mode === 'department') {
        params.department_codes = values.department_codes || [];
      } else {
        // 组合模式：同时按资产种类 + 部门（后端按 AND 取交集）
        params.category_ids = values.category_ids || [];
        params.department_codes = values.department_codes || [];
      }
      const res = await maintenanceAPI.previewBatchMaintenanceAssets(params);
      if (res.success) {
        setPreviewInfo(res.data);
      } else {
        setPreviewInfo(null);
        message.error(res.message || '预览失败');
      }
    } catch (error) {
      console.error('预览失败:', error);
      setPreviewInfo(null);
      message.error('预览失败');
    } finally {
      setPreviewLoading(false);
    }
  };

  // 批量创建提交
  const handleBatchSubmit = async values => {
    setBatchLoading(true);
    try {
      let payload;
      // 若选择了维护模板，附带模板的维护项目/材料清单（落库并关联 template_id，用于指导执行）
      const withTemplateExtras = tpl => {
        if (tpl && tpl.template_id) {
          const src = templateOptions.find(t => t.id === tpl.template_id);
          if (src) {
            if (Array.isArray(src.maintenance_items) && src.maintenance_items.length) {
              tpl.maintenance_items = src.maintenance_items;
            }
            if (Array.isArray(src.required_materials) && src.required_materials.length) {
              tpl.required_materials = src.required_materials;
            }
          }
        }
        return tpl;
      };
      if (batchMode === 'template') {
        // 模板模式：解析资产编号列表
        const codes = (values.asset_codes_text || '')
          .split(/[\n,，\s]+/)
          .map(s => s.trim())
          .filter(s => s.length > 0);
        if (codes.length === 0) {
          message.error('请输入至少一个资产编号');
          setBatchLoading(false);
          return;
        }
        const { asset_codes_text, ...template } = values;
        payload = { asset_codes: codes, template: withTemplateExtras(template) };
      } else if (batchMode === 'category' || batchMode === 'department' || batchMode === 'combo') {
        // 按种类/部门筛选（组合模式可同时指定两者，后端按 AND 取交集）
        const {
          // 把其他字段归入 template
          asset_codes_text: _ignore1,
          rows: _ignore2,
          ...template
        } = values;
        const catIds = (values.category_ids || []).filter(Boolean);
        const deptIds = (values.department_codes || []).filter(Boolean);
        if (batchMode === 'combo') {
          if (catIds.length === 0 || deptIds.length === 0) {
            message.error('组合模式请至少选择一个资产种类和至少一个部门');
            setBatchLoading(false);
            return;
          }
        } else if (catIds.length + deptIds.length === 0) {
          message.error(`请至少选择一个${batchMode === 'category' ? '资产种类' : '部门'}`);
          setBatchLoading(false);
          return;
        }
        payload = { template: withTemplateExtras(template) };
        if (catIds.length) payload.category_ids = catIds;
        if (deptIds.length) payload.department_codes = deptIds;
      } else {
        // 行模式：从 Form.List 提取
        const rows = (values.rows || []).filter(r => r && r.asset_code);
        if (rows.length === 0) {
          message.error('请至少填写一条记录');
          setBatchLoading(false);
          return;
        }
        payload = { plans: rows };
      }

      const response = await maintenanceAPI.batchCreateMaintenancePlans(payload);
      if (response.success) {
        setBatchResult(response.data);
        if (response.data.failed && response.data.failed.length > 0) {
          message.warning(response.message || '部分创建失败');
        } else {
          message.success(response.message || '批量创建成功');
        }
        loadData();
      } else {
        // 全失败
        setBatchResult(response.data || { created: 0, failed: [], ids: [] });
        message.error(response.message || '批量创建失败');
      }
    } catch (error) {
      console.error('批量创建失败:', error);
      message.error('网络错误，批量创建失败');
    } finally {
      setBatchLoading(false);
    }
  };

  // 触发类型标签
  const triggerTypeTag = type => {
    if (!type) return <Tag>时间</Tag>;
    return <Tag color={triggerTypeColors[type] || 'default'}>{triggerTypeLabels[type] || type}</Tag>;
  };

  // 历史记录列定义
  const historyColumns = [
    { title: '维护日期', dataIndex: 'maintenance_date', key: 'maintenance_date', width: 120 },
    { title: '维护人员', dataIndex: 'maintenance_person', key: 'maintenance_person', width: 100, ellipsis: true },
    { title: '维护结果', dataIndex: 'maintenance_result', key: 'maintenance_result', width: 100, ellipsis: true },
    { title: '维护费用', dataIndex: 'maintenance_cost', key: 'maintenance_cost', width: 100, render: v => v != null ? `¥${v}` : '-' },
    { title: '实际工时', dataIndex: 'actual_hours', key: 'actual_hours', width: 90, render: v => v != null ? `${v}h` : '-' },
    { title: '备注', dataIndex: 'remark', key: 'remark', ellipsis: true },
  ];

  // 列定义
  const columns = [
    {
      title: '计划名称',
      dataIndex: 'plan_name',
      key: 'plan_name',
      ellipsis: true,
      width: 160,
    },
    {
      title: '资产编号',
      dataIndex: 'asset_code',
      key: 'asset_code',
      ellipsis: true,
      width: 120,
    },
    {
      title: '资产名称',
      dataIndex: 'asset_name',
      key: 'asset_name',
      ellipsis: true,
      width: 120,
    },
    {
      title: '维护类型',
      dataIndex: 'maintenance_type',
      key: 'maintenance_type',
      width: 100,
      ellipsis: true,
    },
    {
      title: '触发类型',
      dataIndex: 'trigger_type',
      key: 'trigger_type',
      width: 100,
      render: type => triggerTypeTag(type),
    },
    {
      title: '维护周期',
      dataIndex: 'cycle',
      key: 'cycle',
      width: 100,
      render: (_, record) => `${record.cycle_value || ''}${record.cycle_type || ''}`,
    },
    {
      title: '下次维护日期',
      dataIndex: 'next_maintenance_date',
      key: 'next_maintenance_date',
      width: 140,
      render: val => (
        <span>
          {val ? dayjs(val).format('YYYY-MM-DD') : '-'}
          {getOverdueTag(val)}
        </span>
      ),
    },
    {
      title: '上次维护日期',
      dataIndex: 'last_maintenance_date',
      key: 'last_maintenance_date',
      width: 130,
      render: val => val ? dayjs(val).format('YYYY-MM-DD') : '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: status => statusTag(status),
    },
    {
      title: '责任人',
      dataIndex: 'responsible_person',
      key: 'responsible_person',
      width: 100,
      ellipsis: true,
    },
    {
      title: '操作',
      key: 'action',
      width: 280,
      render: (_, record) => (
        <Space size="small" wrap>
          <Button
            type="link"
            icon={<CheckCircleOutlined />}
            size="small"
            style={{ color: '#52c41a' }}
            onClick={() => handleOpenComplete(record.id)}
          >
            完成
          </Button>
          <Button
            type="link"
            icon={<ThunderboltOutlined />}
            size="small"
            style={{ color: '#faad14' }}
            onClick={() => handleTrigger(record.id)}
          >
            执行
          </Button>
          <Button
            type="link"
            icon={<SwapOutlined />}
            size="small"
            onClick={() => handleToggleStatus(record.id, record.status)}
          >
            {record.status === '启用' ? '禁用' : '启用'}
          </Button>
          <Button
            type="link"
            icon={<EyeOutlined />}
            size="small"
            onClick={() => handleOpenDrawer(record)}
          >
            详情
          </Button>
          <Button
            type="link"
            icon={<EditOutlined />}
            size="small"
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除吗？"
            onConfirm={() => handleDelete(record.id)} disabled={!canDelete}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />} disabled={!canDelete} size="small">
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 自动计算下次维护日期
  const handleCycleChange = () => {
    const cycleType = form.getFieldValue('cycle_type');
    const cycleValue = form.getFieldValue('cycle_value');
    const lastDate = form.getFieldValue('last_maintenance_date');
    if (cycleType && cycleValue && lastDate) {
      const next = calcNextDate(lastDate, cycleType, cycleValue);
      if (next) {
        form.setFieldsValue({ next_maintenance_date: next });
      }
    }
  };

  const triggerType = Form.useWatch('trigger_type', form);

  // 批量创建 - 共享「计划配置」区块（含维护模板选择：选中后自动带出周期/工时/维护内容+维护项目清单，用于指导执行）
  const planConfigFields = (
    <>
      <Divider style={{ margin: '8px 0 16px' }}>计划配置</Divider>

      <Form.Item
        name="template_id"
        label={
          <span>
            <RocketOutlined /> 选择预防性维护模板
          </span>
        }
        extra="从模板库选择后，自动带出周期、预计工时、维护内容与维护项目清单以指导执行；带出后仍可手动微调"
      >
        <Select
          placeholder="可选：选择一个维护模板自动填充计划配置"
          showSearch
          optionFilterProp="label"
          allowClear
          loading={filterOptionsLoading}
          onChange={val => (val ? applyTemplate(val) : setSelectedTemplateId(null))}
        >
          {templateOptions.map(t => (
            <Option key={t.id} value={t.id} label={t.template_name}>
              {t.template_name}
              {(t.asset_type || t.cycle_type) && (
                <span style={{ color: '#999', marginLeft: 6, fontSize: 12 }}>
                  {t.asset_type ? ` · ${t.asset_type}` : ''}
                  {t.cycle_type ? ` · ${t.cycle_type}${t.cycle_value || ''}` : ''}
                </span>
              )}
            </Option>
          ))}
        </Select>
      </Form.Item>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            name="plan_name"
            label="计划名称"
            rules={[{ required: true, message: '请输入计划名称' }]}
            extra="可用 {asset_code} 占位"
          >
            <Input placeholder="如：{asset_code} 季度保养" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            name="maintenance_type"
            label="维护类型"
            rules={[{ required: true, message: '请选择维护类型' }]}
          >
            <Select>
              <Option value="日常维护">日常维护</Option>
              <Option value="定期维护">定期维护</Option>
              <Option value="专项维护">专项维护</Option>
            </Select>
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={8}>
          <Form.Item
            name="cycle_type"
            label="周期类型"
            rules={[{ required: true, message: '请选择周期类型' }]}
          >
            <Select>
              <Option value="按天">按天</Option>
              <Option value="按周">按周</Option>
              <Option value="按月">按月</Option>
              <Option value="按季度">按季度</Option>
              <Option value="按年">按年</Option>
            </Select>
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item
            name="cycle_value"
            label="周期值"
            rules={[{ required: true, message: '请输入周期值' }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name="estimated_hours" label="预计工时(h)">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="responsible_person" label="责任人">
            <Input placeholder="请输入责任人" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="trigger_type" label="触发类型">
            <Select>
              <Option value="time">时间</Option>
              <Option value="usage">使用量</Option>
              <Option value="condition">条件</Option>
            </Select>
          </Form.Item>
        </Col>
      </Row>

      <Form.Item name="maintenance_content" label="维护内容">
        <Input.TextArea rows={3} placeholder="请输入维护内容（选择模板后会自动带出维护内容与项目清单）" />
      </Form.Item>
      <Form.Item name="remark" label="备注">
        <Input.TextArea rows={2} placeholder="请输入备注" />
      </Form.Item>
      <Form.Item name="auto_generate_workorder" label="自动生成工单" valuePropName="checked">
        <Checkbox>开启（到期后自动生成维修工单）</Checkbox>
      </Form.Item>
    </>
  );

  return (
    <div style={{ padding: '20px' }}>
      <Title level={2}>预防性维护计划</Title>

      {/* 搜索栏 */}
      <Card style={{ marginBottom: 16 }}>
        <Form form={searchForm} layout="inline" onFinish={handleSearch}>
          <Form.Item name="asset_code" label="资产编号">
            <Input placeholder="输入资产编号" style={{ width: 140 }} allowClear />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select placeholder="选择状态" style={{ width: 110 }} allowClear>
              <Option value="启用">启用</Option>
              <Option value="禁用">禁用</Option>
            </Select>
          </Form.Item>
          <Form.Item name="trigger_type" label="触发类型">
            <Select placeholder="触发类型" style={{ width: 120 }} allowClear>
              <Option value="time">时间</Option>
              <Option value="usage">使用量</Option>
              <Option value="condition">条件</Option>
            </Select>
          </Form.Item>
          <Form.Item name="keyword" label="关键词">
            <Search
              placeholder="资产名称/计划名称"
              style={{ width: 200 }}
              allowClear
              enterButton="搜索"
              onSearch={() => searchForm.submit()}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                添加计划
              </Button>
              <Button icon={<RocketOutlined />} onClick={handleOpenBatch}>
                批量创建
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      {/* 数据表格 */}
      <Card>
        <div className="hide-on-mobile">
          <Table
            columns={columns}
            dataSource={data}
            loading={loading}
            rowKey="id"
            pagination={{
              ...pagination,
              onChange: handlePaginationChange,
              showSizeChanger: true,
              showTotal: total => `共 ${total} 条`,
            }}
            scroll={{ x: 1400 }}
            size="middle"
          />
        </div>
        <div className="mobile-table-cards show-on-mobile">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>加载中...</div>
          ) : Array.isArray(data) && data.length > 0 ? (
            data.map(record => (
              <div key={record.id} className="mobile-card-item">
                <div className="mobile-card-header">
                  <span className="mobile-card-title">{record.plan_name}</span>
                  <Tag color={record.status === 'active' ? 'green' : 'default'}>
                    {record.status === 'active' ? '启用' : '禁用'}
                  </Tag>
                </div>
                <div className="mobile-card-body">
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">资产编号</span>
                    <span className="mobile-card-value">{record.asset_code || '-'}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">资产名称</span>
                    <span className="mobile-card-value">{record.asset_name || '-'}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">维护类型</span>
                    <span className="mobile-card-value">{record.maintenance_type || '-'}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">周期</span>
                    <span className="mobile-card-value">{record.cycle_type || '-'}</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>暂无数据</div>
          )}
        </div>
      </Card>

      {/* 表单模态框 */}
      <Modal
        title={isEditing ? '编辑预防性维护计划' : '创建预防性维护计划'}
        open={isModalVisible}
        onOk={() => form.submit()}
        onCancel={() => setIsModalVisible(false)}
        styles={{ wrapper: { width: 800 } }}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="plan_name"
                label="计划名称"
                rules={[{ required: true, message: '请输入计划名称' }]}
              >
                <Input placeholder="请输入计划名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="asset_code"
                label="资产编号"
                rules={[{ required: true, message: '请输入资产编号' }]}
              >
                <Input placeholder="请输入资产编号" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="asset_name"
                label="资产名称"
              >
                <Input placeholder="请输入资产名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="maintenance_type"
                label="维护类型"
                rules={[{ required: true, message: '请选择维护类型' }]}
              >
                <Select placeholder="请选择维护类型">
                  <Option value="日常维护">日常维护</Option>
                  <Option value="定期维护">定期维护</Option>
                  <Option value="专项维护">专项维护</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="trigger_type"
                label="触发类型"
                rules={[{ required: true, message: '请选择触发类型' }]}
              >
                <Select placeholder="请选择触发类型">
                  <Option value="time">时间</Option>
                  <Option value="usage">使用量</Option>
                  <Option value="condition">条件</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="responsible_person"
                label="责任人"
              >
                <Input placeholder="请输入责任人" />
              </Form.Item>
            </Col>
          </Row>

          {triggerType === 'usage' && (
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="usage_threshold"
                  label="使用量阈值"
                  rules={[{ required: triggerType === 'usage', message: '请输入使用量阈值' }]}
                >
                  <InputNumber placeholder="请输入阈值" style={{ width: '100%' }} min={0} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="current_usage"
                  label="当前使用量"
                >
                  <InputNumber placeholder="当前使用量" style={{ width: '100%' }} min={0} />
                </Form.Item>
              </Col>
            </Row>
          )}

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="cycle_type"
                label="周期类型"
                rules={[{ required: true, message: '请选择周期类型' }]}
              >
                <Select placeholder="请选择周期类型" onChange={handleCycleChange}>
                  <Option value="按天">天</Option>
                  <Option value="按周">周</Option>
                  <Option value="按月">月</Option>
                  <Option value="按季度">季度</Option>
                  <Option value="按年">年</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="cycle_value"
                label="周期值"
                rules={[{ required: true, message: '请输入周期值' }]}
              >
                <InputNumber placeholder="周期值" style={{ width: '100%' }} min={1} onChange={handleCycleChange} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="estimated_hours"
                label="预计工时(h)"
              >
                <InputNumber placeholder="预计工时" style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="last_maintenance_date" label="上次维护日期">
                <DatePicker style={{ width: '100%' }} onChange={handleCycleChange} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="next_maintenance_date"
                label="下次维护日期"
                rules={[{ required: true, message: '请选择下次维护日期' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="template_id" label="维护模板ID">
                <Input placeholder="关联维护模板" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="auto_generate_workorder" label="自动生成工单" valuePropName="checked">
                <Checkbox>开启</Checkbox>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="maintenance_content" label="维护内容">
            <Input.TextArea rows={3} placeholder="请输入维护内容" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 完成维护弹窗 */}
      <Modal
        title="完成维护"
        open={completeModalVisible}
        onOk={() => completeForm.submit()}
        onCancel={() => setCompleteModalVisible(false)}
        styles={{ wrapper: { width: 640 } }}
        destroyOnHidden
      >
        <Form form={completeForm} layout="vertical" onFinish={handleCompleteSubmit}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="maintenance_date"
                label="维护日期"
                initialValue={dayjs()}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="maintenance_person" label="维护人员">
                <Input placeholder="请输入维护人员" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="maintenance_cost" label="维护费用(¥)">
                <InputNumber placeholder="请输入费用" style={{ width: '100%' }} min={0} precision={2} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="actual_hours" label="实际工时(h)">
                <InputNumber placeholder="请输入实际工时" style={{ width: '100%' }} min={0} precision={1} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="parts_replaced" label="更换配件">
            <Input placeholder="请输入更换的配件" />
          </Form.Item>
          <Form.Item name="maintenance_result" label="维护结果">
            <Input.TextArea rows={3} placeholder="请输入维护结果" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 详情 Drawer */}
      <Drawer
        title="维护计划详情"
        placement="right"
        styles={{ wrapper: { width: 680 } }}
        open={drawerVisible}
        onClose={() => { setDrawerVisible(false); setHistoryData([]); }}
        extra={
          drawerRecord && (
            <Space>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                size="small"
                onClick={() => { handleOpenComplete(drawerRecord.id); }}
              >
                完成
              </Button>
              <Button
                icon={<ThunderboltOutlined />}
                size="small"
                onClick={() => { handleTrigger(drawerRecord.id); }}
              >
                执行
              </Button>
              <Button
                size="small"
                onClick={() => { handleToggleStatus(drawerRecord.id, drawerRecord.status); }}
              >
                {drawerRecord.status === '启用' ? '禁用' : '启用'}
              </Button>
            </Space>
          )
        }
      >
        {drawerRecord && (
          <>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="计划名称" span={2}>{drawerRecord.plan_name}</Descriptions.Item>
              <Descriptions.Item label="资产编号">{drawerRecord.asset_code}</Descriptions.Item>
              <Descriptions.Item label="资产名称">{drawerRecord.asset_name}</Descriptions.Item>
              <Descriptions.Item label="维护类型">{drawerRecord.maintenance_type}</Descriptions.Item>
              <Descriptions.Item label="触发类型">{triggerTypeTag(drawerRecord.trigger_type)}</Descriptions.Item>
              <Descriptions.Item label="周期类型">{drawerRecord.cycle_type}</Descriptions.Item>
              <Descriptions.Item label="周期值">{drawerRecord.cycle_value}</Descriptions.Item>
              <Descriptions.Item label="下次维护日期">
                <span>
                  {drawerRecord.next_maintenance_date ? dayjs(drawerRecord.next_maintenance_date).format('YYYY-MM-DD') : '-'}
                  {getOverdueTag(drawerRecord.next_maintenance_date)}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="上次维护日期">
                {drawerRecord.last_maintenance_date ? dayjs(drawerRecord.last_maintenance_date).format('YYYY-MM-DD') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="状态">{statusTag(drawerRecord.status)}</Descriptions.Item>
              <Descriptions.Item label="责任人">{drawerRecord.responsible_person || '-'}</Descriptions.Item>
              {drawerRecord.template_id && (
                <Descriptions.Item label="关联模板" span={2}>
                  {drawerRecord.template_name || `模板ID: ${drawerRecord.template_id}`}
                </Descriptions.Item>
              )}
              {drawerRecord.trigger_type === 'usage' && (
                <>
                  <Descriptions.Item label="使用量阈值">{drawerRecord.usage_threshold ?? '-'}</Descriptions.Item>
                  <Descriptions.Item label="当前使用量">{drawerRecord.current_usage ?? '-'}</Descriptions.Item>
                </>
              )}
              {drawerRecord.estimated_hours != null && (
                <Descriptions.Item label="预计工时">{drawerRecord.estimated_hours}h</Descriptions.Item>
              )}
              {drawerRecord.auto_generate_workorder != null && (
                <Descriptions.Item label="自动生成工单">
                  {drawerRecord.auto_generate_workorder ? <Tag color="green">是</Tag> : <Tag color="default">否</Tag>}
                </Descriptions.Item>
              )}
              {drawerRecord.maintenance_content && (
                <Descriptions.Item label="维护内容" span={2}>{drawerRecord.maintenance_content}</Descriptions.Item>
              )}
              {drawerRecord.remark && (
                <Descriptions.Item label="备注" span={2}>{drawerRecord.remark}</Descriptions.Item>
              )}
            </Descriptions>

            <Divider titlePlacement="left" style={{ marginTop: 24 }}>维护历史</Divider>
            <Table
              columns={historyColumns}
              dataSource={historyData}
              loading={historyLoading}
              rowKey="id"
              size="small"
              pagination={false}
              scroll={{ y: 300 }}
              locale={{ emptyText: '暂无维护历史' }}
            />
          </>
        )}
      </Drawer>

      {/* 批量创建弹窗 */}
      <Modal
        title="批量创建预防性维护计划"
        open={batchModalVisible}
        onCancel={() => setBatchModalVisible(false)}
        onOk={() => batchForm.submit()}
        okText={batchResult ? '重新创建' : '开始创建'}
        cancelText="取消"
        confirmLoading={batchLoading}
        width={840}
        destroyOnHidden
      >
        {!batchResult ? (
          <Form
            form={batchForm}
            layout="vertical"
            onFinish={handleBatchSubmit}
            initialValues={{
              trigger_type: 'time',
              cycle_type: '按月',
              cycle_value: 1,
              maintenance_type: '日常维护',
              status: '启用',
            }}
          >
            <Tabs
              activeKey={batchMode}
              // 关键：销毁未激活的 Tab 面板。否则 5 个 Tab 各自的必填字段
              //（asset_codes_text / category_ids / department_codes 等）会同时挂载，
              // 提交时校验会命中其它 Tab 的空必填项 → onFinish 不触发 → “提交不了”。
              destroyOnHidden
              onChange={key => {
                setBatchMode(key);
                setPreviewInfo(null);
              }}
              items={[
                {
                  key: 'template',
                  label: '模板模式（推荐）',
                  children: (
                    <>
                      <Alert
                        type="info"
                        showIcon
                        style={{ marginBottom: 16 }}
                        message="输入资产编号，用同一份计划配置批量创建。计划名称中可用 {asset_code} 占位符，会自动替换为对应资产编号。"
                      />
                      <Form.Item
                        name="asset_codes_text"
                        label="资产编号列表"
                        rules={[{ required: true, message: '请输入资产编号' }]}
                        extra="支持换行、逗号（中英文）、空格分隔"
                      >
                        <Input.TextArea
                          rows={5}
                          placeholder={'例：\nA001\nA002, A003\nA004 A005'}
                        />
                      </Form.Item>

                      {planConfigFields}
                    </>
                  ),
                },
                {
                  key: 'category',
                  label: (
                    <span>
                      <AppstoreOutlined /> 按资产种类
                    </span>
                  ),
                  children: (
                    <>
                      <Alert
                        type="info"
                        showIcon
                        style={{ marginBottom: 16 }}
                        message="多选一个或多个资产种类，系统会自动取该种类下所有资产，套用同一份计划配置批量创建。"
                      />
                      <Spin spinning={filterOptionsLoading}>
                        <Form.Item
                          name="category_ids"
                          label="选择资产种类"
                          rules={[{ required: true, message: '请至少选择一个资产种类' }]}
                          extra={'支持多选；勾完后点下方「预览」查看会匹配的资产数'}
                        >
                          <Select
                            mode="multiple"
                            placeholder="选择资产种类"
                            showSearch
                            optionFilterProp="label"
                            allowClear
                            maxTagCount="responsive"
                          >
                            {categoryOptions.map(c => (
                              <Option key={c.id} value={c.id} label={c.name}>
                                {c.name}
                              </Option>
                            ))}
                          </Select>
                        </Form.Item>
                      </Spin>

                      <Space style={{ marginBottom: 16 }}>
                        <Button
                          icon={<SearchOutlined />}
                          loading={previewLoading}
                          onClick={() => {
                            const vals = batchForm.getFieldsValue(true);
                            handlePreviewBatch(vals, 'category');
                          }}
                        >
                          预览匹配资产
                        </Button>
                        {previewInfo && ['category', 'combo'].includes(batchMode) && (
                          <Tag color={previewInfo.total > 0 ? 'blue' : 'default'}>
                            将匹配 {previewInfo.total} 个资产
                            {previewInfo.by_category > 0 && `（${previewInfo.by_category} 个种类）`}
                          </Tag>
                        )}
                      </Space>
                      {previewInfo && ['category', 'combo'].includes(batchMode) && previewInfo.sample && previewInfo.sample.length > 0 && (
                        <Alert
                          type="info"
                          style={{ marginBottom: 16 }}
                          message={
                            <span>
                              样例资产编号：
                              {previewInfo.sample.join(', ')}
                              {previewInfo.total > previewInfo.sample.length && ` ... 等共 ${previewInfo.total} 个`}
                            </span>
                          }
                        />
                      )}

                      {planConfigFields}
                    </>
                  ),
                },
                {
                  key: 'department',
                  label: (
                    <span>
                      <ApartmentOutlined /> 按部门
                    </span>
                  ),
                  children: (
                    <>
                      <Alert
                        type="info"
                        showIcon
                        style={{ marginBottom: 16 }}
                        message="多选一个或多个部门，系统会自动取该部门下所有资产，套用同一份计划配置批量创建。"
                      />
                      <Spin spinning={filterOptionsLoading}>
                        <Form.Item
                          name="department_codes"
                          label="选择部门"
                          rules={[{ required: true, message: '请至少选择一个部门' }]}
                          extra={'支持多选；勾完后点下方「预览」查看会匹配的资产数'}
                        >
                          <Select
                            mode="multiple"
                            placeholder="选择部门"
                            showSearch
                            optionFilterProp="label"
                            allowClear
                            maxTagCount="responsive"
                          >
                            {departmentOptions.map(d => (
                              <Option key={d.code} value={d.code} label={d.name}>
                                {d.name}
                                {d.code && d.code !== d.name && (
                                  <span style={{ color: '#999', marginLeft: 6, fontSize: 12 }}>
                                    ({d.code})
                                  </span>
                                )}
                              </Option>
                            ))}
                          </Select>
                        </Form.Item>
                      </Spin>

                      <Space style={{ marginBottom: 16 }}>
                        <Button
                          icon={<SearchOutlined />}
                          loading={previewLoading}
                          onClick={() => {
                            const vals = batchForm.getFieldsValue(true);
                            handlePreviewBatch(vals, 'department');
                          }}
                        >
                          预览匹配资产
                        </Button>
                        {previewInfo && ['department', 'combo'].includes(batchMode) && (
                          <Tag color={previewInfo.total > 0 ? 'blue' : 'default'}>
                            将匹配 {previewInfo.total} 个资产
                            {previewInfo.by_department > 0 && `（${previewInfo.by_department} 个部门）`}
                          </Tag>
                        )}
                      </Space>
                      {previewInfo && ['department', 'combo'].includes(batchMode) && previewInfo.sample && previewInfo.sample.length > 0 && (
                        <Alert
                          type="info"
                          style={{ marginBottom: 16 }}
                          message={
                            <span>
                              样例资产编号：
                              {previewInfo.sample.join(', ')}
                              {previewInfo.total > previewInfo.sample.length && ` ... 等共 ${previewInfo.total} 个`}
                            </span>
                          }
                        />
                      )}

                      {planConfigFields}
                    </>
                  ),
                },
                {
                  key: 'combo',
                  label: (
                    <span>
                      <ApartmentOutlined /><AppstoreOutlined /> 部门+资产类
                    </span>
                  ),
                  children: (
                    <>
                      <Alert
                        type="info"
                        showIcon
                        style={{ marginBottom: 16 }}
                        message="同时选择资产种类和部门，系统取「种类 ∩ 部门」下的资产，套用同一份计划配置批量创建（多种可划定范围）。"
                      />
                      <Spin spinning={filterOptionsLoading}>
                        <Form.Item
                          name="category_ids"
                          label="选择资产种类"
                          rules={[{ required: true, message: '请至少选择一个资产种类' }]}
                          extra="支持多选"
                        >
                          <Select
                            mode="multiple"
                            placeholder="选择资产种类"
                            showSearch
                            optionFilterProp="label"
                            allowClear
                            maxTagCount="responsive"
                          >
                            {categoryOptions.map(c => (
                              <Option key={c.id} value={c.id} label={c.name}>
                                {c.name}
                              </Option>
                            ))}
                          </Select>
                        </Form.Item>
                        <Form.Item
                          name="department_codes"
                          label="选择部门"
                          rules={[{ required: true, message: '请至少选择一个部门' }]}
                          extra="支持多选"
                        >
                          <Select
                            mode="multiple"
                            placeholder="选择部门"
                            showSearch
                            optionFilterProp="label"
                            allowClear
                            maxTagCount="responsive"
                          >
                            {departmentOptions.map(d => (
                              <Option key={d.code} value={d.code} label={d.name}>
                                {d.name}
                                {d.code && d.code !== d.name && (
                                  <span style={{ color: '#999', marginLeft: 6, fontSize: 12 }}>
                                    ({d.code})
                                  </span>
                                )}
                              </Option>
                            ))}
                          </Select>
                        </Form.Item>
                      </Spin>

                      <Space style={{ marginBottom: 16 }}>
                        <Button
                          icon={<SearchOutlined />}
                          loading={previewLoading}
                          onClick={() => {
                            const vals = batchForm.getFieldsValue(true);
                            handlePreviewBatch(vals, 'combo');
                          }}
                        >
                          预览匹配资产
                        </Button>
                      </Space>

                      {planConfigFields}
                    </>
                  ),
                },
                {
                  key: 'rows',
                  label: '逐条模式',
                  children: (
                    <>
                      <Alert
                        type="info"
                        showIcon
                        style={{ marginBottom: 16 }}
                        message="逐条录入不同配置，适合计划不统一的情况。单次最多 500 条。"
                      />
                      <Form.List name="rows">
                        {(fields, { add, remove }) => (
                          <>
                            {fields.map(field => (
                              <Card
                                key={field.key}
                                size="small"
                                style={{ marginBottom: 12 }}
                                title={`第 ${field.name + 1} 条`}
                                extra={
                                  fields.length > 1 ? (
                                    <Button type="link" danger onClick={() => remove(field.name)}>
                                      删除
                                    </Button>
                                  ) : null
                                }
                              >
                                <Row gutter={12}>
                                  <Col span={8}>
                                    <Form.Item
                                      {...field}
                                      name={[field.name, 'asset_code']}
                                      label="资产编号"
                                      rules={[{ required: true, message: '必填' }]}
                                    >
                                      <Input placeholder="A001" />
                                    </Form.Item>
                                  </Col>
                                  <Col span={8}>
                                    <Form.Item
                                      {...field}
                                      name={[field.name, 'plan_name']}
                                      label="计划名称"
                                      rules={[{ required: true, message: '必填' }]}
                                    >
                                      <Input placeholder="计划名称" />
                                    </Form.Item>
                                  </Col>
                                  <Col span={8}>
                                    <Form.Item
                                      {...field}
                                      name={[field.name, 'maintenance_type']}
                                      label="维护类型"
                                      rules={[{ required: true, message: '必填' }]}
                                    >
                                      <Select>
                                        <Option value="日常维护">日常维护</Option>
                                        <Option value="定期维护">定期维护</Option>
                                        <Option value="专项维护">专项维护</Option>
                                      </Select>
                                    </Form.Item>
                                  </Col>
                                </Row>
                                <Row gutter={12}>
                                  <Col span={6}>
                                    <Form.Item
                                      {...field}
                                      name={[field.name, 'cycle_type']}
                                      label="周期类型"
                                      rules={[{ required: true, message: '必填' }]}
                                    >
                                      <Select>
                                        <Option value="按天">按天</Option>
                                        <Option value="按周">按周</Option>
                                        <Option value="按月">按月</Option>
                                        <Option value="按季度">按季度</Option>
                                        <Option value="按年">按年</Option>
                                      </Select>
                                    </Form.Item>
                                  </Col>
                                  <Col span={6}>
                                    <Form.Item
                                      {...field}
                                      name={[field.name, 'cycle_value']}
                                      label="周期值"
                                      rules={[{ required: true, message: '必填' }]}
                                    >
                                      <InputNumber min={1} style={{ width: '100%' }} />
                                    </Form.Item>
                                  </Col>
                                  <Col span={6}>
                                    <Form.Item
                                      {...field}
                                      name={[field.name, 'responsible_person']}
                                      label="责任人"
                                    >
                                      <Input placeholder="责任人" />
                                    </Form.Item>
                                  </Col>
                                  <Col span={6}>
                                    <Form.Item
                                      {...field}
                                      name={[field.name, 'estimated_hours']}
                                      label="预计工时"
                                    >
                                      <InputNumber min={0} style={{ width: '100%' }} />
                                    </Form.Item>
                                  </Col>
                                </Row>
                                <Form.Item
                                  {...field}
                                  name={[field.name, 'maintenance_content']}
                                  label="维护内容"
                                >
                                  <Input placeholder="维护内容（选填）" />
                                </Form.Item>
                              </Card>
                            ))}
                            <Button
                              type="dashed"
                              onClick={() => add({
                                cycle_type: '按月',
                                cycle_value: 1,
                                maintenance_type: '日常维护',
                                trigger_type: 'time',
                              })}
                              block
                              icon={<PlusOutlined />}
                            >
                              添加一行
                            </Button>
                          </>
                        )}
                      </Form.List>
                    </>
                  ),
                },
              ]}
            />
          </Form>
        ) : (
          // 结果展示
          <div>
            <Alert
              type={batchResult.failed && batchResult.failed.length > 0 ? 'warning' : 'success'}
              showIcon
              message={
                batchResult.failed && batchResult.failed.length > 0
                  ? `成功 ${batchResult.created} 条，失败 ${batchResult.failed.length} 条`
                  : `成功创建 ${batchResult.created} 条`
              }
              style={{ marginBottom: 16 }}
            />
            {batchResult.failed && batchResult.failed.length > 0 && (
              <List
                size="small"
                header={<div>失败明细（{batchResult.failed.length}）</div>}
                bordered
                dataSource={batchResult.failed}
                renderItem={item => (
                  <List.Item>
                    <span style={{ marginRight: 12, color: '#999' }}>
                      资产：{item.asset_code || '-'}
                    </span>
                    <span style={{ color: '#cf1322' }}>{item.error}</span>
                  </List.Item>
                )}
                style={{ maxHeight: 280, overflow: 'auto' }}
              />
            )}
            {batchResult.ids && batchResult.ids.length > 0 && (
              <div style={{ marginTop: 12, color: '#666', fontSize: 12 }}>
                创建的计划ID：{batchResult.ids.slice(0, 10).join(', ')}
                {batchResult.ids.length > 10 && ` ... 共 ${batchResult.ids.length} 条`}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PreventiveMaintenanceList;
