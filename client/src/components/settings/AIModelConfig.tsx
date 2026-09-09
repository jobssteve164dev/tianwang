import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Switch,
  Space,
  Divider,
  Spin,
  Typography,
  Tooltip,
  Collapse,
  App,
} from 'antd';
import {
  SettingOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { aiModelApi } from '../../services/api';

const { Text } = Typography;
const { Password } = Input;

interface AIModelConfigData {
  [key: string]: {
    enabled: boolean;
    api_key: string;
    default_model: string;
    has_api_key?: boolean;
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
  const providers: Record<string, { name: string; description: string }> = {
    openai: { name: 'OpenAI', description: '使用你的 OpenAI 账户进行告警分析' },
    claude: { name: 'Claude', description: '使用你的 Anthropic 账户进行告警分析' },
    openrouter: { name: 'OpenRouter', description: '使用你的 OpenRouter 账户选择模型' },
    deepseek: { name: 'DeepSeek', description: '使用你的 DeepSeek 账户进行告警分析' }
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
        await loadConfig();
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
      
      if (!providerConfig?.api_key && !config?.[provider]?.has_api_key) {
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
    <div>
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSave}
        initialValues={config || {}}
      >
        <div style={{ marginBottom: '24px' }}>
          <Text type="secondary">
            配置外部AI模型的API密钥和参数，用于威胁检测和智能分析
          </Text>
        </div>

        <Collapse 
          items={Object.entries(providers).map(([key, provider]) => ({
            key,
            label: (
              <Space>
                <span>{provider.name}</span>
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
                      required: form.getFieldValue([key, 'enabled']) && !config?.[key]?.has_api_key,
                      message: '请输入API密钥'
                    }
                  ]}
                >
                  <Password autoComplete="new-password" placeholder={config?.[key]?.has_api_key ? '已保存，留空保持现有密钥' : '请输入API密钥'} />
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
                  <Input placeholder="输入模型名称" />
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
    </div>
  );
};

export default AIModelConfig;
