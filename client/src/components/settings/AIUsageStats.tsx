import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Statistic,
  Progress,
  Tag,
  Space,
  Button,
  Typography,
  Row,
  Col,
  Spin,
  App,
} from 'antd';
import {
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import { aiModelApi } from '../../services/api';

const { Title, Text } = Typography;

interface UsageStats {
  total_requests: number;
  total_cost: number;
  daily_cost: number;
  monthly_cost: number;
  providers: {
    [key: string]: {
      status: string;
      request_count: number;
      failure_count: number;
      daily_cost: number;
      monthly_cost: number;
    };
  };
}

interface AIUsageStatsProps {
  refreshTrigger?: number;
}

const AIUsageStats: React.FC<AIUsageStatsProps> = ({ refreshTrigger }) => {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // 提供商信息
  const providers: Record<string, {
    name: string;
    icon: string;
    color: string;
    description: string;
  }> = {
    openai: {
      name: 'OpenAI',
      icon: '🤖',
      color: 'blue',
      description: 'GPT系列模型'
    },
    claude: {
      name: 'Claude',
      icon: '🧠',
      color: 'green',
      description: 'Anthropic Claude模型'
    },
    openrouter: {
      name: 'OpenRouter',
      icon: '🌐',
      color: 'purple',
      description: '多提供商聚合服务'
    },
    deepseek: {
      name: 'DeepSeek',
      icon: '💻',
      color: 'orange',
      description: '技术专用模型'
    }
  };

  // 加载统计数据
  const loadStats = async () => {
    try {
      setLoading(true);
      const response = await aiModelApi.getUsageStats();
      if (response.success) {
        setStats(response.stats);
        setLastUpdate(new Date());
      } else {
        console.error('获取统计数据失败:', response.message);
        message.error(response.message || '获取统计数据失败');
      }
    } catch (error: any) {
      console.error('获取统计数据失败:', error);
      message.error(error.message || '获取统计数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取状态标签
  const getStatusTag = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Tag color="green" icon={<CheckCircleOutlined />}>正常</Tag>;
      case 'degraded':
        return <Tag color="orange" icon={<ExclamationCircleOutlined />}>降级</Tag>;
      case 'unhealthy':
        return <Tag color="red" icon={<CloseCircleOutlined />}>异常</Tag>;
      default:
        return <Tag color="default" icon={<QuestionCircleOutlined />}>未知</Tag>;
    }
  };

  // 计算成功率
  const calculateSuccessRate = (requestCount: number, failureCount: number): number => {
    if (requestCount === 0) return 100;
    return Number(((requestCount - failureCount) / requestCount * 100).toFixed(1));
  };

  // 表格列定义
  const columns = [
    {
      title: '提供商',
      dataIndex: 'provider',
      key: 'provider',
      render: (provider: string) => (
        <Space>
          <span style={{ fontSize: '16px' }}>{providers[provider]?.icon}</span>
          <div>
            <div>{providers[provider]?.name}</div>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {providers[provider]?.description}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => getStatusTag(status),
    },
    {
      title: '请求次数',
      dataIndex: 'request_count',
      key: 'request_count',
      render: (count: number) => (
        <Statistic value={count} suffix="次" />
      ),
    },
    {
      title: '成功率',
      key: 'success_rate',
      render: (_: unknown, record: any) => {
        const rate = calculateSuccessRate(record.request_count, record.failure_count);
        return (
          <div>
            <Progress
              percent={rate}
              size="small"
              status={rate >= 95 ? 'success' : rate >= 80 ? 'normal' : 'exception'}
            />
            <Text style={{ fontSize: '12px' }}>{rate}%</Text>
          </div>
        );
      },
    },
    {
      title: '今日成本',
      dataIndex: 'daily_cost',
      key: 'daily_cost',
      render: (cost: number) => (
        <Statistic
          value={cost}
          precision={4}
          prefix="$"
          valueStyle={{ color: cost > 0 ? '#cf1322' : '#3f8600' }}
        />
      ),
    },
    {
      title: '本月成本',
      dataIndex: 'monthly_cost',
      key: 'monthly_cost',
      render: (cost: number) => (
        <Statistic
          value={cost}
          precision={4}
          prefix="$"
          valueStyle={{ color: cost > 0 ? '#cf1322' : '#3f8600' }}
        />
      ),
    },
  ];

  // 表格数据
  const tableData = stats ? Object.entries(stats.providers).map(([provider, data]) => ({
    key: provider,
    provider,
    ...data,
  })) : [];

  useEffect(() => {
    loadStats();
  }, [refreshTrigger]);

  if (loading && !stats) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>加载使用量统计中...</div>
      </div>
    );
  }

  return (
    <div className="ai-usage-stats">
      <div className="section-header">
        <Title level={3}>
          API使用量统计
        </Title>
        <Space>
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            onClick={loadStats}
            loading={loading}
          >
            刷新数据
          </Button>
          {lastUpdate && (
            <Text type="secondary">
              最后更新: {lastUpdate.toLocaleString()}
            </Text>
          )}
        </Space>
      </div>

      {/* 统计概览 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic
              title="总请求次数"
              value={stats?.total_requests || 0}
              suffix="次"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic
              title="今日成本"
              value={stats?.daily_cost || 0}
              precision={4}
              prefix="$"
              valueStyle={{ color: (stats?.daily_cost || 0) > 0 ? '#cf1322' : '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic
              title="本月成本"
              value={stats?.monthly_cost || 0}
              precision={4}
              prefix="$"
              valueStyle={{ color: (stats?.monthly_cost || 0) > 0 ? '#cf1322' : '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic
              title="活跃提供商"
              value={stats ? Object.keys(stats.providers).filter(p => stats.providers[p].request_count > 0).length : 0}
              suffix="个"
            />
          </Card>
        </Col>
      </Row>

      {/* 提供商详细统计 */}
      <Card
        title="提供商详细统计"
        extra={
          <Space>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {lastUpdate && `最后更新: ${lastUpdate.toLocaleString()}`}
            </Text>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={tableData}
          pagination={false}
          loading={loading}
          size="middle"
        />
      </Card>

      {/* 使用说明 */}
      {/* <Alert
        message="使用说明"
        description="统计数据实时更新，成本基于实际API调用计算。建议定期检查成本控制设置，避免超出预算。"
        type="info"
        showIcon
        style={{ marginTop: 16 }}
      /> */}

      {/* 成本控制建议 */}
      {stats && stats.daily_cost > 0.1 && (
        <div style={{ marginTop: 16 }}>
          {/* 成本提醒功能暂时注释 */}
        </div>
      )}
    </div>
  );
};

export default AIUsageStats;
