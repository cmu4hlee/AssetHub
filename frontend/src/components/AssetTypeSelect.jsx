import React, { useState, useEffect, useRef } from 'react';
import { Select, Spin } from 'antd';
import { maintenanceAPI } from '../utils/api';

const { Option } = Select;

const AssetTypeSelect = ({
  value,
  onChange,
  placeholder = '请选择资产类型',
  allowClear = true,
}) => {
  const [assetTypes, setAssetTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const selectRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  const loadAssetTypes = async (keyword = '') => {
    try {
      setLoading(true);
      const response = await maintenanceAPI.getSecondaryAssetTypes({ keyword });
      if (response.success) {
        setAssetTypes(response.data || []);
      }
    } catch (error) {
      console.error('加载资产类型失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = value => {
    setSearchValue(value);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      loadAssetTypes(value);
    }, 200);
  };

  const handleFocus = () => {
    if (assetTypes.length === 0) {
      loadAssetTypes();
    }
  };

  const handleDropdownVisibleChange = open => {
    setIsDropdownOpen(open);
    if (open && assetTypes.length === 0) {
      loadAssetTypes();
    }
  };

  const handleChange = value => {
    onChange(value);
    setSearchValue('');
  };

  const handleClear = () => {
    onChange(null);
    setSearchValue('');
    setAssetTypes([]);
  };

  useEffect(() => {
    if (isDropdownOpen) {
      loadAssetTypes(searchValue);
    }
  }, [isDropdownOpen]);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  return (
    <Select
      ref={selectRef}
      value={value}
      onChange={handleChange}
      onSearch={handleSearch}
      onFocus={handleFocus}
      onDropdownVisibleChange={handleDropdownVisibleChange}
      onClear={handleClear}
      showSearch
      allowClear={allowClear}
      filterOption={false}
      placeholder={placeholder}
      loading={loading}
      notFoundContent={loading ? <Spin size="small" /> : '暂无匹配的资产类型'}
      style={{ width: '100%' }}
    >
      {assetTypes.map(assetType => (
        <Option key={assetType.id} value={assetType.name}>
          {assetType.name}
          {assetType.parent_name && (
            <span style={{ color: '#999', marginLeft: 8 }}>({assetType.parent_name})</span>
          )}
        </Option>
      ))}
    </Select>
  );
};

export default AssetTypeSelect;
