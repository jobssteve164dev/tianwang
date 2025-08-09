import React, { useEffect } from 'react';
import { Row, Col, Card, Statistic, Alert, Spin } from 'antd';
import { 
  SafetyCertificateOutlined, 
  AlertOutlined, 
  DesktopOutlined,
  RiseOutlined 
} from '@ant-design/icons';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { fetchSecurityMetrics } from '../../store/slices/dashboardSlice';

const DashboardPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { metrics, loading, error } = useAppSelector((state) => state.dashboard as any);

  useEffect(() => {
    dispatch(fetchSecurityMetrics() as any);
  }, [dispatch]);

  if (loading) {
    return (
      <div className="flex-center" style={{ height: 400 }}>
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
        showIcon
        style={{ margin: '20px 0' }}
      />
    );
  }

  return (
    <div>
      <h1 style={{ marginBottom: 24, fontSize: 24, fontWeight: 600 }}>
        安全态势概览
      </h1>

      {/* 核心指标卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} style={{ textAlign: 'center' }}>
            <Statistic
              title="总威胁数"
              value={metrics?.totalThreats || 0}
              prefix={<SafetyCertificateOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a', fontSize: 28 }}
            />
          </Card>
        </Col>
        
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} style={{ textAlign: 'center' }}>
            <Statistic
              title="活跃告警"
              value={metrics?.activeAlerts || 0}
              prefix={<AlertOutlined style={{ color: '#ff4d4f' }} />}
              valueStyle={{ color: '#ff4d4f', fontSize: 28 }}
            />
          </Card>
        </Col>
        
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} style={{ textAlign: 'center' }}>
            <Statistic
              title="在线设备"
              value={metrics?.connectedDevices || 0}
              prefix={<DesktopOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff', fontSize: 28 }}
            />
          </Card>
        </Col>
        
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} style={{ textAlign: 'center' }}>
            <Statistic
              title="威胁趋势"
              value={12.5}
              precision={1}
              suffix="%"
              prefix={<RiseOutlined style={{ color: '#faad14' }} />}
              valueStyle={{ color: '#faad14', fontSize: 28 }}
            />
          </Card>
        </Col>
      </Row>

      {/* 详细分析区域 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card title="威胁趋势分析" bordered={false}>
            <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
              威胁趋势图表区域
              <br />
              (将在4.3阶段集成ECharts)
            </div>
          </Card>
        </Col>
        
        <Col xs={24} lg={8}>
          <Card title="威胁类型分布" bordered={false}>
            <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
              威胁类型饼图区域
              <br />
              (将在4.3阶段集成ECharts)
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="设备状态统计" bordered={false}>
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
              设备状态图表区域
              <br />
              (将在4.3阶段集成ECharts)
            </div>
          </Card>
        </Col>
        
        <Col xs={24} lg={12}>
          <Card title="最近告警" bordered={false}>
            <div style={{ height: 200, padding: 16 }}>
              <div style={{ color: '#999', textAlign: 'center', paddingTop: 60 }}>
                最近告警列表
                <br />
                (将在4.2阶段完善)
              </div>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default DashboardPage; 