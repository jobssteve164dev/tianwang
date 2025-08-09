import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import { useAppDispatch, useAppSelector } from './store/hooks';
import { fetchUserProfile } from './store/slices/authSlice';
import AuthLayout from './components/layout/AuthLayout';
import MainLayout from './components/layout/MainLayout';
import LoginPage from './pages/auth/LoginPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import AlertsPage from './pages/alerts/AlertsPage';
import DevicesPage from './pages/devices/DevicesPage';

const App: React.FC = () => {
  const dispatch = useAppDispatch();
  const { isAuthenticated, token, loading } = useAppSelector((state) => state.auth);

  useEffect(() => {
    // 如果有token但未认证，尝试获取用户信息
    if (token && !isAuthenticated) {
      dispatch(fetchUserProfile() as any);
    }
  }, [dispatch, token, isAuthenticated]);

  // 全局加载状态
  if (loading && token) {
    return (
      <div className="flex-center full-height">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <Routes>
      {/* 认证路由 */}
      <Route
        path="/login"
        element={
          isAuthenticated ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <AuthLayout>
              <LoginPage />
            </AuthLayout>
          )
        }
      />
      
      {/* 主应用路由 */}
      <Route
        path="/*"
        element={
          isAuthenticated ? (
            <MainLayout>
              <Routes>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/alerts" element={<AlertsPage />} />
                <Route path="/devices" element={<DevicesPage />} />
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </MainLayout>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
};

export default App; 