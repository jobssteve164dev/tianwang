'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ai_resources', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      resource_id: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
        comment: '资源的唯一标识符'
      },
      name: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: '资源名称'
      },
      type: {
        type: Sequelize.ENUM('model', 'dataset'),
        allowNull: false,
        comment: '资源类型'
      },
      category: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: '资源分类'
      },
      status: {
        type: Sequelize.ENUM('available', 'downloading', 'downloaded', 'error'),
        allowNull: false,
        defaultValue: 'available',
        comment: '资源状态'
      },
      local_path: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: '本地存储路径'
      },
      file_size: {
        type: Sequelize.BIGINT,
        allowNull: true,
        comment: '文件大小（字节）'
      },
      downloaded_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: '下载完成时间'
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: '其他元数据'
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('ai_resources');
  }
};
