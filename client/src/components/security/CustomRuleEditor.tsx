import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  Button,
  Space,
  Card,
  Divider,
  Alert,
  message,
  Tabs,
  Switch,
  Row,
  Col,
  Popconfirm
} from 'antd';
import {
  DeleteOutlined,
  SaveOutlined,
  PlayCircleOutlined,
  CodeOutlined,
  EyeOutlined
} from '@ant-design/icons';
import { securityRulesApi } from '../../services/api';

const { TextArea } = Input;
const { Option } = Select;
// const { Title, Text, Paragraph } = Typography;
// const { TabPane } = Tabs;

interface CustomRuleEditorProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  ruleId?: string;
  mode: 'create' | 'edit';
}

interface RuleData {
  title: string;
  description: string;
  author: string;
  level: 'low' | 'medium' | 'high' | 'critical';
  status: 'experimental' | 'test' | 'stable';
  logsource: {
    product?: string;
    service?: string;
    category?: string;
  };
  detection: {
    selection?: Record<string, any>;
    condition?: string;
  };
  tags: string[];
  enabled: boolean;
}

const CustomRuleEditor: React.FC<CustomRuleEditorProps> = ({
  visible,
  onCancel,
  onSuccess,
  ruleId,
  mode
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [ruleData, setRuleData] = useState<RuleData>({
    title: '',
    description: '',
    author: '',
    level: 'medium',
    status: 'experimental',
    logsource: { product: 'windows' },
    detection: { selection: {}, condition: 'selection' },
    tags: [],
    enabled: true
  });
  const [yamlPreview, setYamlPreview] = useState('');
  const [testData, setTestData] = useState('');
  const [testResult, setTestResult] = useState<any>(null);

  // 加载规则数据（编辑模式）
  useEffect(() => {
    if (visible && mode === 'edit' && ruleId) {
      loadRuleData();
    }
  }, [visible, mode, ruleId]);

  // 生成YAML预览
  useEffect(() => {
    generateYamlPreview();
  }, [ruleData]);

  const loadRuleData = async () => {
    try {
      setLoading(true);
      const response = await securityRulesApi.getCustomRule(ruleId!);
      if (response.success) {
        const data = response.data;
        setRuleData({
          title: data.title || '',
          description: data.description || '',
          author: data.author || '',
          level: data.level || 'medium',
          status: data.status || 'experimental',
          logsource: data.logsource || { product: 'windows' },
          detection: data.detection || { selection: {}, condition: 'selection' },
          tags: data.tags || [],
          enabled: data.enabled !== false
        });
        form.setFieldsValue({
          title: data.title,
          description: data.description,
          author: data.author,
          level: data.level,
          status: data.status,
          logsource: data.logsource,
          detection: data.detection,
          tags: data.tags,
          enabled: data.enabled !== false
        });
      }
    } catch (error) {
      message.error('加载规则数据失败');
    } finally {
      setLoading(false);
    }
  };

  const generateYamlPreview = () => {
    try {
      const yamlContent = {
        title: ruleData.title,
        description: ruleData.description,
        author: ruleData.author,
        date: new Date().toISOString().split('T')[0],
        level: ruleData.level,
        status: ruleData.status,
        logsource: ruleData.logsource,
        detection: ruleData.detection,
        tags: ruleData.tags,
        enabled: ruleData.enabled
      };
      
      // 简单的YAML格式化（实际项目中可以使用js-yaml库）
      const yaml = `title: ${yamlContent.title}
description: ${yamlContent.description}
author: ${yamlContent.author}
date: ${yamlContent.date}
level: ${yamlContent.level}
status: ${yamlContent.status}
logsource:
  product: ${yamlContent.logsource.product || 'windows'}
  ${yamlContent.logsource.service ? `service: ${yamlContent.logsource.service}` : ''}
  ${yamlContent.logsource.category ? `category: ${yamlContent.logsource.category}` : ''}
detection:
  selection:
    ${Object.entries(yamlContent.detection.selection || {}).map(([key, value]) => `${key}: ${value}`).join('\n    ')}
  condition: ${yamlContent.detection.condition || 'selection'}
tags:
${yamlContent.tags.map(tag => `  - ${tag}`).join('\n')}
enabled: ${yamlContent.enabled}`;
      
      setYamlPreview(yaml);
    } catch (error) {
      setYamlPreview('YAML生成失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const rulePayload = {
        ...values,
        detection: {
          selection: values.detection?.selection || {},
          condition: values.detection?.condition || 'selection'
        }
      };

      let response;
      if (mode === 'create') {
        response = await securityRulesApi.createCustomRule(rulePayload);
      } else {
        response = await securityRulesApi.updateCustomRule(ruleId!, rulePayload);
      }

      if (response.success) {
        message.success(`${mode === 'create' ? '创建' : '更新'}规则成功`);
        onSuccess();
        onCancel();
      } else {
        message.error(response.message || `${mode === 'create' ? '创建' : '更新'}规则失败`);
      }
    } catch (error) {
      console.error('提交规则失败:', error);
      message.error(`${mode === 'create' ? '创建' : '更新'}规则失败`);
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    try {
      setTesting(true);
      let testDataObj = {};
      
      try {
        testDataObj = JSON.parse(testData || '{}');
      } catch (error) {
        message.error('测试数据格式错误，请使用有效的JSON格式');
        return;
      }

      const response = await securityRulesApi.testCustomRule(ruleId!, { test_data: testDataObj });
      
      if (response.success) {
        setTestResult(response.data);
        message.success('规则测试完成');
      } else {
        message.error(response.message || '规则测试失败');
      }
    } catch (error) {
      console.error('规则测试失败:', error);
      message.error('规则测试失败');
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = async () => {
    try {
      setLoading(true);
      const response = await securityRulesApi.deleteCustomRule(ruleId!);
      
      if (response.success) {
        message.success('删除规则成功');
        onSuccess();
        onCancel();
      } else {
        message.error(response.message || '删除规则失败');
      }
    } catch (error) {
      console.error('删除规则失败:', error);
      message.error('删除规则失败');
    } finally {
      setLoading(false);
    }
  };

  const logsourceOptions = [
    { value: 'windows', label: 'Windows' },
    { value: 'linux', label: 'Linux' },
    { value: 'macos', label: 'macOS' },
    { value: 'network', label: 'Network' },
    { value: 'cloud', label: 'Cloud' }
  ];

  const serviceOptions = [
    { value: 'security', label: 'Security' },
    { value: 'system', label: 'System' },
    { value: 'application', label: 'Application' },
    { value: 'database', label: 'Database' },
    { value: 'web', label: 'Web' }
  ];

  return (
    <Modal
      title={
        <Space>
          <CodeOutlined />
          {mode === 'create' ? '创建自定义规则' : '编辑自定义规则'}
        </Space>
      }
      open={visible}
      onCancel={onCancel}
      width={1200}
      footer={null}
      destroyOnHidden
    >
      <Tabs 
        defaultActiveKey="basic" 
        size="large"
        items={[
          {
            key: 'basic',
            label: '基本信息',
            children: (
              <Form
                form={form}
                layout="vertical"
                initialValues={ruleData}
                onValuesChange={(_, allValues) => setRuleData(allValues)}
              >
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name="title"
                      label="规则标题"
                      rules={[{ required: true, message: '请输入规则标题' }]}
                    >
                      <Input placeholder="例如：检测可疑的PowerShell执行" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name="author"
                      label="作者"
                      rules={[{ required: true, message: '请输入作者' }]}
                    >
                      <Input placeholder="规则作者" />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item
                  name="description"
                  label="规则描述"
                >
                  <TextArea
                    rows={3}
                    placeholder="详细描述规则的用途和检测目标"
                  />
                </Form.Item>

                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item
                      name="level"
                      label="严重级别"
                      rules={[{ required: true, message: '请选择严重级别' }]}
                    >
                      <Select>
                        <Option value="low">低</Option>
                        <Option value="medium">中</Option>
                        <Option value="high">高</Option>
                        <Option value="critical">严重</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      name="status"
                      label="规则状态"
                      rules={[{ required: true, message: '请选择规则状态' }]}
                    >
                      <Select>
                        <Option value="experimental">实验性</Option>
                        <Option value="test">测试</Option>
                        <Option value="stable">稳定</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      name="enabled"
                      label="启用状态"
                      valuePropName="checked"
                    >
                      <Switch />
                    </Form.Item>
                  </Col>
                </Row>
              </Form>
            )
          },
          {
            key: 'logsource',
            label: '日志源配置',
            children: (
              <Form
                form={form}
                layout="vertical"
                initialValues={ruleData}
                onValuesChange={(_, allValues) => setRuleData(allValues)}
              >
                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item
                      name={['logsource', 'product']}
                      label="产品类型"
                      rules={[{ required: true, message: '请选择产品类型' }]}
                    >
                      <Select placeholder="选择产品类型">
                        {logsourceOptions.map(option => (
                          <Option key={option.value} value={option.value}>
                            {option.label}
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      name={['logsource', 'service']}
                      label="服务类型"
                    >
                      <Select placeholder="选择服务类型" allowClear>
                        {serviceOptions.map(option => (
                          <Option key={option.value} value={option.value}>
                            {option.label}
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      name={['logsource', 'category']}
                      label="分类"
                    >
                      <Input placeholder="例如：process_creation" />
                    </Form.Item>
                  </Col>
                </Row>

                <Alert
                  message="日志源配置说明"
                  description="日志源配置定义了规则适用的日志类型。product指定操作系统或产品，service指定具体的服务，category指定日志分类。"
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
              </Form>
            )
          },
          {
            key: 'detection',
            label: '检测逻辑',
            children: (
              <Form
                form={form}
                layout="vertical"
                initialValues={ruleData}
                onValuesChange={(_, allValues) => setRuleData(allValues)}
              >
                <Form.Item
                  name={['detection', 'selection']}
                  label="选择条件"
                >
                  <TextArea
                    rows={6}
                    placeholder={`例如：
Image: "powershell.exe"
CommandLine: 
  - "*bypass*"
  - "*executionpolicy*"
ParentImage: "cmd.exe"`}
                  />
                </Form.Item>

                <Form.Item
                  name={['detection', 'condition']}
                  label="匹配条件"
                  rules={[{ required: true, message: '请输入匹配条件' }]}
                >
                  <Input placeholder="例如：selection" />
                </Form.Item>

                <Alert
                  message="检测逻辑说明"
                  description="selection定义要匹配的字段和值，condition定义匹配逻辑。常用的condition包括：selection（匹配所有selection条件）、1 of selection（匹配任意一个selection条件）、all of selection（匹配所有selection条件）。"
                  type="info"
                  showIcon
                />
              </Form>
            )
          },
          {
            key: 'tags',
            label: '标签管理',
            children: (
              <Form
                form={form}
                layout="vertical"
                initialValues={ruleData}
                onValuesChange={(_, allValues) => setRuleData(allValues)}
              >
                <Form.Item
                  name="tags"
                  label="规则标签"
                >
                  <Select
                    mode="tags"
                    placeholder="输入标签后按回车添加"
                    style={{ width: '100%' }}
                  />
                </Form.Item>

                <Alert
                  message="标签说明"
                  description="标签用于对规则进行分类和管理。建议使用有意义的标签，如攻击技术、威胁类型、适用环境等。"
                  type="info"
                  showIcon
                />
              </Form>
            )
          },
          {
            key: 'preview',
            label: 'YAML预览',
            children: (
              <Card title="规则YAML内容" extra={<EyeOutlined />}>
                <TextArea
                  value={yamlPreview}
                  rows={20}
                  readOnly
                  style={{ fontFamily: 'monospace' }}
                />
              </Card>
            )
          },
          ...(mode === 'edit' ? [{
            key: 'test',
            label: '规则测试',
            children: (
              <Card title="规则测试" extra={<PlayCircleOutlined />}>
                <Form layout="vertical">
                  <Form.Item label="测试数据 (JSON格式)">
                    <TextArea
                      value={testData}
                      onChange={(e) => setTestData(e.target.value)}
                      rows={8}
                      placeholder={`例如：
{
  "Image": "powershell.exe",
  "CommandLine": "powershell.exe -ExecutionPolicy Bypass -Command ...",
  "ParentImage": "cmd.exe"
}`}
                    />
                  </Form.Item>

                  <Space>
                    <Button
                      type="primary"
                      icon={<PlayCircleOutlined />}
                      onClick={handleTest}
                      loading={testing}
                    >
                      测试规则
                    </Button>
                  </Space>

                  {testResult && (
                    <div style={{ marginTop: 16 }}>
                      <Alert
                        message={`测试结果: ${testResult.matched ? '匹配' : '不匹配'}`}
                        type={testResult.matched ? 'success' : 'info'}
                        showIcon
                      />
                      <Card size="small" style={{ marginTop: 8 }}>
                        <pre>{JSON.stringify(testResult.test_result, null, 2)}</pre>
                      </Card>
                    </div>
                  )}
                </Form>
              </Card>
            )
          }] : [])
        ]}
      />

      <Divider />

      <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
        {mode === 'edit' && (
          <Popconfirm
            title="确定要删除这个规则吗？"
            onConfirm={handleDelete}
            okText="确定"
            cancelText="取消"
          >
            <Button danger icon={<DeleteOutlined />}>
              删除规则
            </Button>
          </Popconfirm>
        )}
        <Button onClick={onCancel}>
          取消
        </Button>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          onClick={handleSubmit}
          loading={loading}
        >
          {mode === 'create' ? '创建规则' : '保存修改'}
        </Button>
      </Space>
    </Modal>
  );
};

export default CustomRuleEditor;
