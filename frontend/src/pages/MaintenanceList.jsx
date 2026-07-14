/**
 * MaintenanceList - 维修列表页面
 * 重定向到临时维修列表页面
 */
import React from 'react';
import TemporaryMaintenanceList from './TemporaryMaintenanceList';

const MaintenanceList = (props) => <TemporaryMaintenanceList {...props} />;

export default MaintenanceList;
