import React from 'react';
import { Form, Input, Button, Alert, Space } from 'antd';
import { UserOutlined, LockOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { loginAsync, clearError } from '../../store/slices/authSlice';

interface LoginForm {
  username: string;
  password: string;
}

const LoginPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { loading, error } = useAppSelector((state) => state.auth);
  const [form] = Form.useForm();

  const handleSubmit = async (values: LoginForm) => {
    try {
      await (dispatch as any)(loginAsync(values)).unwrap();
    } catch (error) {
      // 错误已经在Redux中处理
      console.error('登录失败:', error);
    }
  };

  const handleErrorClose = () => {
    dispatch(clearError());
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px'
    }}>
      <div className="modern-card" style={{
        width: '100%',
        maxWidth: '400px',
        padding: '40px',
        textAlign: 'center'
      }}>
        <div style={{ marginBottom: '32px' }}>
          <SafetyCertificateOutlined 
            style={{ 
              fontSize: '48px', 
              color: '#667eea',
              marginBottom: '16px',
              display: 'block'
            }} 
          />
          <h2 style={{ 
            fontSize: '28px', 
            fontWeight: 600, 
            margin: 0, 
            marginBottom: '8px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            天网安全监控
          </h2>
          <p style={{ color: '#666', margin: 0, fontSize: '14px' }}>
            请使用您的账户登录系统
          </p>
        </div>

        {error && (
          <Alert
            message={error}
            type="error"
            closable
            onClose={handleErrorClose}
            style={{ marginBottom: '24px' }}
            className="modern-card"
          />
        )}

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          autoComplete="off"
          size="large"
        >
          <Form.Item
            name="username"
            label="用户名"
            rules={[
              { required: true, message: '请输入用户名' },
              { min: 3, message: '用户名至少3个字符' },
            ]}
            style={{ marginBottom: '20px' }}
          >
            <Input
              prefix={<UserOutlined style={{ color: '#667eea' }} />}
              placeholder="请输入用户名"
              className="modern-input"
              style={{ height: '44px', borderRadius: '8px' }}
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="密码"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 6, message: '密码至少6个字符' },
            ]}
            style={{ marginBottom: '32px' }}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#667eea' }} />}
              placeholder="请输入密码"
              className="modern-input"
              style={{ height: '44px', borderRadius: '8px' }}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              className="modern-button"
              style={{ 
                height: '48px', 
                fontSize: '16px',
                fontWeight: 600,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                borderRadius: '8px'
              }}
            >
              登录
            </Button>
          </Form.Item>
        </Form>

        <div style={{ 
          marginTop: '24px', 
          color: '#999', 
          fontSize: '12px',
          padding: '16px',
          background: 'rgba(102, 126, 234, 0.05)',
          borderRadius: '8px',
          border: '1px solid rgba(102, 126, 234, 0.1)'
        }}>
          <Space direction="vertical" size="small">
            <span style={{ fontWeight: 500, color: '#667eea' }}>演示账户</span>
            <span>用户名：admin</span>
            <span>密码：123456</span>
          </Space>
        </div>
      </div>
    </div>
  );
};

export default LoginPage; 