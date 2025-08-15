import React, { useEffect, useState } from 'react';
import { 
  Card, 
  Table, 
  Button, 
  Space, 
  Select, 
  Input,
  Modal,
  Descriptions,
  Badge,
  Tooltip,
  message,
  Statistic,
  Progress,
  Popconfirm,
  Row,
  Col,
  Typography,
  Pagination
} from 'antd';
import { 
  SearchOutlined, 
  ReloadOutlined, 
  EyeOutlined,
  DesktopOutlined,
  WindowsOutlined,
  AppleOutlined,
  DeleteOutlined,
  LaptopOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { 
  fetchDevices, 
  fetchDeviceStats,
  deleteDevice,
  setFilters, 
  setSelectedDevice, 
  clearError,
  setPagination
} from '../../store/slices/deviceSlice';
import type { Device } from '../../store/slices/deviceSlice';
import { useResponsive } from '../../utils/responsive';
import dayjs from 'dayjs';

const { Title, Paragraph } = Typography;
const { Option } = Select;
const { confirm } = Modal;

const DevicesPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { 
    devices, 
    loading, 
    error, 
    selectedDevice, 
    filters, 
    pagination,
    stats 
  } = useAppSelector((state) => state.device as any);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const { isMobile } = useResponsive();

  useEffect(() => {
    // 加载设备列表和统计信息
    dispatch(fetchDevices({ page: 1, limit: 20 }) as any);
    dispatch(fetchDeviceStats() as any);
  }, [dispatch]);

  useEffect(() => {
    if (error) {
      message.error(error);
      dispatch(clearError());
    }
  }, [error, dispatch]);

  const handleRefresh = () => {
    dispatch(fetchDevices({ 
      page: pagination.page, 
      limit: pagination.limit,
      ...filters 
    }) as any);
    dispatch(fetchDeviceStats() as any);
  };

  const handleFilterChange = (key: string, value: any) => {
    const newFilters = { ...filters, [key]: value };
    dispatch(setFilters(newFilters));
    dispatch(fetchDevices({ page: 1, limit: pagination.limit, ...newFilters }) as any);
  };

  const handleSearch = () => {
    const newFilters = { ...filters, search: searchText };
    dispatch(setFilters(newFilters));
    dispatch(fetchDevices({ page: 1, limit: pagination.limit, ...newFilters }) as any);
  };

  const handlePageChange = (page: number, pageSize?: number) => {
    const newPagination = { page, limit: pageSize || pagination.limit };
    dispatch(setPagination(newPagination));
    dispatch(fetchDevices({ ...newPagination, ...filters }) as any);
  };

  const handleViewDetail = (device: Device) => {
    dispatch(setSelectedDevice(device));
    setDetailModalVisible(true);
  };

  const handleDelete = (device: Device) => {
    confirm({
      title: '确认删除设备',
      icon: <ExclamationCircleOutlined />,
      content: `确定要删除设备 "${device.name}" 吗？此操作不可撤销。`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await dispatch(deleteDevice(device.id) as any);
          message.success('设备删除成功');
          // 重新加载数据
          dispatch(fetchDevices({ 
            page: pagination.page, 
            limit: pagination.limit,
            ...filters 
          }) as any);
          dispatch(fetchDeviceStats() as any);
        } catch (error) {
          message.error('删除设备失败');
        }
      },
    });
  };

  // 获取状态颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'success';
      case 'offline':
        return 'default';
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  };

  // 获取状态文本
  const getStatusText = (status: string) => {
    switch (status) {
      case 'online':
        return '在线';
      case 'offline':
        return '离线';
      case 'error':
        return '异常';
      default:
        return status;
    }
  };

  // 获取平台图标
  const getPlatformIcon = (platform: string) => {
    switch (platform?.toLowerCase()) {
      case 'windows':
        return <WindowsOutlined style={{ color: '#0078d4' }} />;
      case 'linux':
        return <DesktopOutlined style={{ color: '#fcc624' }} />;
      case 'macos':
        return <AppleOutlined style={{ color: '#000000' }} />;
      default:
        return <LaptopOutlined style={{ color: '#8c8c8c' }} />;
    }
  };

  // 表格列配置
  const columns = [
    {
      title: '设备名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: Device) => (
        <div>
          <div style={{ fontWeight: 500 }}>{text || record.hostname}</div>
          <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
            {record.hostname}
          </div>
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Badge 
          status={getStatusColor(status) as any} 
          text={getStatusText(status)} 
        />
      ),
    },
    {
      title: '类型',
      dataIndex: 'platform',
      key: 'platform',
      render: (platform: string) => (
        <Space>
          {getPlatformIcon(platform)}
          <span style={{ textTransform: 'capitalize' }}>
            {platform || '未知'}
          </span>
        </Space>
      ),
    },
    {
      title: 'IP地址',
      dataIndex: 'ip_address',
      key: 'ip_address',
      render: (ip: string) => ip || 'N/A',
    },
    {
      title: '最后在线',
      dataIndex: 'last_seen_at',
      key: 'last_seen_at',
      render: (date: string) => {
        if (!date) return '从未在线';
        const lastSeen = dayjs(date);
        const now = dayjs();
        const diffMinutes = now.diff(lastSeen, 'minute');
        
        if (diffMinutes < 1) {
          return '刚刚';
        } else if (diffMinutes < 60) {
          return `${diffMinutes}分钟前`;
        } else if (diffMinutes < 1440) {
          return `${Math.floor(diffMinutes / 60)}小时前`;
        } else {
          return lastSeen.format('MM-DD HH:mm');
        }
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Device) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handleViewDetail(record)}
              size="small"
            />
          </Tooltip>
          <Tooltip title="删除设备">
            <Popconfirm
              title="确认删除"
              description={`确定要删除设备 "${record.name}" 吗？`}
              onConfirm={() => handleDelete(record)}
              okText="确认"
              cancelText="取消"
            >
              <Button
                type="text"
                icon={<DeleteOutlined />}
                danger
                size="small"
              />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className="fade-in-up">
      <div className="page-header">
        <Title level={2}>
          <LaptopOutlined style={{ marginRight: 8 }} />
          设备管理
        </Title>
        <Paragraph type="secondary">
          管理所有连接的设备，监控设备状态和安全状况
        </Paragraph>
      </div>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: isMobile ? 16 : 20 }}>
        <Col xs={24} sm={12} md={12} lg={6} xl={6}>
          <div className="stat-card">
            <Statistic
              title="总设备数"
              value={stats.total}
              prefix={<DesktopOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ 
                color: '#1890ff', 
                fontSize: isMobile ? 20 : 24, 
                fontWeight: 600 
              }}
            />
          </div>
        </Col>
        
        <Col xs={24} sm={12} md={12} lg={6} xl={6}>
          <div className="stat-card">
            <Statistic
              title="在线设备"
              value={stats.online}
              valueStyle={{ 
                color: '#52c41a', 
                fontSize: isMobile ? 20 : 24, 
                fontWeight: 600 
              }}
            />
            <Progress 
              percent={stats.onlineRate} 
              strokeColor="#52c41a" 
              size="small" 
              style={{ marginTop: 8 }}
              showInfo={false}
            />
          </div>
        </Col>
        
        <Col xs={24} sm={12} md={12} lg={6} xl={6}>
          <div className="stat-card">
            <Statistic
              title="离线设备"
              value={stats.offline}
              valueStyle={{ 
                color: '#8c8c8c', 
                fontSize: isMobile ? 20 : 24, 
                fontWeight: 600 
              }}
            />
          </div>
        </Col>
        
        <Col xs={24} sm={12} md={12} lg={6} xl={6}>
          <div className="stat-card">
            <Statistic
              title="异常设备"
              value={stats.error}
              valueStyle={{ 
                color: '#ff4d4f', 
                fontSize: isMobile ? 20 : 24, 
                fontWeight: 600 
              }}
            />
          </div>
        </Col>
      </Row>

      {/* 搜索和过滤 */}
      <Card 
        variant="outlined"
        className="modern-card"
        styles={{ body: { padding: '16px' } }}
        style={{ marginBottom: 16 }}
      >
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={8} lg={6}>
            <Input
              placeholder="搜索设备名称或IP"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onPressEnter={handleSearch}
              allowClear
            />
          </Col>
          
          <Col xs={12} sm={6} md={4} lg={3}>
            <Select
              placeholder="设备状态"
              value={filters.status}
              onChange={(value) => handleFilterChange('status', value)}
              allowClear
              style={{ width: '100%' }}
            >
              <Option value="online">在线</Option>
              <Option value="offline">离线</Option>
              <Option value="error">异常</Option>
            </Select>
          </Col>
          
          <Col xs={12} sm={6} md={4} lg={3}>
            <Select
              placeholder="设备类型"
              value={filters.platform}
              onChange={(value) => handleFilterChange('platform', value)}
              allowClear
              style={{ width: '100%' }}
            >
              <Option value="windows">Windows</Option>
              <Option value="linux">Linux</Option>
              <Option value="macos">macOS</Option>
              <Option value="openwrt">OpenWrt</Option>
            </Select>
          </Col>
          
          <Col xs={24} sm={12} md={8} lg={12}>
            <Space>
              <Button 
                type="primary" 
                icon={<SearchOutlined />}
                onClick={handleSearch}
              >
                搜索
              </Button>
              <Button 
                icon={<ReloadOutlined />}
                onClick={handleRefresh}
              >
                刷新
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 设备列表 */}
      <Card 
        variant="outlined"
        className="modern-card"
        styles={{ body: { padding: 0 } }}
      >
        <Table
          columns={columns}
          dataSource={devices}
          rowKey="id"
          loading={loading}
          pagination={false}
          size={isMobile ? 'small' : 'middle'}
          scroll={{ x: isMobile ? 800 : undefined }}
        />
        
        {/* 分页 */}
        <div style={{ padding: '16px', textAlign: 'right' }}>
          <Pagination
            current={pagination.page}
            pageSize={pagination.limit}
            total={pagination.total}
            showSizeChanger
            showQuickJumper
            showTotal={(total, range) => 
              `第 ${range[0]}-${range[1]} 条，共 ${total} 条`
            }
            onChange={handlePageChange}
            onShowSizeChange={handlePageChange}
            pageSizeOptions={['10', '20', '50', '100']}
          />
        </div>
      </Card>

      {/* 设备详情模态框 */}
      <Modal
        title="设备详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)} className="modern-button">
            关闭
          </Button>,
        ]}
        width={isMobile ? '95%' : 800}
        className="modern-modal"
      >
        {selectedDevice && (
          <Descriptions 
            column={isMobile ? 1 : 2} 
            bordered 
            size={isMobile ? 'small' : 'middle'}
          >
            <Descriptions.Item label="设备名称">{selectedDevice.name}</Descriptions.Item>
            <Descriptions.Item label="主机名">{selectedDevice.hostname}</Descriptions.Item>
            <Descriptions.Item label="IP地址">{selectedDevice.ip_address}</Descriptions.Item>
            <Descriptions.Item label="MAC地址">{selectedDevice.mac_address}</Descriptions.Item>
            <Descriptions.Item label="设备类型">{selectedDevice.platform}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Badge status={getStatusColor(selectedDevice.status) as any} text={getStatusText(selectedDevice.status)} />
            </Descriptions.Item>
            <Descriptions.Item label="操作系统">{selectedDevice.os}</Descriptions.Item>
            <Descriptions.Item label="架构">{selectedDevice.architecture}</Descriptions.Item>
            <Descriptions.Item label="代理版本">{selectedDevice.agent_version}</Descriptions.Item>
            <Descriptions.Item label="注册时间">
              {selectedDevice.registered_at ? dayjs(selectedDevice.registered_at).format('YYYY-MM-DD HH:mm:ss') : 'N/A'}
            </Descriptions.Item>
            <Descriptions.Item label="最后在线时间">
              {selectedDevice.last_seen_at ? dayjs(selectedDevice.last_seen_at).format('YYYY-MM-DD HH:mm:ss') : '从未在线'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default DevicesPage; 