import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { Spin } from 'antd';

interface ThreatIPData {
  threatIPs: Array<{
    ip: string;
    count: number;
    severity: string;
    lastSeen: string;
  }>;
  totalThreatIPs: number;
  lastUpdated: string;
}

interface ThreatIPChartProps {
  data: ThreatIPData | null;
  loading?: boolean;
  height?: number;
  title?: string;
}

const ThreatIPChart: React.FC<ThreatIPChartProps> = ({ 
  data, 
  loading = false, 
  height = 200,
  title = '威胁IP统计'
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (chartRef.current && !loading && data) {
      // 初始化图表
      if (!chartInstance.current) {
        chartInstance.current = echarts.init(chartRef.current);
      }

      // 处理数据 - 取前10个威胁IP
      const threatIPs = data.threatIPs.slice(0, 10);
      const chartData = threatIPs.map(item => ({
        name: item.ip,
        value: item.count,
        severity: item.severity
      }));

      // 根据严重程度设置颜色
      const getColor = (severity: string) => {
        switch (severity) {
          case 'critical': return '#ff4d4f';
          case 'high': return '#ff7a45';
          case 'medium': return '#faad14';
          case 'low': return '#52c41a';
          default: return '#1890ff';
        }
      };

      // 配置选项
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
            const data = params.data;
            return `${data.name}<br/>威胁次数: ${data.value}<br/>严重程度: ${data.severity}<br/>占比: ${params.percent}%`;
          }
        },
        legend: {
          type: 'scroll',
          orient: 'vertical',
          right: 5,
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
            name: '威胁IP',
            type: 'pie',
            radius: ['35%', '65%'],
            center: ['35%', '50%'],
            avoidLabelOverlap: false,
            itemStyle: {
              borderRadius: 3,
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
                fontSize: 11,
                fontWeight: 'bold'
              }
            },
            labelLine: {
              show: false
            },
            data: chartData.map(item => ({
              ...item,
              itemStyle: {
                color: getColor(item.severity)
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

  if (!data || !data.threatIPs || data.threatIPs.length === 0) {
    return (
      <div style={{ 
        height, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        color: '#999',
        fontSize: 14
      }}>
        暂无威胁IP数据
      </div>
    );
  }

  return <div ref={chartRef} style={{ width: '100%', height }} />;
};

export default ThreatIPChart;
