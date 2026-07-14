import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useCan } from '../hooks';
import {
  Button, Input, Select, Space, Popconfirm, message, Upload, Modal, Tag,
  Card, Row, Col, Empty, Form, DatePicker, Statistic,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, DownloadOutlined,
  UploadOutlined, ExportOutlined, FileSearchOutlined, PrinterOutlined,
  CheckCircleOutlined, ToolOutlined, StopOutlined, PauseCircleOutlined,
  SwapOutlined, AppstoreOutlined, AuditOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { assetAPI, acceptanceAPI } from '../utils/api';
import { printAssetListReport } from '../utils/printReport';
import { useDepartment } from '../contexts/DepartmentContext';
import crypto from '../utils/crypto';
import {
  PageHeader, StatusTag, KpiCard, FilterBar, ResponsiveTable, MobileCardList,
} from '../components';
import { ASSET_STATUS } from '../constants/asset';
import { formatMoney } from '../constants/tendering';

const { Search } = Input;
const { Option } = Select;
const { confirm } = Modal;

const STATUS_OPTIONS = Object.entries(ASSET_STATUS).map(([k, v]) => ({ value: k, label: v.text }));

const AssetList = () => {
  const navigate = useNavigate();
  const canDelete = useCan('asset', 'delete');
  const canEdit = useCan('asset', 'edit');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [filters, setFilters] = useState({ status: '', department: '', keyword: '' });
  const [keywordInput, setKeywordInput] = useState('');
  const [stats, setStats] = useState({ 在用: 0, 闲置: 0, 维修: 0, 报废: 0, 调配中: 0 });
  // 全部资产统计（基于后端 /assets/statistics/overview，覆盖租户内所有资产，而非当前分页）
  const [globalStats, setGlobalStats] = useState(null);
  const [userRole, setUserRole] = useState('');
  const { selectedDepartmentId } = useDepartment();

  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [selectedRows, setSelectedRows] = useState([]);
  const [batchAcceptanceModalOpen, setBatchAcceptanceModalOpen] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [acceptanceDate, setAcceptanceDate] = useState(dayjs());
  const [acceptancePerson, setAcceptancePerson] = useState('');
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [filterBarForm] = Form.useForm();

  const loadDepartments = useCallback(async () => {
    try {
      const result = await assetAPI.getDepartments();
      if (result.success) {
        setDepartments(Array.isArray(result.data) ? result.data : []);
      }
    } catch (error) {
      console.error('加载部门列表失败:', error);
    }
  }, []);

  useEffect(() => {
    const loadUserInfo = async () => {
      try {
        const user = await crypto.getItemAsync('user');
        if (user) {
          setUserRole(user.role || '');
          setAcceptancePerson(user.real_name || '');
        }
      } catch (e) { /* ignore */ }
    };
    loadUserInfo();
    loadDepartments();
  }, [loadDepartments]);

  const visibleDepartments = useMemo(() => {
    if (userRole === 'system_admin' || userRole === 'super_admin') {
      return departments;
    }
    // 普通用户只能看到自己管理的部门(这里简化为全部可见,实际可根据 managedDepartmentCodes 过滤)
    return departments;
  }, [departments, userRole]);

  const loadGlobalStats = useCallback(async () => {
    try {
      const result = await assetAPI.getStatistics({});
      if (result.success && result.data && result.data.overview) {
        setGlobalStats(result.data.overview);
      }
    } catch (error) {
      console.error('加载资产统计失败:', error);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        pageSize: pagination.pageSize,
        ...filters,
      };
      const result = await assetAPI.getAssets(params);
      if (result.success) {
        const list = Array.isArray(result.data) ? result.data : [];
        setData(list);
        setPagination(prev => ({ ...prev, total: result.pagination?.total ?? list.length }));
        // 简单统计
        const counts = list.reduce((acc, r) => {
          if (r.status) acc[r.status] = (acc[r.status] || 0) + 1;
          return acc;
        }, {});
        setStats({
          在用: counts['在用'] || 0,
          闲置: counts['闲置'] || 0,
          维修: counts['维修'] || 0,
          报废: counts['报废'] || 0,
          调配中: counts['调配中'] || 0,
        });
      }
    } catch (error) {
      message.error('加载资产列表失败');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, filters]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { loadGlobalStats(); }, [loadGlobalStats]);

  const handleDelete = async id => {
    try {
      const result = await assetAPI.deleteAsset(id);
      if (result.success) {
        message.success('删除成功');
        loadData();
        loadGlobalStats();
      } else {
        message.error(result.message || '删除失败');
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const blob = await assetAPI.downloadTemplate();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '资产导入模板.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      message.success('模板下载成功');
    } catch (error) {
      console.error('模板下载失败:', error);
      message.error('模板下载失败');
    }
  };

  const handleImport = async file => {
    setImporting(true);
    setImportModalVisible(true);
    try {
      const result = await assetAPI.importAssets(file);
      setImportResult(result);
      message.success(`导入完成，成功 ${result.successCount} 条，失败 ${result.failedCount} 条`);
      loadData();
      loadGlobalStats();
    } catch (error) {
      console.error('资产导入失败:', error);
      message.error('资产导入失败');
      setImportResult({ success: false, message: error.message });
    } finally {
      setImporting(false);
    }
    return false;
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys, rows) => {
      setSelectedRowKeys(keys);
      setSelectedRows(rows);
    },
  };

  const handleBatchAcceptance = async () => {
    if (!acceptancePerson) {
      message.error('请填写验收人');
      return;
    }
    setBatchLoading(true);
    try {
      const records = selectedRows.map(row => ({
        assetCode: row.asset_code,
        assetName: row.asset_name,
        supplier: row.brand ? `${row.brand} ${row.model || ''}`.trim() : '',
        acceptanceDate: acceptanceDate.format('YYYY-MM-DD'),
        acceptancePerson: acceptancePerson,
        department: row.department || '',
        status: '待验收',
      }));
      const resp = await acceptanceAPI.batchCreateAcceptanceRecords({ records });
      if (resp.success) {
        message.success(resp.message);
        setSelectedRowKeys([]);
        setSelectedRows([]);
        setBatchAcceptanceModalOpen(false);
      } else {
        message.error(resp.message || '批量创建失败');
      }
    } catch (error) {
      message.error('批量创建失败');
    } finally {
      setBatchLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      message.loading({ content: '正在导出资产数据...', key: 'export', duration: 0 });
      const params = { ...filters };
      if (userRole !== 'system_admin' && selectedDepartmentId && selectedDepartmentId !== 'all') {
        params.selectedDepartmentId = selectedDepartmentId;
      }
      const blob = await assetAPI.exportAssets(params);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      a.download = `资产导出_${timestamp}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      message.success({ content: '资产导出成功', key: 'export' });
    } catch (error) {
      console.error('资产导出失败:', error);
      message.error({ content: '资产导出失败', key: 'export' });
    }
  };

  const handlePrintReport = () => {
    const printData = selectedRows.length > 0 ? selectedRows : data;
    if (!printData || printData.length === 0) {
      message.warning('暂无数据可打印');
      return;
    }
    printAssetListReport(printData);
  };

  const applyKeywordFilter = () => {
    setPagination(prev => ({ ...prev, current: 1 }));
    setFilters(prev => ({ ...prev, keyword: keywordInput }));
  };

  const handleReset = () => {
    setKeywordInput('');
    setFilters({ status: '', department: '', keyword: '' });
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const isSystemAdmin = userRole === 'system_admin' || userRole === 'super_admin';

  const columns = [
    {
      title: '资产编号',
      dataIndex: 'asset_code',
      width: 160,
      fixed: 'left',
      ellipsis: true,
      render: (text, record) => (
        <a onClick={() => navigate(`/assets/${record.id}`)}>{text || '-'}</a>
      ),
    },
    { title: '资产名称', dataIndex: 'asset_name', width: 180, ellipsis: true },
    { title: '分类', dataIndex: 'category_name', width: 120 },
    { title: '品牌', dataIndex: 'brand', width: 120 },
    { title: '型号', dataIndex: 'model', width: 120 },
    { title: '出厂编号', dataIndex: 'serial_number', width: 150, ellipsis: true },
    { title: '存放地点', dataIndex: 'storage_location', width: 150, ellipsis: true },
    { title: '部门', dataIndex: 'department', width: 120 },
    { title: '责任人', dataIndex: 'responsible_person', width: 100 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: v => <StatusTag status={v} statusMap={ASSET_STATUS} />,
    },
    {
      title: '购置价格',
      dataIndex: 'purchase_price',
      width: 130,
      align: 'right',
      render: v => v ? <span style={{ color: '#fa8c16', fontWeight: 600 }}>{formatMoney(v, false, 0)}</span> : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => navigate(`/assets/${record.id}`)}>
            详情
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => navigate(`/assets/edit/${record.id}`)}>
            编辑
          </Button>
          {isSystemAdmin && (
            <Popconfirm title="确定要删除这个资产吗？" onConfirm={() => handleDelete(record.id)} disabled={!canDelete} okText="确定" cancelText="取消">
              <Button type="link" size="small" danger icon={<DeleteOutlined />} disabled={!canDelete}>删除</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const mobileFields = [
    { label: '资产编号', key: 'asset_code', span: 2 },
    { label: '分类', key: 'category_name' },
    { label: '品牌', key: 'brand' },
    { label: '型号', key: 'model' },
    { label: '部门', key: 'department' },
    { label: '责任人', key: 'responsible_person' },
    {
      label: '购置价',
      key: 'purchase_price',
      render: v => v ? <span style={{ color: '#fa8c16', fontWeight: 600 }}>{formatMoney(v, false, 0)}</span> : '-',
    },
  ];

  const mobileActions = record => [
    { key: 'view', text: '详情', icon: <EyeOutlined />, type: 'primary',
      onClick: r => navigate(`/assets/${r.id}`) },
    { key: 'edit', text: '编辑', icon: <EditOutlined />,
      onClick: r => navigate(`/assets/edit/${r.id}`) },
    { key: 'delete', text: '删除', icon: <DeleteOutlined />, danger: true,
      hidden: !isSystemAdmin, confirm: '确定要删除这个资产吗？',
      onClick: r => handleDelete(r.id) },
  ];

  // 表格分页：将后端返回的真实 total 接入分页器，并提供翻页 / 调整每页条数能力
  const handleTableChange = (page, pageSize) => {
    setPagination(prev => ({ ...prev, current: page, pageSize }));
  };

  const tablePagination = {
    current: pagination.current,
    pageSize: pagination.pageSize,
    total: pagination.total,
    showSizeChanger: true,
    pageSizeOptions: ['20', '50', '100', '200', '500', '1000'],
    showQuickJumper: true,
    showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条 / 共 ${total} 条`,
    onChange: handleTableChange,
  };

  // 资产总数与总价值统一取后端全量统计（覆盖租户内全部资产），与状态 KPI 口径一致；
  // 未加载全量统计时降级为当前分页 total（仅在筛选场景下会与状态卡出现口径差异，属降级兜底）
  const totalAsset = globalStats && Number(globalStats.total_count) > 0
    ? Number(globalStats.total_count)
    : pagination.total;
  const totalValue = globalStats && Number(globalStats.total_value) > 0
    ? Number(globalStats.total_value)
    : data.reduce((s, r) => s + (Number(r.purchase_price) || 0), 0);
  // 优先使用后端全量统计（覆盖全部资产），未加载时降级为当前分页统计
  const totalInUse = globalStats ? (globalStats.in_use_count || 0) : (stats['在用'] || 0);
  const totalIdle = globalStats ? (globalStats.idle_count || 0) : (stats['闲置'] || 0);
  const totalRepair = globalStats ? (globalStats.repair_count || 0) : (stats['维修'] || 0);
  const totalScrap = globalStats ? (globalStats.scrap_count || 0) : (stats['报废'] || 0);

  return (
    <div style={{ padding: 16, background: '#f5f7fa', minHeight: '100vh' }}>
      <PageHeader
        title="资产列表"
        count={totalAsset}
        description={`共管理 ${totalAsset} 项资产，总价值 ${formatMoney(totalValue, false, 0)} 元`}
        extra={
          <Space wrap>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/assets/add')}
            >
              新增资产
            </Button>
            <Button
              icon={<FileSearchOutlined />}
              onClick={() => navigate('/assets/ai-assistant')}
            >
              AI 助手
            </Button>
            <Button icon={<PrinterOutlined />} onClick={handlePrintReport}>
              打印报表
            </Button>
            <Button icon={<ExportOutlined />} onClick={handleExport}>
              导出
            </Button>
            <Upload
              accept=".xlsx,.xls"
              showUploadList={false}
              beforeUpload={handleImport}
              disabled={importing}
            >
              <Button icon={<UploadOutlined />} loading={importing}>
                批量导入
              </Button>
            </Upload>
            <Button
              type="default"
              onClick={handleDownloadTemplate}
              size="small"
            >
              下载模板
            </Button>
          </Space>
        }
      />

      {/* 关键指标 */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <KpiCard
            title="资产总数"
            value={totalAsset}
            tone="primary"
            icon={<AppstoreOutlined />}
            hint="全部资产记录"
          />
        </Col>
        <Col xs={12} sm={6}>
          <KpiCard
            title="在用"
            value={totalInUse}
            tone="success"
            icon={<CheckCircleOutlined />}
            hint="正常使用中"
            onClick={() => setFilters(f => ({ ...f, status: '在用' }))}
          />
        </Col>
        <Col xs={12} sm={6}>
          <KpiCard
            title="闲置"
            value={totalIdle}
            tone="cyan"
            icon={<PauseCircleOutlined />}
            hint="暂未使用"
            onClick={() => setFilters(f => ({ ...f, status: '闲置' }))}
          />
        </Col>
        <Col xs={12} sm={6}>
          <KpiCard
            title="维修中"
            value={totalRepair}
            tone="warning"
            icon={<ToolOutlined />}
            hint="需要关注"
            onClick={() => setFilters(f => ({ ...f, status: '维修' }))}
          />
        </Col>
      </Row>

      <FilterBar
        fields={[
          {
            name: 'status', type: 'select', placeholder: '资产状态',
            options: STATUS_OPTIONS, width: 140,
          },
          {
            name: 'department', type: 'select', placeholder: '所属部门',
            options: visibleDepartments.map(d => ({
              value: d.department_name || d.name || '',
              label: d.department_name || d.name || '',
            })),
            width: 200,
          },
        ]}
        values={filters}
        onChange={setFilters}
        onSearch={() => setPagination(prev => ({ ...prev, current: 1 }))}
        onReset={handleReset}
        searchLoading={loading}
      />

      {/* 搜索框和批量操作独立保留 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Search
            placeholder="搜索资产编号/名称/品牌"
            style={{ width: 300 }}
            allowClear
            value={keywordInput}
            onChange={e => setKeywordInput(e.target.value)}
            onSearch={applyKeywordFilter}
            enterButton
          />
          {selectedRowKeys.length > 0 ? (
            <Space wrap>
              <span style={{ color: '#1677ff' }}>已选 {selectedRowKeys.length} 项</span>
              <Button
                type="primary"
                icon={<FileSearchOutlined />}
                onClick={() => setBatchAcceptanceModalOpen(true)}
              >
                批量创建验收
              </Button>
              <Button onClick={() => { setSelectedRowKeys([]); setSelectedRows([]); }}>
                取消选择
              </Button>
            </Space>
          ) : null}
        </Space>
      </Card>

      {/* 桌面端表格(支持 rowSelection 批量选择) */}
      <div className="hide-on-mobile">
        <ResponsiveTable
          dataSource={Array.isArray(data) ? data : []}
          columns={columns}
          loading={loading}
          rowKey="id"
          rowSelection={rowSelection}
          scroll={{ x: 1500 }}
          pagination={tablePagination}
          mobileTitleKey="asset_name"
          mobileStatusRender={r => <StatusTag status={r.status} statusMap={ASSET_STATUS} size="small" />}
          mobileFields={mobileFields}
          mobileActions={mobileActions}
        />
      </div>

      {/* 移动端卡片列表 */}
      <div className="show-on-mobile">
        <MobileCardList
          data={data}
          loading={loading}
          titleKey="asset_name"
          statusRender={r => <StatusTag status={r.status} statusMap={ASSET_STATUS} size="small" />}
          fields={mobileFields}
          actions={mobileActions}
        />
        {data.length > 0 ? (
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <Space>
              <Button
                disabled={pagination.current === 1}
                onClick={() => setPagination(prev => ({ ...prev, current: prev.current - 1 }))}
              >
                上一页
              </Button>
              <span>
                第 {pagination.current} / {Math.ceil(pagination.total / pagination.pageSize)} 页
              </span>
              <Button
                disabled={pagination.current >= Math.ceil(pagination.total / pagination.pageSize)}
                onClick={() => setPagination(prev => ({ ...prev, current: prev.current + 1 }))}
              >
                下一页
              </Button>
            </Space>
            <div style={{ marginTop: 8, color: '#8c8c8c', fontSize: 12 }}>
              共 {pagination.total} 条
            </div>
          </div>
        ) : null}
      </div>

      {/* 导入结果弹窗 */}
      <Modal
        title="资产导入结果"
        open={importModalVisible}
        onCancel={() => { setImportModalVisible(false); setImportResult(null); }}
        footer={[<Button key="close" onClick={() => { setImportModalVisible(false); setImportResult(null); }}>关闭</Button>]}
        width={600}
        centered
      >
        {importing ? (
          <div>正在导入资产，请稍候...</div>
        ) : importResult ? (
          <div>
            {importResult.success ? (
              <div>
                <p><Tag color="green" style={{ fontSize: 14 }}>导入成功</Tag></p>
                <p>成功条数：<strong style={{ color: '#52c41a' }}>{importResult.successCount}</strong></p>
                <p>失败条数：<strong style={{ color: importResult.failedCount > 0 ? '#ff4d4f' : '#52c41a' }}>{importResult.failedCount}</strong></p>
                {importResult.failedCount > 0 && (
                  <div>
                    <h4>失败详情：</h4>
                    <ul style={{ maxHeight: 300, overflowY: 'auto', paddingLeft: 20 }}>
                      {importResult.errorMessages?.map((msg, i) => (
                        <li key={i} style={{ color: '#ff4d4f', marginBottom: 8 }}>{msg}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ color: '#ff4d4f' }}>导入失败：{importResult.message}</div>
            )}
          </div>
        ) : null}
      </Modal>

      {/* 批量验收弹窗 */}
      <Modal
        title="批量创建验收记录"
        open={batchAcceptanceModalOpen}
        onCancel={() => setBatchAcceptanceModalOpen(false)}
        onOk={handleBatchAcceptance}
        confirmLoading={batchLoading}
        width={500}
        centered
      >
        <div style={{ marginBottom: 16 }}>
          已选择 <strong style={{ color: '#1677ff' }}>{selectedRows.length}</strong> 条资产，将批量创建验收记录。
        </div>
        <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: 4 }}>验收日期</label>
            <input
              type="date"
              value={acceptanceDate.format('YYYY-MM-DD')}
              onChange={e => setAcceptanceDate(dayjs(e.target.value))}
              style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d9d9d9' }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: 4 }}>验收人</label>
            <input
              type="text"
              value={acceptancePerson}
              onChange={e => setAcceptancePerson(e.target.value)}
              placeholder="请输入验收人"
              style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d9d9d9' }}
            />
          </div>
        </div>
        <div style={{ maxHeight: 200, overflowY: 'auto', background: '#f5f7fa', borderRadius: 6, padding: 8 }}>
          {selectedRows.map(row => (
            <div key={row.id} style={{ padding: '4px 0', fontSize: 13, color: '#555' }}>
              {row.asset_code} - {row.asset_name}
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
};

export default AssetList;
