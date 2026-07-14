import React, { useState, useEffect } from 'react';
import { Table, Button, message, Modal, Form, Input, Select, Card, Space } from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  PrinterOutlined,
} from '@ant-design/icons';
import { assetLabelAPI } from '../utils/api';
import AssetLabelDesigner from '../components/AssetLabelDesigner';
import { useIsMobile, useCan } from '../hooks';

const { Option } = Select;

const AssetLabelTemplateList = () => {
  const canDelete = useCan('asset', 'delete');
  const canEdit = useCan('asset', 'edit');
  const isMobile = useIsMobile();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [designModalVisible, setDesignModalVisible] = useState(false);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [actionType, setActionType] = useState('create'); // 'create' or 'edit'

  // 获取模板列表
  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const response = await assetLabelAPI.getTemplates();
      setTemplates(response.data || []);
    } catch (error) {
      message.error('获取模板列表失败');
      console.error('Failed to fetch templates:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  // 删除模板
  const handleDelete = id => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除此模板吗？',
      onOk: async () => {
        try {
          await assetLabelAPI.deleteTemplate(id);
          message.success('模板删除成功');
          fetchTemplates();
        } catch (error) {
          message.error('删除模板失败');
          console.error('Failed to delete template:', error);
        }
      },
    });
  };

  // 打开设计器
  const openDesigner = (template = null, type = 'create') => {
    setSelectedTemplate(template);
    setActionType(type);
    setDesignModalVisible(true);
  };

  // 关闭设计器
  const handleDesignerClose = () => {
    setDesignModalVisible(false);
    setSelectedTemplate(null);
  };

  // 保存模板
  const handleSaveTemplate = async templateData => {
    try {
      if (actionType === 'create') {
        await assetLabelAPI.createTemplate(templateData);
        message.success('模板创建成功');
      } else {
        await assetLabelAPI.updateTemplate(selectedTemplate.id, templateData);
        message.success('模板更新成功');
      }
      fetchTemplates();
      handleDesignerClose();
    } catch (error) {
      message.error(actionType === 'create' ? '创建模板失败' : '更新模板失败');
      console.error('Failed to save template:', error);
    }
  };

  const columns = [
    {
      title: '模板名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '模板描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '宽度 (mm)',
      dataIndex: 'width',
      key: 'width',
    },
    {
      title: '高度 (mm)',
      dataIndex: 'height',
      key: 'height',
    },
    {
      title: 'DPI',
      dataIndex: 'dpi',
      key: 'dpi',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: text => new Date(text).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button
            type="primary"
            icon={<EditOutlined />}
            onClick={() => openDesigner(record, 'edit')}
          >
            编辑
          </Button>
          <Button icon={<DeleteOutlined />} danger onClick={() => handleDelete(record.id)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 20, minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      <Card
        title="资产标签模板管理"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => openDesigner(null, 'create')}
          >
            新建模板
          </Button>
        }
        style={{ marginBottom: 20, borderRadius: 8, boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}
      >
        <div className="hide-on-mobile">
          <Table
            columns={columns}
            dataSource={templates}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
            size="middle"
            scroll={{ x: 800 }}
          />
        </div>
        <div className="mobile-table-cards show-on-mobile">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>加载中...</div>
          ) : Array.isArray(templates) && templates.length > 0 ? (
            templates.map(record => (
              <div key={record.id} className="mobile-card-item">
                <div className="mobile-card-header">
                  <span className="mobile-card-title">{record.name}</span>
                </div>
                <div className="mobile-card-body">
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">模板描述</span>
                    <span className="mobile-card-value">{record.description || '-'}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">尺寸</span>
                    <span className="mobile-card-value">{record.width}mm × {record.height}mm</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">DPI</span>
                    <span className="mobile-card-value">{record.dpi || '-'}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">创建时间</span>
                    <span className="mobile-card-value">{new Date(record.created_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>暂无数据</div>
          )}
        </div>
      </Card>

      {/* 标签设计器模态框 */}
      <Modal
        title={actionType === 'create' ? '创建标签模板' : '编辑标签模板'}
        open={designModalVisible}
        onCancel={handleDesignerClose}
        footer={null}
        width="90%"
        style={{ top: 20 }}
        styles={{ body: { padding: 0 } }}
      >
        <AssetLabelDesigner
          template={selectedTemplate}
          onSave={handleSaveTemplate}
          onCancel={handleDesignerClose}
        />
      </Modal>
    </div>
  );
};

export default AssetLabelTemplateList;
