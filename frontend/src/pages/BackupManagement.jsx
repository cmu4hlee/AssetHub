import React, { useState, useEffect } from 'react';
import { useCan } from '../hooks';
import {
  Card,
  Table,
  Button,
  Space,
  message,
  Modal,
  Input,
  Popconfirm,
  Tag,
  Tooltip,
  Alert,
  Empty,
} from 'antd';

import {
  ReloadOutlined,
  PlusOutlined,
  DownloadOutlined,
  DeleteOutlined,
  RollbackOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { backupAPI } from '../utils/api';
import dayjs from 'dayjs';
import crypto from '../utils/crypto';
import useIsMobile from '../hooks/useIsMobile';

const { TextArea } = Input;

const BackupManagement = () => {
  const canDelete = useCan('system', 'delete');
  const canEdit = useCan('system', 'edit');
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [backupModalVisible, setBackupModalVisible] = useState(false);
  const [restoreModalVisible, setRestoreModalVisible] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState(null);
  const [backupDescription, setBackupDescription] = useState('');
  const [restoreConfirm, setRestoreConfirm] = useState(false);
  const isMobile = useIsMobile();
  const [mobilePage, setMobilePage] = useState(1);
  const mobilePageSize = 10;

  useEffect(() => {
    loadBackups();
  }, []);

  const loadBackups = async () => {
    setLoading(true);
    try {
      const result = await backupAPI.getBackups();
      if (result.success) {
        setBackups(result.data);
      } else {
        message.error(result.message || '获取备份列表失败');
      }
    } catch (error) {
      console.error('获取备份列表失败:', error);
      message.error(error.response?.data?.message || '获取备份列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    try {
      setLoading(true);
      const result = await backupAPI.createBackup({
        description: backupDescription || null,
      });
      if (result.success) {
        message.success('数据库备份创建成功');
        setBackupModalVisible(false);
        setBackupDescription('');
        loadBackups();
      } else {
        message.error(result.message || '创建备份失败');
      }
    } catch (error) {
      console.error('创建备份失败:', error);
      message.error(error.response?.data?.message || '创建备份失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!restoreConfirm) {
      message.warning('请先确认恢复操作');
      return;
    }

    try {
      setLoading(true);
      const result = await backupAPI.restoreBackup(selectedBackup.id, {
        confirm: true,
      });
      if (result.success) {
        message.success('数据库恢复成功，页面将刷新');
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        message.error(result.message || '恢复失败');
      }
    } catch (error) {
      console.error('恢复失败:', error);
      message.error(error.response?.data?.message || '恢复失败');
    } finally {
      setLoading(false);
      setRestoreModalVisible(false);
      setRestoreConfirm(false);
      setSelectedBackup(null);
    }
  };

  const handleDelete = async id => {
    try {
      const result = await backupAPI.deleteBackup(id);
      if (result.success) {
        message.success('备份删除成功');
        loadBackups();
      } else {
        message.error(result.message || '删除失败');
      }
    } catch (error) {
      console.error('删除失败:', error);
      message.error(error.response?.data?.message || '删除失败');
    }
  };

  const handleDownload = async backup => {
    try {
      // 获取token
      const token = localStorage.getItem('token');

      // 详细检查 token
      if (!token) {
        console.error('[下载备份] Token不存在');
        message.error('请先登录');
        return;
      }

      if (typeof token !== 'string' || token.trim() === '') {
        console.error('[下载备份] Token无效');
        message.error('认证令牌无效，请重新登录');
        await crypto.removeItemAsync('token');
        await crypto.removeItemAsync('user');
        window.location.href = '/login';
        return;
      }

      console.log('[下载备份] 开始下载:', {
        backupId: backup.id,
        fileName: backup.file_name,
        hasToken: !!token,
        tokenLength: token.length,
      });

      // 使用最简单可靠的方式：直接创建带token的下载链接
      // 这种方式最可靠，浏览器会原生处理下载，支持大文件和断点续传
      const encodedToken = encodeURIComponent(token);
      const downloadUrl = `/api/backup/${backup.id}/download?token=${encodedToken}`;

      // 显示提示
      message.info('正在开始下载，请检查浏览器的下载列表...', 2);

      // 方法1：使用 window.open（最简单，浏览器原生处理）
      // 注意：某些浏览器可能会阻止弹窗，所以同时提供方法2
      try {
        const downloadWindow = window.open(downloadUrl, '_blank');

        // 如果 window.open 被阻止，使用备用方法
        if (
          !downloadWindow ||
          downloadWindow.closed ||
          typeof downloadWindow.closed === 'undefined'
        ) {
          console.log('[下载备份] window.open 被阻止，使用备用方法');
          throw new Error('弹窗被阻止');
        }

        // 延迟检查窗口是否被关闭（表示下载已开始）
        setTimeout(() => {
          try {
            if (downloadWindow.closed) {
              message.success('下载已开始');
            }
          } catch (e) {
            // 跨域检查可能失败，这是正常的
            message.success('下载已开始，请检查浏览器的下载列表');
          }
        }, 1000);
      } catch (openError) {
        console.log('[下载备份] window.open 失败，使用 iframe 方法:', openError);

        // 方法2：使用 iframe + 表单提交（兼容性最好）
        const iframe = document.createElement('iframe');
        iframe.name = 'download-iframe-' + Date.now();
        iframe.style.display = 'none';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.position = 'absolute';
        iframe.style.left = '-9999px';
        document.body.appendChild(iframe);

        // 创建隐藏的表单
        const form = document.createElement('form');
        form.method = 'GET';
        form.action = downloadUrl;
        form.target = iframe.name;
        form.style.display = 'none';
        document.body.appendChild(form);

        // 监听iframe加载（用于检测错误）
        iframe.onload = () => {
          setTimeout(() => {
            try {
              // 尝试读取iframe内容（可能因为跨域失败，这是正常的）
              if (iframe.contentDocument && iframe.contentDocument.body) {
                const bodyText = iframe.contentDocument.body.textContent || '';
                try {
                  const errorData = JSON.parse(bodyText);
                  if (errorData.success === false) {
                    message.error(errorData.message || '下载失败');
                    console.error('[下载备份] 服务器返回错误:', errorData);
                  } else {
                    message.success('下载已开始，请检查浏览器的下载列表');
                  }
                } catch (e) {
                  // 不是JSON，可能是下载成功
                  message.success('下载已开始，请检查浏览器的下载列表');
                }
              }
            } catch (e) {
              // 跨域检查失败，通常表示下载已开始
              message.success('下载已开始，请检查浏览器的下载列表');
            }

            // 清理iframe和表单
            setTimeout(() => {
              if (iframe.parentNode) {
                document.body.removeChild(iframe);
              }
              if (form.parentNode) {
                document.body.removeChild(form);
              }
            }, 3000);
          }, 1000);
        };

        // 提交表单，触发下载
        form.submit();
      }
    } catch (error) {
      console.error('[下载备份] 下载失败:', error);
      message.error(error.message || '下载失败，请稍后重试');
    }
  };

  const formatFileSize = bytes => {
    if (!bytes) return '0 B';
    if (typeof bytes === 'string') bytes = parseInt(bytes);
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '文件名',
      dataIndex: 'file_name',
      key: 'file_name',
      width: 300,
      ellipsis: {
        showTitle: false,
      },
      render: text => (
        <Tooltip placement="topLeft" title={text}>
          {text}
        </Tooltip>
      ),
    },
    {
      title: '文件大小',
      dataIndex: 'actual_file_size',
      key: 'file_size',
      width: 120,
      render: (size, record) => (
        <span>{record.actual_file_size_formatted || formatFileSize(size || record.file_size)}</span>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: {
        showTitle: false,
      },
      render: text => (
        <Tooltip placement="topLeft" title={text}>
          {text || '-'}
        </Tooltip>
      ),
    },
    {
      title: '创建人',
      dataIndex: 'created_by',
      key: 'created_by',
      width: 120,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: time => (time ? dayjs(time).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: '状态',
      key: 'status',
      width: 120,
      render: (_, record) => {
        if (!record.file_exists) {
          return <Tag color="error">文件不存在</Tag>;
        }
        if (record.restored_at) {
          return (
            <Tooltip title={`恢复时间: ${dayjs(record.restored_at).format('YYYY-MM-DD HH:mm:ss')}`}>
              <Tag color="success">已恢复</Tag>
            </Tooltip>
          );
        }
        return <Tag color="processing">可用</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 250,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          {record.file_exists && (
            <>
              <Button
                type="link"
                icon={<DownloadOutlined />}
                onClick={() => handleDownload(record)}
              >
                下载
              </Button>
              <Button
                type="link"
                icon={<RollbackOutlined />}
                danger
                onClick={() => {
                  setSelectedBackup(record);
                  setRestoreModalVisible(true);
                }}
              >
                恢复
              </Button>
            </>
          )}
          <Popconfirm
            title="确定要删除这个备份吗？"
            description="删除后无法恢复，请谨慎操作"
            onConfirm={() => handleDelete(record.id)} disabled={!canDelete}
            okText="确定"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button type="link" danger icon={<DeleteOutlined />} disabled={!canDelete}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card
        title="数据库备份管理"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setBackupModalVisible(true)}
          >
            创建备份
          </Button>
        }
      >
        <Space orientation="vertical" style={{ width: '100%' }} size="middle">
          <Alert
            title="备份说明"
            description="数据库备份会保存所有表结构和数据。恢复操作会覆盖现有数据，请谨慎操作。建议定期创建备份。"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <Button icon={<ReloadOutlined />} onClick={loadBackups} block={isMobile}>
              刷新
            </Button>
          </div>

          {/* 桌面端表格 */}
          <div className="hide-on-mobile">
            <Table
              columns={columns}
              dataSource={backups}
              rowKey="id"
              loading={loading}
              pagination={{
                showSizeChanger: true,
                showTotal: total => `共 ${total} 条备份`,
              }}
              scroll={{ x: 1200 }}
            />
          </div>

          {/* 移动端卡片列表 */}
          <div className="mobile-table-cards show-on-mobile">
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>
                加载中...
              </div>
            ) : Array.isArray(backups) && backups.length > 0 ? (
              <>
                {backups
                  .slice((mobilePage - 1) * mobilePageSize, mobilePage * mobilePageSize)
                  .map(record => {
                    let statusColor = 'processing';
                    let statusText = '可用';
                    if (!record.file_exists) {
                      statusColor = 'error';
                      statusText = '文件不存在';
                    } else if (record.restored_at) {
                      statusColor = 'success';
                      statusText = '已恢复';
                    }
                    return (
                      <div key={record.id} className="mobile-card-item">
                        <div className="mobile-card-header">
                          <span className="mobile-card-title">{record.file_name || '-'}</span>
                          <Tag color={statusColor}>{statusText}</Tag>
                        </div>
                        <div className="mobile-card-body">
                          <div className="mobile-card-field">
                            <span className="mobile-card-label">文件大小</span>
                            <span className="mobile-card-value">
                              {record.actual_file_size_formatted ||
                                formatFileSize(
                                  record.actual_file_size || record.file_size
                                )}
                            </span>
                          </div>
                          <div className="mobile-card-field">
                            <span className="mobile-card-label">创建人</span>
                            <span className="mobile-card-value">
                              {record.created_by || '-'}
                            </span>
                          </div>
                          <div className="mobile-card-field">
                            <span className="mobile-card-label">创建时间</span>
                            <span className="mobile-card-value">
                              {record.created_at
                                ? dayjs(record.created_at).format('YYYY-MM-DD HH:mm:ss')
                                : '-'}
                            </span>
                          </div>
                          {record.description && (
                            <div className="mobile-card-field">
                              <span className="mobile-card-label">描述</span>
                              <span className="mobile-card-value">{record.description}</span>
                            </div>
                          )}
                          {record.restored_at && (
                            <div className="mobile-card-field">
                              <span className="mobile-card-label">恢复时间</span>
                              <span className="mobile-card-value">
                                {dayjs(record.restored_at).format('YYYY-MM-DD HH:mm:ss')}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="mobile-card-actions">
                          {record.file_exists && (
                            <>
                              <Button
                                type="primary"
                                size="small"
                                icon={<DownloadOutlined />}
                                onClick={() => handleDownload(record)}
                                block
                              >
                                下载
                              </Button>
                              <Button
                                size="small"
                                icon={<RollbackOutlined />}
                                danger
                                block
                                onClick={() => {
                                  setSelectedBackup(record);
                                  setRestoreModalVisible(true);
                                }}
                              >
                                恢复
                              </Button>
                            </>
                          )}
                          <Popconfirm
                            title="确定要删除这个备份吗？"
                            description="删除后无法恢复，请谨慎操作"
                            onConfirm={() => handleDelete(record.id)} disabled={!canDelete}
                            okText="确定"
                            cancelText="取消"
                            okButtonProps={{ danger: true }}
                          >
                            <Button
                              type="primary"
                              danger
                              size="small"
                              icon={<DeleteOutlined />}
                              block
                            >
                              删除
                            </Button>
                          </Popconfirm>
                        </div>
                      </div>
                    );
                  })}
                {/* 移动端分页 */}
                <div style={{ marginTop: '16px', textAlign: 'center' }}>
                  <Space>
                    <Button
                      disabled={mobilePage === 1}
                      onClick={() => setMobilePage(prev => prev - 1)}
                    >
                      上一页
                    </Button>
                    <span>
                      第 {mobilePage} /{' '}
                      {Math.max(1, Math.ceil(backups.length / mobilePageSize))} 页
                    </span>
                    <Button
                      disabled={
                        mobilePage >= Math.ceil(backups.length / mobilePageSize)
                      }
                      onClick={() => setMobilePage(prev => prev + 1)}
                    >
                      下一页
                    </Button>
                  </Space>
                  <div style={{ marginTop: '8px', color: '#8c8c8c', fontSize: '12px' }}>
                    共 {backups.length} 条
                  </div>
                </div>
              </>
            ) : (
              <Empty description="暂无数据" />
            )}
          </div>
        </Space>
      </Card>

      {/* 创建备份模态框 */}
      <Modal
        title="创建数据库备份"
        open={backupModalVisible}
        onOk={handleCreateBackup}
        onCancel={() => {
          setBackupModalVisible(false);
          setBackupDescription('');
        }}
        confirmLoading={loading}
        okText="创建备份"
        cancelText="取消"
        width={isMobile ? '95vw' : 520}
      >
        <Space orientation="vertical" style={{ width: '100%' }} size="middle">
          <Alert
            title="提示"
            description="创建备份可能需要一些时间，请耐心等待。备份文件将保存在服务器上。"
            type="info"
            showIcon
          />
          <div>
            <label>备份描述（可选）：</label>
            <TextArea
              rows={4}
              value={backupDescription}
              onChange={e => setBackupDescription(e.target.value)}
              placeholder="请输入备份描述，例如：定期备份、更新前备份等"
              maxLength={500}
              showCount
            />
          </div>
        </Space>
      </Modal>

      {/* 恢复备份模态框 */}
      <Modal
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
            <span>恢复数据库备份</span>
          </Space>
        }
        open={restoreModalVisible}
        onOk={handleRestore}
        onCancel={() => {
          setRestoreModalVisible(false);
          setRestoreConfirm(false);
          setSelectedBackup(null);
        }}
        confirmLoading={loading}
        okText="确认恢复"
        cancelText="取消"
        okButtonProps={{ danger: true }}
        width={isMobile ? '95vw' : 520}
      >
        {selectedBackup && (
          <Space orientation="vertical" style={{ width: '100%' }} size="large">
            <Alert
              title="警告"
              description="恢复操作会覆盖现有数据库中的所有数据，此操作不可逆！请确保已做好数据备份。"
              type="error"
              showIcon
            />
            <div>
              <p>
                <strong>备份文件：</strong>
                {selectedBackup.file_name}
              </p>
              <p>
                <strong>文件大小：</strong>
                {selectedBackup.actual_file_size_formatted ||
                  formatFileSize(selectedBackup.file_size)}
              </p>
              <p>
                <strong>创建时间：</strong>
                {dayjs(selectedBackup.created_at).format('YYYY-MM-DD HH:mm:ss')}
              </p>
              {selectedBackup.description && (
                <p>
                  <strong>描述：</strong>
                  {selectedBackup.description}
                </p>
              )}
            </div>
            <div>
              <label>
                <input
                  type="checkbox"
                  checked={restoreConfirm}
                  onChange={e => setRestoreConfirm(e.target.checked)}
                  style={{ marginRight: 8 }}
                />
                我已了解恢复操作的风险，确认要恢复此备份
              </label>
            </div>
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default BackupManagement;
