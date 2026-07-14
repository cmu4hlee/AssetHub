import React, { useState, useEffect } from 'react';
import {
  Form,
  Select,
  Button,
  Table,
  Card,
  Space,
  message,
  Modal,
  Tabs,
  Input,
  InputNumber,
  Divider,
  Row,
  Col,
  Tag,
  Checkbox,
  Empty,
} from 'antd';

import {
  PrinterOutlined,
  EyeOutlined,
  SettingOutlined,
  DownloadOutlined,
  DeleteOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { assetLabelAPI, assetAPI } from '../utils/api';
import LabelPreview from '../components/LabelPreview';
import useIsMobile from '../hooks/useIsMobile';

const { Option } = Select;

const AssetLabelPrint = () => {
  const isMobile = useIsMobile();
  const [form] = Form.useForm();
  const [templates, setTemplates] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedAssetIds, setSelectedAssetIds] = useState([]);
  const [assetListLoading, setAssetListLoading] = useState(false);
  const [printModalVisible, setPrintModalVisible] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [assetSearchText, setAssetSearchText] = useState('');
  const [previewVisible, setPreviewVisible] = useState(false);
  const [printerConfig, setPrinterConfig] = useState({
    ip: localStorage.getItem('printer_ip') || '',
    port: parseInt(localStorage.getItem('printer_port')) || 9100,
    quantity: 1,
  });
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [previewScale, setPreviewScale] = useState(1);
  // 新增：部门相关状态
  const [departments, setDepartments] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [selectAllAssetsInDepartment, setSelectAllAssetsInDepartment] = useState(false);

  // 使用类型转换进行id匹配，确保数字和字符串id都能正确匹配，并去除重复值
  const selectedAssets = Array.from(
    new Map(
      selectedAssetIds
        .map(id => assets.find(asset => asset.id == id))
        .filter(Boolean)
        .map(asset => [asset.id, asset])
    ).values()
  );

  const fetchTemplates = async () => {
    try {
      const response = await assetLabelAPI.getTemplates();
      // 解析模板的elements字段，将JSON字符串转换为对象数组
      const parsedTemplates = (response.data || []).map(template => ({
        ...template,
        elements:
          typeof template.elements === 'string'
            ? JSON.parse(template.elements)
            : template.elements || [],
      }));
      setTemplates(parsedTemplates);
    } catch (error) {
      message.error('获取模板列表失败');
      console.error('Failed to fetch templates:', error);
    }
  };

  // 获取部门列表
  const fetchDepartments = async () => {
    try {
      const response = await assetAPI.getDepartments();
      setDepartments(response.data || []);
    } catch (error) {
      message.error('获取部门列表失败');
      console.error('Failed to fetch departments:', error);
    }
  };

  // 修改fetchAssets函数，支持按部门过滤
  const fetchAssets = async (keyword = '', department = null) => {
    setAssetListLoading(true);
    try {
      const params = {
        keyword,
        page: 1,
        pageSize: 100,
      };

      // 如果指定了部门，添加部门过滤参数
      if (department) {
        params.department = department;
      }

      const response = await assetAPI.getAssets(params);
      // API返回的是包含data字段的对象
      const assetsData = response.data || [];
      setAssets(assetsData);

      // 如果启用了"选择部门所有资产"，则自动选择该部门所有资产
      if (department && selectAllAssetsInDepartment) {
        const departmentAssetIds = assetsData.map(asset => asset.id);
        setSelectedAssetIds(departmentAssetIds);
        message.success(`已自动选择 ${departmentAssetIds.length} 个资产`);
      }
    } catch (error) {
      message.error('获取资产列表失败');
      console.error('Failed to fetch assets:', error);
    } finally {
      setAssetListLoading(false);
    }
  };

  // 处理部门选择变化
  const handleDepartmentChange = department => {
    setSelectedDepartment(department);
    fetchAssets(assetSearchText, department);
  };

  // 处理"选择部门所有资产"选项变化
  const handleSelectAllChange = e => {
    const checked = e.target.checked;
    setSelectAllAssetsInDepartment(checked);

    // 如果已选择部门，立即应用选择
    if (selectedDepartment) {
      fetchAssets(assetSearchText, selectedDepartment);
    }
  };

  useEffect(() => {
    fetchTemplates();
    fetchDepartments();
    fetchAssets();
  }, []);

  const handleTemplateChange = templateId => {
    const template = templates.find(t => t.id === templateId);
    // 确保模板的elements字段已被解析
    const parsedTemplate = {
      ...template,
      elements:
        typeof template.elements === 'string'
          ? JSON.parse(template.elements)
          : template.elements || [],
    };
    setSelectedTemplate(parsedTemplate);
  };
  // 处理资产搜索
  const handleAssetSearch = value => {
    setAssetSearchText(value);
    fetchAssets(value, selectedDepartment);
  };

  // 处理资产编号范围选择
  const handleRangeSelect = async () => {
    try {
      const rangeInput = document.getElementById('assetCodeRange');
      if (!rangeInput) return;

      const rangeText = rangeInput.value.trim();
      if (!rangeText) {
        message.error('请输入资产编号范围');
        return;
      }

      // 解析范围格式：1000-5000 或 1000~5000
      const rangeRegex = /^(\d+)[-~](\d+)$/;
      const match = rangeText.match(rangeRegex);

      if (!match) {
        message.error('范围格式不正确，请使用 1000-5000 或 1000~5000 格式');
        return;
      }

      const start = parseInt(match[1]);
      const end = parseInt(match[2]);

      if (start > end) {
        message.error('起始编号不能大于结束编号');
        return;
      }

      setLoading(true);

      // 由于后端暂未实现按范围查询API，先显示提示信息
      message.info('资产编号范围选择功能正在开发中，请使用其他方式选择资产');
    } catch (error) {
      message.error('获取资产失败');
      console.error('Failed to get assets by range:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = async () => {
    try {
      const values = await form.validateFields();
      const template_id = values.template_id;

      if (selectedAssets.length === 0) {
        message.error('请选择至少一个资产');
        return;
      }

      if (!printerConfig.ip) {
        message.error('请先配置打印机');
        setConfigModalVisible(true);
        return;
      }

      setLoading(true);

      const assetIds = selectedAssets.map(asset => asset.id);
      const response = await assetLabelAPI.printZPL(
        assetIds[0],
        template_id,
        printerConfig.ip,
        printerConfig.port,
        printerConfig.quantity
      );

      if (response.success) {
        message.success('打印任务已发送');
        setPrintModalVisible(false);
      } else {
        message.error(`打印失败: ${response.message}`);
      }
    } catch (error) {
      message.error('打印失败');
      console.error('Failed to print:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBatchPrint = async () => {
    try {
      const values = await form.validateFields();
      const template_id = values.template_id;

      if (selectedAssets.length === 0) {
        message.error('请选择至少一个资产');
        return;
      }

      if (!printerConfig.ip) {
        message.error('请先配置打印机');
        setConfigModalVisible(true);
        return;
      }

      setLoading(true);

      let successCount = 0;
      let failCount = 0;

      for (const asset of selectedAssets) {
        try {
          const response = await assetLabelAPI.printZPL(
            asset.id,
            template_id,
            printerConfig.ip,
            printerConfig.port,
            1
          );

          if (response.success) {
            successCount++;
          } else {
            failCount++;
          }

          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          failCount++;
          console.error('Failed to print asset:', asset.id, error);
        }
      }

      if (failCount === 0) {
        message.success(`批量打印成功，共打印 ${successCount} 个标签`);
      } else {
        message.warning(`批量打印完成，成功 ${successCount} 个，失败 ${failCount} 个`);
      }

      setPrintModalVisible(false);
    } catch (error) {
      message.error('批量打印失败');
      console.error('Failed to batch print:', error);
    } finally {
      setLoading(false);
    }
  };

  const openPrintModal = async () => {
    try {
      const values = await form.validateFields();
      if (selectedAssets.length === 0) {
        message.error('请选择至少一个资产');
        return;
      }
      setPrintModalVisible(true);
    } catch (error) {
      message.error('请选择模板');
    }
  };

  const openPreview = async () => {
    try {
      const values = await form.validateFields();

      // 增强调试：显示完整的资产选择状态
      console.log('=== 资产选择调试信息 ===');
      console.log(
        '1. selectedAssetIds:',
        selectedAssetIds,
        '类型:',
        Array.isArray(selectedAssetIds)
          ? selectedAssetIds.map(id => typeof id)
          : typeof selectedAssetIds
      );
      console.log('2. assets数组长度:', assets.length);
      console.log('3. assets数组前3个资产:', assets.slice(0, 3));
      if (assets.length > 0) {
        console.log('4. 第一个资产的id类型:', typeof assets[0].id, '值:', assets[0].id);
        console.log('5. 第一个资产的asset_code:', assets[0].asset_code);
        console.log('6. 第一个资产的字段列表:', Object.keys(assets[0]));
      }

      // 手动计算selectedAssets，查看匹配情况
      const manualSelectedAssets = selectedAssetIds
        .map(id => {
          const asset = assets.find(asset => {
            // 尝试id匹配，考虑类型转换
            const match = asset.id == id; // 使用==进行类型转换匹配
            console.log(
              `尝试匹配id: ${id} (${typeof id}) 与资产id: ${asset.id} (${typeof asset.id}) => ${match}`
            );
            return match;
          });
          return asset;
        })
        .filter(Boolean);

      console.log('7. 手动计算的selectedAssets长度:', manualSelectedAssets.length);

      if (manualSelectedAssets.length === 0) {
        message.error('请选择至少一个资产');
        return;
      }

      // 调试：显示选中的资产和模板信息
      console.log('=== 标签预览调试信息 ===');
      console.log('选中的资产数量:', manualSelectedAssets.length);
      if (manualSelectedAssets.length > 0) {
        console.log('第一个资产数据:', manualSelectedAssets[0]);
        console.log('资产字段列表:', Object.keys(manualSelectedAssets[0]));
      }
      console.log('选中的模板:', selectedTemplate);
      if (selectedTemplate) {
        console.log('模板元素:', selectedTemplate.elements);
      }
      console.log('==========================');

      setPreviewVisible(true);
    } catch (error) {
      console.error('openPreview错误:', error);
      message.error('请选择模板');
    }
  };

  const savePrinterConfig = () => {
    localStorage.setItem('printer_ip', printerConfig.ip);
    localStorage.setItem('printer_port', printerConfig.port.toString());
    message.success('打印机配置已保存');
    setConfigModalVisible(false);
  };

  const columns = [
    {
      title: '资产编号',
      dataIndex: 'asset_code',
      key: 'asset_code',
      width: 150,
    },
    {
      title: '资产名称',
      dataIndex: 'asset_name',
      key: 'asset_name',
      width: 200,
    },
    {
      title: '资产分类',
      dataIndex: 'category_name',
      key: 'category_name',
      width: 120,
    },
    {
      title: '使用部门',
      dataIndex: 'department',
      key: 'department',
      width: 120,
    },
    {
      title: '使用人',
      dataIndex: 'responsible_person',
      key: 'responsible_person',
      width: 100,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
    },
    {
      title: '选择状态',
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <Tag color={selectedAssetIds.includes(record.id) ? 'green' : 'default'}>
          {selectedAssetIds.includes(record.id) ? '已选择' : '未选择'}
        </Tag>
      ),
    },
  ];

  return (
    <div style={{ padding: 20 }}>
      <Card
        title="资产标签打印"
        extra={
          <Space orientation={isMobile ? 'vertical' : 'horizontal'}>
            <Button icon={<SettingOutlined />} block={isMobile} onClick={() => setConfigModalVisible(true)}>
              打印机配置
            </Button>
            <Button
              icon={<EyeOutlined />}
              block={isMobile}
              onClick={openPreview}
              disabled={!selectedTemplate || selectedAssets.length === 0}
            >
              预览标签
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" style={{ marginBottom: 20 }}>
          <Form.Item
            name="template_id"
            label="选择模板"
            rules={[{ required: true, message: '请选择模板' }]}
          >
            <Select placeholder="请选择模板" onChange={handleTemplateChange} style={{ width: isMobile ? '100%' : 300 }}>
              {templates.map(template => (
                <Option key={template.id} value={template.id}>
                  {template.name} ({template.width}mm × {template.height}mm)
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item label="选择部门">
            <Space orientation="vertical" style={{ width: '100%', marginBottom: 10 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <Select
                  placeholder="请选择部门"
                  style={{ flex: 1 }}
                  value={selectedDepartment}
                  onChange={handleDepartmentChange}
                >
                  <Option value={null}>全部部门</Option>
                  {departments.map(department => (
                    <Option key={department.department_code} value={department.department_code}>
                      {department.department_name} ({department.department_code})
                    </Option>
                  ))}
                </Select>
                <Checkbox checked={selectAllAssetsInDepartment} onChange={handleSelectAllChange}>
                  选择部门所有资产
                </Checkbox>
              </div>
              <div style={{ color: '#999', fontSize: 12 }}>
                {selectedDepartment
                  ? `当前部门: ${departments.find(dept => dept.department_code === selectedDepartment)?.department_name || selectedDepartment}`
                  : '未选择部门'}
              </div>
            </Space>
          </Form.Item>

          <Form.Item label="选择资产">
            <Space orientation="vertical" style={{ width: '100%', marginBottom: 10 }}>
              {/* 资产编号范围选择 */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <Input
                  placeholder="输入资产编号范围，例如: 1000-5000"
                  style={{ flex: 1 }}
                  id="assetCodeRange"
                />
                <Button type="primary" icon={<PlusOutlined />} onClick={handleRangeSelect}>
                  按范围选择
                </Button>
              </div>

              {/* 传统多选选择 */}
              <Select
                mode="multiple"
                placeholder="请选择资产或搜索资产"
                style={{ width: '100%' }}
                value={selectedAssetIds}
                onChange={setSelectedAssetIds}
                filterOption={false}
                onSearch={handleAssetSearch}
                notFoundContent={assetListLoading ? '加载中...' : '未找到匹配资产'}
              >
                {assets.map(asset => (
                  <Option key={asset.id} value={asset.id}>
                    {asset.asset_code} - {asset.asset_name} - {asset.category}
                  </Option>
                ))}
              </Select>

              <div style={{ color: '#999', fontSize: 12 }}>
                已选择 {selectedAssets.length} 个资产
              </div>
            </Space>
          </Form.Item>

          <div style={{ display: 'flex', justifyContent: 'flex-start', gap: 10 }}>
            <Button
              type="primary"
              icon={<PrinterOutlined />}
              block={isMobile}
              onClick={openPrintModal}
              loading={loading}
              disabled={!selectedTemplate || selectedAssets.length === 0}
            >
              打印标签
            </Button>
          </div>
        </Form>

        {selectedAssets.length > 0 && (
          <Card title={`已选择资产 (${selectedAssets.length} 个)`} style={{ marginTop: 20 }}>
            <div className="hide-on-mobile">
              <Table
                columns={columns}
                dataSource={selectedAssets}
                rowKey="id"
                pagination={{ pageSize: 10 }}
                scroll={{ x: 800 }}
              />
            </div>
            <div className="mobile-table-cards show-on-mobile">
              {Array.isArray(selectedAssets) && selectedAssets.length > 0 ? (
                selectedAssets.map(record => (
                  <div key={record.id} className="mobile-card-item">
                    <div className="mobile-card-header">
                      <span className="mobile-card-title">{record.asset_code || '-'}</span>
                      <Tag color={selectedAssetIds.includes(record.id) ? 'green' : 'default'}>
                        {selectedAssetIds.includes(record.id) ? '已选择' : '未选择'}
                      </Tag>
                    </div>
                    <div className="mobile-card-body">
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">资产名称</span>
                        <span className="mobile-card-value">{record.asset_name || '-'}</span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">资产分类</span>
                        <span className="mobile-card-value">{record.category_name || record.category || '-'}</span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">使用部门</span>
                        <span className="mobile-card-value">{record.department || '-'}</span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">使用人</span>
                        <span className="mobile-card-value">{record.responsible_person || '-'}</span>
                      </div>
                      <div className="mobile-card-field">
                        <span className="mobile-card-label">状态</span>
                        <span className="mobile-card-value">{record.status || '-'}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <Empty description="暂无数据" />
              )}
            </div>
          </Card>
        )}
      </Card>

      <Modal
        title="打印机配置"
        open={configModalVisible}
        onOk={savePrinterConfig}
        onCancel={() => setConfigModalVisible(false)}
        width={isMobile ? '95vw' : 500}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
              打印机IP地址
            </label>
            <Input
              placeholder="例如: 192.168.1.100"
              value={printerConfig.ip}
              onChange={e => setPrinterConfig({ ...printerConfig, ip: e.target.value })}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
              打印机端口
            </label>
            <InputNumber
              placeholder="默认: 9100"
              value={printerConfig.port}
              onChange={value => setPrinterConfig({ ...printerConfig, port: value })}
              style={{ width: '100%' }}
              min={1}
              max={65535}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
              打印数量
            </label>
            <InputNumber
              placeholder="默认: 1"
              value={printerConfig.quantity}
              onChange={value => setPrinterConfig({ ...printerConfig, quantity: value })}
              style={{ width: '100%' }}
              min={1}
              max={100}
            />
          </div>
        </div>
      </Modal>

      <Modal
        title="确认打印"
        open={printModalVisible}
        onCancel={() => setPrintModalVisible(false)}
        width={isMobile ? '95vw' : 600}
        footer={[
          <Button key="back" onClick={() => setPrintModalVisible(false)}>
            取消
          </Button>,
          <Button
            key="single"
            onClick={handlePrint}
            loading={loading}
            disabled={selectedAssets.length !== 1}
          >
            单个打印
          </Button>,
          <Button key="batch" type="primary" loading={loading} onClick={handleBatchPrint}>
            批量打印 ({selectedAssets.length} 个)
          </Button>,
        ]}
      >
        <div style={{ marginBottom: 20 }}>
          <h4>打印信息：</h4>
          <ul>
            <li>
              模板名称：<strong>{selectedTemplate?.name}</strong>
            </li>
            <li>
              模板尺寸：{selectedTemplate?.width}mm × {selectedTemplate?.height}mm
            </li>
            <li>
              打印机：{printerConfig.ip}:{printerConfig.port}
            </li>
            <li>打印数量：{selectedAssets.length} 个</li>
          </ul>
        </div>

        <Divider />

        <div>
          <h4>打印模式：</h4>
          <Space orientation="vertical" style={{ width: '100%' }}>
            <div>
              <strong>单个打印：</strong> 仅打印第一个选中的资产，适合预览和测试
            </div>
            <div>
              <strong>批量打印：</strong> 依次打印所有选中的资产，每个资产打印一次
            </div>
          </Space>
        </div>

        {selectedAssets.length <= 5 && (
          <>
            <Divider />
            <h4>打印资产列表：</h4>
            <ul style={{ maxHeight: 150, overflowY: 'auto' }}>
              {selectedAssets.map(asset => (
                <li key={asset.id}>
                  {asset.asset_code} - {asset.name} - {asset.category}
                </li>
              ))}
            </ul>
          </>
        )}
      </Modal>

      <Modal
        title="标签预览"
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        width={isMobile ? '95vw' : 800}
        footer={[
          <Button key="close" onClick={() => setPreviewVisible(false)}>
            关闭
          </Button>,
        ]}
      >
        <div style={{ marginBottom: 20 }}>
          <Space>
            <span>预览缩放：</span>
            <Select value={previewScale} onChange={setPreviewScale} style={{ width: 100 }}>
              <Option value={1}>1x</Option>
              <Option value={2}>2x</Option>
              <Option value={3}>3x</Option>
              <Option value={4}>4x</Option>
            </Select>
          </Space>
        </div>

        <Tabs
          defaultActiveKey="1"
          items={[
            {
              key: '1',
              label: '标签预览',
              children: (
                <div>
                  {selectedAssets.map((asset, index) => (
                    <div key={asset.id} style={{ marginBottom: 30 }}>
                      <div style={{ marginBottom: 10, color: '#666', fontSize: 14 }}>
                        资产 {index + 1}/{selectedAssets.length}: {asset.asset_code} -{' '}
                        {asset.asset_name}
                      </div>
                      <LabelPreview
                        template={selectedTemplate}
                        asset={asset}
                        scale={previewScale}
                      />
                    </div>
                  ))}
                </div>
              ),
            },
            {
              key: '2',
              label: '字段对应值',
              children: (
                <>
                  <div className="hide-on-mobile">
                    <Table
                      columns={[
                        {
                          title: '字段名',
                          dataIndex: 'field',
                          key: 'field',
                          width: 200,
                        },
                        {
                          title: '示例值',
                          dataIndex: 'value',
                          key: 'value',
                          width: 300,
                          render: (_, record) => {
                            if (!selectedAssets[0]) return '-';
                            const asset = selectedAssets[0];
                            const field = record.field;

                            // 应用与LabelPreview组件相同的字段映射逻辑
                            let fieldValue = asset[field];

                            // 1. 直接匹配
                            if (fieldValue !== undefined && fieldValue !== null) {
                              return fieldValue;
                            }

                            // 2. 尝试使用驼峰式命名匹配
                            if (field.includes('_')) {
                              const camelCaseField = field.replace(/_([a-z])/g, g =>
                                g[1].toUpperCase()
                              );
                              if (asset[camelCaseField] !== undefined) {
                                return asset[camelCaseField];
                              }
                            }

                            // 3. 尝试使用下划线命名匹配
                            if (/[A-Z]/.test(field)) {
                              const snakeCaseField = field.replace(
                                /[A-Z]/g,
                                g => `_${g.toLowerCase()}`
                              );
                              if (asset[snakeCaseField] !== undefined) {
                                return asset[snakeCaseField];
                              }
                            }

                            // 4. 特殊字段映射
                            const specialFieldMap = {
                              name: asset.asset_name,
                              category: asset.category_name || asset.category,
                              user_name: asset.responsible_person,
                              department_name: asset.department,
                            };

                            if (specialFieldMap[field] !== undefined) {
                              return specialFieldMap[field];
                            }

                            return '-';
                          },
                        },
                        {
                          title: '说明',
                          dataIndex: 'description',
                          key: 'description',
                          width: 200,
                        },
                      ]}
                      dataSource={
                        selectedTemplate?.elements?.map(el => ({
                          field: el.field,
                          description: el.text,
                        })) || []
                      }
                      rowKey="field"
                      pagination={false}
                      size="small"
                    />
                  </div>
                  <div className="mobile-table-cards show-on-mobile">
                    {(() => {
                      const fieldData = selectedTemplate?.elements?.map(el => ({
                        field: el.field,
                        description: el.text,
                      })) || [];
                      if (fieldData.length === 0) {
                        return <Empty description="暂无数据" />;
                      }
                      const asset = selectedAssets[0];
                      return fieldData.map(record => {
                        let fieldValue = '-';
                        if (asset) {
                          const field = record.field;
                          let raw = asset[field];
                          if (raw !== undefined && raw !== null) {
                            fieldValue = raw;
                          } else if (field.includes('_')) {
                            const camelCaseField = field.replace(/_([a-z])/g, g => g[1].toUpperCase());
                            if (asset[camelCaseField] !== undefined) {
                              fieldValue = asset[camelCaseField];
                            }
                          } else if (/[A-Z]/.test(field)) {
                            const snakeCaseField = field.replace(/[A-Z]/g, g => `_${g.toLowerCase()}`);
                            if (asset[snakeCaseField] !== undefined) {
                              fieldValue = asset[snakeCaseField];
                            }
                          } else {
                            const specialFieldMap = {
                              name: asset.asset_name,
                              category: asset.category_name || asset.category,
                              user_name: asset.responsible_person,
                              department_name: asset.department,
                            };
                            if (specialFieldMap[field] !== undefined) {
                              fieldValue = specialFieldMap[field];
                            }
                          }
                        }
                        return (
                          <div key={record.field} className="mobile-card-item">
                            <div className="mobile-card-header">
                              <span className="mobile-card-title">{record.field || '-'}</span>
                            </div>
                            <div className="mobile-card-body">
                              <div className="mobile-card-field">
                                <span className="mobile-card-label">示例值</span>
                                <span className="mobile-card-value">{fieldValue}</span>
                              </div>
                              <div className="mobile-card-field">
                                <span className="mobile-card-label">说明</span>
                                <span className="mobile-card-value">{record.description || '-'}</span>
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </>
              ),
            },
          ]}
        />
      </Modal>
    </div>
  );
};

export default AssetLabelPrint;
