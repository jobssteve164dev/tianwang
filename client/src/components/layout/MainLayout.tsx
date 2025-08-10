import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ProLayout } from '@ant-design/pro-components';
import {
  DashboardOutlined,
  AlertOutlined,
  DesktopOutlined,
  UserOutlined,
  LogoutOutlined,
  SafetyCertificateOutlined,
  KeyOutlined,
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
  const [isMobile, setIsMobile] = useState(false);

  // 监听窗口大小变化
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth <= 768);
      // 在移动端自动折叠侧边栏
      if (window.innerWidth <= 768) {
        setCollapsed(true);
      }
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

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
    {
      path: '/registration-codes',
      name: '注册码管理',
      icon: <KeyOutlined />,
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
    // 在移动端点击菜单后自动折叠侧边栏
    if (isMobile) {
      setCollapsed(true);
    }
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
      // 响应式断点配置
      breakpoint="lg"
      collapsedButtonRender={false}
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
                <span style={{ 
                  color: '#fff', 
                  fontWeight: 500,
                  display: isMobile ? 'none' : 'inline'
                }}>
                  {user?.username || '用户'}
                </span>
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
            fontSize: isMobile ? 16 : 18, 
            color: '#333',
            display: isMobile && collapsed ? 'none' : 'inline'
          }}>
            {title}
          </span>
        </Space>
      )}
      layout="mix"
      theme="dark"
      contentStyle={{
        margin: 0,
        padding: 0,
        minHeight: '100vh',
        background: 'transparent',
        overflow: 'auto',
        position: 'relative',
      }}
      style={{
        background: 'transparent',
        minHeight: '100vh',
      }}
      siderMenuType="group"
      menuHeaderRender={false}
      menuItemRender={(item, dom) => (
        <div 
          onClick={() => handleMenuItemClick(item.path || '/')}
          style={{
            margin: isMobile ? '2px 4px' : '4px 8px',
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