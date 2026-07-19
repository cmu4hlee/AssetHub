import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Input, Select, Space, Card, Tag, DatePicker, Statistic, Row, Col,
  Modal, Descriptions, message, Empty, Spin,
} from 'antd';
import {
  SearchOutlined, ReloadOutlined, EyeOutlined, DeleteOutlined, BarChartOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import { poctAPI } from '../../api/domains/poct';
import { ResponsiveTable } from '../../components';
import { useCan } from '../../hooks';

const { RangePicker } = DatePicker;
const RESULT_MAP = {
  pass: { color: 'success', text: '合格' },
  warn: { color: 'warning', text: '预警' },
  fail: { color: 'error', text: '不合格' },
};

const PoctRecordList = () => {
  const canDelete = useCan('poct', 'delete');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [filters, setFilters] = useState({
    keyword: '', shift_id: undefined, result: undefined, department_id: undefined,
    dateRange: [dayjs().subtract(7, 'day'), dayjs()],
  });
  const [shifts, setShifts] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [stats, setStats] = useState(null);
  const [detail, setDetail] = useState(null);

  // 加载基础数据
  useEffect(() => {
    poctAPI.getShifts().then(r => { if (r.success) setShifts(r.data); }).catch(err => { console.warn('POCT shifts load failed:', err?.message); });
    import('../../api/domains/users').then(({ departmentsAPI }) => {
      departmentsAPI.getDepartments({ pageSize: 200 }).then(r => { const list = r.data?.data || r.data || []; setDepartments(Array.isArray(list) ? list : []); }).catch(err => { console.warn('POCT depts load failed:', err?.message); });
    });
  }, []);

  const loadData = useCallback(async (page = pagination.current, pageSize = pagination.pageSize) => {
    try {
      setLoading(true);
      const [start, end] = filters.dateRange || [];
      const params = {
        page, pageSize,
        keyword: filters.keyword || undefined,
        shift_id: filters.shift_id || undefined,
        result: filters.result || undefined,
        department_id: filters.department_id || undefined,
        start_date: start?.format('YYYY-MM-DD'),
        end_date: end?.format('YYYY-MM-DD'),
      };
      const r = await poctAPI.getRecords(params);
      if (r.success) {
        setData(r.data || []);
        setPagination({ current: r.pagination?.page || page, pageSize: r.pagination?.pageSize || pageSize, total: r.pagination?.total || 0 });
      }
    } catch (e) {
      message.error('加载质控记录失败');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, filters]);

  const loadStats = useCallback(async () => {
    try {
      const [start, end] = filters.dateRange || [];
      const r = await poctAPI.getStatistics({
        start_date: start?.format('YYYY-MM-DD'),
        end_date: end?.format('YYYY-MM-DD'),
        department_id: filters.department_id || undefined,
      });
      if (r.success) setStats(r.data);
    } catch {}
  }, [filters.dateRange, filters.department_id]);

  useEffect(() => { loadData(1); loadStats(); }, [filters]);  // eslint-disable-line

  const showDetail = async (id) => {
    try {
      const r = await poctAPI.getRecordDetail(id);
      if (r.success) setDetail(r.data);
    } catch { message.error('加载详情失败'); }
  };

  const handleDelete = async (id) => {
    try {
      const r = await poctAPI.deleteRecord(id);
      if (r.success) {
        message.success('已删除');
        loadData();
      }
    } catch (e) { message.error(e.response?.data?.message || '删除失败'); }
  };

  const [exporting, setExporting] = useState(false);
  const handleExport = async () => {
    try {
      setExporting(true);
      const [start, end] = filters.dateRange || [];
      const r = await poctAPI.exportRecords({
        start_date: start?.format('YYYY-MM-DD'),
        end_date: end?.format('YYYY-MM-DD'),
        shift_id: filters.shift_id || undefined,
        result: filters.result || undefined,
        department_id: filters.department_id || undefined,
      });
      if (!r.success) throw new Error(r.data?.message || '导出失败');
      const rows = r.data || [];
      if (rows.length === 0) {
        message.warning('当前筛选无数据');
        return;
      }
      const ws = XLSX.utils.json_to_sheet(rows);
      // 设置列宽(粗略)
      ws['!cols'] = Object.keys(rows[0]).map(k => ({ wch: Math.max(k.length * 2, 12) }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '质控记录');
      const fname = `POCT质控记录_${start?.format('YYYYMMDD') || 'all'}_${end?.format('YYYYMMDD') || ''}.xlsx`;
      XLSX.writeFile(wb, fname);
      message.success(`已导出 ${rows.length} 条记录`);
    } catch (e) {
      message.error(e.response?.data?.message || e.message || '导出失败');
    } finally {
      setExporting(false);
    }
  };

  const columns = [
    { title: '记录编号', dataIndex: 'record_no', width: 170, fixed: 'left' },
    { title: '日期', dataIndex: 'record_date', width: 110 },
    {
      title: '班次', dataIndex: 'shift_name', width: 90,
      render: (t, r) => <Tag color={r.shift_color || 'blue'}>{t}</Tag>,
    },
    { title: '科室', dataIndex: 'department_name', width: 130, ellipsis: true },
    {
      title: '科目', width: 140,
      render: (_, r) => <span>{r.subject_name}<Tag style={{ marginLeft: 4 }}>{r.subject_code}</Tag></span>,
    },
    { title: '实测值', dataIndex: 'measured_value', width: 100 },
    { title: '靶值', dataIndex: 'target_value', width: 100 },
    { title: '偏差', dataIndex: 'deviation', width: 90 },
    {
      title: '结果', dataIndex: 'result', width: 90,
      render: v => <Tag color={RESULT_MAP[v]?.color}>{RESULT_MAP[v]?.text}</Tag>,
    },
    { title: '操作人', dataIndex: 'operator_name', width: 100 },
    {
      title: '签名', dataIndex: 'signature_id', width: 80,
      render: v => v ? <Tag color="cyan">已签</Tag> : <Tag>未签</Tag>,
    },
    {
      title: '操作', width: 130, fixed: 'right',
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => showDetail(r.id)}>详情</Button>
          {canDelete && <Button size="small" danger icon={<DeleteOutlined />} onClick={() => Modal.confirm({
            title: '确认删除',
            content: `记录 ${r.record_no} 将被删除,签名也会一并删除`,
            onOk: () => handleDelete(r.id),
          })} />}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* 统计卡片 */}
      {stats && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={4}><Card><Statistic title="总记录" value={stats.summary.total || 0} /></Card></Col>
          <Col span={4}><Card><Statistic title="合格" value={stats.summary.pass || 0} styles={{ content: { color: '#52c41a' } }} /></Card></Col>
          <Col span={4}><Card><Statistic title="预警" value={stats.summary.warn || 0} styles={{ content: { color: '#faad14' } }} /></Card></Col>
          <Col span={4}><Card><Statistic title="不合格" value={stats.summary.fail || 0} styles={{ content: { color: '#ff4d4f' } }} /></Card></Col>
          <Col span={4}><Card><Statistic title="合格率" value={stats.passRate || '0%'} styles={{ content: { color: '#1890ff' } }} /></Card></Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="班次分布"
                valueRender={() => (
                  <div style={{ fontSize: 12 }}>
                    {(stats.byShift || []).map(s => (
                      <div key={s.shift_name}>
                        <Tag color={s.color}>{s.shift_name}</Tag> {s.total}
                      </div>
                    ))}
                  </div>
                )}
              />
            </Card>
          </Col>
        </Row>
      )}

      <Card title={<Space><BarChartOutlined /> 质控记录</Space>} extra={
        <Space>
          <Select
            placeholder="科室"
            allowClear style={{ width: 140 }} value={filters.department_id}
            onChange={v => setFilters(f => ({ ...f, department_id: v }))}
            options={departments.map(d => ({ value: d.id, label: d.department_name || d.name }))}
          />
          <Select
            placeholder="班次" allowClear style={{ width: 120 }} value={filters.shift_id}
            onChange={v => setFilters(f => ({ ...f, shift_id: v }))}
            options={shifts.map(s => ({ value: s.id, label: s.shift_name }))}
          />
          <Select
            placeholder="结果" allowClear style={{ width: 110 }} value={filters.result}
            onChange={v => setFilters(f => ({ ...f, result: v }))}
            options={[
              { value: 'pass', label: '合格' }, { value: 'warn', label: '预警' }, { value: 'fail', label: '不合格' },
            ]}
          />
          <RangePicker
            value={filters.dateRange}
            onChange={v => setFilters(f => ({ ...f, dateRange: v }))}
            allowClear={false}
          />
          <Input.Search
            placeholder="记录编号/备注" allowClear style={{ width: 200 }}
            onSearch={v => setFilters(f => ({ ...f, keyword: v }))}
          />
          <Button icon={<ReloadOutlined />} onClick={() => loadData(1)}>刷新</Button>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            loading={exporting}
            onClick={handleExport}
          >
            导出 Excel
          </Button>
        </Space>
      }>
        <ResponsiveTable
          rowKey="id"
          loading={loading}
          dataSource={data}
          columns={columns}
          scroll={{ x: 1400 }}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: t => `共 ${t} 条`,
            onChange: (p, ps) => loadData(p, ps),
          }}
        />
      </Card>

      {/* 详情弹窗 */}
      <Modal
        title="质控记录详情" open={!!detail} onCancel={() => setDetail(null)} footer={null} width={700}
      >
        {detail ? (
          <div>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="记录编号" span={2}>{detail.record_no}</Descriptions.Item>
              <Descriptions.Item label="日期">{detail.record_date}</Descriptions.Item>
              <Descriptions.Item label="录入时间">{detail.record_time}</Descriptions.Item>
              <Descriptions.Item label="科室">{detail.department_name}</Descriptions.Item>
              <Descriptions.Item label="班次">
                <Tag color={detail.shift_color}>{detail.shift_name}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="科目" span={2}>
                {detail.subject_name} ({detail.subject_code})
              </Descriptions.Item>
              <Descriptions.Item label="实测值"><b>{detail.measured_value || '-'}</b></Descriptions.Item>
              <Descriptions.Item label="靶值">{detail.target_value || '-'}</Descriptions.Item>
              <Descriptions.Item label="偏差">{detail.deviation || '-'}</Descriptions.Item>
              <Descriptions.Item label="结果">
                <Tag color={RESULT_MAP[detail.result]?.color}>{RESULT_MAP[detail.result]?.text}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="设备">{detail.instrument || '-'}</Descriptions.Item>
              <Descriptions.Item label="试剂批号">{detail.reagent_lot || '-'}</Descriptions.Item>
              <Descriptions.Item label="温度">{detail.temperature || '-'} ℃</Descriptions.Item>
              <Descriptions.Item label="湿度">{detail.humidity || '-'} %</Descriptions.Item>
              <Descriptions.Item label="操作人">{detail.operator_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="签名时间">{detail.signed_at || '-'}</Descriptions.Item>
              <Descriptions.Item label="签名设备">{detail.sign_device || '-'}</Descriptions.Item>
              <Descriptions.Item label="备注" span={2}>{detail.remarks || '-'}</Descriptions.Item>
            </Descriptions>
            {detail.signature_data && (
              <div style={{ marginTop: 16, textAlign: 'center', padding: 12, background: '#fafafa', borderRadius: 6 }}>
                <div style={{ marginBottom: 8, color: '#666' }}>手写签名</div>
                <img src={detail.signature_data} alt="签名" style={{ maxWidth: 300, maxHeight: 150 }} />
              </div>
            )}
          </div>
        ) : <Spin />}
      </Modal>
    </div>
  );
};

export default PoctRecordList;
