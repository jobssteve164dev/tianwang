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
      logo={<SafetyCertificateOutlined style={{ fontSize: 32, color: '#1890ff' }} />}
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
                <Avatar size="small" icon={<UserOutlined />} />
                <span style={{ color: '#fff' }}>{user?.username || '用户'}</span>
              </Space>
            </Dropdown>
          );
        },
      }}
      headerTitleRender={(logo, title) => (
        <Space>
          {logo}
          <span style={{ fontWeight: 600, fontSize: 18 }}>{title}</span>
        </Space>
      )}
      layout="mix"
      theme="dark"
      contentStyle={{
        margin: 0,
        padding: 24,
        minHeight: 'calc(100vh - 64px)',
      }}
    >
      {children}
    </ProLayout>
  );
};

export default MainLayout; 