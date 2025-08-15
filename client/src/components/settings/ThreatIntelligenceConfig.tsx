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
  Alert,
  Tag,
  Spin,
  App
} from 'antd';
import {
  SecurityScanOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
  LinkOutlined,
  KeyOutlined,
  GlobalOutlined
} from '@ant-design/icons';
import { threatIntelligenceApi } from '../../services/api';

const { Paragraph } = Typography;

interface ThreatIntelligenceConfigProps {
  onConfigChange?: () => void;
}

interface ConfigData {
  misp: {
    enabled: boolean;
    url: string;
    apiKey: string;
    status: 'connected' | 'disconnected' | 'error' | 'unknown';
  };
  otx: {
    enabled: boolean;
    apiKey: string;
    status: 'connected' | 'disconnected' | 'error' | 'unknown';
  };
}

const ThreatIntelligenceConfig: React.FC<ThreatIntelligenceConfigProps> = ({
  onConfigChange
}) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [config, setConfig] = useState<ConfigData>({
    misp: {
      enabled: false,
      url: '',
      apiKey: '',
      status: 'unknown'
    },
    otx: {
      enabled: false,
      apiKey: '',
      status: 'unknown'
    }
  });

  // 加载配置
  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      const response = await threatIntelligenceApi.getConfig();
      if (response.success) {
        setConfig(response.data);
        form.setFieldsValue(response.data);
      } else {
        message.error('加载威胁情报配置失败');
      }
    } catch (error) {
      console.error('加载威胁情报配置失败:', error);
      message.error('加载威胁情报配置失败');
    } finally {
      setLoading(false);
    }
  }, [form]);

  // 保存配置
  const handleSave = async (values: any) => {
    try {
      setSaving(true);
      const response = await threatIntelligenceApi.updateConfig(values);
      if (response.success) {
        message.success('威胁情报配置保存成功');
        await loadConfig();
        onConfigChange?.();
      } else {
        message.error(response.message || '保存失败');
      }
    } catch (error) {
      console.error('保存威胁情报配置失败:', error);
      message.error('保存威胁情报配置失败');
    } finally {
      setSaving(false);
    }
  };

  // 测试连接
  const testConnection = async (source: 'misp' | 'otx') => {
    try {
      setTesting(source);
      const response = await threatIntelligenceApi.testConnection(source);
      if (response.success) {
        message.success(`${source.toUpperCase()} 连接测试成功`);
        await loadConfig(); // 重新加载状态
      } else {
        message.error(response.message || `${source.toUpperCase()} 连接测试失败`);
      }
    } catch (error) {
      console.error(`${source.toUpperCase()} 连接测试失败:`, error);
      message.error(`${source.toUpperCase()} 连接测试失败`);
    } finally {
      setTesting(null);
    }
  };

  // 获取状态标签
  const getStatusTag = (status: string) => {
    switch (status) {
      case 'connected':
        return <Tag color="green" icon={<CheckCircleOutlined />}>已连接</Tag>;
      case 'disconnected':
        return <Tag color="orange" icon={<ExclamationCircleOutlined />}>未连接</Tag>;
      case 'error':
        return <Tag color="red" icon={<ExclamationCircleOutlined />}>连接错误</Tag>;
      default:
        return <Tag color="default" icon={<InfoCircleOutlined />}>未知状态</Tag>;
    }
  };

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>加载威胁情报配置中...</div>
      </div>
    );
  }

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSave}
      initialValues={config}
    >
      <Alert
        message="威胁情报配置"
        description="配置MISP和OTX威胁情报源，用于获取最新的威胁情报数据。这些配置将用于AI引擎的威胁检测功能。"
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      {/* MISP配置 */}
      <Card
        title={
          <Space>
            <SecurityScanOutlined />
            MISP威胁情报配置
          </Space>
        }
        extra={
          <Space>
            {getStatusTag(config.misp.status)}
            <Button
              size="small"
              icon={<ReloadOutlined />}
              loading={testing === 'misp'}
              onClick={() => testConnection('misp')}
            >
              测试连接
            </Button>
          </Space>
        }
        style={{ marginBottom: 24 }}
      >
        <Row gutter={[24, 16]}>
          <Col span={24}>
            <Form.Item
              label="启用MISP威胁情报"
              name={['misp', 'enabled']}
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          </Col>
          
          <Col span={12}>
            <Form.Item
              label={
                <Space>
                  <GlobalOutlined />
                  MISP服务器地址
                </Space>
              }
              name={['misp', 'url']}
              rules={[
                { required: true, message: '请输入MISP服务器地址' },
                { type: 'url', message: '请输入有效的URL地址' }
              ]}
            >
              <Input 
                placeholder="https://misp.example.com"
                prefix={<LinkOutlined />}
              />
            </Form.Item>
          </Col>
          
          <Col span={12}>
            <Form.Item
              label={
                <Space>
                  <KeyOutlined />
                  API密钥
                </Space>
              }
              name={['misp', 'apiKey']}
              rules={[{ required: true, message: '请输入MISP API密钥' }]}
            >
              <Input.Password 
                placeholder="MISP API密钥"
                prefix={<KeyOutlined />}
              />
            </Form.Item>
          </Col>
        </Row>

        <Alert
          message="MISP配置说明"
          description={
            <div>
              <Paragraph style={{ marginBottom: 8 }}>
                MISP (Malware Information Sharing Platform) 是一个开源的威胁情报共享平台。
              </Paragraph>
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                <li>您可以使用公共MISP服务器或搭建私有服务器</li>
                <li>API密钥需要在MISP服务器中生成</li>
                <li>建议使用HTTPS协议确保数据传输安全</li>
              </ul>
            </div>
          }
          type="info"
          showIcon={false}
          style={{ marginTop: 16 }}
        />
      </Card>

      {/* OTX配置 */}
      <Card
        title={
          <Space>
            <SecurityScanOutlined />
            OTX威胁情报配置
          </Space>
        }
        extra={
          <Space>
            {getStatusTag(config.otx.status)}
            <Button
              size="small"
              icon={<ReloadOutlined />}
              loading={testing === 'otx'}
              onClick={() => testConnection('otx')}
            >
              测试连接
            </Button>
          </Space>
        }
        style={{ marginBottom: 24 }}
      >
        <Row gutter={[24, 16]}>
          <Col span={24}>
            <Form.Item
              label="启用OTX威胁情报"
              name={['otx', 'enabled']}
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          </Col>
          
          <Col span={12}>
            <Form.Item
              label={
                <Space>
                  <KeyOutlined />
                  API密钥
                </Space>
              }
              name={['otx', 'apiKey']}
              rules={[{ required: true, message: '请输入OTX API密钥' }]}
            >
              <Input.Password 
                placeholder="OTX API密钥"
                prefix={<KeyOutlined />}
              />
            </Form.Item>
          </Col>
        </Row>

        <Alert
          message="OTX配置说明"
          description={
            <div>
              <Paragraph style={{ marginBottom: 8 }}>
                OTX (AlienVault Open Threat Exchange) 是AlienVault提供的威胁情报共享平台。
              </Paragraph>
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                <li>需要在 <a href="https://otx.alienvault.com/" target="_blank" rel="noopener noreferrer">OTX官网</a> 注册账户</li>
                <li>注册后可在个人设置中生成API密钥</li>
                <li>免费账户有API调用频率限制</li>
              </ul>
            </div>
          }
          type="info"
          showIcon={false}
          style={{ marginTop: 16 }}
        />
      </Card>

      {/* 操作按钮 */}
      <Card>
        <Row justify="end">
          <Space>
            <Button onClick={loadConfig}>
              重置
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={saving}
              icon={<SecurityScanOutlined />}
            >
              保存配置
            </Button>
          </Space>
        </Row>
      </Card>
    </Form>
  );
};

export default ThreatIntelligenceConfig;
