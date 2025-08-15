# TianWang 安全监控系统架构设计

## 概述

TianWang 采用**分层智能分析架构**，结合本地实时分析和云端深度分析，实现高效、准确的威胁检测与响应。

## 架构层次

### 第一层：代理端（本地分析）

**职责**：
- 实时数据收集
- 基础威胁检测
- 快速响应
- 本地告警

**分析能力**：
```javascript
// 代理端分析规则（轻量级、实时）
const localRules = {
  // 进程监控
  suspiciousProcesses: ['nc', 'netcat', 'nmap', 'masscan'],
  dangerousCommands: ['rm -rf', 'dd if=', 'format'],
  
  // 网络监控
  highPortConnections: { threshold: 49152 },
  connectionFlood: { threshold: 500 },
  
  // 系统监控
  cpuThreshold: 80,
  memoryThreshold: 90,
  temperatureThreshold: 85
};
```

**响应能力**：
- 防火墙自动阻止
- 进程终止
- 本地通知
- 数据上报

### 第二层：服务器端（云端分析）

**职责**：
- 深度威胁分析
- 机器学习检测
- 关联分析
- 全局威胁情报

**分析能力**：
```javascript
// 服务器端分析规则（重量级、深度）
const cloudRules = {
  // 行为分析
  userBehaviorAnalysis: true,
  anomalyDetection: true,
  
  // 关联分析
  crossDeviceAnalysis: true,
  temporalAnalysis: true,
  
  // 威胁情报
  threatIntelligence: true,
  iocMatching: true,
  
  // 机器学习
  mlModels: ['behavior', 'network', 'process']
};
```

## 数据流向

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   监控数据  │    │   威胁告警  │    │   分析结果  │
│   (原始)    │    │   (本地)    │    │   (云端)    │
└─────────────┘    └─────────────┘    └─────────────┘
       │                   │                   │
       ▼                   ▼                   ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   代理端    │    │   代理端    │    │   服务器    │
│   实时分析  │    │   快速响应  │    │   深度分析  │
└─────────────┘    └─────────────┘    └─────────────┘
       │                   │                   │
       ▼                   ▼                   ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   数据上报  │    │   本地告警  │    │   全局告警  │
│   (服务器)  │    │   (界面)    │    │   (客户端)  │
└─────────────┘    └─────────────┘    └─────────────┘
```

## 分析策略

### 1. 实时分析（代理端）

**目标**：快速检测已知威胁模式
**延迟要求**：< 1秒
**准确率要求**：> 90%

**检测项目**：
- 可疑进程启动
- 危险命令执行
- 异常网络连接
- 系统资源异常
- 文件访问异常

### 2. 深度分析（服务器端）

**目标**：发现未知威胁和复杂攻击
**延迟要求**：< 5分钟
**准确率要求**：> 95%

**检测项目**：
- 行为模式分析
- 跨设备关联
- 时间序列分析
- 威胁情报匹配
- 机器学习检测

## 响应策略

### 1. 自动响应（代理端）

**触发条件**：
- 检测到已知威胁
- 系统资源严重异常
- 网络攻击明显

**响应动作**：
- 防火墙阻止IP
- 终止可疑进程
- 隔离受感染设备
- 本地告警通知

### 2. 人工响应（服务器端）

**触发条件**：
- 检测到未知威胁
- 需要人工判断
- 复杂攻击场景

**响应动作**：
- 告警升级
- 人工分析
- 全局策略调整
- 威胁情报更新

## 配置管理

### 代理端配置

```javascript
const agentConfig = {
  // 分析配置
  analysis: {
    enableLocalAnalysis: true,
    enableRealTimeResponse: true,
    analysisInterval: 30, // 秒
  },
  
  // 响应配置
  response: {
    enableAutoBlock: true,
    enableProcessKill: true,
    enableIsolation: false,
  },
  
  // 上报配置
  reporting: {
    enableDataReporting: true,
    enableAlertReporting: true,
    reportInterval: 60, // 秒
  }
};
```

### 服务器端配置

```javascript
const serverConfig = {
  // 分析配置
  analysis: {
    enableDeepAnalysis: true,
    enableMLAnalysis: true,
    enableCorrelation: true,
  },
  
  // 规则配置
  rules: {
    enableThreatIntelligence: true,
    enableCustomRules: true,
    ruleUpdateInterval: 3600, // 秒
  },
  
  // 响应配置
  response: {
    enableGlobalResponse: true,
    enableManualReview: true,
    escalationThreshold: 0.8,
  }
};
```

## 优势

1. **实时性**：本地分析确保快速响应
2. **准确性**：云端分析提供深度检测
3. **可扩展性**：分层架构便于扩展
4. **可靠性**：离线时仍可进行基础防护
5. **智能化**：结合规则和机器学习

## 部署建议

1. **代理端**：轻量级部署，专注于实时检测
2. **服务器端**：高性能部署，专注于深度分析
3. **客户端**：Web界面，专注于告警管理
4. **数据库**：分布式部署，确保数据安全

## 未来扩展

1. **边缘计算**：在网关层增加分析能力
2. **AI增强**：引入更多机器学习模型
3. **威胁情报**：集成更多威胁情报源
4. **自动化响应**：实现更智能的自动响应
