import React from 'react';
import { Card, Button, Space, message } from 'antd';
import { ReloadOutlined, LinkOutlined } from '@ant-design/icons';
import { getBackendUrl } from '../utils/config';

const ApiDocs = () => {
  // 获取后端 API 基础地址
  // 优先使用环境变量，否则根据当前环境自动判断
  // 逻辑统一在 utils/config.js 中处理，避免生产环境出现 localhost 链接
  const resolveBackendUrl = () => getBackendUrl();

  const backendUrl = resolveBackendUrl();
  const apiDocsUrl = `${backendUrl}/api-docs`;
  const apiDocsJsonUrl = `${backendUrl}/api-docs.json`;

  const handleOpenInNewTab = () => {
    window.open(apiDocsUrl, '_blank');
  };

  const handleDownloadJson = async () => {
    try {
      const response = await fetch(apiDocsJsonUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'api-docs.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      message.success('API 文档 JSON 下载成功');
    } catch (error) {
      console.error('下载失败:', error);
      message.error('下载失败');
    }
  };

  return (
    <div>
      <Card
        title="API 文档"
        extra={
          <Space>
            <Button icon={<LinkOutlined />} onClick={handleOpenInNewTab}>
              在新窗口打开
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                const iframe = document.getElementById('swagger-iframe');
                if (iframe) {
                  iframe.contentWindow.location.reload();
                }
              }}
            >
              刷新
            </Button>
          </Space>
        }
      >
        <div
          style={{
            border: '1px solid #d9d9d9',
            borderRadius: 4,
            overflow: 'hidden',
            height: 'calc(100vh - 200px)',
            minHeight: 600,
          }}
        >
          <iframe
            id="swagger-iframe"
            src={apiDocsUrl}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
            }}
            title="API 文档"
          />
        </div>
        <div style={{ marginTop: 16, padding: 12, backgroundColor: '#f5f5f5', borderRadius: 4 }}>
          <p style={{ margin: 0, fontSize: 14, color: '#666' }}>
            <strong>提示：</strong>
            <br />• API 文档地址：
            <a href={apiDocsUrl} target="_blank" rel="noopener noreferrer">
              {apiDocsUrl}
            </a>
            <br />• JSON 格式：
            <a href={apiDocsJsonUrl} target="_blank" rel="noopener noreferrer">
              {apiDocsJsonUrl}
            </a>
            <br />• 如果无法加载，请确保后端服务器正在运行（端口 5183）
          </p>
        </div>
      </Card>
    </div>
  );
};

export default ApiDocs;
