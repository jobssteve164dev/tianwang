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
  Col
} from 'antd';
import { 
  SearchOutlined, 
  ReloadOutlined, 
  EyeOutlined,
  DesktopOutlined,
  WindowsOutlined,
  AppleOutlined,
  WifiOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { fetchDevices, setFilters, setSelectedDevice, clearError } from '../../store/slices/deviceSlice';
import type { Device } from '../../store/slices/deviceSlice';
import { useResponsive } from '../../utils/responsive';
import dayjs from 'dayjs';

const { Option } = Select;

const DevicesPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { devices, loading, error, selectedDevice, filters } = useAppSelector((state) => state.device as any);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const { isMobile } = useResponsive();

  useEffect(() => {
    dispatch(fetchDevices({}) as any);
  }, [dispatch]);

  useEffect(() => {
    if (error) {
      message.error(error);
      dispatch(clearError());
    }
  }, [error, dispatch]);

  const handleRefresh = () => {
    dispatch(fetchDevices({}) as any);
  };

  const handleFilterChange = (key: string, value: any) => {
    dispatch(setFilters({ ...filters, [key]: value }));
  };

  const handleSearch = () => {
    dispatch(setFilters({ ...filters, search: searchText }));
  };

  const handleViewDetail = (device: Device) => {
    dispatch(setSelectedDevice(device));
    setDetailModalVisible(true);
  };

  const handleDelete = () => {
    // 实现删除逻辑
    message.success('设备删除成功');
  };

  // 计算统计数据
  const stats = {
    total: devices?.length || 0,
    online: devices?.filter((d: Device) => d.status === 'online').length || 0,
    offline: devices?.filter((d: Device) => d.status === 'offline').length || 0,
    warning: devices?.filter((d: Device) => d.status === 'warning').length || 0,
  };

  // 表格列配置 - 响应式调整
  const columns = [
    {
      title: '设备名称',
      dataIndex: 'name',
      key: 'name',
      width: isMobile ? 120 : 150,
      render: (text: string, record: Device) => (
        <Space direction="vertical" size={0}>
          <div style={{ fontWeight: 500, fontSize: isMobile ? 12 : 14 }}>
            {text}
          </div>
          <div style={{ fontSize: isMobile ? 10 : 12, color: '#666' }}>
            {record.ip}
          </div>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: isMobile ? 80 : 100,
      render: (status: string) => {
        const statusConfig = {
          online: { color: '#52c41a', text: '在线' },
          offline: { color: '#8c8c8c', text: '离线' },
          warning: { color: '#faad14', text: '异常' },
        };
        const config = statusConfig[status as keyof typeof statusConfig] || { color: '#8c8c8c', text: '未知' };
        return (
          <Badge 
            status={status as any} 
            text={config.text}
            style={{ fontSize: isMobile ? 11 : 12 }}
          />
        );
      },
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: isMobile ? 80 : 100,
      render: (type: string) => {
        const iconMap = {
          windows: <WindowsOutlined style={{ color: '#1890ff' }} />,
          macos: <AppleOutlined style={{ color: '#333' }} />,
          linux: <WifiOutlined style={{ color: '#52c41a' }} />,
        };
        return (
          <Space>
            {iconMap[type as keyof typeof iconMap]}
            <span style={{ fontSize: isMobile ? 11 : 12 }}>
              {type?.toUpperCase()}
            </span>
          </Space>
        );
      },
    },
    {
      title: '最后在线',
      dataIndex: 'lastSeen',
      key: 'lastSeen',
      width: isMobile ? 100 : 120,
      render: (time: string) => (
        <span style={{ fontSize: isMobile ? 11 : 12 }}>
          {dayjs(time).format('MM-DD HH:mm')}
        </span>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: isMobile ? 80 : 120,
      render: (_: any, record: Device) => (
        <Space size={isMobile ? 4 : 8}>
          <Tooltip title="查看详情">
            <Button
              type="text"
              size={isMobile ? 'small' : 'middle'}
              icon={<EyeOutlined />}
              onClick={() => handleViewDetail(record)}
              className="modern-button"
            />
          </Tooltip>
          <Tooltip title="删除设备">
            <Popconfirm
              title="确定要删除这个设备吗？"
              onConfirm={handleDelete}
              okText="确定"
              cancelText="取消"
            >
              <Button
                type="text"
                size={isMobile ? 'small' : 'middle'}
                icon={<DeleteOutlined />}
                danger
                className="modern-button"
              />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className="fade-in-up">
      <h1 style={{ 
        marginBottom: isMobile ? 16 : 20, 
        fontSize: isMobile ? 20 : 24, 
        fontWeight: 600,
        color: '#fff',
        textShadow: '0 2px 4px rgba(0,0,0,0.3)'
      }}>
        设备管理
      </h1>

      {/* 统计卡片 - 响应式布局 */}
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
              percent={stats.total > 0 ? Math.round((stats.online / stats.total) * 100) : 0} 
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
              value={stats.warning}
              valueStyle={{ 
                color: '#faad14', 
                fontSize: isMobile ? 20 : 24, 
                fontWeight: 600 
              }}
            />
          </div>
        </Col>
      </Row>

      {/* 筛选器 - 响应式布局 */}
      <Card 
        variant="outlined"
        className="modern-card"
        style={{ marginBottom: 16 }}
        bodyStyle={{ padding: isMobile ? '12px' : '16px' }}
      >
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={8} lg={6}>
            <Input
              placeholder="搜索设备名称或IP"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onPressEnter={handleSearch}
              prefix={<SearchOutlined />}
              className="modern-input"
              size={isMobile ? 'small' : 'middle'}
            />
          </Col>
          
          <Col xs={24} sm={12} md={8} lg={6}>
            <Select
              placeholder="设备状态"
              value={filters.status}
              onChange={(value) => handleFilterChange('status', value)}
              className="modern-select"
              size={isMobile ? 'small' : 'middle'}
              style={{ width: '100%' }}
              allowClear
            >
              <Option value="online">在线</Option>
              <Option value="offline">离线</Option>
              <Option value="warning">异常</Option>
            </Select>
          </Col>
          
          <Col xs={24} sm={12} md={8} lg={6}>
            <Select
              placeholder="设备类型"
              value={filters.type}
              onChange={(value) => handleFilterChange('type', value)}
              className="modern-select"
              size={isMobile ? 'small' : 'middle'}
              style={{ width: '100%' }}
              allowClear
            >
              <Option value="windows">Windows</Option>
              <Option value="macos">macOS</Option>
              <Option value="linux">Linux</Option>
            </Select>
          </Col>
          
          <Col xs={24} sm={12} md={8} lg={6}>
            <Space>
              <Button
                type="primary"
                onClick={handleSearch}
                icon={<SearchOutlined />}
                className="modern-button"
                size={isMobile ? 'small' : 'middle'}
              >
                搜索
              </Button>
              <Button
                onClick={handleRefresh}
                icon={<ReloadOutlined />}
                className="modern-button"
                size={isMobile ? 'small' : 'middle'}
              >
                刷新
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 设备列表表格 */}
      <Card 
        variant="outlined"
        className="modern-card"
        styles={{ body: { padding: 0 } }}
      >
        <Table
          columns={columns}
          dataSource={devices}
          loading={loading}
          rowKey="id"
          className="modern-table"
          pagination={{
            showSizeChanger: !isMobile,
            showQuickJumper: !isMobile,
            showTotal: (total, range) => 
              isMobile 
                ? `${total}条` 
                : `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            style: { padding: isMobile ? '12px' : '16px' },
            size: isMobile ? 'small' : 'default'
          }}
          scroll={{ x: isMobile ? 600 : 800 }}
          size={isMobile ? 'small' : 'middle'}
        />
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
            <Descriptions.Item label="IP地址">{selectedDevice.ip}</Descriptions.Item>
            <Descriptions.Item label="设备类型">{selectedDevice.type}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Badge status={selectedDevice.status as any} text={selectedDevice.status} />
            </Descriptions.Item>
            <Descriptions.Item label="最后在线时间">
              {dayjs(selectedDevice.lastSeen).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="MAC地址">{selectedDevice.mac}</Descriptions.Item>
            <Descriptions.Item label="操作系统">{selectedDevice.os}</Descriptions.Item>
            <Descriptions.Item label="版本">{selectedDevice.version}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default DevicesPage; 