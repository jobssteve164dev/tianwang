import React from 'react';
import { Form, Input, Button, Alert } from 'antd';
import { UserOutlined, LockOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { loginAsync, clearError } from '../../store/slices/authSlice';
import './LoginPage.css';

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
      await dispatch(loginAsync(values)).unwrap();
    } catch {
      form.focusField('password');
    }
  };

  const handleErrorClose = () => {
    dispatch(clearError());
  };

  return (
    <main className="login-page" style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <section className="login-panel" aria-labelledby="login-title" style={{
        width: '100%',
        maxWidth: '440px',
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
          <h1 id="login-title" style={{
            fontSize: '28px',
            fontWeight: 600,
            margin: 0,
            marginBottom: '8px',
            color: '#1e2547'
          }}>
            天网安全监控
          </h1>
          <p style={{ color: '#666', margin: 0, fontSize: '14px' }}>
            登录，掌握设备与安全态势
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
          autoComplete="on"
          onValuesChange={() => error && dispatch(clearError())}
          scrollToFirstError
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
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
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
              autoComplete="current-password"
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
      </section>
    </main>
  );
};

export default LoginPage;
