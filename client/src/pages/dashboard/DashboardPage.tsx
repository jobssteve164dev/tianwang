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
  const { metrics, threatTrends, threatDistribution, deviceStats, loading, error } = useAppSelector((state) => state.dashboard);
  const { isMobile, isTablet, isDesktop } = useResponsive();

  useEffect(() => {
    // 并行加载所有仪表盘数据
    dispatch(fetchSecurityMetrics() as any);
    dispatch(fetchThreatTrends('7d') as any);
    dispatch(fetchThreatDistribution() as any);
    dispatch(fetchDeviceStats() as any);
  }, [dispatch]);

  // 根据屏幕尺寸调整图表高度 - 优化以确保不超出一个屏幕高度
  const getChartHeight = () => {
    if (isMobile) return 200; // 移动端使用较小高度
    if (isTablet) return 250; // 平板使用中等高度
    if (isDesktop) return 300; // 桌面使用适中高度
    return 350; // 大屏幕使用较大但合理的高度
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
      <h1 className="page-title">
        安全态势概览
      </h1>

      {/* 核心指标卡片 - 使用Ant Design的Row/Col系统 */}
      <Row gutter={[20, 20]} style={{ marginBottom: isMobile ? 16 : 24 }}>
        <Col xs={24} sm={12} md={12} lg={6} xl={6}>
          <div className="stat-card">
            <Statistic
              title="总威胁数"
              value={metrics?.totalThreats || 0}
              prefix={<SafetyCertificateOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ 
                color: '#52c41a', 
                fontSize: isMobile ? 24 : isDesktop ? 32 : 28, 
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
                fontSize: isMobile ? 24 : isDesktop ? 32 : 28, 
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
                fontSize: isMobile ? 24 : isDesktop ? 32 : 28, 
                fontWeight: 600 
              }}
            />
          </div>
        </Col>
        
        <Col xs={24} sm={12} md={12} lg={6} xl={6}>
          <div className="stat-card">
            <Statistic
              title="威胁趋势"
              value={metrics?.threatTrend || 0}
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

      {/* 图表区域 - 响应式布局 */}
      <Row gutter={[20, 20]}>
        <Col xs={24} lg={12}>
          <Card 
            title="威胁趋势分析" 
            className="modern-card"
            style={{ height: getChartHeight() + 80 }}
          >
            <ThreatTrendChart data={threatTrends} height={getChartHeight()} />
          </Card>
        </Col>
        
        <Col xs={24} lg={12}>
          <Card 
            title="威胁类型分布" 
            className="modern-card"
            style={{ height: getChartHeight() + 80 }}
          >
            <ThreatDistributionChart data={threatDistribution} height={getChartHeight()} />
          </Card>
        </Col>
        
        <Col xs={24}>
          <Card 
            title="设备状态统计" 
            className="modern-card"
            style={{ height: getChartHeight() + 80 }}
          >
            <DeviceStatsChart data={deviceStats} height={getChartHeight()} />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default DashboardPage; 