import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Statistic,
  Row,
  Col,
  message,
  Spin,
  Typography,
  Badge,
  Empty,
} from 'antd';
import {
  ReloadOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  SafetyCertificateOutlined,
  BugOutlined,
  SecurityScanOutlined,
  PlusOutlined,
  EditOutlined,
  PlayCircleOutlined,
  CodeOutlined
} from '@ant-design/icons';
import { securityRulesApi } from '../../services/api';
import CustomRuleEditor from '../../components/security/CustomRuleEditor';

const { Title, Text, Paragraph } = Typography;

interface RuleStatistics {
  total_rules: number;
  enabled_rules: number;
  last_update: string | null;
  matches_found: number;
}

interface CustomRule {
  id: string;
  filename: string;
  title: string;
  description: string;
  author: string;
  date: string;
  level: string;
  status: string;
  logsource: any;
  tags: string[];
  enabled: boolean;
  error?: string | null;
  created_at: string;
  updated_at: string;
}

const SecurityRulesPage: React.FC = () => {
  const [statistics, setStatistics] = useState<RuleStatistics | null>(null);
  // 自定义规则相关状态
  const [customRules, setCustomRules] = useState<CustomRule[]>([]);
  const [customRulesLoading, setCustomRulesLoading] = useState(false);
  const [editorVisible, setEditorVisible] = useState(false);
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const [selectedRuleId, setSelectedRuleId] = useState<string>('');

  // const { user } = useAppSelector((state) => state.auth);

  // 获取规则统计信息
  const fetchStatistics = async () => {
    try {
      const response = await securityRulesApi.getRuleStatistics();
      if (response.success) {
        setStatistics(response.data);
      }
    } catch (error) {
      console.error('获取规则统计失败:', error);
    }
  };

  // 获取自定义规则列表
  const fetchCustomRules = async () => {
    try {
      setCustomRulesLoading(true);
      const response = await securityRulesApi.getCustomRules();
      if (response.success) {
        setCustomRules(response.data);
      } else {
        message.error('获取自定义规则列表失败');
      }
    } catch (error) {
      console.error('获取自定义规则列表失败:', error);
      message.error('获取自定义规则列表失败');
    } finally {
      setCustomRulesLoading(false);
    }
  };

  // 打开创建规则编辑器
  const openCreateEditor = () => {
    setEditorMode('create');
    setSelectedRuleId('');
    setEditorVisible(true);
  };

  // 打开编辑规则编辑器
  const openEditEditor = (ruleId: string) => {
    setEditorMode('edit');
    setSelectedRuleId(ruleId);
    setEditorVisible(true);
  };

  // 编辑器成功回调
  const handleEditorSuccess = () => {
    fetchCustomRules();
    fetchStatistics();
  };

  useEffect(() => {
    fetchStatistics();
    fetchCustomRules();
  }, []);

  // 自定义规则表格列配置
  const customRuleColumns = [
    {
      title: '规则标题',
      dataIndex: 'title',
      key: 'title',
      render: (text: string, record: CustomRule) => (
        <Space direction="vertical" size={0}>
          <Text strong>{text}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.description}
          </Text>
          {record.error && <Text type="danger">{record.error}</Text>}
        </Space>
      ),
    },
    {
      title: '作者',
      dataIndex: 'author',
      key: 'author',
      render: (text: string) => <Text>{text}</Text>,
    },
    {
      title: '级别',
      dataIndex: 'level',
      key: 'level',
      render: (level: string) => {
        const colorMap = {
          low: 'green',
          medium: 'orange',
          high: 'red',
          critical: 'purple'
        };
        const labels: Record<string, string> = { low: '低', medium: '中', high: '高', critical: '严重' };
        return <Tag color={colorMap[level as keyof typeof colorMap]}>{labels[level] || '未指定'}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colorMap = {
          experimental: 'blue',
          test: 'orange',
          stable: 'green'
        };
        const labels: Record<string, string> = { experimental: '实验性', test: '测试', stable: '稳定' };
        return <Tag color={colorMap[status as keyof typeof colorMap]}>{labels[status] || '未指定'}</Tag>;
      },
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      render: (tags: string[]) => (
        <Space wrap>
          {(tags || []).slice(0, 3).map(tag => (
            <Tag key={tag}>{tag}</Tag>
          ))}
          {tags?.length > 3 && <Tag>+{tags.length - 3}</Tag>}
        </Space>
      ),
    },
    {
      title: '启用状态',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (enabled: boolean) => (
        <Badge 
          status={enabled ? 'success' : 'default'} 
          text={enabled ? '已启用' : '已禁用'} 
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: CustomRule) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEditEditor(record.id)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            icon={<PlayCircleOutlined />}
            onClick={() => openEditEditor(record.id)}
          >
            测试
          </Button>
        </Space>
      ),
    },
  ];

  // 渲染统计卡片
  const renderStatisticsCards = () => {
    if (!statistics) return null;

    return (
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="总规则数"
              value={statistics.total_rules}
              prefix={<SafetyCertificateOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="匹配次数"
              value={statistics.matches_found}
              prefix={<BugOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="已启用规则"
              value={statistics.enabled_rules}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="最后更新"
              value={statistics.last_update ? new Date(statistics.last_update).toLocaleDateString() : '从未'}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
      </Row>
    );
  };

  return (
    <div className="fade-in-up">
      <div className="page-header">
        <Title level={2}>
          <SecurityScanOutlined style={{ marginRight: 8 }} />
          安全规则管理
        </Title>
        <Paragraph type="secondary">
          创建、测试和调整检测规则，及时发现需要处理的活动
        </Paragraph>
      </div>

      {/* 统计信息 */}
      {renderStatisticsCards()}

              <Card
                title={
                  <Space>
                    <CodeOutlined />
                    自定义规则管理
                  </Space>
                }
                extra={
                  <Space>
                    <Button
                      icon={<ReloadOutlined />}
                      onClick={fetchCustomRules}
                      loading={customRulesLoading}
                    >
                      刷新
                    </Button>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={openCreateEditor}
                    >
                      创建规则
                    </Button>
                  </Space>
                }
              >
                {customRulesLoading ? (
                  <div style={{ textAlign: 'center', padding: '40px' }}>
                    <Spin size="large" />
                  </div>
                ) : customRules.length === 0 ? (
                  <Empty 
                    description="暂无自定义规则" 
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  >
                    <Button type="primary" icon={<PlusOutlined />} onClick={openCreateEditor}>
                      创建第一个规则
                    </Button>
                  </Empty>
                ) : (
                  <Table
                    columns={customRuleColumns}
                    dataSource={customRules}
                    rowKey="id"
                    pagination={{
                      pageSize: 10,
                      showSizeChanger: true,
                      showQuickJumper: true,
                      showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`
                    }}
                    size="middle"
                  />
                )}
              </Card>

      {/* 自定义规则编辑器 */}
      <CustomRuleEditor
        visible={editorVisible}
        mode={editorMode}
        ruleId={selectedRuleId}
        onCancel={() => setEditorVisible(false)}
        onSuccess={handleEditorSuccess}
      />
    </div>
  );
};

export default SecurityRulesPage;
