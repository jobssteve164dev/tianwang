import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Progress,
  Space,
  Typography,
  Select,
  Button,
  Alert,
  Spin,
  Empty,
} from 'antd';
import {
  LineChartOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { localAIModelApi } from '../../services/api';

const { Title, Text } = Typography;
const { Option } = Select;

interface ModelPerformanceMonitorProps {
  performanceData: any;
  onRefresh: () => void;
}

const ModelPerformanceMonitor: React.FC<ModelPerformanceMonitorProps> = ({
  performanceData,
  onRefresh
}) => {
  const [selectedModel, setSelectedModel] = useState<string>('all');
  const [historyData, setHistoryData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // 加载历史数据
  const loadHistoryData = async () => {
    try {
      setLoading(true);
      const response = await localAIModelApi.getPerformanceHistory({
        model_name: selectedModel === 'all' ? undefined : selectedModel,
        days: 7
      });
      if (response.success) {
        setHistoryData(response.history_data);
      }
    } catch (error) {
      console.error('加载历史数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistoryData();
  }, [selectedModel]);

  // 模型配置
  const modelConfigs = {
    anomaly_detection: {
      name: '异常检测模型',
      color: '#1890ff'
    },
    malware_detection: {
      name: '恶意软件检测模型',
      color: '#52c41a'
    },
    network_intrusion: {
      name: '网络入侵检测模型',
      color: '#fa8c16'
    },
    user_behavior: {
      name: '用户行为分析模型',
      color: '#722ed1'
    }
  };

  // 获取性能等级
  const getPerformanceLevel = (accuracy: number) => {
    if (accuracy >= 0.9) return { level: '优秀', color: '#52c41a' };
    if (accuracy >= 0.8) return { level: '良好', color: '#fa8c16' };
    if (accuracy >= 0.7) return { level: '一般', color: '#faad14' };
    return { level: '较差', color: '#f5222d' };
  };

  if (!performanceData) {
    return (
      <Empty
        description="暂无性能数据"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  }

  return (
    <div className="model-performance-monitor">
      {/* 控制栏 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space>
          <Text strong>选择模型：</Text>
          <Select
            value={selectedModel}
            onChange={setSelectedModel}
            style={{ width: 200 }}
          >
            <Option value="all">所有模型</Option>
            {Object.entries(modelConfigs).map(([key, config]) => (
              <Option key={key} value={key}>
                {config.name}
              </Option>
            ))}
          </Select>
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            onClick={onRefresh}
            loading={loading}
          >
            刷新数据
          </Button>
        </Space>
      </Card>

      {/* 性能概览 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {Object.entries(performanceData).map(([modelKey, modelData]: [string, any]) => {
          if (selectedModel !== 'all' && selectedModel !== modelKey) return null;
          
          const config = modelConfigs[modelKey as keyof typeof modelConfigs];
          if (!config) return null;

          const accuracy = modelData.accuracy || 0;
          const performanceLevel = getPerformanceLevel(accuracy);

          return (
            <Col xs={24} sm={12} lg={6} key={modelKey}>
              <Card
                size="small"
                style={{ 
                  borderLeft: `4px solid ${config.color}`,
                  height: '100%'
                }}
              >
                <div style={{ marginBottom: 12 }}>
                  <Title level={5} style={{ margin: 0, color: config.color }}>
                    {config.name}
                  </Title>
                </div>

                <Statistic
                  title="准确率"
                  value={accuracy * 100}
                  suffix="%"
                  valueStyle={{ 
                    color: performanceLevel.color,
                    fontSize: '24px'
                  }}
                />

                <Progress
                  percent={accuracy * 100}
                  strokeColor={performanceLevel.color}
                  showInfo={false}
                  size="small"
                  style={{ marginBottom: 8 }}
                />

                <div style={{ fontSize: '12px', color: '#666' }}>
                  <div>精确率: {(modelData.precision * 100).toFixed(1)}%</div>
                  <div>召回率: {(modelData.recall * 100).toFixed(1)}%</div>
                  <div>F1分数: {(modelData.f1_score * 100).toFixed(1)}%</div>
                  <div>推理时间: {modelData.inference_time}ms</div>
                  <div>吞吐量: {modelData.throughput}/s</div>
                </div>

                <div style={{ marginTop: 8 }}>
                  <Text type="secondary" style={{ fontSize: '11px' }}>
                    性能等级: {performanceLevel.level}
                  </Text>
                </div>
              </Card>
            </Col>
          );
        })}
      </Row>

      {/* 系统性能概览 */}
      <Card title="系统性能概览" size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={6}>
            <Statistic
              title="平均准确率"
              value={
                Object.values(performanceData).reduce((sum: number, model: any) => 
                  sum + (model.accuracy || 0), 0
                ) / Object.keys(performanceData).length * 100
              }
              suffix="%"
              precision={1}
              valueStyle={{ color: '#1890ff' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="平均推理时间"
              value={
                Object.values(performanceData).reduce((sum: number, model: any) => 
                  sum + (model.inference_time || 0), 0
                ) / Object.keys(performanceData).length
              }
              suffix="ms"
              precision={2}
              valueStyle={{ color: '#52c41a' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="总吞吐量"
              value={
                Object.values(performanceData).reduce((sum: number, model: any) => 
                  sum + (model.throughput || 0), 0
                )
              }
              suffix="/s"
              valueStyle={{ color: '#fa8c16' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="平均错误率"
              value={
                Object.values(performanceData).reduce((sum: number, model: any) => 
                  sum + (model.error_rate || 0), 0
                ) / Object.keys(performanceData).length * 100
              }
              suffix="%"
              precision={2}
              valueStyle={{ color: '#f5222d' }}
            />
          </Col>
        </Row>
      </Card>

      {/* 性能趋势 */}
      <Card title="性能趋势" size="small">
        <Spin spinning={loading}>
          {historyData ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <LineChartOutlined style={{ fontSize: '48px', color: '#ccc' }} />
              <div style={{ marginTop: 8, color: '#999' }}>
                性能趋势图表开发中
              </div>
              <div style={{ fontSize: '12px', color: '#ccc', marginTop: 4 }}>
                将显示准确率、推理时间等指标的历史变化趋势
              </div>
            </div>
          ) : (
            <Empty
              description="暂无历史数据"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          )}
        </Spin>
      </Card>

      {/* 性能建议 */}
      <Card title="性能建议" size="small" style={{ marginTop: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          {Object.entries(performanceData).map(([modelKey, modelData]: [string, any]) => {
            const accuracy = modelData.accuracy || 0;
            const config = modelConfigs[modelKey as keyof typeof modelConfigs];
            
            if (!config) return null;
            if (selectedModel !== 'all' && selectedModel !== modelKey) return null;

            let suggestion = '';
            let type: 'success' | 'warning' | 'error' = 'success';

            if (accuracy < 0.7) {
              suggestion = `${config.name}准确率较低，建议重新训练或增加训练数据`;
              type = 'error';
            } else if (accuracy < 0.8) {
              suggestion = `${config.name}准确率一般，建议优化特征工程或调整模型参数`;
              type = 'warning';
            } else if (accuracy < 0.9) {
              suggestion = `${config.name}准确率良好，可以进一步优化提升性能`;
              type = 'warning';
            } else {
              suggestion = `${config.name}准确率优秀，性能表现良好`;
              type = 'success';
            }

            return (
              <Alert
                key={modelKey}
                message={config.name}
                description={suggestion}
                type={type}
                showIcon
                icon={type === 'success' ? <CheckCircleOutlined /> : <ExclamationCircleOutlined />}
              />
            );
          })}
        </Space>
      </Card>
    </div>
  );
};

export default ModelPerformanceMonitor;
