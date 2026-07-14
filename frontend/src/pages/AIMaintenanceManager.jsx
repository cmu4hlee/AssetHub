import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Card,
  Input,
  Button,
  Avatar,
  Space,
  Typography,
  Spin,
  message,
  Form,
  Select,
  DatePicker,
  InputNumber,
  Alert,
  Tooltip,
  Modal,
  Collapse,
  Table,
  Tag,
  Empty,
} from 'antd';

import { isAdminRole } from '../utils/roleUtils';
import { useCurrentUser } from '../hooks';
import useIsMobile from '../hooks/useIsMobile';
import {
  SendOutlined,
  MessageOutlined,
  AudioOutlined,
  StopOutlined,
  LoadingOutlined,
  CheckCircleOutlined,
  EditOutlined,
  SearchOutlined,
  BarChartOutlined,
  FileTextOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { maintenanceAPI, aiAPI, idleAPI, scrappingAPI, inventoryAPI, assetAPI } from '../utils/api';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

// 各意图必填项（与后端 REQUIRED_BY_INTENT 一致）
const REQUIRED_BY_INTENT = {
  maintenance_log: [
    'asset_code',
    'maintenance_type',
    'maintenance_date',
    'maintenance_person',
    'maintenance_content',
  ],
  transfer: ['asset_code', 'to_department', 'reason'],
  repair_request: ['asset_code', 'fault_description'],
  idle_publish: ['publish_person'],
  scrapping: ['asset_code', 'asset_name', 'applicant', 'scrapping_reason'],
  asset_query: [],
  help: [],
  pending_requests: [],
  inventory_query: [],
  inventory_create: ['inventory_no', 'inventory_date', 'inventory_type', 'inventory_person'],
  repair_history: [],
  maintenance_plan_query: [],
  maintenance_stats: [],
  acceptance_query: [],
  technical_doc_query: [],
  adverse_event_query: [],
  metrology_query: [],
  org_query: [],
  department_query: [],
  transfer_approve: [],
};
const INTENT_LABELS = {
  maintenance_log: '维修日志',
  transfer: '资产调配',
  repair_request: '资产报修',
  idle_publish: '闲置发布',
  scrapping: '报废申请',
  asset_query: '查看资产信息',
  help: '帮助',
  pending_requests: '待办查询',
  inventory_query: '盘点查询',
  inventory_create: '发起盘点',
  repair_history: '报修历史',
  maintenance_plan_query: '维护计划',
  maintenance_stats: '维修统计',
  acceptance_query: '验收记录',
  technical_doc_query: '技术资料',
  adverse_event_query: '不良事件',
  metrology_query: '计量记录',
  org_query: '当前企业',
  department_query: '部门与资产',
  transfer_approve: '审批调配',
};
const FORM_FIELD_LABELS = {
  asset_code: '资产编号',
  asset_name: '资产名称',
  maintenance_type: '维护类型',
  maintenance_date: '维护日期',
  maintenance_person: '维护人员',
  maintenance_content: '维护内容',
  maintenance_cost: '维护成本',
  status: '状态',
  maintenance_duration: '维护时长',
  maintenance_location: '维护地点',
  parts_replaced: '更换部件',
  next_maintenance_date: '下次维护日期',
  remark: '备注',
  from_department: '调出部门',
  to_department: '调入部门',
  transfer_date: '调配日期',
  reason: '调配原因',
  transfer_reason: '调配原因',
  transfer_no: '调配单号',
  fault_description: '故障描述',
  fault_level: '故障级别',
  request_department: '报修部门',
  contact_phone: '联系电话',
  expected_repair_date: '期望修复日期',
  publish_person: '发布人',
  publish_date: '发布日期',
  department: '部门',
  applicant: '申请人',
  scrapping_reason: '报废原因',
  estimated_value: '预估残值',
  asset_model: '型号',
  inventory_no: '盘点单号',
  inventory_date: '盘点日期',
  inventory_type: '盘点类型',
  inventory_person: '盘点人',
};

// 解析竖线分隔的表格格式
const parsePipeTable = content => {
  if (!content || typeof content !== 'string') return null;

  const lines = content.split('\n');
  const tableLines = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      tableLines.push(trimmed);
    } else if (trimmed.includes('|') && !trimmed.startsWith('```')) {
      tableLines.push(trimmed);
    }
  }

  if (tableLines.length < 2) return null;

  const headerLine = tableLines[0];
  const separatorLine = tableLines.find(l => l.includes('---')) || tableLines[1];
  const dataLines = tableLines.slice(tableLines.findIndex(l => l.includes('---')) + 1 || 2);

  if (dataLines.length === 0) return null;

  const headers = headerLine
    .split('|')
    .slice(1, -1)
    .map(h => h.trim())
    .filter(h => h);

  const data = dataLines.map((line, index) => {
    const cells = line
      .split('|')
      .slice(1, -1)
      .map(c => c.trim());
    const row = { key: index + 1 };
    headers.forEach((header, i) => {
      row[header] = cells[i] || '';
    });
    return row;
  });

  return { headers, data };
};

const isFilled = v => v !== undefined && v !== null && v !== '';
const allRequiredFilled = (formData, intent = 'maintenance_log') => {
  const noSubmitIntents = [
    'asset_query',
    'help',
    'pending_requests',
    'inventory_query',
    'repair_history',
    'maintenance_plan_query',
    'maintenance_stats',
    'acceptance_query',
    'technical_doc_query',
    'adverse_event_query',
    'metrology_query',
    'org_query',
    'department_query',
    'transfer_approve',
  ];
  if (noSubmitIntents.includes(intent)) return false;
  return (REQUIRED_BY_INTENT[intent] || REQUIRED_BY_INTENT.maintenance_log).every(f =>
    isFilled(formData?.[f])
  );
};

