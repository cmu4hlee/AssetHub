import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Select, Space, Spin, Tag, Tooltip, Typography, message } from 'antd';
import {
  DatabaseOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  LinkOutlined,
  RobotOutlined,
  SearchOutlined,
  SyncOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useCurrentUser } from '../hooks';
import AssetAIAnalysis from './AssetAIAnalysis';
import AIMaintenanceManager from './AIMaintenanceManager';
import TechnicalDocumentsAI from './TechnicalDocumentsAI';
import AIQuestionRecords from './AIQuestionRecords';

const { Title, Text } = Typography;
const { Option } = Select;

const AI_MODES = [
  {
    key: 'sqlbot',
    label: '本地AI分析',
    icon: <DatabaseOutlined />,
    color: '#1890ff',
    route: '/asset-ai-analysis',
    component: AssetAIAnalysis,
  },
  {
    key: 'documents',
    label: '文档智能助手',
    icon: <FileTextOutlined />,
    color: '#52c41a',
    route: '/technical-documents/ai',
    component: TechnicalDocumentsAI,
  },
  {
    key: 'maintenance',
    label: '维修AI助手',
    icon: <ToolOutlined />,
    color: '#faad14',
    route: '/ai-maintenance',
    component: AIMaintenanceManager,
  },
  {
    key: 'search',
    label: '智能搜索',
    icon: <SearchOutlined />,
    color: '#722ed1',
    route: '/ai-question-records',
    component: AIQuestionRecords,
  },
];

const getModeConfig = mode => AI_MODES.find(item => item.key === mode) || AI_MODES[0];

const getInitialAuthState = (isAuthenticated, currentUser) => {
  if (!isAuthenticated || !currentUser) {
    return {
      ready: false,
      level: 'warning',
      message: '请先登录系统',
    };
  }

  return { ready: true };
};

const AssetAIAssistant = () => {
  const navigate = useNavigate();
  const { user: currentUser, isAuthenticated } = useCurrentUser();
  const containerRef = useRef(null);
  const [authState, setAuthState] = useState({ ready: false });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedMode, setSelectedMode] = useState('sqlbot');
  const [refreshSeed, setRefreshSeed] = useState(0);
  const ready = authState.ready;

  useEffect(() => {
    const state = getInitialAuthState(isAuthenticated, currentUser);
    setAuthState(state);
  }, [isAuthenticated, currentUser]);

  useEffect(() => {
    if (!authState.ready) {
      message[authState.level]?.(authState.message);
      navigate('/login', { replace: true });
    }
  }, [authState, navigate]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const handleRefresh = () => {
    setRefreshSeed(prev => prev + 1);
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await containerRef.current?.requestFullscreen?.();
      } else {
        await document.exitFullscreen?.();
      }
    } catch (error) {
      console.error('切换全屏失败:', error);
      message.error('切换全屏失败');
    }
  };

  const openInNewTab = () => {
    const modeConfig = getModeConfig(selectedMode);
    window.open(`${window.location.origin}${modeConfig.route}`, '_blank', 'noopener,noreferrer');
  };

  if (!ready) {
    return (
      <div
        style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}
      >
        <Spin size="large" description="正在初始化AI助手..." />
      </div>
    );
  }

  const modeConfig = getModeConfig(selectedMode);
  const CurrentModeComponent = modeConfig.component;

  return (
    <div
      ref={containerRef}
      style={{
        minHeight: 'calc(100vh - 140px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <Card styles={{ body: { padding: 16 } }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Tooltip title="切换AI分析模式">
              <RobotOutlined style={{ fontSize: 20, color: '#1890ff' }} />
            </Tooltip>
            <Title level={4} style={{ margin: 0 }}>
              {modeConfig.label}
            </Title>
            <Select
              value={selectedMode}
              onChange={setSelectedMode}
              style={{ width: 160 }}
              options={AI_MODES.map(item => ({
                label: (
                  <Space>
                    {item.icon}
                    {item.label}
                  </Space>
                ),
                value: item.key,
              }))}
            />
          </div>

          <Space>
            <Tooltip title="刷新">
              <Button icon={<SyncOutlined />} onClick={handleRefresh} />
            </Tooltip>
            <Tooltip title="全屏">
              <Button
                icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                onClick={toggleFullscreen}
              />
            </Tooltip>
            <Tooltip title="在新标签页中打开">
              <Button icon={<LinkOutlined />} onClick={openInNewTab} />
            </Tooltip>
          </Space>
        </div>
      </Card>

      <CurrentModeComponent key={`${selectedMode}-${refreshSeed}`} />
    </div>
  );
};

export default AssetAIAssistant;
