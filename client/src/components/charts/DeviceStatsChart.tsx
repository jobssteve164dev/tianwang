import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { Spin } from 'antd';

interface DeviceStatsData {
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  protectedDevices: number;
  unprotectedDevices: number;
  deviceTypes: {
    windows: number;
    linux: number;
    macos: number;
    openwrt: number;
  };
  lastUpdated: string;
}

interface DeviceStatsChartProps {
  data: DeviceStatsData | null;
  loading?: boolean;
  height?: number;
  title?: string;
}

const DeviceStatsChart: React.FC<DeviceStatsChartProps> = ({ 
  data, 
  loading = false, 
  height = 200,
  title = '设备状态统计'
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (chartRef.current && !loading && data) {
      // 初始化图表
      if (!chartInstance.current) {
        chartInstance.current = echarts.init(chartRef.current);
      }

      // 处理数据
      const categories = ['Windows', 'Linux', 'macOS', 'OpenWrt'];
      const onlineData = [
        data.deviceTypes.windows,
        data.deviceTypes.linux,
        data.deviceTypes.macos,
        data.deviceTypes.openwrt
      ];

      // 配置选项 - 改为饼图
      const option: echarts.EChartsOption = {
        title: {
          text: title,
          left: 'center',
          textStyle: {
            fontSize: 12,
            fontWeight: 'normal',
            color: '#333'
          }
        },
        tooltip: {
          trigger: 'item',
          formatter: (params: any) => {
            return `${params.name}<br/>设备数量: ${params.value}<br/>占比: ${params.percent}%`;
          }
        },
        legend: {
          type: 'scroll',
          orient: 'vertical',
          right: 8,
          top: 15,
          bottom: 15,
          itemWidth: 10,
          itemHeight: 10,
          textStyle: {
            fontSize: 10
          }
        },
        series: [
          {
            name: '设备类型',
            type: 'pie',
            radius: ['30%', '60%'],
            center: ['35%', '50%'],
            avoidLabelOverlap: false,
            itemStyle: {
              borderRadius: 2,
              borderColor: '#fff',
              borderWidth: 1
            },
            label: {
              show: false,
              position: 'center'
            },
            emphasis: {
              label: {
                show: true,
                fontSize: 10,
                fontWeight: 'bold'
              }
            },
            labelLine: {
              show: false
            },
            data: categories.map((category, index) => ({
              name: category,
              value: onlineData[index],
              itemStyle: {
                color: ['#1890ff', '#52c41a', '#faad14', '#ff4d4f'][index % 4]
              }
            }))
          }
        ]
      };

      // 设置配置
      chartInstance.current.setOption(option);

      // 响应式处理
      const handleResize = () => {
        if (chartInstance.current) {
          chartInstance.current.resize();
        }
      };

      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }
  }, [data, loading, title]);

  useEffect(() => {
    // 组件卸载时销毁图表实例
    return () => {
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, []);

  if (loading) {
    return (
      <div style={{ 
        height, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ 
        height, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        color: '#999',
        fontSize: 14
      }}>
        暂无数据
      </div>
    );
  }

  return <div ref={chartRef} style={{ width: '100%', height }} />;
};

export default DeviceStatsChart; 