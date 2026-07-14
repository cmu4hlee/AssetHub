import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useIsMobile, useCan } from '../hooks';

import {
  Form, Input, Select, Button, Table, Tag, Space, Modal, DatePicker, InputNumber, message,
  Popconfirm, Row, Col, Statistic, Drawer, Tooltip, Empty, Descriptions, Card,
  Dropdown, Menu, Typography, Spin, Divider, Timeline, Alert, Radio, Tabs, Rate, Image,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  FilterOutlined,
  ReloadOutlined,
  EyeOutlined,
  CheckOutlined,
  CloseOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  UserOutlined,
  CalendarOutlined,
  MoreOutlined,
  ExportOutlined,
  DownloadOutlined,
  DeleteTwoTone,
  CheckSquareOutlined,
  FileExcelOutlined,
  FileTextOutlined,
  HomeOutlined,
  ClockCircleOutlined,
  LinkOutlined,
  MinusCircleOutlined,
  PlusCircleOutlined,
  PrinterOutlined,
  StarOutlined,
} from '@ant-design/icons';
import { maintenanceAPI } from '../utils/api';
import { printWorkOrderReport, printWorkOrderDetailReport } from '../utils/printReport';
import MaintenanceWorkOrderForm from './MaintenanceWorkOrderForm';
import PreventiveMaintenanceList from './PreventiveMaintenanceList';
import SignatureField from '../components/SignatureField';
import SignatureViewer from '../components/SignatureViewer';
import dayjs from 'dayjs';
import '../styles/maintenance-workorder.css';

const { Option } = Select;
const { Search } = Input;
const { RangePicker } = DatePicker;

const priorityMap = {
  1: { color: 'red', label: '紧急', cls: 'urgent' },
  2: { color: 'orange', label: '高', cls: 'high' },
  3: { color: 'blue', label: '中', cls: 'normal' },
  4: { color: 'default', label: '低', cls: 'low' },
  urgent: { color: 'red', label: '紧急', cls: 'urgent' },
  high: { color: 'orange', label: '高', cls: 'high' },
  normal: { color: 'blue', label: '中', cls: 'normal' },
  low: { color: 'default', label: '低', cls: 'low' },
};

const statusMap = {
  pending: { color: 'default', label: '待分配', cls: 'pending' },
  assigned: { color: 'blue', label: '已分配', cls: 'assigned' },
  in_progress: { color: 'cyan', label: '进行中', cls: 'in_progress' },
  // pending_acceptance = 工程师已签字, 等申请人评价. 改名让用户明确知道签名记录在这里.
  pending_acceptance: { color: 'gold', label: '已签字·待评价', cls: 'pending_acceptance' },
  pending_review: { color: 'warning', label: '待审核', cls: 'pending' },
  completed: { color: 'green', label: '已完成', cls: 'completed' },
  closed: { color: 'default', label: '已评价·已关闭', cls: 'closed' },
  cancelled: { color: 'red', label: '已取消', cls: 'cancelled' },
};

const sourceTypeMap = {
  request: { color: 'blue', label: '维修申请', cls: 'request' },
  plan: { color: 'green', label: '预防性维护', cls: 'plan' },
  preventive: { color: 'green', label: '预防性维护', cls: 'preventive' },
  manual: { color: 'default', label: '手动创建', cls: 'manual' },
  fault: { color: 'red', label: '故障报修', cls: 'fault' },
  other: { color: 'default', label: '其他', cls: 'other' },
};

const DISPATCH_AUTO_REFRESH_MS = 30000;
const DISPATCH_SORT_STORAGE_KEY = 'maintenance_workorder_dispatch_sort_v1';
const ALLOWED_DISPATCH_SORT_VALUES = ['in_progress', 'total'];

const getInitialDispatchSort = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return 'in_progress';
  }

  try {
    const saved = window.localStorage.getItem(DISPATCH_SORT_STORAGE_KEY);
    return ALLOWED_DISPATCH_SORT_VALUES.includes(saved) ? saved : 'in_progress';
  } catch (_error) {
    return 'in_progress';
  }
};

const persistDispatchSort = value => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  try {
    window.localStorage.setItem(DISPATCH_SORT_STORAGE_KEY, value);
  } catch (_error) {
    // Ignore storage failures and keep in-memory behavior.
  }
};

