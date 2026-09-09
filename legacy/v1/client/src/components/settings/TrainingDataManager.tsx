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
  Modal,
  Form,
  Input,
  Select,
  Upload,
  Table,
  Popconfirm,
  Tag,
} from 'antd';
import {
  DownloadOutlined,
  FileTextOutlined,
  DatabaseOutlined,
  CheckCircleOutlined,
  PlusOutlined,
  UploadOutlined,
  DeleteOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { localAIModelApi } from '../../services/api';

const { Option } = Select;
const { TextArea } = Input;

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

const TrainingDataManager: React.FC<TrainingDataManagerProps> = ({ onDataChange }) => {
  const { message: messageApi } = App.useApp();
  const [dataList, setDataList] = useState<TrainingData[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [uploadForm] = Form.useForm();
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileData, setFileData] = useState<any[]>([]);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedDataDetail, setSelectedDataDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

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

  // 文件上传处理
  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (Array.isArray(data)) {
          setFileData(data);
          setSelectedFile(file);
          messageApi.success(`成功加载 ${data.length} 条训练数据`);
        } else {
          messageApi.error('文件格式错误，请上传JSON数组格式的数据');
        }
      } catch (error) {
        messageApi.error('文件解析失败，请检查JSON格式');
      }
    };
    reader.readAsText(file);
    return false; // 阻止自动上传
  };

  // 提交上传
  const handleUploadSubmit = async () => {
    try {
      const values = await uploadForm.validateFields();
      if (!selectedFile || fileData.length === 0) {
        messageApi.error('请先选择并解析文件');
        return;
      }

      setUploading(true);
      const response = await localAIModelApi.uploadTrainingData({
        model_name: values.model_name,
        data_type: values.data_type,
        data: fileData
      });

      if (response.success) {
        messageApi.success('训练数据上传成功');
        setUploadModalVisible(false);
        uploadForm.resetFields();
        setSelectedFile(null);
        setFileData([]);
        loadDataList();
        onDataChange?.();
      } else {
        messageApi.error(`上传失败: ${response.message}`);
      }
    } catch (error) {
      console.error('上传失败:', error);
      messageApi.error('上传失败，请重试');
    } finally {
      setUploading(false);
    }
  };

  // 导出数据
  const handleExportData = async () => {
    try {
      if (dataList.length === 0) {
        messageApi.warning('暂无数据可导出');
        return;
      }

      // 调用后端导出API
      const response = await localAIModelApi.exportTrainingData();
      
      if (response.success) {
        // 创建并下载文件
        const blob = new Blob([JSON.stringify(response.data, null, 2)], {
          type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `training_data_export_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        messageApi.success('数据导出成功');
      } else {
        messageApi.error(`导出失败: ${response.message}`);
      }
    } catch (error) {
      console.error('导出失败:', error);
      messageApi.error('导出失败，请重试');
    }
  };

  // 删除数据
  const handleDeleteData = async (dataId: string) => {
    try {
      const response = await localAIModelApi.deleteTrainingData(dataId);
      if (response.success) {
        messageApi.success('数据删除成功');
        loadDataList();
        onDataChange?.();
      } else {
        messageApi.error(`删除失败: ${response.message}`);
      }
    } catch (error) {
      console.error('删除失败:', error);
      messageApi.error('删除失败，请重试');
    }
  };

  // 查看数据详情
  const handleViewData = async (dataId: string) => {
    try {
      setDetailLoading(true);
      const response = await localAIModelApi.getTrainingDataDetail(dataId);
      
      if (response.success) {
        setSelectedDataDetail(response.data);
        setDetailModalVisible(true);
      } else {
        messageApi.error(`获取详情失败: ${response.message}`);
      }
    } catch (error) {
      console.error('获取详情失败:', error);
      messageApi.error('获取详情失败，请重试');
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    loadDataList();
  }, []);

  // 表格列定义
  const columns = [
    {
      title: '数据ID',
      dataIndex: 'id',
      key: 'id',
      width: 200,
      render: (text: string) => (
        <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>
          {text.substring(0, 20)}...
        </span>
      )
    },
    {
      title: '模型名称',
      dataIndex: 'model_name',
      key: 'model_name',
      width: 150,
      render: (text: string) => (
        <Tag color="blue">{text}</Tag>
      )
    },
    {
      title: '数据类型',
      dataIndex: 'data_type',
      key: 'data_type',
      width: 120,
      render: (text: string) => (
        <Tag color="green">{text}</Tag>
      )
    },
    {
      title: '样本数量',
      dataIndex: 'sample_count',
      key: 'sample_count',
      width: 100,
      render: (text: number) => (
        <span style={{ fontWeight: 'bold' }}>{text.toLocaleString()}</span>
      )
    },
    {
      title: '上传时间',
      dataIndex: 'upload_time',
      key: 'upload_time',
      width: 180,
      render: (text: string) => (
        <span>{new Date(text).toLocaleString()}</span>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (text: string) => (
        <Tag color={text === 'uploaded' ? 'success' : 'warning'}>
          {text === 'uploaded' ? '已上传' : text}
        </Tag>
      )
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_: any, record: TrainingData) => (
        <Space size="small">
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewData(record.id)}
            title="查看详情"
            loading={detailLoading}
          />
          <Popconfirm
            title="确定要删除这条数据吗？"
            description="删除后无法恢复，请谨慎操作"
            onConfirm={() => handleDeleteData(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              title="删除"
            />
          </Popconfirm>
        </Space>
      )
    }
  ];

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
            onClick={() => setUploadModalVisible(true)}
          >
            上传数据
          </Button>
          <Button
            icon={<DownloadOutlined />}
            onClick={handleExportData}
            disabled={dataList.length === 0}
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
        
        {dataList.length > 0 ? (
          <Table
            columns={columns}
            dataSource={dataList}
            rowKey="id"
            size="small"
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => 
                `第 ${range[0]}-${range[1]} 条，共 ${total} 条`
            }}
            scroll={{ x: 1000 }}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <FileTextOutlined style={{ fontSize: '48px', color: '#ccc' }} />
            <div style={{ marginTop: 8, color: '#999' }}>
              暂无训练数据
            </div>
            <div style={{ fontSize: '12px', color: '#ccc', marginTop: 4 }}>
              点击&quot;上传数据&quot;按钮开始添加训练数据
            </div>
          </div>
        )}
      </Card>

      {/* 上传数据对话框 */}
      <Modal
        title="上传训练数据"
        open={uploadModalVisible}
        onOk={handleUploadSubmit}
        onCancel={() => {
          setUploadModalVisible(false);
          uploadForm.resetFields();
          setSelectedFile(null);
          setFileData([]);
        }}
        confirmLoading={uploading}
        width={600}
        okText="上传"
        cancelText="取消"
      >
        <Form
          form={uploadForm}
          layout="vertical"
          initialValues={{
            model_name: 'anomaly_detection',
            data_type: 'anomaly'
          }}
        >
          <Form.Item
            label="选择模型"
            name="model_name"
            rules={[{ required: true, message: '请选择模型' }]}
          >
            <Select placeholder="请选择要训练的模型">
              <Option value="anomaly_detection">异常检测模型</Option>
              <Option value="malware_detection">恶意软件检测模型</Option>
              <Option value="intrusion_detection">网络入侵检测模型</Option>
              <Option value="behavior_analysis">用户行为分析模型</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="数据类型"
            name="data_type"
            rules={[{ required: true, message: '请选择数据类型' }]}
          >
            <Select placeholder="请选择数据类型">
              <Option value="anomaly">异常数据</Option>
              <Option value="malware">恶意软件数据</Option>
              <Option value="intrusion">入侵数据</Option>
              <Option value="behavior">行为数据</Option>
              <Option value="normal">正常数据</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="上传数据文件"
            required
          >
            <Upload
              beforeUpload={handleFileUpload}
              accept=".json"
              showUploadList={false}
              maxCount={1}
            >
              <Button icon={<UploadOutlined />}>
                选择JSON文件
              </Button>
            </Upload>
            {selectedFile && (
              <div style={{ marginTop: 8 }}>
                <Alert
                  message={`已选择文件: ${selectedFile.name}`}
                  description={`包含 ${fileData.length} 条数据记录`}
                  type="success"
                  showIcon
                />
              </div>
            )}
          </Form.Item>

          <Form.Item
            label="数据预览"
          >
            <TextArea
              rows={4}
              value={fileData.length > 0 ? JSON.stringify(fileData.slice(0, 3), null, 2) + (fileData.length > 3 ? '\n...' : '') : ''}
              placeholder="选择文件后将显示数据预览"
              readOnly
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 数据详情对话框 */}
      <Modal
        title="训练数据详情"
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false);
          setSelectedDataDetail(null);
        }}
        footer={[
          <Button key="close" onClick={() => {
            setDetailModalVisible(false);
            setSelectedDataDetail(null);
          }}>
            关闭
          </Button>
        ]}
        width={800}
      >
        {selectedDataDetail && (
          <div>
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Card size="small" title="基本信息">
                  <p><strong>数据ID:</strong> {selectedDataDetail.id}</p>
                  <p><strong>模型名称:</strong> 
                    <Tag color="blue" style={{ marginLeft: 8 }}>
                      {selectedDataDetail.model_name}
                    </Tag>
                  </p>
                  <p><strong>数据类型:</strong> 
                    <Tag color="green" style={{ marginLeft: 8 }}>
                      {selectedDataDetail.data_type}
                    </Tag>
                  </p>
                  <p><strong>样本数量:</strong> {selectedDataDetail.sample_count.toLocaleString()}</p>
                  <p><strong>上传时间:</strong> {new Date(selectedDataDetail.upload_time).toLocaleString()}</p>
                  <p><strong>状态:</strong> 
                    <Tag color={selectedDataDetail.status === 'uploaded' ? 'success' : 'warning'} style={{ marginLeft: 8 }}>
                      {selectedDataDetail.status === 'uploaded' ? '已上传' : selectedDataDetail.status}
                    </Tag>
                  </p>
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small" title="元数据">
                  <p><strong>格式:</strong> {selectedDataDetail.metadata?.format}</p>
                  <p><strong>版本:</strong> {selectedDataDetail.metadata?.version}</p>
                </Card>
              </Col>
            </Row>
            
            {selectedDataDetail.data_preview && (
              <Card size="small" title="数据预览" style={{ marginTop: 16 }}>
                <TextArea
                  rows={6}
                  value={JSON.stringify(selectedDataDetail.data_preview, null, 2)}
                  readOnly
                />
              </Card>
            )}
            
            {selectedDataDetail.data_quality && (
              <Card size="small" title="数据质量" style={{ marginTop: 16 }}>
                <Row gutter={[16, 16]}>
                  <Col span={6}>
                    <Statistic
                      title="完整性"
                      value={selectedDataDetail.data_quality.completeness * 100}
                      suffix="%"
                      precision={1}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="准确性"
                      value={selectedDataDetail.data_quality.accuracy * 100}
                      suffix="%"
                      precision={1}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="一致性"
                      value={selectedDataDetail.data_quality.consistency * 100}
                      suffix="%"
                      precision={1}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="有效性"
                      value={selectedDataDetail.data_quality.validity * 100}
                      suffix="%"
                      precision={1}
                    />
                  </Col>
                </Row>
              </Card>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TrainingDataManager;
