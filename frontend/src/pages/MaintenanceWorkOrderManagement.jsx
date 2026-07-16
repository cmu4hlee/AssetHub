/**
 * MaintenanceWorkOrderManagement
 * 工单管理 - 独立页面
 *
 * 从原"调度中心"(MaintenanceWorkOrderList) 中剥离出来的工单管理功能:
 *   - 不再包含调度中心面板
 *   - 不再包含预防性维护 Tab
 *   - 职责单一: 展示 / 操作工单
 */
import React, { useEffect, useState, useRef } from 'react';
import {
  Form,
  Input,
  Select,
  Button,
  Table,
  Tag,
  Space,
  Modal,
  DatePicker,
  InputNumber,
  message,
  Popconfirm,
  Row,
  Col,
  Drawer,
  Tooltip,
  Card,
  Descriptions,
  Dropdown,
  Menu,
  Empty,
  Radio,
  Tabs,
  Rate,
  Image,
  Alert,
  Typography,
  Timeline,
  Skeleton,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  EyeOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  UserOutlined,
  MoreOutlined,
  ExportOutlined,
  CloseOutlined,
  StarOutlined,
  LinkOutlined,
  MinusCircleOutlined,
  PlusCircleOutlined,
  PrinterOutlined,
  FilterOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { maintenanceAPI } from '../utils/api';
import { printWorkOrderDetailReport } from '../utils/printReport';
import MaintenanceWorkOrderForm from './MaintenanceWorkOrderForm';
import SignatureField from '../components/SignatureField';
import dayjs from 'dayjs';
import { useIsMobile, useCan } from '../hooks';
import { ResponsiveTable } from '../components';
import '../styles/maintenance-workorder.css';

const { Option } = Select;
const { Search } = Input;
const { RangePicker } = DatePicker;

const priorityMap = {
  1: { color: 'red', label: '紧急' },
  2: { color: 'orange', label: '高' },
  3: { color: 'blue', label: '中' },
  4: { color: 'default', label: '低' },
  urgent: { color: 'red', label: '紧急' },
  high: { color: 'orange', label: '高' },
  normal: { color: 'blue', label: '中' },
  low: { color: 'default', label: '低' },
};

const statusMap = {
  pending: { color: 'default', label: '待分配' },
  assigned: { color: 'blue', label: '已分配' },
  in_progress: { color: 'cyan', label: '进行中' },
  pending_acceptance: { color: 'gold', label: '已签字·待评价' },
  pending_review: { color: 'warning', label: '待审核' },
  completed: { color: 'green', label: '已完成' },
  closed: { color: 'default', label: '已评价·已关闭' },
  cancelled: { color: 'red', label: '已取消' },
};

const sourceTypeMap = {
  request: { color: 'blue', label: '维修申请' },
  plan: { color: 'green', label: '预防性维护' },
  preventive: { color: 'green', label: '预防性维护' },
  manual: { color: 'default', label: '手动创建' },
  fault: { color: 'red', label: '故障报修' },
  other: { color: 'default', label: '其他' },
};

const DEFAULT_SEARCH_PARAMS = {
  asset_code: '',
  status: '',
  priority: '',
  assigned_to: '',
  start_date: null,
  end_date: null,
  keyword: '',
};

const MaintenanceWorkOrderManagement = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [currentRecord, setCurrentRecord] = useState(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [selectedRows, setSelectedRows] = useState([]);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [actionType, setActionType] = useState('');
  const [actionForm] = Form.useForm();
  const [engineers, setEngineers] = useState([]);
  const [engineersLoading, setEngineersLoading] = useState(false);
  const [completeForm] = Form.useForm();
  const [completeModalVisible, setCompleteModalVisible] = useState(false);
  const [evaluateForm] = Form.useForm();
  const [evaluateModalVisible, setEvaluateModalVisible] = useState(false);
  const [exportForm] = Form.useForm();
  const [searchParams, setSearchParams] = useState(DEFAULT_SEARCH_PARAMS);
  // 工单管理 Tab 拆分：'repair' = 维修工单（maintenance_request_id IS NOT NULL），'preventive' = 预防性维护工单（maintenance_plan_id IS NOT NULL）
  const [activeTab, setActiveTab] = useState('repair');
  const [workOrderStats, setWorkOrderStats] = useState(null);
  const [workOrderStatsLoading, setWorkOrderStatsLoading] = useState(false);

  /**
   * 加载工单统计: 总数 / 待派工 / 进行中 / 待评价 / 逾期 / 平均工时 / 评分
   */
  const fetchWorkOrderStatistics = async () => {
    setWorkOrderStatsLoading(true);
    try {
      const response = await maintenanceAPI.getWorkOrderStatistics();
      if (response?.success) {
        setWorkOrderStats(response.data || null);
      }
    } catch (err) {
      console.error('加载工单统计失败:', err);
    } finally {
      setWorkOrderStatsLoading(false);
    }
  };

  /**
   * 加载工程师列表（用于派工 / 重新派工）
   */
  const fetchEngineers = async () => {
    setEngineersLoading(true);
    try {
      const response = await maintenanceAPI.getEngineers();
      if (response?.success) {
        setEngineers(response.data || []);
      }
    } catch (err) {
      console.error('加载工程师列表失败:', err);
    } finally {
      setEngineersLoading(false);
    }
  };
  const TAB_FILTERS = {
    repair: { from_request: '1', include_orphan: '1' },     // 维修工单 + 孤儿兜底
    preventive: { from_plan: '1' },                            // 预防性维护工单
  };
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });
  const [currentUser, setCurrentUser] = useState(null);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [detailRecord, setDetailRecord] = useState(null);
  const [detailHistory, setDetailHistory] = useState([]);
  const [detailHistoryLoading, setDetailHistoryLoading] = useState(false);
  const exportDataRef = useRef([]);
  const isMobile = useIsMobile();
  const canDelete = useCan('workorder', 'delete');
  const canEdit = useCan('workorder', 'edit');
  const navigate = useNavigate();

  // 拉取工单列表
  // params.tabKey 可显式传入新 tab，避免在 onChange 里 setState 后立刻 fetch
  // 读到的是旧闭包值，导致列表数据和 tab 名错位。
  const fetchWorkOrders = async (params = {}) => {
    const activeFilters = params.filtersOverride || searchParams;
    const effectiveTab = params.tabKey || activeTab;
    setLoading(true);
    try {
      const apiParams = { ...activeFilters };
      // Tab 拆分：自动注入工单来源过滤参数
      const tabFilter = TAB_FILTERS[effectiveTab] || TAB_FILTERS.repair;
      // 先清掉可能残留的旧 source_types 字段，避免回退到旧逻辑
      delete apiParams.source_types;
      if (!apiParams.source_type) {
        Object.assign(apiParams, tabFilter);
      }
      if (apiParams.status === 'signed') {
        delete apiParams.status;
        apiParams.has_signature = '1';
      }
      const response = await maintenanceAPI.getMaintenanceWorkOrders({
        page: params.page || pagination.current,
        pageSize: params.pageSize || pagination.pageSize,
        ...apiParams,
      });
      if (response.success) {
        const list = response.data || [];
        setData(list);
        exportDataRef.current = list;
        setPagination({
          ...pagination,
          current: params.page || pagination.current,
          pageSize: params.pageSize || pagination.pageSize,
          total: response.pagination?.total || 0,
        });
      } else {
        message.error(response.message || '获取工单失败');
      }
    } catch (error) {
      console.error('获取工单失败:', error);
      message.error('网络错误，获取工单失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkOrders();
    fetchWorkOrderStatistics();
    try {
      const raw = localStorage.getItem('currentUser') || localStorage.getItem('user');
      if (raw) setCurrentUser(JSON.parse(raw));
    } catch (_) {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 搜索/筛选条件变化时自动重拉工单
  useEffect(() => {
    fetchWorkOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys, rows) => {
      setSelectedRowKeys(keys);
      setSelectedRows(rows);
    },
    getCheckboxProps: record => ({
      disabled: ['closed', 'completed'].includes(record.status),
    }),
  };

  const handleBatchDelete = () => {
    if (selectedRows.length === 0) {
      message.warning('请先选择要删除的工单');
      return;
    }
    const deletableOrders = selectedRows.filter(r =>
      ['in_progress', 'pending_review'].includes(r.status),
    );
    if (deletableOrders.length === 0) {
      message.warning('只能删除进行中或待审核状态的工单');
      return;
    }
    Modal.confirm({
      title: '批量删除工单',
      content: `确定要删除选中的 ${deletableOrders.length} 个工单吗？`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      async onOk() {
        let successCount = 0;
        let failCount = 0;
        for (const record of deletableOrders) {
          try {
            const response = await maintenanceAPI.deleteMaintenanceWorkOrder(record.id);
            if (response.success) successCount++;
            else failCount++;
          } catch (error) {
            failCount++;
          }
        }
        message.success(
          `成功删除 ${successCount} 个工单${failCount > 0 ? `，${failCount} 个失败` : ''}`,
        );
        setSelectedRowKeys([]);
        setSelectedRows([]);
        fetchWorkOrders();
      },
    });
  };

  /**
   * 导出当前筛选数据为 Excel (.xlsx)
   * - 优先导出选中行（selectedRows），否则导出当前列表（data）
   * - 12 列：工单编号 / 标题 / 关联资产 / 来源 / 优先级 / 状态 / 负责人 / 计划时间 / 耗时 / 评分 / 创建时间
   * - 使用 SheetJS (xlsx) 生成真正的 Excel 文件
   */
  const handleSimpleExport = async () => {
    const exportData = selectedRows.length > 0 ? selectedRows : data;
    if (exportData.length === 0) {
      message.warning('没有可导出的数据');
      return;
    }
    try {
      const XLSX = await import('xlsx');
      const headers = {
        work_order_no: '工单编号',
        title: '标题',
        asset_code: '资产编号',
        source_type: '来源',
        priority: '优先级',
        status: '状态',
        assigned_to: '负责人',
        planned_start_date: '计划开始时间',
        planned_end_date: '计划结束时间',
        created_at: '创建时间',
        duration: '耗时',
        rating: '评分',
      };
      const fields = Object.keys(headers);
      const formatDuration = record => {
        if (!record.started_at) return '';
        const start = dayjs(record.started_at);
        const end = record.completed_at ? dayjs(record.completed_at) : dayjs();
        const diffMin = end.diff(start, 'minute');
        const days = Math.floor(diffMin / (60 * 24));
        const hours = Math.floor((diffMin % (60 * 24)) / 60);
        const mins = diffMin % 60;
        if (days > 0) return `${days}d ${hours}h ${mins}m`;
        if (hours > 0) return `${hours}h ${mins}m`;
        return `${mins}m`;
      };
      const formatData = record => {
        const result = {};
        fields.forEach(field => {
          if (field === 'priority') {
            result[field] = priorityMap[record[field]]?.label || record[field] || '';
          } else if (field === 'status') {
            result[field] = statusMap[record[field]]?.label || record[field] || '';
          } else if (field === 'source_type') {
            result[field] = sourceTypeMap[record[field]]?.label || record[field] || '';
          } else if (field === 'duration') {
            result[field] = formatDuration(record);
          } else if (field === 'rating') {
            result[field] = record.applicant_rating ? `${record.applicant_rating} ★` : '';
          } else if (field.includes('_date') || field === 'created_at') {
            result[field] = record[field] ? dayjs(record[field]).format('YYYY-MM-DD HH:mm:ss') : '';
          } else {
            result[field] = record[field] || '';
          }
        });
        return result;
      };
      const rows = exportData.map(formatData);
      // 用 aoa_to_sheet 自定义表头顺序
      const headerRow = fields.map(f => headers[f]);
      const dataRows = rows.map(row => fields.map(f => row[f]));
      const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
      // 设置列宽
      ws['!cols'] = [
        { wch: 20 }, // 工单编号
        { wch: 25 }, // 标题
        { wch: 18 }, // 资产编号
        { wch: 12 }, // 来源
        { wch: 8 },  // 优先级
        { wch: 12 }, // 状态
        { wch: 10 }, // 负责人
        { wch: 18 }, // 计划开始
        { wch: 18 }, // 计划结束
        { wch: 18 }, // 创建时间
        { wch: 12 }, // 耗时
        { wch: 8 },  // 评分
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '工单列表');
      const filename = `工单列表_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`;
      XLSX.writeFile(wb, filename);
      message.success(`成功导出 ${exportData.length} 条记录到 ${filename}`);
    } catch (err) {
      console.error('导出失败:', err);
      message.error(`导出失败: ${err?.message || err}`);
    }
  };

  const handlePaginationChange = (page, pageSize) => {
    fetchWorkOrders({ page, pageSize });
  };

  const handleSearch = () => {
    fetchWorkOrders({ page: 1 });
  };

  const handleReset = () => {
    setSearchParams(DEFAULT_SEARCH_PARAMS);
    fetchWorkOrders({ page: 1, filtersOverride: DEFAULT_SEARCH_PARAMS });
  };

  const handleAdd = () => {
    setCurrentRecord(null);
    setFormVisible(true);
  };

  const handleEdit = record => {
    setCurrentRecord(record);
    setFormVisible(true);
  };

  const handleView = async record => {
    setCurrentRecord(record);
    setDetailDrawerVisible(true);
    try {
      const response = await maintenanceAPI.getMaintenanceWorkOrder(record.id);
      if (response?.success && response.data) {
        setDetailRecord(response.data);
      } else {
        setDetailRecord(record);
      }
    } catch {
      setDetailRecord(record);
    }
    // 加载历史轨迹
    setDetailHistoryLoading(true);
    try {
      const histRes = await maintenanceAPI.getWorkOrderHistory(record.id);
      if (histRes?.success) {
        setDetailHistory(histRes.data || []);
      } else {
        setDetailHistory([]);
      }
    } catch {
      setDetailHistory([]);
    } finally {
      setDetailHistoryLoading(false);
    }
  };

  const handleDelete = async id => {
    try {
      const response = await maintenanceAPI.deleteMaintenanceWorkOrder(id);
      if (response.success) {
        message.success('删除成功');
        fetchWorkOrders();
      } else {
        message.error(response.message || '删除失败');
      }
    } catch (error) {
      console.error('删除工单失败:', error);
      message.error('网络错误，删除失败');
    }
  };

  // 判断当前用户是否工单申请人
  const isApplicant = record => {
    if (!currentUser || !record) return false;
    const me = currentUser.real_name || currentUser.username;
    return me && record.created_by && me === record.created_by;
  };

  const EVAL_ADMIN_ROLES = ['super_admin', 'system_admin', 'maintenance_admin'];
  const isEvalAdmin = () => !!currentUser?.role && EVAL_ADMIN_ROLES.includes(currentUser.role);
  const canEvaluate = record => isApplicant(record) || isEvalAdmin();

  const openActionModal = (record, type) => {
    setCurrentRecord(record);
    if (type === 'complete') {
      completeForm.resetFields();
      completeForm.setFieldsValue({ materials: [{}] });
      setCompleteModalVisible(true);
      return;
    }
    if (type === 'evaluate') {
      evaluateForm.resetFields();
      evaluateForm.setFieldsValue({ rating: 5 });
      setEvaluateModalVisible(true);
      return;
    }
    setActionType(type);
    actionForm.resetFields();
    // 派工 / 重新派工时加载工程师列表
    if (type === 'assign' || type === 'reassign') {
      fetchEngineers();
    }
    setActionModalVisible(true);
  };

  const handleActionSubmit = async () => {
    try {
      const values = await actionForm.validateFields();
      setLoading(true);
      let response;
      switch (actionType) {
        case 'assign':
          response = await maintenanceAPI.assignMaintenanceWorkOrder(currentRecord.id, {
            assigned_to: values.assigned_to,
            remark: values.remark,
          });
          break;
        case 'reassign':
          response = await maintenanceAPI.assignMaintenanceWorkOrder(currentRecord.id, {
            assigned_to: values.assigned_to,
            remark: '重新派工',
          });
          break;
        case 'start':
          response = await maintenanceAPI.startMaintenanceWorkOrder(currentRecord.id, {
            remark: values.remark,
          });
          break;
        case 'close':
          response = await maintenanceAPI.closeMaintenanceWorkOrder(currentRecord.id, {
            remark: values.remark,
          });
          break;
        case 'cancel':
          response = await maintenanceAPI.cancelMaintenanceWorkOrder(currentRecord.id, {
            cancel_reason: values.cancel_reason,
          });
          break;
        default:
          break;
      }
      if (response?.success) {
        message.success('操作成功');
        setActionModalVisible(false);
        fetchWorkOrders();
      } else {
        message.error(response?.message || '操作失败');
      }
    } catch (error) {
      console.error('操作失败:', error);
      message.error('操作失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteSubmit = async () => {
    try {
      const values = await completeForm.validateFields();
      const engineer_signature = values.engineer_signature;
      if (!engineer_signature) {
        message.error('请先完成手写签名');
        return;
      }
      setLoading(true);
      const materials = (values.materials || []).filter(m => m && m.name);
      const material_cost = materials.reduce(
        (sum, m) => sum + ((m.quantity || 0) * (m.unit_price || 0)),
        0,
      );
      const response = await maintenanceAPI.completeMaintenanceWorkOrder(currentRecord.id, {
        work_content: values.work_content,
        maintenance_result: values.maintenance_result,
        actual_hours: values.actual_hours,
        labor_cost: values.labor_cost,
        material_cost,
        materials,
        outsourcing_cost: values.outsourcing_cost,
        other_cost: values.other_cost,
        remark: values.remark,
        engineer_signature,
      });
      if (response?.success) {
        message.success(response.message || '工单已完成，等待评价');
        setCompleteModalVisible(false);
        fetchWorkOrders();
      } else {
        message.error(response?.message || '操作失败');
      }
    } catch (error) {
      console.error('完成工单失败:', error);
      message.error('操作失败');
    } finally {
      setLoading(false);
    }
  };

  const handleEvaluateSubmit = async () => {
    try {
      const values = await evaluateForm.validateFields();
      setLoading(true);
      const response = await maintenanceAPI.evaluateMaintenanceWorkOrder(currentRecord.id, {
        rating: values.rating,
        comment: values.comment,
        signature: values.signature || '',
      });
      if (response?.success) {
        message.success(response.message || '评价完成，工单已关闭');
        setEvaluateModalVisible(false);
        fetchWorkOrders();
      } else {
        message.error(response?.message || '评价失败');
      }
    } catch (error) {
      console.error('评价工单失败:', error);
      message.error(error?.message || '评价失败');
    } finally {
      setLoading(false);
    }
  };

  // 打印工单详情
  const handlePrintDetail = record => {
    if (!record) return;
    printWorkOrderDetailReport(record);
  };

  const getActionMenu = record => {
    const actions = [];
    // pending: 待派工, 派给工程师
    if (record.status === 'pending') {
      actions.push({ key: 'assign', label: '派工', icon: <UserOutlined /> });
      actions.push({ key: 'cancel', label: '取消', icon: <CloseOutlined />, danger: true });
    }
    if (record.status === 'assigned') {
      actions.push({ key: 'start', label: '开始维修', icon: <PlayCircleOutlined /> });
      // 重新派工 - 改派给其他工程师
      actions.push({ key: 'reassign', label: '重新派工', icon: <UserOutlined /> });
      actions.push({ key: 'cancel', label: '取消', icon: <CloseOutlined />, danger: true });
    }
    if (record.status === 'in_progress') {
      actions.push({ key: 'complete', label: '完成（签名）', icon: <CheckCircleOutlined /> });
      actions.push({ key: 'cancel', label: '取消', icon: <CloseOutlined />, danger: true });
    }
    if (record.status === 'pending_acceptance') {
      if (isApplicant(record) || isEvalAdmin()) {
        actions.push({
          key: 'evaluate',
          label: isApplicant(record) ? '评价' : '代评价',
          icon: <StarOutlined />,
        });
      } else {
        actions.push({
          key: 'evaluate_disabled',
          label: '待申请人评价',
          icon: <StarOutlined />,
          disabled: true,
          tooltip: `申请人：${record.created_by || '未知'}`,
        });
      }
    }
    if (['pending_review', 'completed'].includes(record.status)) {
      actions.push({ key: 'close', label: '关闭', icon: <CloseOutlined /> });
    }
    if (actions.length === 0) return null;
    return (
      <Menu
        onClick={({ key }) => openActionModal(record, key)}
        items={actions.map(a => ({
          key: a.key,
          label: a.label,
          icon: a.icon,
          danger: a.danger,
          disabled: a.disabled,
        }))}
      />
    );
  };

  const columns = [
    {
      title: '工单编号',
      dataIndex: 'work_order_no',
      key: 'work_order_no',
      width: 160,
      fixed: 'left',
      render: (text, record) => (
        <a onClick={() => handleView(record)} className="workorder-no-link">
          {text}
        </a>
      ),
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 180,
      ellipsis: true,
    },
    {
      title: '关联资产',
      dataIndex: 'asset_code',
      key: 'asset_code',
      width: 140,
    },
    {
      title: '来源',
      key: 'source',
      width: 160,
      render: (_, record) => {
        const sourceInfo = sourceTypeMap[record.source_type] || {
          label: record.source_type || '-',
          cls: 'other',
        };
        return (
          <Space size={4}>
            <span className={`source-tag source-tag--${sourceInfo.cls}`}>{sourceInfo.label}</span>
            {record.source_id && (
              <Tooltip title={`来源ID: ${record.source_id}`}>
                <a
                  style={{ fontSize: 12 }}
                  onClick={() => {
                    if (record.source_type === 'request') {
                      navigate(`/maintenance/requests/${record.source_id}`);
                    }
                  }}
                >
                  <LinkOutlined /> {record.source_id}
                </a>
              </Tooltip>
            )}
          </Space>
        );
      },
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      render: priority => {
        const info = priorityMap[priority] || { label: priority, cls: 'low' };
        return <span className={`priority-badge priority-badge--${info.cls}`}>{info.label}</span>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: status => {
        const info = statusMap[status] || { label: status, cls: status };
        return <span className={`status-tag status-tag--${info.cls}`}>{info.label}</span>;
      },
    },
    {
      title: '负责人',
      dataIndex: 'assigned_to',
      key: 'assigned_to',
      width: 100,
    },
    {
      title: '计划时间',
      key: 'planned_time',
      width: 200,
      render: (_, record) => (
        <span>
          {record.planned_start_date
            ? dayjs(record.planned_start_date).format('YYYY-MM-DD HH:mm')
            : '-'}
          {' ~ '}
          {record.planned_end_date
            ? dayjs(record.planned_end_date).format('YYYY-MM-DD HH:mm')
            : '-'}
        </span>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: date => (date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: '耗时',
      key: 'duration',
      width: 130,
      render: (_, record) => {
        // 耗时: started_at → completed_at (或 → 当前, 进行中)
        if (!record.started_at) {
          return <span style={{ color: '#bfbfbf' }}>未开始</span>;
        }
        const start = dayjs(record.started_at);
        const end = record.completed_at ? dayjs(record.completed_at) : dayjs();
        const diffMin = end.diff(start, 'minute');
        const days = Math.floor(diffMin / (60 * 24));
        const hours = Math.floor((diffMin % (60 * 24)) / 60);
        const mins = diffMin % 60;
        let text = '';
        if (days > 0) text += `${days}d `;
        if (hours > 0) text += `${hours}h `;
        if (mins > 0 && days === 0) text += `${mins}m`;
        text = text.trim() || `${mins}m`;
        const isLong = days > 0;
        return (
          <Tooltip title={`开始: ${start.format('YYYY-MM-DD HH:mm')}${record.completed_at ? `\n完成: ${dayjs(record.completed_at).format('YYYY-MM-DD HH:mm')}` : '\n进行中'}`}>
            <span style={{ color: isLong ? '#fa8c16' : '#262626', fontWeight: isLong ? 600 : 400 }}>
              {record.completed_at ? text : `⏱ ${text}`}
            </span>
          </Tooltip>
        );
      },
    },
    {
      title: '评分',
      key: 'rating',
      width: 100,
      render: (_, record) => {
        if (record.applicant_rating) {
          return <Tag color="gold">{record.applicant_rating} ★</Tag>;
        }
        return <span style={{ color: '#bfbfbf' }}>-</span>;
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 240,
      fixed: 'right',
      render: (_, record) => {
        const isClosedOrCancelled = ['closed', 'cancelled'].includes(record.status);
        return (
          <Space size="small" wrap>
            <Tooltip title="查看">
              <Button type="link" icon={<EyeOutlined />} onClick={() => handleView(record)} />
            </Tooltip>
            <Tooltip title="编辑">
              <Button
                type="link"
                icon={<EditOutlined />}
                onClick={() => handleEdit(record)}
                disabled={isClosedOrCancelled || !canEdit}
              />
            </Tooltip>
            {record.status === 'in_progress' && (
              <Tooltip title="完成（需手写签名）">
                <Button
                  type="link"
                  icon={<CheckCircleOutlined />}
                  onClick={() => openActionModal(record, 'complete')}
                />
              </Tooltip>
            )}
            {record.status === 'pending_acceptance' && canEvaluate(record) && (
              <Tooltip title={isApplicant(record) ? '评价' : '代评价'}>
                <Button
                  type="link"
                  icon={<StarOutlined />}
                  style={{ color: '#faad14' }}
                  onClick={() => openActionModal(record, 'evaluate')}
                />
              </Tooltip>
            )}
            {['completed', 'pending_review'].includes(record.status) && (
              <Tooltip title="关闭">
                <Button
                  type="link"
                  icon={<CloseOutlined />}
                  onClick={() => openActionModal(record, 'close')}
                />
              </Tooltip>
            )}
            {!isClosedOrCancelled &&
              !['completed', 'pending_review', 'pending_acceptance', 'closed'].includes(
                record.status,
              ) && (
                <Tooltip title="取消">
                  <Popconfirm
                    title="确定取消此工单？"
                    onConfirm={() => openActionModal(record, 'cancel')}
                  >
                    <Button type="link" danger icon={<CloseOutlined />} />
                  </Popconfirm>
                </Tooltip>
              )}
            {['in_progress', 'pending_review'].includes(record.status) && (
              <Tooltip title="删除">
                <Popconfirm
                  title="确定删除此工单？"
                  onConfirm={() => handleDelete(record.id)}
                  disabled={!canDelete}
                >
                  <Button type="link" danger icon={<DeleteOutlined />} disabled={!canDelete} />
                </Popconfirm>
              </Tooltip>
            )}
            {getActionMenu(record) && (
              <Dropdown popupRender={() => getActionMenu(record)} trigger={['click']}>
                <Button type="link" icon={<MoreOutlined />} />
              </Dropdown>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div className="maintenance-workorder-list">
      {/* 顶部统计: 总数 / 待派工 / 进行中 / 待评价 / 逾期 / 已完成 */}
      <Card
        className="workorder-stats"
        style={{ marginBottom: 16 }}
        title={
          <Space>
            <span>工单概览</span>
            {workOrderStats && (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                平均工时 {workOrderStats.avg_actual_hours} h / 评分 {workOrderStats.avg_rating} ★ ({workOrderStats.rated_count})
              </Typography.Text>
            )}
          </Space>
        }
        extra={
          <Button size="small" icon={<ReloadOutlined spin={workOrderStatsLoading} />} onClick={fetchWorkOrderStatistics}>
            刷新
          </Button>
        }
        styles={{ body: { padding: '12px 16px' } }}
      >
        <Row gutter={[12, 12]}>
          <Col xs={12} sm={8} md={4}>
            <div className="wo-stat-card wo-stat-card--total">
              <div className="wo-stat-icon"><FileTextOutlined /></div>
              <div className="wo-stat-content">
                <div className="wo-stat-label">总数</div>
                <div className="wo-stat-value">{workOrderStats?.total ?? '-'}</div>
              </div>
            </div>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <div
              className="wo-stat-card wo-stat-card--pending"
              onClick={() => setSearchParams({ ...searchParams, status: 'pending' })}
              role="button"
              tabIndex={0}
            >
              <div className="wo-stat-icon"><ClockCircleOutlined /></div>
              <div className="wo-stat-content">
                <div className="wo-stat-label">待派工</div>
                <div className="wo-stat-value">{workOrderStats?.pending ?? '-'}</div>
              </div>
            </div>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <div
              className="wo-stat-card wo-stat-card--in-progress"
              onClick={() => setSearchParams({ ...searchParams, status: 'in_progress' })}
              role="button"
              tabIndex={0}
            >
              <div className="wo-stat-icon"><PlayCircleOutlined /></div>
              <div className="wo-stat-content">
                <div className="wo-stat-label">进行中</div>
                <div className="wo-stat-value">{workOrderStats?.in_progress ?? '-'}</div>
              </div>
            </div>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <div
              className="wo-stat-card wo-stat-card--pending-acceptance"
              onClick={() => setSearchParams({ ...searchParams, status: 'pending_acceptance' })}
              role="button"
              tabIndex={0}
            >
              <div className="wo-stat-icon"><StarOutlined /></div>
              <div className="wo-stat-content">
                <div className="wo-stat-label">待评价</div>
                <div className="wo-stat-value">{workOrderStats?.pending_acceptance ?? '-'}</div>
              </div>
            </div>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <div
              className={`wo-stat-card ${workOrderStats?.overdue > 0 ? 'wo-stat-card--overdue' : 'wo-stat-card--normal'}`}
              onClick={() => workOrderStats?.overdue > 0 && setSearchParams({ ...searchParams, status: 'in_progress' })}
              role="button"
              tabIndex={0}
            >
              <div className="wo-stat-icon"><WarningOutlined /></div>
              <div className="wo-stat-content">
                <div className="wo-stat-label">逾期</div>
                <div className="wo-stat-value">{workOrderStats?.overdue ?? '-'}</div>
              </div>
            </div>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <div className="wo-stat-card wo-stat-card--closed">
              <div className="wo-stat-icon"><CheckCircleOutlined /></div>
              <div className="wo-stat-content">
                <div className="wo-stat-label">已完成</div>
                <div className="wo-stat-value">{(workOrderStats?.completed ?? 0) + (workOrderStats?.closed ?? 0)}</div>
              </div>
            </div>
          </Col>
        </Row>
      </Card>
      <Card
        title={
          <Space>
            <Tabs
              activeKey={activeTab}
              onChange={key => {
                setActiveTab(key);
                setSearchParams({ ...DEFAULT_SEARCH_PARAMS });
                // 显式传 tabKey 给 fetchWorkOrders，避开 setActiveTab 异步导致的闭包陷阱
                fetchWorkOrders({
                  page: 1,
                  tabKey: key,
                  filtersOverride: { ...DEFAULT_SEARCH_PARAMS },
                });
              }}
              items={[
                { key: 'repair', label: `维修工单` },
                { key: 'preventive', label: `预防性维护工单` },
              ]}
            />
          </Space>
        }
        extra={
          <Space wrap>
            {selectedRows.length > 0 && (
              <Button danger icon={<DeleteOutlined />} onClick={handleBatchDelete}>
                批量删除 ({selectedRows.length})
              </Button>
            )}
            <Button icon={<ExportOutlined />} onClick={handleSimpleExport}>
              导出 Excel
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => fetchWorkOrders()}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              新建工单
            </Button>
          </Space>
        }
      >
        <Form layout="inline" className="filter-form" style={{ marginBottom: 16 }}>
          <Form.Item label="资产编号">
            <Input
              placeholder="资产编号"
              value={searchParams.asset_code}
              onChange={e => setSearchParams({ ...searchParams, asset_code: e.target.value })}
              style={{ width: 140 }}
              allowClear
            />
          </Form.Item>
          <Form.Item label="状态">
            <Select
              placeholder="状态"
              value={searchParams.status || undefined}
              onChange={value => setSearchParams({ ...searchParams, status: value || '' })}
              style={{ width: 140 }}
              allowClear
            >
              {Object.entries(statusMap).map(([key, info]) => (
                <Option key={key} value={key}>
                  {info.label}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="优先级">
            <Select
              placeholder="优先级"
              value={searchParams.priority || undefined}
              onChange={value => setSearchParams({ ...searchParams, priority: value || '' })}
              style={{ width: 120 }}
              allowClear
            >
              {Object.entries(priorityMap)
                .filter(([k]) => !['urgent', 'high', 'normal', 'low'].includes(k))
                .map(([key, info]) => (
                  <Option key={key} value={key}>
                    {info.label}
                  </Option>
                ))}
            </Select>
          </Form.Item>
          <Form.Item label="负责人">
            <Input
              placeholder="负责人"
              value={searchParams.assigned_to}
              onChange={e => setSearchParams({ ...searchParams, assigned_to: e.target.value })}
              style={{ width: 120 }}
              allowClear
            />
          </Form.Item>
          <Form.Item label="关键词">
            <Search
              placeholder="标题/编号"
              value={searchParams.keyword}
              onChange={e => setSearchParams({ ...searchParams, keyword: e.target.value })}
              onSearch={handleSearch}
              style={{ width: 180 }}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" icon={<FilterOutlined />} onClick={handleSearch}>
                查询
              </Button>
              <Button onClick={handleReset}>重置</Button>
            </Space>
          </Form.Item>
        </Form>

        <ResponsiveTable
          rowKey="id"
          size="middle"
          loading={loading}
          dataSource={data}
          columns={columns}
          rowSelection={rowSelection}
          scroll={{ x: 1800 }}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: total => `共 ${total} 条`,
            onChange: handlePaginationChange,
            onShowSizeChange: handlePaginationChange,
          }}
          mobileTitleKey="work_order_no"
          mobileStatusRender={r => {
            const m = statusMap[r.status] || { color: 'default', label: r.status || '-' };
            return <Tag color={m.color}>{m.label}</Tag>;
          }}
          mobileFields={[
            { label: '标题', key: 'title' },
            { label: '关联资产', key: 'asset_code' },
            {
              label: '来源',
              key: 'source_type',
              render: item => {
                const v = item?.source_type;
                const s = sourceTypeMap[v] || { label: v || '-' };
                return <Tag>{s.label}</Tag>;
              },
            },
            { label: '负责人', key: 'assigned_to' },
            {
              label: '优先级',
              key: 'priority',
              render: item => {
                const v = item?.priority;
                const p = priorityMap[v] || { color: 'default', label: v || '-' };
                return <Tag color={p.color}>{p.label}</Tag>;
              },
            },
          ]}
          mobileActions={[
            { key: 'view', text: '详情', icon: <EyeOutlined />, onClick: handleView },
          ]}
        />
      </Card>

      {/* 新建 / 编辑工单 */}
      <MaintenanceWorkOrderForm
        visible={formVisible}
        record={currentRecord}
        onCancel={() => setFormVisible(false)}
        onSuccess={() => {
          setFormVisible(false);
          fetchWorkOrders();
        }}
      />

      {/* 工单详情抽屉 */}
      <Drawer
        title={`工单详情 - ${currentRecord?.work_order_no || ''}`}
        width={720}
        open={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)}
        extra={
          <Button
            icon={<PrinterOutlined />}
            onClick={() => handlePrintDetail(detailRecord || currentRecord)}
          >
            打印
          </Button>
        }
      >
        {detailRecord || currentRecord ? (
          <>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="工单编号">
                {(detailRecord || currentRecord).work_order_no}
              </Descriptions.Item>
              <Descriptions.Item label="标题">{(detailRecord || currentRecord).title}</Descriptions.Item>
              <Descriptions.Item label="资产编号">
                {(detailRecord || currentRecord).asset_code || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                {statusMap[(detailRecord || currentRecord).status]?.label ||
                  (detailRecord || currentRecord).status}
              </Descriptions.Item>
              <Descriptions.Item label="优先级">
                {priorityMap[(detailRecord || currentRecord).priority]?.label ||
                  (detailRecord || currentRecord).priority}
              </Descriptions.Item>
              <Descriptions.Item label="负责人">
                {(detailRecord || currentRecord).assigned_to || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="计划时间">
                {(detailRecord || currentRecord).planned_start_date
                  ? dayjs((detailRecord || currentRecord).planned_start_date).format('YYYY-MM-DD HH:mm')
                  : '-'}
                {' ~ '}
                {(detailRecord || currentRecord).planned_end_date
                  ? dayjs((detailRecord || currentRecord).planned_end_date).format('YYYY-MM-DD HH:mm')
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="描述">
                {(detailRecord || currentRecord).description || '-'}
              </Descriptions.Item>
              {(detailRecord || currentRecord).applicant_rating ? (
                <Descriptions.Item label="评价">
                  <Tag color="gold" style={{ fontSize: 14 }}>
                    {(detailRecord || currentRecord).applicant_rating} ★
                  </Tag>
                  {(detailRecord || currentRecord).applicant_comment ? (
                    <span style={{ marginLeft: 8, color: '#666' }}>
                      「{(detailRecord || currentRecord).applicant_comment}」
                    </span>
                  ) : null}
                </Descriptions.Item>
              ) : null}
              <Descriptions.Item label="创建时间">
                {(detailRecord || currentRecord).created_at
                  ? dayjs((detailRecord || currentRecord).created_at).format('YYYY-MM-DD HH:mm:ss')
                  : '-'}
              </Descriptions.Item>
            </Descriptions>

            {/* 历史轨迹 Timeline */}
            <div style={{ marginTop: 16 }}>
              <Typography.Title level={5} style={{ marginTop: 0 }}>
                <ClockCircleOutlined /> 处理历史
              </Typography.Title>
              {detailHistoryLoading ? (
                <Skeleton active paragraph={{ rows: 3 }} />
              ) : detailHistory.length === 0 ? (
                <Empty description="暂无历史记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <Timeline
                  mode="left"
                  style={{ marginTop: 12 }}
                  items={detailHistory.slice(0, 10).map(h => {
                    const colorMap = {
                      create: 'green',
                      assign: 'blue',
                      start: 'cyan',
                      complete: 'gold',
                      evaluate: 'gold',
                      close: 'gray',
                      cancel: 'red',
                      note: 'gray',
                    };
                    const typeLabelMap = {
                      create: '创建',
                      assign: '派工',
                      start: '开始维修',
                      complete: '完成',
                      evaluate: '评价',
                      close: '关闭',
                      cancel: '取消',
                      note: '备注',
                    };
                    return {
                      color: colorMap[h.action_type] || 'gray',
                      label: h.action_at
                        ? dayjs(h.action_at).format('YYYY-MM-DD HH:mm')
                        : '-',
                      children: (
                        <>
                          <div style={{ fontWeight: 600 }}>
                            {typeLabelMap[h.action_type] || h.action_type}
                            <span style={{ marginLeft: 8, color: '#8c8c8c', fontSize: 12, fontWeight: 400 }}>
                              {h.action_by}
                            </span>
                          </div>
                          <div style={{ color: '#595959', fontSize: 13 }}>
                            {h.action_description}
                          </div>
                        </>
                      ),
                    };
                  })}
                />
              )}
            </div>
          </>
        ) : (
          <Empty description="暂无详情" />
        )}
      </Drawer>

      {/* 通用操作 Modal（开始/取消/关闭） */}
      <Modal
        title={
          {
            start: '开始维修',
            cancel: '取消工单',
            close: '关闭工单',
          }[actionType] || '操作'
        }
        open={actionModalVisible}
        onCancel={() => setActionModalVisible(false)}
        onOk={handleActionSubmit}
        confirmLoading={loading}
        destroyOnClose
      >
        <Form form={actionForm} layout="vertical">
          {actionType === 'cancel' && (
            <Form.Item name="cancel_reason" label="取消原因" rules={[{ required: true }]}>
              <Input.TextArea rows={3} placeholder="请填写取消原因" />
            </Form.Item>
          )}
          {(actionType === 'assign' || actionType === 'reassign') && (
            <Form.Item
              name="assigned_to"
              label="指派给（工程师）"
              rules={[{ required: true, message: '请选择工程师' }]}
              initialValue={currentRecord?.assigned_to}
            >
              <Select
                placeholder="选择工程师"
                loading={engineersLoading}
                showSearch
                optionFilterProp="label"
                allowClear
              >
                {engineers.map(eng => (
                  <Option key={eng.id} value={eng.real_name || eng.username} label={eng.real_name || eng.username}>
                    {eng.real_name || eng.username}
                    {eng.phone ? `（${eng.phone}）` : ''}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          )}
          {actionType !== 'cancel' && actionType !== 'assign' && actionType !== 'reassign' && (
            <Form.Item name="remark" label="备注">
              <Input.TextArea rows={3} placeholder="（可选）" />
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* 完成工单（签名 + 材料） */}
      <Modal
        title="完成工单（需手写签名）"
        open={completeModalVisible}
        onCancel={() => setCompleteModalVisible(false)}
        onOk={handleCompleteSubmit}
        confirmLoading={loading}
        width={680}
        destroyOnClose
      >
        <Form form={completeForm} layout="vertical">
          <Form.Item
            name="work_content"
            label="维修内容"
            rules={[{ required: true, message: '请填写维修内容' }]}
          >
            <Input.TextArea rows={3} placeholder="详细描述维修过程" />
          </Form.Item>
          <Form.Item
            name="maintenance_result"
            label="维修结果"
            rules={[{ required: true, message: '请填写维修结果' }]}
          >
            <Input.TextArea rows={2} placeholder="维修结果描述" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="actual_hours" label="实际工时">
                <InputNumber min={0} step={0.5} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="labor_cost" label="人工费">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="材料">
            <Form.List name="materials">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(field => (
                    <Row gutter={8} key={field.key} style={{ marginBottom: 8 }}>
                      <Col span={8}>
                        <Form.Item
                          name={[field.name, 'name']}
                          noStyle
                          rules={[{ required: true, message: '材料名' }]}
                        >
                          <Input placeholder="材料名" />
                        </Form.Item>
                      </Col>
                      <Col span={6}>
                        <Form.Item name={[field.name, 'quantity']} noStyle>
                          <InputNumber min={0} placeholder="数量" style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col span={6}>
                        <Form.Item name={[field.name, 'unit_price']} noStyle>
                          <InputNumber min={0} placeholder="单价" style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col span={4}>
                        <Button
                          type="link"
                          danger
                          icon={<MinusCircleOutlined />}
                          onClick={() => remove(field.name)}
                        />
                      </Col>
                    </Row>
                  ))}
                  <Button
                    type="dashed"
                    block
                    icon={<PlusCircleOutlined />}
                    onClick={() => add({})}
                  >
                    添加材料
                  </Button>
                </>
              )}
            </Form.List>
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="outsourcing_cost" label="外包费">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="other_cost" label="其他费用">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item
            name="engineer_signature"
            label="工程师手写签名"
            rules={[{ required: true, message: '请完成手写签名' }]}
          >
            <SignatureField />
          </Form.Item>
        </Form>
      </Modal>

      {/* 评价工单 */}
      <Modal
        title="评价工单"
        open={evaluateModalVisible}
        onCancel={() => setEvaluateModalVisible(false)}
        onOk={handleEvaluateSubmit}
        confirmLoading={loading}
        destroyOnClose
      >
        <Form form={evaluateForm} layout="vertical">
          <Form.Item
            name="rating"
            label="评分"
            rules={[{ required: true, message: '请打分' }]}
          >
            <Rate />
          </Form.Item>
          <Form.Item name="comment" label="评价内容">
            <Input.TextArea rows={3} placeholder="（可选）" />
          </Form.Item>
          <Form.Item name="signature" label="签名（可选）">
            <SignatureField />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default MaintenanceWorkOrderManagement;
