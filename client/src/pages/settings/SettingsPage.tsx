import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Switch,
  Space,
  Row,
  Col,
  Typography,
  Tabs,
  message,
  InputNumber,
} from 'antd';
import {
  SettingOutlined,
} from '@ant-design/icons';
import { notificationApi } from '../../services/api';
import AIModelConfig from '../../components/settings/AIModelConfig';
import AIUsageStats from '../../components/settings/AIUsageStats';

const { Title, Paragraph } = Typography;

const SettingsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [form] = Form.useForm();

  // 加载配置
  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      const response = await notificationApi.getConfig();
      if (response.success) {
        form.setFieldsValue(response.config);
      } else {
        message.error('加载配置失败');
      }
    } catch (error) {
      console.error('加载配置失败:', error);
      message.error('加载配置失败');
    } finally {
      setLoading(false);
    }
  }, [form]);

  // 保存配置
  const handleSave = async (values: any) => {
    try {
      setSaving(true);
      const response = await notificationApi.updateConfig(values);
      if (response.success) {
        message.success('配置保存成功');
        await loadConfig();
      } else {
        message.error(response.message || '保存失败');
      }
    } catch (error) {
      console.error('保存配置失败:', error);
      message.error('保存配置失败');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // 定义Tabs的items
  const tabItems = [
    {
      key: 'notification',
      label: '通知配置',
      children: (
        <Card
          title={
            <Space>
              <SettingOutlined />
              通知配置
            </Space>
          }
          extra={
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={saving}
                icon={<SettingOutlined />}
                onClick={() => form.submit()}
              >
                保存配置
              </Button>
              <Button
                onClick={loadConfig}
                icon={<SettingOutlined />}
              >
                重置
              </Button>
            </Space>
          }
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSave}
          >
            <Row gutter={[24, 24]}>
              <Col span={12}>
                <Card title="邮件通知配置" size="small">
                <Form.Item
                  label="启用邮件通知"
                  name={['email', 'enabled']}
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>
                
                <Form.Item
                  label="SMTP服务器"
                  name={['email', 'smtp', 'host']}
                  rules={[{ required: true, message: '请输入SMTP服务器地址' }]}
                >
                  <Input placeholder="smtp.example.com" />
                </Form.Item>
                
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      label="端口"
                      name={['email', 'smtp', 'port']}
                      rules={[{ required: true, message: '请输入端口号' }]}
                    >
                      <InputNumber
                        min={1}
                        max={65535}
                        style={{ width: '100%' }}
                        placeholder="587"
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      label="启用SSL"
                      name={['email', 'smtp', 'secure']}
                      valuePropName="checked"
                    >
                      <Switch />
                    </Form.Item>
                  </Col>
                </Row>
                
                <Form.Item
                  label="用户名"
                  name={['email', 'smtp', 'auth', 'user']}
                  rules={[{ required: true, message: '请输入用户名' }]}
                >
                  <Input placeholder="your-email@example.com" />
                </Form.Item>
                
                <Form.Item
                  label="密码"
                  name={['email', 'smtp', 'auth', 'pass']}
                  rules={[{ required: true, message: '请输入密码' }]}
                >
                  <Input.Password placeholder="邮箱密码或应用密码" />
                </Form.Item>
                
                <Form.Item
                  label="发件人"
                  name={['email', 'from']}
                  rules={[{ required: true, message: '请输入发件人地址' }]}
                >
                  <Input placeholder="noreply@example.com" />
                </Form.Item>
              </Card>
            </Col>
            
            <Col span={12}>
              <Card title="短信通知配置" size="small">
                <Form.Item
                  label="启用短信通知"
                  name={['sms', 'enabled']}
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>
                
                <Form.Item
                  label="Access Key"
                  name={['sms', 'aliyun', 'accessKey']}
                  rules={[{ required: true, message: '请输入Access Key' }]}
                >
                  <Input placeholder="阿里云Access Key" />
                </Form.Item>
                
                <Form.Item
                  label="Secret Key"
                  name={['sms', 'aliyun', 'secretKey']}
                  rules={[{ required: true, message: '请输入Secret Key' }]}
                >
                  <Input.Password placeholder="阿里云Secret Key" />
                </Form.Item>
                
                <Form.Item
                  label="签名名称"
                  name={['sms', 'aliyun', 'signName']}
                  rules={[{ required: true, message: '请输入签名名称' }]}
                >
                  <Input placeholder="短信签名" />
                </Form.Item>
                
                <Form.Item
                  label="模板代码"
                  name={['sms', 'aliyun', 'templateCode']}
                  rules={[{ required: true, message: '请输入模板代码' }]}
                >
                  <Input placeholder="SMS_123456789" />
                </Form.Item>
              </Card>
            </Col>
          </Row>

          <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
            <Col span={12}>
              <Card title="Webhook配置" size="small">
                <Form.Item
                  label="启用Webhook"
                  name={['webhook', 'enabled']}
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>
                
                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item
                      label="超时时间(秒)"
                      name={['webhook', 'timeout']}
                      rules={[{ required: true, message: '请输入超时时间' }]}
                    >
                      <InputNumber
                        min={1}
                        max={300}
                        style={{ width: '100%' }}
                        placeholder="30"
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      label="重试次数"
                      name={['webhook', 'retryTimes']}
                      rules={[{ required: true, message: '请输入重试次数' }]}
                    >
                      <InputNumber
                        min={1}
                        max={10}
                        style={{ width: '100%' }}
                        placeholder="3"
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      label="重试延迟(毫秒)"
                      name={['webhook', 'retryDelay']}
                      rules={[{ required: true, message: '请输入重试延迟' }]}
                    >
                      <InputNumber
                        min={100}
                        max={10000}
                        style={{ width: '100%' }}
                        placeholder="1000"
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>
            </Col>
            
            <Col span={12}>
              <Card title="通用配置" size="small">
                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item
                      label="重试次数"
                      name={['general', 'retryAttempts']}
                      rules={[{ required: true, message: '请输入重试次数' }]}
                    >
                      <InputNumber
                        min={1}
                        max={10}
                        style={{ width: '100%' }}
                        placeholder="3"
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      label="重试延迟(毫秒)"
                      name={['general', 'retryDelay']}
                      rules={[{ required: true, message: '请输入重试延迟' }]}
                    >
                      <InputNumber
                        min={100}
                        max={10000}
                        style={{ width: '100%' }}
                        placeholder="1000"
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      label="队列大小"
                      name={['general', 'maxQueueSize']}
                      rules={[{ required: true, message: '请输入队列大小' }]}
                    >
                      <InputNumber
                        min={10}
                        max={10000}
                        style={{ width: '100%' }}
                        placeholder="1000"
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>
            </Col>
          </Row>
        </Form>
        </Card>
      )
    },
    {
      key: 'ai-model',
      label: 'AI模型配置',
      children: (
        <Card
          title={
            <Space>
              <SettingOutlined />
              AI模型配置
            </Space>
          }
        >
          <AIModelConfig 
            onConfigChange={() => setRefreshTrigger(prev => prev + 1)}
          />
        </Card>
      )
    },
    {
      key: 'ai-stats',
      label: 'API使用统计',
      children: (
        <Card
          title={
            <Space>
              <SettingOutlined />
              API使用统计
            </Space>
          }
        >
          <AIUsageStats refreshTrigger={refreshTrigger} />
        </Card>
      )
    }
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <div>加载配置中...</div>
      </div>
    );
  }

  return (
    <div className="fade-in-up">
      <div className="page-header">
        <Title level={2}>
          <SettingOutlined style={{ marginRight: 8 }} />
          系统设置
        </Title>
        <Paragraph type="secondary">
          配置系统参数、通知设置和AI模型配置
        </Paragraph>
      </div>
      
      <Tabs 
        defaultActiveKey="notification" 
        size="large"
        items={tabItems} 
        style={{ marginTop: 24 }} 
      />
    </div>
  );
};

export default SettingsPage;
