'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class AIResource extends Model {}

  AIResource.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    resource_id: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: '资源的唯一标识符'
    },
    name: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: '资源名称'
    },
    type: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        isIn: [['model', 'dataset']]
      },
      comment: '资源类型'
    },
    category: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: '资源分类'
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'available',
      validate: {
        isIn: [['available', 'downloading', 'downloaded', 'error']]
      },
      comment: '资源状态'
    },
    local_path: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: '本地存储路径'
    },
    file_size: {
      type: DataTypes.BIGINT,
      allowNull: true,
      comment: '文件大小（字节）'
    },
    downloaded_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '下载完成时间'
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: '其他元数据'
    }
  }, {
    sequelize,
    modelName: 'AIResource',
    tableName: 'ai_resources',
    timestamps: true,
    underscored: true,
    comment: '用于存储本地AI模型和数据集资源的状态',
    indexes: [
      {
        unique: true,
        fields: ['resource_id']
      },
      {
        fields: ['type']
      },
      {
        fields: ['status']
      },
      {
        fields: ['category']
      }
    ]
  });

  return AIResource;
};

