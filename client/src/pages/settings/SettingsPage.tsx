import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Tabs,
  Form,
  Input,
  Button,
  Switch,
  InputNumber,
  message,
  Space,
  Divider,
  Alert,
  Spin,
  Row,
  Col,
  Typography,
  Tag,
  Tooltip,
} from 'antd';
import {
  MailOutlined,
  MessageOutlined,
  ApiOutlined,
  SettingOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { notificationApi } from '../../services/api';

const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { Password } = Input;

interface NotificationConfig {
  email: {
    smtp: {
      host: string;
      port: number;
      secure: boolean;
      auth: {
        user: string;
        pass: string;
      };
    };
    from: string;
    enabled: boolean;
  };
  sms: {
    aliyun: {
      accessKey: string;
      secretKey: string;
      signName: string;
      templateCode: string;
    };
    enabled: boolean;
  };
  webhook: {
    timeout: number;
    retryTimes: number;
    retryDelay: number;
    enabled: boolean;
  };
  general: {
    retryAttempts: number;
    retryDelay: number;
    maxQueueSize: number;
  };
}

const SettingsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [config, setConfig] = useState<NotificationConfig | null>(null);
  const [form] = Form.useForm();

  // 加载配置
  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      const response = await notificationApi.getConfig();
      if (response.success) {
        setConfig(response.config);
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
  const handleSave = useCallback(async (values: any) => {
    try {
      setSaving(true);
      const response = await notificationApi.updateConfig(values);
      if (response.success) {
        message.success('配置保存成功');
        await loadConfig(); // 重新加载配置
      } else {
        message.error(response.message || '保存失败');
      }
    } catch (error) {
      console.error('保存配置失败:', error);
      message.error('保存配置失败');
    } finally {
      setSaving(false);
    }
  }, [loadConfig]);

  // 测试通知
  const handleTest = useCallback(async (type: string) => {
    const recipient = form.getFieldValue(`${type}.testRecipient`);
    if (!recipient) {
      message.error('请输入测试接收者');
      return;
    }

    try {
      setTesting(true);
      const response = await notificationApi.sendTestNotification({
        type,
        recipient,
      });
      if (response.success) {
        message.success('测试通知发送成功');
      } else {
        message.error(response.message || '测试失败');
      }
    } catch (error) {
      console.error('测试通知失败:', error);
      message.error('测试通知失败');
    } finally {
      setTesting(false);
    }
  }, [form]);

  useEffect(() => {
    loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>加载配置中...</div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <div className="page-header">
        <Title level={2}>
          <SettingOutlined /> 系统设置
        </Title>
        <Text type="secondary">配置通知系统和其他系统参数</Text>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSave}
        initialValues={config || {}}
      >
        <Tabs defaultActiveKey="notification" size="large">
          <TabPane
            tab={
              <span>
                <MailOutlined />
                通知配置
              </span>
            }
            key="notification"
          >
            <Row gutter={[24, 24]}>
              {/* 邮件配置 */}
              <Col xs={24} lg={12}>
                <Card
                  title={
                    <Space>
                      <MailOutlined />
                      邮件通知配置
                      {config?.email.enabled ? (
                        <Tag color="green" icon={<CheckCircleOutlined />}>
                          已启用
                        </Tag>
                      ) : (
                        <Tag color="red" icon={<CloseCircleOutlined />}>
                          未配置
                        </Tag>
                      )}
                    </Space>
                  }
                  extra={
                    <Tooltip title="测试邮件配置">
                      <Button
                        type="link"
                        icon={<MailOutlined />}
                        onClick={() => handleTest('email')}
                        loading={testing}
                        disabled={!config?.email.enabled}
                      >
                        测试
                      </Button>
                    </Tooltip>
                  }
                >
                  <Form.Item
                    label="SMTP服务器"
                    name={['email', 'smtp', 'host']}
                    rules={[{ required: true, message: '请输入SMTP服务器地址' }]}
                  >
                    <Input placeholder="例如: smtp.gmail.com" />
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
                        label="安全连接"
                        name={['email', 'smtp', 'secure']}
                        valuePropName="checked"
                      >
                        <Switch />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item
                    label="邮箱地址"
                    name={['email', 'smtp', 'auth', 'user']}
                    rules={[
                      { required: true, message: '请输入邮箱地址' },
                      { type: 'email', message: '请输入有效的邮箱地址' },
                    ]}
                  >
                    <Input placeholder="your-email@gmail.com" />
                  </Form.Item>

                  <Form.Item
                    label="密码/应用密码"
                    name={['email', 'smtp', 'auth', 'pass']}
                    rules={[{ required: true, message: '请输入密码' }]}
                  >
                    <Password placeholder="邮箱密码或应用专用密码" />
                  </Form.Item>

                  <Form.Item
                    label="发件人邮箱"
                    name={['email', 'from']}
                    rules={[
                      { required: true, message: '请输入发件人邮箱' },
                      { type: 'email', message: '请输入有效的邮箱地址' },
                    ]}
                  >
                    <Input placeholder="alerts@your-domain.com" />
                  </Form.Item>

                  <Form.Item
                    label="测试接收者"
                    name={['email', 'testRecipient']}
                  >
                    <Input placeholder="测试接收邮箱地址" />
                  </Form.Item>

                  <Alert
                    message="邮件配置说明"
                    description="对于Gmail，请使用应用专用密码而不是账户密码。其他邮件服务商请参考其SMTP配置文档。"
                    type="info"
                    showIcon
                    style={{ marginTop: 16 }}
                  />
                </Card>
              </Col>

              {/* 短信配置 */}
              <Col xs={24} lg={12}>
                <Card
                  title={
                    <Space>
                      <MessageOutlined />
                      短信通知配置
                      {config?.sms.enabled ? (
                        <Tag color="green" icon={<CheckCircleOutlined />}>
                          已启用
                        </Tag>
                      ) : (
                        <Tag color="red" icon={<CloseCircleOutlined />}>
                          未配置
                        </Tag>
                      )}
                    </Space>
                  }
                  extra={
                    <Tooltip title="测试短信配置">
                      <Button
                        type="link"
                        icon={<MessageOutlined />}
                        onClick={() => handleTest('sms')}
                        loading={testing}
                        disabled={!config?.sms.enabled}
                      >
                        测试
                      </Button>
                    </Tooltip>
                  }
                >
                  <Form.Item
                    label="阿里云AccessKey"
                    name={['sms', 'aliyun', 'accessKey']}
                    rules={[{ required: true, message: '请输入AccessKey' }]}
                  >
                    <Input placeholder="阿里云AccessKey" />
                  </Form.Item>

                  <Form.Item
                    label="阿里云SecretKey"
                    name={['sms', 'aliyun', 'secretKey']}
                    rules={[{ required: true, message: '请输入SecretKey' }]}
                  >
                    <Password placeholder="阿里云SecretKey" />
                  </Form.Item>

                  <Form.Item
                    label="短信签名"
                    name={['sms', 'aliyun', 'signName']}
                    rules={[{ required: true, message: '请输入短信签名' }]}
                  >
                    <Input placeholder="例如: 天网安全" />
                  </Form.Item>

                  <Form.Item
                    label="短信模板代码"
                    name={['sms', 'aliyun', 'templateCode']}
                    rules={[{ required: true, message: '请输入模板代码' }]}
                  >
                    <Input placeholder="例如: SMS_123456789" />
                  </Form.Item>

                  <Form.Item
                    label="测试手机号"
                    name={['sms', 'testRecipient']}
                  >
                    <Input placeholder="测试接收手机号" />
                  </Form.Item>

                  <Alert
                    message="短信配置说明"
                    description="需要在阿里云短信服务中申请签名和模板，并确保模板内容符合安全通知的需求。"
                    type="info"
                    showIcon
                    style={{ marginTop: 16 }}
                  />
                </Card>
              </Col>

              {/* Webhook配置 */}
              <Col xs={24}>
                <Card
                  title={
                    <Space>
                      <ApiOutlined />
                      Webhook配置
                      <Tag color="green" icon={<CheckCircleOutlined />}>
                        已启用
                      </Tag>
                    </Space>
                  }
                  extra={
                    <Tooltip title="测试Webhook配置">
                      <Button
                        type="link"
                        icon={<ApiOutlined />}
                        onClick={() => handleTest('webhook')}
                        loading={testing}
                      >
                        测试
                      </Button>
                    </Tooltip>
                  }
                >
                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item
                        label="超时时间(毫秒)"
                        name={['webhook', 'timeout']}
                        rules={[{ required: true, message: '请输入超时时间' }]}
                      >
                        <InputNumber
                          min={1000}
                          max={60000}
                          style={{ width: '100%' }}
                          placeholder="10000"
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
                          min={0}
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

                  <Form.Item
                    label="测试Webhook URL"
                    name={['webhook', 'testRecipient']}
                  >
                    <Input placeholder="https://your-webhook-endpoint.com/webhook" />
                  </Form.Item>

                  <Alert
                    message="Webhook配置说明"
                    description="Webhook用于将安全事件推送到外部系统。请确保目标URL能够接收POST请求并返回200状态码。"
                    type="info"
                    showIcon
                    style={{ marginTop: 16 }}
                  />
                </Card>
              </Col>

              {/* 通用配置 */}
              <Col xs={24}>
                <Card title="通用配置">
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

            <Divider />

            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <Space size="large">
                <Button
                  type="primary"
                  size="large"
                  htmlType="submit"
                  loading={saving}
                  icon={<SettingOutlined />}
                >
                  保存配置
                </Button>
                <Button
                  size="large"
                  onClick={loadConfig}
                  icon={<SettingOutlined />}
                >
                  重置
                </Button>
              </Space>
            </div>
          </TabPane>
        </Tabs>
      </Form>
    </div>
  );
};

export default SettingsPage;
