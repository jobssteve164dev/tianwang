import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { Spin } from 'antd';

interface ThreatDistributionData {
  categories: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  total: number;
  lastUpdated: string;
}

interface ThreatDistributionChartProps {
  data: ThreatDistributionData | null;
  loading?: boolean;
  height?: number;
  title?: string;
}

const ThreatDistributionChart: React.FC<ThreatDistributionChartProps> = ({ 
  data, 
  loading = false, 
  height = 300,
  title = '威胁类型分布'
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (chartRef.current && !loading && data) {
      // 初始化图表
      if (!chartInstance.current) {
        chartInstance.current = echarts.init(chartRef.current);
      }

      if (!data.categories) {
        return;
      }

      // 配置选项
      const option: echarts.EChartsOption = {
        title: {
          text: title,
          left: 'center',
          top: 20,
          textStyle: {
            fontSize: 16,
            fontWeight: 'normal',
            color: '#333'
          }
        },
        tooltip: {
          trigger: 'item',
          formatter: '{a} <br/>{b}: {c} ({d}%)'
        },
        legend: {
          orient: 'vertical',
          left: 'left',
          top: 'middle',
          itemWidth: 12,
          itemHeight: 12,
          textStyle: {
            fontSize: 12
          },
          formatter: (name: string) => {
            const item = data.categories.find(d => d.name === name);
            return item ? `${name} (${item.value})` : name;
          }
        },
        series: [
          {
            name: '威胁类型',
            type: 'pie' as const,
            radius: ['40%', '70%'],
            center: ['60%', '50%'],
            avoidLabelOverlap: false,
            data: data.categories.map(category => ({
              name: category.name,
              value: category.value,
              itemStyle: {
                color: category.color
              }
            })),
            itemStyle: {
              borderRadius: 4,
              borderColor: '#fff',
              borderWidth: 2
            },
            label: {
              show: false,
              position: 'center'
            },
            emphasis: {
              label: {
                show: true,
                fontSize: 16,
                fontWeight: 'bold',
                formatter: '{b}\n{d}%'
              },
              itemStyle: {
                shadowBlur: 10,
                shadowOffsetX: 0,
                shadowColor: 'rgba(0, 0, 0, 0.5)'
              }
            },
            labelLine: {
              show: false
            }
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

  if (!data || !data.categories) {
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

export default ThreatDistributionChart; 