import React from 'react';
import { Card, Empty } from 'antd';

const AlertsPage: React.FC = () => {
  return (
    <div>
      <h1 style={{ marginBottom: 24, fontSize: 24, fontWeight: 600 }}>
        威胁告警管理
      </h1>
      
      <Card bordered={false}>
        <Empty
          description="告警管理功能将在4.2阶段完善"
          style={{ padding: '60px 0' }}
        />
      </Card>
    </div>
  );
};

export default AlertsPage; 