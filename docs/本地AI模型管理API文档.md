# 本地AI模型管理API文档

## 概述

本文档描述了天网网络安全监控系统中本地AI模型管理相关的API接口。这些API提供了模型状态查询、训练控制、数据管理、性能监控和测试等功能。

## 基础信息

- **基础URL**: `/api/system/ai-models`
- **认证方式**: Bearer Token
- **内容类型**: `application/json`
- **字符编码**: UTF-8

## 认证

所有API请求都需要在请求头中包含有效的认证令牌：

```
Authorization: Bearer <your-token>
```

## 通用响应格式

所有API响应都遵循以下格式：

```json
{
  "success": true,
  "message": "操作成功",
  "data": {},
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### 响应字段说明

- `success`: 布尔值，表示操作是否成功
- `message`: 字符串，操作结果描述
- `data`: 对象，返回的数据内容
- `timestamp`: 字符串，响应时间戳

## API接口列表

### 1. 获取模型状态

#### 请求信息

- **方法**: `GET`
- **路径**: `/api/system/ai-models/status`
- **描述**: 获取所有本地AI模型的状态信息

#### 请求参数

无

#### 响应示例

```json
{
  "success": true,
  "message": "获取模型状态成功",
  "data": {
    "models": {
      "anomaly_detection": {
        "status": "trained",
        "accuracy": 0.95,
        "version": "1.0.0",
        "last_trained": "2024-01-01T10:00:00Z",
        "training_samples": 10000,
        "performance_metrics": {
          "precision": 0.94,
          "recall": 0.96,
          "f1_score": 0.95,
          "inference_time": 15.2
        }
      },
      "malware_detection": {
        "status": "untrained",
        "accuracy": 0.0,
        "version": "1.0.0",
        "last_trained": null,
        "training_samples": 0,
        "performance_metrics": {
          "precision": 0.0,
          "recall": 0.0,
          "f1_score": 0.0,
          "inference_time": 0.0
        }
      }
    }
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### 2. 获取特定模型状态

#### 请求信息

- **方法**: `GET`
- **路径**: `/api/system/ai-models/{model_name}/status`
- **描述**: 获取指定模型的状态信息

#### 路径参数

- `model_name`: 模型名称（anomaly_detection, malware_detection, network_intrusion, user_behavior）

#### 响应示例

```json
{
  "success": true,
  "message": "获取模型状态成功",
  "data": {
    "model": {
      "status": "trained",
      "accuracy": 0.95,
      "version": "1.0.0",
      "last_trained": "2024-01-01T10:00:00Z",
      "training_samples": 10000,
      "performance_metrics": {
        "precision": 0.94,
        "recall": 0.96,
        "f1_score": 0.95,
        "inference_time": 15.2
      }
    }
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### 3. 启动模型训练

#### 请求信息

- **方法**: `POST`
- **路径**: `/api/system/ai-models/train`
- **描述**: 启动指定模型的训练任务

#### 请求体

```json
{
  "model_name": "anomaly_detection",
  "training_data": [
    {
      "cpu_usage": 0.8,
      "memory_usage": 0.6,
      "disk_usage": 0.7,
      "network_activity": 0.9,
      "label": 1
    }
  ]
}
```

#### 请求字段说明

- `model_name`: 字符串，模型名称（必需）
- `training_data`: 数组，训练数据（可选，如果不提供将使用已上传的数据）

#### 响应示例

```json
{
  "success": true,
  "message": "训练任务已启动",
  "data": {
    "task_id": "train_1234567890",
    "model_name": "anomaly_detection",
    "training_samples": 1000,
    "estimated_duration": 3600
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### 4. 获取训练状态

#### 请求信息

- **方法**: `GET`
- **路径**: `/api/system/ai-models/training/{task_id}/status`
- **描述**: 获取指定训练任务的状态

#### 路径参数

- `task_id`: 训练任务ID

#### 响应示例

```json
{
  "success": true,
  "message": "获取训练状态成功",
  "data": {
    "training_status": {
      "task_id": "train_1234567890",
      "model_name": "anomaly_detection",
      "status": "running",
      "progress": 65,
      "start_time": "2024-01-01T10:00:00Z",
      "estimated_completion": "2024-01-01T11:00:00Z",
      "training_samples": 1000,
      "current_accuracy": 0.92,
      "current_loss": 0.08
    }
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### 5. 测试模型

#### 请求信息

- **方法**: `POST`
- **路径**: `/api/system/ai-models/test`
- **描述**: 使用指定模型进行推理测试

#### 请求体

```json
{
  "model_name": "anomaly_detection",
  "test_data": {
    "cpu_usage": 0.8,
    "memory_usage": 0.6,
    "disk_usage": 0.7,
    "network_activity": 0.9
  }
}
```

#### 请求字段说明

- `model_name`: 字符串，模型名称（必需）
- `test_data`: 对象，测试数据（必需）

#### 响应示例

```json
{
  "success": true,
  "message": "测试完成",
  "data": {
    "test_result": {
      "is_anomaly": true,
      "confidence": 0.95,
      "score": 0.87
    },
    "inference_time": 15.2,
    "timestamp": "2024-01-01T00:00:00Z"
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### 6. 上传训练数据

#### 请求信息

- **方法**: `POST`
- **路径**: `/api/system/ai-models/training-data`
- **描述**: 上传训练数据

#### 请求体

```json
{
  "model_name": "anomaly_detection",
  "data_type": "anomaly",
  "data": [
    {
      "cpu_usage": 0.8,
      "memory_usage": 0.6,
      "disk_usage": 0.7,
      "network_activity": 0.9,
      "label": 1
    }
  ]
}
```

#### 请求字段说明

- `model_name`: 字符串，模型名称（必需）
- `data_type`: 字符串，数据类型（anomaly, normal, malware, network, behavior）（必需）
- `data`: 数组，训练数据（必需）

#### 响应示例

```json
{
  "success": true,
  "message": "数据上传成功",
  "data": {
    "data_id": "data_1234567890",
    "model_name": "anomaly_detection",
    "data_type": "anomaly",
    "sample_count": 1000,
    "upload_time": "2024-01-01T00:00:00Z"
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### 7. 获取训练数据列表

#### 请求信息

- **方法**: `GET`
- **路径**: `/api/system/ai-models/training-data`
- **描述**: 获取训练数据列表

#### 查询参数

- `model_name`: 字符串，模型名称（可选）
- `page`: 整数，页码（可选，默认1）
- `limit`: 整数，每页数量（可选，默认10）

#### 响应示例

```json
{
  "success": true,
  "message": "获取数据列表成功",
  "data": {
    "data": [
      {
        "id": "data_1234567890",
        "model_name": "anomaly_detection",
        "data_type": "anomaly",
        "sample_count": 1000,
        "upload_time": "2024-01-01T00:00:00Z",
        "status": "uploaded"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 1,
      "pages": 1
    }
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### 8. 删除训练数据

#### 请求信息

- **方法**: `DELETE`
- **路径**: `/api/system/ai-models/training-data/{data_id}`
- **描述**: 删除指定的训练数据

#### 路径参数

- `data_id`: 数据ID

#### 响应示例

```json
{
  "success": true,
  "message": "数据删除成功",
  "data": null,
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### 9. 获取模型性能

#### 请求信息

- **方法**: `GET`
- **路径**: `/api/system/ai-models/performance`
- **描述**: 获取模型性能指标

#### 查询参数

- `model_name`: 字符串，模型名称（可选，不提供则返回所有模型）

#### 响应示例

```json
{
  "success": true,
  "message": "获取性能数据成功",
  "data": {
    "performance_metrics": {
      "anomaly_detection": {
        "accuracy": 0.95,
        "precision": 0.94,
        "recall": 0.96,
        "f1_score": 0.95,
        "inference_time": 15.2,
        "throughput": 65.8,
        "error_rate": 0.05
      }
    }
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### 10. 获取性能历史

#### 请求信息

- **方法**: `GET`
- **路径**: `/api/system/ai-models/performance/history`
- **描述**: 获取模型性能历史数据

#### 查询参数

- `model_name`: 字符串，模型名称（可选）
- `days`: 整数，历史天数（可选，默认7天）

#### 响应示例

```json
{
  "success": true,
  "message": "获取历史数据成功",
  "data": {
    "history_data": {
      "anomaly_detection": [
        {
          "date": "2024-01-01",
          "accuracy": 0.95,
          "precision": 0.94,
          "recall": 0.96,
          "f1_score": 0.95,
          "inference_time": 15.2
        }
      ]
    }
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### 11. 获取系统性能概览

#### 请求信息

- **方法**: `GET`
- **路径**: `/api/system/ai-models/performance/overview`
- **描述**: 获取系统整体性能概览

#### 响应示例

```json
{
  "success": true,
  "message": "获取系统概览成功",
  "data": {
    "system_overview": {
      "total_models": 4,
      "trained_models": 2,
      "average_accuracy": 0.85,
      "average_inference_time": 18.5,
      "total_throughput": 120.5,
      "system_status": "healthy"
    }
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

## 错误码说明

### HTTP状态码

- `200`: 请求成功
- `400`: 请求参数错误
- `401`: 未授权
- `403`: 权限不足
- `404`: 资源不存在
- `500`: 服务器内部错误

### 业务错误码

```json
{
  "success": false,
  "error_code": "MODEL_NOT_FOUND",
  "message": "模型不存在",
  "data": null,
  "timestamp": "2024-01-01T00:00:00Z"
}
```

常见错误码：

- `MODEL_NOT_FOUND`: 模型不存在
- `MODEL_NOT_TRAINED`: 模型未训练
- `TRAINING_FAILED`: 训练失败
- `INVALID_DATA_FORMAT`: 数据格式错误
- `INSUFFICIENT_DATA`: 数据不足
- `TASK_NOT_FOUND`: 任务不存在

## 数据格式规范

### 异常检测模型数据格式

```json
{
  "cpu_usage": 0.8,
  "memory_usage": 0.6,
  "disk_usage": 0.7,
  "network_activity": 0.9,
  "label": 1
}
```

### 恶意软件检测模型数据格式

```json
{
  "file_size": 1024000,
  "entropy": 7.8,
  "api_calls": ["CreateFile", "WriteFile", "RegCreateKey"],
  "strings_count": 150,
  "label": 1
}
```

### 网络入侵检测模型数据格式

```json
{
  "src_ip": "192.168.1.100",
  "dst_ip": "10.0.0.1",
  "src_port": 12345,
  "dst_port": 80,
  "protocol": "TCP",
  "packet_size": 1024,
  "label": 1
}
```

### 用户行为分析模型数据格式

```json
{
  "login_time": "2024-01-01T10:00:00Z",
  "operation_type": "file_access",
  "resource_path": "/home/user/documents",
  "session_duration": 3600,
  "label": 1
}
```

## 使用示例

### JavaScript示例

```javascript
// 获取模型状态
const response = await fetch('/api/system/ai-models/status', {
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  }
});

const data = await response.json();
console.log(data.data.models);

// 启动训练
const trainResponse = await fetch('/api/system/ai-models/train', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model_name: 'anomaly_detection',
    training_data: [...]
  })
});

const trainData = await trainResponse.json();
console.log(trainData.data.task_id);
```

### Python示例

```python
import requests

# 获取模型状态
response = requests.get(
    'http://localhost:3000/api/system/ai-models/status',
    headers={
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
)

data = response.json()
print(data['data']['models'])

# 启动训练
train_response = requests.post(
    'http://localhost:3000/api/system/ai-models/train',
    headers={
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    },
    json={
        'model_name': 'anomaly_detection',
        'training_data': [...]
    }
)

train_data = train_response.json()
print(train_data['data']['task_id'])
```

## 更新日志

### v1.0.0 (2024-01-01)
- 初始版本发布
- 支持基本的模型管理API
- 提供训练、测试、数据管理等核心功能

---

*本文档将根据API更新持续维护，请关注最新版本。*
