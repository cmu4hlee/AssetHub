import React, { useEffect, useRef } from 'react';
import { Empty } from 'antd';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import { logger } from '../utils/productionLogger';

const LabelPreview = ({ template, asset, scale = 1 }) => {
  // 毫米到像素的转换（1mm = 3.779528px）
  const mmToPx = mm => Math.round(mm * 3.779528);

  // 确保elements是数组
  const elements = template && Array.isArray(template.elements) ? template.elements : [];

  // 处理资产为空的情况
  const displayAsset = asset || {
    asset_code: '示例资产编号',
    asset_name: '示例资产名称',
    department: '示例部门',
    purchase_date: '2026-01-20',
    status: '在用',
    // 添加其他可能用到的示例字段
    id: '12345',
    category: '示例分类',
    brand: '示例品牌',
    model: '示例型号',
    specification: '示例规格',
    serial_number: '示例序列号',
    purchase_price: '10000',
    current_value: '8000',
    responsible_person: '示例负责人',
    storage_location: '示例存放地点',
  };

  // 处理模板没有元素的情况
  const displayElements =
    elements.length > 0
      ? elements
      : [
          {
            id: 1,
            type: 'text',
            x: 10,
            y: 10,
            width: 50,
            height: 5,
            text: '资产编号',
            field: 'asset_code',
            fontSize: 12,
            color: '#000000',
          },
          {
            id: 2,
            type: 'text',
            x: 10,
            y: 20,
            width: 50,
            height: 5,
            text: '资产名称',
            field: 'asset_name',
            fontSize: 12,
            color: '#000000',
          },
          {
            id: 3,
            type: 'barcode',
            x: 10,
            y: 30,
            width: 50,
            height: 20,
            text: '',
            field: 'asset_code',
            fontSize: 12,
            color: '#000000',
          },
        ];

  // 确保模板尺寸合理
  const templateWidth = template.width || 60;
  const templateHeight = template.height || 40;

  const previewStyle = {
    width: `${mmToPx(templateWidth) * scale}px`,
    height: `${mmToPx(templateHeight) * scale}px`,
    border: '1px solid #d9d9d9',
    backgroundColor: '#ffffff',
    position: 'relative',
    overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
  };

  const renderElement = (element, index) => {
    // 将元素的毫米单位转换为像素单位
    const elementStyle = {
      position: 'absolute',
      left: `${mmToPx(element.x)}px`,
      top: `${mmToPx(element.y)}px`,
      fontSize: `${element.fontSize}px`,
      fontFamily: element.fontFamily || 'Arial',
      fontWeight: element.fontWeight || 'normal',
      color: element.color || '#000000',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    };

    let content = element.content || element.text;
    let fieldValue = '';

    if (element.field) {
      fieldValue = displayAsset[element.field];

      // 强大的字段映射逻辑，支持多种可能的字段名
      // 1. 直接匹配（优先）
      if (displayAsset[element.field] !== undefined && displayAsset[element.field] !== null) {
        content = displayAsset[element.field];
      }
      // 2. 特殊字段映射（针对常见字段名差异）
      else {
        const specialFieldMap = {
          name: displayAsset.asset_name,
          asset_name: displayAsset.asset_name,
          assetName: displayAsset.asset_name,
          category: displayAsset.category_name || displayAsset.category,
          category_name: displayAsset.category_name || displayAsset.category,
          categoryName: displayAsset.category_name || displayAsset.category,
          user_name: displayAsset.responsible_person,
          userName: displayAsset.responsible_person,
          responsible_person: displayAsset.responsible_person,
          department: displayAsset.department,
          department_name: displayAsset.department,
          departmentName: displayAsset.department,
          dept: displayAsset.department,
          dept_name: displayAsset.department,
          deptName: displayAsset.department,
          status: displayAsset.status,
          asset_status: displayAsset.status,
          assetStatus: displayAsset.status,
        };

        if (
          specialFieldMap[element.field] !== undefined &&
          specialFieldMap[element.field] !== null
        ) {
          content = specialFieldMap[element.field];
        }
        // 3. 尝试使用驼峰式命名匹配
        else if (element.field.includes('_')) {
          const camelCaseField = element.field.replace(/_([a-z])/g, g => g[1].toUpperCase());
          if (displayAsset[camelCaseField] !== undefined && displayAsset[camelCaseField] !== null) {
            content = displayAsset[camelCaseField];
          }
        }
        // 4. 尝试使用下划线命名匹配
        else if (/[A-Z]/.test(element.field)) {
          const snakeCaseField = element.field.replace(/[A-Z]/g, g => `_${g.toLowerCase()}`);
          if (displayAsset[snakeCaseField] !== undefined && displayAsset[snakeCaseField] !== null) {
            content = displayAsset[snakeCaseField];
          }
        }
        // 5. 尝试使用全小写匹配
        else {
          const lowerCaseField = element.field.toLowerCase();
          if (displayAsset[lowerCaseField] !== undefined && displayAsset[lowerCaseField] !== null) {
            content = displayAsset[lowerCaseField];
          }
          // 6. 尝试使用全大写匹配
          else {
            const upperCaseField = element.field.toUpperCase();
            if (
              displayAsset[upperCaseField] !== undefined &&
              displayAsset[upperCaseField] !== null
            ) {
              content = displayAsset[upperCaseField];
            }
            // 7. 显示空值占位符
            else {
              content = `[${element.field}]`;
            }
          }
        }
      }
    }

    // 确保内容不是undefined或null
    if (content === undefined || content === null) {
      content = element.text || '';
    }

    // 使用element.id作为key和id的一部分，确保唯一性
    const elementKey = element.id || `element-${index}`;

    if (element.type === 'text') {
      return (
        <div key={elementKey} style={elementStyle}>
          {content}
        </div>
      );
    }

    if (element.type === 'barcode') {
      return (
        <div key={`${elementKey}-barcode`} style={elementStyle}>
          <svg
            id={`barcode-${elementKey}`}
            width={mmToPx(element.width)}
            height={mmToPx(element.height)}
            style={{ display: 'block' }}
          />
        </div>
      );
    }

    if (element.type === 'qrcode' || element.type === 'qr_code') {
      return (
        <div key={`${elementKey}-qrcode`} style={elementStyle}>
          <canvas
            id={`qrcode-${elementKey}`}
            width={mmToPx(element.width)}
            height={mmToPx(element.height)}
          />
        </div>
      );
    }

    if (element.type === 'line') {
      return (
        <div
          key={`${elementKey}-line`}
          style={{
            position: 'absolute',
            left: `${mmToPx(element.x)}px`,
            top: `${mmToPx(element.y)}px`,
            width: `${mmToPx(element.width)}px`,
            height: `${mmToPx(element.height)}px`,
            borderLeft: `${element.thickness || 1}px solid ${element.color || '#000000'}`,
          }}
        />
      );
    }

    if (element.type === 'rectangle') {
      return (
        <div
          key={`${elementKey}-rectangle`}
          style={{
            position: 'absolute',
            left: `${mmToPx(element.x)}px`,
            top: `${mmToPx(element.y)}px`,
            width: `${mmToPx(element.width)}px`,
            height: `${mmToPx(element.height)}px`,
            border: `${element.thickness || 1}px solid ${element.color || '#000000'}`,
            backgroundColor: element.fillColor || 'transparent',
          }}
        />
      );
    }

    return null;
  };

  // 生成真实的条码和二维码
  useEffect(() => {
    if (!template) return;

    displayElements.forEach((element, index) => {
      let content = element.content || element.text;

      // 使用与renderElement函数相同的方式生成elementKey
      const elementKey = element.id || `element-${index}`;

      if (element.field) {
        // 应用与文本元素相同的强大字段映射逻辑
        // 1. 直接匹配（优先）
        if (displayAsset[element.field] !== undefined && displayAsset[element.field] !== null) {
          content = displayAsset[element.field];
        }
        // 2. 特殊字段映射（针对常见字段名差异）
        else {
          const specialFieldMap = {
            name: displayAsset.asset_name,
            asset_name: displayAsset.asset_name,
            assetName: displayAsset.asset_name,
            category: displayAsset.category_name || displayAsset.category,
            category_name: displayAsset.category_name || displayAsset.category,
            categoryName: displayAsset.category_name || displayAsset.category,
            user_name: displayAsset.responsible_person,
            userName: displayAsset.responsible_person,
            responsible_person: displayAsset.responsible_person,
            department: displayAsset.department,
            department_name: displayAsset.department,
            departmentName: displayAsset.department,
            dept: displayAsset.department,
            dept_name: displayAsset.department,
            deptName: displayAsset.department,
            status: displayAsset.status,
            asset_status: displayAsset.status,
            assetStatus: displayAsset.status,
          };

          if (
            specialFieldMap[element.field] !== undefined &&
            specialFieldMap[element.field] !== null
          ) {
            content = specialFieldMap[element.field];
          }
          // 3. 尝试使用驼峰式命名匹配
          else if (element.field.includes('_')) {
            const camelCaseField = element.field.replace(/_([a-z])/g, g => g[1].toUpperCase());
            if (
              displayAsset[camelCaseField] !== undefined &&
              displayAsset[camelCaseField] !== null
            ) {
              content = displayAsset[camelCaseField];
            }
          }
          // 4. 尝试使用下划线命名匹配
          else if (/[A-Z]/.test(element.field)) {
            const snakeCaseField = element.field.replace(/[A-Z]/g, g => `_${g.toLowerCase()}`);
            if (
              displayAsset[snakeCaseField] !== undefined &&
              displayAsset[snakeCaseField] !== null
            ) {
              content = displayAsset[snakeCaseField];
            }
          }
          // 5. 尝试使用全小写匹配
          else {
            const lowerCaseField = element.field.toLowerCase();
            if (
              displayAsset[lowerCaseField] !== undefined &&
              displayAsset[lowerCaseField] !== null
            ) {
              content = displayAsset[lowerCaseField];
            }
            // 6. 尝试使用全大写匹配
            else {
              const upperCaseField = element.field.toUpperCase();
              if (
                displayAsset[upperCaseField] !== undefined &&
                displayAsset[upperCaseField] !== null
              ) {
                content = displayAsset[upperCaseField];
              }
            }
          }
        }

        // 确保内容是字符串
        if (typeof content !== 'string') {
          content = String(content);
        }
      }

      if (element.type === 'barcode') {
        const svgElement = document.getElementById(`barcode-${elementKey}`);
        if (svgElement) {
          try {
            JsBarcode(svgElement, content, {
              width: 2,
              height: mmToPx(element.height) - 10,
              fontSize: 12,
              lineColor: '#000000',
              displayValue: true,
              margin: 0,
            });
          } catch (error) {
            logger.error('生成条码失败', { error: error.message, elementKey });
            // 使用 SVG text 元素替代 innerHTML，避免 XSS 风险
            const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            textElement.setAttribute('x', '10');
            textElement.setAttribute('y', '20');
            textElement.setAttribute('font-size', '12');
            textElement.setAttribute('fill', '#ff0000');
            textElement.textContent = '条码生成失败';
            svgElement.appendChild(textElement);
          }
        }
      }

      if (element.type === 'qrcode' || element.type === 'qr_code') {
        const canvasElement = document.getElementById(`qrcode-${elementKey}`);

        if (canvasElement) {
          try {
            QRCode.toCanvas(canvasElement, content, {
              width: mmToPx(element.width),
              margin: 0,
              color: {
                dark: '#000000',
                light: '#ffffff',
              },
            });
          } catch (error) {
            logger.error('生成二维码失败', { error: error.message, elementKey });
            // 显示友好的错误信息
            const ctx = canvasElement.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvasElement.width, canvasElement.height);
            ctx.fillStyle = '#ff0000';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('二维码生成失败', canvasElement.width / 2, canvasElement.height / 2);
          }
        } else {
          logger.warn('未找到二维码canvas元素', { elementKey });
        }
      }
    });
  }, [template, displayAsset, displayElements]);

  return (
    <div style={{ padding: 20, textAlign: 'center' }}>
      <div style={{ marginBottom: 10, color: '#666', fontSize: 14 }}>
        标签预览 ({template.width}mm × {template.height}mm)
      </div>
      <div style={previewStyle}>
        {displayElements.map((element, index) => renderElement(element, index))}
      </div>

      <div style={{ marginTop: 20, textAlign: 'left', fontSize: 12, color: '#666' }}>
        <strong>字段对应值：</strong>
        <ul style={{ marginTop: 10 }}>
          {displayElements
            .filter(el => el.field)
            .map((el, idx) => {
              // 应用与文本元素相同的字段映射逻辑
              let fieldValue = displayAsset[el.field];
              let finalValue = fieldValue;

              // 改进字段映射逻辑
              if (fieldValue === undefined || fieldValue === null) {
                // 尝试使用驼峰式命名匹配
                if (el.field.includes('_')) {
                  const camelCaseField = el.field.replace(/_([a-z])/g, g => g[1].toUpperCase());
                  if (displayAsset[camelCaseField] !== undefined) {
                    finalValue = displayAsset[camelCaseField];
                  }
                }
                // 尝试使用下划线命名匹配
                else if (/[A-Z]/.test(el.field)) {
                  const snakeCaseField = el.field.replace(/[A-Z]/g, g => `_${g.toLowerCase()}`);
                  if (displayAsset[snakeCaseField] !== undefined) {
                    finalValue = displayAsset[snakeCaseField];
                  }
                }
              }

              // 处理空值情况
              const displayValue =
                finalValue !== undefined && finalValue !== null ? finalValue : '无值';

              return (
                <li key={idx} style={{ marginBottom: 5 }}>
                  <span style={{ color: '#1890ff', fontWeight: 'bold' }}>{el.field}</span> →{' '}
                  <span
                    style={{
                      color: finalValue !== undefined && finalValue !== null ? '#000' : '#999',
                    }}
                  >
                    {displayValue}
                  </span>
                </li>
              );
            })}
        </ul>
      </div>
    </div>
  );
};

export default LabelPreview;
