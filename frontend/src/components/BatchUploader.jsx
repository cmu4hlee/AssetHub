import React, { useState } from 'react';
import { Upload, Button, Progress, List, Space, message, Modal, Tooltip } from 'antd';
import {
  UploadOutlined,
  CloseOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { technicalDocumentsAPI } from '../utils/api';

const { confirm } = Modal;

const BatchUploader = ({ onUploadComplete, maxFiles = 99, assetCode = null }) => {
  const [fileList, setFileList] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [uploadResults, setUploadResults] = useState({});
  const [analysisProgress, setAnalysisProgress] = useState({});

  // 处理文件选择
  const handleBeforeUpload = file => {
    // 检查文件大小
    const isLt100M = file.size / 1024 / 1024 < 100;
    if (!isLt100M) {
      message.error('文件大小不能超过100MB');
      return false;
    }

    // 检查文件数量
    if (fileList.length >= maxFiles) {
      message.error(`文件数量不能超过${maxFiles}个`);
      return false;
    }

    // 检查文件是否已存在
    const isExists = fileList.some(item => item.name === file.name);
    if (isExists) {
      message.warning(`文件 ${file.name} 已存在`);
      return false;
    }

    // 添加到文件列表
    setFileList(prev => [
      ...prev,
      {
        uid: file.uid,
        name: file.name,
        status: 'ready',
        originFileObj: file,
      },
    ]);

    return false; // 阻止自动上传
  };

  // 处理文件移除
  const handleRemove = file => {
    confirm({
      title: '确认移除',
      content: `确定要移除文件 ${file.name} 吗？`,
      onOk: () => {
        setFileList(prev => prev.filter(item => item.uid !== file.uid));
        setUploadProgress(prev => {
          const newProgress = { ...prev };
          delete newProgress[file.uid];
          return newProgress;
        });
        setUploadResults(prev => {
          const newResults = { ...prev };
          delete newResults[file.uid];
          return newResults;
        });
        setAnalysisProgress(prev => {
          const newProgress = { ...prev };
          delete newProgress[file.uid];
          return newProgress;
        });
      },
    });
  };

  // 处理批量上传
  const handleBatchUpload = async () => {
    if (fileList.length === 0) {
      message.warning('请选择要上传的文件');
      return;
    }

    if (fileList.length > maxFiles) {
      message.error(`文件数量不能超过${maxFiles}个`);
      return;
    }

    try {
      setUploading(true);
      const results = [];

      // 逐个上传文件
      for (const fileItem of fileList) {
        const file = fileItem.originFileObj;

        // 重置上传状态
        setUploadProgress(prev => ({
          ...prev,
          [fileItem.uid]: 0,
        }));
        setAnalysisProgress(prev => ({
          ...prev,
          [fileItem.uid]: 0,
        }));

        try {
          // 上传文件
          const formData = new FormData();
          formData.append('file', file);
          formData.append('originalFileName', encodeURIComponent(file.name));
          formData.append('title', file.name);
          formData.append('description', '批量上传技术资料');
          formData.append('category', '其他');
          if (assetCode) {
            formData.append('asset_code', assetCode);
          }

          // 模拟上传进度
          const progressInterval = setInterval(() => {
            setUploadProgress(prev => {
              const currentProgress = prev[fileItem.uid] || 0;
              if (currentProgress < 90) {
                return {
                  ...prev,
                  [fileItem.uid]: currentProgress + 10,
                };
              }
              return prev;
            });
          }, 200);

          // 实际上传
          const uploadResult = await technicalDocumentsAPI.uploadTechnicalDocument(formData);

          clearInterval(progressInterval);
          setUploadProgress(prev => ({
            ...prev,
            [fileItem.uid]: 100,
          }));

          if (uploadResult.success) {
            // 模拟分析过程
            setAnalysisProgress(prev => ({
              ...prev,
              [fileItem.uid]: 0,
            }));

            const analysisInterval = setInterval(() => {
              setAnalysisProgress(prev => {
                const currentProgress = prev[fileItem.uid] || 0;
                if (currentProgress < 100) {
                  return {
                    ...prev,
                    [fileItem.uid]: currentProgress + 20,
                  };
                }
                clearInterval(analysisInterval);
                return prev;
              });
            }, 100);

            // 等待分析完成
            await new Promise(resolve => setTimeout(resolve, 1000));

            setUploadResults(prev => ({
              ...prev,
              [fileItem.uid]: { success: true, data: uploadResult.data },
            }));
            results.push({ success: true, file: fileItem, data: uploadResult.data });
          } else {
            setUploadResults(prev => ({
              ...prev,
              [fileItem.uid]: { success: false, error: uploadResult.message },
            }));
            results.push({ success: false, file: fileItem, error: uploadResult.message });
          }
        } catch (error) {
          setUploadResults(prev => ({
            ...prev,
            [fileItem.uid]: { success: false, error: error.message },
          }));
          results.push({ success: false, file: fileItem, error: error.message });
        }
      }

      setUploading(false);
      message.success(
        `批量上传完成，成功 ${results.filter(r => r.success).length} 个，失败 ${results.filter(r => !r.success).length} 个`
      );

      if (onUploadComplete) {
        onUploadComplete(results);
      }
    } catch (error) {
      setUploading(false);
      message.error('批量上传失败');
      console.error('批量上传失败:', error);
    }
  };

  // 清空所有文件
  const handleClearAll = () => {
    confirm({
      title: '确认清空',
      content: '确定要清空所有文件吗？',
      onOk: () => {
        setFileList([]);
        setUploadProgress({});
        setUploadResults({});
        setAnalysisProgress({});
      },
    });
  };

  // 获取文件状态图标
  const getFileStatusIcon = file => {
    const result = uploadResults[file.uid];
    if (result) {
      return result.success ? (
        <CheckCircleOutlined style={{ color: '#52c41a' }} />
      ) : (
        <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
      );
    }
    if (uploading && uploadProgress[file.uid] !== undefined) {
      return <LoadingOutlined />;
    }
    return null;
  };

  // 获取文件状态文本
  const getFileStatusText = file => {
    const result = uploadResults[file.uid];
    if (result) {
      return result.success ? '上传成功' : `上传失败: ${result.error}`;
    }
    if (uploading && uploadProgress[file.uid] !== undefined) {
      return `上传中: ${uploadProgress[file.uid]}%`;
    }
    if (analysisProgress[file.uid] !== undefined && analysisProgress[file.uid] > 0) {
      return `分析中: ${analysisProgress[file.uid]}%`;
    }
    return '待上传';
  };

  return (
    <div>
      {/* 上传区域 */}
      <Upload
        multiple={true}
        directory={true}
        beforeUpload={handleBeforeUpload}
        fileList={fileList}
        onRemove={handleRemove}
        customRequest={() => {}}
        className="mb-4"
      >
        <Button
          icon={<UploadOutlined />}
          loading={uploading}
          disabled={uploading || fileList.length >= maxFiles}
        >
          {uploading ? '上传中...' : `选择文件或文件夹 (可多选，最多${maxFiles}个)`}
        </Button>
      </Upload>

      {/* 操作按钮 */}
      <Space className="mb-4">
        <Button
          type="primary"
          onClick={handleBatchUpload}
          loading={uploading}
          disabled={uploading || fileList.length === 0}
        >
          开始上传
        </Button>
        <Button onClick={handleClearAll} disabled={uploading || fileList.length === 0}>
          清空
        </Button>
      </Space>

      {/* 文件数量提示 */}
      <div className="mb-4 text-gray-500">
        已选择 {fileList.length} / {maxFiles} 个文件
      </div>

      {/* 文件列表 */}
      {fileList.length > 0 && (
        <div className="space-y-4">
          {fileList.map(file => (
            <div key={file.uid} className="border rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center">
                  <div className="mr-3">{getFileStatusIcon(file)}</div>
                  <div>
                    <div className="flex items-center">
                      <span>{file.name}</span>
                      <span className="ml-2 text-sm text-gray-500">
                        ({(file.size / 1024 / 1024).toFixed(2)}MB)
                      </span>
                    </div>
                    <div className="text-sm text-gray-500">{getFileStatusText(file)}</div>
                  </div>
                </div>
                <Tooltip title="移除">
                  <Button
                    icon={<CloseOutlined />}
                    size="small"
                    danger
                    onClick={() => handleRemove(file)}
                    disabled={uploading}
                  />
                </Tooltip>
              </div>
              {/* 上传进度 */}
              {uploading && uploadProgress[file.uid] !== undefined && (
                <Progress
                  percent={uploadProgress[file.uid]}
                  size="small"
                  status={uploadProgress[file.uid] === 100 ? 'success' : 'active'}
                  className="mt-2"
                />
              )}
              {/* 分析进度 */}
              {analysisProgress[file.uid] !== undefined && analysisProgress[file.uid] > 0 && (
                <Progress
                  percent={analysisProgress[file.uid]}
                  size="small"
                  status="active"
                  format={percent => `分析中: ${percent}%`}
                  className="mt-2"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BatchUploader;
