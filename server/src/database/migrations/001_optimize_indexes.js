/**
 * 数据库性能优化迁移脚本
 * Database Performance Optimization Migration
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 为 security_events 表添加优化索引
    await queryInterface.addIndex('security_events', ['device_id', 'created_at'], {
      name: 'idx_security_events_device_time'
    });

    await queryInterface.addIndex('security_events', ['severity', 'status'], {
      name: 'idx_security_events_severity_status'
    });

    await queryInterface.addIndex('security_events', ['event_type', 'created_at'], {
      name: 'idx_security_events_type_time'
    });

    await queryInterface.addIndex('security_events', ['status'], {
      name: 'idx_security_events_status'
    });

    await queryInterface.addIndex('security_events', ['severity'], {
      name: 'idx_security_events_severity'
    });

    await queryInterface.addIndex('security_events', ['event_type'], {
      name: 'idx_security_events_type'
    });

    await queryInterface.addIndex('security_events', ['created_at'], {
      name: 'idx_security_events_created_at'
    });

    // 为 devices 表添加优化索引
    await queryInterface.addIndex('devices', ['organization_id', 'status'], {
      name: 'idx_devices_org_status'
    });

    await queryInterface.addIndex('devices', ['organization_id', 'platform'], {
      name: 'idx_devices_org_platform'
    });

    await queryInterface.addIndex('devices', ['status', 'last_seen_at'], {
      name: 'idx_devices_status_lastseen'
    });

    // 为 users 表添加优化索引
    await queryInterface.addIndex('users', ['email'], {
      name: 'idx_users_email',
      unique: true
    });

    await queryInterface.addIndex('users', ['organization_id', 'role'], {
      name: 'idx_users_org_role'
    });

    // 为 agents 表添加优化索引
    await queryInterface.addIndex('agents', ['device_id', 'status'], {
      name: 'idx_agents_device_status'
    });

    await queryInterface.addIndex('agents', ['agent_id'], {
      name: 'idx_agents_agent_id',
      unique: true
    });

    console.log('✅ 数据库索引优化完成');
  },

  down: async (queryInterface, Sequelize) => {
    // 删除添加的索引
    const indexes = [
      'idx_security_events_device_time',
      'idx_security_events_severity_status',
      'idx_security_events_type_time',
      'idx_security_events_status',
      'idx_security_events_severity',
      'idx_security_events_type',
      'idx_security_events_created_at',
      'idx_devices_org_status',
      'idx_devices_org_platform',
      'idx_devices_status_lastseen',
      'idx_users_email',
      'idx_users_org_role',
      'idx_agents_device_status',
      'idx_agents_agent_id'
    ];

    for (const indexName of indexes) {
      try {
        await queryInterface.removeIndex('security_events', indexName);
      } catch (e) {
        try {
          await queryInterface.removeIndex('devices', indexName);
        } catch (e) {
          try {
            await queryInterface.removeIndex('users', indexName);
          } catch (e) {
            try {
              await queryInterface.removeIndex('agents', indexName);
            } catch (e) {
              console.log(`索引 ${indexName} 不存在或已删除`);
            }
          }
        }
      }
    }

    console.log('✅ 数据库索引回滚完成');
  }
};
