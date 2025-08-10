import React, { useEffect, useState } from 'react';
import { 
  Card, 
  Table, 
  Button, 
  Space, 
  Modal, 
  Form, 
  Input, 
  Select, 
  InputNumber, 
  Tag, 
  Tooltip, 
  message, 
  Popconfirm,
  Row,
  Col,
  Statistic,
  Progress,
  Typography,
  Divider
} from 'antd';
import { 
  PlusOutlined, 
  ReloadOutlined,
  CopyOutlined,
  EyeOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { registrationCodeApi } from '../../services/api';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;
const { Title, Text } = Typography;

interface RegistrationCode {
  code: string;
  status: 'active' | 'expired' | 'disabled' | 'exhausted';
  permissions: string[];
  description: string;
  createdBy: string;
  createdAt: string;
  expiry: number;
  usedCount: number;
  maxUses: number;
  remainingUses: number;
}

interface RegistrationCodeStats {
  total: number;
  active: number;
  expired: number;
  disabled: number;
  used: number;
  unused: number;
}

const RegistrationCodesPage: React.FC = () => {
  const [codes, setCodes] = useState<RegistrationCode[]>([]);
  const [stats, setStats] = useState<RegistrationCodeStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [selectedCode, setSelectedCode] = useState<RegistrationCode | null>(null);

  useEffect(() => {
    fetchCodes();
    fetchStats();
  }, []);

  const fetchCodes = async () => {
    try {
      setLoading(true);
      const response = await registrationCodeApi.getRegistrationCodes();
      if (response.success) {
        setCodes(response.data.codes);
      }
    } catch (error) {
      message.error('获取注册码列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await registrationCodeApi.getRegistrationCodeStats();
      if (response.success) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('获取统计信息失败:', error);
    }
  };

  const handleGenerateCode = async (values: any) => {
    try {
      const response = await registrationCodeApi.generateRegistrationCode({
        count: values.count,
        expiry: values.expiry * 60 * 60 * 1000, // 转换为毫秒
        maxUses: values.maxUses,
        permissions: values.permissions,
        description: values.description
      });

      if (response.success) {
        message.success('注册码生成成功');
        setModalVisible(false);
        form.resetFields();
        fetchCodes();
        fetchStats();
      }
    } catch (error) {
      message.error('生成注册码失败');
    }
  };

  const handleDisableCode = async (code: string) => {
    try {
      const response = await registrationCodeApi.disableRegistrationCode(code);
      if (response.success) {
        message.success('注册码已停用');
        fetchCodes();
        fetchStats();
      }
    } catch (error) {
      message.error('停用注册码失败');
    }
  };

  const handleExtendCode = async (code: string, additionalExpiry: number) => {
    try {
      const response = await registrationCodeApi.extendRegistrationCode(code, additionalExpiry);
      if (response.success) {
        message.success('注册码有效期已延长');
        fetchCodes();
      }
    } catch (error) {
      message.error('延长注册码有效期失败');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      message.success('已复制到剪贴板');
    });
  };

  const getStatusTag = (status: string) => {
    const statusConfig = {
      active: { color: 'green', text: '有效', icon: <CheckCircleOutlined /> },
      expired: { color: 'orange', text: '已过期', icon: <ClockCircleOutlined /> },
      disabled: { color: 'red', text: '已停用', icon: <CloseCircleOutlined /> },
      exhausted: { color: 'purple', text: '已用完', icon: <ExclamationCircleOutlined /> }
    };

    const config = statusConfig[status as keyof typeof statusConfig];
    return (
      <Tag color={config.color} icon={config.icon}>
        {config.text}
      </Tag>
    );
  };

  const columns = [
    {
      title: '注册码',
      dataIndex: 'code',
      key: 'code',
      width: 200,
      render: (code: string) => (
        <Space>
          <Text code style={{ fontSize: 12 }}>{code}</Text>
          <Tooltip title="复制注册码">
            <Button 
              type="text" 
              size="small" 
              icon={<CopyOutlined />}
              onClick={() => copyToClipboard(code)}
            />
          </Tooltip>
        </Space>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => getStatusTag(status)
    },
    {
      title: '权限',
      dataIndex: 'permissions',
      key: 'permissions',
      width: 150,
      render: (permissions: string[]) => (
        <Space wrap>
          {permissions.map(perm => (
            <Tag key={perm} color="blue">{perm}</Tag>
          ))}
        </Space>
      )
    },
    {
      title: '使用情况',
      key: 'usage',
      width: 120,
      render: (_: any, record: RegistrationCode) => (
        <div>
          <Text>{record.usedCount}/{record.maxUses}</Text>
          <Progress 
            percent={record.maxUses > 0 ? (record.usedCount / record.maxUses) * 100 : 0} 
            size="small" 
            showInfo={false}
            strokeColor={record.remainingUses > 0 ? '#52c41a' : '#ff4d4f'}
          />
        </div>
      )
    },
    {
      title: '有效期',
      dataIndex: 'expiry',
      key: 'expiry',
      width: 150,
      render: (expiry: number) => (
        <Text type={Date.now() > expiry ? 'danger' : 'secondary'}>
          {dayjs(expiry).format('YYYY-MM-DD HH:mm')}
        </Text>
      )
    },
    {
      title: '创建者',
      dataIndex: 'createdBy',
      key: 'createdBy',
      width: 100
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (createdAt: string) => dayjs(createdAt).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_: any, record: RegistrationCode) => (
        <Space>
          <Tooltip title="查看详情">
            <Button 
              type="text" 
              size="small" 
              icon={<EyeOutlined />}
              onClick={() => setSelectedCode(record)}
            />
          </Tooltip>
          
          {record.status === 'active' && (
            <Popconfirm
              title="确定停用此注册码？"
              onConfirm={() => handleDisableCode(record.code)}
              okText="停用"
              cancelText="取消"
              okType="danger"
            >
              <Tooltip title="停用注册码">
                <Button 
                  type="text" 
                  size="small" 
                  icon={<CloseCircleOutlined />}
                  danger
                />
              </Tooltip>
            </Popconfirm>
          )}
          
          {record.status === 'active' && (
            <Popconfirm
              title="延长有效期"
              description="延长24小时有效期？"
              onConfirm={() => handleExtendCode(record.code, 24 * 60 * 60 * 1000)}
              okText="延长"
              cancelText="取消"
            >
              <Tooltip title="延长有效期">
                <Button 
                  type="text" 
                  size="small" 
                  icon={<ClockCircleOutlined />}
                />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  return (
    <div className="fade-in-up">
      <Title level={2} style={{ 
        marginBottom: 20, 
        color: '#fff',
        textShadow: '0 2px 4px rgba(0,0,0,0.3)'
      }}>
        注册码管理
      </Title>

      {/* 统计卡片 */}
      {stats && (
        <div className="compact-grid mb-20">
          <div className="stat-card">
            <Statistic
              title="总注册码数"
              value={stats.total}
              prefix={<PlusOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff', fontSize: 24, fontWeight: 600 }}
            />
          </div>
          
          <div className="stat-card">
            <Statistic
              title="有效注册码"
              value={stats.active}
              valueStyle={{ color: '#52c41a', fontSize: 24, fontWeight: 600 }}
            />
            <Progress 
              percent={stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0} 
              strokeColor="#52c41a" 
              size="small" 
              style={{ marginTop: 8 }}
              showInfo={false}
            />
          </div>
          
          <div className="stat-card">
            <Statistic
              title="已使用"
              value={stats.used}
              valueStyle={{ color: '#faad14', fontSize: 24, fontWeight: 600 }}
            />
          </div>
          
          <div className="stat-card">
            <Statistic
              title="已过期"
              value={stats.expired}
              valueStyle={{ color: '#ff4d4f', fontSize: 24, fontWeight: 600 }}
            />
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      <Card 
        variant="outlined"
        className="modern-card mb-16"
        styles={{ body: { padding: '16px' } }}
      >
        <Space>
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={() => setModalVisible(true)}
            className="modern-button"
          >
            生成注册码
          </Button>
          
          <Button 
            icon={<ReloadOutlined />} 
            onClick={fetchCodes}
            loading={loading}
            className="modern-button"
          >
            刷新
          </Button>
        </Space>
      </Card>

      {/* 注册码列表 */}
      <Card 
        variant="outlined"
        className="modern-card"
        styles={{ body: { padding: 0 } }}
      >
        <Table
          columns={columns}
          dataSource={codes}
          loading={loading}
          rowKey="code"
          className="modern-table"
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            style: { padding: '16px' }
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      {/* 生成注册码模态框 */}
      <Modal
        title="生成注册码"
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleGenerateCode}
          initialValues={{
            count: 1,
            expiry: 24,
            maxUses: 1,
            permissions: ['basic']
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="生成数量"
                name="count"
                rules={[{ required: true, message: '请输入生成数量' }]}
              >
                <InputNumber min={1} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="有效期（小时）"
                name="expiry"
                rules={[{ required: true, message: '请输入有效期' }]}
              >
                <InputNumber min={1} max={720} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="最大使用次数"
                name="maxUses"
                rules={[{ required: true, message: '请输入最大使用次数' }]}
              >
                <InputNumber min={1} max={1000} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="权限"
                name="permissions"
                rules={[{ required: true, message: '请选择权限' }]}
              >
                <Select mode="multiple" placeholder="选择权限">
                  <Option value="basic">基础权限</Option>
                  <Option value="admin">管理员权限</Option>
                  <Option value="monitor">监控权限</Option>
                  <Option value="report">报告权限</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="描述"
            name="description"
          >
            <TextArea rows={3} placeholder="可选：添加注册码描述" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                生成注册码
              </Button>
              <Button onClick={() => {
                setModalVisible(false);
                form.resetFields();
              }}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 注册码详情模态框 */}
      <Modal
        title="注册码详情"
        open={!!selectedCode}
        onCancel={() => setSelectedCode(null)}
        footer={null}
        width={600}
      >
        {selectedCode && (
          <div>
            <Row gutter={16}>
              <Col span={12}>
                <Text strong>注册码:</Text>
                <br />
                <Text code style={{ fontSize: 14 }}>{selectedCode.code}</Text>
              </Col>
              <Col span={12}>
                <Text strong>状态:</Text>
                <br />
                {getStatusTag(selectedCode.status)}
              </Col>
            </Row>
            
            <Divider />
            
            <Row gutter={16}>
              <Col span={12}>
                <Text strong>权限:</Text>
                <br />
                <Space wrap style={{ marginTop: 8 }}>
                  {selectedCode.permissions.map(perm => (
                    <Tag key={perm} color="blue">{perm}</Tag>
                  ))}
                </Space>
              </Col>
              <Col span={12}>
                <Text strong>使用情况:</Text>
                <br />
                <Text>{selectedCode.usedCount}/{selectedCode.maxUses}</Text>
              </Col>
            </Row>
            
            <Divider />
            
            <Row gutter={16}>
              <Col span={12}>
                <Text strong>有效期:</Text>
                <br />
                <Text type={Date.now() > selectedCode.expiry ? 'danger' : 'secondary'}>
                  {dayjs(selectedCode.expiry).format('YYYY-MM-DD HH:mm:ss')}
                </Text>
              </Col>
              <Col span={12}>
                <Text strong>创建者:</Text>
                <br />
                <Text>{selectedCode.createdBy}</Text>
              </Col>
            </Row>
            
            <Divider />
            
            <Row>
              <Col span={24}>
                <Text strong>描述:</Text>
                <br />
                <Text>{selectedCode.description || '无描述'}</Text>
              </Col>
            </Row>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default RegistrationCodesPage;
