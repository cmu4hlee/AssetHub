import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Input,
  Select,
  DatePicker,
  Space,
  Modal,
  message,
  Popconfirm,
  Card,
  Col,
  Row,
  Tag,
  Badge,
  Tooltip,
  Spin,
  Form,
  InputNumber,
  Image,
  Empty,
  Popover,
  Result,
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
  CloseCircleOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  DownloadOutlined,
  FileOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  FileExcelOutlined,
} from '@ant-design/icons';
import { maintenanceAPI } from '../utils/api';
import useIsMobile from '../hooks/useIsMobile';
import MaintenanceRequestForm from './MaintenanceRequestForm';
import dayjs from 'dayjs';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { getApiErrorMessage } from '../api/client';
import { useCan } from '../hooks';

const { Option } = Select;
const { Search } = Input;
const { TextArea } = Input;
const { RangePicker } = DatePicker;
const DEFAULT_SEARCH_PARAMS = {
  asset_code: '',
  status: '',
  fault_level: '',
  start_date: null,
  end_date: null,
  keyword: '',
};

const isImageMime = mime => typeof mime === 'string' && mime.startsWith('image/');

const getFileIconInfo = mime => {
  if (isImageMime(mime)) return null;
  if (mime === 'application/pdf') return { icon: <FilePdfOutlined />, color: '#ff4d4f' };
  if (
    mime === 'application/msword' ||
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return { icon: <FileWordOutlined />, color: '#2f54eb' };
  }
  if (
    mime === 'application/vnd.ms-excel' ||
    mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) {
    return { icon: <FileExcelOutlined />, color: '#52c41a' };
  }
  return { icon: <FileOutlined />, color: '#8c8c8c' };
};

const getRequestAttachmentPreviewUrl = (requestId, attachmentId) =>
  `/api/maintenance/requests/${requestId}/attachments/${attachmentId}`;

