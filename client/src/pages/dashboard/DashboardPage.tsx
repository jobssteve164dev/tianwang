import React, { useEffect } from 'react';
import { Card, Statistic, Row, Col, Spin, Alert } from 'antd';
import {
  SafetyCertificateOutlined,
  AlertOutlined,
  DesktopOutlined,
  RiseOutlined,
} from '@ant-design/icons';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { fetchSecurityMetrics, fetchThreatTrends, fetchThreatDistribution, fetchDeviceStats } from '../../store/slices/dashboardSlice';
import DeviceStatsChart from '../../components/charts/DeviceStatsChart';
import ThreatDistributionChart from '../../components/charts/ThreatDistributionChart';
import ThreatTrendChart from '../../components/charts/ThreatTrendChart';
import { useResponsive } from '../../utils/responsive';

const DashboardPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { metrics, loading, error } = useAppSelector((state) => state.dashboard);
  const { isMobile, isTablet, isDesktop } = useResponsive();

  useEffect(() => {
    // 并行加载所有仪表盘数据
    dispatch(fetchSecurityMetrics() as any);
    dispatch(fetchThreatTrends('7d') as any);
    dispatch(fetchThreatDistribution() as any);
    dispatch(fetchDeviceStats() as any);
  }, [dispatch]);

  // 根据屏幕尺寸调整图表高度
  const getChartHeight = () => {
    if (isMobile) return 250;
    if (isTablet) return 300;
    if (isDesktop) return 350;
    return 400;
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
        message="加载失败"
        description={error}
        type="error"
        showIcon
        style={{ marginBottom: 16 }}
      />
    );
  }

  return (
    <div className="fade-in-up">
      <h1 style={{ 
        marginBottom: isMobile ? 16 : 20, 
        fontSize: isMobile ? 20 : 24, 
        fontWeight: 600,
        color: '#fff',
        textShadow: '0 2px 4px rgba(0,0,0,0.3)'
      }}>
        安全态势概览
      </h1>

      {/* 核心指标卡片 - 使用Ant Design的Row/Col系统 */}
      <Row gutter={[16, 16]} style={{ marginBottom: isMobile ? 16 : 20 }}>
        <Col xs={24} sm={12} md={12} lg={6} xl={6}>
          <div className="stat-card">
            <Statistic
              title="总威胁数"
              value={metrics?.totalThreats || 0}
              prefix={<SafetyCertificateOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ 
                color: '#52c41a', 
                fontSize: isMobile ? 24 : 28, 
                fontWeight: 600 
              }}
            />
          </div>
        </Col>
        
        <Col xs={24} sm={12} md={12} lg={6} xl={6}>
          <div className="stat-card">
            <Statistic
              title="活跃告警"
              value={metrics?.activeAlerts || 0}
              prefix={<AlertOutlined style={{ color: '#ff4d4f' }} />}
              valueStyle={{ 
                color: '#ff4d4f', 
                fontSize: isMobile ? 24 : 28, 
                fontWeight: 600 
              }}
            />
          </div>
        </Col>
        
        <Col xs={24} sm={12} md={12} lg={6} xl={6}>
          <div className="stat-card">
            <Statistic
              title="在线设备"
              value={metrics?.connectedDevices || 0}
              prefix={<DesktopOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ 
                color: '#1890ff', 
                fontSize: isMobile ? 24 : 28, 
                fontWeight: 600 
              }}
            />
          </div>
        </Col>
        
        <Col xs={24} sm={12} md={12} lg={6} xl={6}>
          <div className="stat-card">
            <Statistic
              title="威胁趋势"
              value={metrics?.threatTrend || 12.5}
              precision={1}
              suffix="%"
              prefix={<RiseOutlined style={{ color: '#faad14' }} />}
              valueStyle={{ 
                color: '#faad14', 
                fontSize: isMobile ? 24 : 28, 
                fontWeight: 600 
              }}
            />
          </div>
        </Col>
      </Row>

      {/* 详细分析区域 - 响应式图表布局 */}
      <Row gutter={[16, 16]}>
        {/* 威胁趋势分析 */}
        <Col xs={24} lg={12}>
          <Card
            title="威胁趋势分析"
            className="modern-card"
            style={{ 
              height: '100%',
              minHeight: getChartHeight()
            }}
            headStyle={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              borderBottom: 'none',
              borderRadius: '12px 12px 0 0',
              padding: isMobile ? '12px 16px' : '16px 20px'
            }}
            bodyStyle={{
              padding: isMobile ? '12px' : '16px',
              height: 'calc(100% - 60px)'
            }}
          >
            <ThreatTrendChart 
              height={getChartHeight() - 80}
              data={[]} // 这里需要从API获取数据
            />
          </Card>
        </Col>

        {/* 威胁类型分布 */}
        <Col xs={24} lg={12}>
          <Card
            title="威胁类型分布"
            className="modern-card"
            style={{ 
              height: '100%',
              minHeight: getChartHeight()
            }}
            headStyle={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              borderBottom: 'none',
              borderRadius: '12px 12px 0 0',
              padding: isMobile ? '12px 16px' : '16px 20px'
            }}
            bodyStyle={{
              padding: isMobile ? '12px' : '16px',
              height: 'calc(100% - 60px)'
            }}
          >
            <ThreatDistributionChart 
              height={getChartHeight() - 80}
              data={[]} // 这里需要从API获取数据
            />
          </Card>
        </Col>
      </Row>

      {/* 设备统计图表 - 全宽显示 */}
      <Row style={{ marginTop: 16 }}>
        <Col span={24}>
          <Card
            title="设备状态统计"
            className="modern-card"
            style={{ 
              minHeight: getChartHeight()
            }}
            headStyle={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              borderBottom: 'none',
              borderRadius: '12px 12px 0 0',
              padding: isMobile ? '12px 16px' : '16px 20px'
            }}
            bodyStyle={{
              padding: isMobile ? '12px' : '16px',
              height: 'calc(100% - 60px)'
            }}
          >
            <DeviceStatsChart 
              height={getChartHeight() - 80}
              data={[]} // 这里需要从API获取数据
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default DashboardPage; 