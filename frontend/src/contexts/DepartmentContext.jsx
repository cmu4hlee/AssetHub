import React, { createContext, useContext, useState, useEffect } from 'react';

const DepartmentContext = createContext();

export const useDepartment = () => {
  const context = useContext(DepartmentContext);
  if (!context) {
    throw new Error('useDepartment must be used within DepartmentProvider');
  }
  return context;
};

export const DepartmentProvider = ({ children }) => {
  // 从localStorage读取之前选中的科室作为初始值
  const getInitialDepartmentId = () => {
    const savedDeptId = localStorage.getItem('selectedDepartmentId');
    return savedDeptId || 'all';
  };

  const [selectedDepartmentId, setSelectedDepartmentId] = useState(getInitialDepartmentId());

  const updateSelectedDepartment = deptId => {
    setSelectedDepartmentId(deptId);
    localStorage.setItem('selectedDepartmentId', deptId);
  };

  return (
    <DepartmentContext.Provider value={{ selectedDepartmentId, updateSelectedDepartment }}>
      {children}
    </DepartmentContext.Provider>
  );
};
