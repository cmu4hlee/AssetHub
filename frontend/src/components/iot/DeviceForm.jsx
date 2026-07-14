import React from 'react';
import { Form, Input, Select } from 'antd';

const { Option } = Select;

const DeviceForm = ({ form, onFinish, submitLoading, selectedDevice }) => {
  return (
    <Form form={form} layout="vertical" onFinish={onFinish}>
      <Form.Item
        name="device_id"
        label="设备ID"
        rules={[
          { required: true, message: '请输入设备ID' },
          { min: 3, max: 50, message: '设备ID长度应在3-50个字符之间' },
          { pattern: /^[a-zA-Z0-9_-]+$/, message: '设备ID只能包含字母、数字、下划线和连字符' },
        ]}
      >
        <Input placeholder="请输入设备唯一标识" disabled={!!selectedDevice} />
      </Form.Item>
      <Form.Item
        name="device_name"
        label="设备名称"
        rules={[
          { required: true, message: '请输入设备名称' },
          { min: 1, max: 100, message: '设备名称长度应在1-100个字符之间' },
        ]}
      >
        <Input placeholder="请输入设备名称" />
      </Form.Item>
      <Form.Item
        name="device_type"
        label="设备类型"
        rules={[{ required: true, message: '请选择设备类型' }]}
      >
        <Select placeholder="请选择设备类型">
          <Option value="RFID">RFID</Option>
          <Option value="GPS">GPS</Option>
          <Option value="蓝牙">蓝牙</Option>
          <Option value="WiFi">WiFi</Option>
          <Option value="UWB">UWB</Option>
          <Option value="其他">其他</Option>
        </Select>
      </Form.Item>
      <Form.Item
        name="manufacturer"
        label="制造商"
        rules={[{ max: 100, message: '制造商名称长度不能超过100个字符' }]}
      >
        <Input placeholder="请输入制造商" />
      </Form.Item>
      <Form.Item
        name="model"
        label="型号"
        rules={[{ max: 100, message: '型号长度不能超过100个字符' }]}
      >
        <Input placeholder="请输入型号" />
      </Form.Item>
      <Form.Item
        name="serial_number"
        label="序列号"
        rules={[{ max: 100, message: '序列号长度不能超过100个字符' }]}
      >
        <Input placeholder="请输入序列号" />
      </Form.Item>
      <Form.Item
        name="mac_address"
        label="MAC地址"
        rules={[
          {
            pattern: /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/,
            message: '请输入有效的MAC地址格式',
          },
        ]}
      >
        <Input placeholder="请输入MAC地址，例如：00:1B:44:11:3A:B7" />
      </Form.Item>
      <Form.Item
        name="firmware_version"
        label="固件版本"
        rules={[{ max: 50, message: '固件版本长度不能超过50个字符' }]}
      >
        <Input placeholder="请输入固件版本" />
      </Form.Item>
      <Form.Item
        name="status"
        label="状态"
        initialValue="离线"
        rules={[{ required: true, message: '请选择设备状态' }]}
      >
        <Select>
          <Option value="在线">在线</Option>
          <Option value="离线">离线</Option>
          <Option value="故障">故障</Option>
          <Option value="维护中">维护中</Option>
        </Select>
      </Form.Item>
      <Form.Item
        name="remark"
        label="备注"
        rules={[{ max: 500, message: '备注长度不能超过500个字符' }]}
      >
        <Input.TextArea rows={3} placeholder="请输入备注" />
      </Form.Item>
    </Form>
  );
};

export default DeviceForm;
