import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { Spin } from 'antd';

interface ThreatTrendData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    borderColor: string;
    backgroundColor: string;
  }>;
}

interface ThreatTrendChartProps {
  data: ThreatTrendData | null;
  loading?: boolean;
  height?: number;
  title?: string;
}

const ThreatTrendChart: React.FC<ThreatTrendChartProps> = ({ 
  data, 
  loading = false, 
  height = 300,
  title = '威胁趋势分析'
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
      if (!data.labels || !data.datasets) {
        return;
      }
      
      const times = data.labels;
      const series = data.datasets.map(dataset => ({
        name: dataset.label,
        type: 'line' as const,
        smooth: true,
        data: dataset.data,
        lineStyle: {
          width: 2,
          color: dataset.borderColor
        },
        areaStyle: {
          color: dataset.backgroundColor
        },
        emphasis: {
          focus: 'series' as const
        }
      }));

      // 配置选项
      const option: echarts.EChartsOption = {
        title: {
          text: title,
          left: 'center',
          top: 10,
          textStyle: {
            fontSize: 14,
            fontWeight: 'normal',
            color: '#333'
          }
        },
        tooltip: {
          trigger: 'axis',
          axisPointer: {
            type: 'cross',
            label: {
              backgroundColor: '#6a7985'
            }
          }
        },
        legend: {
          data: data.datasets.map(dataset => dataset.label),
          top: 30,
          itemWidth: 12,
          itemHeight: 12,
          textStyle: {
            fontSize: 11
          }
        },
        grid: {
          left: '3%',
          right: '4%',
          bottom: '12%',
          top: '25%',
          containLabel: true
        },
        xAxis: {
          type: 'category',
          boundaryGap: false,
          data: times,
          axisLabel: {
            fontSize: 11,
            formatter: (value: string) => {
              // 格式化日期显示
              const date = new Date(value);
              return `${date.getMonth() + 1}/${date.getDate()}`;
            }
          }
        },
        yAxis: {
          type: 'value',
          name: '威胁数量',
          nameTextStyle: {
            color: '#666',
            fontSize: 11
          },
          axisLabel: {
            fontSize: 11
          },
          splitLine: {
            lineStyle: {
              color: '#f0f0f0'
            }
          }
        },
        series: series
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

  if (!data || !data.labels || !data.datasets) {
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

export default ThreatTrendChart; 