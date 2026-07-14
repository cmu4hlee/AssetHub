import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal, Button } from 'antd';
import { RobotOutlined } from '@ant-design/icons';

let isModalOpen = false;

const AIAssistantModal = () => {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isModalOpen) {
      isModalOpen = true;
      
      const width = window.screen.width * 0.9;
      const height = window.screen.height * 0.85;
      
      const modal = window.open(
        `${window.location.origin}/ai-assistant`,
        'AIAssistant',
        `width=${Math.round(width)},height=${Math.round(height)},top=50,left=50,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes`
      );
      
      if (modal) {
        modal.focus();
      }
    }
    
    setTimeout(() => {
      navigate(-1);
    }, 100);
  }, [navigate]);

  return null;
};

export default AIAssistantModal;
