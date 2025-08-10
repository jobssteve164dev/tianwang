import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Alert, Spin, List, Tag, Button, Space } from 'antd';
import { 
  SafetyCertificateOutlined, 
  AlertOutlined, 
  DesktopOutlined,
  RiseOutlined,
  EyeOutlined,
  ArrowRightOutlined
} from '@ant-design/icons';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { fetchSecurityMetrics, fetchThreatTrends, fetchThreatDistribution, fetchDeviceStats } from '../../store/slices/dashboardSlice';
import { fetchAlerts } from '../../store/slices/alertSlice';
import ThreatTrendChart from '../../components/charts/ThreatTrendChart';
import ThreatDistributionChart from '../../components/charts/ThreatDistributionChart';
import DeviceStatsChart from '../../components/charts/DeviceStatsChart';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';

const DashboardPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { metrics, loading, error } = useAppSelector((state) => state.dashboard as any);
  const { alerts } = useAppSelector((state) => state.alert as any);
  
  // 图表数据状态
  const [threatTrendData, setThreatTrendData] = useState<any[]>([]);
  const [threatDistributionData, setThreatDistributionData] = useState<any[]>([]);
  const [deviceStatsData, setDeviceStatsData] = useState<any[]>([]);
  const [chartsLoading, setChartsLoading] = useState(true);

  useEffect(() => {
    dispatch(fetchSecurityMetrics() as any);
    // 获取最近的告警数据
    dispatch(fetchAlerts({ pageSize: 5, status: 'active' }) as any);
    
    // 加载图表数据
    loadChartsData();
  }, [dispatch]);

  const loadChartsData = async () => {
    setChartsLoading(true);
    try {
      // 并行加载图表数据
      const [trendsResult, distributionResult, deviceStatsResult] = await Promise.allSettled([
        dispatch(fetchThreatTrends('7d') as any),
        dispatch(fetchThreatDistribution() as any),
        dispatch(fetchDeviceStats() as any)
      ]);

      // 处理威胁趋势数据
      if (trendsResult.status === 'fulfilled') {
        const trendsData = trendsResult.value.payload || [];
        setThreatTrendData(Array.isArray(trendsData) ? trendsData : generateMockTrendData());
      } else {
        setThreatTrendData(generateMockTrendData());
      }

      // 处理威胁分布数据
      if (distributionResult.status === 'fulfilled') {
        const distributionData = distributionResult.value.payload || [];
        setThreatDistributionData(Array.isArray(distributionData) ? distributionData : generateMockDistributionData());
      } else {
        setThreatDistributionData(generateMockDistributionData());
      }

      // 处理设备统计数据
      if (deviceStatsResult.status === 'fulfilled') {
        const statsData = deviceStatsResult.value.payload || [];
        setDeviceStatsData(Array.isArray(statsData) ? statsData : generateMockDeviceStatsData());
      } else {
        setDeviceStatsData(generateMockDeviceStatsData());
      }
    } catch (error) {
      console.error('加载图表数据失败:', error);
      // 使用模拟数据作为后备
      setThreatTrendData(generateMockTrendData());
      setThreatDistributionData(generateMockDistributionData());
      setDeviceStatsData(generateMockDeviceStatsData());
    } finally {
      setChartsLoading(false);
    }
  };

  // 生成模拟威胁趋势数据
  const generateMockTrendData = () => {
    const data = [];
    for (let i = 23; i >= 0; i--) {
      const time = dayjs().subtract(i, 'hour').format('YYYY-MM-DD HH:mm:ss');
      const count = Math.floor(Math.random() * 50) + 10;
      data.push({ time, count });
    }
    return data;
  };

  // 生成模拟威胁分布数据
  const generateMockDistributionData = () => [
    { name: '恶意软件', value: 35 },
    { name: '网络入侵', value: 28 },
    { name: '异常行为', value: 22 },
    { name: '数据泄露', value: 15 },
    { name: '钓鱼攻击', value: 12 },
    { name: '暴力破解', value: 8 }
  ];

  // 生成模拟设备统计数据
  const generateMockDeviceStatsData = () => [
    { name: 'Windows', online: 45, offline: 8, warning: 2 },
    { name: 'Linux', online: 32, offline: 5, warning: 1 },
    { name: 'macOS', online: 18, offline: 3, warning: 0 },
    { name: 'OpenWrt', online: 12, offline: 2, warning: 1 }
  ];

  const getSeverityColor = (severity: string) => {
    const colors = {
      low: 'green',
      medium: 'orange', 
      high: 'red',
      critical: 'purple'
    };
    return colors[severity as keyof typeof colors] || 'default';
  };

  const handleViewAllAlerts = () => {
    navigate('/alerts');
  };

  if (loading) {
    return (
      <div className="modern-loading">
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        message="数据加载失败"
        description={error}
        type="error"
        style={{ margin: '16px 0' }}
        className="modern-card"
      />
    );
  }

  // 最近告警数据（取前5条）
  const recentAlerts = alerts?.slice(0, 5) || [];

  return (
    <div className="fade-in-up">
      <h1 style={{ 
        marginBottom: 20, 
        fontSize: 24, 
        fontWeight: 600,
        color: '#fff',
        textShadow: '0 2px 4px rgba(0,0,0,0.3)'
      }}>
        安全态势概览
      </h1>

      {/* 核心指标卡片 */}
      <div className="compact-grid mb-20">
        <div className="stat-card">
          <Statistic
            title="总威胁数"
            value={metrics?.totalThreats || 0}
            prefix={<SafetyCertificateOutlined style={{ color: '#52c41a' }} />}
            valueStyle={{ color: '#52c41a', fontSize: 28, fontWeight: 600 }}
          />
        </div>
        
        <div className="stat-card">
          <Statistic
            title="活跃告警"
            value={metrics?.activeAlerts || 0}
            prefix={<AlertOutlined style={{ color: '#ff4d4f' }} />}
            valueStyle={{ color: '#ff4d4f', fontSize: 28, fontWeight: 600 }}
          />
        </div>
        
        <div className="stat-card">
          <Statistic
            title="在线设备"
            value={metrics?.connectedDevices || 0}
            prefix={<DesktopOutlined style={{ color: '#1890ff' }} />}
            valueStyle={{ color: '#1890ff', fontSize: 28, fontWeight: 600 }}
          />
        </div>
        
        <div className="stat-card">
          <Statistic
            title="威胁趋势"
            value={12.5}
            precision={1}
            suffix="%"
            prefix={<RiseOutlined style={{ color: '#faad14' }} />}
            valueStyle={{ color: '#faad14', fontSize: 28, fontWeight: 600 }}
          />
        </div>
      </div>

      {/* 详细分析区域 */}
      <div className="compact-grid-lg mb-20">
        <Card 
          title="威胁趋势分析" 
          bordered={false}
          className="modern-card"
          headStyle={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            borderBottom: 'none',
            borderRadius: '16px 16px 0 0'
          }}
        >
          <ThreatTrendChart 
            data={threatTrendData} 
            loading={chartsLoading}
            height={280}
          />
        </Card>
        
        <Card 
          title="威胁类型分布" 
          bordered={false}
          className="modern-card"
          headStyle={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            borderBottom: 'none',
            borderRadius: '16px 16px 0 0'
          }}
        >
          <ThreatDistributionChart 
            data={threatDistributionData} 
            loading={chartsLoading}
            height={280}
          />
        </Card>
      </div>

      <div className="compact-grid-lg">
        <Card 
          title="设备状态统计" 
          bordered={false}
          className="modern-card"
          headStyle={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            borderBottom: 'none',
            borderRadius: '16px 16px 0 0'
          }}
        >
          <DeviceStatsChart 
            data={deviceStatsData} 
            loading={chartsLoading}
            height={200}
          />
        </Card>
        
        <Card 
          title="最近告警" 
          bordered={false}
          className="modern-card"
          headStyle={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            borderBottom: 'none',
            borderRadius: '16px 16px 0 0'
          }}
          extra={
            <Button 
              type="text" 
              icon={<ArrowRightOutlined />}
              onClick={handleViewAllAlerts}
              style={{ color: 'white' }}
              className="modern-button"
            >
              查看全部
            </Button>
          }
        >
          <div style={{ height: 200, overflow: 'hidden' }}>
            {recentAlerts.length > 0 ? (
              <List
                size="small"
                dataSource={recentAlerts}
                renderItem={(item: any) => (
                  <List.Item
                    style={{ 
                      padding: '8px 0', 
                      borderBottom: '1px solid rgba(0,0,0,0.06)',
                      marginBottom: 4
                    }}
                    actions={[
                      <Button 
                        key="view"
                        type="text" 
                        size="small" 
                        icon={<EyeOutlined />}
                        onClick={() => navigate('/alerts')}
                        className="modern-button"
                      />
                    ]}
                  >
                    <List.Item.Meta
                      title={
                        <Space>
                          <Tag 
                            color={getSeverityColor(item.severity)}
                            className="modern-tag"
                          >
                            {item.severity.toUpperCase()}
                          </Tag>
                          <span style={{ fontSize: 13, fontWeight: 500 }}>
                            {item.title}
                          </span>
                        </Space>
                      }
                      description={
                        <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                          <div>{item.type} • {item.source}</div>
                          <div>{dayjs(item.timestamp).format('MM-DD HH:mm')}</div>
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <div className="modern-empty">
                <div style={{ textAlign: 'center' }}>
                  <AlertOutlined style={{ fontSize: 24, marginBottom: 8, display: 'block', color: '#999' }} />
                  <div style={{ color: '#999', fontSize: 14 }}>暂无活跃告警</div>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage; 