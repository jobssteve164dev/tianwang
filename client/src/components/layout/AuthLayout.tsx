import React from 'react';
import { Layout, Card } from 'antd';
import { SafetyCertificateOutlined } from '@ant-design/icons';

const { Content } = Layout;

interface AuthLayoutProps {
  children: React.ReactNode;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  return (
    <Layout className="full-height">
      <Content className="flex-center" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        <div style={{ width: '100%', maxWidth: 400, padding: '0 24px' }}>
          {/* 应用Logo和标题 */}
          <div className="text-center mb-24">
            <div style={{ fontSize: 48, color: '#fff', marginBottom: 16 }}>
              <SafetyCertificateOutlined />
            </div>
            <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 600, margin: 0 }}>
              天网安全监控系统
            </h1>
            <p style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: 16, margin: '8px 0 0 0' }}>
              AI驱动的网络安全防护平台
            </p>
          </div>

          {/* 认证表单卡片 */}
          <Card
            bordered={false}
            style={{
              borderRadius: 12,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
            }}
          >
            {children}
          </Card>
        </div>
      </Content>
    </Layout>
  );
};

export default AuthLayout; 