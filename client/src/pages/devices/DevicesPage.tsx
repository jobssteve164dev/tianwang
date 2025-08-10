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
  Popconfirm
} from 'antd';
import { 
  SearchOutlined, 
  ReloadOutlined, 
  EyeOutlined,
  DesktopOutlined,
  WindowsOutlined,
  AppleOutlined,
  WifiOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { fetchDevices, setFilters, setSelectedDevice, clearError } from '../../store/slices/deviceSlice';
import type { Device } from '../../store/slices/deviceSlice';
import dayjs from 'dayjs';

const { Option } = Select;

const DevicesPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { devices, loading, error, selectedDevice, filters } = useAppSelector((state) => state.device as any);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [searchText, setSearchText] = useState('');

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

  const handleDeviceControl = async (deviceId: string, action: 'start' | 'stop' | 'restart') => {
    try {
      // 这里应该调用API控制设备
      message.success(`设备${action === 'start' ? '启动' : action === 'stop' ? '停止' : '重启'}指令已发送`);
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleDeleteDevice = async () => {
    try {
      // 这里应该调用API删除设备
      message.success('设备已删除');
      dispatch(fetchDevices({}) as any);
    } catch (error) {
      message.error('删除失败');
    }
  };

  const getDeviceTypeIcon = (type: string) => {
    const icons = {
      windows: <WindowsOutlined style={{ color: '#0078d4' }} />,
      linux: <DesktopOutlined style={{ color: '#f57c00' }} />,
      macos: <AppleOutlined style={{ color: '#000' }} />,
      openwrt: <WifiOutlined style={{ color: '#00bcd4' }} />
    };
    return icons[type as keyof typeof icons] || <DesktopOutlined />;
  };

  const getStatusColor = (status: string) => {
    const colors = {
      online: 'success',
      offline: 'default',
      warning: 'warning'
    };
    return colors[status as keyof typeof colors] || 'default';
  };

  const getStatusText = (status: string) => {
    const texts = {
      online: '在线',
      offline: '离线',
      warning: '异常'
    };
    return texts[status as keyof typeof texts] || status;
  };

  // 统计数据
  const stats = {
    total: devices.length,
    online: devices.filter((d: Device) => d.status === 'online').length,
    offline: devices.filter((d: Device) => d.status === 'offline').length,
    warning: devices.filter((d: Device) => d.status === 'warning').length,
  };

  const columns = [
    {
      title: '设备信息',
      dataIndex: 'name',
      key: 'name',
      width: 250,
      render: (text: string, record: Device) => (
        <div>
          <Space>
            {getDeviceTypeIcon(record.type)}
            <div>
              <div style={{ fontWeight: 500, marginBottom: 4 }}>{text}</div>
              <div style={{ fontSize: 12, color: '#666' }}>
                {record.ip} • {record.type.toUpperCase()}
              </div>
            </div>
          </Space>
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Badge 
          status={getStatusColor(status) as any} 
          text={getStatusText(status)}
          className="modern-badge"
        />
      ),
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 120,
    },
    {
      title: '最后在线',
      dataIndex: 'lastSeen',
      key: 'lastSeen',
      width: 160,
      render: (lastSeen: string) => (
        <div>
          <div>{dayjs(lastSeen).format('YYYY-MM-DD')}</div>
          <div style={{ fontSize: 12, color: '#666' }}>
            {dayjs(lastSeen).format('HH:mm:ss')}
          </div>
        </div>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_: any, record: Device) => (
        <Space>
          <Tooltip title="查看详情">
            <Button 
              type="text" 
              size="small" 
              icon={<EyeOutlined />}
              onClick={() => handleViewDetail(record)}
              className="modern-button"
            />
          </Tooltip>
          
          {record.status === 'online' ? (
            <Tooltip title="停止监控">
              <Button 
                type="text" 
                size="small" 
                icon={<PauseCircleOutlined />}
                style={{ color: '#faad14' }}
                onClick={() => handleDeviceControl(record.id, 'stop')}
                className="modern-button"
              />
            </Tooltip>
          ) : (
            <Tooltip title="启动监控">
              <Button 
                type="text" 
                size="small" 
                icon={<PlayCircleOutlined />}
                style={{ color: '#52c41a' }}
                onClick={() => handleDeviceControl(record.id, 'start')}
                className="modern-button"
              />
            </Tooltip>
          )}
          
          <Popconfirm
            title="确定删除此设备？"
            description="删除后将无法恢复设备的历史数据"
            onConfirm={() => handleDeleteDevice()}
            okText="删除"
            cancelText="取消"
            okType="danger"
          >
            <Tooltip title="删除设备">
              <Button 
                type="text" 
                size="small" 
                icon={<DeleteOutlined />}
                danger
                className="modern-button"
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="fade-in-up">
      <h1 style={{ 
        marginBottom: 20, 
        fontSize: 24, 
        fontWeight: 600,
        color: '#fff',
        textShadow: '0 2px 4px rgba(0,0,0,0.3)'
      }}>
        设备管理
      </h1>

      {/* 统计卡片 */}
      <div className="compact-grid mb-20">
        <div className="stat-card">
          <Statistic
            title="总设备数"
            value={stats.total}
            prefix={<DesktopOutlined style={{ color: '#1890ff' }} />}
            valueStyle={{ color: '#1890ff', fontSize: 24, fontWeight: 600 }}
          />
        </div>
        
        <div className="stat-card">
          <Statistic
            title="在线设备"
            value={stats.online}
            valueStyle={{ color: '#52c41a', fontSize: 24, fontWeight: 600 }}
          />
          <Progress 
            percent={stats.total > 0 ? Math.round((stats.online / stats.total) * 100) : 0} 
            strokeColor="#52c41a" 
            size="small" 
            style={{ marginTop: 8 }}
            showInfo={false}
          />
        </div>
        
        <div className="stat-card">
          <Statistic
            title="离线设备"
            value={stats.offline}
            valueStyle={{ color: '#8c8c8c', fontSize: 24, fontWeight: 600 }}
          />
        </div>
        
        <div className="stat-card">
          <Statistic
            title="异常设备"
            value={stats.warning}
            valueStyle={{ color: '#faad14', fontSize: 24, fontWeight: 600 }}
          />
        </div>
      </div>

      {/* 筛选器 */}
      <Card 
        bordered={false} 
        className="modern-card mb-16"
        bodyStyle={{ padding: '16px' }}
      >
        <Space wrap size="small">
          <Input.Search
            placeholder="搜索设备名称或IP"
            allowClear
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onSearch={handleSearch}
            style={{ width: 250 }}
            prefix={<SearchOutlined />}
            className="modern-input"
          />
          
          <Select
            placeholder="设备类型"
            allowClear
            style={{ width: 120 }}
            value={filters.type}
            onChange={(value) => handleFilterChange('type', value)}
            className="modern-select"
          >
            <Option value="windows">Windows</Option>
            <Option value="linux">Linux</Option>
            <Option value="macos">macOS</Option>
            <Option value="openwrt">OpenWrt</Option>
          </Select>
          
          <Select
            placeholder="设备状态"
            allowClear
            style={{ width: 120 }}
            value={filters.status}
            onChange={(value) => handleFilterChange('status', value)}
            className="modern-select"
          >
            <Option value="online">在线</Option>
            <Option value="offline">离线</Option>
            <Option value="warning">异常</Option>
          </Select>
          
          <Button 
            icon={<ReloadOutlined />} 
            onClick={handleRefresh}
            loading={loading}
            className="modern-button"
            type="primary"
          >
            刷新
          </Button>
        </Space>
      </Card>

      {/* 设备列表 */}
      <Card 
        bordered={false}
        className="modern-card"
        bodyStyle={{ padding: 0 }}
      >
        <Table
          columns={columns}
          dataSource={devices}
          loading={loading}
          rowKey="id"
          className="modern-table"
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            style: { padding: '16px' }
          }}
          scroll={{ x: 800 }}
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
        width={800}
        className="modern-modal"
      >
        {selectedDevice && (
          <div>
            <Descriptions column={2} bordered>
              <Descriptions.Item label="设备名称">
                <Space>
                  {getDeviceTypeIcon(selectedDevice.type)}
                  {selectedDevice.name}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="设备类型">
                {selectedDevice.type.toUpperCase()}
              </Descriptions.Item>
              <Descriptions.Item label="IP地址">
                {selectedDevice.ip}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Badge 
                  status={getStatusColor(selectedDevice.status) as any} 
                  text={getStatusText(selectedDevice.status)}
                  className="modern-badge"
                />
              </Descriptions.Item>
              <Descriptions.Item label="客户端版本">
                {selectedDevice.version}
              </Descriptions.Item>
              <Descriptions.Item label="最后在线时间">
                {dayjs(selectedDevice.lastSeen).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label="组织ID">
                {selectedDevice.organizationId}
              </Descriptions.Item>
              <Descriptions.Item label="设备ID">
                {selectedDevice.id}
              </Descriptions.Item>
            </Descriptions>

            {selectedDevice.metadata && Object.keys(selectedDevice.metadata).length > 0 && (
              <div style={{ marginTop: 24 }}>
                <h4>设备元数据</h4>
                <Descriptions column={1} bordered size="small">
                  {Object.entries(selectedDevice.metadata).map(([key, value]) => (
                    <Descriptions.Item key={key} label={key}>
                      {String(value)}
                    </Descriptions.Item>
                  ))}
                </Descriptions>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DevicesPage; 