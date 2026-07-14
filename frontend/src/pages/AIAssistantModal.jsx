import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Modal,
  Button,
  Space,
  message,
} from 'antd';

import {
  RobotOutlined,
  FullscreenOutlined,
  CloseOutlined,
} from '@ant-design/icons';

const AIAssistantModal = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const openInNewTab = () => {
    window.open(`${window.location.origin}/ai-assistant`, '_blank');
  };

  const openFullscreen = () => {
    const width = window.screen.width;
    const height = window.screen.height;
    window.open(
      `${window.location.origin}/ai-assistant`,
      'AIAssistant',
      `width=${width},height=${height},top=0,left=0,menubar=no,toolbar=no,location=no,status=no`
    );
  };

  return (
    <>
      <Button
        type="primary"
        icon={<RobotOutlined />}
        onClick={handleOpen}
      >
        打开AI助手
      </Button>

      <Modal
        title={
          <Space>
            <RobotOutlined />
            <span>资产AI助手</span>
          </Space>
        }
        open={open}
        onCancel={handleClose}
        footer={[
          <Button key="newtab" onClick={openInNewTab}>
            新窗口打开
          </Button>,
          <Button key="fullscreen" type="primary" icon={<FullscreenOutlined />} onClick={openFullscreen}>
            全屏模式
          </Button>,
          <Button key="close" onClick={handleClose}>
            关闭
          </Button>,
        ]}
        width="90vw"
        style={{ top: 20 }}
        styles={{ body: {
          padding: 0,
          height: 'calc(80vh - 100px)',
          overflow: 'hidden',
        } }}
        destroyOnHidden
      >
        <iframe
          src={`${window.location.origin}/ai-assistant`}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            background: '#fff',
          }}
          title="资产AI助手"
        />
      </Modal>
    </>
  );
};

export default AIAssistantModal;
