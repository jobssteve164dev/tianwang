import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Switch,
  Select,
  Space,
  Divider,
  Spin,
  Typography,
  Tag,
  Tooltip,
  Collapse,
  App,
} from 'antd';
import {
  RobotOutlined,
  SettingOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { aiModelApi } from '../../services/api';

const { Title, Text } = Typography;
const { Password } = Input;
const { Option } = Select;

interface AIModelConfigData {
  [key: string]: {
    enabled: boolean;
    api_key: string;
    default_model: string;
    models: string[];
  };
}

interface AIModelConfigProps {
  onConfigChange?: (config: AIModelConfigData) => void;
}

const AIModelConfig: React.FC<AIModelConfigProps> = ({ onConfigChange }) => {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [config, setConfig] = useState<AIModelConfigData | null>(null);
  const [form] = Form.useForm();

  // 提供商信息
  const providers: Record<string, {
    name: string;
    description: string;
    icon: string;
    color: string;
    pricing: string;
    models: string[];
  }> = {
    openai: {
      name: 'OpenAI',
      description: 'GPT系列模型，包括GPT-4、GPT-3.5等',
      icon: '🤖',
      color: 'blue',
      pricing: '按token计费，GPT-4较贵，GPT-3.5较便宜',
      models: ['gpt-4', 'gpt-3.5-turbo', 'gpt-4-turbo']
    },
    claude: {
      name: 'Claude',
      description: 'Anthropic的Claude系列模型',
      icon: '🧠',
      color: 'green',
      pricing: '按token计费，Claude-3-haiku性价比高',
      models: ['claude-3-haiku', 'claude-3-sonnet', 'claude-3-opus']
    },
    openrouter: {
      name: 'OpenRouter',
      description: '聚合多个AI提供商的服务',
      icon: '🌐',
      color: 'purple',
      pricing: '统一计费，支持多种模型',
      models: [
        'openai/gpt-4',
        'anthropic/claude-3-haiku',
        'google/gemini-pro',
        'meta-llama/llama-2-70b-chat',
        'mistralai/mixtral-8x7b-instruct'
      ]
    },
    deepseek: {
      name: 'DeepSeek',
      description: '专注于代码和技术的AI模型',
      icon: '💻',
      color: 'orange',
      pricing: '价格相对便宜，适合技术场景',
      models: ['deepseek-chat', 'deepseek-coder']
    }
  };

  // 加载配置
  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      const response = await aiModelApi.getConfig();
      if (response.success) {
        setConfig(response.config);
        // 设置表单初始值
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
  }, [form, message]);

  // 保存配置
  const handleSave = async (values: AIModelConfigData) => {
    try {
      setSaving(true);
      const response = await aiModelApi.updateConfig(values);
      if (response.success) {
        message.success('配置保存成功');
        setConfig(values);
        if (onConfigChange) {
          onConfigChange(values);
        }
      } else {
        message.error('保存配置失败');
      }
    } catch (error) {
      console.error('保存配置失败:', error);
      message.error('保存配置失败');
    } finally {
      setSaving(false);
    }
  };

  // 测试连接
  const handleTestConnection = async (provider: string) => {
    try {
      setTesting(provider);
      const values = form.getFieldsValue();
      const providerConfig = values[provider];
      
      if (!providerConfig?.api_key) {
        message.error('请先输入API密钥');
        return;
      }

      const response = await aiModelApi.testConnection({
        provider,
        api_key: providerConfig.api_key,
        model: providerConfig.default_model
      });

      if (response.success) {
        message.success(`${providers[provider].name} 连接测试成功`);
      } else {
        message.error(`${providers[provider].name} 连接测试失败: ${response.message}`);
      }
    } catch (error) {
      console.error('测试连接失败:', error);
      message.error('测试连接失败');
    } finally {
      setTesting(null);
    }
  };

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  if (loading) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Spin size="large" />
          <div style={{ marginTop: '16px' }}>加载配置中...</div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSave}
        initialValues={config || {}}
      >
        <div style={{ marginBottom: '24px' }}>
          <Title level={4}>
            <RobotOutlined style={{ marginRight: '8px' }} />
            AI模型配置
          </Title>
          <Text type="secondary">
            配置外部AI模型的API密钥和参数，用于威胁检测和智能分析
          </Text>
        </div>

        <Collapse 
          items={Object.entries(providers).map(([key, provider]) => ({
            key,
            label: (
              <Space>
                <span style={{ fontSize: '18px' }}>{provider.icon}</span>
                <span>{provider.name}</span>
                <Tag color={provider.color}>{provider.pricing}</Tag>
              </Space>
            ),
            children: (
              <>
                <Form.Item
                  name={[key, 'enabled']}
                  valuePropName="checked"
                  label="启用"
                >
                  <Switch />
                </Form.Item>

                <Form.Item
                  name={[key, 'api_key']}
                  label="API密钥"
                  rules={[
                    {
                      required: form.getFieldValue([key, 'enabled']),
                      message: '请输入API密钥'
                    }
                  ]}
                >
                  <Password placeholder="请输入API密钥" />
                </Form.Item>

                <Form.Item
                  name={[key, 'default_model']}
                  label="默认模型"
                  rules={[
                    {
                      required: form.getFieldValue([key, 'enabled']),
                      message: '请选择默认模型'
                    }
                  ]}
                >
                  <Select placeholder="选择默认模型">
                    {provider.models?.map((model: string) => (
                      <Option key={model} value={model}>
                        {model}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>

                <Space>
                  <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    loading={testing === key}
                    onClick={() => handleTestConnection(key)}
                    disabled={!form.getFieldValue([key, 'enabled'])}
                  >
                    测试连接
                  </Button>
                  <Tooltip title={provider.description}>
                    <InfoCircleOutlined style={{ color: '#1890ff' }} />
                  </Tooltip>
                </Space>
              </>
            )
          }))}
          style={{ marginBottom: '16px' }}
        />

        <Divider />

        <Form.Item>
          <Space>
            <Button
              type="primary"
              htmlType="submit"
              loading={saving}
              icon={<SettingOutlined />}
            >
              保存配置
            </Button>
            <Button
              onClick={() => form.resetFields()}
              icon={<CloseCircleOutlined />}
            >
              重置
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default AIModelConfig;