const MaintenanceWorkOrderList = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [batchActionModalVisible, setBatchActionModalVisible] = useState(false);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [currentRecord, setCurrentRecord] = useState(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [selectedRows, setSelectedRows] = useState([]);
  const [actionType, setActionType] = useState('');
  const [batchActionType, setBatchActionType] = useState('');
  const [batchActionForm] = Form.useForm();
  const [exportForm] = Form.useForm();
  const [searchParams, setSearchParams] = useState({
    asset_code: '',
    status: '',
    priority: '',
    assigned_to: '',
    start_date: null,
    end_date: null,
    keyword: '',
  });
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });
  const [dispatchPanelLoading, setDispatchPanelLoading] = useState(false);
  const [dispatchPanelData, setDispatchPanelData] = useState({
    generated_at: null,
    overview: null,
    technicians: [],
    rooms: [],
  });
  const [lastDispatchRefreshAt, setLastDispatchRefreshAt] = useState(null);
  const [dispatchSortBy, setDispatchSortBy] = useState(getInitialDispatchSort);
  const [actionForm] = Form.useForm();
  const [completeForm] = Form.useForm();
  const [completeModalVisible, setCompleteModalVisible] = useState(false);
  const [evaluateForm] = Form.useForm();
  const [evaluateModalVisible, setEvaluateModalVisible] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [detailRecord, setDetailRecord] = useState(null);
  const [activeTab, setActiveTab] = useState('workorders');
  const exportDataRef = useRef([]);
  const isMobile = useIsMobile();
  const canDelete = useCan('workorder', 'delete');
  const canEdit = useCan('workorder', 'edit');
  const hasHydratedDispatchSortRef = useRef(false);

  const buildDispatchPanelParams = (source = searchParams) => ({
    asset_code: source.asset_code || undefined,
    status: source.status || undefined,
    priority: source.priority || undefined,
    assigned_to: source.assigned_to || undefined,
    start_date: source.start_date || undefined,
    end_date: source.end_date || undefined,
    keyword: source.keyword || undefined,
    engineer_limit: 8,
    room_limit: 8,
    sort_by: dispatchSortBy,
  });

  const fetchDispatchPanel = async ({ silent = false, paramsOverride } = {}) => {
    if (!silent) {
      setDispatchPanelLoading(true);
    }
    try {
      const response = await maintenanceAPI.getWorkOrderDispatchPanel(
        buildDispatchPanelParams(paramsOverride || searchParams)
      );
      if (response?.success) {
        setDispatchPanelData({
          generated_at: response.data?.generated_at || null,
          overview: response.data?.overview || null,
          technicians: Array.isArray(response.data?.technicians) ? response.data.technicians : [],
          rooms: Array.isArray(response.data?.rooms) ? response.data.rooms : [],
        });
        setLastDispatchRefreshAt(Date.now());
      } else if (!silent) {
        message.error(response?.message || '获取调度中心面板失败');
      }
    } catch (error) {
      console.error('获取调度中心面板失败:', error);
      if (!silent) {
        message.error('网络错误，获取调度中心面板失败');
      }
    } finally {
      if (!silent) {
        setDispatchPanelLoading(false);
      }
    }
  };

  const fetchWorkOrders = async (params = {}) => {
    const activeFilters = params.filtersOverride || searchParams;
    setLoading(true);
    try {
      // 特殊 status 值 'signed' → 转为 has_signature=1 后端参数
      const apiParams = { ...activeFilters };
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
        setData(response.data || []);
        setPagination({
          ...pagination,
          current: params.page || pagination.current,
          pageSize: params.pageSize || pagination.pageSize,
          total: response.pagination?.total || 0,
        });
      } else {
        message.error(response.message || '获取维护工单失败');
      }
    } catch (error) {
      console.error('获取维护工单失败:', error);
      message.error('网络错误，获取维护工单失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkOrders();
    fetchDispatchPanel();
    // 加载当前用户信息（用于判断"我是否是申请人"）
    try {
      const raw = localStorage.getItem('currentUser') || localStorage.getItem('user');
      if (raw) setCurrentUser(JSON.parse(raw));
    } catch (_) { /* ignore */ }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      fetchDispatchPanel({ silent: true });
    }, DISPATCH_AUTO_REFRESH_MS);
    return () => clearInterval(timer);
  }, [searchParams]);

  useEffect(() => {
    persistDispatchSort(dispatchSortBy);
    if (!hasHydratedDispatchSortRef.current) {
      hasHydratedDispatchSortRef.current = true;
      return;
    }
    fetchDispatchPanel({ silent: true });
  }, [dispatchSortBy]);

  const dispatchRefreshLabel = useMemo(() => {
    if (!lastDispatchRefreshAt) return '未刷新';
    const diffSec = Math.max(Math.floor((Date.now() - lastDispatchRefreshAt) / 1000), 0);
    if (diffSec < 60) return `${diffSec} 秒前`;
    const diffMin = Math.floor(diffSec / 60);
    return `${diffMin} 分钟前`;
  }, [lastDispatchRefreshAt]);

  const dispatchGeneratedLabel = useMemo(() => {
    if (!dispatchPanelData.generated_at) return '-';
    return dayjs(dispatchPanelData.generated_at).format('YYYY-MM-DD HH:mm:ss');
  }, [dispatchPanelData.generated_at]);

  const dateRangeValue =
    searchParams.start_date && searchParams.end_date
      ? [dayjs(searchParams.start_date), dayjs(searchParams.end_date)]
      : null;

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys, rows) => {
      setSelectedRowKeys(keys);
      setSelectedRows(rows);
    },
    getCheckboxProps: record => ({
      disabled: record.status === 'closed' || record.status === 'completed',
    }),
  };

  const handleBatchDelete = async () => {
    if (selectedRows.length === 0) {
      message.warning('请先选择要删除的工单');
      return;
    }

    // 可删除的状态：进行中、待审核
    const deletableOrders = selectedRows.filter(r => ['in_progress', 'pending_review'].includes(r.status));
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
        try {
          setLoading(true);
          let successCount = 0;
          let failCount = 0;

          for (const record of deletableOrders) {
            try {
              const response = await maintenanceAPI.deleteMaintenanceWorkOrder(record.id);
              if (response.success) {
                successCount++;
              } else {
                failCount++;
              }
            } catch (error) {
              failCount++;
            }
          }

          message.success(
            `成功删除 ${successCount} 个工单${failCount > 0 ? `，${failCount} 个失败` : ''}`
          );
          setSelectedRowKeys([]);
          setSelectedRows([]);
          fetchWorkOrders();
          fetchDispatchPanel({ silent: true });
        } catch (error) {
          message.error('批量删除失败');
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const openBatchActionModal = type => {
    if (selectedRows.length === 0) {
      message.warning('请先选择要操作的工单');
      return;
    }

    const validRecords = selectedRows.filter(r => {
      switch (type) {
        case 'complete':
          return r.status === 'in_progress';
        default:
          return false;
      }
    });

    if (validRecords.length === 0) {
      message.warning('所选工单中没有可执行该操作的状态');
      return;
    }

    setBatchActionType(type);
    batchActionForm.resetFields();
    setBatchActionModalVisible(true);
  };

  const handleBatchActionSubmit = async () => {
    try {
      const values = await batchActionForm.validateFields();
      setLoading(true);

      let successCount = 0;
      let failCount = 0;

      for (const record of selectedRows) {
        try {
          let response;
          switch (batchActionType) {
            case 'assign':
              response = await maintenanceAPI.assignMaintenanceWorkOrder(record.id, {
                assigned_to: values.assigned_to,
                remark: values.remark,
              });
              break;
            case 'start':
              response = await maintenanceAPI.startMaintenanceWorkOrder(record.id, {
                remark: values.remark,
              });
              break;
            case 'complete':
              response = await maintenanceAPI.completeMaintenanceWorkOrder(record.id, {
                work_content: values.work_content,
                maintenance_result: values.maintenance_result,
                actual_hours: values.actual_hours,
                labor_cost: values.labor_cost,
                outsourcing_cost: values.outsourcing_cost,
                other_cost: values.other_cost,
                remark: values.remark,
              });
              break;
            default:
              continue;
          }

          if (response?.success) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (error) {
          failCount++;
        }
      }

      message.success(
        `成功操作 ${successCount} 个工单${failCount > 0 ? `，${failCount} 个失败` : ''}`
      );
      setBatchActionModalVisible(false);
      setSelectedRowKeys([]);
      setSelectedRows([]);
      fetchWorkOrders();
      fetchDispatchPanel({ silent: true });
    } catch (error) {
      console.error('批量操作失败:', error);
      message.error('批量操作失败');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const values = await exportForm.validateFields();
      setLoading(true);

      let exportData = [...selectedRows];

      if (values.exportScope === 'all') {
        const response = await maintenanceAPI.getMaintenanceWorkOrders({
          page: 1,
          pageSize: pagination.total,
          ...searchParams,
        });
        exportData = response.data || [];
      }

      if (exportData.length === 0) {
        message.warning('没有可导出的数据');
        return;
      }

      const exportFields = {
        basic: ['work_order_no', 'title', 'asset_code', 'priority', 'status', 'assigned_to'],
        detail: [
          'work_order_no',
          'title',
          'asset_code',
          'priority',
          'status',
          'assigned_to',
          'planned_start_date',
          'planned_end_date',
          'description',
          'labor_cost',
          'outsourcing_cost',
          'other_cost',
          'created_at',
          'updated_at',
        ],
        cost: [
          'work_order_no',
          'title',
          'asset_code',
          'labor_cost',
          'material_cost',
          'outsourcing_cost',
          'other_cost',
          'total_cost',
        ],
      };

      const fields =
        values.exportFields === 'custom'
          ? values.customFields
          : exportFields[values.exportFields] || exportFields.basic;

      const headers = {
        work_order_no: '工单编号',
        title: '标题',
        asset_code: '资产编号',
        priority: '优先级',
        status: '状态',
        assigned_to: '负责人',
        planned_start_date: '计划开始时间',
        planned_end_date: '计划结束时间',
        description: '描述',
        labor_cost: '人工费',
        material_cost: '材料费',
        outsourcing_cost: '外包费',
        other_cost: '其他费用',
        total_cost: '总成本',
        created_at: '创建时间',
        updated_at: '更新时间',
      };

      const formatData = record => {
        const result = {};
        fields.forEach(field => {
          if (field === 'priority') {
            result[field] = priorityMap[record[field]]?.label || record[field];
          } else if (field === 'status') {
            result[field] = statusMap[record[field]]?.label || record[field];
          } else if (field === 'total_cost') {
            result[field] = (
              (record.labor_cost || 0) +
              (record.material_cost || 0) +
              (record.outsourcing_cost || 0) +
              (record.other_cost || 0)
            ).toFixed(2);
          } else if (field.includes('_date') || field === 'created_at' || field === 'updated_at') {
            result[field] = record[field] ? dayjs(record[field]).format('YYYY-MM-DD HH:mm:ss') : '';
          } else {
            result[field] = record[field] || '';
          }
        });
        return result;
      };

      const selectedHeaders = Object.fromEntries(fields.map(field => [field, headers[field]]));
      const formattedData = exportData.map(formatData);

      if (values.exportFormat === 'csv') {
        exportToCSV(formattedData, selectedHeaders, 'maintenance_workorders');
      } else {
        exportToExcel(formattedData, selectedHeaders, '维护工单列表');
      }

      message.success(`成功导出 ${exportData.length} 条记录`);
      setExportModalVisible(false);
    } catch (error) {
      console.error('导出失败:', error);
      message.error('导出失败');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = (data, headers, filename) => {
    if (data.length === 0) return;

    const headerRow = Object.values(headers).join(',');
    const rows = data.map(row =>
      Object.keys(headers)
        .map(key => {
          const value = String(row[key] || '');
          return `"${value.replace(/"/g, '""')}"`;
        })
        .join(',')
    );

    const csvContent = [headerRow, ...rows].join('\n');
    downloadFile(
      csvContent,
      `${filename}_${dayjs().format('YYYYMMDD_HHmmss')}.csv`,
      'text/csv;charset=utf-8;'
    );
  };

  const escapeHtml = value =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const exportToExcel = (data, headers, sheetName) => {
    if (data.length === 0) return;

    const headerCells = Object.values(headers)
      .map(label => `<th>${escapeHtml(label)}</th>`)
      .join('');
    const bodyRows = data
      .map(row => {
        const cells = Object.keys(headers)
          .map(key => `<td>${escapeHtml(row[key])}</td>`)
          .join('');
        return `<tr>${cells}</tr>`;
      })
      .join('');
    const workbookHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    table { border-collapse: collapse; }
    th, td { border: 1px solid #d9d9d9; padding: 6px 8px; white-space: nowrap; }
    th { background: #f5f5f5; font-weight: 600; }
  </style>
</head>
<body>
  <table>
    <caption>${escapeHtml(sheetName)}</caption>
    <thead><tr>${headerCells}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>
</body>
</html>`;

    downloadFile(
      workbookHtml,
      `maintenance_workorders_${dayjs().format('YYYYMMDD_HHmmss')}.xls`,
      'application/vnd.ms-excel;charset=utf-8;'
    );
  };

  const downloadFile = (content, filename, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePaginationChange = (page, pageSize) => {
    fetchWorkOrders({ page, pageSize });
  };

  // 打印工单报表
  const handlePrintReport = () => {
    const printData = selectedRows.length > 0 ? selectedRows : data;
    if (printData.length === 0) {
      message.warning('暂无数据可打印');
      return;
    }
    let periodLabel = '全部数据';
    if (searchParams.start_date && searchParams.end_date) {
      periodLabel = `${searchParams.start_date} ~ ${searchParams.end_date}`;
    }
    printWorkOrderReport(printData, dispatchPanelData, { period: periodLabel });
  };

  const handleSearch = () => {
    fetchWorkOrders({ page: 1 });
    fetchDispatchPanel();
  };

  const handleReset = () => {
    const resetParams = {
      asset_code: '',
      status: '',
      priority: '',
      assigned_to: '',
      start_date: null,
      end_date: null,
      keyword: '',
    };
    setSearchParams(resetParams);
    fetchWorkOrders({ page: 1, filtersOverride: resetParams });
    fetchDispatchPanel({ paramsOverride: resetParams });
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
  };

  const handleDelete = async id => {
    try {
      const response = await maintenanceAPI.deleteMaintenanceWorkOrder(id);
      if (response.success) {
        message.success('删除成功');
        fetchWorkOrders();
        fetchDispatchPanel({ silent: true });
      } else {
        message.error(response.message || '删除失败');
      }
    } catch (error) {
      console.error('删除维护工单失败:', error);
      message.error('网络错误，删除失败');
    }
  };

  const openActionModal = (record, type) => {
    setCurrentRecord(record);
    if (type === 'complete') {
      completeForm.resetFields();
      completeForm.setFieldsValue({
        materials: [{}],
      });
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
    setActionModalVisible(true);
  };

  const handleActionSubmit = async () => {
    try {
      const values = await actionForm.validateFields();
      setLoading(true);

      let response;
      switch (actionType) {
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
        fetchDispatchPanel({ silent: true });
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
      // 工程师手写签名：直接从 Form 拿（已通过 SignatureField + rules 校验）
      const engineer_signature = values.engineer_signature;
      if (!engineer_signature) {
        message.error('请先完成手写签名');
        return;
      }

      setLoading(true);

      const materials = (values.materials || []).filter(m => m && m.name);
      const material_cost = materials.reduce(
        (sum, m) => sum + ((m.quantity || 0) * (m.unit_price || 0)),
        0
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
        message.success(response.message || '工单已签名完成，等待申请人评价');
        setCompleteModalVisible(false);
        fetchWorkOrders();
        fetchDispatchPanel({ silent: true });
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

  const openEvaluateModal = record => {
    setCurrentRecord(record);
    evaluateForm.resetFields();
    setEvaluateModalVisible(true);
  };

  const handleEvaluateSubmit = async () => {
    try {
      const values = await evaluateForm.validateFields();
      // 申请人签名：可选，直接从 Form 拿
      const applicant_signature = values.signature || '';

      setLoading(true);

      const response = await maintenanceAPI.evaluateMaintenanceWorkOrder(currentRecord.id, {
        rating: values.rating,
        comment: values.comment,
        signature: applicant_signature,
      });

      if (response?.success) {
        message.success(response.message || '评价完成，工单已关闭');
        setEvaluateModalVisible(false);
        fetchWorkOrders();
        fetchDispatchPanel({ silent: true });
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

  // 判断当前用户是否工单的"申请人/创建人"（用 created_by 简单匹配姓名）
  const isApplicant = record => {
    if (!currentUser || !record) return false;
    const me = currentUser.real_name || currentUser.username;
    return me && record.created_by && me === record.created_by;
  };

  // 可代申请人评价的管理员角色（现实运维中管理员常代录评价）
  const EVAL_ADMIN_ROLES = ['super_admin', 'system_admin', 'maintenance_admin'];
  const isEvalAdmin = () => !!currentUser?.role && EVAL_ADMIN_ROLES.includes(currentUser.role);
  // 是否可以评价该工单：申请人本人，或管理员代评价
  const canEvaluate = record => isApplicant(record) || isEvalAdmin();

  const getActionMenu = record => {
    const actions = [];

    // assigned: 已分配未开始，可以开始或取消
    if (record.status === 'assigned') {
      actions.push({ key: 'start', label: '开始维修', icon: <PlayCircleOutlined /> });
      actions.push({ key: 'cancel', label: '取消', icon: <CloseOutlined />, danger: true });
    }

    // in_progress: 进行中状态可以完成或取消
    if (record.status === 'in_progress') {
      actions.push({ key: 'complete', label: '完成（签名）', icon: <CheckCircleOutlined /> });
      actions.push({ key: 'cancel', label: '取消', icon: <CloseOutlined />, danger: true });
    }

    // pending_acceptance: 待评价
    //  - 申请人本人：显示"评价"
    //  - 管理员：显示"代评价"（管理员代申请人录入评价）
    //  - 其他人：显示"待申请人评价"（禁用 + Tooltip）
    if (record.status === 'pending_acceptance') {
      if (isApplicant(record)) {
        actions.push({ key: 'evaluate', label: '评价', icon: <StarOutlined /> });
      } else if (isEvalAdmin()) {
        actions.push({ key: 'evaluate', label: '代评价', icon: <StarOutlined /> });
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

    // pending_review: 待审核状态可以关闭
    if (record.status === 'pending_review') {
      actions.push({ key: 'close', label: '关闭', icon: <CloseOutlined /> });
    }

    // completed: 已完成（老数据路径）状态可以关闭
    if (record.status === 'completed') {
      actions.push({ key: 'close', label: '关闭', icon: <CloseOutlined /> });
    }

    // closed/cancelled: 无操作

    if (actions.length === 0) {
      return null;
    }

    return (
      <Menu
        onClick={({ key }) => openActionModal(record, key)}
        items={actions.map(action => ({
          key: action.key,
          label: action.label,
          icon: action.icon,
          danger: action.danger,
          disabled: action.disabled,
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
      render: (text, record) => <a onClick={() => handleView(record)} className="workorder-no-link">{text}</a>,
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
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
        const sourceInfo = sourceTypeMap[record.source_type] || { label: record.source_type || '-', cls: 'other' };
        return (
          <Space size={4}>
            <span className={`source-tag source-tag--${sourceInfo.cls}`}>{sourceInfo.label}</span>
            {record.source_id && (
              <Tooltip title={`来源ID: ${record.source_id}`}>
                <a
                  style={{ fontSize: 12 }}
                  onClick={() => {
                    if (record.source_type === 'request') {
                      window.open(`/maintenance/requests/${record.source_id}`, '_blank');
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
      width: 100,
      render: status => {
        const info = statusMap[status] || { label: status, cls: 'closed' };
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
      title: '成本',
      key: 'cost',
      width: 120,
      render: (_, record) => {
        const total =
          (record.labor_cost || 0) +
          (record.material_cost || 0) +
          (record.outsourcing_cost || 0) +
          (record.other_cost || 0);
        return total > 0 ? (
          <span className="workorder-cost">¥{total.toFixed(2)}</span>
        ) : (
          <span className="workorder-cost workorder-cost-zero">¥0.00</span>
        );
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: date => (date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 260,
      fixed: 'right',
      render: (_, record) => {
        const isClosedOrCancelled = ['closed', 'cancelled'].includes(record.status);
        return (
          <Space size="small">
            <Tooltip title="查看">
              <Button type="link" icon={<EyeOutlined />} onClick={() => handleView(record)} />
            </Tooltip>
            <Tooltip title="编辑">
              <Button
                type="link"
                icon={<EditOutlined />}
                onClick={() => handleEdit(record)}
                disabled={isClosedOrCancelled}
              />
            </Tooltip>
            {record.status === 'in_progress' && (
              <Tooltip title="完成（需手写签名）">
                <Button type="link" icon={<CheckCircleOutlined />} onClick={() => openActionModal(record, 'complete')} />
              </Tooltip>
            )}
            {record.status === 'pending_acceptance' && canEvaluate(record) && (
              <Tooltip title={isApplicant(record) ? '评价' : '代申请人评价'}>
                <Button type="link" icon={<StarOutlined />} style={{ color: '#faad14' }} onClick={() => openActionModal(record, 'evaluate')} />
              </Tooltip>
            )}
            {record.status === 'pending_acceptance' && !canEvaluate(record) && (
              <Tooltip title={`待申请人评价（申请人：${record.created_by || '未知'}）`}>
                <Button type="link" icon={<StarOutlined />} disabled />
              </Tooltip>
            )}
            {['completed', 'pending_review'].includes(record.status) && (
              <Tooltip title="关闭">
                <Button type="link" icon={<CloseOutlined />} onClick={() => openActionModal(record, 'close')} />
              </Tooltip>
            )}
            {!isClosedOrCancelled && !['completed', 'pending_review', 'pending_acceptance', 'closed'].includes(record.status) && (
              <Tooltip title="取消">
                <Popconfirm title="确定取消此工单？" onConfirm={() => {
                  setCurrentRecord(record);
                  setActionType('cancel');
                  actionForm.resetFields();
                  setActionModalVisible(true);
                }}>
                  <Button type="link" danger icon={<CloseOutlined />} />
                </Popconfirm>
              </Tooltip>
            )}
            {['in_progress', 'pending_review'].includes(record.status) && (
              <Tooltip title="删除">
                <Popconfirm title="确定删除此工单？" onConfirm={() => handleDelete(record.id)} disabled={!canDelete}>
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

  const workorderTabContent = (
    <div className="maintenance-workorder-list">
      <Card
        className="dispatch-panel"
        title="调度中心面板"
        style={{ marginBottom: 16 }}
        extra={
          <Space size={12}>
            <Select
              value={dispatchSortBy}
              onChange={setDispatchSortBy}
              size="small"
              style={{ width: 130 }}
              options={[
                { value: 'in_progress', label: '按进行中排序' },
                { value: 'total', label: '按总量排序' },
              ]}
            />
            <div className="refresh-meta">
              <span className="refresh-meta-dot" />
              <span>上次刷新: {dispatchRefreshLabel}</span>
            </div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              数据时间: {dispatchGeneratedLabel}
            </Typography.Text>
            <Button
              icon={<ReloadOutlined spin={dispatchPanelLoading} />}
              onClick={() => fetchDispatchPanel()}
              size="small"
            >
              刷新
            </Button>
          </Space>
        }
      >
        <Spin spinning={dispatchPanelLoading}>
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={24} sm={12} md={6}>
              <div className="dispatch-stat-card dispatch-stat-card--total stat-card-enter">
                <Statistic
                  title="总工单"
                  value={dispatchPanelData?.overview?.total_count || 0}
                  prefix={<FileTextOutlined />}
                />
              </div>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <div className="dispatch-stat-card dispatch-stat-card--pending stat-card-enter">
                <Statistic
                  title="待审核"
                  value={dispatchPanelData?.overview?.pending_review_count || 0}
                  prefix={<CalendarOutlined />}
                />
              </div>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <div className="dispatch-stat-card dispatch-stat-card--progress stat-card-enter">
                <Statistic
                  title="进行中"
                  value={dispatchPanelData?.overview?.in_progress_count || 0}
                  prefix={<ClockCircleOutlined />}
                />
              </div>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <div className="dispatch-stat-card dispatch-stat-card--completed stat-card-enter">
                <Statistic
                  title="已完成"
                  value={dispatchPanelData?.overview?.completed_count || 0}
                  prefix={<CheckCircleOutlined />}
                />
              </div>
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <div className="detail-section-title">工程师工作量</div>
              {(dispatchPanelData.technicians || []).length > 0 ? (
                <Row gutter={[12, 12]}>
                  {(dispatchPanelData.technicians || []).map(item => {
                    const total = item.total_count || 0;
                    const progress = item.in_progress_count || 0;
                    const pending = item.pending_count || 0;
                    const progressPct = total > 0 ? (progress / total) * 100 : 0;
                    return (
                      <Col xs={24} sm={12} key={item.engineer_name}>
                        <div className="dispatch-entity-card">
                          <div className="dispatch-entity-header">
                            <div className="dispatch-entity-avatar dispatch-entity-avatar--engineer">
                              {(item.engineer_name || '?').charAt(0)}
                            </div>
                            <div className="dispatch-entity-name">{item.engineer_name}</div>
                          </div>
                          <div className="dispatch-entity-tags">
                            <span className="dispatch-entity-tag dispatch-entity-tag--total">总计 {total}</span>
                            {progress > 0 && <span className="dispatch-entity-tag dispatch-entity-tag--progress">进行中 {progress}</span>}
                          </div>
                          {total > 0 && (
                            <div className="dispatch-entity-bar">
                              <div
                                className="dispatch-entity-bar-fill dispatch-entity-bar-fill--progress"
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </Col>
                    );
                  })}
                </Row>
              ) : (
                <div className="dispatch-empty">暂无工程师维度数据</div>
              )}
            </Col>

            <Col xs={24} lg={12}>
              <div className="detail-section-title">房间分布</div>
              {(dispatchPanelData.rooms || []).length > 0 ? (
                <Row gutter={[12, 12]}>
                  {(dispatchPanelData.rooms || []).map(item => {
                    const total = item.total_count || 0;
                    const progress = item.in_progress_count || 0;
                    const pending = item.pending_count || 0;
                    const progressPct = total > 0 ? (progress / total) * 100 : 0;
                    return (
                      <Col xs={24} sm={12} key={item.room_name}>
                        <div className="dispatch-entity-card">
                          <div className="dispatch-entity-header">
                            <div className="dispatch-entity-avatar dispatch-entity-avatar--room">
                              <HomeOutlined style={{ fontSize: 14 }} />
                            </div>
                            <div className="dispatch-entity-name">{item.room_name}</div>
                          </div>
                          <div className="dispatch-entity-tags">
                            <span className="dispatch-entity-tag dispatch-entity-tag--total">总计 {total}</span>
                            {progress > 0 && <span className="dispatch-entity-tag dispatch-entity-tag--progress">进行中 {progress}</span>}
                          </div>
                          {total > 0 && (
                            <div className="dispatch-entity-bar">
                              <div
                                className="dispatch-entity-bar-fill dispatch-entity-bar-fill--progress"
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </Col>
                    );
                  })}
                </Row>
              ) : (
                <div className="dispatch-empty">暂无房间维度数据</div>
              )}
            </Col>
          </Row>
        </Spin>
      </Card>

      <Card
        title="维护工单管理"
        extra={
          <Space>
            <Button icon={<PrinterOutlined />} onClick={handlePrintReport}>
              打印报表
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              新建工单
            </Button>
          </Space>
        }
      >
        <Form layout="inline" className="filter-form">
          <Form.Item label="资产编号">
            <Input
              placeholder="资产编号"
              value={searchParams.asset_code}
              onChange={e => setSearchParams({ ...searchParams, asset_code: e.target.value })}
              style={{ width: 140 }}
            />
          </Form.Item>
          <Form.Item label="状态">
            <Select
              placeholder="状态"
              value={searchParams.status}
              onChange={value => setSearchParams({ ...searchParams, status: value })}
              allowClear
              style={{ width: 160 }}
            >
              {Object.entries(statusMap).map(([key, { label }]) => (
                <Option key={key} value={key}>
                  {label}
                </Option>
              ))}
              {/* 特殊选项: 跨所有状态筛选有签字的工单 */}
              <Option value="signed">✍️ 已签字（任意状态）</Option>
            </Select>
          </Form.Item>
          <Form.Item label="优先级">
            <Select
              placeholder="优先级"
              value={searchParams.priority}
              onChange={value => setSearchParams({ ...searchParams, priority: value })}
              allowClear
              style={{ width: 100 }}
            >
              {Object.entries(priorityMap).map(([key, { label }]) => (
                <Option key={key} value={parseInt(key)}>
                  {label}
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
            />
          </Form.Item>
          <Form.Item label="创建日期">
            <RangePicker
              value={dateRangeValue}
              onChange={dates =>
                setSearchParams({
                  ...searchParams,
                  start_date: dates?.[0] ? dates[0].format('YYYY-MM-DD') : null,
                  end_date: dates?.[1] ? dates[1].format('YYYY-MM-DD') : null,
                })
              }
            />
          </Form.Item>
          <Form.Item>
            <Search
              placeholder="搜索工单"
              value={searchParams.keyword}
              onChange={e => setSearchParams({ ...searchParams, keyword: e.target.value })}
              onSearch={handleSearch}
              style={{ width: 200 }}
            />
          </Form.Item>
          <Form.Item>
            <Button type="primary" icon={<FilterOutlined />} onClick={handleSearch}>
              筛选
            </Button>
          </Form.Item>
          <Form.Item>
            <Button icon={<ReloadOutlined />} onClick={handleReset}>
              重置
            </Button>
          </Form.Item>
        </Form>

        <div className="workorder-table-wrapper hide-on-mobile">
          <Table
            columns={columns}
            dataSource={data}
            rowKey="id"
            rowSelection={rowSelection}
            loading={loading}
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: pagination.total,
              onChange: handlePaginationChange,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: total => `共 ${total} 条记录`,
            }}
            scroll={{ x: 1600 }}
          />
        </div>

        {/* 移动端卡片列表 */}
        <div className="mobile-table-cards show-on-mobile">
          {data.map(record => (
            <div key={record.id} className="mobile-card-item">
              <div className="mobile-card-header">
                <span className="mobile-card-title">{record.work_order_no || '-'}</span>
                <Tag color={record.priority === 1 ? 'red' : record.priority === 2 ? 'orange' : record.priority === 3 ? 'blue' : 'default'}>
                  {record.priority === 1 ? '紧急' : record.priority === 2 ? '高' : record.priority === 3 ? '普通' : '-'}
                </Tag>
              </div>
              <div className="mobile-card-body">
                <div className="mobile-card-field">
                  <span className="mobile-card-label">标题</span>
                  <span className="mobile-card-value">{record.title || '-'}</span>
                </div>
                <div className="mobile-card-field">
                  <span className="mobile-card-label">资产</span>
                  <span className="mobile-card-value">{record.asset_code || '-'}</span>
                </div>
                <div className="mobile-card-field">
                  <span className="mobile-card-label">状态</span>
                  <span className="mobile-card-value">{record.status || '-'}</span>
                </div>
                <div className="mobile-card-field">
                  <span className="mobile-card-label">负责人</span>
                  <span className="mobile-card-value">{record.assigned_to || '-'}</span>
                </div>
              </div>
              <div className="mobile-card-actions">
                <Button type="primary" size="small" icon={<EyeOutlined />} onClick={() => handleView(record)} block>详情</Button>
                {record.status === 'in_progress' && (
                  <Button size="small" icon={<CheckCircleOutlined />} onClick={() => openActionModal(record, 'complete')} block>完成（签名）</Button>
                )}
                {record.status === 'pending_acceptance' && canEvaluate(record) && (
                  <Button size="small" icon={<StarOutlined />} style={{ color: '#faad14' }} onClick={() => openActionModal(record, 'evaluate')} block>{isApplicant(record) ? '评价' : '代评价'}</Button>
                )}
                {record.status === 'pending_acceptance' && !canEvaluate(record) && (
                  <Button size="small" icon={<StarOutlined />} disabled block>待申请人评价</Button>
                )}
              </div>
            </div>
          ))}
        </div>

        {selectedRowKeys.length > 0 && (
          <div className="batch-action-bar">
            <span className="batch-count">
              <CheckSquareOutlined />
              已选择 {selectedRowKeys.length} 项
            </span>
            <Button
              type="link"
              icon={<CheckCircleOutlined />}
              onClick={() => openBatchActionModal('complete')}
            >
              批量完成
            </Button>
            <Button type="link" danger icon={<DeleteTwoTone />} onClick={handleBatchDelete}>
              批量删除
            </Button>
            <Button
              type="link"
              icon={<ExportOutlined />}
              onClick={() => setExportModalVisible(true)}
            >
              导出
            </Button>
            <Button
              type="link"
              onClick={() => {
                setSelectedRowKeys([]);
                setSelectedRows([]);
              }}
            >
              取消选择
            </Button>
          </div>
        )}
      </Card>

      <Modal
        title={currentRecord ? '编辑工单' : '新建工单'}
        open={formVisible}
        onCancel={() => setFormVisible(false)}
        footer={null}
        styles={{ wrapper: { width: 900 } }}
        destroyOnHidden
      >
        <MaintenanceWorkOrderForm
          record={currentRecord}
          mode={currentRecord ? 'edit' : 'create'}
          onSuccess={() => {
            setFormVisible(false);
            fetchWorkOrders();
            fetchDispatchPanel({ silent: true });
          }}
          onCancel={() => setFormVisible(false)}
        />
      </Modal>

      <Drawer
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>工单详情</span>
            <Button
              icon={<PrinterOutlined />}
              size="small"
              onClick={() => {
                const r = detailRecord || currentRecord;
                if (!r) {
                  message.warning('暂无数据可打印');
                  return;
                }
                printWorkOrderDetailReport(r, { generatedBy: '系统用户' });
              }}
            >
              打印详情
            </Button>
          </div>
        }
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setDetailRecord(null);
        }}
        styles={{ wrapper: { width: 640 } }}
        className="detail-drawer"
      >
        {(detailRecord || currentRecord) && (() => {
          const r = detailRecord || currentRecord;
          const timelineItems = [
            { label: '创建', time: r.created_at, color: 'blue' },
            { label: '进行中', time: r.started_at, color: 'cyan' },
            { label: '工程师签名完成', time: r.engineer_signed_at, color: 'green' },
            { label: '申请人评价', time: r.evaluated_at, color: 'gold' },
            { label: '关闭', time: r.closed_at, color: 'default' },
          ].filter(item => item.time);

          const labor = r.labor_cost || 0;
          const material = r.material_cost || 0;
          const outsourcing = r.outsourcing_cost || 0;
          const other = r.other_cost || 0;
          const total = labor + material + outsourcing + other;

          return (
            <div>
              <div className="detail-section-title">基本信息</div>
              <Row gutter={[16, 12]}>
                <Col span={12}>
                  <div className="detail-label">工单编号</div>
                  <div className="detail-value">{r.work_order_no}</div>
                </Col>
                <Col span={12}>
                  <div className="detail-label">关联资产</div>
                  <div className="detail-value">{r.asset_code}</div>
                </Col>
                <Col span={24}>
                  <div className="detail-label">标题</div>
                  <div className="detail-value">{r.title}</div>
                </Col>
                <Col span={24}>
                  <div className="detail-label">描述</div>
                  <div className="detail-value">{r.description || '-'}</div>
                </Col>
                <Col span={12}>
                  <div className="detail-label">优先级</div>
                  <div>
                    {(() => {
                      const info = priorityMap[r.priority] || { label: r.priority, cls: 'low' };
                      return <span className={`priority-badge priority-badge--${info.cls}`}>{info.label}</span>;
                    })()}
                  </div>
                </Col>
                <Col span={12}>
                  <div className="detail-label">状态</div>
                  <div>
                    {(() => {
                      const info = statusMap[r.status] || { label: r.status, cls: 'closed' };
                      return <span className={`status-tag status-tag--${info.cls}`}>{info.label}</span>;
                    })()}
                  </div>
                </Col>
                <Col span={12}>
                  <div className="detail-label">负责人</div>
                  <div className="detail-value">{r.assigned_to || '-'}</div>
                </Col>
              </Row>

              <Divider />

              <div className="detail-section-title">来源信息</div>
              <Row gutter={[16, 12]}>
                <Col span={12}>
                  <div className="detail-label">来源类型</div>
                  <div>
                    {(() => {
                      const info = sourceTypeMap[r.source_type] || { label: r.source_type || '-', cls: 'other' };
                      return <span className={`source-tag source-tag--${info.cls}`}>{info.label}</span>;
                    })()}
                  </div>
                </Col>
                <Col span={12}>
                  <div className="detail-label">来源ID</div>
                  <div className="detail-value">
                    {r.source_id ? (
                      <a
                        onClick={() => {
                          if (r.source_type === 'request') {
                            window.open(`/maintenance/requests/${r.source_id}`, '_blank');
                          }
                        }}
                      >
                        <LinkOutlined /> {r.source_id}
                      </a>
                    ) : '-'}
                  </div>
                </Col>
              </Row>

              <Divider />

              <div className="detail-section-title">工单时间线</div>
              <div className="detail-timeline">
                {timelineItems.length > 0 ? (
                  <Timeline
                    items={timelineItems.map(item => ({
                      color: item.color,
                      children: (
                        <div>
                          <div className="detail-value">{item.label}</div>
                          <div className="detail-label" style={{ marginTop: 2 }}>
                            {dayjs(item.time).format('YYYY-MM-DD HH:mm:ss')}
                          </div>
                        </div>
                      ),
                    }))}
                  />
                ) : (
                  <div style={{ color: 'var(--text-tertiary)' }}>暂无时间线记录</div>
                )}
              </div>

              <Divider />

              <div className="detail-section-title">费用明细</div>
              <Row gutter={[16, 12]}>
                <Col span={12}>
                  <div className="detail-label">人工费</div>
                  <div className="detail-value">¥{labor.toFixed(2)}</div>
                </Col>
                <Col span={12}>
                  <div className="detail-label">材料费</div>
                  <div className="detail-value">¥{material.toFixed(2)}</div>
                </Col>
                <Col span={12}>
                  <div className="detail-label">外包费</div>
                  <div className="detail-value">¥{outsourcing.toFixed(2)}</div>
                </Col>
                <Col span={12}>
                  <div className="detail-label">其他费用</div>
                  <div className="detail-value">¥{other.toFixed(2)}</div>
                </Col>
                <Col span={24}>
                  <div className="detail-label">总成本</div>
                  <div className="detail-cost-total">¥{total.toFixed(2)}</div>
                </Col>
              </Row>

              {(r.engineer_signature || r.applicant_signature || r.applicant_rating || r.evaluated_at) && (
                <>
                  <Divider />
                  <div className="detail-section-title">评价与签名</div>
                  <Row gutter={[16, 12]}>
                    {r.applicant_rating ? (
                      <Col span={12}>
                        <div className="detail-label">申请人评分</div>
                        <div>
                          <Rate disabled value={r.applicant_rating} />
                          <span style={{ marginLeft: 8, color: '#faad14' }}>
                            {r.applicant_rating} 星
                          </span>
                        </div>
                      </Col>
                    ) : null}
                    {r.applicant_signed_by ? (
                      <Col span={12}>
                        <div className="detail-label">评价人</div>
                        <div className="detail-value">{r.applicant_signed_by}</div>
                      </Col>
                    ) : null}
                    {r.evaluated_at ? (
                      <Col span={12}>
                        <div className="detail-label">评价时间</div>
                        <div className="detail-value">
                          {dayjs(r.evaluated_at).format('YYYY-MM-DD HH:mm:ss')}
                        </div>
                      </Col>
                    ) : null}
                    {r.applicant_comment ? (
                      <Col span={24}>
                        <div className="detail-label">评价内容</div>
                        <div className="detail-value">{r.applicant_comment}</div>
                      </Col>
                    ) : null}
                    {r.engineer_signature ? (
                      <Col span={12}>
                        <SignatureViewer
                          src={r.engineer_signature}
                          label="工程师签名"
                          signedAt={r.engineer_signed_at}
                          fileName={`engineer-signature-${r.id || ''}-${r.engineer_signed_at ? dayjs(r.engineer_signed_at).format('YYYYMMDD-HHmmss') : Date.now()}.png`}
                        />
                      </Col>
                    ) : null}
                    {r.applicant_signature ? (
                      <Col span={12}>
                        <SignatureViewer
                          src={r.applicant_signature}
                          label="申请人签名"
                          signedAt={r.applicant_signed_at}
                          fileName={`applicant-signature-${r.id || ''}-${r.applicant_signed_at ? dayjs(r.applicant_signed_at).format('YYYYMMDD-HHmmss') : Date.now()}.png`}
                        />
                      </Col>
                    ) : null}
                  </Row>
                </>
              )}
            </div>
          );
        })()}
      </Drawer>

      <Modal
        title={
          {
            start: '开始工单',
            close: '关闭工单',
            cancel: '取消工单',
          }[actionType]
        }
        open={actionModalVisible}
        onCancel={() => setActionModalVisible(false)}
        onOk={handleActionSubmit}
        confirmLoading={loading}
      >
        <Form form={actionForm} layout="vertical">
          {actionType === 'cancel' && (
            <Form.Item
              name="cancel_reason"
              label="取消原因"
              rules={[{ required: true, message: '请输入取消原因' }]}
            >
              <Input.TextArea rows={3} placeholder="请输入取消原因" />
            </Form.Item>
          )}
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} placeholder="备注信息" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="完成工单"
        open={completeModalVisible}
        onCancel={() => setCompleteModalVisible(false)}
        onOk={handleCompleteSubmit}
        confirmLoading={loading}
        styles={{ wrapper: { width: 720 } }}
        className="action-modal complete-modal"
      >
        <Alert
          type="info"
          message="工单提交后状态将变为「待评价」，申请人评价后工单才会真正关闭"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={completeForm} layout="vertical">
          <Form.Item
            name="work_content"
            label="实际工作内容"
            rules={[{ required: true, message: '请输入实际工作内容' }]}
          >
            <Input.TextArea rows={3} placeholder="实际完成的工作内容" />
          </Form.Item>
          <Form.Item
            name="maintenance_result"
            label="维护结果"
            rules={[{ required: true, message: '请选择维护结果' }]}
          >
            <Select placeholder="请选择维护结果">
              <Option value="normal">正常</Option>
              <Option value="abnormal">异常</Option>
              <Option value="follow_up">需要跟进</Option>
            </Select>
          </Form.Item>
          <Form.Item name="actual_hours" label="实际工时">
            <Space.Compact className="w-full">
              <InputNumber min={0} precision={1} style={{ width: '100%' }} />
              <span style={{ display: 'flex', alignItems: 'center', padding: '0 11px', background: '#fafafa', border: '1px solid #d9d9d9', borderLeft: 0 }}>小时</span>
            </Space.Compact>
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="labor_cost" label="人工费">
                <InputNumber
                  className="w-full"
                  min={0}
                  precision={2}
                  formatter={value => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="outsourcing_cost" label="外包费">
                <InputNumber
                  className="w-full"
                  min={0}
                  precision={2}
                  formatter={value => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="other_cost" label="其他费用">
            <InputNumber
              className="w-full"
              min={0}
              precision={2}
              formatter={value => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            />
          </Form.Item>

          <div className="material-divider">
            <span className="material-divider-text">使用材料</span>
          </div>
          <Form.List name="materials">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Row key={key} gutter={8} align="middle" style={{ marginBottom: 8 }}>
                    <Col flex="auto">
                      <Form.Item {...restField} name={[name, 'name']} noStyle>
                        <Input placeholder="名称" />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item {...restField} name={[name, 'specification']} noStyle>
                        <Input placeholder="规格" />
                      </Form.Item>
                    </Col>
                    <Col span={4}>
                      <Form.Item {...restField} name={[name, 'quantity']} noStyle>
                        <InputNumber className="w-full" min={0} placeholder="数量" />
                      </Form.Item>
                    </Col>
                    <Col span={5}>
                      <Form.Item {...restField} name={[name, 'unit_price']} noStyle>
                        <InputNumber className="w-full" min={0} precision={2} placeholder="单价" />
                      </Form.Item>
                    </Col>
                    <Col span={2}>
                      <MinusCircleOutlined
                        style={{ color: '#ff4d4f', fontSize: 16 }}
                        onClick={() => remove(name)}
                      />
                    </Col>
                  </Row>
                ))}
                <Button
                  type="dashed"
                  onClick={() => add()}
                  icon={<PlusCircleOutlined />}
                  style={{ width: '100%' }}
                >
                  添加材料
                </Button>
              </>
            )}
          </Form.List>

          <Form.Item name="remark" label="备注" style={{ marginTop: 16 }}>
            <Input.TextArea rows={2} placeholder="备注信息" />
          </Form.Item>

          <div className="material-divider">
            <span className="material-divider-text">工程师手写签名（必填）</span>
          </div>
          <SignatureField
            name="engineer_signature"
            required
            requiredMessage="请先完成手写签名"
            width={640}
            height={160}
            placeholder="请使用鼠标或触屏在下方手写签名"
            formItemProps={{ style: { marginTop: 8 } }}
          />
        </Form>
      </Modal>

      <Modal
        title={
          {
            complete: '批量完成工单',
          }[batchActionType]
        }
        open={batchActionModalVisible}
        onCancel={() => setBatchActionModalVisible(false)}
        onOk={handleBatchActionSubmit}
        confirmLoading={loading}
        styles={{ wrapper: { width: 600 } }}
      >
        <Alert
          type="info"
          title="批量操作提示"
          description={`将为选中的 ${selectedRows.length} 个工单执行批量操作，只有符合状态条件的工单才会被执行。`}
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={batchActionForm} layout="vertical">
          {batchActionType === 'assign' && (
            <Form.Item
              name="assigned_to"
              label="负责人"
              rules={[{ required: true, message: '请输入负责人' }]}
            >
              <Input placeholder="请输入负责人" />
            </Form.Item>
          )}
          {batchActionType === 'complete' && (
            <>
              <Form.Item name="work_content" label="实际工作内容">
                <Input.TextArea rows={3} placeholder="实际完成的工作内容" />
              </Form.Item>
              <Form.Item name="maintenance_result" label="维护结果">
                <Select placeholder="请选择维护结果" allowClear>
                  <Option value="normal">正常</Option>
                  <Option value="abnormal">异常</Option>
                  <Option value="follow_up">需要跟进</Option>
                </Select>
              </Form.Item>
              <Form.Item name="actual_hours" label="实际工时">
                <Space.Compact className="w-full">
                  <InputNumber min={0} precision={1} style={{ width: '100%' }} />
                  <span style={{ display: 'flex', alignItems: 'center', padding: '0 11px', background: '#fafafa', border: '1px solid #d9d9d9', borderLeft: 0 }}>小时</span>
                </Space.Compact>
              </Form.Item>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="labor_cost" label="人工费">
                    <InputNumber
                      className="w-full"
                      min={0}
                      precision={2}
                      formatter={value => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="outsourcing_cost" label="外包费">
                    <InputNumber
                      className="w-full"
                      min={0}
                      precision={2}
                      formatter={value => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="other_cost" label="其他费用">
                    <InputNumber
                      className="w-full"
                      min={0}
                      precision={2}
                      formatter={value => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    />
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} placeholder="备注信息" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="维修评价"
        open={evaluateModalVisible}
        onCancel={() => setEvaluateModalVisible(false)}
        onOk={handleEvaluateSubmit}
        confirmLoading={loading}
        styles={{ wrapper: { width: 640 } }}
        className="action-modal evaluate-modal"
        okText="提交评价"
      >
        <Alert
          type="info"
          message="请对本次维修服务进行评价，提交后工单将关闭"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={evaluateForm} layout="vertical">
          <Form.Item
            name="rating"
            label="满意度评分"
            rules={[{ required: true, message: '请选择评分' }]}
          >
            <Rate />
          </Form.Item>
          <Form.Item name="comment" label="评价内容">
            <Input.TextArea rows={3} placeholder="请填写您对本次维修服务的评价（可选）" />
          </Form.Item>
          <div className="material-divider">
            <span className="material-divider-text">申请人手写签名（可选）</span>
          </div>
          <SignatureField
            name="signature"
            width={560}
            height={140}
            placeholder="可在下方手写签名（选填）"
            formItemProps={{ style: { marginTop: 8 } }}
          />
        </Form>
      </Modal>

      <Modal
        title="导出工单数据"
        open={exportModalVisible}
        onCancel={() => setExportModalVisible(false)}
        onOk={handleExport}
        confirmLoading={loading}
        styles={{ wrapper: { width: 500 } }}
      >
        <Form
          form={exportForm}
          layout="vertical"
          initialValues={{ exportScope: 'selected', exportFormat: 'excel', exportFields: 'detail' }}
        >
          <Form.Item name="exportScope" label="导出范围">
            <Radio.Group>
              <Radio value="selected">导出选中项 ({selectedRows.length} 条)</Radio>
              <Radio value="all">导出全部筛选结果 ({pagination.total} 条)</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item name="exportFormat" label="导出格式">
            <Radio.Group>
              <Radio value="excel">
                <FileExcelOutlined /> Excel (.xls)
              </Radio>
              <Radio value="csv">
                <FileTextOutlined /> CSV (.csv)
              </Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item name="exportFields" label="导出字段">
            <Radio.Group>
              <Radio value="basic">基础信息</Radio>
              <Radio value="detail">详细信息</Radio>
              <Radio value="cost">成本信息</Radio>
            </Radio.Group>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );

  const dispatchCenterTabItems = [
    { key: 'workorders', label: '工单调度', children: workorderTabContent },
    { key: 'preventive', label: '预防性维护', children: <PreventiveMaintenanceList /> },
  ];

  return (
    <Tabs
      activeKey={activeTab}
      onChange={setActiveTab}
      type="card"
      size="large"
      className="dispatch-center-tabs"
      items={dispatchCenterTabItems}
    />
  );
};

export default MaintenanceWorkOrderList;
