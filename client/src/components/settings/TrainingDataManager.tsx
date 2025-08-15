import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Button,
  Space,
  Alert,
  App,
  Statistic,
} from 'antd';
import {
  DownloadOutlined,
  FileTextOutlined,
  DatabaseOutlined,
  CheckCircleOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { localAIModelApi } from '../../services/api';



interface TrainingDataManagerProps {
  onDataChange: () => void;
}

interface TrainingData {
  id: string;
  model_name: string;
  data_type: string;
  sample_count: number;
  upload_time: string;
  status: string;
  metadata: any;
}

const TrainingDataManager: React.FC<TrainingDataManagerProps> = () => {
  const { message: messageApi } = App.useApp();
  const [dataList, setDataList] = useState<TrainingData[]>([]);
  const [loading, setLoading] = useState(false);



  // 加载数据列表
  const loadDataList = async () => {
    try {
      setLoading(true);
      const response = await localAIModelApi.getTrainingDataList();
      if (response.success) {
        setDataList(response.data);
      } else {
        messageApi.error('加载数据列表失败');
      }
    } catch (error) {
      console.error('加载数据列表失败:', error);
      messageApi.error('加载数据列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDataList();
  }, []);



  return (
    <div className="training-data-manager">
      {/* 统计信息 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="总数据量"
              value={dataList.length}
              prefix={<DatabaseOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="总样本数"
              value={dataList.reduce((sum, item) => sum + item.sample_count, 0)}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="已上传"
              value={dataList.filter(item => item.status === 'uploaded').length}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="平均样本数"
              value={dataList.length > 0 ? Math.round(dataList.reduce((sum, item) => sum + item.sample_count, 0) / dataList.length) : 0}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 操作栏 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => messageApi.info('上传功能开发中')}
          >
            上传数据
          </Button>
          <Button
            icon={<DownloadOutlined />}
            onClick={() => messageApi.info('导出功能开发中')}
          >
            导出数据
          </Button>
          <Button
            icon={<FileTextOutlined />}
            onClick={loadDataList}
            loading={loading}
          >
            刷新
          </Button>
        </Space>
      </Card>

      {/* 数据列表 */}
      <Card title="训练数据列表" size="small">
        <Alert
          message="训练数据管理"
          description="上传、管理和查看用于训练AI模型的数据集。支持JSON格式的数据文件。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <FileTextOutlined style={{ fontSize: '48px', color: '#ccc' }} />
          <div style={{ marginTop: 8, color: '#999' }}>
            暂无训练数据
          </div>
          <div style={{ fontSize: '12px', color: '#ccc', marginTop: 4 }}>
            点击&quot;上传数据&quot;按钮开始添加训练数据
          </div>
        </div>
      </Card>
    </div>
  );
};

export default TrainingDataManager;
