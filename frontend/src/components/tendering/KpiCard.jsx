import React from 'react';
import './KpiCard.css';

/**
 * 统一风格的 KPI 统计卡
 *
 * @param {string} title - 指标名称
 * @param {string|number} value - 指标数值
 * @param {string} suffix - 后缀（"元"、"份"）
 * @param {ReactNode} prefix - 前缀（图标）
 * @param {ReactNode} icon - 右上角图标
 * @param {string} tone - 色调：default | primary | success | warning | danger | purple | cyan
 * @param {string} hint - 底部说明文字
 * @param {object} trend - { value, direction: 'up'|'down' }
 * @param {function} onClick - 点击事件
 * @param {boolean} loading - 加载态
 *
 * @example
 * <KpiCard title="招标项目总数" value={120} tone="primary"
 *   icon={<FileTextOutlined />} hint="近30天新增 8 个" />
 * <KpiCard title="待审资质" value={3} tone="warning" onClick={...} />
 */
const KpiCard = ({
  title,
  value,
  suffix,
  prefix,
  icon,
  tone = 'default',
  hint,
  trend,
  onClick,
  loading = false,
}) => {
  const isClickable = typeof onClick === 'function';
  return (
    <div
      className={`kpi-card kpi-card--${tone} ${isClickable ? 'kpi-card--clickable' : ''}`}
      onClick={isClickable ? onClick : undefined}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div className="kpi-card-header">
        <span className="kpi-card-title">{title}</span>
        {icon ? <span className="kpi-card-icon">{icon}</span> : null}
      </div>
      <div className="kpi-card-value">
        {prefix ? <span className="kpi-card-prefix">{prefix}</span> : null}
        <span className="kpi-card-number">
          {loading ? '-' : (value ?? 0).toLocaleString('zh-CN')}
        </span>
        {suffix ? <span className="kpi-card-suffix">{suffix}</span> : null}
      </div>
      {(hint || trend) && (
        <div className="kpi-card-footer">
          {trend ? (
            <span
              className={`kpi-card-trend kpi-card-trend--${trend.direction || 'up'}`}
              title={trend.label}
            >
              {trend.direction === 'down' ? '↓' : '↑'} {trend.value}
            </span>
          ) : null}
          {hint ? <span className="kpi-card-hint">{hint}</span> : null}
        </div>
      )}
    </div>
  );
};

export default KpiCard;