const MaintenanceRequestList = () => {
  const canDelete = useCan('request', 'delete');
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [currentRecord, setCurrentRecord] = useState(null);
  const [actionType, setActionType] = useState(''); // approve, reject, start, complete
  const [searchParams, setSearchParams] = useState(DEFAULT_SEARCH_PARAMS);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });
  const [actionForm] = Form.useForm();
  const [attachments, setAttachments] = useState([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [engineers, setEngineers] = useState([]);
  const [engineersLoading, setEngineersLoading] = useState(false);
  // 路由加载失败 (404 等) - 显示明确"未找到"页面而非 toast 提示
  const [notFoundRecord, setNotFoundRecord] = useState(null);
  // 申请审计历史
  const [requestHistory, setRequestHistory] = useState([]);
  const [requestHistoryLoading, setRequestHistoryLoading] = useState(false);

  // 获取维修申请列表
  const fetchMaintenanceRequests = async (params = {}, filters = searchParams) => {
    setLoading(true);
    try {
      const response = await maintenanceAPI.getMaintenanceRequests({
        page: params.page || pagination.current,
        pageSize: params.pageSize || pagination.pageSize,
        ...filters,
      });
      if (response.success) {
        setData(response.data || []);
        setPagination(prev => ({
          ...prev,
          current: params.page || pagination.current,
          pageSize: params.pageSize || pagination.pageSize,
          total: response.pagination?.total || 0,
        }));
      } else {
        message.error(response.message || '获取维修申请失败');
      }
    } catch (error) {
      console.error('获取维修申请失败:', error);
      message.error(getApiErrorMessage(error, '获取维修申请失败'));
    } finally {
      setLoading(false);
    }
  };

  const loadRequestAttachments = async requestId => {
    setAttachmentsLoading(true);
    try {
      const response = await maintenanceAPI.getMaintenanceRequestAttachments(requestId);
      const list = Array.isArray(response) ? response : response?.data || [];
      setAttachments(list);
    } catch (error) {
      console.error('获取维修申请附件失败:', error);
      setAttachments([]);
    } finally {
      setAttachmentsLoading(false);
    }
  };

  // 加载申请审计历史
  const loadRequestHistory = async requestId => {
    setRequestHistoryLoading(true);
    try {
      const response = await maintenanceAPI.getMaintenanceRequestHistory(requestId);
      setRequestHistory(response?.data || response || []);
    } catch (error) {
      console.error('获取维修申请历史失败:', error);
      setRequestHistory([]);
    } finally {
      setRequestHistoryLoading(false);
    }
  };

  const handleDownloadAttachment = async attachment => {
    if (!currentRecord?.id || !attachment?.id) return;
    const result = await maintenanceAPI.downloadMaintenanceRequestAttachment(
      currentRecord.id,
      attachment.id,
      attachment.file_name,
    );
    if (result?.success === false) {
      message.error(result.message || '下载失败');
    }
  };

  const handleDeleteAttachment = async attachment => {
    if (!currentRecord?.id || !attachment?.id) return;
    Modal.confirm({
      title: '确认删除附件',
      content: `确定要删除 "${attachment.file_name}" 吗？`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const response = await maintenanceAPI.deleteMaintenanceRequestAttachment(
            currentRecord.id,
            attachment.id,
          );
          if (response?.success) {
            message.success('附件已删除');
            loadRequestAttachments(currentRecord.id);
          } else {
            message.error(response?.message || '删除失败');
          }
        } catch (error) {
          console.error('删除附件失败:', error);
          message.error(getApiErrorMessage(error, '删除附件失败'));
        }
      },
    });
  };

  const renderAttachmentPreview = attachment => {
    const mime = attachment.file_type || '';
    if (isImageMime(mime)) {
      const url = getRequestAttachmentPreviewUrl(currentRecord.id, attachment.id);
      return (
        <div
          key={attachment.id}
          style={{
            position: 'relative',
            border: '1px solid #f0f0f0',
            borderRadius: 6,
            overflow: 'hidden',
            background: '#fafafa',
          }}
        >
          <Image
            src={url}
            alt={attachment.file_name}
            width={120}
            height={120}
            style={{ objectFit: 'cover' }}
            preview={{ mask: '点击预览' }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              padding: '4px 6px',
              background: 'rgba(0,0,0,0.55)',
              color: '#fff',
              fontSize: 11,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Tooltip title={attachment.file_name}>
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                }}
              >
                {attachment.file_name}
              </span>
            </Tooltip>
            <span style={{ display: 'inline-flex', gap: 4 }}>
              <DownloadOutlined
                style={{ cursor: 'pointer' }}
                onClick={e => {
                  e.stopPropagation();
                  handleDownloadAttachment(attachment);
                }}
              />
              <DeleteOutlined
                style={{ cursor: 'pointer' }}
                onClick={e => {
                  e.stopPropagation();
                  handleDeleteAttachment(attachment);
                }}
              />
            </span>
          </div>
        </div>
      );
    }

    const fileInfo = getFileIconInfo(mime);
    const sizeKb = attachment.file_size ? Math.round(attachment.file_size / 1024) : 0;
    return (
      <Popover
        key={attachment.id}
        content={
          <div style={{ maxWidth: 260 }}>
            <div style={{ fontWeight: 500, marginBottom: 4 }}>{attachment.file_name}</div>
            <div style={{ color: '#8c8c8c', fontSize: 12 }}>
              {sizeKb > 0 ? `${sizeKb} KB` : ''} {attachment.file_type ? `· ${attachment.file_type}` : ''}
            </div>
            <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              <Button
                type="link"
                size="small"
                icon={<DownloadOutlined />}
                onClick={() => handleDownloadAttachment(attachment)}
              >
                下载
              </Button>
              <Button
                type="link"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleDeleteAttachment(attachment)}
              >
                删除
              </Button>
            </div>
          </div>
        }
        trigger="hover"
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            border: '1px solid #f0f0f0',
            borderRadius: 6,
            background: '#fafafa',
            minWidth: 200,
            maxWidth: 280,
          }}
        >
          <span style={{ color: fileInfo?.color, fontSize: 20 }}>{fileInfo?.icon}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Tooltip title={attachment.file_name}>
              <div
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: 13,
                }}
              >
                {attachment.file_name}
              </div>
            </Tooltip>
            <div style={{ color: '#8c8c8c', fontSize: 11 }}>
              {sizeKb > 0 ? `${sizeKb} KB` : ''}
            </div>
          </div>
        </div>
      </Popover>
    );
  };

  useEffect(() => {
    fetchMaintenanceRequests();
  }, []);

  useEffect(() => {
    const pathname = location.pathname;

    if (pathname === '/maintenance/requests/new') {
      setCurrentRecord(null);
      setDetailModalVisible(false);
      setActionModalVisible(false);
      setActionType('');
      setModalVisible(true);
      return;
    }

    if (!id) {
      setModalVisible(false);
      setDetailModalVisible(false);
      setActionModalVisible(false);
      setActionType('');
      return;
    }

    if (
      pathname === `/maintenance/requests/edit/${id}` ||
      pathname === `/maintenance/requests/${id}` ||
      pathname === `/maintenance/requests/complete/${id}`
    ) {
      void loadRouteRecord(id, pathname);
    }
  }, [id, location.pathname]);

  const showNotFound = (recordId, backendMsg, pathname) => {
    const notFoundMsg = backendMsg || '维修申请不存在或已被删除';
    setNotFoundRecord({
      id: recordId,
      message: notFoundMsg,
      pathname,
    });
    setCurrentRecord(null);
    setModalVisible(false);
    setDetailModalVisible(false);
    setActionModalVisible(false);
    setActionType('');
  };

  const loadRouteRecord = async (recordId, pathname) => {
    setLoading(true);
    try {
      const response = await maintenanceAPI.getMaintenanceRequest(recordId);
      if (!response?.success || !response.data) {
        // 业务层 404 (后端返 success:false 而非 axios throw)
        showNotFound(recordId, response?.message, pathname);
        return;
      }

      const record = response.data;
      setCurrentRecord(record);

      // 详情 / 编辑 / 完成都要加载附件列表
      if (recordId) {
        loadRequestAttachments(recordId);
        loadRequestHistory(recordId);
      }

      if (pathname === `/maintenance/requests/edit/${recordId}`) {
        setDetailModalVisible(false);
        setActionModalVisible(false);
        setActionType('');
        setModalVisible(true);
        return;
      }

      if (pathname === `/maintenance/requests/complete/${recordId}`) {
        setModalVisible(false);
        setDetailModalVisible(false);
        setActionType('complete');
        actionForm.resetFields();
        setActionModalVisible(true);
        return;
      }

      setModalVisible(false);
      setActionModalVisible(false);
      setActionType('');
      setDetailModalVisible(true);
    } catch (error) {
      // axios 抛错的 404/403/500: 检查是否 404 (资源不存在)
      const status = error?.response?.status;
      if (status === 404) {
        // 显示明确"未找到"页面, 不强制自动跳转
        const backendMsg = error.response?.data?.message || error.response?.data?.error;
        showNotFound(recordId, backendMsg, pathname);
      } else {
        // 真正的网络/服务器错误: toast + 跳转回列表
        console.error('加载维修申请详情失败:', error);
        message.error(getApiErrorMessage(error, '加载维修申请详情失败'));
        navigate('/maintenance/requests', { replace: true });
      }
    } finally {
      setLoading(false);
    }
  };

  // 分页变化
  const handlePaginationChange = (page, pageSize) => {
    fetchMaintenanceRequests({ page, pageSize }, searchParams);
  };

  // 搜索
  const handleSearch = () => {
    fetchMaintenanceRequests({ page: 1 }, searchParams);
  };

  // 重置搜索
  const handleReset = () => {
    setSearchParams(DEFAULT_SEARCH_PARAMS);
    fetchMaintenanceRequests({ page: 1 }, DEFAULT_SEARCH_PARAMS);
  };

  // 打开添加模态框
  const handleAdd = () => {
    setCurrentRecord(null);
    navigate('/maintenance/requests/new');
  };

  // 打开编辑模态框
  const handleEdit = record => {
    navigate(`/maintenance/requests/edit/${record.id}`);
  };

  // 打开详情模态框
  const handleView = record => {
    navigate(`/maintenance/requests/${record.id}`);
  };

  // 删除维修申请
  const handleDelete = async id => {
    try {
      const response = await maintenanceAPI.deleteMaintenanceRequest(id);
      if (response.success) {
        message.success('删除成功');
        fetchMaintenanceRequests();
      } else {
        message.error(response.message || '删除失败');
      }
    } catch (error) {
      console.error('删除维修申请失败:', error);
      message.error(getApiErrorMessage(error, '删除失败'));
    }
  };

  // 取消维修申请
  const handleCancel = async id => {
    Modal.confirm({
      title: '确认取消维修申请',
      content: '取消后资产状态将恢复为在用（如无其他进行中申请），是否继续？',
      okText: '确认取消',
      okType: 'danger',
      cancelText: '暂不取消',
      onOk: async () => {
        try {
          const response = await maintenanceAPI.cancelMaintenanceRequest(id);
          if (response.success) {
            message.success('已取消');
            fetchMaintenanceRequests();
          } else {
            message.error(response.message || '取消失败');
          }
        } catch (error) {
          console.error('取消维修申请失败:', error);
          message.error(getApiErrorMessage(error, '取消失败'));
        }
      },
    });
  };

  // 获取工程师角色列表（用于「开始维修」分配执行人）
  const fetchEngineers = async () => {
    setEngineersLoading(true);
    try {
      const res = await maintenanceAPI.getEngineers();
      if (res?.success && Array.isArray(res.data)) {
        setEngineers(res.data);
      } else {
        setEngineers([]);
      }
    } catch (err) {
      console.error('获取工程师列表失败:', err);
      setEngineers([]);
    } finally {
      setEngineersLoading(false);
    }
  };

  // 打开操作模态框
  // 加载申请最近一条维修日志用于"修订"预填表单
  const loadLatestLogForPrefill = async record => {
    try {
      const resp = await maintenanceAPI.getMaintenanceRequestLatestLog(record.id);
      const log = resp?.data || resp;
      if (!log) return;
      // 预填：日期、content、cost、parts、remark
      const prefill = {};
      if (log.maintenance_date) {
        // 兼容字符串 'YYYY-MM-DD' 格式
        const dateStr = typeof log.maintenance_date === 'string'
          ? log.maintenance_date.slice(0, 10)
          : dayjs(log.maintenance_date).format('YYYY-MM-DD');
        prefill.repair_end_date = dayjs(dateStr);
      }
      if (log.maintenance_content) prefill.repair_content = log.maintenance_content;
      if (log.maintenance_cost !== null && log.maintenance_cost !== undefined) {
        prefill.repair_cost = Number(log.maintenance_cost);
      }
      if (log.parts_replaced) prefill.parts_replaced = log.parts_replaced;
      if (log.remark) prefill.remark = log.remark;
      actionForm.setFieldsValue(prefill);
    } catch (e) {
      // 静默失败：拉不到上次日志不影响用户操作
      console.warn('[Request] 预填最近维修日志失败:', e);
    }
  };

  const openActionModal = (record, type) => {
    setCurrentRecord(record);
    setActionType(type);
    actionForm.resetFields();
    if (type === 'complete') {
      // 修订场景：先预填上次的 content/cost/parts，再 navigate
      loadLatestLogForPrefill(record);
      navigate(`/maintenance/requests/complete/${record.id}`);
      return;
    }
    if (type === 'start' || type === 'approve') {
      fetchEngineers();
    }
    setActionModalVisible(true);
  };

  // 处理操作提交
  const handleActionSubmit = async () => {
    try {
      const values = await actionForm.validateFields();
      setLoading(true);

      let response;
      switch (actionType) {
        case 'approve':
          response = await maintenanceAPI.approveMaintenanceRequest(currentRecord.id, {
            approved: true,
            comment: values.comment,
            // 审批 + 派工合二为一: 选了工程师就同时创建工单并指派
            assigned_to: values.assigned_to || undefined,
          });
          break;
        case 'reject':
          response = await maintenanceAPI.approveMaintenanceRequest(currentRecord.id, {
            approved: false,
            comment: values.comment,
          });
          break;
        case 'start':
          response = await maintenanceAPI.startMaintenanceRequest(currentRecord.id, {
            repair_person_id: values.repair_person_id,
            repair_person: values.repair_person,
            repair_start_date: values.repair_start_date?.format('YYYY-MM-DD'),
          });
          break;
        case 'complete':
          response = await maintenanceAPI.completeMaintenanceRequest(currentRecord.id, {
            repair_end_date: values.repair_end_date.format('YYYY-MM-DD'),
            repair_content: values.repair_content,
            repair_cost: values.repair_cost,
            parts_replaced: values.parts_replaced,
            remark: values.remark,
          });
          break;
        default:
          break;
      }

      if (response.success) {
        message.success('操作成功');
        setActionModalVisible(false);
        if (location.pathname !== '/maintenance/requests') {
          navigate('/maintenance/requests', { replace: true });
        }
        fetchMaintenanceRequests();
      } else {
        message.error(response.message || '操作失败');
      }
    } catch (error) {
      console.error('操作失败:', error);
      message.error(getApiErrorMessage(error, '操作失败'));
    } finally {
      setLoading(false);
    }
  };

  // 状态标签
  const getStatusTag = status => {
    const statusMap = {
      待审批: { color: 'orange', text: '待审批' },
      已批准: { color: 'blue', text: '已批准' },
      已拒绝: { color: 'red', text: '已拒绝' },
      维修中: { color: 'purple', text: '维修中' },
      已完成: { color: 'green', text: '已完成' },
      已取消: { color: 'gray', text: '已取消' },
    };
    const statusInfo = statusMap[status] || { color: 'default', text: status };
    return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
  };

  // 故障等级标签
  const getFaultLevelTag = level => {
    const levelMap = {
      紧急: { color: 'red', text: '紧急' },
      严重: { color: 'orange', text: '严重' },
      重要: { color: 'orange', text: '重要' },
      重大: { color: 'volcano', text: '重大' },
      一般: { color: 'blue', text: '一般' },
    };
    const levelInfo = levelMap[level] || { color: 'default', text: level };
    return <Tag color={levelInfo.color}>{levelInfo.text}</Tag>;
  };

  // 表格列
  const columns = [
    {
      title: '序号',
      dataIndex: 'index',
      key: 'index',
      width: 60,
      render: (_, __, index) => (pagination.current - 1) * pagination.pageSize + index + 1,
    },
    {
      title: '申请单号',
      dataIndex: 'request_no',
      key: 'request_no',
      width: 150,
      ellipsis: true,
      render: text => <Tooltip title={text}>{text}</Tooltip>,
    },
    {
      title: '资产编号',
      dataIndex: 'asset_code',
      key: 'asset_code',
      width: 120,
      ellipsis: true,
      render: text => <Tooltip title={text}>{text}</Tooltip>,
    },
    {
      title: '资产名称',
      dataIndex: 'asset_name',
      key: 'asset_name',
      ellipsis: true,
      render: text => <Tooltip title={text}>{text}</Tooltip>,
    },
    {
      title: '故障描述',
      dataIndex: 'fault_description',
      key: 'fault_description',
      ellipsis: true,
      render: text => <Tooltip title={text}>{text || '-'}</Tooltip>,
    },
    {
      title: '故障等级',
      dataIndex: 'fault_level',
      key: 'fault_level',
      width: 80,
      render: text => getFaultLevelTag(text),
    },
    {
      title: '申请日期',
      dataIndex: 'request_date',
      key: 'request_date',
      width: 120,
      render: text => (text ? dayjs(text).format('YYYY-MM-DD') : '-'),
    },
    {
      title: '申请人',
      dataIndex: 'request_person',
      key: 'request_person',
      width: 100,
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: text => getStatusTag(text),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space size="middle">
          <Tooltip title="查看详情">
            <Button type="text" icon={<EyeOutlined />} onClick={() => handleView(record)} />
          </Tooltip>
          {record.status === '待审批' && (
            <Tooltip title="编辑">
              <Button type="text" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
            </Tooltip>
          )}
          {['已取消', '已拒绝'].includes(record.status) && (
            <Tooltip title="删除">
              <Popconfirm
                title="确定要删除这条维修申请吗？"
                onConfirm={() => handleDelete(record.id)} disabled={!canDelete}
                okText="确定"
                cancelText="取消"
              >
                <Button type="text" danger icon={<DeleteOutlined />} disabled={!canDelete} />
              </Popconfirm>
            </Tooltip>
          )}
          {record.status === '待审批' && (
            <>
              <Tooltip title="批准">
                <Button
                  type="text"
                  icon={<CheckOutlined />}
                  onClick={() => openActionModal(record, 'approve')}
                />
              </Tooltip>
              <Tooltip title="拒绝">
                <Button
                  type="text"
                  danger
                  icon={<CloseOutlined />}
                  onClick={() => openActionModal(record, 'reject')}
                />
              </Tooltip>
              <Tooltip title="取消申请">
                <Button
                  type="text"
                  danger
                  icon={<CloseCircleOutlined />}
                  onClick={() => handleCancel(record.id)}
                />
              </Tooltip>
            </>
          )}
          {record.status === '已批准' && (
            <>
              <Tooltip title="开始维修">
                <Button
                  type="text"
                  icon={<PlayCircleOutlined />}
                  onClick={() => openActionModal(record, 'start')}
                />
              </Tooltip>
              <Tooltip title="取消申请">
                <Button
                  type="text"
                  danger
                  icon={<CloseCircleOutlined />}
                  onClick={() => handleCancel(record.id)}
                />
              </Tooltip>
            </>
          )}
          {record.status === '维修中' && (
            <Tooltip title="取消申请">
              <Button
                type="text"
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => handleCancel(record.id)}
              />
            </Tooltip>
          )}
          {['已批准', '维修中', '已完成'].includes(record.status) && (
            <Tooltip title={record.status === '已完成' ? '修订维修内容' : '完成维修'}>
              <Button
                type="text"
                icon={record.status === '已完成' ? <EditOutlined /> : <CheckCircleOutlined />}
                onClick={() => openActionModal(record, 'complete')}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  // 移动端卡片列表
  const renderMobileList = () => {
    // 构建卡片操作按钮
    const getCardActions = item => {
      const actions = [];
      // 查看
      actions.push(
        <Button type="text" icon={<EyeOutlined />} onClick={() => handleView(item)} key="view" />
      );
      // 编辑（仅待审批）
      if (item.status === '待审批') {
        actions.push(
          <Button type="text" icon={<EditOutlined />} onClick={() => handleEdit(item)} key="edit" />
        );
      }
      // 删除（仅已取消/已拒绝）
      if (['已取消', '已拒绝'].includes(item.status)) {
        actions.push(
          <Popconfirm
            title="确定要删除这条维修申请吗？"
            onConfirm={() => handleDelete(item.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="text" danger icon={<DeleteOutlined />} disabled={!canDelete} key="delete" />
          </Popconfirm>
        );
      }
      // 待审批：批准/拒绝/取消
      if (item.status === '待审批') {
        actions.push(
          <Button
            type="text"
            icon={<CheckOutlined />}
            onClick={() => openActionModal(item, 'approve')}
            key="approve"
          />
        );
        actions.push(
          <Button
            type="text"
            danger
            icon={<CloseOutlined />}
            onClick={() => openActionModal(item, 'reject')}
            key="reject"
          />
        );
        actions.push(
          <Button
            type="text"
            danger
            icon={<CloseCircleOutlined />}
            onClick={() => handleCancel(item.id)}
            key="cancel"
          />
        );
      }
      // 已批准：开始维修 + 取消
      if (item.status === '已批准') {
        actions.push(
          <Button
            type="text"
            icon={<PlayCircleOutlined />}
            onClick={() => openActionModal(item, 'start')}
            key="start"
          />
        );
        actions.push(
          <Button
            type="text"
            danger
            icon={<CloseCircleOutlined />}
            onClick={() => handleCancel(item.id)}
            key="cancel"
          />
        );
      }
      // 维修中：取消
      if (item.status === '维修中') {
        actions.push(
          <Button
            type="text"
            danger
            icon={<CloseCircleOutlined />}
            onClick={() => handleCancel(item.id)}
            key="cancel"
          />
        );
      }
      // 已批准 / 维修中 / 已完成：完成或修订
      if (['已批准', '维修中', '已完成'].includes(item.status)) {
        actions.push(
          <Button
            type="text"
            icon={item.status === '已完成' ? <EditOutlined /> : <CheckCircleOutlined />}
            onClick={() => openActionModal(item, 'complete')}
            key="complete"
          />
        );
      }
      return actions;
    };

    return (
      <Row gutter={[12, 12]}>
        {data.map(item => (
          <Col xs={24} key={item.id}>
            <Card
              bordered
              hoverable
              actions={getCardActions(item)}
              styles={{ body: { padding: 12 } }}
            >
              <Card.Meta
                title={
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ fontSize: 14, fontWeight: 500 }}>{item.asset_name}</span>
                      {getStatusTag(item.status)}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: '#666',
                        marginTop: 4,
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>单号: {item.request_no}</span>
                      <span>编号: {item.asset_code}</span>
                    </div>
                  </div>
                }
                description={
                  <div style={{ fontSize: 13, marginTop: 8 }}>
                    <div style={{ marginBottom: 6 }}>
                      <span style={{ color: '#666' }}>故障描述:</span>{' '}
                      <span style={{ color: item.fault_description ? '#333' : '#999' }}>
                        {item.fault_description || '无'}
                      </span>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: 6,
                      }}
                    >
                      <span>
                        <span style={{ color: '#666' }}>等级:</span> {getFaultLevelTag(item.fault_level)}
                      </span>
                      <span>
                        <span style={{ color: '#666' }}>日期:</span>{' '}
                        {item.request_date ? dayjs(item.request_date).format('MM-DD') : '-'}
                      </span>
                    </div>
                    <div style={{ color: '#666', fontSize: 12 }}>
                      申请人: {item.request_person || '-'}
                    </div>
                  </div>
                }
              />
            </Card>
          </Col>
        ))}
      </Row>
    );
  };

  // 操作表单
  const renderActionForm = () => {
    switch (actionType) {
      case 'approve':
      case 'reject':
        return (
          <Form form={actionForm} layout="vertical" onFinish={handleActionSubmit}>
            <Form.Item
              name="comment"
              label={actionType === 'approve' ? '批准备注' : '拒绝原因'}
              rules={[{ required: true, message: '请输入备注' }]}
            >
              <Input.TextArea
                rows={3}
                placeholder={actionType === 'approve' ? '输入批准备注' : '输入拒绝原因'}
              />
            </Form.Item>
            {actionType === 'approve' ? (
              <Form.Item
                name="assigned_to"
                label="派工给（可选）"
                extra="不选则保持待派工，可后续手动派工"
              >
                <Select
                  placeholder="选择工程师（可选）"
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
            ) : null}
            <Form.Item>
              <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                <Button onClick={() => setActionModalVisible(false)}>取消</Button>
                <Button type="primary" htmlType="submit" loading={loading}>
                  {actionType === 'approve' ? '批准并派工' : '拒绝'}
                </Button>
              </Space>
            </Form.Item>
          </Form>
        );
      case 'start':
        return (
          <Form form={actionForm} layout="vertical" onFinish={handleActionSubmit}>
            <Form.Item
              name="repair_person_id"
              label="维修人员（执行人）"
              rules={[{ required: true, message: '请选择维修人员' }]}
            >
              <Select
                placeholder="选择工程师 / 维修管理员"
                loading={engineersLoading}
                showSearch
                optionFilterProp="label"
                allowClear
                onChange={value => {
                  const eng = engineers.find(e => String(e.id) === String(value));
                  actionForm.setFieldsValue({
                    repair_person: eng ? eng.real_name || eng.username : undefined,
                  });
                }}
              >
                {engineers.map(eng => (
                  <Option key={eng.id} value={eng.id}>
                    {eng.real_name || eng.username}
                    {eng.phone ? `（${eng.phone}）` : ''}
                  </Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="repair_person" hidden>
              <Input />
            </Form.Item>
            <Form.Item name="repair_start_date" label="开始维修日期">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item>
              <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                <Button onClick={() => setActionModalVisible(false)}>取消</Button>
                <Button type="primary" htmlType="submit" loading={loading}>
                  开始维修
                </Button>
              </Space>
            </Form.Item>
          </Form>
        );
      case 'complete':
        return (
          <Form form={actionForm} layout="vertical" onFinish={handleActionSubmit}>
            <Form.Item
              name="repair_end_date"
              label="维修日期"
              rules={[{ required: true, message: '请选择维修日期' }]}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              name="repair_content"
              label="维修内容"
              rules={[{ required: true, message: '请输入维修内容' }]}
            >
              <TextArea rows={3} placeholder="详细描述维修内容" />
            </Form.Item>
            <Form.Item
              name="repair_cost"
              label="实际费用"
              rules={[{ required: true, message: '请输入实际费用' }]}
            >
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                step={0.01}
                formatter={value => `¥ ${value}`}
                parser={value => value.replace(/^¥\s*/, '')}
              />
            </Form.Item>
            <Form.Item name="parts_replaced" label="更换部件">
              <TextArea rows={2} placeholder="输入更换的部件" />
            </Form.Item>
            <Form.Item name="remark" label="备注">
              <TextArea rows={2} placeholder="输入备注信息" />
            </Form.Item>
            <Form.Item>
              <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                <Button onClick={() => setActionModalVisible(false)}>取消</Button>
                <Button type="primary" htmlType="submit" loading={loading}>
                  完成维修
                </Button>
              </Space>
            </Form.Item>
          </Form>
        );
      default:
        return null;
    }
  };

  return (
    <div className="maintenance-request-list">
      {/* 路由加载失败 (404 等) - 明确"未找到"页面 */}
      {notFoundRecord ? (
        <Result
          status="404"
          title="维修申请不存在"
          subTitle={
            <div>
              <p>编号 <strong>{notFoundRecord.id}</strong> 的维修申请不存在或已被删除</p>
              <p style={{ fontSize: 12, color: '#999' }}>可能原因: 记录已删除 / 跨租户访问 / 旧链接 / 测试数据清理</p>
            </div>
          }
          extra={[
            <Button key="back" type="primary" onClick={() => {
              setNotFoundRecord(null);
              navigate('/maintenance/requests', { replace: true });
            }}>
              返回列表
            </Button>,
            <Button key="new" onClick={() => {
              setNotFoundRecord(null);
              navigate('/maintenance/requests/new', { replace: true });
            }}>
              提交新申请
            </Button>,
          ]}
        />
      ) : (
        <>
      <div
        style={{
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h1 style={{ margin: 0, fontSize: 20 }}>维修申请管理</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          提交维修申请
        </Button>
      </div>

      {/* 搜索和筛选 */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
          <Search
            placeholder="资产编号"
            value={searchParams.asset_code}
            onChange={e => setSearchParams({ ...searchParams, asset_code: e.target.value })}
            style={{ width: 200 }}
            allowClear
          />
          <Input
            placeholder="关键词搜索"
            value={searchParams.keyword}
            onChange={e => setSearchParams({ ...searchParams, keyword: e.target.value })}
            style={{ width: 200 }}
            allowClear
          />
          <Select
            placeholder="状态"
            value={searchParams.status}
            onChange={value => setSearchParams({ ...searchParams, status: value })}
            style={{ width: 120 }}
            allowClear
          >
            <Option value="待审批">待审批</Option>
            <Option value="已批准">已批准</Option>
            <Option value="已拒绝">已拒绝</Option>
            <Option value="维修中">维修中</Option>
            <Option value="已完成">已完成</Option>
            <Option value="已取消">已取消</Option>
          </Select>
          <Select
            placeholder="故障等级"
            value={searchParams.fault_level}
            onChange={value => setSearchParams({ ...searchParams, fault_level: value })}
            style={{ width: 120 }}
            allowClear
          >
            <Option value="紧急">紧急</Option>
            <Option value="严重">严重</Option>
            <Option value="一般">一般</Option>
          </Select>
          <RangePicker
            placeholder={['开始日期', '结束日期']}
            value={
              searchParams.start_date && searchParams.end_date
                ? [dayjs(searchParams.start_date), dayjs(searchParams.end_date)]
                : null
            }
            onChange={dates => {
              if (dates) {
                setSearchParams({
                  ...searchParams,
                  start_date: dates[0].format('YYYY-MM-DD'),
                  end_date: dates[1].format('YYYY-MM-DD'),
                });
              } else {
                setSearchParams({
                  ...searchParams,
                  start_date: null,
                  end_date: null,
                });
              }
            }}
            style={{ width: 300 }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>
            重置
          </Button>
          <Button type="primary" icon={<FilterOutlined />} onClick={handleSearch}>
            搜索
          </Button>
        </div>
      </Card>

      {/* 数据列表 */}
      <Spin spinning={loading}>
        {data.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <p>暂无维修申请数据</p>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAdd}
              style={{ marginTop: 16 }}
            >
              提交第一条维修申请
            </Button>
          </div>
        ) : (
          <>
            {/* 桌面端表格 */}
            <div className="desktop-list" style={{ display: isMobile ? 'none' : 'block' }}>
              <Table
                columns={columns}
                dataSource={data}
                rowKey="id"
                pagination={{
                  ...pagination,
                  onChange: handlePaginationChange,
                }}
                scroll={{ x: 1400 }}
              />
            </div>

            {/* 移动端卡片 */}
            <div className="mobile-list" style={{ display: isMobile ? 'block' : 'none' }}>
              {renderMobileList()}
            </div>
          </>
        )}
      </Spin>

      <Modal
        title={currentRecord ? '编辑维修申请' : '提交维修申请'}
        open={modalVisible}
        onCancel={() => navigate('/maintenance/requests')}
        footer={null}
        width={820}
        destroyOnHidden
      >
        <MaintenanceRequestForm
          record={currentRecord}
          mode={currentRecord ? 'edit' : 'create'}
          onSuccess={async () => {
            // 先刷新数据再切路由，避免组件卸载导致 fetch 被中断
            await fetchMaintenanceRequests({ page: 1 }, searchParams);
            navigate('/maintenance/requests', { replace: true });
          }}
          onCancel={() => navigate('/maintenance/requests')}
        />
      </Modal>

      {/* 操作模态框 */}
      <Modal
        title={
          actionType === 'approve'
            ? '批准维修申请'
            : actionType === 'reject'
              ? '拒绝维修申请'
              : actionType === 'start'
                ? '开始维修'
                : actionType === 'complete'
                  ? (currentRecord?.status === '已完成' ? '修订维修内容' : '完成维修')
                  : '操作'
        }
        open={actionModalVisible}
        onCancel={() => {
          setActionModalVisible(false);
          if (location.pathname !== '/maintenance/requests') {
            navigate('/maintenance/requests');
          }
        }}
        footer={null}
        width={600}
        destroyOnHidden
      >
        {renderActionForm()}
      </Modal>

      {/* 详情模态框 */}
      <Modal
        title="维修申请详情"
        open={detailModalVisible}
        onCancel={() => navigate('/maintenance/requests')}
        footer={[
          <Button key="close" onClick={() => navigate('/maintenance/requests')}>
            关闭
          </Button>,
        ]}
        width={800}
        destroyOnHidden
      >
        {currentRecord && (
          <div>
            <Card style={{ marginBottom: 16 }}>
              <Card.Meta
                title={
                  <Space>
                    {currentRecord.request_no} - {currentRecord.asset_name}
                  </Space>
                }
                description={
                  <div>
                    <div>资产编号: {currentRecord.asset_code}</div>
                    <div>状态: {getStatusTag(currentRecord.status)}</div>
                    <div>故障等级: {getFaultLevelTag(currentRecord.fault_level)}</div>
                  </div>
                }
              />
            </Card>
            <Card title="基本信息">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                <div>
                  <p>
                    <strong>故障描述:</strong> {currentRecord.fault_description || '-'}
                  </p>
                  <p>
                    <strong>申请日期:</strong>{' '}
                    {currentRecord.request_date
                      ? dayjs(currentRecord.request_date).format('YYYY-MM-DD')
                      : '-'}
                  </p>
                  <p>
                    <strong>申请人:</strong> {currentRecord.request_person || '-'}
                  </p>
                </div>
                <div>
                  <p>
                    <strong>申请部门:</strong> {currentRecord.request_department || '-'}
                  </p>
                  <p>
                    <strong>联系电话:</strong> {currentRecord.contact_phone || '-'}
                  </p>
                  <p>
                    <strong>期望完成日期:</strong>{' '}
                    {currentRecord.expected_repair_date
                      ? dayjs(currentRecord.expected_repair_date).format('YYYY-MM-DD')
                      : '-'}
                  </p>
                </div>
              </div>
              <p style={{ marginTop: 16 }}>
                <strong>备注:</strong> {currentRecord.remark || '-'}
              </p>
            </Card>

            {(currentRecord.approver || currentRecord.approve_date || currentRecord.approve_comment) && (
              <Card title="审批信息" style={{ marginTop: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                  <p>
                    <strong>审批人:</strong> {currentRecord.approver || '-'}
                  </p>
                  <p>
                    <strong>审批日期:</strong>{' '}
                    {currentRecord.approve_date
                      ? dayjs(currentRecord.approve_date).format('YYYY-MM-DD')
                      : '-'}
                  </p>
                </div>
                <p style={{ marginTop: 8 }}>
                  <strong>审批意见:</strong> {currentRecord.approve_comment || '-'}
                </p>
              </Card>
            )}

            {(currentRecord.repair_person || currentRecord.repair_start_date || currentRecord.repair_end_date) && (
              <Card title="维修信息" style={{ marginTop: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                  <div>
                    <p>
                      <strong>维修人员:</strong> {currentRecord.repair_person || '-'}
                    </p>
                    <p>
                      <strong>开始日期:</strong>{' '}
                      {currentRecord.repair_start_date
                        ? dayjs(currentRecord.repair_start_date).format('YYYY-MM-DD')
                        : '-'}
                    </p>
                    <p>
                      <strong>完成日期:</strong>{' '}
                      {currentRecord.repair_end_date
                        ? dayjs(currentRecord.repair_end_date).format('YYYY-MM-DD')
                        : '-'}
                    </p>
                  </div>
                  <div>
                    <p>
                      <strong>实际费用:</strong>{' '}
                      {currentRecord.repair_cost !== null && currentRecord.repair_cost !== undefined
                        ? `¥ ${currentRecord.repair_cost}`
                        : '-'}
                    </p>
                    <p>
                      <strong>维修内容:</strong> {currentRecord.repair_content || '-'}
                    </p>
                    <p>
                      <strong>更换部件:</strong> {currentRecord.parts_replaced || '-'}
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {currentRecord.work_order_id && (
              <Card title="关联工单" style={{ marginTop: 16 }}>
                <p>
                  <strong>工单 ID:</strong> {currentRecord.work_order_id}
                  <Button
                    type="link"
                    size="small"
                    onClick={() => navigate(`/maintenance/workorders/${currentRecord.work_order_id}`)}
                  >
                    查看工单
                  </Button>
                </p>
              </Card>
            )}
            <Card title="操作历史" style={{ marginTop: 16 }}>
              {requestHistoryLoading ? (
                <div style={{ textAlign: 'center', padding: 16 }}>
                  <Spin />
                </div>
              ) : requestHistory.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="暂无操作历史"
                  style={{ padding: '12px 0' }}
                />
              ) : (
                <Timeline
                  items={requestHistory.map(h => {
                    let snapshot = null;
                    if (h.revision_snapshot) {
                      try {
                        snapshot = typeof h.revision_snapshot === 'string'
                          ? JSON.parse(h.revision_snapshot)
                          : h.revision_snapshot;
                      } catch (_) { /* ignore */ }
                    }
                    const isRevise = h.action_type === 'revise';
                    return {
                      color: isRevise ? 'orange' : 'blue',
                      children: (
                        <div>
                          <div style={{ fontWeight: 500 }}>{h.action_description}</div>
                          <div style={{ color: '#999', fontSize: 12, marginTop: 2 }}>
                            {h.action_by} · {dayjs(h.action_at).format('YYYY-MM-DD HH:mm:ss')}
                          </div>
                          {isRevise && snapshot && (
                            <div
                              style={{
                                marginTop: 6,
                                padding: 8,
                                background: '#fafafa',
                                borderRadius: 4,
                                fontSize: 12,
                                color: '#666',
                              }}
                            >
                              <div style={{ fontWeight: 500, marginBottom: 4 }}>修订前内容：</div>
                              {snapshot.maintenance_content && (
                                <div>内容：{snapshot.maintenance_content}</div>
                              )}
                              {snapshot.maintenance_cost !== null && snapshot.maintenance_cost !== undefined && (
                                <div>费用：¥{Number(snapshot.maintenance_cost).toFixed(2)}</div>
                              )}
                              {snapshot.parts_replaced && (
                                <div>更换部件：{snapshot.parts_replaced}</div>
                              )}
                            </div>
                          )}
                        </div>
                      ),
                    };
                  })}
                />
              )}
            </Card>

            <Card title="故障图片" style={{ marginTop: 16 }}>
              {attachmentsLoading ? (
                <div style={{ textAlign: 'center', padding: 24 }}>
                  <Spin />
                </div>
              ) : attachments.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="暂无故障图片"
                  style={{ padding: '12px 0' }}
                />
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                    gap: 12,
                  }}
                >
                  {attachments.map(renderAttachmentPreview)}
                </div>
              )}
            </Card>
          </div>
        )}
      </Modal>
        </>
      )}
    </div>
  );
};

export default MaintenanceRequestList;
