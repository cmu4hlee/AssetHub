import React from 'react';
import { Outlet } from 'react-router-dom';
import { DepartmentProvider } from '../contexts/DepartmentContext';
import { AppStateProvider } from '../contexts/AppStateContext';
import AntdStaticBridge from './AntdStaticBridge';
import AppLayout from './Layout';
import ProtectedRoute from './ProtectedRoute';

const AuthenticatedShell = () => (
  <AppStateProvider>
    <DepartmentProvider>
      <ProtectedRoute>
        <AntdStaticBridge />
        <AppLayout>
          <Outlet />
        </AppLayout>
      </ProtectedRoute>
    </DepartmentProvider>
  </AppStateProvider>
);

export default AuthenticatedShell;
