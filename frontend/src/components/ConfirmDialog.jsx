/**
 * 通用确认对话框组件
 * 封装常用的确认操作：删除、警告、危险操作等
 */

import React from 'react';
import { Modal, Button, Space, Typography } from 'antd';
import {
  ExclamationCircleOutlined,
  WarningOutlined,
  DeleteOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

/**
 * 确认对话框类型
 */
export const ConfirmType = {
  DELETE: 'delete',
  WARNING: 'warning',
  DANGER: 'danger',
  INFO: 'info',
  SUCCESS: 'success',
  NORMAL: 'normal',
};

/**
 * 确认对话框配置
 */
const CONFIRM_CONFIG = {
  [ConfirmType.DELETE]: {
    icon: <DeleteOutlined style={{ color: '#ff4d4f', fontSize: 24 }} />,
    color: '#ff4d4f',
    okText: '删除',
    okType: 'primary',
    okDanger: true,
    title: '确认删除',
  },
  [ConfirmType.WARNING]: {
    icon: <WarningOutlined style={{ color: '#faad14', fontSize: 24 }} />,
    color: '#faad14',
    okText: '确定',
    okType: 'primary',
    okDanger: false,
    title: '确认操作',
  },
  [ConfirmType.DANGER]: {
    icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f', fontSize: 24 }} />,
    color: '#ff4d4f',
    okText: '确认',
    okType: 'primary',
    okDanger: true,
    title: '危险操作',
  },
  [ConfirmType.INFO]: {
    icon: <InfoCircleOutlined style={{ color: '#1890ff', fontSize: 24 }} />,
    color: '#1890ff',
    okText: '确定',
    okType: 'primary',
    okDanger: false,
    title: '提示',
  },
  [ConfirmType.SUCCESS]: {
    icon: <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 24 }} />,
    color: '#52c41a',
    okText: '确定',
    okType: 'primary',
    okDanger: false,
    title: '操作成功',
  },
  [ConfirmType.NORMAL]: {
    icon: <ExclamationCircleOutlined style={{ color: '#1890ff', fontSize: 24 }} />,
    color: '#1890ff',
    okText: '确定',
    okType: 'primary',
    okDanger: false,
    title: '确认',
  },
};

/**
 * 确认对话框默认内容
 */
const DEFAULT_CONTENT = {
  [ConfirmType.DELETE]: '确定要删除吗？此操作不可撤销。',
  [ConfirmType.WARNING]: '确定要执行此操作吗？',
  [ConfirmType.DANGER]: '这是一个危险操作，确定要继续吗？',
  [ConfirmType.INFO]: '',
  [ConfirmType.SUCCESS]: '操作已成功完成。',
  [ConfirmType.NORMAL]: '确定要继续吗？',
};

/**
 * 确认对话框组件
 *
 * @param {Object} props
 * @param {boolean} props.open - 是否显示对话框
 * @param {string} props.type - 确认类型
 * @param {string} props.title - 自定义标题
 * @param {string|React.ReactNode} props.content - 确认内容
 * @param {string} props.okText - 确认按钮文本
 * @param {string} props.cancelText - 取消按钮文本
 * @param {Function} props.onOk - 点击确认的回调
 * @param {Function} props.onCancel - 点击取消的回调
 * @param {boolean} props.loading - 确认按钮 loading 状态
 * @param {Object} props.modalProps - Modal 组件的其他 props
 */
const ConfirmDialog = ({
  open,
  type = ConfirmType.NORMAL,
  title,
  content,
  okText,
  cancelText = '取消',
  onOk,
  onCancel,
  loading = false,
  modalProps = {},
}) => {
  const config = CONFIRM_CONFIG[type] || CONFIRM_CONFIG[ConfirmType.NORMAL];
  const defaultContent = DEFAULT_CONTENT[type] || DEFAULT_CONTENT[ConfirmType.NORMAL];

  return (
    <Modal
      open={open}
      title={null}
      footer={null}
      onCancel={onCancel}
      closable={false}
      width={400}
      centered
      {...modalProps}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '24px 16px',
          textAlign: 'center',
        }}
      >
        {/* 图标 */}
        <div style={{ marginBottom: 16 }}>{config.icon}</div>

        {/* 标题 */}
        <Text strong style={{ fontSize: 16, marginBottom: 8, display: 'block' }}>
          {title || config.title}
        </Text>

        {/* 内容 */}
        <Text type="secondary" style={{ marginBottom: 24, display: 'block' }}>
          {content || defaultContent}
        </Text>

        {/* 按钮 */}
        <Space size={16}>
          <Button onClick={onCancel} disabled={loading}>
            {cancelText}
          </Button>
          <Button
            type={config.okType}
            danger={config.okDanger}
            onClick={onOk}
            loading={loading}
          >
            {okText || config.okText}
          </Button>
        </Space>
      </div>
    </Modal>
  );
};

/**
 * 确认对话框快捷方法
 */
export const confirm = (options = {}) => {
  const {
    type = ConfirmType.NORMAL,
    title,
    content,
    okText,
    cancelText = '取消',
    onOk,
    onCancel,
    loading = false,
    modalProps = {},
  } = options;

  // 返回一个 Promise，在对话框关闭时 resolve
  return new Promise((resolve) => {
    const handleOk = () => {
      if (onOk) {
        const result = onOk();
        if (result !== false) {
          resolve(true);
        }
      } else {
        resolve(true);
      }
    };

    const handleCancel = () => {
      if (onCancel) {
        onCancel();
      }
      resolve(false);
    };

    ConfirmDialog({
      open: true,
      type,
      title,
      content,
      okText,
      cancelText,
      onOk: handleOk,
      onCancel: handleCancel,
      loading,
      modalProps: {
        ...modalProps,
        afterClose: () => {
          modalProps.afterClose?.();
        },
      },
    });
  });
};

/**
 * 删除确认对话框
 */
export const confirmDelete = (options = {}) => {
  const { title, content, onOk, ...rest } = options;
  return confirm({
    type: ConfirmType.DELETE,
    title: title || '确认删除',
    content: content || '确定要删除吗？此操作不可撤销。',
    onOk,
    ...rest,
  });
};

/**
 * 警告确认对话框
 */
export const confirmWarning = (options = {}) => {
  const { title, content, onOk, ...rest } = options;
  return confirm({
    type: ConfirmType.WARNING,
    title: title || '确认操作',
    content: content || '确定要执行此操作吗？',
    onOk,
    ...rest,
  });
};

/**
 * 危险操作确认对话框
 */
export const confirmDanger = (options = {}) => {
  const { title, content, onOk, ...rest } = options;
  return confirm({
    type: ConfirmType.DANGER,
    title: title || '危险操作',
    content: content || '这是一个危险操作，确定要继续吗？',
    onOk,
    ...rest,
  });
};

/**
 * 信息提示对话框
 */
export const confirmInfo = (options = {}) => {
  const { title, content, onOk, ...rest } = options;
  return confirm({
    type: ConfirmType.INFO,
    title: title || '提示',
    content: content || '',
    onOk,
    ...rest,
  });
};

/**
 * 成功提示对话框
 */
export const confirmSuccess = (options = {}) => {
  const { title, content, onOk, ...rest } = options;
  return confirm({
    type: ConfirmType.SUCCESS,
    title: title || '操作成功',
    content: content || '操作已成功完成。',
    onOk,
    ...rest,
  });
};

export default ConfirmDialog;
