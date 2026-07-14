import React, { useState } from 'react';
import { Card, Space, Button, message, Typography, Divider } from 'antd';
import { ArrowLeftOutlined, FileTextOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import BatchUploader from '../components/BatchUploader';

const { Title, Paragraph } = Typography;

const BatchUploadPage = () => {
  const navigate = useNavigate();
  const [uploadComplete, setUploadComplete] = useState(false);
  const [uploadResults, setUploadResults] = useState([]);

  // 处理上传完成
  const handleUploadComplete = results => {
    setUploadResults(results);
    setUploadComplete(true);

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;

    if (successCount > 0) {
      message.success(`成功上传 ${successCount} 个文件`);
    }
    if (failedCount > 0) {
      message.warning(`有 ${failedCount} 个文件上传失败`);
    }
  };

  // 处理返回
  const handleBack = () => {
    navigate('/');
  };

  // 处理重新上传
  const handleRetry = () => {
    setUploadComplete(false);
    setUploadResults([]);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 页面标题 */}
      <Space className="mb-6">
        <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>
          返回
        </Button>
        <Title level={2} className="m-0">
          资料批量上传
        </Title>
      </Space>

      <Card
        title={
          <Space>
            <FileTextOutlined />
            <span>技术资料批量上传</span>
          </Space>
        }
        className="mb-6"
      >
        <Paragraph>
          支持批量上传技术资料文件，单次最多上传99个文件。上传完成后将进入技术资料库统一管理。
        </Paragraph>
        <Paragraph>
          <strong>支持的文件类型：</strong> 常见文档与图片格式（用于技术资料归档）
        </Paragraph>
        <Paragraph>
          <strong>文件大小限制：</strong> 单个文件不超过100MB
        </Paragraph>

        <Divider />

        {!uploadComplete ? (
          /* 上传组件 */
          <BatchUploader onUploadComplete={handleUploadComplete} maxFiles={99} />
        ) : (
          /* 上传完成结果 */
          <div>
            <div className="mb-4">
              <Title level={4}>上传完成</Title>
              <Paragraph>
                上传结果：成功 {uploadResults.filter(r => r.success).length} 个，失败{' '}
                {uploadResults.filter(r => !r.success).length} 个
              </Paragraph>
            </div>

            {/* 失败文件列表 */}
            {uploadResults.some(r => !r.success) && (
              <div className="mb-4">
                <Title level={5}>失败文件</Title>
                <div className="bg-red-50 p-4 rounded">
                  {uploadResults
                    .filter(r => !r.success)
                    .map((result, index) => (
                      <div key={index} className="mb-2">
                        <span className="text-red-600">{result.file.name}</span>
                        <span className="ml-2 text-gray-600">- {result.error}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* 操作按钮 */}
            <Space>
              <Button type="primary" onClick={handleRetry}>
                重新上传
              </Button>
              <Button onClick={handleBack}>返回首页</Button>
            </Space>
          </div>
        )}
      </Card>
    </div>
  );
};

export default BatchUploadPage;
