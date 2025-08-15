import React, { useState } from 'react';
import {
  Card,
  Row,
  Col,
  Form,
  Select,
  Button,
  Upload,
  Input,
  Space,
  Typography,
  Alert,
  message,
  App,
  Spin,
  Empty,
  Tag,
} from 'antd';
import {
  ExperimentOutlined,
  UploadOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  BugOutlined,
  SafetyOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { localAIModelApi } from '../../services/api';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

interface ModelTestingToolProps {
  modelStatus: any;
}

const ModelTestingTool: React.FC<ModelTestingToolProps> = ({
  modelStatus
}) => {
  const { message: messageApi } = App.useApp();
  const [form] = Form.useForm();
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [testData, setTestData] = useState<any>(null);
  const [testing, setTesting] = useState(false);

  // 模型配置
  const modelConfigs = {
    anomaly_detection: {
      name: '异常检测模型',
      icon: <BugOutlined />,
      description: '检测系统异常行为和模式'
    },
    malware_detection: {
      name: '恶意软件检测模型',
      icon: <SafetyOutlined />,
      description: '识别恶意软件和病毒'
    },
    network_intrusion: {
      name: '网络入侵检测模型',
      icon: <SafetyOutlined />,
      description: '检测网络入侵和攻击'
    },
    user_behavior: {
      name: '用户行为分析模型',
      icon: <UserOutlined />,
      description: '分析用户行为模式和异常'
    }
  };

  // 开始测试
  const handleStartTest = async () => {
    try {
      const values = await form.validateFields();
      setTesting(true);

      const response = await localAIModelApi.testModel({
        model_name: values.model_name,
        test_data: testData
      });

      if (response.success) {
        messageApi.success('模型测试完成');
      } else {
        messageApi.error(response.message || '测试失败');
      }
    } catch (error) {
      console.error('测试失败:', error);
      messageApi.error('测试失败');
    } finally {
      setTesting(false);
    }
  };

  // 文件上传处理
  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        setTestData(data);
        messageApi.success('测试数据加载成功');
      } catch (error) {
        messageApi.error('文件解析失败，请检查JSON格式');
      }
    };
    reader.readAsText(file);
    return false;
  };

  return (
    <div className="model-testing-tool">
      <Row gutter={[16, 16]}>
        {/* 测试配置 */}
        <Col span={12}>
          <Card title="测试配置" size="small">
            <Form form={form} layout="vertical">
              <Form.Item
                label="选择模型"
                name="model_name"
                rules={[{ required: true, message: '请选择要测试的模型' }]}
              >
                <Select
                  placeholder="选择模型"
                  onChange={setSelectedModel}
                  showSearch
                >
                  {Object.entries(modelConfigs).map(([key, config]) => (
                    <Option key={key} value={key}>
                      <Space>
                        {config.icon}
                        {config.name}
                      </Space>
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              {selectedModel && (
                <Alert
                  message={modelConfigs[selectedModel as keyof typeof modelConfigs]?.name}
                  description={modelConfigs[selectedModel as keyof typeof modelConfigs]?.description}
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
              )}

              <Form.Item label="测试数据">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Upload
                    beforeUpload={handleFileUpload}
                    accept=".json"
                    showUploadList={false}
                  >
                    <Button icon={<UploadOutlined />}>
                      上传JSON文件
                    </Button>
                  </Upload>
                  
                  <TextArea
                    placeholder="或直接输入JSON数据"
                    rows={6}
                    onChange={(e) => {
                      try {
                        const data = JSON.parse(e.target.value);
                        setTestData(data);
                      } catch (error) {
                        // 忽略解析错误
                      }
                    }}
                  />
                  
                  {testData && (
                    <Alert
                      message="测试数据已加载"
                      description={`数据格式: ${typeof testData}`}
                      type="success"
                      showIcon
                    />
                  )}
                </Space>
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={handleStartTest}
                  disabled={!selectedModel || !testData}
                  loading={testing}
                  block
                >
                  开始测试
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        {/* 测试结果 */}
        <Col span={12}>
          <Card title="测试结果" size="small">
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <ExperimentOutlined style={{ fontSize: '48px', color: '#ccc' }} />
              <div style={{ marginTop: 8, color: '#999' }}>
                暂无测试结果
              </div>
              <div style={{ fontSize: '12px', color: '#ccc', marginTop: 4 }}>
                开始测试后将显示推理结果和性能指标
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 使用说明 */}
      <Card title="使用说明" size="small" style={{ marginTop: 16 }}>
        <Alert
          message="模型测试工具"
          description="上传测试数据，验证模型推理能力和准确性。支持JSON格式的数据文件或直接输入数据。"
          type="info"
          showIcon
        />
      </Card>
    </div>
  );
};

export default ModelTestingTool;
