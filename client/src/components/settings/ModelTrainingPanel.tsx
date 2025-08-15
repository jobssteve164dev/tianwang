import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Form,
  Select,
  Button,
  Upload,
  Progress,
  Alert,
  Space,
  Typography,
  Divider,
  List,
  Tag,
  Modal,
  message,
  App,
  Spin,
} from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  StopOutlined,
  UploadOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  RobotOutlined,
  BugOutlined,
  SafetyOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { localAIModelApi } from '../../services/api';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

interface ModelTrainingPanelProps {
  modelStatus: any;
  onTrainingComplete: () => void;
}

interface TrainingTask {
  task_id: string;
  model_name: string;
  status: 'running' | 'completed' | 'failed' | 'paused';
  progress: number;
  start_time: string;
  estimated_completion?: string;
  training_samples: number;
  current_accuracy: number;
  current_loss: number;
}

const ModelTrainingPanel: React.FC<ModelTrainingPanelProps> = ({
  modelStatus,
  onTrainingComplete
}) => {
  const { message: messageApi } = App.useApp();
  const [form] = Form.useForm();
  const [trainingTasks, setTrainingTasks] = useState<TrainingTask[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [trainingData, setTrainingData] = useState<any[]>([]);
  const [isTraining, setIsTraining] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showTrainingModal, setShowTrainingModal] = useState(false);

  // 模型配置
  const modelConfigs = {
    anomaly_detection: {
      name: '异常检测模型',
      icon: <BugOutlined />,
      description: '检测系统异常行为和模式',
      dataFormat: 'JSON格式的系统监控数据'
    },
    malware_detection: {
      name: '恶意软件检测模型',
      icon: <SafetyOutlined />,
      description: '识别恶意软件和病毒',
      dataFormat: 'JSON格式的文件特征数据'
    },
    network_intrusion: {
      name: '网络入侵检测模型',
      icon: <SafetyOutlined />,
      description: '检测网络入侵和攻击',
      dataFormat: 'JSON格式的网络流量数据'
    },
    user_behavior: {
      name: '用户行为分析模型',
      icon: <UserOutlined />,
      description: '分析用户行为模式和异常',
      dataFormat: 'JSON格式的用户行为数据'
    }
  };

  // 开始训练
  const handleStartTraining = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const response = await localAIModelApi.trainModel({
        model_name: values.model_name,
        training_data: trainingData
      });

      if (response.success) {
        messageApi.success(`模型 ${values.model_name} 训练已开始`);
        
        // 添加训练任务到列表
        const newTask: TrainingTask = {
          task_id: response.task_id,
          model_name: values.model_name,
          status: 'running',
          progress: 0,
          start_time: new Date().toISOString(),
          training_samples: response.training_samples,
          current_accuracy: 0,
          current_loss: 1.0
        };
        
        setTrainingTasks(prev => [...prev, newTask]);
        setShowTrainingModal(false);
        form.resetFields();
        setTrainingData([]);
        
        // 开始轮询训练状态
        pollTrainingStatus(response.task_id);
      } else {
        messageApi.error(response.message || '训练启动失败');
      }
    } catch (error) {
      console.error('训练启动失败:', error);
      messageApi.error('训练启动失败');
    } finally {
      setLoading(false);
    }
  };

  // 轮询训练状态
  const pollTrainingStatus = async (taskId: string) => {
    const poll = async () => {
      try {
        const response = await localAIModelApi.getTrainingStatus(taskId);
        if (response.success) {
          const status = response.training_status;
          
          setTrainingTasks(prev => prev.map(task => 
            task.task_id === taskId 
              ? { ...task, ...status }
              : task
          ));

          // 如果训练完成，停止轮询
          if (status.status === 'completed' || status.status === 'failed') {
            if (status.status === 'completed') {
              messageApi.success(`模型训练完成！`);
              onTrainingComplete();
            } else {
              messageApi.error(`模型训练失败`);
            }
            return;
          }

          // 继续轮询
          setTimeout(poll, 2000);
        }
      } catch (error) {
        console.error('获取训练状态失败:', error);
      }
    };

    poll();
  };

  // 暂停训练
  const handlePauseTraining = (taskId: string) => {
    setTrainingTasks(prev => prev.map(task => 
      task.task_id === taskId 
        ? { ...task, status: 'paused' as const }
        : task
    ));
    messageApi.info('训练已暂停');
  };

  // 停止训练
  const handleStopTraining = (taskId: string) => {
    setTrainingTasks(prev => prev.map(task => 
      task.task_id === taskId 
        ? { ...task, status: 'failed' as const }
        : task
    ));
    messageApi.info('训练已停止');
  };

  // 获取状态标签
  const getStatusTag = (status: string) => {
    switch (status) {
      case 'running':
        return <Tag color="processing" icon={<ClockCircleOutlined />}>训练中</Tag>;
      case 'completed':
        return <Tag color="success" icon={<CheckCircleOutlined />}>已完成</Tag>;
      case 'failed':
        return <Tag color="error" icon={<CloseCircleOutlined />}>失败</Tag>;
      case 'paused':
        return <Tag color="warning" icon={<PauseCircleOutlined />}>已暂停</Tag>;
      default:
        return <Tag color="default">未知</Tag>;
    }
  };

  // 文件上传处理
  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (Array.isArray(data)) {
          setTrainingData(data);
          messageApi.success(`成功加载 ${data.length} 条训练数据`);
        } else {
          messageApi.error('文件格式错误，请上传JSON数组格式的数据');
        }
      } catch (error) {
        messageApi.error('文件解析失败，请检查JSON格式');
      }
    };
    reader.readAsText(file);
    return false; // 阻止自动上传
  };

  return (
    <div className="model-training-panel">
      <Row gutter={[16, 16]}>
        {/* 训练配置 */}
        <Col span={12}>
          <Card title="训练配置" size="small">
            <Form form={form} layout="vertical">
              <Form.Item
                label="选择模型"
                name="model_name"
                rules={[{ required: true, message: '请选择要训练的模型' }]}
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

              <Form.Item label="训练数据">
                <Upload
                  beforeUpload={handleFileUpload}
                  accept=".json"
                  showUploadList={false}
                >
                  <Button icon={<UploadOutlined />}>
                    上传训练数据
                  </Button>
                </Upload>
                {trainingData.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <Text type="secondary">
                      已加载 {trainingData.length} 条数据
                    </Text>
                  </div>
                )}
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={() => setShowTrainingModal(true)}
                  disabled={!selectedModel || trainingData.length === 0}
                  loading={loading}
                  block
                >
                  开始训练
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        {/* 训练任务列表 */}
        <Col span={12}>
          <Card title="训练任务" size="small">
            {trainingTasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <RobotOutlined style={{ fontSize: '48px', color: '#ccc' }} />
                <div style={{ marginTop: 8, color: '#999' }}>
                  暂无训练任务
                </div>
              </div>
            ) : (
              <List
                dataSource={trainingTasks}
                renderItem={(task) => (
                  <List.Item
                    actions={[
                      task.status === 'running' && (
                        <Button
                          size="small"
                          icon={<PauseCircleOutlined />}
                          onClick={() => handlePauseTraining(task.task_id)}
                        >
                          暂停
                        </Button>
                      ),
                      task.status === 'running' && (
                        <Button
                          size="small"
                          danger
                          icon={<StopOutlined />}
                          onClick={() => handleStopTraining(task.task_id)}
                        >
                          停止
                        </Button>
                      )
                    ].filter(Boolean)}
                  >
                    <List.Item.Meta
                      title={
                        <Space>
                          {modelConfigs[task.model_name as keyof typeof modelConfigs]?.icon}
                          {modelConfigs[task.model_name as keyof typeof modelConfigs]?.name}
                          {getStatusTag(task.status)}
                        </Space>
                      }
                      description={
                        <div>
                          <div>开始时间: {new Date(task.start_time).toLocaleString()}</div>
                          <div>训练样本: {task.training_samples}</div>
                          {task.status === 'running' && (
                            <div>
                              <div>当前准确率: {(task.current_accuracy * 100).toFixed(1)}%</div>
                              <div>当前损失: {task.current_loss.toFixed(4)}</div>
                            </div>
                          )}
                        </div>
                      }
                    />
                    {task.status === 'running' && (
                      <Progress
                        percent={task.progress}
                        size="small"
                        style={{ width: 100 }}
                      />
                    )}
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* 数据格式说明 */}
      <Card title="数据格式说明" style={{ marginTop: 16 }} size="small">
        <Row gutter={16}>
          {Object.entries(modelConfigs).map(([key, config]) => (
            <Col span={12} key={key}>
              <Alert
                message={config.name}
                description={config.dataFormat}
                type="info"
                showIcon
                style={{ marginBottom: 8 }}
              />
            </Col>
          ))}
        </Row>
      </Card>

      {/* 训练确认模态框 */}
      <Modal
        title="确认开始训练"
        open={showTrainingModal}
        onOk={handleStartTraining}
        onCancel={() => setShowTrainingModal(false)}
        confirmLoading={loading}
      >
        <div>
          <p>您即将开始训练以下模型：</p>
          <Alert
            message={modelConfigs[selectedModel as keyof typeof modelConfigs]?.name}
            description={`使用 ${trainingData.length} 条训练数据`}
            type="info"
            showIcon
          />
          <p style={{ marginTop: 16 }}>
            <Text type="secondary">
              训练过程可能需要较长时间，请耐心等待。训练完成后系统会自动通知您。
            </Text>
          </p>
        </div>
      </Modal>
    </div>
  );
};

export default ModelTrainingPanel;
