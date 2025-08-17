import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Button,
  Space,
  Alert,
  App,
  Table,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  Progress,
  Statistic,
  Typography,
} from 'antd';
import {
  CloudDownloadOutlined,
  DatabaseOutlined,
  RobotOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import { localAIModelApi } from '../../services/api';

const { Text } = Typography;
const { Option } = Select;

interface ModelResourceManagerProps {
  onResourceChange: () => void;
}

interface ResourceItem {
  id: string;
  name: string;
  type: 'model' | 'dataset';
  category: string;
  description: string;
  source: string;
  size: string;
  format: string;
  license: string;
  stars: number;
  downloads: number;
  status: 'available' | 'downloading' | 'downloaded' | 'error';
  downloadProgress?: number;
  localPath?: string;
}

const ModelResourceManager: React.FC<ModelResourceManagerProps> = ({ onResourceChange }) => {
  const { message: messageApi } = App.useApp();
  const [resourceList, setResourceList] = useState<ResourceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloadModalVisible, setDownloadModalVisible] = useState(false);
  const [selectedResource, setSelectedResource] = useState<ResourceItem | null>(null);
  const [downloadForm] = Form.useForm();
  const [downloading, setDownloading] = useState(false);

  // 开源资源列表
  const openSourceResources: ResourceItem[] = [
    {
      id: 'nsl-kdd-dataset',
      name: 'NSL-KDD 网络入侵检测数据集',
      type: 'dataset',
      category: 'network_intrusion',
      description: '网络入侵检测的标准数据集，包含多种攻击类型的标记数据',
      source: 'https://github.com/defcom17/NSL_KDD',
      size: '15.2 MB',
      format: 'CSV',
      license: 'MIT',
      stars: 1200,
      downloads: 8500,
      status: 'available'
    },
    {
      id: 'cicids2017-dataset',
      name: 'CICIDS2017 网络安全数据集',
      type: 'dataset',
      category: 'network_intrusion',
      description: '更新的网络安全数据集，包含现代网络攻击类型',
      source: 'https://github.com/UNB-CIC/CICFlowMeter',
      size: '2.1 GB',
      format: 'CSV',
      license: 'MIT',
      stars: 850,
      downloads: 3200,
      status: 'available'
    },
    {
      id: 'malware-api-class',
      name: '恶意软件API调用分类数据集',
      type: 'dataset',
      category: 'malware_detection',
      description: '基于API调用的恶意软件分类数据集',
      source: 'https://github.com/ocatak/malware_api_class',
      size: '45.6 MB',
      format: 'JSON',
      license: 'MIT',
      stars: 650,
      downloads: 2100,
      status: 'available'
    },
    {
      id: 'anomaly-detection-model',
      name: '异常检测预训练模型',
      type: 'model',
      category: 'anomaly_detection',
      description: '基于Isolation Forest的异常检测模型',
      source: 'https://github.com/scikit-learn/scikit-learn',
      size: '2.3 MB',
      format: 'joblib',
      license: 'BSD-3-Clause',
      stars: 52000,
      downloads: 150000,
      status: 'available'
    },
    {
      id: 'network-intrusion-model',
      name: '网络入侵检测模型',
      type: 'model',
      category: 'network_intrusion',
      description: '基于NSL-KDD训练的深度学习模型',
      source: 'https://github.com/Western-OC2-Lab/OASW-Concept-Drift-Detection-and-Adaptation',
      size: '8.7 MB',
      format: 'h5',
      license: 'MIT',
      stars: 320,
      downloads: 890,
      status: 'available'
    },
    {
      id: 'malware-detection-model',
      name: '恶意软件检测模型',
      type: 'model',
      category: 'malware_detection',
      description: '基于API调用序列的恶意软件检测模型',
      source: 'https://github.com/ocatak/malware_api_class',
      size: '5.1 MB',
      format: 'pickle',
      license: 'MIT',
      stars: 650,
      downloads: 2100,
      status: 'available'
    },
    {
      id: 'user-behavior-dataset',
      name: '用户行为分析数据集',
      type: 'dataset',
      category: 'user_behavior',
      description: '包含用户登录模式、操作序列、时间模式等行为数据',
      source: 'https://github.com/UNB-CIC/CICFlowMeter',
      size: '125.8 MB',
      format: 'CSV',
      license: 'MIT',
      stars: 850,
      downloads: 4200,
      status: 'available'
    },
    {
      id: 'keystroke-dynamics-dataset',
      name: '击键动力学数据集',
      type: 'dataset',
      category: 'user_behavior',
      description: '基于击键时间间隔的用户身份验证数据集',
      source: 'https://github.com/keystroke-dynamics/keystroke-dynamics',
      size: '23.4 MB',
      format: 'JSON',
      license: 'MIT',
      stars: 420,
      downloads: 1800,
      status: 'available'
    },
    {
      id: 'user-behavior-model',
      name: '用户行为分析模型',
      type: 'model',
      category: 'user_behavior',
      description: '基于LSTM的用户行为异常检测模型',
      source: 'https://github.com/keras-team/keras',
      size: '12.3 MB',
      format: 'h5',
      license: 'MIT',
      stars: 58000,
      downloads: 200000,
      status: 'available'
    },
    {
      id: 'behavioral-biometrics-model',
      name: '行为生物识别模型',
      type: 'model',
      category: 'user_behavior',
      description: '基于机器学习的用户行为生物识别模型',
      source: 'https://github.com/scikit-learn/scikit-learn',
      size: '6.8 MB',
      format: 'joblib',
      license: 'BSD-3-Clause',
      stars: 52000,
      downloads: 150000,
      status: 'available'
    }
  ];

  // 加载资源列表
  const loadResourceList = async () => {
    try {
      setLoading(true);
      const response = await localAIModelApi.getResourceList();
      if (response.success) {
        // 合并本地状态和远程状态
        const mergedResources = openSourceResources.map(resource => {
          const localResource = response.data.find((r: any) => r.id === resource.id);
          return {
            ...resource,
            status: localResource?.status || 'available',
            localPath: localResource?.local_path,
            downloadProgress: localResource?.download_progress
          };
        });
        setResourceList(mergedResources);
      } else {
        setResourceList(openSourceResources);
      }
    } catch (error) {
      console.error('加载资源列表失败:', error);
      setResourceList(openSourceResources);
    } finally {
      setLoading(false);
    }
  };

  // 下载资源
  const handleDownloadResource = async (resource: ResourceItem) => {
    setSelectedResource(resource);
    setDownloadModalVisible(true);
    downloadForm.setFieldsValue({
      resource_id: resource.id,
      category: resource.category,
      model_name: resource.type === 'model' ? resource.name.replace(/\s+/g, '_').toLowerCase() : undefined
    });
  };

  // 提交下载
  const handleDownloadSubmit = async () => {
    try {
      const values = await downloadForm.validateFields();
      setDownloading(true);

      const response = await localAIModelApi.downloadResource({
        resource_id: values.resource_id,
        category: values.category,
        model_name: values.model_name
      });

      if (response.success) {
        messageApi.success('资源下载已开始，请稍后查看进度');
        setDownloadModalVisible(false);
        downloadForm.resetFields();
        setSelectedResource(null);
        loadResourceList();
        onResourceChange?.();
      } else {
        messageApi.error(`下载失败: ${response.message}`);
      }
    } catch (error) {
      console.error('下载失败:', error);
      messageApi.error('下载失败，请重试');
    } finally {
      setDownloading(false);
    }
  };

  // 加载模型
  const handleLoadModel = async (resource: ResourceItem) => {
    try {
      if (!resource.localPath) {
        messageApi.error('模型路径不存在');
        return;
      }
      
      const response = await localAIModelApi.loadModel({
        model_path: resource.localPath,
        model_name: resource.name.replace(/\s+/g, '_').toLowerCase(),
        category: resource.category
      });

      if (response.success) {
        messageApi.success('模型加载成功');
        loadResourceList();
        onResourceChange?.();
      } else {
        messageApi.error(`加载失败: ${response.message}`);
      }
    } catch (error) {
      console.error('加载失败:', error);
      messageApi.error('加载失败，请重试');
    }
  };

  // 删除资源
  const handleDeleteResource = async (resource: ResourceItem) => {
    try {
      const response = await localAIModelApi.deleteResource(resource.id);
      if (response.success) {
        messageApi.success('资源删除成功');
        loadResourceList();
        onResourceChange?.();
      } else {
        messageApi.error(`删除失败: ${response.message}`);
      }
    } catch (error) {
      console.error('删除失败:', error);
      messageApi.error('删除失败，请重试');
    }
  };

  useEffect(() => {
    loadResourceList();
  }, []);

  // 表格列定义
  const columns = [
    {
      title: '资源名称',
      dataIndex: 'name',
      key: 'name',
      width: 250,
      render: (text: string, record: ResourceItem) => (
        <div>
          <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
            {record.type === 'model' ? <RobotOutlined style={{ marginRight: 8 }} /> : <DatabaseOutlined style={{ marginRight: 8 }} />}
            {text}
          </div>
          <div style={{ fontSize: '12px', color: '#666', marginTop: 4 }}>
            {record.description}
          </div>
        </div>
      )
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (text: string) => (
        <Tag color={text === 'model' ? 'blue' : 'green'}>
          {text === 'model' ? '模型' : '数据集'}
        </Tag>
      )
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: (text: string) => {
        const categoryMap: { [key: string]: string } = {
          'anomaly_detection': '异常检测',
          'malware_detection': '恶意软件检测',
          'network_intrusion': '网络入侵检测',
          'user_behavior': '用户行为分析'
        };
        return <Tag color="purple">{categoryMap[text] || text}</Tag>;
      }
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      width: 80,
      render: (text: string) => <Text code>{text}</Text>
    },
    {
      title: '格式',
      dataIndex: 'format',
      key: 'format',
      width: 80,
      render: (text: string) => <Text code>{text}</Text>
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (text: string, record: ResourceItem) => {
        const statusMap = {
          'available': { color: 'default', text: '可下载', icon: <InfoCircleOutlined /> },
          'downloading': { color: 'processing', text: '下载中', icon: <ClockCircleOutlined /> },
          'downloaded': { color: 'success', text: '已下载', icon: <CheckCircleOutlined /> },
          'error': { color: 'error', text: '下载失败', icon: <ExclamationCircleOutlined /> }
        };
        const status = statusMap[text as keyof typeof statusMap];
        return (
          <div>
            <Tag color={status.color} icon={status.icon}>
              {status.text}
            </Tag>
            {text === 'downloading' && record.downloadProgress !== undefined && (
              <Progress percent={record.downloadProgress} size="small" style={{ marginTop: 4 }} />
            )}
          </div>
        );
      }
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_: any, record: ResourceItem) => (
        <Space size="small">
          {record.status === 'available' && (
            <Button
              type="primary"
              size="small"
              icon={<CloudDownloadOutlined />}
              onClick={() => handleDownloadResource(record)}
            >
              下载
            </Button>
          )}
          {record.status === 'downloaded' && record.type === 'model' && (
            <Button
              size="small"
              icon={<RobotOutlined />}
              onClick={() => handleLoadModel(record)}
            >
              加载
            </Button>
          )}
          {record.status === 'downloaded' && (
            <Button
              size="small"
              danger
              onClick={() => handleDeleteResource(record)}
            >
              删除
            </Button>
          )}
          <Button
            type="text"
            size="small"
            icon={<LinkOutlined />}
            onClick={() => window.open(record.source, '_blank')}
          >
            源码
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div className="model-resource-manager">
      {/* 说明信息 */}
      <Alert
        message="开源模型和数据集管理"
        description="下载和加载开源的AI模型和数据集，支持NSL-KDD、CICIDS2017等知名网络安全数据集，以及预训练的异常检测、恶意软件检测等模型。"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      {/* 统计信息 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="总资源数"
              value={resourceList.length}
              prefix={<DatabaseOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="模型数量"
              value={resourceList.filter(r => r.type === 'model').length}
              prefix={<RobotOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="数据集数量"
              value={resourceList.filter(r => r.type === 'dataset').length}
              prefix={<DatabaseOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="已下载"
              value={resourceList.filter(r => r.status === 'downloaded').length}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 资源列表 */}
      <Card title="开源资源列表" size="small">
        <Table
          columns={columns}
          dataSource={resourceList}
          rowKey="id"
          size="small"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => 
              `第 ${range[0]}-${range[1]} 条，共 ${total} 条`
          }}
          scroll={{ x: 1200 }}
          loading={loading}
        />
      </Card>

      {/* 下载对话框 */}
      <Modal
        title="下载资源"
        open={downloadModalVisible}
        onOk={handleDownloadSubmit}
        onCancel={() => {
          setDownloadModalVisible(false);
          downloadForm.resetFields();
          setSelectedResource(null);
        }}
        confirmLoading={downloading}
        width={600}
        okText="开始下载"
        cancelText="取消"
      >
        {selectedResource && (
          <div style={{ marginBottom: 16 }}>
            <Alert
              message={`准备下载: ${selectedResource.name}`}
              description={`大小: ${selectedResource.size} | 格式: ${selectedResource.format} | 许可证: ${selectedResource.license}`}
              type="info"
              showIcon
            />
          </div>
        )}

        <Form
          form={downloadForm}
          layout="vertical"
        >
          <Form.Item
            label="资源ID"
            name="resource_id"
            rules={[{ required: true, message: '请选择资源' }]}
          >
            <Input disabled />
          </Form.Item>

          <Form.Item
            label="分类"
            name="category"
            rules={[{ required: true, message: '请选择分类' }]}
          >
            <Select placeholder="请选择模型分类">
              <Option value="anomaly_detection">异常检测</Option>
              <Option value="malware_detection">恶意软件检测</Option>
              <Option value="network_intrusion">网络入侵检测</Option>
              <Option value="user_behavior">用户行为分析</Option>
            </Select>
          </Form.Item>

          {selectedResource?.type === 'model' && (
            <Form.Item
              label="模型名称"
              name="model_name"
              rules={[{ required: true, message: '请输入模型名称' }]}
            >
              <Input placeholder="请输入模型名称（用于加载时识别）" />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default ModelResourceManager;
