import React from 'react';
import { Form, Input, Button, Alert, Space } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
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
    <div>
      <div className="text-center mb-24">
        <h2 style={{ fontSize: 24, fontWeight: 600, margin: 0, marginBottom: 8 }}>
          登录系统
        </h2>
        <p style={{ color: '#666', margin: 0 }}>
          请使用您的账户登录天网安全监控系统
        </p>
      </div>

      {error && (
        <Alert
          message={error}
          type="error"
          closable
          onClose={handleErrorClose}
          style={{ marginBottom: 24 }}
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
        >
          <Input
            prefix={<UserOutlined />}
            placeholder="请输入用户名"
          />
        </Form.Item>

        <Form.Item
          name="password"
          label="密码"
          rules={[
            { required: true, message: '请输入密码' },
            { min: 6, message: '密码至少6个字符' },
          ]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="请输入密码"
          />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0 }}>
          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
            block
            style={{ height: 48, fontSize: 16 }}
          >
            登录
          </Button>
        </Form.Item>
      </Form>

      <div className="text-center" style={{ marginTop: 24, color: '#999', fontSize: 14 }}>
        <Space>
          <span>演示账户：admin / 123456</span>
        </Space>
      </div>
    </div>
  );
};

export default LoginPage; 