/**
 * Hooks 统一导出
 */

export {
  useApiRequest,
  useListRequest,
  useFormSubmit,
  useAutoRefresh,
  useDebouncedSearch,
  useBatchOperation,
} from './useApi';

export { useAppState, useLoading } from '../contexts/AppStateContext';
export { default as useIsMobile } from './useIsMobile';
export { default as useIsTablet } from './useIsTablet';
export { default as useLocalStorage } from './useLocalStorage';
export { default as useFeishu } from './useFeishu';
export { default as useCurrentUser } from './useCurrentUser';
export { useHighRiskOperation, useMaintenanceOperations } from './useHighRiskOperation';
export { useMaintenanceCommon } from './useMaintenanceCommon';
export { useMetrology } from './useQualityControl';
export { useDashboardData } from './useDashboardData';
export { usePermission, useCan, useIsAdmin } from './usePermission';