const AIMaintenanceManager = () => {
  // 状态管理
  const isMobile = useIsMobile();
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [maintenanceForm, setMaintenanceForm] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [context, setContext] = useState({});
  const [conversationId, setConversationId] = useState(null);
  const [audioRecorder, setAudioRecorder] = useState(null);
  const [audioChunks, setAudioChunks] = useState([]);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [error, setError] = useState(null);
  const [approvingTransferId, setApprovingTransferId] = useState(null);

  const chatScrollRef = useRef(null);
  const { user: currentUser } = useCurrentUser();
  const canApproveTransfer = useMemo(() => isAdminRole(currentUser?.role), [currentUser?.role]);
  const [form] = Form.useForm();

  // 优化版：智能提取AI响应中的友好消息
  const extractFriendlyMessage = content => {
    if (!content) return '';

    // 1. 优先查找 message 字段
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.message && typeof parsed.message === 'string') {
          // 清洗消息中的转义字符
          return parsed.message.replace(/\\n/g, '\n').replace(/\\"/g, '"').trim();
        }
        // 如果有 extracted_fields 但没有 message，尝试从 content 提取自然语言
        if (parsed.extracted_fields && parsed.content) {
          return String(parsed.content).replace(/\\n/g, '\n').trim();
        }
      }
    } catch (e) {
      // JSON 解析失败，继续尝试其他方法
    }

    // 2. 查找 JSON 块之前的自然语言
    const jsonBlock = content.match(/```json\s*[\s\S]*?```|\{[\s\S]*"extracted_fields"[\s\S]*\}/);
    if (jsonBlock) {
      const beforeJson = content.slice(0, content.indexOf(jsonBlock[0])).trim();
      if (beforeJson && beforeJson.length > 10) {
        return beforeJson;
      }
    }

    // 3. 直接返回原始内容（兜底）
    return content.trim();
  };

  // 有新消息或 AI 思考时，只滚动聊天记录区域到底部（不滚整页）
  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, aiThinking]);

  // 当 AI 返回的 maintenanceForm 更新时，自动填入下方表单（initialValues 仅挂载时生效）
  useEffect(() => {
    if (!showForm || !maintenanceForm) return;
    const formValues = { ...maintenanceForm };
    if (formValues.maintenance_date && typeof formValues.maintenance_date === 'string') {
      formValues.maintenance_date = dayjs(formValues.maintenance_date);
    }
    if (formValues.next_maintenance_date && typeof formValues.next_maintenance_date === 'string') {
      formValues.next_maintenance_date = dayjs(formValues.next_maintenance_date);
    }
    form.setFieldsValue(formValues);
  }, [showForm, maintenanceForm, form]);

  // 初始化对话
  useEffect(() => {
    initConversation();
  }, []);

  // 初始化对话（自动加载待办并提示审批）
  const initConversation = async () => {
    try {
      const res = await aiAPI.initConversation({
        type: 'maintenance',
        userId: localStorage.getItem('userId') || undefined,
      });
      const result = res.data || res;
      if (result.success) {
        setConversationId(result.conversationId);
        const repairs = result.pendingRequests?.repairs || [];
        const transfers = result.pendingRequests?.transfers || [];
        const hasPending = repairs.length > 0 || transfers.length > 0;

        let welcomeContent =
          '您好！我是资产助手，可办理：维修日志、资产调配、资产报修、闲置发布、报废申请、盘点查询与发起盘点；也可查资产、待办、报修历史、维护计划、维修统计；质量管理可查验收记录、技术资料、不良事件、计量记录（支持按资产查）；还可查当前企业、部门与资产。说「帮助」或「质量管理」可看全部能力。';
        if (hasPending) {
          const parts = [];
          if (repairs.length > 0) parts.push(`${repairs.length} 条待办报修`);
          if (transfers.length > 0) parts.push(`${transfers.length} 条待审批调配`);
          welcomeContent += `\n\n您当前有 ${parts.join('、')}。可说「待办」查看详情；系统管理员可说「通过第一条」或「通过调配 5」直接审批调配。`;
        } else {
          welcomeContent += '\n\n请直接说需求或资产编号。';
        }

        setMessages([
          {
            role: 'assistant',
            content: welcomeContent,
            timestamp: new Date().toISOString(),
          },
        ]);
        if (hasPending) {
          setContext(prev => ({
            ...prev,
            pendingRequests: result.pendingRequests,
            currentIntent: 'pending_requests',
          }));
          setShowForm(true);
          setMaintenanceForm({}); // 无表单但需展示右侧待办列表
        } else {
          setContext({});
        }
      }
    } catch (error) {
      console.error('初始化对话失败:', error);
      message.error('初始化对话失败，请刷新页面重试');
    }
  };

  // 刷新待办（审批后更新列表与上下文，供 AI 反映审批结果）
  const refreshPending = async () => {
    try {
      const res = await aiAPI.getPending();
      const data = res.data || res;
      const pendingRequests = data.pendingRequests || { repairs: [], transfers: [] };
      setContext(prev => ({ ...prev, pendingRequests }));
    } catch (e) {
      console.error('刷新待办失败:', e);
    }
  };

  // 在对话框下方点击「通过」执行实际审批，更新数据库并刷新上下文
  const handleApproveTransfer = async item => {
    if (!item?.id || !canApproveTransfer) return;
    setApprovingTransferId(item.id);
    try {
      const res = await assetAPI.approveTransferRequest(item.id, { approved: true });
      const result = res.data || res;
      if (result.success !== false) {
        message.success(result.message || '调配单已通过审批');
        setContext(prev => ({
          ...prev,
          transferApproveResult: {
            success: true,
            message: result.message || `调配单 #${item.id} 已通过审批，资产部门已更新。`,
            transfer_id: item.id,
            approved: true,
          },
          currentIntent: 'transfer_approve',
        }));
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: `调配单 #${item.id}（资产 ${item.asset_code || ''}）已通过审批，资产部门已更新为「${item.target_department || ''}」。`,
            timestamp: new Date().toISOString(),
          },
        ]);
        setShowForm(true);
        await refreshPending();
      } else {
        message.error(result.message || '审批失败');
        setContext(prev => ({
          ...prev,
          transferApproveResult: {
            success: false,
            message: result.message || '审批失败',
            transfer_id: item.id,
            approved: true,
          },
          currentIntent: 'transfer_approve',
        }));
        setShowForm(true);
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || '审批请求失败';
      message.error(msg);
      setContext(prev => ({
        ...prev,
        transferApproveResult: {
          success: false,
          message: msg,
          transfer_id: item.id,
          approved: true,
        },
        currentIntent: 'transfer_approve',
      }));
      setShowForm(true);
    } finally {
      setApprovingTransferId(null);
    }
  };

  // 发送消息
  const sendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage = {
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date().toISOString(),
    };

    // 立即显示用户消息，并清空输入框
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setAiThinking(true);
    setError(null);

    // 构建对话历史供 AI 使用（排除首条欢迎语）
    const historyForApi = messages
      .slice(1)
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role, content: m.content || '' }));

    try {
      const result = await aiAPI.sendMessage({
        conversationId,
        message: inputValue.trim(),
        context,
        history: historyForApi,
      });

      if (result.success) {
        // 立即显示AI响应（不等待后续处理）
        const aiMessage = {
          role: 'assistant',
          content: result.response,
          timestamp: new Date().toISOString(),
        };
        setMessages(prev => [...prev, aiMessage]);

        // 更新上下文
        const newContext = result.context || {};
        setContext(prev => ({
          ...prev,
          ...newContext,
          // 保留必要的上下文信息
          currentForm: newContext.currentForm || prev.currentForm,
          currentIntent: newContext.currentIntent || prev.currentIntent,
        }));

        // 根据意图自动显示对应面板
        const intent = newContext.currentIntent;
        if (intent === 'maintenance_log' && newContext.currentForm) {
          setMaintenanceForm(newContext.currentForm);
          setShowForm(true);
        } else if (['asset_query', 'maintenance_stats', 'pending_requests'].includes(intent)) {
          setShowAnalysis(true);
        }

        // 处理表单验证提示
        if (result.validationResult && !result.validationResult.isValid) {
          if (result.validationResult.missingFields.length > 0) {
            message.info(
              `还需要填写：${result.validationResult.missingFields.map(f => FORM_FIELD_LABELS[f] || f).join('、')}`
            );
          }
        }
      }
    } catch (error) {
      console.error('发送消息失败:', error);
      const errorMsg = error.response?.data?.message || error.message || '发送失败，请重试';
      setError(errorMsg);
      message.error(errorMsg);
    } finally {
      setAiThinking(false);
    }
  };

  // 开始语音录制
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];

      recorder.ondataavailable = e => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/wav' });
        await processAudio(blob);
      };

      recorder.start();
      setAudioRecorder(recorder);
      setIsRecording(true);
      setAudioChunks(chunks);
    } catch (error) {
      console.error('开始录音失败:', error);
      message.error('无法访问麦克风，请检查权限设置');
    }
  };

  // 停止语音录制
  const stopRecording = () => {
    if (audioRecorder) {
      audioRecorder.stop();
      setIsRecording(false);
    }
  };

  // 处理音频
  const processAudio = async blob => {
    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('audio', blob, 'recording.wav');
      formData.append('conversationId', conversationId);

      const result = await aiAPI.processAudio(formData);

      if (result.success) {
        const transcriptMessage = {
          role: 'user',
          content: result.transcript,
          timestamp: new Date().toISOString(),
        };

        setMessages(prev => [...prev, transcriptMessage]);

        // 发送语音转文本的结果给AI
        const aiResult = await aiAPI.sendMessage({
          conversationId,
          message: result.transcript,
          context,
        });

        if (aiResult.success) {
          // 处理AI主响应
          const aiMessage = {
            role: 'assistant',
            content: aiResult.response,
            timestamp: new Date().toISOString(),
          };
          setMessages(prev => [...prev, aiMessage]);
          setContext(aiResult.context || {});

          // 处理未填字段提示
          if (aiResult.promptMessage) {
            const promptMessage = {
              role: 'assistant',
              content: aiResult.promptMessage,
              timestamp: new Date().toISOString(),
              type: 'prompt',
            };
            setMessages(prev => [...prev, promptMessage]);
          }

          // 处理AI返回的维修日志表单数据
          if (aiResult.maintenanceForm) {
            setMaintenanceForm(aiResult.maintenanceForm);
            setShowForm(true);
          }

          // 处理验证结果
          if (aiResult.validationResult && !aiResult.validationResult.isValid) {
            if (aiResult.validationResult.missingFields.length > 0) {
              message.info('请填写未完成的必填字段');
            }
            if (aiResult.validationResult.invalidFields.length > 0) {
              message.warning('部分字段格式不正确，请检查');
            }
          }
        }
      }
    } catch (error) {
      console.error('处理音频失败:', error);
      message.error('处理音频失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 按意图提交（维修日志/调配/报修/闲置发布/报废）；查看/帮助/待办无需提交
  const handleSubmitByIntent = async (values, intentFromContext) => {
    const intent = intentFromContext || context.currentIntent || 'maintenance_log';
    const noSubmitIntents = [
      'asset_query',
      'help',
      'pending_requests',
      'inventory_query',
      'repair_history',
      'maintenance_plan_query',
      'maintenance_stats',
      'acceptance_query',
      'technical_doc_query',
      'adverse_event_query',
      'metrology_query',
      'org_query',
      'department_query',
      'transfer_approve',
    ];
    if (noSubmitIntents.includes(intent)) return;
    const v = { ...values };
    if (v.maintenance_date && dayjs.isDayjs(v.maintenance_date))
      v.maintenance_date = v.maintenance_date.format('YYYY-MM-DD');
    if (v.next_maintenance_date && dayjs.isDayjs(v.next_maintenance_date))
      v.next_maintenance_date = v.next_maintenance_date.format('YYYY-MM-DD');
    if (v.transfer_date && dayjs.isDayjs(v.transfer_date))
      v.transfer_date = v.transfer_date.format('YYYY-MM-DD');
    if (v.transfer_date && typeof v.transfer_date === 'string')
      v.transfer_date = v.transfer_date.slice(0, 10);
    if (v.publish_date && dayjs.isDayjs(v.publish_date))
      v.publish_date = v.publish_date.format('YYYY-MM-DD');
    if (v.request_date && dayjs.isDayjs(v.request_date))
      v.request_date = v.request_date.format('YYYY-MM-DD');
    if (v.expected_repair_date && dayjs.isDayjs(v.expected_repair_date))
      v.expected_repair_date = v.expected_repair_date.format('YYYY-MM-DD');
    if (v.inventory_date && dayjs.isDayjs(v.inventory_date))
      v.inventory_date = v.inventory_date.format('YYYY-MM-DD');
    if (v.inventory_date && typeof v.inventory_date === 'string')
      v.inventory_date = v.inventory_date.slice(0, 10);

    try {
      setLoading(true);
      let result;
      let successMsg;
      switch (intent) {
        case 'transfer': {
          const str = x => (x != null && x !== '' ? String(x).trim() : '');
          const assetCode = str(v.asset_code);
          const toDept = str(v.to_department) || str(v.调入部门);
          const reasonStr = str(v.reason) || str(v.transfer_reason);
          if (!assetCode || !toDept || !reasonStr) {
            message.warning('请补全：资产编号、调入部门、调配原因');
            setLoading(false);
            return;
          }
          try {
            result = await assetAPI.applyTransfer(assetCode, {
              target_department: toDept,
              reason: reasonStr,
            });
            successMsg = result?.success ? '调配申请已提交，等待管理员审批' : '';
          } catch (transferErr) {
            const msg =
              transferErr?.response?.data?.message || transferErr?.message || '调配申请提交失败';
            message.error(msg);
            setLoading(false);
            return;
          }
          break;
        }
        case 'repair_request': {
          const str = x => (x != null && x !== '' ? String(x).trim() : '');
          const assetCode = str(v.asset_code);
          const faultDesc = str(v.fault_description);
          if (!assetCode || !faultDesc) {
            message.warning('请补全：资产编号、故障描述');
            setLoading(false);
            return;
          }
          const repairPayload = {
            asset_code: assetCode,
            fault_description: faultDesc,
          };
          if (str(v.fault_level)) repairPayload.fault_level = str(v.fault_level);
          if (str(v.request_department))
            repairPayload.request_department = str(v.request_department);
          if (str(v.contact_phone)) repairPayload.contact_phone = str(v.contact_phone);
          if (str(v.remark)) repairPayload.remark = str(v.remark);
          if (v.request_date) {
            repairPayload.request_date = dayjs.isDayjs(v.request_date)
              ? v.request_date.format('YYYY-MM-DD')
              : String(v.request_date).slice(0, 10);
          }
          if (v.expected_repair_date) {
            repairPayload.expected_repair_date = dayjs.isDayjs(v.expected_repair_date)
              ? v.expected_repair_date.format('YYYY-MM-DD')
              : String(v.expected_repair_date).slice(0, 10);
          }
          try {
            result = await maintenanceAPI.submitAIMaintenanceRequest({
              ...repairPayload,
              source: 'web_ai_assistant',
              intent: 'repair_request',
              conversationId,
            });
            successMsg = result?.success
              ? `报修申请已提交，单号：${result?.data?.request_no ?? '-'}`
              : '';
          } catch (repairErr) {
            const msg = repairErr?.response?.data?.message || repairErr?.message || '报修提交失败';
            message.error(msg);
            setLoading(false);
            return;
          }
          break;
        }
        case 'idle_publish':
          if (!v.publish_date) v.publish_date = dayjs().format('YYYY-MM-DD');
          result = await idleAPI.createIdleAsset(v);
          successMsg = result?.success ? '闲置资产已发布' : '';
          break;
        case 'scrapping':
          result = await scrappingAPI.createScrappingRequest(v);
          successMsg = result?.success ? '报废申请已提交' : '';
          break;
        case 'inventory_create': {
          const str = x => (x != null && x !== '' ? String(x).trim() : '');
          const inventory_no = str(v.inventory_no);
          const inventory_date = v.inventory_date
            ? dayjs.isDayjs(v.inventory_date)
              ? v.inventory_date.format('YYYY-MM-DD')
              : String(v.inventory_date).slice(0, 10)
            : '';
          const inventory_type = str(v.inventory_type);
          const inventory_person = str(v.inventory_person);
          if (!inventory_no || !inventory_date || !inventory_type || !inventory_person) {
            message.warning('请补全：盘点单号、盘点日期、盘点类型、盘点人');
            setLoading(false);
            return;
          }
          const validTypes = ['全面盘点', '抽查盘点', '专项盘点'];
          if (!validTypes.includes(inventory_type)) {
            message.warning('盘点类型须为：全面盘点、抽查盘点、专项盘点');
            setLoading(false);
            return;
          }
          try {
            result = await inventoryAPI.createInventory({
              inventory_no,
              inventory_date,
              inventory_type,
              inventory_person,
              remark: str(v.remark) || undefined,
            });
            successMsg = result?.success ? `盘点已创建，单号：${inventory_no}` : '';
          } catch (invErr) {
            const msg = invErr?.response?.data?.message || invErr?.message || '盘点创建失败';
            message.error(msg);
            setLoading(false);
            return;
          }
          break;
        }
        default:
          result = await maintenanceAPI.createMaintenanceLog(v);
          successMsg = result?.success ? `维修日志已创建，编号：${result?.data?.id ?? '-'}` : '';
      }
      if (result?.success) {
        message.success(successMsg || '提交成功');
        setShowForm(false);
        setMaintenanceForm(null);
        setContext(prev => ({ ...prev, currentForm: null, currentIntent: null }));
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: successMsg || '提交成功',
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    } catch (err) {
      console.error('提交失败:', err);
      const errMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        '提交失败，请重试';
      message.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  // 重置对话
  const resetConversation = () => {
    setMessages([
      {
        role: 'assistant',
        content:
          '您好！我是资产助手，可办理：维修日志、资产调配、资产报修、闲置发布、报废申请、盘点查询与发起盘点；也可查资产、待办、报修历史、维护计划、维修统计；质量管理可查验收记录、技术资料、不良事件、计量记录（支持按资产查）；还可查当前企业、部门与资产。说「帮助」或「质量管理」可看全部能力。请直接说需求或资产编号。',
        timestamp: new Date().toISOString(),
      },
    ]);
    setContext({});
    setMaintenanceForm(null);
    setShowForm(false);
    setAnalysisResults(null);
    setShowAnalysis(false);
    initConversation();
  };

  // 获取维修分析
  const getMaintenanceAnalysis = async () => {
    try {
      setLoading(true);
      const result = await maintenanceAPI.getEfficiencyOverview();
      if (result.success) {
        setAnalysisResults(result.data);
        setShowAnalysis(true);
      }
    } catch (error) {
      console.error('获取维修分析失败:', error);
      message.error('获取维修分析失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 输入框回车：Enter 发送，Shift+Enter 换行
  const handleInputKeyDown = e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (inputValue.trim() && !aiThinking) sendMessage();
    }
  };

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: isMobile ? '12px 8px' : '24px 16px' }}>
      <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
        <Title level={2} style={{ marginBottom: 0 }}>
          <MessageOutlined /> AI助手
        </Title>

        <div
          style={{
            display: 'flex',
            gap: isMobile ? 12 : 20,
            width: '100%',
            flexWrap: 'wrap',
            alignItems: 'stretch',
            flexDirection: isMobile ? 'column' : 'row',
          }}
        >
          {/* 左侧：对话界面 */}
          <Card
            title={
              <Space>
                <Text strong>AI助手</Text>
                <Tooltip title="重置对话">
                  <Button
                    type="text"
                    size="small"
                    icon={<HistoryOutlined />}
                    onClick={resetConversation}
                  />
                </Tooltip>
                <Tooltip title="查看维修分析">
                  <Button
                    type="text"
                    size="small"
                    icon={<BarChartOutlined />}
                    onClick={getMaintenanceAnalysis}
                  />
                </Tooltip>
              </Space>
            }
            style={{
              flex: isMobile ? '1 1 100%' : '1 1 420px',
              minWidth: isMobile ? '100%' : 340,
              height: isMobile ? '60vh' : 'calc(100vh - 180px)',
              maxHeight: isMobile ? '60vh' : 'calc(100vh - 180px)',
              display: 'flex',
              flexDirection: 'column',
            }}
            styles={{
              body: {
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                minHeight: 0,
                overflow: 'hidden',
                padding: 16,
              },
            }}
          >
            {/* 对话历史：仅此区域可滚动，新消息时滚到底部 */}
            <div
              ref={chatScrollRef}
              style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 0' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {messages.map((item, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      gap: 12,
                      alignItems: 'flex-start',
                      padding: '10px 12px',
                      borderRadius: 8,
                      background: item.role === 'user' ? '#e6f4ff' : '#f6ffed',
                    }}
                  >
                    <Avatar
                      icon={item.role === 'user' ? <MessageOutlined /> : <LoadingOutlined />}
                      style={{
                        backgroundColor: item.role === 'user' ? '#1890ff' : '#52c41a',
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}
                      >
                        <Text style={{ fontWeight: 600 }}>
                          {item.role === 'user' ? '您' : 'AI 助手'}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {item.timestamp ? dayjs(item.timestamp).format('MM-DD HH:mm') : ''}
                        </Text>
                      </div>
                      {item.role === 'assistant' ? (
                        (() => {
                          const friendlyMessage = extractFriendlyMessage(item.content);
                          const showPrompt = !friendlyMessage && item.type === 'prompt';
                          if (showPrompt) {
                            return (
                              <Paragraph
                                style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#1677ff' }}
                              >
                                {item.content}
                              </Paragraph>
                            );
                          }
                          if (!friendlyMessage) return null;

                          const tableData = parsePipeTable(friendlyMessage);

                          return (
                            <div
                              className="markdown-content"
                              style={{ margin: 0, lineHeight: 1.6 }}
                            >
                              {tableData ? (
                                <>
                                  <div className="hide-on-mobile">
                                    <Table
                                      dataSource={tableData.data}
                                      columns={tableData.headers.map(h => ({
                                        title: h,
                                        dataIndex: h,
                                        key: h,
                                        ellipsis: true,
                                      }))}
                                      size="small"
                                      pagination={false}
                                      style={{ margin: '8px 0' }}
                                      rowKey="key"
                                    />
                                  </div>
                                  <div className="mobile-table-cards show-on-mobile" style={{ margin: '8px 0' }}>
                                    {Array.isArray(tableData.data) && tableData.data.length > 0 ? (
                                      tableData.data.map(record => (
                                        <div key={record.key} className="mobile-card-item">
                                          <div className="mobile-card-header">
                                            <span className="mobile-card-title">
                                              {record[tableData.headers[0]] || '-'}
                                            </span>
                                          </div>
                                          {tableData.headers.length > 1 && (
                                            <div className="mobile-card-body">
                                              {tableData.headers.slice(1).map(h => (
                                                <div key={h} className="mobile-card-field">
                                                  <span className="mobile-card-label">{h}</span>
                                                  <span className="mobile-card-value">{record[h] || '-'}</span>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      ))
                                    ) : (
                                      <Empty description="暂无数据" />
                                    )}
                                  </div>
                                </>
                              ) : (
                                <ReactMarkdown
                                  components={{
                                    p: ({ children }) => (
                                      <Paragraph style={{ margin: '8px 0' }}>{children}</Paragraph>
                                    ),
                                    ul: ({ children }) => (
                                      <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                                        {children}
                                      </ul>
                                    ),
                                    ol: ({ children }) => (
                                      <ol style={{ margin: '8px 0', paddingLeft: '20px' }}>
                                        {children}
                                      </ol>
                                    ),
                                    li: ({ children }) => (
                                      <li style={{ margin: '4px 0' }}>{children}</li>
                                    ),
                                    strong: ({ children }) => <Text strong>{children}</Text>,
                                    em: ({ children }) => <Text type="secondary">{children}</Text>,
                                    code: ({ children }) => (
                                      <code
                                        style={{
                                          background: '#f5f5f5',
                                          padding: '2px 6px',
                                          borderRadius: '4px',
                                          fontSize: '0.9em',
                                        }}
                                      >
                                        {children}
                                      </code>
                                    ),
                                    pre: ({ children }) => (
                                      <pre
                                        style={{
                                          background: '#f6f8fa',
                                          padding: '12px',
                                          borderRadius: '8px',
                                          overflow: 'auto',
                                          margin: '8px 0',
                                        }}
                                      >
                                        {children}
                                      </pre>
                                    ),
                                    blockquote: ({ children }) => (
                                      <Alert
                                        type="info"
                                        showIcon={false}
                                        style={{ margin: '8px 0' }}
                                        message={children}
                                      />
                                    ),
                                    h1: ({ children }) => (
                                      <Title level={5} style={{ margin: '12px 0 8px' }}>
                                        {children}
                                      </Title>
                                    ),
                                    h2: ({ children }) => (
                                      <Title level={5} style={{ margin: '10px 0 6px' }}>
                                        {children}
                                      </Title>
                                    ),
                                    h3: ({ children }) => (
                                      <Text
                                        strong
                                        style={{ display: 'block', margin: '8px 0 4px' }}
                                      >
                                        {children}
                                      </Text>
                                    ),
                                    a: ({ href, children }) => (
                                      <a
                                        href={href}
                                        style={{ color: '#1677ff' }}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                      >
                                        {children}
                                      </a>
                                    ),
                                    hr: () => (
                                      <hr
                                        style={{
                                          margin: '12px 0',
                                          border: 'none',
                                          borderTop: '1px solid #e8e8e8',
                                        }}
                                      />
                                    ),
                                  }}
                                  remarkGfm={remarkGfm}
                                  rehypePlugins={[rehypeRaw]}
                                >
                                  {friendlyMessage}
                                </ReactMarkdown>
                              )}
                            </div>
                          );
                        })()
                      ) : (
                        <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                          {item.content}
                        </Paragraph>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {aiThinking && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 12px',
                    background: '#f6ffed',
                    borderRadius: 8,
                    marginTop: 8,
                  }}
                >
                  <Avatar icon={<LoadingOutlined spin />} style={{ backgroundColor: '#52c41a' }} />
                  <Text type="secondary">AI 正在思考...</Text>
                </div>
              )}
            </div>

            {error && (
              <Alert
                type="error"
                showIcon
                message={error}
                style={{ marginTop: 8, flexShrink: 0 }}
                closable
                onClose={() => setError(null)}
                action={
                  <Button
                    size="small"
                    type="primary"
                    onClick={() => {
                      setError(null);
                      sendMessage();
                    }}
                  >
                    重试
                  </Button>
                }
              />
            )}

            {/* 输入区：多行输入，Enter 发送 / Shift+Enter 换行 */}
            <div
              style={{
                flexShrink: 0,
                marginTop: 12,
                paddingTop: 12,
                borderTop: '1px solid #f0f0f0',
              }}
            >
              <TextArea
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="输入资产编号或描述维修情况…（Enter 发送，Shift+Enter 换行）"
                autoSize={{ minRows: 1, maxRows: 4 }}
                style={{ resize: 'none', marginBottom: 8 }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <Tooltip title={isRecording ? '停止录音' : '语音输入'}>
                  <Button
                    icon={isRecording ? <StopOutlined /> : <AudioOutlined />}
                    onClick={isRecording ? stopRecording : startRecording}
                    danger={isRecording}
                  />
                </Tooltip>
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={sendMessage}
                  disabled={!inputValue.trim() || aiThinking}
                  loading={aiThinking}
                >
                  发送
                </Button>
              </div>
            </div>

            {/* 下方：详情区域（优先展示资产明细；无资产明细时才展示待审批） */}
            {(context.assetDetails?.asset_code ||
              context.assetDetails?.ASSET_CODE ||
              ((context.isMyDeptAssetList ||
                context.assetSearchResults?.keyword === '（本管理科室）') &&
                Array.isArray(context.assetSearchResults?.list) &&
                context.assetSearchResults.list.length > 0) ||
              (() => {
                const pendingTransfers = (context.pendingRequests?.transfers || []).filter(
                  t => t.status === 'pending' || t.status_cn === '待审批'
                );
                return pendingTransfers.length > 0;
              })()) && (
              <div
                style={{
                  flexShrink: 0,
                  marginTop: 12,
                  paddingTop: 12,
                  borderTop: '1px solid #f0f0f0',
                }}
              >
                <Text strong style={{ display: 'block', marginBottom: 8, color: '#333' }}>
                  <FileTextOutlined /> 详情
                </Text>
                {/* 有资产明细时：详情区只显示资产相关，不显示审批 */}
                {context.assetDetails &&
                  (context.assetDetails.asset_code || context.assetDetails.ASSET_CODE) && (
                    <div
                      style={{
                        padding: 12,
                        background: '#f6ffed',
                        borderRadius: 8,
                        border: '1px solid #b7eb8f',
                        fontSize: 12,
                      }}
                    >
                      <Text
                        type="secondary"
                        style={{ display: 'block', marginBottom: 8, fontSize: 12 }}
                      >
                        资产明细
                      </Text>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
                          gap: '6px 16px',
                        }}
                      >
                        <span>
                          <Text type="secondary">资产编号：</Text>
                          {context.assetDetails.asset_code ??
                            context.assetDetails.ASSET_CODE ??
                            '-'}
                        </span>
                        <span>
                          <Text type="secondary">资产名称：</Text>
                          {context.assetDetails.asset_name ?? '-'}
                        </span>
                        <span>
                          <Text type="secondary">品牌：</Text>
                          {context.assetDetails.brand ?? '-'}
                        </span>
                        <span>
                          <Text type="secondary">型号：</Text>
                          {context.assetDetails.model ?? '-'}
                        </span>
                        <span>
                          <Text type="secondary">规格：</Text>
                          {context.assetDetails.specification ?? '-'}
                        </span>
                        <span>
                          <Text type="secondary">存放地：</Text>
                          {context.assetDetails.location ?? '-'}
                        </span>
                        <span>
                          <Text type="secondary">部门：</Text>
                          {context.assetDetails.department ??
                            context.assetDetails.department_new ??
                            '-'}
                        </span>
                        <span>
                          <Text type="secondary">单位：</Text>
                          {context.assetDetails.unit ?? '-'}
                        </span>
                        <span>
                          <Text type="secondary">责任人：</Text>
                          {context.assetDetails.responsible_person ?? '-'}
                        </span>
                        <span>
                          <Text type="secondary">状态：</Text>
                          {context.assetDetails.status ?? '-'}
                        </span>
                        <span>
                          <Text type="secondary">购置日期：</Text>
                          {context.assetDetails.purchase_date ?? '-'}
                        </span>
                      </div>
                    </div>
                  )}

                {/* 本部门资产列表明细（无单条资产明细时展示） */}
                {!context.assetDetails?.asset_code &&
                  !context.assetDetails?.ASSET_CODE &&
                  (context.isMyDeptAssetList ||
                    context.assetSearchResults?.keyword === '（本管理科室）') &&
                  Array.isArray(context.assetSearchResults?.list) && (
                    <div>
                      <Text
                        type="secondary"
                        style={{ display: 'block', marginBottom: 8, fontSize: 12 }}
                      >
                        本部门资产明细（共 {context.assetSearchResults.list.length} 条）
                      </Text>
                      <div
                        className="hide-on-mobile"
                        style={{
                          maxHeight: 360,
                          overflow: 'auto',
                          border: '1px solid #e8e8e8',
                          borderRadius: 8,
                          background: '#fafafa',
                          fontSize: 12,
                        }}
                      >
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead
                            style={{ position: 'sticky', top: 0, background: '#f0f0f0', zIndex: 1 }}
                          >
                            <tr>
                              <th
                                style={{
                                  padding: '8px',
                                  textAlign: 'left',
                                  borderBottom: '1px solid #e8e8e8',
                                }}
                              >
                                资产编号
                              </th>
                              <th
                                style={{
                                  padding: '8px',
                                  textAlign: 'left',
                                  borderBottom: '1px solid #e8e8e8',
                                }}
                              >
                                资产名称
                              </th>
                              <th
                                style={{
                                  padding: '8px',
                                  textAlign: 'left',
                                  borderBottom: '1px solid #e8e8e8',
                                }}
                              >
                                品牌
                              </th>
                              <th
                                style={{
                                  padding: '8px',
                                  textAlign: 'left',
                                  borderBottom: '1px solid #e8e8e8',
                                }}
                              >
                                型号
                              </th>
                              <th
                                style={{
                                  padding: '8px',
                                  textAlign: 'left',
                                  borderBottom: '1px solid #e8e8e8',
                                }}
                              >
                                部门
                              </th>
                              <th
                                style={{
                                  padding: '8px',
                                  textAlign: 'left',
                                  borderBottom: '1px solid #e8e8e8',
                                }}
                              >
                                责任人
                              </th>
                              <th
                                style={{
                                  padding: '8px',
                                  textAlign: 'left',
                                  borderBottom: '1px solid #e8e8e8',
                                }}
                              >
                                状态
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {context.assetSearchResults.list.map((a, idx) => (
                              <tr key={a.id ?? idx} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                <td style={{ padding: '6px 8px' }}>{a.asset_code ?? '-'}</td>
                                <td style={{ padding: '6px 8px' }}>{a.asset_name ?? '-'}</td>
                                <td style={{ padding: '6px 8px' }}>{a.brand ?? '-'}</td>
                                <td style={{ padding: '6px 8px' }}>{a.model ?? '-'}</td>
                                <td style={{ padding: '6px 8px' }}>{a.department_new ?? '-'}</td>
                                <td style={{ padding: '6px 8px' }}>
                                  {a.responsible_person ?? '-'}
                                </td>
                                <td style={{ padding: '6px 8px' }}>{a.status ?? '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="mobile-table-cards show-on-mobile">
                        {context.assetSearchResults.list.map((a, idx) => (
                          <div key={a.id ?? idx} className="mobile-card-item">
                            <div className="mobile-card-header">
                              <span className="mobile-card-title">
                                {a.asset_name || a.asset_code || `资产${idx + 1}`}
                              </span>
                              {a.status && <Tag>{a.status}</Tag>}
                            </div>
                            <div className="mobile-card-body">
                              <div className="mobile-card-field">
                                <span className="mobile-card-label">资产编号</span>
                                <span className="mobile-card-value">{a.asset_code ?? '-'}</span>
                              </div>
                              <div className="mobile-card-field">
                                <span className="mobile-card-label">品牌</span>
                                <span className="mobile-card-value">{a.brand ?? '-'}</span>
                              </div>
                              <div className="mobile-card-field">
                                <span className="mobile-card-label">型号</span>
                                <span className="mobile-card-value">{a.model ?? '-'}</span>
                              </div>
                              <div className="mobile-card-field">
                                <span className="mobile-card-label">部门</span>
                                <span className="mobile-card-value">{a.department_new ?? '-'}</span>
                              </div>
                              <div className="mobile-card-field">
                                <span className="mobile-card-label">责任人</span>
                                <span className="mobile-card-value">{a.responsible_person ?? '-'}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* 无资产明细时：才在详情区显示待审批调配单 */}
                {!context.assetDetails?.asset_code &&
                  !context.assetDetails?.ASSET_CODE &&
                  !(
                    context.isMyDeptAssetList ||
                    (context.assetSearchResults?.keyword === '（本管理科室）' &&
                      Array.isArray(context.assetSearchResults?.list) &&
                      context.assetSearchResults.list.length > 0)
                  ) &&
                  context.pendingRequests?.transfers?.length > 0 &&
                  (() => {
                    const pendingTransfers = (context.pendingRequests.transfers || []).filter(
                      t => t.status === 'pending' || t.status_cn === '待审批'
                    );
                    if (pendingTransfers.length === 0) return null;
                    return (
                      <div>
                        <Text
                          type="secondary"
                          style={{ display: 'block', marginBottom: 8, fontSize: 12 }}
                        >
                          待审批调配单（{pendingTransfers.length} 条）
                        </Text>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {pendingTransfers.map(t => (
                            <div
                              key={t.id}
                              style={{
                                padding: 12,
                                background: '#f0f9ff',
                                borderRadius: 8,
                                border: '1px solid #bae7ff',
                              }}
                            >
                              <div
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: '1fr auto',
                                  gap: 8,
                                  alignItems: 'center',
                                }}
                              >
                                <div style={{ fontSize: 12 }}>
                                  <div>
                                    <Text type="secondary">单号 </Text>#{t.id}
                                  </div>
                                  <div>
                                    <Text type="secondary">资产 </Text>
                                    {t.asset_code} {t.asset_name ? `（${t.asset_name}）` : ''}
                                  </div>
                                  <div>
                                    <Text type="secondary">调出部门 </Text>
                                    {t.current_department} <Text type="secondary">→ 调入部门 </Text>
                                    {t.target_department}
                                  </div>
                                  {t.reason && (
                                    <div>
                                      <Text type="secondary">原因 </Text>
                                      {t.reason}
                                    </div>
                                  )}
                                  <div>
                                    <Text type="secondary">申请人 </Text>
                                    {t.applicant || '-'} <Text type="secondary">日期 </Text>
                                    {t.transfer_date || t.created_at || '-'}
                                  </div>
                                </div>
                                {canApproveTransfer && (
                                  <Button
                                    type="primary"
                                    size="small"
                                    icon={<CheckCircleOutlined />}
                                    loading={approvingTransferId === t.id}
                                    disabled={approvingTransferId != null}
                                    onClick={() => handleApproveTransfer(t)}
                                  >
                                    通过
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                        {!canApproveTransfer && (
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            仅系统管理员可在此审批；您也可在对话中说「通过第一条」等由 AI 执行审批。
                          </Text>
                        )}
                      </div>
                    );
                  })()}
              </div>
            )}
          </Card>

          {/* 右侧：按当前意图动态显示标题 */}
          <Card
            title={
              <Space>
                <Text strong>
                  {showForm
                    ? INTENT_LABELS[context.currentIntent] || '所填清单'
                    : showAnalysis
                      ? '维修分析'
                      : INTENT_LABELS[context.currentIntent] || '功能说明'}
                </Text>
              </Space>
            }
            style={{
              flex: isMobile ? '1 1 100%' : '1 1 420px',
              minWidth: isMobile ? '100%' : 340,
              height: isMobile ? 'auto' : 'calc(100vh - 180px)',
              maxHeight: isMobile ? 'none' : 'calc(100vh - 180px)',
              display: 'flex',
              flexDirection: 'column',
            }}
            styles={{ body: { flex: 1, minHeight: 0, overflow: 'auto', padding: 16 } }}
          >
            {loading ? (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <Spin size="large" />
                <Text style={{ display: 'block', marginTop: 16 }}>加载中...</Text>
              </div>
            ) : showForm && maintenanceForm ? (
              <Form
                form={form}
                layout="vertical"
                onFinish={values =>
                  handleSubmitByIntent(values, context.currentIntent || 'maintenance_log')
                }
                style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, minHeight: 0 }}
              >
                {/* 所填清单 + 提交（必填齐全时突出显示） */}
                <div
                  style={{
                    background: '#fafafa',
                    borderRadius: 8,
                    padding: 12,
                    border: '1px solid #f0f0f0',
                  }}
                >
                  <Text strong style={{ display: 'block', marginBottom: 8 }}>
                    <FileTextOutlined /> 所填清单
                    {context.currentIntent && (
                      <Text type="secondary" style={{ marginLeft: 8, fontWeight: 400 }}>
                        （{INTENT_LABELS[context.currentIntent] || context.currentIntent}）
                      </Text>
                    )}
                  </Text>
                  {context.currentIntent === 'help' ? (
                    <div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        我可以帮您：查资产、报修、调配、闲置、报废、维修日志
                      </Text>
                    </div>
                  ) : context.currentIntent === 'pending_requests' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <Text type="secondary">报修单与调配单汇总如下，详情见上方对话。</Text>
                      {(context.pendingRequests?.repairs?.length > 0 ||
                        context.pendingRequests?.list?.length > 0) && (
                        <div>
                          <Text strong style={{ fontSize: 12, color: '#666' }}>
                            报修单
                          </Text>
                          <div
                            style={{
                              marginTop: 4,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 6,
                            }}
                          >
                            {(
                              context.pendingRequests.repairs ||
                              context.pendingRequests.list ||
                              []
                            ).map((r, idx) => (
                              <div
                                key={r.id ?? idx}
                                style={{
                                  padding: 8,
                                  background: '#f6f8fa',
                                  borderRadius: 6,
                                  fontSize: 12,
                                }}
                              >
                                <span>{r.request_no || `#${r.id}`}</span>
                                <span style={{ marginLeft: 8 }}>{r.asset_code}</span>
                                <span style={{ marginLeft: 8, color: '#1890ff' }}>{r.status}</span>
                                <span style={{ marginLeft: 8, color: '#999' }}>
                                  {r.request_date}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {context.pendingRequests?.transfers?.length > 0 && (
                        <div>
                          <Text strong style={{ fontSize: 12, color: '#666' }}>
                            调配单
                          </Text>
                          <div
                            style={{
                              marginTop: 4,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 6,
                            }}
                          >
                            {context.pendingRequests.transfers.map((t, idx) => (
                              <div
                                key={t.id ?? idx}
                                style={{
                                  padding: 8,
                                  background: '#f0f9ff',
                                  borderRadius: 6,
                                  fontSize: 12,
                                }}
                              >
                                <span>{t.asset_code}</span>
                                <span style={{ marginLeft: 8 }}>
                                  {t.current_department} → {t.target_department}
                                </span>
                                <span style={{ marginLeft: 8, color: '#1890ff' }}>
                                  {t.status_cn || t.status}
                                </span>
                                <span style={{ marginLeft: 8, color: '#999' }}>
                                  {t.transfer_date || t.created_at}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {!(
                        context.pendingRequests?.repairs?.length ||
                        context.pendingRequests?.list?.length ||
                        context.pendingRequests?.transfers?.length
                      ) && <Text type="secondary">暂无待办报修或调配单。</Text>}
                    </div>
                  ) : context.currentIntent === 'asset_query' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {context.assetSearchResults?.keyword != null && (
                        <Text type="secondary">关键字：{context.assetSearchResults.keyword}</Text>
                      )}
                      {context.assetSearchResults?.list?.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {context.assetSearchResults.list.map((a, idx) => (
                            <div
                              key={a.id != null ? a.id : idx}
                              style={{
                                padding: 10,
                                background: '#f6f8fa',
                                borderRadius: 8,
                                border: '1px solid #eee',
                              }}
                            >
                              <Text strong style={{ display: 'block', marginBottom: 6 }}>
                                {a.asset_name || a.asset_code || `资产${idx + 1}`}
                              </Text>
                              <div
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 2,
                                  fontSize: 12,
                                }}
                              >
                                <span>
                                  <Text type="secondary">编号：</Text>
                                  {a.asset_code ?? '-'}
                                </span>
                                <span>
                                  <Text type="secondary">品牌：</Text>
                                  {a.brand ?? '-'}
                                </span>
                                <span>
                                  <Text type="secondary">型号：</Text>
                                  {a.model ?? '-'}
                                </span>
                                <span>
                                  <Text type="secondary">部门：</Text>
                                  {a.department_new ?? '-'}
                                </span>
                                <span>
                                  <Text type="secondary">责任人：</Text>
                                  {a.responsible_person ?? '-'}
                                </span>
                                <span>
                                  <Text type="secondary">状态：</Text>
                                  {a.status ?? '-'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <Text type="secondary">
                          无匹配结果，或尚未查询。可按权限查看：资产管理员仅所管科室，系统管理员为本企业，超级管理员为全部。
                        </Text>
                      )}
                    </div>
                  ) : context.currentIntent === 'inventory_query' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {Array.isArray(context.inventoryList) && context.inventoryList.length > 0 ? (
                        context.inventoryList.map((r, idx) => (
                          <div
                            key={r.id ?? idx}
                            style={{
                              padding: 10,
                              background: '#f6f8fa',
                              borderRadius: 8,
                              border: '1px solid #eee',
                              fontSize: 12,
                            }}
                          >
                            <Text strong>{r.inventory_no}</Text>
                            <span style={{ marginLeft: 8, color: '#666' }}>{r.inventory_date}</span>
                            <span style={{ marginLeft: 8 }}>{r.inventory_type}</span>
                            <span style={{ marginLeft: 8 }}>{r.inventory_person}</span>
                            <span style={{ marginLeft: 8, color: '#1890ff' }}>{r.status}</span>
                          </div>
                        ))
                      ) : (
                        <Text type="secondary">暂无盘点记录。</Text>
                      )}
                    </div>
                  ) : context.currentIntent === 'repair_history' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {context.repairHistory?.assetCode && (
                        <Text type="secondary">资产：{context.repairHistory.assetCode}</Text>
                      )}
                      {Array.isArray(context.repairHistory?.list) &&
                      context.repairHistory.list.length > 0 ? (
                        context.repairHistory.list.map((r, idx) => (
                          <div
                            key={r.id ?? idx}
                            style={{
                              padding: 8,
                              background: '#fff7e6',
                              borderRadius: 6,
                              fontSize: 12,
                            }}
                          >
                            <span>{r.request_no || `#${r.id}`}</span>
                            <span style={{ marginLeft: 8 }}>
                              {(r.fault_description || '').slice(0, 40)}
                              {(r.fault_description?.length || 0) > 40 ? '...' : ''}
                            </span>
                            <span style={{ marginLeft: 8, color: '#1890ff' }}>{r.status}</span>
                            <span style={{ marginLeft: 8, color: '#999' }}>{r.request_date}</span>
                          </div>
                        ))
                      ) : (
                        <Text type="secondary">
                          {context.repairHistory?.assetCode
                            ? '该资产暂无报修/维修记录。'
                            : '请提供资产编号查询报修历史。'}
                        </Text>
                      )}
                    </div>
                  ) : context.currentIntent === 'maintenance_plan_query' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {Array.isArray(context.maintenancePlans?.list) &&
                      context.maintenancePlans.list.length > 0 ? (
                        context.maintenancePlans.list.map((p, idx) => (
                          <div
                            key={p.id ?? idx}
                            style={{
                              padding: 8,
                              background: '#e6f7ff',
                              borderRadius: 6,
                              fontSize: 12,
                            }}
                          >
                            <span>{p.asset_code}</span>
                            <span style={{ marginLeft: 8 }}>{p.plan_name || '-'}</span>
                            <span style={{ marginLeft: 8, color: '#fa8c16' }}>
                              下次到期：{p.next_due_date || '-'}
                            </span>
                            <span style={{ marginLeft: 8 }}>{p.status}</span>
                          </div>
                        ))
                      ) : (
                        <Text type="secondary">暂无维护计划或即将到期的计划。</Text>
                      )}
                    </div>
                  ) : context.currentIntent === 'maintenance_stats' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {context.maintenanceStats && (
                        <div
                          style={{
                            padding: 12,
                            background: '#f6ffed',
                            borderRadius: 8,
                            border: '1px solid #b7eb8f',
                          }}
                        >
                          <div style={{ marginBottom: 6 }}>
                            <Text type="secondary">维修申请</Text> 总数{' '}
                            {context.maintenanceStats.total_requests ?? 0}，已完成{' '}
                            {context.maintenanceStats.completed_requests ?? 0}
                          </div>
                          <div>
                            <Text type="secondary">维修日志</Text> 共{' '}
                            {context.maintenanceStats.total_logs ?? 0} 条，总成本{' '}
                            {Number(context.maintenanceStats.total_cost || 0).toFixed(2)} 元
                          </div>
                        </div>
                      )}
                      {!context.maintenanceStats && <Text type="secondary">暂无统计数据。</Text>}
                    </div>
                  ) : context.currentIntent === 'acceptance_query' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {Array.isArray(context.acceptanceRecords) &&
                      context.acceptanceRecords.length > 0 ? (
                        context.acceptanceRecords.map((r, idx) => (
                          <div
                            key={r.id ?? idx}
                            style={{
                              padding: 8,
                              background: '#f9f0ff',
                              borderRadius: 6,
                              fontSize: 12,
                            }}
                          >
                            <span>{r.asset_code}</span>
                            <span style={{ marginLeft: 8 }}>{r.asset_name || '-'}</span>
                            <span style={{ marginLeft: 8 }}>{r.acceptance_date}</span>
                            <span style={{ marginLeft: 8 }}>{r.acceptance_person}</span>
                            <span style={{ marginLeft: 8, color: '#1890ff' }}>{r.status}</span>
                          </div>
                        ))
                      ) : (
                        <Text type="secondary">暂无验收记录。</Text>
                      )}
                    </div>
                  ) : context.currentIntent === 'technical_doc_query' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {Array.isArray(context.technicalDocList) &&
                      context.technicalDocList.length > 0 ? (
                        context.technicalDocList.map((r, idx) => (
                          <div
                            key={r.id ?? idx}
                            style={{
                              padding: 8,
                              background: '#e6fffb',
                              borderRadius: 6,
                              fontSize: 12,
                            }}
                          >
                            <span>{r.title || r.file_name || '-'}</span>
                            <span style={{ marginLeft: 8, color: '#1890ff' }}>
                              {r.review_status}
                            </span>
                            <span style={{ marginLeft: 8, color: '#999' }}>{r.upload_date}</span>
                          </div>
                        ))
                      ) : (
                        <Text type="secondary">暂无技术资料。</Text>
                      )}
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        详情请到「技术资料」列表页查看。
                      </Text>
                    </div>
                  ) : context.currentIntent === 'adverse_event_query' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {Array.isArray(context.adverseEventList) &&
                      context.adverseEventList.length > 0 ? (
                        context.adverseEventList.map((r, idx) => (
                          <div
                            key={r.id ?? idx}
                            style={{
                              padding: 8,
                              background: '#fff2e8',
                              borderRadius: 6,
                              fontSize: 12,
                            }}
                          >
                            <span>{r.report_no || `#${r.id}`}</span>
                            <span style={{ marginLeft: 8 }}>
                              {r.asset_id || r.asset_name || '-'}
                            </span>
                            <span style={{ marginLeft: 8 }}>{r.report_type}</span>
                            <span style={{ marginLeft: 8, color: '#fa541c' }}>{r.severity}</span>
                            <span style={{ marginLeft: 8 }}>{r.occurrence_date}</span>
                          </div>
                        ))
                      ) : (
                        <Text type="secondary">暂无不良事件记录。</Text>
                      )}
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        详情请到「不良事件」列表页查看。
                      </Text>
                    </div>
                  ) : context.currentIntent === 'metrology_query' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {Array.isArray(context.metrologyList) && context.metrologyList.length > 0 ? (
                        context.metrologyList.map((r, idx) => (
                          <div
                            key={r.id ?? idx}
                            style={{
                              padding: 8,
                              background: '#f0f5ff',
                              borderRadius: 6,
                              fontSize: 12,
                            }}
                          >
                            <span>{r.record_no || `#${r.id}`}</span>
                            <span style={{ marginLeft: 8 }}>{r.asset_code}</span>
                            <span style={{ marginLeft: 8 }}>{r.metrology_type}</span>
                            <span style={{ marginLeft: 8, color: '#1890ff' }}>
                              到期：{r.next_due_date || '-'}
                            </span>
                          </div>
                        ))
                      ) : (
                        <Text type="secondary">暂无计量记录。</Text>
                      )}
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        详情请到「计量管理」列表页查看。
                      </Text>
                    </div>
                  ) : context.currentIntent === 'org_query' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {context.orgInfo?.tenant_name ? (
                        <div
                          style={{
                            padding: 12,
                            background: '#f6ffed',
                            borderRadius: 8,
                            border: '1px solid #b7eb8f',
                          }}
                        >
                          <Text strong>当前企业</Text>
                          <div style={{ marginTop: 6 }}>{context.orgInfo.tenant_name}</div>
                          {context.orgInfo.tenant_code && (
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              编码：{context.orgInfo.tenant_code}
                            </Text>
                          )}
                        </div>
                      ) : (
                        <Text type="secondary">未查到当前企业信息。</Text>
                      )}
                    </div>
                  ) : context.currentIntent === 'department_query' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {Array.isArray(context.departmentSummary) &&
                      context.departmentSummary.length > 0 ? (
                        context.departmentSummary.map((r, idx) => (
                          <div
                            key={r.department_code ?? idx}
                            style={{
                              padding: 8,
                              background: '#fafafa',
                              borderRadius: 6,
                              fontSize: 12,
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <span>{r.department_name}</span>
                            <span style={{ color: '#1890ff', fontWeight: 500 }}>
                              {r.asset_count} 台资产
                            </span>
                          </div>
                        ))
                      ) : (
                        <Text type="secondary">暂无部门数据。</Text>
                      )}
                    </div>
                  ) : context.currentIntent === 'transfer_approve' &&
                    context.transferApproveResult ? (
                    <div
                      style={{
                        padding: 12,
                        background: context.transferApproveResult.success ? '#f6ffed' : '#fff2f0',
                        borderRadius: 8,
                        border: `1px solid ${context.transferApproveResult.success ? '#b7eb8f' : '#ffccc7'}`,
                      }}
                    >
                      <Text
                        strong
                        style={{
                          color: context.transferApproveResult.success ? '#52c41a' : '#ff4d4f',
                        }}
                      >
                        {context.transferApproveResult.success ? '审批已执行' : '审批未通过'}
                      </Text>
                      <div style={{ marginTop: 6, fontSize: 12 }}>
                        {context.transferApproveResult.message}
                      </div>
                      <Text
                        type="secondary"
                        style={{ display: 'block', marginTop: 8, fontSize: 12 }}
                      >
                        可说「待办」查看最新调配列表。
                      </Text>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {Object.entries(FORM_FIELD_LABELS)
                          .filter(([key]) => isFilled(maintenanceForm[key]))
                          .map(([key, label]) => {
                            let val = maintenanceForm[key];
                            if (
                              val &&
                              (key === 'maintenance_date' || key === 'next_maintenance_date')
                            ) {
                              val =
                                typeof val === 'string'
                                  ? val
                                  : dayjs.isDayjs(val)
                                    ? val.format('YYYY-MM-DD')
                                    : String(val);
                            }
                            return (
                              <div
                                key={key}
                                style={{
                                  display: 'flex',
                                  gap: 8,
                                  padding: '2px 0',
                                  alignItems: 'baseline',
                                }}
                              >
                                <Text type="secondary" style={{ minWidth: 88, flexShrink: 0 }}>
                                  {label}
                                </Text>
                                <Text ellipsis style={{ flex: 1, minWidth: 0 }}>
                                  {val == null ? '' : String(val)}
                                </Text>
                              </div>
                            );
                          })}
                      </div>
                      {allRequiredFilled(maintenanceForm, context.currentIntent) ? (
                        <Button
                          type="primary"
                          block
                          size="large"
                          icon={<CheckCircleOutlined />}
                          loading={loading}
                          style={{ marginTop: 12 }}
                          onClick={() => {
                            const intent = context.currentIntent || 'maintenance_log';
                            const payload = intent === 'maintenance_log' ? null : maintenanceForm;
                            const summary =
                              intent === 'repair_request'
                                ? `报修：资产 ${maintenanceForm?.asset_code ?? '-'}，故障描述 ${(maintenanceForm?.fault_description ?? '').slice(0, 50)}${(maintenanceForm?.fault_description?.length || 0) > 50 ? '...' : ''}`
                                : intent === 'transfer'
                                  ? `调配：${maintenanceForm?.asset_code ?? '-'} 调至 ${maintenanceForm?.to_department ?? '-'}，原因 ${(maintenanceForm?.reason ?? maintenanceForm?.transfer_reason ?? '-').slice(0, 30)}${((maintenanceForm?.reason || maintenanceForm?.transfer_reason)?.length || 0) > 30 ? '...' : ''}`
                                  : intent === 'inventory_create'
                                    ? `盘点：单号 ${maintenanceForm?.inventory_no ?? '-'}，日期 ${maintenanceForm?.inventory_date ?? '-'}，类型 ${maintenanceForm?.inventory_type ?? '-'}，盘点人 ${maintenanceForm?.inventory_person ?? '-'}`
                                    : intent === 'maintenance_log'
                                      ? '维修日志（当前表单）'
                                      : `${INTENT_LABELS[intent] || intent}：请确认所填信息`;
                            Modal.confirm({
                              title: '确认提交',
                              content: summary,
                              okText: '确定提交',
                              cancelText: '取消',
                              onOk: () => {
                                if (intent === 'maintenance_log') {
                                  form
                                    .validateFields()
                                    .then(values => handleSubmitByIntent(values, intent));
                                } else {
                                  handleSubmitByIntent(maintenanceForm, intent);
                                }
                              },
                            });
                          }}
                        >
                          提交
                          {context.currentIntent
                            ? INTENT_LABELS[context.currentIntent]
                            : '维修日志'}
                        </Button>
                      ) : (
                        <Text
                          type="secondary"
                          style={{ display: 'block', marginTop: 8, fontSize: 12 }}
                        >
                          请在与 AI 对话中补全必填项后再提交
                        </Text>
                      )}
                    </>
                  )}
                </div>

                {(context.currentIntent === 'maintenance_log' || !context.currentIntent) && (
                  <Collapse
                    defaultActiveKey={[]}
                    destroyInactivePanel={false}
                    items={[
                      {
                        key: 'edit',
                        label: <Text strong>编辑详情（维修日志）</Text>,
                        children: (
                          <>
                            <Form.Item
                              name="asset_code"
                              label="资产编号"
                              rules={[{ required: true, message: '请输入资产编号' }]}
                            >
                              <Input placeholder="请输入资产编号" />
                            </Form.Item>

                            <Form.Item
                              name="maintenance_type"
                              label="维护类型"
                              rules={[{ required: true, message: '请选择维护类型' }]}
                            >
                              <Select placeholder="请选择维护类型">
                                <Option value="故障维修">故障维修</Option>
                                <Option value="定期维护">定期维护</Option>
                                <Option value="预防性维护">预防性维护</Option>
                              </Select>
                            </Form.Item>

                            <Form.Item
                              name="maintenance_date"
                              label="维护日期"
                              rules={[{ required: true, message: '请选择维护日期' }]}
                            >
                              <DatePicker style={{ width: '100%' }} />
                            </Form.Item>

                            <Form.Item
                              name="maintenance_person"
                              label="维护人员"
                              rules={[{ required: true, message: '请输入维护人员' }]}
                            >
                              <Input placeholder="请输入维护人员" />
                            </Form.Item>

                            <Form.Item
                              name="maintenance_content"
                              label="维护内容"
                              rules={[{ required: true, message: '请输入维护内容' }]}
                            >
                              <TextArea rows={4} placeholder="请输入维护内容" />
                            </Form.Item>

                            <Form.Item name="maintenance_cost" label="维护成本">
                              <InputNumber style={{ width: '100%' }} placeholder="请输入维护成本" />
                            </Form.Item>

                            <Form.Item name="maintenance_duration" label="维护时长（小时）">
                              <InputNumber style={{ width: '100%' }} placeholder="请输入维护时长" />
                            </Form.Item>

                            <Form.Item name="maintenance_location" label="维护地点">
                              <Input placeholder="请输入维护地点" />
                            </Form.Item>

                            <Form.Item name="parts_replaced" label="更换部件">
                              <TextArea rows={2} placeholder="请输入更换部件" />
                            </Form.Item>

                            <Form.Item name="status" label="状态">
                              <Select placeholder="请选择状态">
                                <Option value="待分配">待分配</Option>
                                <Option value="已分配">已分配</Option>
                                <Option value="进行中">进行中</Option>
                                <Option value="已完成">已完成</Option>
                              </Select>
                            </Form.Item>

                            <Form.Item name="remark" label="备注">
                              <TextArea rows={2} placeholder="请输入备注" />
                            </Form.Item>

                            <Form.Item style={{ marginBottom: 0 }}>
                              <Space
                                size="middle"
                                direction={isMobile ? 'vertical' : 'horizontal'}
                                style={{ width: '100%', justifyContent: 'flex-end' }}
                              >
                                <Button
                                  block={isMobile}
                                  onClick={() => {
                                    setShowForm(false);
                                    setMaintenanceForm(null);
                                  }}
                                >
                                  取消
                                </Button>
                                <Button
                                  type="primary"
                                  htmlType="submit"
                                  loading={loading}
                                  icon={<CheckCircleOutlined />}
                                  block={isMobile}
                                >
                                  提交
                                  {context.currentIntent
                                    ? INTENT_LABELS[context.currentIntent]
                                    : ''}
                                </Button>
                              </Space>
                            </Form.Item>
                          </>
                        ),
                      },
                    ]}
                  />
                )}
              </Form>
            ) : showAnalysis && analysisResults ? (
              <div style={{ height: 'calc(100% - 40px)', overflowY: 'auto' }}>
                <Card title="维护效率概览" style={{ marginBottom: 16 }}>
                  <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text>总维护次数：</Text>
                      <Text strong>{analysisResults.overview.total_maintenance}</Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text>已完成维护：</Text>
                      <Text strong>{analysisResults.overview.completed_maintenance}</Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text>完成率：</Text>
                      <Text strong>{analysisResults.overview.completion_rate}%</Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text>平均维护时间：</Text>
                      <Text strong>{analysisResults.overview.avg_maintenance_time || 0} 小时</Text>
                    </div>
                  </Space>
                </Card>

                <Card title="按维护类型分析" style={{ marginBottom: 16 }}>
                  {analysisResults.by_maintenance_type.map((item, index) => (
                    <div key={index} style={{ marginBottom: 8 }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          marginBottom: 4,
                        }}
                      >
                        <Text>{item.maintenance_type}</Text>
                        <Text strong>{item.maintenance_count} 次</Text>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Text type="secondary">
                          完成率：
                          {((item.completed_count / item.maintenance_count) * 100).toFixed(2)}%
                        </Text>
                        <Text type="secondary">平均时长：{item.avg_duration || 0} 小时</Text>
                      </div>
                    </div>
                  ))}
                </Card>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <MessageOutlined style={{ fontSize: 48, color: '#ccc', marginBottom: 16 }} />
                <Title level={4} style={{ color: '#666', marginBottom: 12 }}>
                  AI助手
                </Title>
                <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                  查资产、报修、调配、闲置、报废、维修日志
                </Text>
                <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                  直接说需求或资产编号即可
                </Text>
                <div style={{ marginTop: 24 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    示例：报修 00001、调配到科室、查资产
                  </Text>
                </div>
              </div>
            )}
          </Card>
        </div>
      </Space>
    </div>
  );
};

export default AIMaintenanceManager;
