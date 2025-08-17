import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { Spin } from 'antd';

interface NetworkAttackData {
  attackTypes: Array<{
    type: string;
    count: number;
    severity: string;
    lastOccurrence: string;
  }>;
  totalAttacks: number;
  lastUpdated: string;
}

interface NetworkAttackChartProps {
  data: NetworkAttackData | null;
  loading?: boolean;
  height?: number;
  title?: string;
}

const NetworkAttackChart: React.FC<NetworkAttackChartProps> = ({ 
  data, 
  loading = false, 
  height = 200,
  title = '网络攻击统计'
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
      const attackTypes = data.attackTypes || [];
      const categories = attackTypes.map(item => item.type);
      const counts = attackTypes.map(item => item.count);

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

      const colors = attackTypes.map(item => getColor(item.severity));

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
          trigger: 'axis',
          axisPointer: {
            type: 'shadow'
          },
          formatter: (params: any) => {
            const param = params[0];
            const attackType = data.attackTypes.find(item => item.type === param.name);
            return `${param.name}<br/>攻击次数: ${param.value}<br/>严重程度: ${attackType?.severity || 'unknown'}`;
          }
        },
        grid: {
          left: '3%',
          right: '4%',
          bottom: '20%',
          top: 50,
          containLabel: true
        },
        xAxis: {
          type: 'category',
          data: categories,
          axisLabel: {
            fontSize: 10,
            rotate: 45
          },
          axisTick: {
            alignWithLabel: true
          }
        },
        yAxis: {
          type: 'value',
          name: '攻击次数',
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
            name: '攻击次数',
            type: 'bar',
            data: counts.map((count, index) => ({
              value: count,
              itemStyle: {
                color: colors[index]
              }
            })),
            emphasis: {
              focus: 'series'
            },
            itemStyle: {
              borderRadius: [4, 4, 0, 0]
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

  if (!data || !data.attackTypes || data.attackTypes.length === 0) {
    return (
      <div style={{ 
        height, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        color: '#999',
        fontSize: 14
      }}>
        暂无网络攻击数据
      </div>
    );
  }

  return <div ref={chartRef} style={{ width: '100%', height }} />;
};

export default NetworkAttackChart;
