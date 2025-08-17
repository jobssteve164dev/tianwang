import React from 'react';
import { Card, Typography, Space } from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import LocalAIModelManagement from '../../components/settings/LocalAIModelManagement';

const { Title } = Typography;

interface LocalAIModelPageProps {}

const LocalAIModelPage: React.FC<LocalAIModelPageProps> = () => {
  return (
    <div className="local-ai-model-page" style={{ 
      padding: '24px',
      background: '#f5f5f5',
      minHeight: '100vh'
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Title level={2} style={{ margin: 0, color: '#1f2937' }}>
              <RobotOutlined style={{ marginRight: 12, color: '#667eea' }} />
              本地AI模型管理
            </Title>
          </Space>
        </div>

        <Card 
          style={{ 
            borderRadius: 12,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
            border: 'none'
          }}
          bodyStyle={{ padding: 0 }}
        >
          <LocalAIModelManagement />
        </Card>
      </div>
    </div>
  );
};

export default LocalAIModelPage;
