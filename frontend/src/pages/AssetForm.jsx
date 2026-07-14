import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useCan, useIsMobile, useCurrentUser } from '../hooks';
import {
  Form,
  Input,
  Select,
  DatePicker,
  InputNumber,
  Button,
  message,
  Modal,
  Table,
  Upload,
  Image,
  Row,
  Col,
  Spin,
  Divider,
  Tag,
} from 'antd';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { UploadOutlined, DeleteOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { assetAPI, assetImageAPI } from '../utils/api';
import { getApiErrorMessage } from '../api/client';
import { tenderingAPI } from '../api/domains/tendering';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

const AssetForm = () => {
  const canDelete = useCan('asset', 'delete');
  const canEdit = useCan('asset', 'edit');
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const isMobile = useIsMobile();
  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [supplierLoading, setSupplierLoading] = useState(false);
  const [departmentModalVisible, setDepartmentModalVisible] = useState(false);
  const [departmentSearchText, setDepartmentSearchText] = useState('');
  const [departmentLoading, setDepartmentLoading] = useState(false);
  const { user: currentUser } = useCurrentUser();
  const userRole = currentUser?.role || '';
  const [images, setImages] = useState([]);
  const [imageLoading, setImageLoading] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [editingImageId, setEditingImageId] = useState(null);
  const [tempDescription, setTempDescription] = useState('');
  const searchTimeoutRef = useRef(null);
  const isEdit = !!id;
  // 存储资产名称，用于图片描述和预览标题
  const [assetName, setAssetName] = useState('');
  // 资产大类选择状态（一级分类）
  const [assetCategory, setAssetCategory] = useState('');
  // 当前选择的二级分类信息
  const [selectedSecondaryCategory, setSelectedSecondaryCategory] = useState(null);
  // 获取从分类选择页面传递过来的分类信息
  const selectedCategory = location.state?.selectedCategory;

  useEffect(() => {
    loadCategories();
    loadDepartments('');
    loadSuppliers('');
    if (isEdit) {
      loadAsset();
    } else {
      // 新增资产时为资产编号提供默认值，避免空白表单
      const stamp = dayjs().format('YYYYMMDDHHmmss');
      const random = Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, '0');
      form.setFieldsValue({ asset_code: `AST-${stamp}-${random}` });
    }
  }, [id, form]);

  // 当有选择的分类时，初始化表单
  // 加载一级分类的子分类（使用useCallback优化）
  const loadSubCategories = useCallback(async parentId => {
    try {
      const result = await assetAPI.getCategories({ parent_id: parentId });
      if (result.success) {
        setSubCategories(result.data);
      } else {
        message.warning('加载子分类失败');
      }
    } catch (error) {
      console.error('加载子分类失败:', error);
      message.error('加载子分类失败');
    }
  }, []);

  useEffect(() => {
    if (selectedCategory) {
      setAssetCategory(selectedCategory.name);
      form.setFieldsValue({
        category_id: selectedCategory.id,
        category_secondary_id: undefined,
      });
      // 加载该一级分类的子分类
      loadSubCategories(selectedCategory.id);
      setSelectedSecondaryCategory(null);
    }
  }, [selectedCategory, form, loadSubCategories]);

  // 监听分类变化，强制更新字段显示（确保字段能正确显示/隐藏）
  useEffect(() => {
    // 当分类或二级分类变化时，触发表单重新渲染
    if (assetCategory || selectedSecondaryCategory) {
      // 使用setTimeout确保状态更新后再触发
      const timer = setTimeout(() => {
        form.validateFields().catch(() => {});
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [assetCategory, selectedSecondaryCategory, form]);

  // 临时清空字段函数（避免循环依赖，在clearCategoryFields定义前使用）
  const clearFieldsTemporary = useCallback(() => {
    const allFields = [
      'brand',
      'model',
      'serial_number',
      'specification',
      'license_plate',
      'vehicle_type',
      'engine_number',
      'vin_number',
      'property_certificate',
      'property_address',
      'land_area',
      'building_area',
      'land_use_right',
      'building_structure',
    ];
    const clearValues = {};
    allFields.forEach(field => {
      clearValues[field] = undefined;
    });
    form.setFieldsValue(clearValues);
  }, [form]);

  // 监听category_id变化，动态更新资产大类
  // 使用useCallback优化性能
  const handleCategoryChange = useCallback(
    value => {
      if (value) {
        // 从已加载的分类列表中查找分类名称
        const category = categories.find(cat => cat.id === value);
        if (category) {
          setAssetCategory(category.name);
          // 加载该一级分类的子分类
          loadSubCategories(category.id);
          // 重置二级分类选择和状态
          form.setFieldsValue({ category_secondary_id: undefined });
          setSelectedSecondaryCategory(null);
          // 清空分类相关的字段值
          clearFieldsTemporary();
        } else {
          // 如果本地没有找到，尝试从服务器获取
          assetAPI
            .getCategories()
            .then(result => {
              if (result.success) {
                const foundCategory = result.data.find(cat => cat.id === value);
                if (foundCategory) {
                  setCategories(result.data); // 更新分类列表
                  setAssetCategory(foundCategory.name);
                  // 加载该一级分类的子分类
                  loadSubCategories(foundCategory.id);
                  // 重置二级分类
                  form.setFieldsValue({ category_secondary_id: undefined });
                  setSelectedSecondaryCategory(null);
                  clearFieldsTemporary();
                }
              }
            })
            .catch(error => {
              console.error('获取分类信息失败:', error);
              message.error('获取分类信息失败');
            });
        }
      } else {
        setAssetCategory('');
        setSubCategories([]);
        setSelectedSecondaryCategory(null);
        clearFieldsTemporary();
      }
    },
    [categories, form, loadSubCategories, clearFieldsTemporary]
  );

  const loadCategories = async () => {
    try {
      const result = await assetAPI.getCategories();
      if (result.success) {
        setCategories(result.data);
      }
    } catch (error) {
      console.error('加载分类失败:', error);
    }
  };

  const loadDepartments = async (keyword = '') => {
    try {
      setDepartmentLoading(true);
      const result = await assetAPI.getDepartments(keyword.trim());
      if (result.success) {
        setDepartments(result.data);
      }
    } catch (error) {
      console.error('加载部门列表失败:', error);
      message.error('加载部门列表失败');
    } finally {
      setDepartmentLoading(false);
    }
  };

  const loadSuppliers = async (keyword = '') => {
    try {
      setSupplierLoading(true);
      const result = await tenderingAPI.getSupplierSelectList({ keyword: keyword.trim() });
      if (result.success) {
        setSuppliers(result.data || []);
      }
    } catch (error) {
      console.error('加载供应商列表失败:', error);
    } finally {
      setSupplierLoading(false);
    }
  };

  // 获取资产图片
  const fetchAssetImages = async assetCode => {
    try {
      setImageLoading(true);
      const imagesData = await assetAPI.getAssetImages(assetCode);
      if (imagesData.success) {
        setImages(imagesData.data);
      } else {
        message.warning('未找到资产图片');
      }
    } catch (error) {
      console.error('获取资产图片错误:', error);
      // 忽略图片获取错误，不影响主页面显示
    } finally {
      setImageLoading(false);
    }
  };

  // 处理图片预览
  const handlePreview = file => {
    setPreviewImage(file);
    setPreviewVisible(true);
    setPreviewTitle(file.name || file.url.substring(file.url.lastIndexOf('/') + 1));
  };

  // 关闭预览模态框
  const handleCancelPreview = () => {
    setPreviewVisible(false);
  };

  // 处理图片上传
  const handleUpload = async file => {
    const assetData = form.getFieldsValue();
    if (!assetData.asset_code) {
      message.error('请先保存资产，获取资产编号后再上传图片');
      return false;
    }

    setUploading(true);
    try {
      const response = await assetImageAPI.uploadImages(assetData.asset_code, [file]);
      if (response.success) {
        message.success('图片上传成功');
        // 更新图片列表
        fetchAssetImages(assetData.asset_code);
      } else {
        message.error(response.message || '图片上传失败');
      }
    } catch (error) {
      console.error('上传图片错误:', error);
      message.error(getApiErrorMessage(error, '图片上传失败'));
    } finally {
      setUploading(false);
    }

    return false; // 阻止自动上传，我们手动处理
  };

  // 处理图片删除
  const handleDelete = async imageId => {
    try {
      const response = await assetImageAPI.deleteImage(imageId);
      if (response.success) {
        message.success('图片删除成功');
        // 更新图片列表
        const assetData = form.getFieldsValue();
        if (assetData.asset_code) {
          fetchAssetImages(assetData.asset_code);
        }
      } else {
        message.error('图片删除失败');
      }
    } catch (error) {
      console.error('删除图片错误:', error);
      message.error('图片删除失败');
    }
  };

  // 开始编辑图片描述
  const handleStartEditDescription = image => {
    setEditingImageId(image.id);
    setTempDescription(image.description || '');
  };

  // 取消编辑图片描述
  const handleCancelEditDescription = () => {
    setEditingImageId(null);
    setTempDescription('');
  };

  // 保存图片描述
  const handleSaveDescription = async imageId => {
    try {
      const response = await assetImageAPI.updateImageDescription(imageId, tempDescription);
      if (response.success) {
        message.success('图片描述更新成功');
        // 更新图片列表
        const assetData = form.getFieldsValue();
        if (assetData.asset_code) {
          fetchAssetImages(assetData.asset_code);
        }
        setEditingImageId(null);
        setTempDescription('');
      } else {
        message.error('图片描述更新失败');
      }
    } catch (error) {
      console.error('更新图片描述错误:', error);
      message.error('图片描述更新失败');
    }
  };

  const handleSelectDepartment = record => {
    const departmentName = record.department_name || record.name || '';
    const departmentCode = record.department_code || record.code || '';
    form.setFieldsValue({
      department: departmentName,
      department_new: departmentCode,
    });
    form.setFields([
      {
        name: 'department',
        value: departmentName,
        touched: true,
      },
      {
        name: 'department_new',
        value: departmentCode,
        touched: true,
      },
    ]);
    setDepartmentModalVisible(false);
    setDepartmentSearchText('');
  };

  const departmentColumns = [
    {
      title: '部门编码',
      dataIndex: 'department_code',
      key: 'department_code',
      render: (value, record) => value || record.code || '-',
    },
    {
      title: '部门名称',
      dataIndex: 'department_name',
      key: 'department_name',
      render: (value, record) => value || record.name || '-',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button type="link" onClick={() => handleSelectDepartment(record)}>
          选择
        </Button>
      ),
    },
  ];

  const loadAsset = async () => {
    try {
      setLoading(true);
      // 确保分类已加载
      if (categories.length === 0) {
        await loadCategories();
      }
      const result = await assetAPI.getAsset(id);
      if (result.success) {
        const asset = result.data;
        form.setFieldsValue({
          ...asset,
          purchase_date: asset.purchase_date ? dayjs(asset.purchase_date) : null,
          warranty_end_date: asset.warranty_end_date ? dayjs(asset.warranty_end_date) : null,
          original_created_at: asset.original_created_at ? dayjs(asset.original_created_at) : null,
        });
        // 更新资产名称状态
        setAssetName(asset.asset_name || '');
        // 设置资产大类（不再使用asset_type字段，使用category_id获取）
        if (asset.category_id) {
          // 从分类列表中查找对应的分类名称
          const category = categories.find(cat => cat.id === asset.category_id);
          if (category) {
            setAssetCategory(category.name);
          }
          // 加载该一级分类的子分类
          await loadSubCategories(asset.category_id);
          // 如果存在二级分类，设置二级分类状态
          if (asset.category_secondary_id) {
            const subCategoryResult = await assetAPI.getCategories({
              parent_id: asset.category_id,
            });
            if (subCategoryResult.success) {
              const subCategory = subCategoryResult.data.find(
                cat => cat.id === asset.category_secondary_id
              );
              if (subCategory) {
                setSelectedSecondaryCategory(subCategory);
              }
            }
          }
        }
        // 获取资产图片
        if (asset.asset_code) {
          fetchAssetImages(asset.asset_code);
        } else {
          setImageLoading(false);
          setImages([]);
        }
      }
    } catch (error) {
      message.error('加载资产信息失败');
    } finally {
      setLoading(false);
    }
  };

  // 所有分类相关字段列表（提取为常量，避免重复创建）
  const ALL_CATEGORY_FIELDS = useMemo(
    () => [
      'brand',
      'model',
      'serial_number',
      'specification',
      'license_plate',
      'vehicle_type',
      'engine_number',
      'vin_number',
      'property_certificate',
      'property_address',
      'land_area',
      'building_area',
      'land_use_right',
      'building_structure',
    ],
    []
  );

  // 分类字段配置映射表 - 详细规则
  // 优先级：精确编码匹配 > 编码前缀匹配 > 名称关键词匹配 > 描述关键词匹配 > 一级分类默认
  const getCategoryFields = useCallback(
    function (category) {
      if (!category) return [];

      const categoryName = (category.name || '').toLowerCase();
      const categoryCode = (category.code || '').toLowerCase();
      const categoryDesc = (category.description || '').toLowerCase();

      // 简单的默认实现，避免复杂的条件判断
      return getDefaultFieldsByCategory(assetCategory);
    },
    [assetCategory]
  );

  // 清空分类相关字段的函数（放在getCategoryFields之后，避免循环依赖）
  const clearCategoryFields = useCallback(
    (keepCategory = null) => {
      if (keepCategory) {
        // 获取应该保留的字段
        const keepFields = getCategoryFields(keepCategory);
        // 清空不在保留列表中的字段
        const fieldsToClear = ALL_CATEGORY_FIELDS.filter(field => !keepFields.includes(field));
        const clearValues = {};
        fieldsToClear.forEach(field => {
          clearValues[field] = undefined;
        });
        form.setFieldsValue(clearValues);
      } else {
        // 清空所有分类相关字段
        const clearValues = {};
        ALL_CATEGORY_FIELDS.forEach(field => {
          clearValues[field] = undefined;
        });
        form.setFieldsValue(clearValues);
      }
    },
    [ALL_CATEGORY_FIELDS, form, getCategoryFields]
  );

  // 根据一级分类获取默认字段（使用useMemo缓存映射表）
  const fieldMappings = useMemo(
    () => ({
      // 医疗设备类
      医疗设备: [
        'brand',
        'model',
        'serial_number',
        'specification',
        'location',
        'storage_location',
        'warranty_period',
        'warranty_end_date',
      ],
      // 普通设备类（包括办公设备、电子设备等）
      普通设备: [
        'brand',
        'model',
        'serial_number',
        'specification',
        'location',
        'storage_location',
        'warranty_period',
        'warranty_end_date',
      ],
      // 办公家具类
      办公家具: ['brand', 'model', 'specification', 'location', 'storage_location'],
      // 车辆类
      车辆: [
        'brand',
        'model',
        'license_plate',
        'vehicle_type',
        'engine_number',
        'vin_number',
        'location',
        'storage_location',
      ],
      // 土地建筑类
      土地建筑: [
        'property_certificate',
        'property_address',
        'land_area',
        'building_area',
        'land_use_right',
        'building_structure',
        'location',
      ],
      // 房产建筑类
      房产建筑: [
        'property_certificate',
        'property_address',
        'building_area',
        'building_structure',
        'location',
      ],
      // 其他类
      其他: ['brand', 'model', 'specification', 'location'],
      // 电子设备类
      电子设备: [
        'brand',
        'model',
        'serial_number',
        'specification',
        'location',
        'storage_location',
        'warranty_period',
        'warranty_end_date',
      ],
      // 无形资产类
      无形资产: ['specification', 'location'],
    }),
    []
  );

  // 根据一级分类获取默认字段
  const getDefaultFieldsByCategory = useCallback(
    categoryName => {
      if (!categoryName) return [];

      const categoryNameLower = categoryName.toLowerCase();

      // 精确匹配
      if (fieldMappings[categoryName]) {
        return fieldMappings[categoryName];
      }

      // 模糊匹配（支持部分匹配）
      for (const [key, fields] of Object.entries(fieldMappings)) {
        if (
          categoryNameLower.includes(key.toLowerCase()) ||
          key.toLowerCase().includes(categoryNameLower)
        ) {
          return fields;
        }
      }

      // 默认返回基础字段
      return ['brand', 'model', 'specification', 'location'];
    },
    [fieldMappings]
  );

  // 基本信息字段和通用字段（使用useMemo缓存）
  const basicFields = useMemo(
    () => ['asset_code', 'code', 'code2', 'code3', 'asset_name', 'category_id'],
    []
  );
  const commonFields = useMemo(
    () => [
      'asset_code',
      'code',
      'code2',
      'code3',
      'asset_name',
      'category_id',
      'category_secondary_id',
      'purchase_date',
      'purchase_price',
      'current_value',
      'depreciation_method',
      'depreciation_years',
      'department',
      'department_new',
      'unit',
      'responsible_person',
      'status',
      'supplier',
      'remark',
      'data_id',
      'original_created_at',
    ],
    []
  );

  // 根据资产大类和二级分类判断需要显示的字段（使用useCallback优化）
  const shouldShowField = useCallback(
    fieldName => {
      // 当未选择分类时，只显示基本信息
      if (!assetCategory) {
        return basicFields.includes(fieldName);
      }

      // 所有类别都显示的通用字段
      if (commonFields.includes(fieldName)) return true;

      // 优先根据二级分类显示字段（如果选择了二级分类）
      if (selectedSecondaryCategory) {
        const categoryFields = getCategoryFields(selectedSecondaryCategory);
        return categoryFields.includes(fieldName);
      }

      // 如果没有选择二级分类，根据一级分类显示默认字段
      const defaultFields = getDefaultFieldsByCategory(assetCategory);
      return defaultFields.includes(fieldName);
    },
    [
      assetCategory,
      selectedSecondaryCategory,
      basicFields,
      commonFields,
      getCategoryFields,
      getDefaultFieldsByCategory,
    ]
  );

  const handleSubmit = async values => {
    try {
      setLoading(true);
      // 创建数据对象，排除asset_type字段
      const { asset_type, ...restValues } = values;
      const operatorName =
        currentUser?.real_name || currentUser?.username || currentUser?.name || '系统';
      const data = {
        ...restValues,
        purchase_date: values.purchase_date ? values.purchase_date.format('YYYY-MM-DD') : null,
        warranty_end_date: values.warranty_end_date
          ? values.warranty_end_date.format('YYYY-MM-DD')
          : null,
        original_created_at: values.original_created_at
          ? values.original_created_at.format('YYYY-MM-DD HH:mm:ss')
          : null,
        created_by: operatorName,
        updated_by: operatorName,
      };

      if (!isEdit) {
        const dupResult = await assetAPI.checkAssetCodeDuplicate(data.asset_code);
        if (dupResult?.success && dupResult.data?.exists) {
          message.error('资产编号已存在，请使用其他编号');
          return;
        }
      }

      let result;
      if (isEdit) {
        result = await assetAPI.updateAsset(id, data);
      } else {
        result = await assetAPI.createAsset(data);
      }

      if (result.success) {
        message.success(isEdit ? '更新成功' : '添加成功');
        // 跳转到资产详情页，方便用户继续上传图片/技术资料/分享链接
        navigate(`/assets/${data.asset_code}`);
      }
    } catch (error) {
      // 用 getApiErrorMessage 提取后端 message（如"资产编号已存在"、"部门不存在"等），
      // interceptor 也会弹 400 的后端消息，这里再弹一次是为了让 fallback 场景也能提示。
      // 抑制 interceptor 的 toast 避免重复弹窗。
      const apiError = error;
      apiError.config = { ...(error?.config || {}), __suppressErrorToast: true };
      message.error(getApiErrorMessage(error, isEdit ? '更新失败' : '添加失败'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 style={{ fontSize: isMobile ? '18px' : '24px', marginBottom: isMobile ? 16 : 24 }}>
        {isEdit ? '编辑资产' : '添加资产'}
      </h2>
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        style={{ maxWidth: isMobile ? '100%' : 800 }}
      >
        {/* 资产大类不再使用单独字段，由category_id决定 */}

        <Form.Item
          name="asset_code"
          label="资产编号"
          validateFirst
          rules={[
            { required: true, message: '请输入资产编号' },
            { max: 64, message: '资产编号长度不能超过 64 个字符' },
            {
              validator: async (_, value) => {
                if (isEdit || !value) return Promise.resolve();
                try {
                  const result = await assetAPI.checkAssetCodeDuplicate(value);
                  if (result?.success && result?.data?.exists) {
                    return Promise.reject(new Error('资产编号已存在，请使用其他编号'));
                  }
                } catch (error) {
                  if (error?.response?.status === 400) return Promise.resolve();
                  return Promise.reject(new Error('资产编号校验失败，请稍后重试'));
                }
                return Promise.resolve();
              },
            },
          ]}
        >
          <Input disabled={isEdit} placeholder="请输入资产编号" allowClear={!isEdit} />
        </Form.Item>

        <Form.Item name="code" label="原始编码 (code)">
          <Input placeholder="请输入原始编码code" disabled={isEdit} />
        </Form.Item>

        <Form.Item name="code2" label="原始编码 (code2)">
          <Input placeholder="请输入原始编码code2" disabled={isEdit} />
        </Form.Item>

        <Form.Item name="code3" label="原始编码 (code3)">
          <Input placeholder="请输入原始编码code3" disabled={isEdit} />
        </Form.Item>

        <Form.Item
          name="asset_name"
          label="资产名称"
          rules={[{ required: true, message: '请输入资产名称' }]}
          onChange={e => setAssetName(e.target.value)}
        >
          <Input placeholder="请输入资产名称" />
        </Form.Item>

        {/* 一级分类 */}
        <Form.Item
          name="category_id"
          label="一级分类"
          rules={[{ required: true, message: '请选择一级分类' }]}
        >
          <Select
            placeholder="请选择一级分类"
            onChange={handleCategoryChange}
            showSearch
            filterOption={(input, option) => {
              const category = categories.find(cat => cat.id === option.value);
              if (!category) return false;
              return (
                category.name.toLowerCase().includes(input.toLowerCase()) ||
                (category.code && category.code.toLowerCase().includes(input.toLowerCase()))
              );
            }}
          >
            {categories
              .filter(cat => !cat.parent_id || cat.parent_id === 0)
              .map(cat => (
                <Option key={cat.id} value={cat.id}>
                  {cat.name}
                </Option>
              ))}
          </Select>
        </Form.Item>

        {/* 二级分类（从所选一级分类的子分类中选择） */}
        {subCategories.length > 0 && (
          <Form.Item
            name="category_secondary_id"
            label="二级分类"
            rules={[{ required: true, message: '请选择二级分类' }]}
          >
            <Select
              placeholder="请选择二级分类"
              onChange={value => {
                // 当选择二级分类时，获取对应的分类信息
                if (value) {
                  const selectedSubCategory = subCategories.find(cat => cat.id === value);
                  if (selectedSubCategory) {
                    // 保存二级分类信息
                    setSelectedSecondaryCategory(selectedSubCategory);
                    // 从分类列表中查找对应的一级分类
                    const parentCategory = categories.find(
                      cat => cat.id === selectedSubCategory.parent_id
                    );
                    if (parentCategory) {
                      setAssetCategory(parentCategory.name);
                      // 确保category_id字段也被更新
                      form.setFieldsValue({ category_id: parentCategory.id });
                    }
                    // 清空不相关的字段值
                    // 获取应该保留的字段
                    const keepFields = getCategoryFields(selectedSubCategory);
                    // 清空不在保留列表中的字段
                    const fieldsToClear = ALL_CATEGORY_FIELDS.filter(
                      field => !keepFields.includes(field)
                    );
                    const clearValues = {};
                    fieldsToClear.forEach(field => {
                      clearValues[field] = undefined;
                    });
                    form.setFieldsValue(clearValues);
                    // 强制触发表单重新渲染，确保字段显示更新
                    form.validateFields().catch(() => {});
                  }
                } else {
                  setSelectedSecondaryCategory(null);
                  clearFieldsTemporary();
                }
              }}
              showSearch
              filterOption={(input, option) => {
                const category = subCategories.find(cat => cat.id === option.value);
                if (!category) return false;
                return (
                  category.name.toLowerCase().includes(input.toLowerCase()) ||
                  (category.code && category.code.toLowerCase().includes(input.toLowerCase()))
                );
              }}
            >
              {subCategories.map(cat => (
                <Option key={cat.id} value={cat.id}>
                  {cat.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
        )}

        {/* 医疗设备、普通设备、家具类字段 */}
        {shouldShowField('brand') && (
          <Form.Item name="brand" label="品牌">
            <Input placeholder="请输入品牌" />
          </Form.Item>
        )}

        {shouldShowField('model') && (
          <Form.Item
            name="model"
            label="型号"
            rules={[{ max: 20, message: '型号长度不能超过20个字符' }]}
          >
            <Input placeholder="请输入型号" maxLength={20} />
          </Form.Item>
        )}

        {shouldShowField('serial_number') && (
          <Form.Item name="serial_number" label="出厂编号">
            <Input placeholder="请输入出厂编号" />
          </Form.Item>
        )}

        {shouldShowField('specification') && (
          <Form.Item name="specification" label="规格参数">
            <TextArea rows={3} placeholder="请输入规格参数" />
          </Form.Item>
        )}

        {/* 车辆专用字段 */}
        {shouldShowField('license_plate') && (
          <Form.Item
            name="license_plate"
            label="车牌号码"
            rules={assetCategory === '车辆' ? [{ required: true, message: '请输入车牌号码' }] : []}
          >
            <Input placeholder="请输入车牌号码" />
          </Form.Item>
        )}

        {shouldShowField('vehicle_type') && (
          <Form.Item name="vehicle_type" label="车辆类型">
            <Select placeholder="请选择车辆类型">
              <Option value="轿车">轿车</Option>
              <Option value="SUV">SUV</Option>
              <Option value="MPV">MPV</Option>
              <Option value="货车">货车</Option>
              <Option value="客车">客车</Option>
              <Option value="特种车辆">特种车辆</Option>
              <Option value="其他">其他</Option>
            </Select>
          </Form.Item>
        )}

        {shouldShowField('engine_number') && (
          <Form.Item name="engine_number" label="发动机号">
            <Input placeholder="请输入发动机号" />
          </Form.Item>
        )}

        {shouldShowField('vin_number') && (
          <Form.Item name="vin_number" label="车架号（VIN码）">
            <Input placeholder="请输入车架号（VIN码）" />
          </Form.Item>
        )}

        {/* 土地建筑专用字段 */}
        {shouldShowField('property_certificate') && (
          <Form.Item
            name="property_certificate"
            label="产权证号"
            rules={
              assetCategory === '土地建筑' ? [{ required: true, message: '请输入产权证号' }] : []
            }
          >
            <Input placeholder="请输入产权证号" />
          </Form.Item>
        )}

        {shouldShowField('property_address') && (
          <Form.Item
            name="property_address"
            label="坐落地址"
            rules={
              assetCategory === '土地建筑' ? [{ required: true, message: '请输入坐落地址' }] : []
            }
          >
            <Input placeholder="请输入坐落地址" />
          </Form.Item>
        )}

        {shouldShowField('land_area') && (
          <Form.Item name="land_area" label="土地面积（平方米）">
            <InputNumber style={{ width: '100%' }} min={0} placeholder="请输入土地面积" />
          </Form.Item>
        )}

        {shouldShowField('building_area') && (
          <Form.Item name="building_area" label="建筑面积（平方米）">
            <InputNumber style={{ width: '100%' }} min={0} placeholder="请输入建筑面积" />
          </Form.Item>
        )}

        {shouldShowField('land_use_right') && (
          <Form.Item name="land_use_right" label="土地使用权类型">
            <Select placeholder="请选择土地使用权类型">
              <Option value="国有土地使用权">国有土地使用权</Option>
              <Option value="集体土地使用权">集体土地使用权</Option>
              <Option value="划拨">划拨</Option>
              <Option value="出让">出让</Option>
              <Option value="其他">其他</Option>
            </Select>
          </Form.Item>
        )}

        {shouldShowField('building_structure') && (
          <Form.Item name="building_structure" label="建筑结构">
            <Select placeholder="请选择建筑结构">
              <Option value="框架结构">框架结构</Option>
              <Option value="砖混结构">砖混结构</Option>
              <Option value="钢结构">钢结构</Option>
              <Option value="木结构">木结构</Option>
              <Option value="其他">其他</Option>
            </Select>
          </Form.Item>
        )}

        {/* 通用字段 */}
        {shouldShowField('storage_location') && (
          <Form.Item name="storage_location" label="存放地点">
            <Input placeholder="请输入存放地点" />
          </Form.Item>
        )}

        {shouldShowField('location') && (
          <Form.Item name="location" label="存放位置">
            <Input placeholder="请输入存放位置" />
          </Form.Item>
        )}

        {shouldShowField('responsible_person') && (
          <Form.Item name="responsible_person" label="责任人">
            <Input placeholder="请输入责任人" />
          </Form.Item>
        )}

        {shouldShowField('warranty_period') && (
          <Form.Item
            name="warranty_period"
            label="保修期（月）"
            rules={[
              {
                validator: async (_, value) => {
                  if (value === undefined || value === null) return Promise.resolve();
                  if (value < 0) {
                    return Promise.reject(new Error('保修期不能为负数'));
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
        )}

        {shouldShowField('warranty_end_date') && (
          <Form.Item
            name="warranty_end_date"
            label="保修到期日"
            rules={[
              {
                validator: async (_, value) => {
                  if (!value) return Promise.resolve();
                  const purchaseDate = form.getFieldValue('purchase_date');
                  if (purchaseDate && value.isBefore(purchaseDate, 'day')) {
                    return Promise.reject(new Error('保修到期日不能早于购置日期'));
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        )}

        {shouldShowField('remark') && (
          <Form.Item name="remark" label="备注">
            <TextArea rows={3} placeholder="请输入备注" />
          </Form.Item>
        )}

        {shouldShowField('unit') && (
          <Form.Item name="unit" label="单位">
            <Input placeholder="请输入单位" disabled={isEdit && userRole !== 'system_admin'} />
          </Form.Item>
        )}

        {shouldShowField('status') && (
          <Form.Item name="status" label="资产状态">
            <Select placeholder="请选择资产状态">
              <Option value="在用">在用</Option>
              <Option value="闲置">闲置</Option>
              <Option value="维修">维修</Option>
              <Option value="报废">报废</Option>
              <Option value="调配中">调配中</Option>
            </Select>
          </Form.Item>
        )}

        {shouldShowField('supplier') && (
          <Form.Item name="supplier" label="供应商">
            <Select
              placeholder="请选择或输入供应商"
              showSearch
              allowClear
              mode="combobox"
              loading={supplierLoading}
              defaultActiveFirstOption={false}
              filterOption={false}
              onSearch={value => {
                if (searchTimeoutRef.current) {
                  clearTimeout(searchTimeoutRef.current);
                }
                searchTimeoutRef.current = setTimeout(() => {
                  loadSuppliers(value);
                }, 300);
              }}
              onFocus={() => loadSuppliers('')}
            >
              {suppliers.map(s => (
                <Option key={s.id} value={s.supplier_name}>
                  {s.supplier_name}
                </Option>
              ))}
            </Select>
          </Form.Item>
        )}

        {shouldShowField('purchase_date') && (
          <Form.Item
            name="purchase_date"
            label="购置日期"
            rules={[
              {
                validator: async (_, value) => {
                  const warranty = form.getFieldValue('warranty_end_date');
                  if (value && warranty && warranty.isBefore(value, 'day')) {
                    return Promise.reject(new Error('购置日期不能晚于保修到期日'));
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        )}

        {shouldShowField('purchase_price') && (
          <Form.Item
            name="purchase_price"
            label="购置价格"
            rules={[
              {
                validator: async (_, value) => {
                  if (value === undefined || value === null) return Promise.resolve();
                  if (value < 0) {
                    return Promise.reject(new Error('购置价格不能为负数'));
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <InputNumber style={{ width: '100%' }} min={0} placeholder="请输入购置价格" />
          </Form.Item>
        )}

        {shouldShowField('current_value') && (
          <Form.Item
            name="current_value"
            label="当前价值"
            rules={[
              {
                validator: async (_, value) => {
                  if (value === undefined || value === null) return Promise.resolve();
                  if (value < 0) {
                    return Promise.reject(new Error('当前价值不能为负数'));
                  }
                  const purchasePrice = form.getFieldValue('purchase_price');
                  if (
                    purchasePrice !== undefined &&
                    purchasePrice !== null &&
                    value > purchasePrice
                  ) {
                    return Promise.reject(new Error('当前价值不能大于购置价格'));
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <InputNumber style={{ width: '100%' }} min={0} placeholder="请输入当前价值" />
          </Form.Item>
        )}

        {shouldShowField('depreciation_method') && (
          <Form.Item name="depreciation_method" label="折旧方式">
            <Select placeholder="请选择折旧方式">
              <Option value="平均年限法">平均年限法</Option>
              <Option value="工作量法">工作量法</Option>
              <Option value="双倍余额递减法">双倍余额递减法</Option>
              <Option value="年数总和法">年数总和法</Option>
              <Option value="不计提折旧">不计提折旧</Option>
            </Select>
          </Form.Item>
        )}

        {shouldShowField('depreciation_years') && (
          <Form.Item name="depreciation_years" label="折旧年限（年）">
            <InputNumber style={{ width: '100%' }} min={0} placeholder="请输入折旧年限" />
          </Form.Item>
        )}

        {shouldShowField('department') && (
          <>
            <Form.Item name="department" label="使用部门">
              <Input
                placeholder="请选择使用部门"
                readOnly
                onClick={() => setDepartmentModalVisible(true)}
                style={{ cursor: 'pointer' }}
              />
            </Form.Item>
            <Form.Item name="department_new" hidden>
              <Input />
            </Form.Item>
          </>
        )}

        <Form.Item name="data_id" label="数据ID" extra="用于系统集成的数据标识">
          <Input placeholder="请输入数据ID" />
        </Form.Item>

        <Form.Item name="original_created_at" label="原始创建时间">
          <DatePicker style={{ width: '100%' }} showTime />
        </Form.Item>

        <Divider titlePlacement="left">资产图片</Divider>

        {/* 图片上传区域 */}
        <div style={{ marginBottom: 16 }}>
          {isMobile ? (
            <Upload
              multiple
              accept="image/*"
              capture="environment"
              showUploadList={false}
              beforeUpload={async file => {
                const assetData = form.getFieldsValue();
                if (!assetData.asset_code) {
                  message.error('请先保存资产，获取资产编号后再上传图片');
                  return false;
                }
                setUploading(true);
                try {
                  const response = await assetImageAPI.uploadImages(assetData.asset_code, [file]);
                  if (response.success) {
                    message.success('图片上传成功');
                    fetchAssetImages(assetData.asset_code);
                  } else {
                    message.error(response.message || '图片上传失败');
                  }
                } catch (error) {
                  console.error('上传图片错误:', error);
                  message.error(getApiErrorMessage(error, '图片上传失败'));
                } finally {
                  setUploading(false);
                }
                return false;
              }}
            >
              <Button icon={<UploadOutlined />} loading={uploading} block>
                {uploading ? '上传中...' : '拍照/从相册选择'}
              </Button>
            </Upload>
          ) : (
            <>
              <input
                type="file"
                multiple
                accept="image/*"
                style={{ display: 'none' }}
                id="asset-form-image-upload"
                onChange={async e => {
                  const assetData = form.getFieldsValue();
                  if (!assetData.asset_code) {
                    message.error('请先保存资产，获取资产编号后再上传图片');
                    return;
                  }

                  const files = Array.from(e.target.files);
                  if (files.length === 0) return;

                  setUploading(true);
                  try {
                    const response = await assetImageAPI.uploadImages(assetData.asset_code, files);
                    if (response.success) {
                      message.success('图片上传成功');
                      fetchAssetImages(assetData.asset_code);
                    } else {
                      message.error(response.message || '图片上传失败');
                    }
                  } catch (error) {
                    console.error('上传图片错误:', error);
                    message.error(getApiErrorMessage(error, '图片上传失败'));
                  } finally {
                    setUploading(false);
                    e.target.value = '';
                  }
                }}
              />
              <label htmlFor="asset-form-image-upload">
                <Button icon={<UploadOutlined />} loading={uploading} style={{ cursor: 'pointer' }}>
                  上传图片
                </Button>
              </label>
              <span style={{ marginLeft: 8, color: '#666', fontSize: '12px' }}>
                支持jpg、png等图片格式，单个文件不超过5MB
              </span>
            </>
          )}
        </div>

        {/* 图片展示区域 */}
        {imageLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
            <Spin size="large" />
          </div>
        ) : images.length > 0 ? (
          <Row gutter={[16, 16]}>
            {images.map((image, index) => (
              <Col key={`asset-form-image-${image.id || index}`} xs={24} sm={12} md={8} lg={6}>
                <div
                  style={{ border: '1px solid #f0f0f0', borderRadius: '4px', overflow: 'hidden' }}
                >
                  <Image
                    src={image.temp_file_url || ''}
                    alt={`${assetName || '资产图片'}-${index + 1}`}
                    style={{ width: '100%', height: '180px', objectFit: 'contain' }}
                    placeholder={
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          height: '180px',
                        }}
                      >
                        加载中...
                      </div>
                    }
                    preview={{
                      open: previewVisible,
                      onOpenChange: setPreviewVisible,
                      afterOpenChange: visible => {
                        if (visible) {
                          setPreviewImage(image.temp_file_url || '');
                          setPreviewTitle(`${assetName || '资产图片'}-${index + 1}`);
                        }
                      },
                      src: image.temp_file_url || '',
                      title: `${assetName || '资产图片'}-${index + 1}`,
                    }}
                    lazy
                  />

                  {/* 图片描述区域 */}
                  <div style={{ marginTop: 8, padding: 8, borderTop: '1px solid #f0f0f0' }}>
                    {editingImageId === image.id ? (
                      <div>
                        <Input.TextArea
                          rows={2}
                          value={tempDescription}
                          onChange={e => setTempDescription(e.target.value)}
                          placeholder="请输入图片描述"
                          style={{ marginBottom: 8 }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                          <Button
                            type="primary"
                            size="small"
                            onClick={() => handleSaveDescription(image.id)}
                          >
                            保存
                          </Button>
                          <Button size="small" onClick={handleCancelEditDescription}>
                            取消
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span
                          style={{ color: '#666', fontSize: '12px' }}
                          title={image.description || '无描述'}
                        >
                          {image.description || '无描述'}
                        </span>
                        <div>
                          <Button
                            type="text"
                            size="small"
                            onClick={() => handleStartEditDescription(image)}
                            style={{ marginRight: 8 }}
                          >
                            编辑
                          </Button>
                          <Button
                            type="text"
                            size="small"
                            danger
                            onClick={() => handleDelete(image.id)}
                            icon={<DeleteOutlined />}
                          >
                            删除
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Col>
            ))}
          </Row>
        ) : (
          <div
            style={{
              textAlign: 'center',
              padding: '40px',
              backgroundColor: '#f5f5f5',
              borderRadius: '4px',
            }}
          >
            <p>该资产暂无图片</p>
          </div>
        )}

        {/* 图片预览模态框 */}
        <Modal
          open={previewVisible}
          title={previewTitle}
          footer={null}
          onCancel={handleCancelPreview}
          width={800}
        >
          <Image alt={previewTitle} src={previewImage} style={{ width: '100%' }} />
        </Modal>

        {/* 选择部门模态框 */}
        <Modal
          title="选择部门"
          open={departmentModalVisible}
          onCancel={() => {
            setDepartmentModalVisible(false);
            setDepartmentSearchText('');
          }}
          footer={null}
          width={isMobile ? '95vw' : 600}
          centered
        >
          <div style={{ marginBottom: 16 }}>
            <Input.Search
              placeholder="搜索部门编码或名称"
              value={departmentSearchText}
              onChange={e => {
                const value = e.target.value;
                setDepartmentSearchText(value);
                // 防抖：延迟300ms后执行搜索
                if (searchTimeoutRef.current) {
                  clearTimeout(searchTimeoutRef.current);
                }
                searchTimeoutRef.current = setTimeout(() => {
                  loadDepartments(value);
                }, 300);
              }}
              onSearch={value => loadDepartments(value)}
              allowClear
              onClear={() => {
                setDepartmentSearchText('');
                loadDepartments('');
              }}
            />
          </div>
          <div className="hide-on-mobile">
            <Table
              columns={departmentColumns}
              dataSource={departments}
              rowKey="id"
              loading={departmentLoading}
              pagination={{ pageSize: 10 }}
              size="small"
            />
          </div>
          {/* 移动端卡片列表 */}
          <div className="mobile-table-cards show-on-mobile">
            {departmentLoading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>加载中...</div>
            ) : Array.isArray(departments) && departments.length > 0 ? (
              departments.map(record => {
                const name = record.department_name || record.name || '-';
                const code = record.department_code || record.code || '-';
                return (
                  <div key={record.id} className="mobile-card-item">
                    <div className="mobile-card-header">
                      <span className="mobile-card-title">{name}</span>
                      <Tag>{code}</Tag>
                    </div>
                    <div className="mobile-card-actions">
                      <Button type="primary" size="small" block onClick={() => handleSelectDepartment(record)}>
                        选择
                      </Button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>暂无部门</div>
            )}
          </div>
        </Modal>

        <Form.Item>
          <div
            className={isMobile ? 'form-actions mobile-stack' : 'form-actions'}
            style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              gap: isMobile ? '8px' : '16px',
            }}
          >
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block={isMobile}
              size={isMobile ? 'large' : 'middle'}
            >
              {isEdit ? '更新' : '添加'}
            </Button>
            <Button
              onClick={() => navigate('/assets')}
              block={isMobile}
              size={isMobile ? 'large' : 'middle'}
            >
              取消
            </Button>
          </div>
        </Form.Item>
      </Form>
    </div>
  );
};

export default AssetForm;
