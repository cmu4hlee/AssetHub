/**
 * 组件统一导出
 * 通用组件从根目录导出，方便各模块直接 import from '../../components'
 */

// 错误边界
export {
  ErrorBoundary, withErrorBoundary, PageErrorBoundary, ComponentErrorBoundary,
} from './ErrorBoundary';

// 懒加载图片
export { default as LazyImage, LazyImageGallery, LazyBackgroundImage } from './LazyImage';

// 图片画廊
export { default as ImageGallery } from './ImageGallery';

// 加载状态
export {
  default as Loading,
  LoadingSpinner,
  LoadingSkeleton,
  ContentSkeleton,
  LoadingProgress,
  PageLoading,
  ErrorRetry,
  EmptyState,
  DataLoader,
} from './Loading';

// 确认对话框
export {
  default as ConfirmDialog,
  ConfirmType,
  confirm,
  confirmDelete,
  confirmWarning,
  confirmDanger,
  confirmInfo,
  confirmSuccess,
} from './ConfirmDialog';

// 性能监控
export { default as PerformanceMonitor } from './PerformanceMonitor';

// 预警通知
export { default as AlertNotification } from './AlertNotification';

// 移动端卡片列表
export { default as MobileCardList } from './MobileCardList';

// 移动端分页器
export { default as MobilePagination } from './MobilePagination';

// 虚拟化表格
export { default as VirtualizedTable } from './VirtualizedTable';

// =====================================================
// 通用 UI 组件(从 tendering 模块提炼,所有模块可复用)
// =====================================================
export {
  StatusTag,
  KpiCard,
  FilterBar,
  PageHeader,
  ResponsiveTable,
  FlowSteps,
} from './tendering';

// Hook
export { default as useDebouncedValue } from '../hooks/useDebouncedValue';

// 通用工具函数
export {
  formatMoney,
  formatDateTime,
  getStatusInfo,
} from '../constants/tendering';
