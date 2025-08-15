import React, { useEffect, useState } from 'react';
import { 
  Card, 
  Table, 
  Tag, 
  Button, 
  Space, 
  Select, 
  DatePicker, 
  Input,
  Modal,
  Descriptions,
  Badge,
  Tooltip,
  Popconfirm,
  Typography,
  App
} from 'antd';
import { 
  SearchOutlined, 
  ReloadOutlined, 
  CheckCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  AlertOutlined
} from '@ant-design/icons';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { fetchAlerts, setFilters, updateAlertStatus, clearError } from '../../store/slices/alertSlice';
import type { Alert } from '../../store/slices/alertSlice';
import dayjs from 'dayjs';

const { Title, Paragraph } = Typography;

const { Option } = Select;
const { RangePicker } = DatePicker;

const AlertsPage: React.FC = () => {
  const { message } = App.useApp();
  const dispatch = useAppDispatch();
  const { alerts, loading, error, filters, pagination } = useAppSelector((state) => state.alert as any);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    dispatch(fetchAlerts({ ...filters, page: pagination.current, pageSize: pagination.pageSize }) as any);
  }, [dispatch, filters, pagination.current, pagination.pageSize]);

  useEffect(() => {
    if (error) {
      message.error(error);
      dispatch(clearError());
    }
  }, [error, dispatch]);

  const handleRefresh = () => {
    dispatch(fetchAlerts({ ...filters, page: pagination.current, pageSize: pagination.pageSize }) as any);
  };

  const handleFilterChange = (key: string, value: any) => {
    dispatch(setFilters({ ...filters, [key]: value }));
  };

  const handleSearch = () => {
    dispatch(setFilters({ ...filters, search: searchText }));
  };

  const handleStatusChange = async (alertId: string, status: string) => {
    try {
      // 这里应该调用API更新状态
      dispatch(updateAlertStatus({ alertId, status }));
      message.success('告警状态已更新');
    } catch (error) {
      message.error('更新状态失败');
    }
  };

  const handleViewDetail = (alert: Alert) => {
    setSelectedAlert(alert);
    setDetailModalVisible(true);
  };

  const getSeverityColor = (severity: string) => {
    const colors = {
      low: 'green',
      medium: 'orange',
      high: 'red',
      critical: 'purple'
    };
    return colors[severity as keyof typeof colors] || 'default';
  };

  const columns = [
    {
      title: '告警标题',
      dataIndex: 'title',
      key: 'title',
      width: 250,
      render: (text: string, record: Alert) => (
        <div>
          <div style={{ fontWeight: 500, marginBottom: 4 }}>{text}</div>
          <div style={{ fontSize: 12, color: '#666' }}>
            {record.type} • {record.source}
          </div>
        </div>
      ),
    },
    {
      title: '严重级别',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (severity: string) => (
        <Tag color={getSeverityColor(severity)} className="modern-tag">
          {severity.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => (
        <Badge 
          status={status === 'active' ? 'error' : status === 'acknowledged' ? 'warning' : 'success'} 
          text={status === 'active' ? '活跃' : status === 'acknowledged' ? '已确认' : '已解决'}
          className="modern-badge"
        />
      ),
    },
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 160,
      render: (timestamp: string) => (
        <div>
          <div>{dayjs(timestamp).format('YYYY-MM-DD')}</div>
          <div style={{ fontSize: 12, color: '#666' }}>
            {dayjs(timestamp).format('HH:mm:ss')}
          </div>
        </div>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_: any, record: Alert) => (
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
          
          {record.status === 'active' && (
            <Popconfirm
              title="确认此告警？"
              onConfirm={() => handleStatusChange(record.id, 'acknowledged')}
              okText="确认"
              cancelText="取消"
            >
              <Tooltip title="确认告警">
                <Button 
                  type="text" 
                  size="small" 
                  icon={<CheckCircleOutlined />}
                  style={{ color: '#faad14' }}
                  className="modern-button"
                />
              </Tooltip>
            </Popconfirm>
          )}
          
          {(record.status === 'active' || record.status === 'acknowledged') && (
            <Popconfirm
              title="解决此告警？"
              onConfirm={() => handleStatusChange(record.id, 'resolved')}
              okText="解决"
              cancelText="取消"
            >
              <Tooltip title="解决告警">
                <Button 
                  type="text" 
                  size="small" 
                  icon={<CloseCircleOutlined />}
                  style={{ color: '#52c41a' }}
                  className="modern-button"
                />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="fade-in-up">
      <div className="page-header">
        <Title level={2}>
          <AlertOutlined style={{ marginRight: 8 }} />
          威胁告警管理
        </Title>
        <Paragraph type="secondary">
          查看和处理系统安全告警，及时响应安全威胁
        </Paragraph>
      </div>

      {/* 筛选器 */}
      <Card 
        variant="outlined"
        className="modern-card mb-16"
        styles={{ body: { padding: '16px' } }}
      >
        <Space wrap size="small">
          <Input.Search
            placeholder="搜索告警标题或描述"
            allowClear
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onSearch={handleSearch}
            style={{ width: 250 }}
            prefix={<SearchOutlined />}
            className="modern-input"
          />
          
          <Select
            placeholder="严重级别"
            allowClear
            style={{ width: 120 }}
            value={filters.severity}
            onChange={(value) => handleFilterChange('severity', value)}
            className="modern-select"
          >
            <Option value="critical">紧急</Option>
            <Option value="high">高危</Option>
            <Option value="medium">中危</Option>
            <Option value="low">低危</Option>
          </Select>
          
          <Select
            placeholder="状态"
            allowClear
            style={{ width: 120 }}
            value={filters.status}
            onChange={(value) => handleFilterChange('status', value)}
            className="modern-select"
          >
            <Option value="active">活跃</Option>
            <Option value="acknowledged">已确认</Option>
            <Option value="resolved">已解决</Option>
          </Select>
          
          <Select
            placeholder="告警类型"
            allowClear
            style={{ width: 150 }}
            value={filters.type}
            onChange={(value) => handleFilterChange('type', value)}
            className="modern-select"
          >
            <Option value="malware">恶意软件</Option>
            <Option value="intrusion">网络入侵</Option>
            <Option value="anomaly">异常行为</Option>
            <Option value="data_leak">数据泄露</Option>
          </Select>
          
          <RangePicker
            placeholder={['开始时间', '结束时间']}
            onChange={(dates) => handleFilterChange('dateRange', dates)}
            style={{ borderRadius: 8 }}
          />
          
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

      {/* 告警列表 */}
      <Card 
        variant="outlined"
        className="modern-card"
        styles={{ body: { padding: 0 } }}
      >
        <Table
          columns={columns}
          dataSource={alerts}
          loading={loading}
          rowKey="id"
          className="modern-table"
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            style: { padding: '16px' }
          }}
          scroll={{ x: 800 }}
        />
      </Card>

      {/* 告警详情模态框 */}
      <Modal
        title="告警详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)} className="modern-button">
            关闭
          </Button>,
          selectedAlert?.status === 'active' && (
            <Button 
              key="acknowledge" 
              type="default"
              onClick={() => {
                handleStatusChange(selectedAlert.id, 'acknowledged');
                setDetailModalVisible(false);
              }}
              className="modern-button"
            >
              确认告警
            </Button>
          ),
          (selectedAlert?.status === 'active' || selectedAlert?.status === 'acknowledged') && (
            <Button 
              key="resolve" 
              type="primary"
              onClick={() => {
                handleStatusChange(selectedAlert.id, 'resolved');
                setDetailModalVisible(false);
              }}
              className="modern-button"
            >
              解决告警
            </Button>
          ),
        ].filter(Boolean)}
        width={800}
        className="modern-modal"
      >
        {selectedAlert && (
          <Descriptions column={2} bordered>
            <Descriptions.Item label="告警标题" span={2}>
              {selectedAlert.title}
            </Descriptions.Item>
            <Descriptions.Item label="严重级别">
              <Tag color={getSeverityColor(selectedAlert.severity)} className="modern-tag">
                {selectedAlert.severity.toUpperCase()}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Badge 
                status={selectedAlert.status === 'active' ? 'error' : selectedAlert.status === 'acknowledged' ? 'warning' : 'success'} 
                text={selectedAlert.status === 'active' ? '活跃' : selectedAlert.status === 'acknowledged' ? '已确认' : '已解决'}
                className="modern-badge"
              />
            </Descriptions.Item>
            <Descriptions.Item label="告警类型">
              {selectedAlert.type}
            </Descriptions.Item>
            <Descriptions.Item label="来源">
              {selectedAlert.source}
            </Descriptions.Item>
            <Descriptions.Item label="设备ID">
              {selectedAlert.deviceId || '未知'}
            </Descriptions.Item>
            <Descriptions.Item label="发生时间">
              {dayjs(selectedAlert.timestamp).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="详细描述" span={2}>
              <div style={{ whiteSpace: 'pre-wrap' }}>
                {selectedAlert.description}
              </div>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default AlertsPage; 