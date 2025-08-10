import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ProLayout } from '@ant-design/pro-components';
import {
  DashboardOutlined,
  AlertOutlined,
  DesktopOutlined,
  UserOutlined,
  LogoutOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { Avatar, Dropdown, Space } from 'antd';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { logout } from '../../store/slices/authSlice';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAppSelector((state) => state.auth);
  const [collapsed, setCollapsed] = useState(false);

  // 菜单配置
  const menuItems = [
    {
      path: '/dashboard',
      name: '安全仪表盘',
      icon: <DashboardOutlined />,
    },
    {
      path: '/alerts',
      name: '威胁告警',
      icon: <AlertOutlined />,
    },
    {
      path: '/devices',
      name: '设备管理',
      icon: <DesktopOutlined />,
    },
  ];

  // 用户菜单
  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人设置',
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
    },
  ];

  const handleMenuClick = ({ key }: { key: string }) => {
    if (key === 'logout') {
      dispatch(logout());
      navigate('/login');
    }
  };

  const handleMenuItemClick = (path: string) => {
    navigate(path);
  };

  return (
    <ProLayout
      title="天网安全监控"
      logo={<SafetyCertificateOutlined style={{ fontSize: 28, color: '#667eea' }} />}
      collapsed={collapsed}
      onCollapse={setCollapsed}
      location={{
        pathname: location.pathname,
      }}
      menu={{
        type: 'group',
        request: async () => menuItems,
      }}
      menuItemRender={(item, dom) => (
        <div onClick={() => handleMenuItemClick(item.path || '/')}>
          {dom}
        </div>
      )}
      avatarProps={{
        src: undefined,
        title: user?.username || '用户',
        size: 'small',
        render: () => {
          return (
            <Dropdown
              menu={{
                items: userMenuItems,
                onClick: handleMenuClick,
              }}
              placement="bottomRight"
            >
              <Space style={{ cursor: 'pointer', padding: '0 8px' }}>
                <Avatar 
                  size="small" 
                  icon={<UserOutlined />} 
                  style={{ 
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    border: '2px solid rgba(255, 255, 255, 0.3)'
                  }} 
                />
                <span style={{ color: '#fff', fontWeight: 500 }}>{user?.username || '用户'}</span>
              </Space>
            </Dropdown>
          );
        },
      }}
      headerTitleRender={(logo, title) => (
        <Space>
          {logo}
          <span style={{ 
            fontWeight: 600, 
            fontSize: 18, 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            {title}
          </span>
        </Space>
      )}
      layout="mix"
      theme="dark"
      contentStyle={{
        margin: 0,
        padding: 16,
        minHeight: 'calc(100vh - 56px)',
        background: 'transparent',
      }}
      style={{
        background: 'transparent',
      }}
      siderMenuType="group"
      menuHeaderRender={(logo, title) => (
        <div style={{ 
          padding: '16px 12px', 
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          marginBottom: 8
        }}>
          <Space>
            {logo}
            <span style={{ 
              color: '#fff', 
              fontWeight: 600, 
              fontSize: 16,
              opacity: collapsed ? 0 : 1,
              transition: 'opacity 0.3s'
            }}>
              {title}
            </span>
          </Space>
        </div>
      )}
      menuItemRender={(item, dom) => (
        <div 
          onClick={() => handleMenuItemClick(item.path || '/')}
          style={{
            margin: '4px 8px',
            borderRadius: 8,
            transition: 'all 0.3s ease',
          }}
        >
          {dom}
        </div>
      )}
    >
      <div className="compact-layout fade-in-up">
        {children}
      </div>
    </ProLayout>
  );
};

export default MainLayout; 