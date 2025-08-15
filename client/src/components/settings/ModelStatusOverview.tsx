import React from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Progress,
  Tag,
  Space,
  Button,
  Tooltip,
  Typography,
  Empty,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
  RobotOutlined,
  BugOutlined,
  SafetyOutlined,
  UserOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

interface ModelStatusOverviewProps {
  modelStatus: any;
  onRefresh: () => void;
  loading: boolean;
}

const ModelStatusOverview: React.FC<ModelStatusOverviewProps> = ({
  modelStatus,
  onRefresh,
  loading
}) => {
  // 模型配置
  const modelConfigs = {
    anomaly_detection: {
      name: '异常检测模型',
      icon: <BugOutlined />,
      description: '检测系统异常行为和模式',
      color: '#1890ff'
    },
    malware_detection: {
      name: '恶意软件检测模型',
      icon: <SafetyOutlined />,
      description: '识别恶意软件和病毒',
      color: '#52c41a'
    },
    network_intrusion: {
      name: '网络入侵检测模型',
      icon: <SafetyOutlined />,
      description: '检测网络入侵和攻击',
      color: '#fa8c16'
    },
    user_behavior: {
      name: '用户行为分析模型',
      icon: <UserOutlined />,
      description: '分析用户行为模式和异常',
      color: '#722ed1'
    }
  };

  // 获取状态标签
  const getStatusTag = (status: string) => {
    switch (status) {
      case 'trained':
        return <Tag color="success" icon={<CheckCircleOutlined />}>已训练</Tag>;
      case 'untrained':
        return <Tag color="error" icon={<CloseCircleOutlined />}>未训练</Tag>;
      case 'training':
        return <Tag color="processing" icon={<ClockCircleOutlined />}>训练中</Tag>;
      default:
        return <Tag color="default">未知</Tag>;
    }
  };

  // 获取准确率颜色
  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 0.9) return '#52c41a';
    if (accuracy >= 0.8) return '#fa8c16';
    if (accuracy >= 0.7) return '#faad14';
    return '#f5222d';
  };

  if (!modelStatus) {
    return (
      <Empty
        description="暂无模型状态数据"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  }

  return (
    <div className="model-status-overview">
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Button 
            type="primary" 
            onClick={onRefresh}
            loading={loading}
            icon={<ReloadOutlined />}
          >
            刷新状态
          </Button>
          <Text type="secondary">
            最后更新: {new Date().toLocaleString()}
          </Text>
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        {Object.entries(modelStatus).map(([modelKey, modelData]: [string, any]) => {
          const config = modelConfigs[modelKey as keyof typeof modelConfigs];
          if (!config) return null;

          const accuracy = modelData.accuracy || 0;
          const performanceMetrics = modelData.performance_metrics || {};

          return (
            <Col xs={24} sm={12} lg={6} key={modelKey}>
              <Card
                hoverable
                style={{ 
                  height: '100%',
                  borderLeft: `4px solid ${config.color}`
                }}
                bodyStyle={{ padding: '16px' }}
              >
                <div style={{ marginBottom: 12 }}>
                  <Space align="center">
                    <span style={{ color: config.color, fontSize: '18px' }}>
                      {config.icon}
                    </span>
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                        {config.name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        {config.description}
                      </div>
                    </div>
                  </Space>
                </div>

                <div style={{ marginBottom: 12 }}>
                  {getStatusTag(modelData.status)}
                  <Tag color="blue">v{modelData.version || '1.0.0'}</Tag>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <Statistic
                    title="准确率"
                    value={accuracy * 100}
                    suffix="%"
                    valueStyle={{ 
                      color: getAccuracyColor(accuracy),
                      fontSize: '18px'
                    }}
                  />
                  <Progress
                    percent={accuracy * 100}
                    strokeColor={getAccuracyColor(accuracy)}
                    showInfo={false}
                    size="small"
                  />
                </div>

                <Row gutter={8} style={{ marginBottom: 8 }}>
                  <Col span={12}>
                    <Statistic
                      title="精确率"
                      value={performanceMetrics.precision || 0}
                      precision={3}
                      valueStyle={{ fontSize: '12px' }}
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title="召回率"
                      value={performanceMetrics.recall || 0}
                      precision={3}
                      valueStyle={{ fontSize: '12px' }}
                    />
                  </Col>
                </Row>

                <Row gutter={8} style={{ marginBottom: 8 }}>
                  <Col span={12}>
                    <Statistic
                      title="F1分数"
                      value={performanceMetrics.f1_score || 0}
                      precision={3}
                      valueStyle={{ fontSize: '12px' }}
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title="推理时间"
                      value={performanceMetrics.inference_time || 0}
                      suffix="ms"
                      valueStyle={{ fontSize: '12px' }}
                    />
                  </Col>
                </Row>

                <div style={{ fontSize: '11px', color: '#999' }}>
                  <div>训练样本: {modelData.training_samples || 0}</div>
                  <div>最后训练: {modelData.last_trained ? new Date(modelData.last_trained).toLocaleDateString() : '未知'}</div>
                </div>
              </Card>
            </Col>
          );
        })}
      </Row>

      {/* 系统概览 */}
      <Card 
        title="系统概览" 
        style={{ marginTop: 16 }}
        size="small"
      >
        <Row gutter={16}>
          <Col span={6}>
            <Statistic
              title="总模型数"
              value={Object.keys(modelStatus).length}
              prefix={<RobotOutlined />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="已训练模型"
              value={Object.values(modelStatus).filter((m: any) => m.status === 'trained').length}
              valueStyle={{ color: '#52c41a' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="平均准确率"
              value={
                Object.values(modelStatus).reduce((sum: number, m: any) => sum + (m.accuracy || 0), 0) / 
                Object.keys(modelStatus).length * 100
              }
              suffix="%"
              precision={1}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="系统状态"
              value="正常"
              valueStyle={{ color: '#52c41a' }}
            />
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default ModelStatusOverview;
