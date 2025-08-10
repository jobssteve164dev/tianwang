import React from 'react';

interface AuthLayoutProps {
  children: React.ReactNode;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  // 由于登录页面现在有完整的布局，这里直接返回子组件
  return <>{children}</>;
};

export default AuthLayout; 