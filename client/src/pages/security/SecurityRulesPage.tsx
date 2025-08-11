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
  Alert,
  Modal,
  message,
  Spin,
  Typography,
  Switch,
  Badge,
  Empty
} from 'antd';
import {
  ReloadOutlined,
  DownloadOutlined,
  SettingOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  SafetyCertificateOutlined,
  BugOutlined,
  SecurityScanOutlined
} from '@ant-design/icons';
import { securityRulesApi } from '../../services/api';

const { Title, Text, Paragraph } = Typography;

interface RuleSource {
  id: string;
  name: string;
  url?: string;
  description: string;
  enabled: boolean;
  local?: boolean;
}

interface RuleType {
  name: string;
  description: string;
  sources: RuleSource[];
}

interface RuleStatistics {
  total_rules: number;
  last_update: string;
  rule_types: {
    sigma: number;
    suricata: number;
    yara: number;
    snort: number;
  };
  matches_found: number;
  false_positives: number;
}

const SecurityRulesPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [ruleSources, setRuleSources] = useState<Record<string, RuleType>>({});
  const [statistics, setStatistics] = useState<RuleStatistics | null>(null);
  const [updateModalVisible, setUpdateModalVisible] = useState(false);
  const [selectedSource, setSelectedSource] = useState<{ type: string; source: string } | null>(null);

  // const { user } = useAppSelector((state) => state.auth);

  // 获取规则源列表
  const fetchRuleSources = async () => {
    try {
      setLoading(true);
      const response = await securityRulesApi.getRuleSources();
      if (response.success) {
        setRuleSources(response.data);
      } else {
        message.error('获取规则源列表失败');
      }
    } catch (error) {
      console.error('获取规则源列表失败:', error);
      message.error('获取规则源列表失败');
    } finally {
      setLoading(false);
    }
  };

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

  // 更新规则
  const updateRules = async (sourceType?: string, sourceName?: string) => {
    try {
      setUpdating(true);
      const payload = sourceType && sourceName 
        ? { source_type: sourceType, source_name: sourceName }
        : undefined;
      
      const response = await securityRulesApi.updateRules(payload);
      if (response.success) {
        message.success('规则更新已开始，请稍后查看结果');
        setUpdateModalVisible(false);
        setSelectedSource(null);
        // 延迟刷新统计信息
        setTimeout(() => {
          fetchStatistics();
        }, 3000);
      } else {
        message.error(response.message || '规则更新失败');
      }
    } catch (error) {
      console.error('规则更新失败:', error);
      message.error('规则更新失败');
    } finally {
      setUpdating(false);
    }
  };

  // 切换规则源状态
  const toggleSourceStatus = (type: string, sourceId: string, enabled: boolean) => {
    setRuleSources(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        sources: prev[type].sources.map(source =>
          source.id === sourceId ? { ...source, enabled } : source
        )
      }
    }));
    message.success(`${enabled ? '启用' : '禁用'}规则源成功`);
  };

  useEffect(() => {
    fetchRuleSources();
    fetchStatistics();
  }, []);

  // 表格列配置
  const columns = [
    {
      title: '规则源',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: RuleSource) => (
        <Space>
          <Text strong>{text}</Text>
          {record.local && <Tag color="blue">本地</Tag>}
        </Space>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      render: (text: string) => <Text type="secondary">{text}</Text>,
    },
    {
      title: '状态',
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
      render: (_: any, record: RuleSource) => {
        const ruleType = Object.keys(ruleSources).find(type => 
          ruleSources[type].sources.some(s => s.id === record.id)
        );
        
        return (
          <Space>
            <Switch
              checked={record.enabled}
              onChange={(checked) => toggleSourceStatus(ruleType!, record.id, checked)}
              size="small"
            />
            {!record.local && (
              <Button
                type="primary"
                size="small"
                icon={<DownloadOutlined />}
                onClick={() => {
                  setSelectedSource({ type: ruleType!, source: record.id });
                  setUpdateModalVisible(true);
                }}
              >
                更新
              </Button>
            )}
          </Space>
        );
      },
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
              title="误报次数"
              value={statistics.false_positives}
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
    <div className="security-rules-page">
      <div className="page-header">
        <Title level={2}>
          <SecurityScanOutlined style={{ marginRight: 8 }} />
          安全规则管理
        </Title>
        <Paragraph type="secondary">
          管理开源安全规则库，配置规则源和更新策略，确保威胁检测的及时性和准确性
        </Paragraph>
      </div>

      {/* 统计信息 */}
      {renderStatisticsCards()}

      {/* 规则源管理 */}
      <Card
        title={
          <Space>
            <SettingOutlined />
            规则源管理
          </Space>
        }
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                fetchRuleSources();
                fetchStatistics();
              }}
              loading={loading}
            >
              刷新
            </Button>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={() => {
                setSelectedSource(null);
                setUpdateModalVisible(true);
              }}
              loading={updating}
            >
              全部更新
            </Button>
          </Space>
        }
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Spin size="large" />
          </div>
        ) : Object.keys(ruleSources).length === 0 ? (
          <Empty description="暂无规则源数据" />
        ) : (
          Object.entries(ruleSources).map(([type, ruleType]) => (
            <div key={type} style={{ marginBottom: 24 }}>
              <Title level={4} style={{ marginBottom: 16 }}>
                {ruleType.name}
                <Text type="secondary" style={{ marginLeft: 8, fontSize: 14 }}>
                  {ruleType.description}
                </Text>
              </Title>
              <Table
                columns={columns}
                dataSource={ruleType.sources}
                rowKey="id"
                pagination={false}
                size="small"
                bordered
              />
            </div>
          ))
        )}
      </Card>

      {/* 更新规则模态框 */}
      <Modal
        title="更新安全规则"
        open={updateModalVisible}
        onOk={() => updateRules(selectedSource?.type, selectedSource?.source)}
        onCancel={() => {
          setUpdateModalVisible(false);
          setSelectedSource(null);
        }}
        confirmLoading={updating}
        okText="开始更新"
        cancelText="取消"
      >
        <div style={{ padding: '20px 0' }}>
          {selectedSource ? (
            <Alert
              message="更新特定规则源"
              description={`即将更新 ${ruleSources[selectedSource.type]?.name} 规则库中的 ${selectedSource.source} 源`}
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
          ) : (
            <Alert
              message="更新所有规则源"
              description="即将更新所有已启用的规则源，这可能需要几分钟时间"
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}
          
          <Paragraph>
            <Text strong>更新说明：</Text>
          </Paragraph>
          <ul>
            <li>规则更新将在后台进行，不会影响当前系统运行</li>
            <li>更新完成后会自动刷新规则统计信息</li>
            <li>建议在系统负载较低时进行更新</li>
            <li>更新过程中请勿重复点击更新按钮</li>
          </ul>
        </div>
      </Modal>
    </div>
  );
};

export default SecurityRulesPage;
