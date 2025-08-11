import React, { useEffect } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Spin, App as AntdApp } from 'antd';
import { useAppDispatch, useAppSelector } from './store/hooks';
import { fetchUserProfile, autoLoginDemo } from './store/slices/authSlice';
import MainLayout from './components/layout/MainLayout';
import LoginPage from './pages/auth/LoginPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import AlertsPage from './pages/alerts/AlertsPage';
import DevicesPage from './pages/devices/DevicesPage';
import RegistrationCodesPage from './pages/registration/RegistrationCodesPage';
import SecurityRulesPage from './pages/security/SecurityRulesPage';
import SettingsPage from './pages/settings/SettingsPage';

const App: React.FC = () => {
  const dispatch = useAppDispatch();
  const { isAuthenticated, token, loading } = useAppSelector((state) => state.auth);

  useEffect(() => {
    // 如果有token但未认证，尝试获取用户信息
    if (token && !isAuthenticated) {
      dispatch(fetchUserProfile() as any);
    }
    
    // 如果没有token且未认证，自动登录演示账户
    if (!token && !isAuthenticated) {
      dispatch(autoLoginDemo() as any);
    }
  }, [dispatch, token, isAuthenticated]);

  // 全局加载状态
  if (loading && token) {
    return (
      <AntdApp>
        <div className="flex-center full-height">
          <Spin size="large" />
        </div>
      </AntdApp>
    );
  }

  return (
    <AntdApp>
      <Routes>
        {!isAuthenticated ? (
          <Route path="/login" element={<LoginPage />} />
        ) : (
          <Route path="/" element={<MainLayout><Outlet /></MainLayout>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="alerts" element={<AlertsPage />} />
            <Route path="devices" element={<DevicesPage />} />
            <Route path="registration-codes" element={<RegistrationCodesPage />} />
            <Route path="security-rules" element={<SecurityRulesPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        )}
        <Route path="*" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} />
      </Routes>
    </AntdApp>
  );
};

export default App; 