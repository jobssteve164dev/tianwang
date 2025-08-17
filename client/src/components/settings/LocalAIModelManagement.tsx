import React, { useState, useEffect } from 'react';
import {
  Tabs,
  Spin,
  Space,
  App,
} from 'antd';
import {
  DashboardOutlined,
  PlayCircleOutlined,
  DatabaseOutlined,
  LineChartOutlined,
  ExperimentOutlined,
} from '@ant-design/icons';
import { localAIModelApi } from '../../services/api';
import ModelStatusOverview from './ModelStatusOverview';
import ModelTrainingPanel from './ModelTrainingPanel';
import TrainingDataManager from './TrainingDataManager';
import ModelPerformanceMonitor from './ModelPerformanceMonitor';
import ModelTestingTool from './ModelTestingTool';



interface LocalAIModelManagementProps {
  onConfigChange?: () => void;
}

const LocalAIModelManagement: React.FC<LocalAIModelManagementProps> = ({ 
  onConfigChange 
}) => {
  const { message: messageApi } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [modelStatus, setModelStatus] = useState<any>(null);
  const [performanceData, setPerformanceData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('overview');

  // 加载模型状态
  const loadModelStatus = async () => {
    try {
      setLoading(true);
      const response = await localAIModelApi.getModelStatus();
      if (response.success) {
        setModelStatus(response.models);
      } else {
        messageApi.error(`加载模型状态失败: ${response.message || '未知错误'}`);
      }
    } catch (error) {
      console.error('加载模型状态失败:', error);
      messageApi.error(`加载模型状态失败: ${error instanceof Error ? error.message : '网络错误'}`);
    } finally {
      setLoading(false);
    }
  };

  // 加载性能数据
  const loadPerformanceData = async () => {
    try {
      const response = await localAIModelApi.getModelPerformance();
      if (response.success) {
        setPerformanceData(response.performance_metrics);
      } else {
        console.warn('加载性能数据失败:', response.message);
      }
    } catch (error) {
      console.error('加载性能数据失败:', error);
      // 性能数据加载失败不影响主要功能，只记录日志
    }
  };

  // 刷新数据
  const handleRefresh = async () => {
    await Promise.all([
      loadModelStatus(),
      loadPerformanceData()
    ]);
    onConfigChange?.();
  };

  useEffect(() => {
    loadModelStatus();
    loadPerformanceData();
    
    // 设置定时刷新
    const interval = setInterval(() => {
      loadModelStatus();
      loadPerformanceData();
    }, 30000); // 每30秒刷新一次
    
    return () => clearInterval(interval);
  }, []);

  // 定义标签页
  const tabItems = [
    {
      key: 'overview',
      label: (
        <Space>
          <DashboardOutlined />
          状态概览
        </Space>
      ),
      children: (
        <ModelStatusOverview 
          modelStatus={modelStatus}
          onRefresh={handleRefresh}
          loading={loading}
        />
      )
    },
    {
      key: 'training',
      label: (
        <Space>
          <PlayCircleOutlined />
          模型训练
        </Space>
      ),
      children: (
        <ModelTrainingPanel 
          modelStatus={modelStatus}
          onTrainingComplete={handleRefresh}
        />
      )
    },
    {
      key: 'data',
      label: (
        <Space>
          <DatabaseOutlined />
          数据管理
        </Space>
      ),
      children: (
        <TrainingDataManager 
          onDataChange={handleRefresh}
        />
      )
    },
    {
      key: 'performance',
      label: (
        <Space>
          <LineChartOutlined />
          性能监控
        </Space>
      ),
      children: (
        <ModelPerformanceMonitor 
          performanceData={performanceData}
          onRefresh={handleRefresh}
        />
      )
    },
    {
      key: 'testing',
      label: (
        <Space>
          <ExperimentOutlined />
          测试工具
        </Space>
      ),
      children: (
        <ModelTestingTool 
          modelStatus={modelStatus}
        />
      )
    }
  ];

  return (
    <div className="local-ai-model-management">
      <Spin spinning={loading} tip="加载中...">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          size="large"
          style={{ marginTop: 24 }}
        />
      </Spin>
    </div>
  );
};

export default LocalAIModelManagement;
