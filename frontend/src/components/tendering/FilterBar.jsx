import React, { useState } from 'react';
import { Input, Select, DatePicker, Button, Space } from 'antd';
import { SearchOutlined, ReloadOutlined, DownOutlined, UpOutlined } from '@ant-design/icons';
import './FilterBar.css';

const { RangePicker } = DatePicker;

/**
 * 统一风格的筛选条
 *
 * @param {Array} fields - 字段配置：[{ name, label, type, options, placeholder, width, allowClear }]
 *   type: 'input' | 'select' | 'date' | 'dateRange'
 * @param {object} values - 当前值
 * @param {function} onChange - (values) => void，字段变化时触发
 * @param {function} onSearch - 点击查询时触发
 * @param {function} onReset - 点击重置时触发
 * @param {boolean} searchLoading - 查询按钮 loading
 * @param {boolean} collapsible - 是否可折叠（多余字段收起）
 * @param {number} maxVisible - 折叠时显示几个字段，默认 3
 *
 * @example
 * <FilterBar
 *   fields={[
 *     { name: 'keyword', type: 'input', placeholder: '搜索名称/编号' },
 *     { name: 'status', type: 'select', options: [...] },
 *     { name: 'date', type: 'dateRange' },
 *   ]}
 *   values={filters}
 *   onChange={setFilters}
 *   onSearch={fetchData}
 *   onReset={() => setFilters({})}
 * />
 */
const FilterBar = ({
  fields = [],
  values = {},
  onChange,
  onSearch,
  onReset,
  searchLoading = false,
  collapsible = false,
  maxVisible = 3,
}) => {
  const [collapsed, setCollapsed] = useState(true);

  const handleFieldChange = (name, value) => {
    onChange?.({ ...values, [name]: value });
  };

  const renderField = field => {
    const { name, type = 'input', placeholder, options, width = 180, allowClear = true } = field;
    const value = values[name];
    const common = {
      allowClear,
      style: { width },
      placeholder: placeholder || field.label || '请选择',
      value: value ?? undefined,
    };

    switch (type) {
      case 'select':
        return (
          <Select
            key={name}
            {...common}
            onChange={v => handleFieldChange(name, v)}
            options={options}
          />
        );
      case 'date':
        return (
          <DatePicker
            key={name}
            {...common}
            onChange={v => handleFieldChange(name, v ? v.format('YYYY-MM-DD') : undefined)}
          />
        );
      case 'dateRange':
        return (
          <RangePicker
            key={name}
            {...common}
            onChange={v =>
              handleFieldChange(name, v && v.length === 2 ? [v[0], v[1]] : undefined)
            }
          />
        );
      case 'input':
      default:
        return (
          <Input
            key={name}
            {...common}
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            onChange={e => handleFieldChange(name, e.target.value)}
            onPressEnter={onSearch}
          />
        );
    }
  };

  const visibleFields =
    collapsible && collapsed ? fields.slice(0, maxVisible) : fields;
  const hiddenCount = fields.length - maxVisible;

  return (
    <div className="filter-bar">
      <Space wrap size={[12, 12]} className="filter-bar-fields">
        {visibleFields.map(renderField)}
        <Button
          type="primary"
          icon={<SearchOutlined />}
          onClick={onSearch}
          loading={searchLoading}
        >
          查询
        </Button>
        {onReset ? (
          <Button icon={<ReloadOutlined />} onClick={onReset}>
            重置
          </Button>
        ) : null}
        {collapsible && hiddenCount > 0 ? (
          <Button
            type="link"
            icon={collapsed ? <DownOutlined /> : <UpOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? `展开 ${hiddenCount} 项` : '收起'}
          </Button>
        ) : null}
      </Space>
    </div>
  );
};

export default FilterBar;
