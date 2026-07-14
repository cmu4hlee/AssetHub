import React, { useState, useEffect } from 'react';
import { useCan, useIsMobile } from '../hooks';
import {
  Card,
  Table,
  Button,
  Form,
  Select,
  Input,
  Space,
  message,
  Tag,
  Modal,
  Popconfirm,
  Row,
  Col,
  Statistic,
  Descriptions,
  Empty,
} from 'antd';

import { useNavigate, useParams } from 'react-router-dom';
import { inventoryAPI, assetAPI } from '../utils/api';
import dayjs from 'dayjs';
import { printInventoryReport } from '../utils/printReport';
import {
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  QrcodeOutlined,
  MobileOutlined,
  PrinterOutlined,
  ScanOutlined,
} from '@ant-design/icons';
import ScannerDialog from '../components/Scanner/ScannerDialog';

const { Option } = Select;
const { TextArea } = Input;

const InventoryDetail = () => {
  const canDelete = useCan('inventory', 'delete');
  const canEdit = useCan('inventory', 'edit');
  const navigate = useNavigate();
  const { id } = useParams();
  const isMobile = useIsMobile();
  const [inventory, setInventory] = useState(null);
  const [details, setDetails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [assets, setAssets] = useState([]);
  const [assetSearchLoading, setAssetSearchLoading] = useState(false);
  const [statistics, setStatistics] = useState(null);
  const [editingDetail, setEditingDetail] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [quickScanOpen, setQuickScanOpen] = useState(false);
  const [mobilePage, setMobilePage] = useState(1);
  const mobilePageSize = 10;
  const [batchImportVisible, setBatchImportVisible] = useState(false);
  const [batchImportLoading, setBatchImportLoading] = useState(false);
  const [batchCodes, setBatchCodes] = useState('');

  useEffect(() => {
    setMobilePage(1);
  }, [details]);

  useEffect(() => {
    if (id && id !== 'new') {
      loadInventory();
      loadStatistics();
    }
  }, [id]);

  const loadInventory = async () => {
    try {
      setLoading(true);
      const result = await inventoryAPI.getInventory(id);
      if (result.success) {
        setInventory(result.data);
        setDetails(result.data.details || []);
      }
    } catch (error) {
      message.error('加载盘点详情失败');
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      const result = await inventoryAPI.getInventoryStatistics(id);
      if (result.success) {
        setStatistics(result.data);
      }
    } catch (error) {
      console.error('加载统计信息失败:', error);
    }
  };

  const searchAssets = async keyword => {
    if (!keyword) {
      setAssets([]);
      return;
    }
    try {
      setAssetSearchLoading(true);
      const result = await assetAPI.getAssetsNoCache({ search: keyword, pageSize: 10 });
      if (result.success) {
        setAssets(result.data);
      }
    } catch (error) {
      console.error('搜索资产失败:', error);
    } finally {
      setAssetSearchLoading(false);
    }
  };

  const handleAddDetail = async values => {
    try {
      const result = await inventoryAPI.addInventoryDetail(id, values);
      if (result.success) {
        message.success('添加成功');
        form.resetFields();
        setAssets([]);
        loadInventory();
        loadStatistics();
      }
    } catch (error) {
      message.error('添加失败');
    }
  };

  const handleEditDetail = record => {
    setEditingDetail(record);
    editForm.setFieldsValue({
      expected_location: record.expected_location,
      actual_location: record.actual_location,
      expected_status: record.expected_status,
      actual_status: record.actual_status,
      discrepancy_type: record.discrepancy_type,
      discrepancy_desc: record.discrepancy_desc,
    });
    setEditModalVisible(true);
  };

  const handleUpdateDetail = async values => {
    try {
      const result = await inventoryAPI.updateInventoryDetail(id, editingDetail.id, values);
      if (result.success) {
        message.success('更新成功');
        setEditModalVisible(false);
        setEditingDetail(null);
        editForm.resetFields();
        loadInventory();
        loadStatistics();
      }
    } catch (error) {
      message.error('更新失败');
    }
  };

  const handleDeleteDetail = async detailId => {
    try {
      const result = await inventoryAPI.deleteInventoryDetail(id, detailId);
      if (result.success) {
        message.success('删除成功');
        loadInventory();
        loadStatistics();
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  // 批量导入盘点明细 - 粘贴资产编码
  const handleBatchImport = async () => {
    const codes = batchCodes
      .split('\n')
      .map(c => c.trim())
      .filter(Boolean);
    if (codes.length === 0) {
      message.warning('请输入至少一个资产编码');
      return;
    }
    if (codes.length > 500) {
      message.warning('单次最多导入500个资产编码');
      return;
    }
    try {
      setBatchImportLoading(true);
      const details = codes.map(code => ({ asset_code: code }));
      const result = await inventoryAPI.batchAddInventoryDetails(id, details);
      if (result.success) {
        message.success(result.message || `成功导入 ${codes.length} 条资产`);
        setBatchImportVisible(false);
        setBatchCodes('');
        loadInventory();
        loadStatistics();
      } else {
        message.error(result.message || '批量导入失败');
      }
    } catch (error) {
      message.error('批量导入失败');
    } finally {
      setBatchImportLoading(false);
    }
  };

  const handleUpdateStatus = async (status) => {
    try {
      if (status === '已完成') {
        // 使用完成盘点接口（含未盘点检查）
        const result = await inventoryAPI.completeInventory(id);
        if (result.success) {
          message.success('盘点已完成');
          loadInventory();
          loadStatistics();
        }
      } else {
        const result = await inventoryAPI.updateInventoryStatus(id, status);
        if (result.success) {
          message.success('状态更新成功');
          loadInventory();
        }
      }
    } catch (error) {
      const errData = error?.response?.data;
      if (errData?.force_complete) {
        Modal.confirm({
          title: '确认完成盘点',
          content: `还有 ${errData.pending_count} 个资产未盘点，确定要强制完成吗？`,
          okText: '强制完成',
          cancelText: '取消',
          maskClosable: false,
          onOk: async () => {
            try {
              await inventoryAPI.updateInventoryStatus(id, '已完成');
              message.success('盘点已强制完成');
              loadInventory();
              loadStatistics();
            } catch (e) {
              message.error('强制完成失败');
            }
          },
        });
      } else {
        message.error(errData?.message || error.message || (status === '已完成' ? '完成盘点失败' : '状态更新失败'));
      }
    }
  };

  const handlePrintReport = () => {
    if (!inventory) {
      message.warning('暂无数据可打印');
      return;
    }
    printInventoryReport(inventory, details, statistics);
  };

  const getDiscrepancyTag = type => {
    const typeMap = {
      正常: { color: 'success', text: '正常' },
      位置不符: { color: 'warning', text: '位置不符' },
      状态不符: { color: 'warning', text: '状态不符' },
      缺失: { color: 'error', text: '缺失' },
      多余: { color: 'default', text: '多余' },
    };
    const config = typeMap[type] || { color: 'default', text: type };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const detailColumns = [
    {
      title: '资产编号',
      dataIndex: 'asset_code',
      key: 'asset_code',
      width: 120,
    },
    {
      title: '资产名称',
      dataIndex: 'asset_name',
      key: 'asset_name',
      width: 150,
      ellipsis: true,
    },
    {
      title: '预期位置',
      dataIndex: 'expected_location',
      key: 'expected_location',
      width: 120,
    },
    {
      title: '实际位置',
      dataIndex: 'actual_location',
      key: 'actual_location',
      width: 120,
    },
    {
      title: '预期状态',
      dataIndex: 'expected_status',
      key: 'expected_status',
      width: 100,
    },
    {
      title: '实际状态',
      dataIndex: 'actual_status',
      key: 'actual_status',
      width: 100,
    },
    {
      title: '差异类型',
      dataIndex: 'discrepancy_type',
      key: 'discrepancy_type',
      width: 120,
      render: type => getDiscrepancyTag(type),
    },
    {
      title: '差异说明',
      dataIndex: 'discrepancy_desc',
      key: 'discrepancy_desc',
      ellipsis: true,
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEditDetail(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这条明细吗？"
            onConfirm={() => handleDeleteDetail(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />} disabled={!canDelete}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (id === 'new') {
    return <div>新建盘点功能开发中...</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Button onClick={() => navigate('/inventory')}>返回列表</Button>
          {inventory && inventory.status === '进行中' && (
            <>
              <Button
                type="primary"
                icon={<QrcodeOutlined />}
                onClick={() => navigate(`/inventory/${id}/scan`)}
              >
                扫码盘点
              </Button>
              <Button
                icon={<ScanOutlined />}
                onClick={() => setQuickScanOpen(true)}
              >
                快扫录入
              </Button>
              {inventory.self_check_enabled && (
                <Button
                  icon={<MobileOutlined />}
                  onClick={() => navigate(`/inventory/self`)}
                >
                  自助盘点
                </Button>
              )}
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={() => handleUpdateStatus('已完成')}
              >
                完成盘点
              </Button>
              <Button icon={<CloseCircleOutlined />} onClick={() => handleUpdateStatus('已取消')}>
                取消盘点
              </Button>
            </>
          )}
        </Space>
      </div>

      {inventory && (
        <>
          <Card title={`盘点单号：${inventory.inventory_no}`} style={{ marginBottom: 16 }}>
            <Descriptions column={isMobile ? 1 : 3} bordered>
              <Descriptions.Item label="盘点日期">{inventory.inventory_date}</Descriptions.Item>
              <Descriptions.Item label="盘点类型">{inventory.inventory_type}</Descriptions.Item>
              <Descriptions.Item label="盘点人">{inventory.inventory_person}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag
                  color={
                    inventory.status === '已完成'
                      ? 'success'
                      : inventory.status === '已取消'
                        ? 'error'
                        : 'processing'
                  }
                >
                  {inventory.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="创建时间" span={2}>
                {inventory.created_at || '-'}
              </Descriptions.Item>
              {inventory.remark && (
                <Descriptions.Item label="备注" span={3}>
                  {inventory.remark}
                </Descriptions.Item>
              )}
              {inventory.self_check_enabled && (
                <>
                  <Descriptions.Item label="自助盘点">
                    <Tag color="blue">已启用</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="自助范围">
                    {inventory.self_check_scope === 'mine' ? '仅我的资产' : inventory.self_check_scope === 'department' ? '本科室资产' : '全量资产'}
                  </Descriptions.Item>
                  <Descriptions.Item label="自助时间">
                    {inventory.self_check_start ? dayjs(inventory.self_check_start).format('MM-DD HH:mm') : '不限'} ~ {inventory.self_check_end ? dayjs(inventory.self_check_end).format('MM-DD HH:mm') : '不限'}
                  </Descriptions.Item>
                </>
              )}
            </Descriptions>
          </Card>

          {statistics && (
            <Card title="统计信息" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col xs={12} sm={6}>
                  <Statistic title="总数量" value={statistics.total} />
                </Col>
                <Col xs={12} sm={6}>
                  <Statistic
                    title="正常"
                    value={statistics.normalCount}
                    styles={{ content: { color: '#3f8600' } }}
                    prefix={<CheckCircleOutlined />}
                  />
                </Col>
                <Col xs={12} sm={6}>
                  <Statistic
                    title="异常"
                    value={statistics.abnormalCount}
                    styles={{ content: { color: '#cf1322' } }}
                    prefix={<CloseCircleOutlined />}
                  />
                </Col>
                <Col xs={12} sm={6}>
                  <Statistic
                    title="正常率"
                    value={
                      statistics.total > 0
                        ? ((statistics.normalCount / statistics.total) * 100).toFixed(1)
                        : 0
                    }
                    suffix="%"
                    styles={{ content: { color: '#3f8600' } }}
                  />
                </Col>
              </Row>
              {statistics.typeStats && Object.keys(statistics.typeStats).length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <strong>差异类型分布：</strong>
                  <Space style={{ marginTop: 8 }}>
                    {Object.entries(statistics.typeStats).map(([type, count]) => (
                      <Tag key={type} color={type === '正常' ? 'success' : 'warning'}>
                        {type}: {count}
                      </Tag>
                    ))}
                  </Space>
                </div>
              )}
            </Card>
          )}

          <Card
            title="盘点明细"
            extra={
              <Space>
                <Button
                  icon={<PrinterOutlined />}
                  onClick={handlePrintReport}
                >
                  打印报表
                </Button>
                {inventory && inventory.status === '进行中' && (
                  <Button onClick={() => setBatchImportVisible(true)}>
                    批量导入
                  </Button>
                )}
                <Button
                  icon={<ReloadOutlined />}
                  onClick={() => {
                    loadInventory();
                    loadStatistics();
                  }}
                >
                  刷新
                </Button>
              </Space>
            }
          >
            <Form
              form={form}
              layout={isMobile ? 'vertical' : 'inline'}
              onFinish={handleAddDetail}
              style={{ marginBottom: 16 }}
            >
              <Form.Item
                name="asset_code"
                label="资产"
                rules={[{ required: true, message: '请选择资产' }]}
              >
                <Select
                  showSearch
                  placeholder="搜索资产编号或名称"
                  style={{ width: 200 }}
                  onSearch={searchAssets}
                  loading={assetSearchLoading}
                  filterOption={false}
                  allowClear
                >
                  {assets.map(asset => (
                    <Option key={asset.asset_code} value={asset.asset_code}>
                      {asset.asset_code} - {asset.asset_name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item name="expected_location" label="预期位置">
                <Input placeholder="预期位置" style={{ width: 120 }} />
              </Form.Item>
              <Form.Item name="actual_location" label="实际位置">
                <Input placeholder="实际位置" style={{ width: 120 }} />
              </Form.Item>
              <Form.Item name="expected_status" label="预期状态">
                <Select placeholder="预期状态" style={{ width: 100 }}>
                  <Option value="在用">在用</Option>
                  <Option value="闲置">闲置</Option>
                  <Option value="维修">维修</Option>
                  <Option value="报废">报废</Option>
                </Select>
              </Form.Item>
              <Form.Item name="actual_status" label="实际状态">
                <Select placeholder="实际状态" style={{ width: 100 }}>
                  <Option value="在用">在用</Option>
                  <Option value="闲置">闲置</Option>
                  <Option value="维修">维修</Option>
                  <Option value="报废">报废</Option>
                </Select>
              </Form.Item>
              <Form.Item name="discrepancy_type" label="差异类型">
                <Select placeholder="差异类型" style={{ width: 120 }}>
                  <Option value="正常">正常</Option>
                  <Option value="位置不符">位置不符</Option>
                  <Option value="状态不符">状态不符</Option>
                  <Option value="缺失">缺失</Option>
                  <Option value="多余">多余</Option>
                </Select>
              </Form.Item>
              <Form.Item name="discrepancy_desc" label="差异说明">
                <Input placeholder="差异说明" style={{ width: 150 }} />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit">
                  添加
                </Button>
              </Form.Item>
            </Form>
            <div className="hide-on-mobile">
              <Table
                columns={detailColumns}
                dataSource={details}
                rowKey="id"
                loading={loading}
                pagination={{
                  pageSize: 20,
                  showSizeChanger: true,
                  showTotal: total => `共 ${total} 条`,
                }}
                scroll={{ x: 1200 }}
              />
            </div>
            <div className="mobile-table-cards show-on-mobile">
              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#8c8c8c' }}>
                  加载中...
                </div>
              ) : Array.isArray(details) && details.length > 0 ? (
                <>
                  {details
                    .slice((mobilePage - 1) * mobilePageSize, mobilePage * mobilePageSize)
                    .map(record => (
                      <div key={record.id} className="mobile-card-item">
                        <div className="mobile-card-header">
                          <span className="mobile-card-title">
                            {record.asset_code || '-'}
                          </span>
                          {getDiscrepancyTag(record.discrepancy_type)}
                        </div>
                        <div className="mobile-card-body">
                          <div className="mobile-card-field">
                            <span className="mobile-card-label">资产名称</span>
                            <span className="mobile-card-value">
                              {record.asset_name || '-'}
                            </span>
                          </div>
                          <div className="mobile-card-field">
                            <span className="mobile-card-label">预期位置</span>
                            <span className="mobile-card-value">
                              {record.expected_location || '-'}
                            </span>
                          </div>
                          <div className="mobile-card-field">
                            <span className="mobile-card-label">实际位置</span>
                            <span className="mobile-card-value">
                              {record.actual_location || '-'}
                            </span>
                          </div>
                          <div className="mobile-card-field">
                            <span className="mobile-card-label">预期状态</span>
                            <span className="mobile-card-value">
                              {record.expected_status || '-'}
                            </span>
                          </div>
                          <div className="mobile-card-field">
                            <span className="mobile-card-label">实际状态</span>
                            <span className="mobile-card-value">
                              {record.actual_status || '-'}
                            </span>
                          </div>
                          {record.discrepancy_desc && (
                            <div
                              className="mobile-card-field"
                              style={{ gridColumn: '1 / -1' }}
                            >
                              <span className="mobile-card-label">差异说明</span>
                              <span className="mobile-card-value">
                                {record.discrepancy_desc}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="mobile-card-actions">
                          <Button
                            type="primary"
                            size="small"
                            icon={<EditOutlined />}
                            block
                            onClick={() => handleEditDetail(record)}
                          >
                            编辑
                          </Button>
                          <Popconfirm
                            title="确定要删除这条明细吗？"
                            onConfirm={() => handleDeleteDetail(record.id)}
                            okText="确定"
                            cancelText="取消"
                          >
                            <Button type="primary" danger size="small" icon={<DeleteOutlined />} block disabled={!canDelete}>
                              删除
                            </Button>
                          </Popconfirm>
                        </div>
                      </div>
                    ))}
                  {/* 移动端分页 */}
                  <div style={{ marginTop: '16px', textAlign: 'center' }}>
                    <Space>
                      <Button
                        disabled={mobilePage === 1}
                        onClick={() => setMobilePage(mobilePage - 1)}
                      >
                        上一页
                      </Button>
                      <span>
                        第 {mobilePage} / {Math.ceil(details.length / mobilePageSize) || 1} 页
                      </span>
                      <Button
                        disabled={
                          mobilePage >= Math.ceil(details.length / mobilePageSize)
                        }
                        onClick={() => setMobilePage(mobilePage + 1)}
                      >
                        下一页
                      </Button>
                    </Space>
                    <div style={{ marginTop: '8px', color: '#8c8c8c', fontSize: '12px' }}>
                      共 {details.length} 条
                    </div>
                  </div>
                </>
              ) : (
                <Empty description="暂无数据" />
              )}
            </div>
          </Card>
        </>
      )}

      {/* 编辑明细模态框 */}
      <Modal
        title="编辑盘点明细"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          setEditingDetail(null);
          editForm.resetFields();
        }}
        onOk={() => editForm.submit()}
        width={isMobile ? '95vw' : 600}
      >
        <Form form={editForm} layout="vertical" onFinish={handleUpdateDetail}>
          <Form.Item name="expected_location" label="预期位置">
            <Input placeholder="预期位置" />
          </Form.Item>
          <Form.Item name="actual_location" label="实际位置">
            <Input placeholder="实际位置" />
          </Form.Item>
          <Form.Item name="expected_status" label="预期状态">
            <Select placeholder="预期状态">
              <Option value="在用">在用</Option>
              <Option value="闲置">闲置</Option>
              <Option value="维修">维修</Option>
              <Option value="报废">报废</Option>
            </Select>
          </Form.Item>
          <Form.Item name="actual_status" label="实际状态">
            <Select placeholder="实际状态">
              <Option value="在用">在用</Option>
              <Option value="闲置">闲置</Option>
              <Option value="维修">维修</Option>
              <Option value="报废">报废</Option>
            </Select>
          </Form.Item>
          <Form.Item name="discrepancy_type" label="差异类型">
            <Select placeholder="差异类型">
              <Option value="正常">正常</Option>
              <Option value="位置不符">位置不符</Option>
              <Option value="状态不符">状态不符</Option>
              <Option value="缺失">缺失</Option>
              <Option value="多余">多余</Option>
            </Select>
          </Form.Item>
          <Form.Item name="discrepancy_desc" label="差异说明">
            <TextArea rows={3} placeholder="差异说明" />
          </Form.Item>
        </Form>
      </Modal>

      <ScannerDialog
        open={quickScanOpen}
        onClose={() => setQuickScanOpen(false)}
        title="扫码快录"
        onScan={async (code /*, format */) => {
          // 自动搜索并填入新增明细表单
          setQuickScanOpen(false);
          message.success(`已扫描: ${code}`);
          form.setFieldsValue({ asset_code: code });
          try {
            const result = await assetAPI.getAssetsNoCache({
              search: code,
              pageSize: 5,
            });
            if (result.success && Array.isArray(result.data) && result.data.length > 0) {
              const match = result.data.find(a => a.asset_code === code) || result.data[0];
              message.info(`已匹配资产: ${match.asset_name || ''}`);
            } else {
              message.warning('该资产未在系统中找到,请检查编码');
            }
          } catch (e) {
            // 静默失败,不阻断流程
          }
        }}
      />
      {/* 批量导入盘点明细 */}
      <Modal
        title="批量导入盘点明细"
        open={batchImportVisible}
        onCancel={() => {
          setBatchImportVisible(false);
          setBatchCodes('');
        }}
        onOk={handleBatchImport}
        confirmLoading={batchImportLoading}
        okText="导入"
        cancelText="取消"
      >
        <div style={{ marginBottom: 12 }}>
          <span>请输入要导入的资产编码，每行一个：</span>
        </div>
        <Input.TextArea
          rows={10}
          placeholder="粘贴资产编码，每行一个&#10;例如：&#10;ZC20240001&#10;ZC20240002&#10;ZC20240003"
          value={batchCodes}
          onChange={(e) => setBatchCodes(e.target.value)}
        />
      </Modal>
    </div>
  );
};

export default InventoryDetail;
