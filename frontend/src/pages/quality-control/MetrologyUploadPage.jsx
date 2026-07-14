import { useState } from 'react';
import { Upload, Button, Card, message, Progress, Typography } from 'antd';
import {
  UploadOutlined,
  FilePdfOutlined,
  FileImageOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
  CloseOutlined,
  ReloadOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import { qualityControlAPI } from '../../utils/api';

const { Text, Title } = Typography;

const MetrologyUploadPage = () => {
  const [uploading, setUploading] = useState(false);
  const [fileList, setFileList] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});
  const [analysisResults, setAnalysisResults] = useState({});
  const [creatingRecord, setCreatingRecord] = useState(false);

  // 文件上传前的验证
  const beforeUpload = file => {
    const isPdfOrImage = file.type === 'application/pdf' || file.type.startsWith('image/');
    if (!isPdfOrImage) {
      message.error('只能上传PDF文件或图像文件!');
      return false;
    }

    // 检查文件数量
    if (fileList.length >= 99) {
      message.error('文件数量不能超过99个');
      return false;
    }

    // 检查文件是否已存在（基于文件名和大小）
    const isExists = fileList.some(
      item => item.name === file.name && item.originFileObj.size === file.size
    );
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
        size: file.size,
        status: 'ready',
        originFileObj: file,
      },
    ]);

    return false; // 阻止自动上传
  };

  // 上传文件并分析单个文件
  const handleAnalyze = async fileItem => {
    try {
      const file = fileItem.originFileObj;

      // 创建表单数据
      const formData = new FormData();
      formData.append('reportFile', file);

      // 重置上传进度
      setUploadProgress(prev => ({
        ...prev,
        [fileItem.uid]: 0,
      }));

      // 上传并分析文件
      const result = await qualityControlAPI.analyzeMetrologyReport(formData, event => {
        if (event.total) {
          const percent = Math.round((event.loaded * 100) / event.total);
          setUploadProgress(prev => ({
            ...prev,
            [fileItem.uid]: percent,
          }));
        }
      });

      if (result.success) {
        message.success(`文件 ${fileItem.name} 分析成功!`);
        setAnalysisResults(prev => ({
          ...prev,
          [fileItem.uid]: result.data,
        }));
        return { success: true, data: result.data };
      } else {
        message.error(`文件 ${fileItem.name} 分析失败: ${result.message || '未知错误'}`);
        return { success: false, error: result.message };
      }
    } catch (error) {
      console.error(`分析文件 ${fileItem.name} 失败:`, error);
      message.error(`文件 ${fileItem.name} 分析失败: ${error.message || '未知错误'}`);
      return { success: false, error: error.message };
    }
  };

  // 批量分析所有文件
  const handleBatchAnalyze = async () => {
    if (fileList.length === 0) {
      message.warning('请选择要分析的文件');
      return;
    }

    if (fileList.length > 99) {
      message.error('文件数量不能超过99个');
      return;
    }

    setUploading(true);
    const results = [];

    try {
      // 逐个分析文件
      for (const fileItem of fileList) {
        const result = await handleAnalyze(fileItem);
        results.push({ file: fileItem, ...result });
      }

      // 分析完成
      const successCount = results.filter(r => r.success).length;
      const failedCount = results.filter(r => !r.success).length;

      if (successCount > 0) {
        message.success(`成功分析 ${successCount} 个文件`);
      }
      if (failedCount > 0) {
        message.warning(`有 ${failedCount} 个文件分析失败`);
      }
    } catch (error) {
      console.error('批量分析失败:', error);
      message.error('批量分析失败');
    } finally {
      setUploading(false);
    }
  };

  // 从分析结果创建计量记录
  const handleCreateRecord = async fileItem => {
    const analysisResult = analysisResults[fileItem.uid];
    if (!analysisResult) {
      message.warning('请先分析报告后再创建记录');
      return;
    }

    setCreatingRecord(true);

    try {
      const formData = new FormData();
      formData.append('reportFile', fileItem.originFileObj);

      const result = await qualityControlAPI.createMetrologyRecordFromFile(formData);

      if (result.success) {
        message.success(`文件 ${fileItem.name} 的计量记录创建成功!`);
        // 可以在这里添加一个标记，表示该文件已经创建了记录
        setFileList(prev =>
          prev.map(item => (item.uid === fileItem.uid ? { ...item, recordCreated: true } : item))
        );
      } else {
        message.error(`文件 ${fileItem.name} 的计量记录创建失败: ${result.message || '未知错误'}`);
      }
    } catch (error) {
      console.error('创建计量记录失败:', error);
      message.error(`文件 ${fileItem.name} 的计量记录创建失败: ${error.message || '未知错误'}`);
    } finally {
      setCreatingRecord(false);
    }
  };

  // 处理文件移除
  const handleRemove = file => {
    setFileList(prev => prev.filter(item => item.uid !== file.uid));
    setUploadProgress(prev => {
      const newProgress = { ...prev };
      delete newProgress[file.uid];
      return newProgress;
    });
    setAnalysisResults(prev => {
      const newResults = { ...prev };
      delete newResults[file.uid];
      return newResults;
    });
  };

  // 清空所有文件
  const handleClearAll = () => {
    setFileList([]);
    setUploadProgress({});
    setAnalysisResults({});
  };

  // 获取文件状态图标
  const getFileStatusIcon = file => {
    const result = analysisResults[file.uid];
    if (result) {
      return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
    }
    if (uploading && uploadProgress[file.uid] !== undefined) {
      return <LoadingOutlined />;
    }
    return null;
  };

  // 获取文件状态文本
  const getFileStatusText = file => {
    const result = analysisResults[file.uid];
    if (result) {
      return '分析成功';
    }
    if (uploading && uploadProgress[file.uid] !== undefined) {
      return `分析中: ${uploadProgress[file.uid]}%`;
    }
    return '待分析';
  };

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4 sm:px-6 lg:px-8">
      <Card className="max-w-7xl mx-auto shadow-lg overflow-hidden">
        {/* 页面头部 */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <Title level={3} className="text-white mb-1">
                计量报告智能识别
              </Title>
              <Text className="text-blue-100">
                上传计量报告(PDF或图像)，系统将自动识别并提取相关信息
              </Text>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="primary"
                ghost
                icon={<ReloadOutlined />}
                className="text-white border-white hover:bg-white hover:text-blue-600"
                onClick={handleClearAll}
                disabled={uploading || fileList.length === 0}
              >
                清空
              </Button>
            </div>
          </div>
        </div>

        {/* 主要内容 */}
        <div className="p-6">
          {/* 上传区域 */}
          <Card
            className="mb-8 border-2 border-dashed border-blue-200 hover:border-blue-400 transition-colors"
            style={{ borderRadius: '8px' }}
          >
            <div className="flex flex-col items-center justify-center p-10">
              <div className="text-blue-500 mb-6">
                <UploadOutlined style={{ fontSize: 64 }} />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">拖放文件到此处上传</h3>
              <p className="text-gray-500 mb-8 text-center max-w-md">
                支持 PDF、JPG、PNG、BMP、GIF 格式文件
                <br />
                单个文件不超过 50MB，最多可上传 99 个文件
              </p>
              <Upload
                multiple={true}
                directory={true}
                name="reportFile"
                accept=".pdf,.jpg,.jpeg,.png,.bmp,.gif"
                beforeUpload={beforeUpload}
                fileList={fileList}
                onRemove={handleRemove}
                className="w-full"
                showUploadList={false}
                disabled={uploading || fileList.length >= 99}
              >
                <Button
                  type="primary"
                  icon={<UploadOutlined />}
                  loading={uploading}
                  disabled={uploading || fileList.length >= 99}
                  size="large"
                  className="w-full max-w-md"
                  style={{ height: '48px', fontSize: '16px' }}
                >
                  {uploading ? '分析中...' : `选择文件或文件夹`}
                </Button>
              </Upload>
            </div>
          </Card>

          {/* 操作区域 */}
          {fileList.length > 0 && (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4 p-4 bg-gray-50 rounded-lg">
              <Text type="secondary" className="font-medium text-lg">
                已选择 <span className="text-blue-600 font-semibold">{fileList.length}</span> / 99
                个文件
              </Text>
              <div className="flex gap-3">
                <Button
                  icon={<ReloadOutlined />}
                  onClick={handleClearAll}
                  disabled={uploading || fileList.length === 0}
                >
                  清空
                </Button>
                <Button
                  type="primary"
                  size="large"
                  icon={<BarChartOutlined />}
                  onClick={handleBatchAnalyze}
                  loading={uploading}
                  disabled={uploading || fileList.length === 0}
                  style={{ minWidth: '160px' }}
                >
                  开始分析
                </Button>
              </div>
            </div>
          )}

          {/* 文件列表 */}
          {fileList.length > 0 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">上传文件列表</h3>
                <Text type="secondary" className="text-sm">
                  {fileList.length} 个文件
                </Text>
              </div>

              <div className="space-y-4">
                {fileList.map(file => (
                  <Card
                    key={file.uid}
                    className="overflow-hidden transition-all hover:shadow-lg border border-gray-100"
                    style={{ borderRadius: '8px' }}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4">
                      {/* 文件信息 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-4">
                          <div className="text-lg">
                            {file.name.endsWith('.pdf') ? (
                              <FilePdfOutlined style={{ color: '#ff4d4f', fontSize: 32 }} />
                            ) : (
                              <FileImageOutlined style={{ color: '#1890ff', fontSize: 32 }} />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <Text className="font-medium truncate" style={{ maxWidth: '300px' }}>
                                {file.name}
                              </Text>
                              <Text
                                type="secondary"
                                className="text-xs bg-gray-100 px-2 py-0.5 rounded"
                              >
                                {(file.size / 1024 / 1024).toFixed(2)}MB
                              </Text>
                              {file.recordCreated && (
                                <Text
                                  type="success"
                                  className="text-xs bg-green-50 px-2 py-0.5 rounded"
                                >
                                  已创建记录
                                </Text>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {getFileStatusIcon(file)}
                              <Text type="secondary" className="text-sm">
                                {getFileStatusText(file)}
                              </Text>
                            </div>
                          </div>
                        </div>

                        {/* 分析进度 */}
                        {uploading && uploadProgress[file.uid] !== undefined && (
                          <Progress
                            percent={uploadProgress[file.uid]}
                            status={uploadProgress[file.uid] === 100 ? 'success' : 'active'}
                            className="mt-4"
                            strokeColor={{
                              from: '#1890ff',
                              to: '#36cfc9',
                            }}
                          />
                        )}

                        {/* 分析结果预览 */}
                        {analysisResults[file.uid] && (
                          <Card
                            size="small"
                            className="mt-4 border border-gray-200"
                            style={{ borderRadius: '6px' }}
                          >
                            <div className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                              <CheckCircleOutlined style={{ color: '#52c41a' }} />
                              分析结果预览
                            </div>
                            <div className="bg-gray-50 p-4 rounded text-xs overflow-auto max-h-40">
                              <pre className="whitespace-pre-wrap break-all">
                                {JSON.stringify(analysisResults[file.uid], null, 2)}
                              </pre>
                            </div>
                          </Card>
                        )}
                      </div>

                      {/* 操作按钮 */}
                      <div className="flex flex-col gap-2 min-w-[140px]">
                        <Button
                          type="primary"
                          size="middle"
                          icon={<CheckCircleOutlined />}
                          onClick={() => handleCreateRecord(file)}
                          disabled={!analysisResults[file.uid] || creatingRecord}
                          style={{ borderRadius: '6px' }}
                        >
                          创建记录
                        </Button>
                        <Button
                          size="middle"
                          danger
                          icon={<CloseOutlined />}
                          onClick={() => handleRemove(file)}
                          disabled={uploading}
                          style={{ borderRadius: '6px' }}
                        >
                          移除
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default MetrologyUploadPage;
