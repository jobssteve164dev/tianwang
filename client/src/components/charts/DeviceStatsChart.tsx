import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { Spin } from 'antd';

interface DeviceStatsData {
  name: string;
  online: number;
  offline: number;
  warning: number;
}

interface DeviceStatsChartProps {
  data: DeviceStatsData[];
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
    if (chartRef.current && !loading) {
      // 初始化图表
      if (!chartInstance.current) {
        chartInstance.current = echarts.init(chartRef.current);
      }

      // 处理数据
      const categories = data.map(item => item.name);
      const onlineData = data.map(item => item.online);
      const offlineData = data.map(item => item.offline);
      const warningData = data.map(item => item.warning);

      // 配置选项
      const option: echarts.EChartsOption = {
        title: {
          text: title,
          left: 'center',
          textStyle: {
            fontSize: 16,
            fontWeight: 'normal',
            color: '#333'
          }
        },
        tooltip: {
          trigger: 'axis',
          axisPointer: {
            type: 'shadow'
          },
          formatter: (params: any) => {
            let result = `${params[0].name}<br/>`;
            params.forEach((param: any) => {
              result += `${param.marker}${param.seriesName}: ${param.value}<br/>`;
            });
            return result;
          }
        },
        legend: {
          top: 30,
          itemWidth: 12,
          itemHeight: 12,
          textStyle: {
            fontSize: 12
          }
        },
        grid: {
          left: '3%',
          right: '4%',
          bottom: '3%',
          top: 60,
          containLabel: true
        },
        xAxis: {
          type: 'category',
          data: categories,
          axisLabel: {
            fontSize: 12
          }
        },
        yAxis: {
          type: 'value',
          name: '设备数量',
          nameTextStyle: {
            color: '#666',
            fontSize: 12
          },
          axisLabel: {
            fontSize: 12
          },
          splitLine: {
            lineStyle: {
              color: '#f0f0f0'
            }
          }
        },
        series: [
          {
            name: '在线',
            type: 'bar',
            stack: 'total',
            emphasis: {
              focus: 'series'
            },
            itemStyle: {
              color: '#52c41a'
            },
            data: onlineData
          },
          {
            name: '离线',
            type: 'bar',
            stack: 'total',
            emphasis: {
              focus: 'series'
            },
            itemStyle: {
              color: '#8c8c8c'
            },
            data: offlineData
          },
          {
            name: '异常',
            type: 'bar',
            stack: 'total',
            emphasis: {
              focus: 'series'
            },
            itemStyle: {
              color: '#faad14'
            },
            data: warningData
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

  if (!data || data.length === 0) {
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