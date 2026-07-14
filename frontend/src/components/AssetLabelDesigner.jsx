import React, { useState, useEffect, useRef } from 'react';
import {
  Form,
  Input,
  InputNumber,
  Button,
  Select,
  Space,
  Tabs,
  Card,
  Row,
  Col,
  message,
} from 'antd';

import {
  FontColorsOutlined,
  BorderOutlined,
  QrcodeOutlined,
  BarcodeOutlined,
  LineOutlined,
  DeleteOutlined,
  SaveOutlined,
  CloseOutlined,
  UndoOutlined,
  RedoOutlined,
  CopyOutlined,
  BorderInnerOutlined,
} from '@ant-design/icons';

const { Option } = Select;

// 生成唯一ID
const generateId = () => {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
};

const AssetLabelDesigner = ({ template, onSave, onCancel }) => {
  const [form] = Form.useForm();
  const [elements, setElements] = useState(template?.elements || []);
  const [selectedElement, setSelectedElement] = useState(null);
  const [elementForm] = Form.useForm();
  const canvasRef = useRef(null);
  const [canvasSize, setCanvasSize] = useState(
    template ? { width: template.width, height: template.height } : { width: 100, height: 50 }
  );
  const [dpi, setDpi] = useState(template?.dpi || 300);

  // 拖拽和调整大小相关状态
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState(null);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [startElement, setStartElement] = useState(null);

  // 撤销/重做功能相关状态
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const MAX_HISTORY_LENGTH = 50;

  // 复制/粘贴功能相关状态
  const [copiedElements, setCopiedElements] = useState([]);

  // 网格线功能相关状态
  const [showGrid, setShowGrid] = useState(true);
  const gridSize = 5; // 网格线间距（mm）

  // 元素类型
  const elementTypes = [
    { type: 'text', icon: <FontColorsOutlined />, label: '文本' },
    { type: 'barcode', icon: <BarcodeOutlined />, label: '条形码' },
    { type: 'qr_code', icon: <QrcodeOutlined />, label: '二维码' },
    { type: 'line', icon: <LineOutlined />, label: '线条' },
    { type: 'rectangle', icon: <BorderOutlined />, label: '矩形' },
    { type: 'circle', icon: <BorderOutlined />, label: '圆形' },
  ];

  // 记录操作历史
  const recordHistory = newElements => {
    // 如果当前不是在历史记录的最后，删除后面的历史记录
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(JSON.stringify(newElements));

    // 限制历史记录数量
    if (newHistory.length > MAX_HISTORY_LENGTH) {
      newHistory.shift();
    }

    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  // 撤销操作
  const undo = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      const prevElements = JSON.parse(history[prevIndex]);
      setElements(prevElements);
      setHistoryIndex(prevIndex);
      // 清除选择
      setSelectedElement(null);
      elementForm.resetFields();
    }
  };

  // 重做操作
  const redo = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      const nextElements = JSON.parse(history[nextIndex]);
      setElements(nextElements);
      setHistoryIndex(nextIndex);
      // 清除选择
      setSelectedElement(null);
      elementForm.resetFields();
    }
  };

  // 复制元素
  const copyElement = () => {
    if (!selectedElement) {
      message.warning('请先选择一个元素');
      return;
    }

    setCopiedElements([selectedElement]);
    message.success('元素已复制');
  };

  // 粘贴元素
  const pasteElement = () => {
    if (copiedElements.length === 0) {
      message.warning('没有可粘贴的元素');
      return;
    }

    // 为每个复制的元素生成新的ID，并调整位置
    const pastedElements = copiedElements.map(element => {
      // 生成新的ID
      const newId = Date.now() + Math.floor(Math.random() * 1000);
      // 向右下方偏移10mm
      const newX = element.x + 10;
      const newY = element.y + 10;

      return {
        ...element,
        id: newId,
        x: newX,
        y: newY,
      };
    });

    const newElements = [...elements, ...pastedElements];
    setElements(newElements);
    // 记录历史
    recordHistory(newElements);
    // 选中最后一个粘贴的元素
    setSelectedElement(pastedElements[pastedElements.length - 1]);
    elementForm.setFieldsValue(pastedElements[pastedElements.length - 1]);
    message.success(`已粘贴 ${pastedElements.length} 个元素`);
  };

  // 元素层级调整功能
  // 上移一层
  const bringForward = () => {
    if (!selectedElement) {
      message.warning('请先选择一个元素');
      return;
    }

    const elementIndex = elements.findIndex(el => el.id === selectedElement.id);
    if (elementIndex >= elements.length - 1) {
      message.info('已经是最上层');
      return;
    }

    const newElements = [...elements];
    // 交换元素位置
    [newElements[elementIndex], newElements[elementIndex + 1]] = [
      newElements[elementIndex + 1],
      newElements[elementIndex],
    ];

    setElements(newElements);
    // 记录历史
    recordHistory(newElements);
    // 更新选中元素
    setSelectedElement(newElements[elementIndex + 1]);
    elementForm.setFieldsValue(newElements[elementIndex + 1]);
  };

  // 下移一层
  const sendBackward = () => {
    if (!selectedElement) {
      message.warning('请先选择一个元素');
      return;
    }

    const elementIndex = elements.findIndex(el => el.id === selectedElement.id);
    if (elementIndex <= 0) {
      message.info('已经是最下层');
      return;
    }

    const newElements = [...elements];
    // 交换元素位置
    [newElements[elementIndex], newElements[elementIndex - 1]] = [
      newElements[elementIndex - 1],
      newElements[elementIndex],
    ];

    setElements(newElements);
    // 记录历史
    recordHistory(newElements);
    // 更新选中元素
    setSelectedElement(newElements[elementIndex - 1]);
    elementForm.setFieldsValue(newElements[elementIndex - 1]);
  };

  // 置顶
  const bringToFront = () => {
    if (!selectedElement) {
      message.warning('请先选择一个元素');
      return;
    }

    const elementIndex = elements.findIndex(el => el.id === selectedElement.id);
    if (elementIndex >= elements.length - 1) {
      message.info('已经是最上层');
      return;
    }

    const newElements = [...elements];
    // 将元素移到数组末尾
    const [element] = newElements.splice(elementIndex, 1);
    newElements.push(element);

    setElements(newElements);
    // 记录历史
    recordHistory(newElements);
    // 更新选中元素
    setSelectedElement(element);
    elementForm.setFieldsValue(element);
  };

  // 置底
  const sendToBack = () => {
    if (!selectedElement) {
      message.warning('请先选择一个元素');
      return;
    }

    const elementIndex = elements.findIndex(el => el.id === selectedElement.id);
    if (elementIndex <= 0) {
      message.info('已经是最下层');
      return;
    }

    const newElements = [...elements];
    // 将元素移到数组开头
    const [element] = newElements.splice(elementIndex, 1);
    newElements.unshift(element);

    setElements(newElements);
    // 记录历史
    recordHistory(newElements);
    // 更新选中元素
    setSelectedElement(element);
    elementForm.setFieldsValue(element);
  };

  // 初始化模板数据
  useEffect(() => {
    if (template) {
      form.setFieldsValue({
        name: template.name,
        description: template.description,
        width: template.width,
        height: template.height,
        dpi: template.dpi,
      });
    } else {
      // 默认模板设置
      form.setFieldsValue({
        name: '',
        description: '',
        width: 100,
        height: 50,
        dpi: 300,
      });
    }
  }, [template, form]);

  // 保存模板
  const handleSave = async () => {
    try {
      const templateData = await form.validateFields();
      const finalData = {
        ...templateData,
        elements: elements,
      };
      onSave(finalData);
    } catch (error) {
      message.error('请填写必填字段');
    }
  };

  // 复制模板
  const handleCopyTemplate = async () => {
    try {
      const templateData = await form.validateFields();
      const copiedTemplate = {
        ...templateData,
        elements: elements,
        name: `${templateData.name} - 副本`,
      };

      // 重置表单并设置新的模板名称
      form.setFieldsValue({ name: copiedTemplate.name });

      // 通知父组件保存副本
      onSave(copiedTemplate);

      message.success('模板已复制');
    } catch (error) {
      message.error('请填写必填字段');
    }
  };

  // 资产字段列表（根据实际资产字段调整）
  const assetFields = [
    { value: 'asset_code', label: '资产编号' },
    { value: 'name', label: '资产名称' },
    { value: 'category', label: '资产分类' },
    { value: 'department_name', label: '使用部门' },
    { value: 'user_name', label: '使用人' },
    { value: 'location', label: '位置' },
    { value: 'brand', label: '品牌' },
    { value: 'model', label: '型号' },
    { value: 'serial_number', label: '序列号' },
    { value: 'purchase_date', label: '购买日期' },
    { value: 'purchase_price', label: '购买价格' },
    { value: 'status', label: '状态' },
    { value: 'supplier', label: '供应商' },
  ];

  // 添加元素
  const addElement = type => {
    const newElement = {
      id: generateId(),
      type: type,
      x: 10,
      y: 10,
      width: type === 'line' ? 50 : type === 'qrcode' || type === 'barcode' ? 30 : 80,
      height: type === 'line' ? 2 : type === 'qrcode' || type === 'barcode' ? 30 : 30,
      content: type === 'text' ? '文本内容' : '',
      fontSize: 12,
      fontWeight: 'normal',
      fontStyle: 'normal',
      color: '#000000',
      align: 'left',
      barcodeType: 'code128',
      rotation: 0,
      lineWidth: 1,
      fillColor: 'transparent',
      strokeColor: '#000000',
      field: type === 'qrcode' ? 'asset_code' : type === 'barcode' ? 'asset_code' : '', // 资产字段映射，二维码和条形码默认映射到资产编号
    };

    const newElements = [...elements, newElement];
    setElements(newElements);
    setSelectedElement(newElement);
    elementForm.setFieldsValue(newElement);
    // 记录历史
    recordHistory(newElements);
  };

  // 删除元素
  const deleteElement = id => {
    const newElements = elements.filter(element => element.id !== id);
    setElements(newElements);
    setSelectedElement(null);
    elementForm.resetFields();
    // 记录历史
    recordHistory(newElements);
  };

  // 选择元素
  const selectElement = id => {
    const element = elements.find(el => el.id === id);
    setSelectedElement(element);
    elementForm.setFieldsValue(element);
  };

  // 更新元素属性
  const updateElementProperty = async (changedValues, allValues) => {
    if (!selectedElement) return;

    const updatedElements = elements.map(element => {
      if (element.id === selectedElement.id) {
        return { ...element, ...changedValues };
      }
      return element;
    });

    setElements(updatedElements);
    const updatedElement = updatedElements.find(el => el.id === selectedElement.id);
    setSelectedElement(updatedElement);
    // 记录历史
    recordHistory(updatedElements);
  };

  // 计算鼠标在画布上的毫米坐标
  const getMousePosition = e => {
    if (!canvasRef.current) return { x: 0, y: 0 };

    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasSize.width / rect.width;
    const scaleY = canvasSize.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  // 处理拖拽开始
  const handleMouseDown = (e, element, action = 'drag', direction = null) => {
    e.stopPropagation();

    // 选择元素
    selectElement(element.id);

    // 记录操作前的状态
    recordHistory(elements);

    if (action === 'drag') {
      setIsDragging(true);
      setStartPos(getMousePosition(e));
      setStartElement(element);
    } else if (action === 'resize') {
      setIsResizing(true);
      setResizeDirection(direction);
      setStartPos(getMousePosition(e));
      setStartElement(element);
    }
  };

  // 处理鼠标移动
  const handleMouseMove = e => {
    if (isDragging && startElement) {
      const currentPos = getMousePosition(e);
      const dx = currentPos.x - startPos.x;
      const dy = currentPos.y - startPos.y;

      // 更新元素位置
      const updatedElements = elements.map(element => {
        if (element.id === startElement.id) {
          const newX = Math.max(0, Math.min(startElement.x + dx, canvasSize.width - element.width));
          const newY = Math.max(
            0,
            Math.min(startElement.y + dy, canvasSize.height - element.height)
          );
          return { ...element, x: newX, y: newY };
        }
        return element;
      });

      setElements(updatedElements);
      const updatedElement = updatedElements.find(el => el.id === startElement.id);
      setSelectedElement(updatedElement);
      elementForm.setFieldsValue(updatedElement);
    }

    if (isResizing && startElement && resizeDirection) {
      const currentPos = getMousePosition(e);
      const dx = currentPos.x - startPos.x;
      const dy = currentPos.y - startPos.y;

      let newX = startElement.x;
      let newY = startElement.y;
      let newWidth = startElement.width;
      let newHeight = startElement.height;

      // 根据调整方向计算新的尺寸
      switch (resizeDirection) {
        case 'n':
          newY = startElement.y + dy;
          newHeight = startElement.height - dy;
          break;
        case 'ne':
          newY = startElement.y + dy;
          newHeight = startElement.height - dy;
          newWidth = startElement.width + dx;
          break;
        case 'e':
          newWidth = startElement.width + dx;
          break;
        case 'se':
          newWidth = startElement.width + dx;
          newHeight = startElement.height + dy;
          break;
        case 's':
          newHeight = startElement.height + dy;
          break;
        case 'sw':
          newX = startElement.x + dx;
          newWidth = startElement.width - dx;
          newHeight = startElement.height + dy;
          break;
        case 'w':
          newX = startElement.x + dx;
          newWidth = startElement.width - dx;
          break;
        case 'nw':
          newX = startElement.x + dx;
          newY = startElement.y + dy;
          newWidth = startElement.width - dx;
          newHeight = startElement.height - dy;
          break;
        default:
          break;
      }

      // 确保尺寸合法
      newX = Math.max(0, newX);
      newY = Math.max(0, newY);
      newWidth = Math.max(5, Math.min(newWidth, canvasSize.width - newX));
      newHeight = Math.max(5, Math.min(newHeight, canvasSize.height - newY));

      // 更新元素尺寸
      const updatedElements = elements.map(element => {
        if (element.id === startElement.id) {
          return { ...element, x: newX, y: newY, width: newWidth, height: newHeight };
        }
        return element;
      });

      setElements(updatedElements);
      const updatedElement = updatedElements.find(el => el.id === startElement.id);
      setSelectedElement(updatedElement);
      elementForm.setFieldsValue(updatedElement);
    }
  };

  // 处理鼠标释放
  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
    setResizeDirection(null);
    setStartElement(null);
  };

  // 添加全局鼠标事件监听
  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, startElement, resizeDirection, startPos]);

  // 渲染元素
  const renderElement = element => {
    const isSelected = selectedElement && selectedElement.id === element.id;

    const baseStyle = {
      position: 'absolute',
      left: `${element.x}mm`,
      top: `${element.y}mm`,
      width: `${element.width}mm`,
      height: `${element.height}mm`,
      transform: `rotate(${element.rotation}deg)`,
      transformOrigin: 'center',
      cursor: 'move',
      border: isSelected ? '2px solid #1890ff' : '1px solid transparent',
      backgroundColor: element.fillColor === 'transparent' ? 'transparent' : element.fillColor,
      color: element.color,
      fontSize: `${element.fontSize}px`,
      fontWeight: element.fontWeight,
      fontStyle: element.fontStyle,
      textAlign: element.align,
      display: 'flex',
      alignItems: 'center',
      justifyContent:
        element.align === 'center'
          ? 'center'
          : element.align === 'right'
            ? 'flex-end'
            : 'flex-start',
      padding: element.type === 'text' ? '2px' : '0',
    };

    let elementContent = null;
    let elementLabel = element.field ? `{{${element.field}}}` : element.content;

    switch (element.type) {
      case 'text':
        elementContent = elementLabel;
        break;
      case 'barcode':
        elementContent = (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px dashed #666',
              color: '#666',
            }}
          >
            条形码: {elementLabel || 'CODE128'}
          </div>
        );
        break;
      case 'qr_code':
        elementContent = (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px dashed #666',
              borderRadius: '4px',
              color: '#666',
            }}
          >
            二维码
            {elementLabel && (
              <div style={{ fontSize: '8px', marginTop: '4px' }}>{elementLabel}</div>
            )}
          </div>
        );
        break;
      case 'line':
        elementContent = (
          <div
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: element.strokeColor,
              border: 'none',
            }}
          />
        );
        break;
      case 'rectangle':
        elementContent = (
          <div
            style={{
              width: '100%',
              height: '100%',
              border: `${element.lineWidth}px solid ${element.strokeColor}`,
              backgroundColor: element.fillColor,
            }}
          />
        );
        break;
      case 'circle':
        elementContent = (
          <div
            style={{
              width: '100%',
              height: '100%',
              border: `${element.lineWidth}px solid ${element.strokeColor}`,
              backgroundColor: element.fillColor,
              borderRadius: '50%',
            }}
          />
        );
        break;
      default:
        elementContent = null;
    }

    // 渲染调整大小的手柄
    const renderResizeHandles = () => {
      if (!isSelected) return null;

      const resizeHandleStyle = {
        position: 'absolute',
        width: '6px',
        height: '6px',
        backgroundColor: '#1890ff',
        border: '1px solid #fff',
        borderRadius: '50%',
        cursor: 'nwse-resize',
        zIndex: 1000,
      };

      const handles = [
        { position: { top: '-3px', left: '-3px' }, cursor: 'nw-resize', direction: 'nw' },
        {
          position: { top: '-3px', left: '50%', transform: 'translateX(-50%)' },
          cursor: 'n-resize',
          direction: 'n',
        },
        { position: { top: '-3px', right: '-3px' }, cursor: 'ne-resize', direction: 'ne' },
        {
          position: { top: '50%', right: '-3px', transform: 'translateY(-50%)' },
          cursor: 'e-resize',
          direction: 'e',
        },
        { position: { bottom: '-3px', right: '-3px' }, cursor: 'se-resize', direction: 'se' },
        {
          position: { bottom: '-3px', left: '50%', transform: 'translateX(-50%)' },
          cursor: 's-resize',
          direction: 's',
        },
        { position: { bottom: '-3px', left: '-3px' }, cursor: 'sw-resize', direction: 'sw' },
        {
          position: { top: '50%', left: '-3px', transform: 'translateY(-50%)' },
          cursor: 'w-resize',
          direction: 'w',
        },
      ];

      return handles.map((handle, index) => (
        <div
          key={`handle-${index}`}
          style={{
            ...resizeHandleStyle,
            ...handle.position,
            cursor: handle.cursor,
          }}
          onMouseDown={e => handleMouseDown(e, element, 'resize', handle.direction)}
        />
      ));
    };

    return (
      <div
        key={element.id}
        style={baseStyle}
        onMouseDown={e => handleMouseDown(e, element, 'drag')}
      >
        {elementContent}
        {renderResizeHandles()}
      </div>
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 100px)',
        overflow: 'hidden',
      }}
    >
      {/* 模板基本信息 */}
      <Form
        form={form}
        layout="vertical"
        style={{ marginBottom: 20 }}
        className="template-info-form"
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
          <Form.Item
            name="name"
            label="模板名称"
            rules={[{ required: true, message: '请输入模板名称' }]}
          >
            <Input placeholder="请输入模板名称" style={{ minWidth: 200, maxWidth: 300 }} />
          </Form.Item>
          <Form.Item name="description" label="模板描述">
            <Input placeholder="请输入模板描述" style={{ minWidth: 200, flex: 1, maxWidth: 500 }} />
          </Form.Item>
          <Form.Item
            name="width"
            label="宽度 (mm)"
            rules={[{ required: true, message: '请输入宽度' }]}
          >
            <InputNumber min={1} max={500} style={{ minWidth: 100 }} />
          </Form.Item>
          <Form.Item
            name="height"
            label="高度 (mm)"
            rules={[{ required: true, message: '请输入高度' }]}
          >
            <InputNumber min={1} max={500} style={{ minWidth: 100 }} />
          </Form.Item>
          <Form.Item name="dpi" label="DPI" rules={[{ required: true, message: '请输入DPI' }]}>
            <Select style={{ minWidth: 100 }}>
              <Option value={203}>203</Option>
              <Option value={300}>300</Option>
              <Option value={600}>600</Option>
            </Select>
          </Form.Item>
        </div>
      </Form>

      {/* 工具栏 */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <Space>
          <Button
            type="default"
            icon={<UndoOutlined />}
            onClick={undo}
            disabled={historyIndex <= 0}
          >
            撤销
          </Button>
          <Button
            type="default"
            icon={<RedoOutlined />}
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
          >
            重做
          </Button>
          <Button
            type="default"
            icon={<CopyOutlined />}
            onClick={copyElement}
            disabled={!selectedElement}
          >
            复制
          </Button>
          <Button
            type="default"
            icon={<CopyOutlined />}
            onClick={pasteElement}
            disabled={copiedElements.length === 0}
          >
            粘贴
          </Button>
          <Button
            type={showGrid ? 'primary' : 'default'}
            icon={<BorderInnerOutlined />}
            onClick={() => setShowGrid(!showGrid)}
          >
            {showGrid ? '隐藏网格' : '显示网格'}
          </Button>
        </Space>

        <Space>
          <Button type="default" onClick={sendToBack} disabled={!selectedElement}>
            置底
          </Button>
          <Button type="default" onClick={sendBackward} disabled={!selectedElement}>
            下移一层
          </Button>
          <Button type="default" onClick={bringForward} disabled={!selectedElement}>
            上移一层
          </Button>
          <Button type="default" onClick={bringToFront} disabled={!selectedElement}>
            置顶
          </Button>
        </Space>
      </div>

      <div style={{ display: 'flex', flex: 1, gap: 16, overflow: 'hidden' }}>
        {/* 工具栏 */}
        <Card title="工具栏" style={{ minWidth: 100, maxWidth: 140, overflowY: 'auto' }}>
          <Space orientation="vertical" style={{ width: '100%' }}>
            {elementTypes.map(item => (
              <Button
                key={item.type}
                type="default"
                icon={item.icon}
                block
                onClick={() => addElement(item.type)}
              >
                {item.label}
              </Button>
            ))}
          </Space>
        </Card>

        {/* 画布区域 */}
        <Card title="标签设计区" style={{ flex: 1, overflow: 'auto' }}>
          <div
            ref={canvasRef}
            style={{
              position: 'relative',
              width: `${canvasSize.width}mm`,
              height: `${canvasSize.height}mm`,
              backgroundColor: '#f5f5f5',
              border: '1px solid #d9d9d9',
              margin: '0 auto',
              transform: 'scale(1)',
              transformOrigin: 'center',
              overflow: 'hidden',
              minWidth: '200px',
              minHeight: '100px',
            }}
          >
            {/* 网格线 */}
            {showGrid && (
              <div
                style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'none',
                  zIndex: 0,
                }}
              >
                {/* 垂直线 */}
                {Array.from({ length: Math.ceil(canvasSize.width / gridSize) + 1 }).map((_, i) => (
                  <div
                    key={`v-${i}`}
                    style={{
                      position: 'absolute',
                      left: `${i * gridSize}mm`,
                      top: 0,
                      width: '0.5px',
                      height: '100%',
                      backgroundColor: '#e8e8e8',
                    }}
                  />
                ))}
                {/* 水平线 */}
                {Array.from({ length: Math.ceil(canvasSize.height / gridSize) + 1 }).map((_, i) => (
                  <div
                    key={`h-${i}`}
                    style={{
                      position: 'absolute',
                      top: `${i * gridSize}mm`,
                      left: 0,
                      width: '100%',
                      height: '0.5px',
                      backgroundColor: '#e8e8e8',
                    }}
                  />
                ))}
              </div>
            )}
            {elements.map(element => renderElement(element))}
          </div>
        </Card>

        {/* 属性编辑区 */}
        <Card title="属性" style={{ minWidth: 250, maxWidth: 350, overflowY: 'auto' }}>
          {selectedElement ? (
            <Form
              form={elementForm}
              layout="vertical"
              onValuesChange={updateElementProperty}
              style={{ height: '100%' }}
            >
              <Form.Item label="元素类型" name="type">
                <Select disabled>
                  <Option value="text">文本</Option>
                  <Option value="barcode">条形码</Option>
                  <Option value="qr_code">二维码</Option>
                  <Option value="line">线条</Option>
                  <Option value="rectangle">矩形</Option>
                  <Option value="circle">圆形</Option>
                </Select>
              </Form.Item>

              {(selectedElement.type === 'text' ||
                selectedElement.type === 'barcode' ||
                selectedElement.type === 'qr_code') && (
                <>
                  <Form.Item label="静态内容" name="content">
                    <Input placeholder="请输入静态内容" />
                  </Form.Item>
                  <Form.Item label="资产字段映射" name="field">
                    <Select placeholder="选择要映射的资产字段">
                      <Option value="">无映射</Option>
                      {assetFields.map(field => (
                        <Option key={field.value} value={field.value}>
                          {field.label} ({field.value})
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                  <div style={{ marginTop: 8, marginLeft: 80, fontSize: 12, color: '#999' }}>
                    选择资产字段后，将使用资产实际值替换静态内容
                  </div>
                </>
              )}

              {selectedElement.type === 'text' && (
                <>
                  <Form.Item label="字体大小" name="fontSize">
                    <InputNumber min={1} max={100} />
                  </Form.Item>
                  <Form.Item label="字体粗细" name="fontWeight">
                    <Select>
                      <Option value="normal">正常</Option>
                      <Option value="bold">粗体</Option>
                    </Select>
                  </Form.Item>
                  <Form.Item label="字体样式" name="fontStyle">
                    <Select>
                      <Option value="normal">正常</Option>
                      <Option value="italic">斜体</Option>
                    </Select>
                  </Form.Item>
                  <Form.Item label="对齐方式" name="align">
                    <Select>
                      <Option value="left">左对齐</Option>
                      <Option value="center">居中</Option>
                      <Option value="right">右对齐</Option>
                    </Select>
                  </Form.Item>
                </>
              )}

              {selectedElement.type === 'barcode' && (
                <Form.Item label="条形码类型" name="barcodeType">
                  <Select>
                    <Option value="code128">Code 128</Option>
                    <Option value="code39">Code 39</Option>
                    <Option value="ean13">EAN-13</Option>
                    <Option value="upc-a">UPC-A</Option>
                  </Select>
                </Form.Item>
              )}

              {(selectedElement.type === 'line' ||
                selectedElement.type === 'rectangle' ||
                selectedElement.type === 'circle') && (
                <Form.Item label="线条宽度" name="lineWidth">
                  <InputNumber min={1} max={20} />
                </Form.Item>
              )}

              {(selectedElement.type === 'rectangle' || selectedElement.type === 'circle') && (
                <Form.Item label="填充颜色" name="fillColor">
                  <Input placeholder="#000000" />
                </Form.Item>
              )}

              {selectedElement.type !== 'text' && (
                <Form.Item label="线条颜色" name="strokeColor">
                  <Input placeholder="#000000" />
                </Form.Item>
              )}

              {selectedElement.type === 'text' && (
                <Form.Item label="文字颜色" name="color">
                  <Input placeholder="#000000" />
                </Form.Item>
              )}

              <Form.Item label="X坐标" name="x">
                <InputNumber min={0} max={canvasSize.width} />
              </Form.Item>
              <Form.Item label="Y坐标" name="y">
                <InputNumber min={0} max={canvasSize.height} />
              </Form.Item>
              <Form.Item label="宽度" name="width">
                <InputNumber min={1} max={canvasSize.width} />
              </Form.Item>
              <Form.Item label="高度" name="height">
                <InputNumber min={1} max={canvasSize.height} />
              </Form.Item>
              <Form.Item label="旋转角度" name="rotation">
                <InputNumber min={0} max={360} />
              </Form.Item>

              <Button
                type="danger"
                icon={<DeleteOutlined />}
                onClick={() => deleteElement(selectedElement.id)}
                block
              >
                删除元素
              </Button>
            </Form>
          ) : (
            <div style={{ textAlign: 'center', color: '#999', padding: '20px' }}>
              请选择一个元素进行编辑
            </div>
          )}
        </Card>
      </div>

      {/* 底部操作按钮 */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
        <Space>
          <Button onClick={onCancel} icon={<CloseOutlined />}>
            取消
          </Button>
          <Button type="default" onClick={handleCopyTemplate} icon={<CopyOutlined />}>
            复制模板
          </Button>
          <Button type="primary" onClick={handleSave} icon={<SaveOutlined />}>
            保存模板
          </Button>
        </Space>
      </div>
    </div>
  );
};

export default AssetLabelDesigner;
