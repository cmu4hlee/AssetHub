/**
 * SignatureField - Form 集成的手写签名字段
 *
 * 把 SignaturePad 包装进 Form.Item，name 直接接 Form state。
 * 解决"SignaturePad 内部用 ref 操作 canvas、Form 拿不到值"的 bug。
 *
 * 用法：
 *   <Form>
 *     <SignatureField name="signature_inspector" label="巡检人签字" required />
 *   </Form>
 *
 * Props:
 *   name            - Form.Item name（必填）
 *   label           - 标签文案
 *   required        - 是否必填（默认 false）
 *   requiredMessage - 必填提示文案
 *   width / height  - 画板尺寸
 *   penColor / penWidth / placeholder / disabled - 透传给 SignaturePad
 *   rules           - 透传给 Form.Item（覆盖 required 规则）
 *   formItemProps   - 透传给 Form.Item 的其它 props
 *   padProps        - 透传给 SignaturePad 的其它 props
 */
import React, { useCallback } from 'react';
import { Form } from 'antd';
import SignaturePad from './SignaturePad';

const SignatureField = ({
  name,
  label,
  required = false,
  requiredMessage = '请完成手写签名',
  width = 400,
  height = 160,
  penColor,
  penWidth,
  placeholder,
  disabled,
  rules,
  formItemProps = {},
  padProps = {},
}) => {
  const form = Form.useFormInstance();
  // 受控：把 Form 里的值同步到画板
  const value = Form.useWatch(name, form);

  // 用户签名 / 清除时同步回 Form
  const handleChange = useCallback((hasContent, dataURL) => {
    if (!form) return;
    if (hasContent) {
      form.setFieldValue(name, dataURL);
      // 让红字消失
      form.validateFields([name]).catch(() => { /* 错误由 Form.Item 自动展示 */ });
    } else {
      form.setFieldValue(name, undefined);
    }
  }, [form, name]);

  // 必填校验：有内容 = 通过；空 = 拒绝
  const builtInRules = required
    ? [{
        validator: async () => {
          const v = form ? form.getFieldValue(name) : undefined;
          if (v && typeof v === 'string' && v.startsWith('data:image/')) {
            return Promise.resolve();
          }
          return Promise.reject(new Error(requiredMessage));
        },
      }]
    : [];

  const mergedRules = rules || builtInRules;

  return (
    <Form.Item
      name={name}
      label={label}
      rules={mergedRules}
      {...formItemProps}
    >
      <SignaturePad
        value={value}
        onChange={handleChange}
        width={width}
        height={height}
        penColor={penColor}
        penWidth={penWidth}
        placeholder={placeholder}
        disabled={disabled}
        {...padProps}
      />
    </Form.Item>
  );
};

export default SignatureField;
