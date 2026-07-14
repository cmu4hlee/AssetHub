/**
 * SignaturePad - 手写签名画板
 *
 * 用 <canvas> 实现，支持鼠标 + 触屏 + 触控笔。零外部依赖。
 *
 * 两种用法：
 *  1) 非受控（兼容旧代码）：
 *     const ref = useRef();
 *     <SignaturePad ref={ref} />
 *     ref.current.getDataURL() / isEmpty() / clear()
 *
 *  2) 受控（推荐，可与 Form 集成）：
 *     <SignaturePad value={value} onChange={setValue} />
 *     value 为 PNG base64；onChange(hasContent, dataURL)
 *
 * Props:
 *   width / height       - 画板尺寸（默认 400x160）
 *   penColor             - 笔触颜色（默认 #1f1f1f）
 *   penWidth             - 笔触粗细（默认 2；showPenWidthPicker=true 时是初始值）
 *   disabled             - 是否禁用
 *   onChange             - (hasContent: boolean, dataURL?: string) => void
 *   value                - 受控值（PNG base64）；传入时画板会回显该图片
 *   placeholder          - 提示文案
 *   className            - 容器 class
 *   showActions          - 是否显示操作按钮（撤销/重做/清除，默认 true）
 *   showPenWidthPicker   - 是否显示「细/中/粗」切换（默认 false）
 *
 * Ref API（兼容旧代码）：
 *   getDataURL()    - 取 PNG base64
 *   isEmpty()       - 是否有内容
 *   clear()         - 清空
 *   setDataURL(url) - 主动回显一张图片
 *   undo() / redo() - 撤销 / 重做
 *   canUndo() / canRedo() - 是否可撤销 / 重做
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Button, Space, Tooltip, Radio } from 'antd';
import { ClearOutlined, EditOutlined, UndoOutlined, RedoOutlined } from '@ant-design/icons';

const SignaturePad = React.forwardRef(function SignaturePad(
  {
    width = 400,
    height = 160,
    penColor = '#1f1f1f',
    penWidth = 2,
    disabled = false,
    onChange,
    value,
    placeholder = '请在下方手写签名',
    className = '',
    showActions = true,
    /**
     * 是否允许用户调节笔触粗细。
     *   - true：显示「细/中/粗」三档切换
     *   - false：固定使用 prop penWidth（默认 false）
     */
    showPenWidthPicker = false,
  },
  ref,
) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const lastPosRef = useRef(null);
  const hasContentRef = useRef(false);
  // 是否处于「程序设置 value」状态：避免在回显时又触发 onChange
  const isSettingValueRef = useRef(false);
  // 上一次通过 value 写入的内容（用于判断 value 是否真的变了）
  const lastValueRef = useRef(undefined);
  // 笔画历史：每完成一笔 push 当前画板的 dataURL（不含当前笔）
  const historyRef = useRef([]);
  // 撤销栈
  const redoStackRef = useRef([]);
  // 强制重渲染（让 undo/redo 按钮的 disabled 状态更新）
  const [, forceRender] = useState(0);
  const bump = useCallback(() => forceRender(n => n + 1), []);
  // 画板是否处于 hover 状态（用于快捷键 only in context）
  const [isHovered, setIsHovered] = useState(false);
  // 容器 ref（用于 hover 区域判断 + 快捷键）
  const containerRef = useRef(null);
  // 当前用户选择的笔触粗细（仅在 showPenWidthPicker=true 时生效）
  const [currentPenWidth, setCurrentPenWidth] = useState(penWidth);
  // 同步 prop 变化
  useEffect(() => { setCurrentPenWidth(penWidth); }, [penWidth]);
  // 当前活动的 pointer（pointerId）。用 pointer events 时只能有一个 pointer 影响画板
  const activePointerIdRef = useRef(null);

  // 暴露给父组件的 API（兼容旧用法）
  React.useImperativeHandle(ref, () => ({
    getDataURL: () => {
      const canvas = canvasRef.current;
      if (!canvas || !hasContentRef.current) return '';
      return canvas.toDataURL('image/png');
    },
    isEmpty: () => !hasContentRef.current,
    clear: () => doClear(),
    /** 主动回显一张图片（不触发 onChange） */
    setDataURL: (dataURL) => setValueToCanvas(dataURL),
    /** 撤销最后一笔 */
    undo: () => undo(),
    /** 重做 */
    redo: () => redo(),
    /** 是否可以撤销 */
    canUndo: () => historyRef.current.length > 0,
    /** 是否可以重做 */
    canRedo: () => redoStackRef.current.length > 0,
  }));

  function emitChange() {
    if (!onChange) return;
    if (hasContentRef.current) {
      onChange(true, canvasRef.current ? canvasRef.current.toDataURL('image/png') : '');
    } else {
      onChange(false, '');
    }
  }

  function doClear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasContentRef.current = false;
    lastPosRef.current = null;
    historyRef.current = [];
    redoStackRef.current = [];
    bump();
    emitChange();
  }

  /**
   * 笔画完成时，把"完成 N 笔"的状态快照 push 到 history。
   * 约定：
   *   history.length = 0 → 画板空
   *   history.length = N → 画板上是完成 N 笔的状态
   * undo 时：当前状态存到 redo 栈，pop history，恢复 history[length-1]
   * redo 时：当前状态存到 history 栈，pop redo，恢复该快照
   */
  function snapshotAfterStroke() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const snap = canvas.toDataURL('image/png');
      historyRef.current.push(snap);
      // 新的笔画意味着 redo 栈失效
      if (redoStackRef.current.length > 0) {
        redoStackRef.current = [];
      }
      bump();
    } catch (e) {
      // 静默失败
    }
  }

  function restoreSnapshot(snap) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    if (!snap) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      hasContentRef.current = false;
      lastPosRef.current = null;
      return;
    }
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width / dpr, canvas.height / dpr);
      hasContentRef.current = true;
      lastPosRef.current = null;
    };
    img.onerror = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      hasContentRef.current = false;
    };
    img.src = snap;
  }

  function undo() {
    if (historyRef.current.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    // 把当前画板快照存到 redo 栈
    try {
      redoStackRef.current.push(canvas.toDataURL('image/png'));
    } catch (e) { /* ignore */ }
    // 弹出最后一个历史（也就是当前状态）
    historyRef.current.pop();
    // 恢复 history 现在的栈顶（如果还有），否则清空
    if (historyRef.current.length === 0) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      hasContentRef.current = false;
      lastPosRef.current = null;
    } else {
      restoreSnapshot(historyRef.current[historyRef.current.length - 1]);
    }
    bump();
    emitChange();
  }

  function redo() {
    if (redoStackRef.current.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    // 把当前画板快照存回 history
    try {
      historyRef.current.push(canvas.toDataURL('image/png'));
    } catch (e) { /* ignore */ }
    const next = redoStackRef.current.pop();
    restoreSnapshot(next);
    bump();
    emitChange();
  }

  /**
   * 把一张 PNG 图片绘制到画板（用于受控回显 + 主动 setDataURL）
   * - 不重置 hasContentRef 的状态，由调用方决定
   */
  function setValueToCanvas(dataURL) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!dataURL) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      hasContentRef.current = false;
      lastPosRef.current = null;
      return;
    }
    const img = new Image();
    img.onload = () => {
      // 按画板实际显示尺寸（CSS 像素）等比绘制，保留透明背景
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // canvas 内部坐标系 = width * dpr，需要按比例缩放
      const dpr = window.devicePixelRatio || 1;
      ctx.drawImage(img, 0, 0, canvas.width / dpr, canvas.height / dpr);
      hasContentRef.current = true;
      lastPosRef.current = null;
    };
    img.onerror = () => {
      // 图片解码失败就清空，避免显示坏图
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      hasContentRef.current = false;
    };
    img.src = dataURL;
  }

  // 初始化画布（尺寸 + 高分屏）
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    return () => {
      drawingRef.current = false;
    };
  }, [width, height]);

  // 键盘快捷键：Ctrl/Cmd+Z 撤销，Ctrl/Cmd+Shift+Z 或 Ctrl+Y 重做
  // 仅在画板区域 hover 时响应，避免和 form 里的输入冲突
  useEffect(() => {
    if (!isHovered || disabled) return undefined;
    const handler = (e) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod) return;
      // 排除在 input/textarea 内
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable)) {
        return;
      }
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isHovered, disabled]);

  // 受控：监听外部 value 变化，回显到画板
  useEffect(() => {
    if (value === undefined) return; // 非受控模式
    if (value === lastValueRef.current) return; // 没变
    lastValueRef.current = value;
    isSettingValueRef.current = true;
    if (!value) {
      // 外部置空
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        hasContentRef.current = false;
        lastPosRef.current = null;
      }
    } else {
      setValueToCanvas(value);
    }
    // 设置完成后短暂锁定 onChange，防止图片 onload 里误触发
    setTimeout(() => { isSettingValueRef.current = false; }, 0);
  }, [value]);

  function getPos(clientX, clientY) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }

  /**
   * 是否应该响应一个 pointer 事件：
   *  - 触屏 / 触控笔：始终响应
   *  - 鼠标：左键主键才响应（避免右键拖动误触）
   *  - 已 drawing 中但换了 pointerId：不响应
   */
  function shouldHandlePointer(pointerId, pointerType, isPrimary, button) {
    if (pointerType === 'mouse' && button !== undefined && button !== 0) return false;
    if (drawingRef.current && activePointerIdRef.current !== null && activePointerIdRef.current !== pointerId) {
      return false;
    }
    if (pointerType === 'touch' && isPrimary === false) return false;
    return true;
  }

  function onPointerDown(evt) {
    if (disabled) return;
    if (!shouldHandlePointer(evt.pointerId, evt.pointerType, evt.isPrimary, evt.button)) return;
    evt.preventDefault();
    // 锁定这个 pointer，确保只有它能影响当前笔画
    activePointerIdRef.current = evt.pointerId;
    try {
      evt.currentTarget.setPointerCapture(evt.pointerId);
    } catch (e) { /* ignore — some browsers/old versions */ }
    drawingRef.current = true;
    const p = getPos(evt.clientX, evt.clientY);
    lastPosRef.current = p;
  }

  function onPointerMove(evt) {
    if (!drawingRef.current || disabled) return;
    if (activePointerIdRef.current !== null && evt.pointerId !== activePointerIdRef.current) return;
    // 注意：移出画板也能继续画（因为 pointer capture）
    evt.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const pos = getPos(evt.clientX, evt.clientY);
    ctx.strokeStyle = penColor;
    ctx.lineWidth = showPenWidthPicker ? currentPenWidth : penWidth;
    ctx.beginPath();
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPosRef.current = pos;
    if (!hasContentRef.current) {
      hasContentRef.current = true;
      emitChange();
    }
  }

  function onPointerEnd(evt) {
    if (!drawingRef.current) return;
    if (activePointerIdRef.current !== null && evt.pointerId !== activePointerIdRef.current) return;
    drawingRef.current = false;
    lastPosRef.current = null;
    if (isSettingValueRef.current) return;
    try {
      evt.currentTarget.releasePointerCapture(evt.pointerId);
    } catch (e) { /* ignore */ }
    activePointerIdRef.current = null;
    // 记录这一笔的快照到历史栈
    snapshotAfterStroke();
    // 笔画结束时同步一次最终结果（Form 字段需要）
    emitChange();
  }

  // 兜底：window 级 pointerup（如果 pointer capture 在某些边缘情况下失效）
  // 只挂一次；onPointerEnd 通过 ref 访问的最新状态保持一致
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const handler = (e) => {
      if (!drawingRef.current) return;
      onPointerEnd(e);
    };
    window.addEventListener('pointerup', handler);
    window.addEventListener('pointercancel', handler);
    return () => {
      window.removeEventListener('pointerup', handler);
      window.removeEventListener('pointercancel', handler);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`signature-pad ${className}`}
      style={{ display: 'inline-block' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        style={{
          border: '1px dashed #d9d9d9',
          borderRadius: 6,
          background: disabled ? '#fafafa' : '#fff',
          position: 'relative',
          width,
          minHeight: height,
        }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          style={{
            display: 'block',
            cursor: disabled ? 'not-allowed' : 'crosshair',
            touchAction: 'none', // 阻止浏览器默认的滚动/缩放手势
          }}
        />
        {!hasContentRef.current && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#bfbfbf',
              fontSize: 14,
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            <EditOutlined style={{ marginRight: 6 }} />
            {placeholder}
          </div>
        )}
      </div>
      {showActions && (
        <div style={{ marginTop: 6 }}>
          <Space>
            <Tooltip title="撤销（Ctrl+Z）">
              <Button
                size="small"
                icon={<UndoOutlined />}
                onClick={undo}
                disabled={disabled || historyRef.current.length === 0}
              >
                撤销
              </Button>
            </Tooltip>
            <Tooltip title="重做（Ctrl+Y）">
              <Button
                size="small"
                icon={<RedoOutlined />}
                onClick={redo}
                disabled={disabled || redoStackRef.current.length === 0}
              >
                重做
              </Button>
            </Tooltip>
            <Button
              size="small"
              icon={<ClearOutlined />}
              onClick={doClear}
              disabled={disabled || !hasContentRef.current}
            >
              清除
            </Button>
            {showPenWidthPicker && (
              <Radio.Group
                size="small"
                value={currentPenWidth}
                onChange={e => setCurrentPenWidth(e.target.value)}
                disabled={disabled}
                optionType="button"
                buttonStyle="solid"
              >
                <Radio.Button value={1}>细</Radio.Button>
                <Radio.Button value={2}>中</Radio.Button>
                <Radio.Button value={4}>粗</Radio.Button>
              </Radio.Group>
            )}
            <span style={{ fontSize: 12, color: '#999' }}>建议使用正楷签名</span>
          </Space>
        </div>
      )}
    </div>
  );
});

export default SignaturePad;
