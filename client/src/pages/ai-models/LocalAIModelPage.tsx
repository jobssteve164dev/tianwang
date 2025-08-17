import React from 'react';
import { Typography } from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import LocalAIModelManagement from '../../components/settings/LocalAIModelManagement';

const { Title, Paragraph } = Typography;

interface LocalAIModelPageProps {}

const LocalAIModelPage: React.FC<LocalAIModelPageProps> = () => {
  return (
    <div className="fade-in-up">
      <div className="page-header">
        <Title level={2}>
          <RobotOutlined style={{ marginRight: 8 }} />
          本地AI模型管理
        </Title>
        <Paragraph type="secondary">
          管理本地AI模型的训练、监控和测试，支持异常检测、恶意软件检测、网络入侵检测和用户行为分析等模型
        </Paragraph>
      </div>

      <LocalAIModelManagement />
    </div>
  );
};

export default LocalAIModelPage;
