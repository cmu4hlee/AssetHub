import React, { useState } from 'react';
import { Modal, Upload, Button, Table, Tag, message, Space, Alert, Typography } from 'antd';
import { UploadOutlined, DownloadOutlined, InboxOutlined } from '@ant-design/icons';
import { qualityControlAPI } from '../../utils/api';

const { Dragger } = Upload;
const { Text } = Typography;

/**
 * 计量证书批量导入弹窗
 * 流程：选择 Excel -> 开始校验（解析 + 资产自动关联 + 校验）-> 预览（已关联/未关联/失败）-> 确认导入 -> 结果
 * “能够关联就关联”：预览阶段即标注每行是「已关联」还是「未关联」，确认后统一入库。
 */
const MetrologyImportModal = ({ open, onClose, onSuccess }) => {
  const [file, setFile] = useState(null);
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [validateResult, setValidateResult] = useState(null);
  const [importResult, setImportResult] = useState(null);

  const resetState = () => {
    setFile(null);
    setValidateResult(null);
    setImportResult(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleDownloadTemplate = async () => {
    try {
      const blob = await qualityControlAPI.getMetrologyImportTemplate();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '计量证书导入模板.xlsx';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    } catch (e) {
      message.error('模板下载失败');
    }
  };

  const handleValidate = async () => {
    if (!file) {
      message.warning('请先选择 Excel 文件');
      return;
    }
    try {
      setValidating(true);
      const res = await qualityControlAPI.validateMetrologyImport(file);
      if (res && res.success) {
        setValidateResult(res);
        if (res.validCount === 0) {
          message.warning('没有可导入的数据，请检查文件内容或表头');
        }
      } else {
        message.error((res && res.message) || '校验失败');
      }
    } catch (e) {
      // 拦截器已提示
    } finally {
      setValidating(false);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    try {
      setImporting(true);
      const res = await qualityControlAPI.importMetrologyRecords(file);
      if (res && res.success) {
        setImportResult(res);
        if (res.successCount > 0) {
          message.success(`成功导入 ${res.successCount} 条`);
          if (onSuccess) onSuccess();
        }
        if (res.failedCount > 0) {
          message.warning(`${res.failedCount} 条导入失败，详见下方列表`);
        }
      } else {
        message.error((res && res.message) || '导入失败');
      }
    } catch (e) {
      // 拦截器已提示
    } finally {
      setImporting(false);
    }
  };

  // 合并「可导入（含关联状态）」与「失败」到一张预览表
  const previewData = validateResult
    ? [
        ...validateResult.preview.map(p => ({
          key: `v-${p.rowNumber}`,
          rowNumber: p.rowNumber,
          certificate_no: p.rowData.certificate_no,
          asset_code: p.rowData.asset_code,
          status: p.association.matched ? '已关联' : '未关联',
          error: '',
        })),
        ...validateResult.failedRows.map(f => ({
          key: `f-${f.rowNumber}`,
          rowNumber: f.rowNumber,
          certificate_no: f.rowData.certificate_no,
          asset_code: f.rowData.asset_code,
          status: '失败',
          error: f.error,
        })),
      ]
    : [];

  const previewColumns = [
    { title: '行号', dataIndex: 'rowNumber', width: 70, fixed: 'left' },
    { title: '证书编号', dataIndex: 'certificate_no', ellipsis: true },
    { title: '资产编码(导入值)', dataIndex: 'asset_code', ellipsis: true, render: v => v || <Text type="secondary">—</Text> },
    {
      title: '关联状态',
      dataIndex: 'status',
      width: 100,
      render: s => {
        if (s === '已关联') return <Tag color="green">已关联</Tag>;
        if (s === '未关联') return <Tag color="orange">未关联</Tag>;
        return <Tag color="red">失败</Tag>;
      },
    },
    { title: '错误信息', dataIndex: 'error', ellipsis: true },
  ];

  const renderBody = () => {
    if (importResult) {
      return (
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Alert
            type={importResult.failedCount > 0 ? 'warning' : 'success'}
            showIcon
            message={`导入完成：成功 ${importResult.successCount} 条（已关联 ${importResult.associatedCount} / 未关联 ${importResult.unassociatedCount}），失败 ${importResult.failedCount} 条`}
          />
          {importResult.failedCount > 0 && (
            <Table
              size="small"
              rowKey="rowNumber"
              columns={previewColumns}
              dataSource={importResult.failedRows.map(f => ({
                key: `if-${f.rowNumber}`,
                rowNumber: f.rowNumber,
                certificate_no: f.rowData.certificate_no,
                asset_code: f.rowData.asset_code,
                status: '失败',
                error: f.error,
              }))}
              pagination={{ pageSize: 8, showTotal: t => `共 ${t} 条失败` }}
              scroll={{ y: 320 }}
            />
          )}
        </Space>
      );
    }

    if (validateResult) {
      return (
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Alert
            type="info"
            showIcon
            message={`共 ${validateResult.totalRows} 条：可导入 ${validateResult.validCount} 条（已关联 ${validateResult.associatedCount} / 未关联 ${validateResult.unassociatedCount}），异常 ${validateResult.invalidCount} 条`}
          />
          <Table
            size="small"
            rowKey="key"
            columns={previewColumns}
            dataSource={previewData}
            pagination={{ pageSize: 10, showTotal: t => `共 ${t} 行` }}
            scroll={{ y: 360, x: 640 }}
          />
        </Space>
      );
    }

    return (
      <Dragger
        accept=".xlsx,.xls"
        maxCount={1}
        beforeUpload={f => {
          setFile(f);
          setValidateResult(null);
          return false;
        }}
        onRemove={() => {
          setFile(null);
          setValidateResult(null);
        }}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">点击或拖拽 Excel 文件到此区域</p>
        <p className="ant-upload-hint">
          仅支持 .xlsx / .xls，需包含「证书编号、计量类型、计量日期」列。系统将自动按资产编码 / 序列号关联资产，匹配不到则作为未关联证书导入。
        </p>
      </Dragger>
    );
  };

  const renderFooter = () => {
    if (importResult) {
      return [
        <Button key="close" type="primary" onClick={handleClose}>
          关闭
        </Button>,
      ];
    }
    if (validateResult) {
      return [
        <Button
          key="back"
          onClick={() => {
            setValidateResult(null);
            setFile(null);
          }}
        >
          重新选择
        </Button>,
        <Button key="import" type="primary" loading={importing} onClick={handleImport}>
          确认导入
        </Button>,
      ];
    }
    return [
      <Button key="tpl" icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>
        下载模板
      </Button>,
      <Button key="cancel" onClick={handleClose}>
        取消
      </Button>,
      <Button key="validate" type="primary" loading={validating} disabled={!file} onClick={handleValidate}>
        开始校验
      </Button>,
    ];
  };

  return (
    <Modal
      title="计量证书批量导入"
      open={open}
      onCancel={handleClose}
      footer={renderFooter()}
      width={780}
      destroyOnHidden
    >
      {renderBody()}
    </Modal>
  );
};

export default MetrologyImportModal;
