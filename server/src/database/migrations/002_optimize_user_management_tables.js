/**
 * 数据库迁移：优化用户管理相关表结构
 * Migration: Optimize User Management Tables
 */

'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      console.log('🔄 开始优化用户管理相关表结构...');
      
      // 1. 创建用户权限表
      console.log('📋 创建用户权限表...');
      await queryInterface.createTable('user_permissions', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        user_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'users',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        resource_type: {
          type: Sequelize.ENUM(
            'dashboard', 'devices', 'agents', 'alerts', 'reports', 
            'users', 'organizations', 'system_config', 'threat_rules',
            'security_events', 'ai_models', 'logs', 'analytics'
          ),
          allowNull: false
        },
        resource_id: {
          type: Sequelize.UUID,
          allowNull: true
        },
        action: {
          type: Sequelize.ENUM('create', 'read', 'update', 'delete', 'execute'),
          allowNull: false
        },
        granted: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true
        },
        conditions: {
          type: Sequelize.JSONB,
          allowNull: true
        },
        expires_at: {
          type: Sequelize.DATE,
          allowNull: true
        },
        created_by: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'users',
            key: 'id'
          }
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // 创建用户权限表索引
      await queryInterface.addIndex('user_permissions', ['user_id', 'resource_type', 'resource_id'], {
        name: 'idx_user_permissions_user_resource',
        transaction
      });
      
      await queryInterface.addIndex('user_permissions', ['user_id', 'action', 'granted'], {
        name: 'idx_user_permissions_user_action',
        transaction
      });
      
      await queryInterface.addIndex('user_permissions', ['expires_at'], {
        name: 'idx_user_permissions_expires_at',
        transaction
      });
      
      await queryInterface.addIndex('user_permissions', ['created_by'], {
        name: 'idx_user_permissions_created_by',
        transaction
      });

      // 2. 创建用户会话表
      console.log('📋 创建用户会话表...');
      await queryInterface.createTable('user_sessions', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        user_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'users',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        session_token: {
          type: Sequelize.STRING(255),
          allowNull: false,
          unique: true
        },
        refresh_token: {
          type: Sequelize.STRING(255),
          allowNull: true,
          unique: true
        },
        ip_address: {
          type: Sequelize.INET,
          allowNull: true
        },
        user_agent: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        device_info: {
          type: Sequelize.JSONB,
          allowNull: true
        },
        location_info: {
          type: Sequelize.JSONB,
          allowNull: true
        },
        is_active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true
        },
        last_activity_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        expires_at: {
          type: Sequelize.DATE,
          allowNull: false
        },
        login_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        logout_at: {
          type: Sequelize.DATE,
          allowNull: true
        },
        logout_reason: {
          type: Sequelize.ENUM('user_logout', 'session_expired', 'security_violation', 'admin_terminated'),
          allowNull: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // 创建用户会话表索引
      await queryInterface.addIndex('user_sessions', ['session_token'], {
        name: 'idx_user_sessions_token',
        unique: true,
        transaction
      });
      
      await queryInterface.addIndex('user_sessions', ['refresh_token'], {
        name: 'idx_user_sessions_refresh_token',
        unique: true,
        transaction
      });
      
      await queryInterface.addIndex('user_sessions', ['user_id', 'is_active'], {
        name: 'idx_user_sessions_user_active',
        transaction
      });
      
      await queryInterface.addIndex('user_sessions', ['expires_at'], {
        name: 'idx_user_sessions_expires_at',
        transaction
      });
      
      await queryInterface.addIndex('user_sessions', ['last_activity_at'], {
        name: 'idx_user_sessions_last_activity',
        transaction
      });
      
      await queryInterface.addIndex('user_sessions', ['ip_address'], {
        name: 'idx_user_sessions_ip_address',
        transaction
      });

      // 3. 创建审计日志表
      console.log('📋 创建审计日志表...');
      await queryInterface.createTable('audit_logs', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        user_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'users',
            key: 'id'
          }
        },
        session_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'user_sessions',
            key: 'id'
          }
        },
        action: {
          type: Sequelize.STRING(100),
          allowNull: false
        },
        resource_type: {
          type: Sequelize.STRING(50),
          allowNull: true
        },
        resource_id: {
          type: Sequelize.UUID,
          allowNull: true
        },
        resource_name: {
          type: Sequelize.STRING(255),
          allowNull: true
        },
        details: {
          type: Sequelize.JSONB,
          allowNull: true
        },
        ip_address: {
          type: Sequelize.INET,
          allowNull: true
        },
        user_agent: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        status: {
          type: Sequelize.ENUM('success', 'failure', 'error'),
          allowNull: false,
          defaultValue: 'success'
        },
        error_message: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        risk_level: {
          type: Sequelize.ENUM('low', 'medium', 'high', 'critical'),
          allowNull: false,
          defaultValue: 'low'
        },
        organization_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'organizations',
            key: 'id'
          }
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // 创建审计日志表索引
      await queryInterface.addIndex('audit_logs', ['user_id', 'action', 'created_at'], {
        name: 'idx_audit_logs_user_action',
        transaction
      });
      
      await queryInterface.addIndex('audit_logs', ['resource_type', 'resource_id', 'created_at'], {
        name: 'idx_audit_logs_resource',
        transaction
      });
      
      await queryInterface.addIndex('audit_logs', ['created_at'], {
        name: 'idx_audit_logs_created_at',
        transaction
      });
      
      await queryInterface.addIndex('audit_logs', ['risk_level', 'created_at'], {
        name: 'idx_audit_logs_risk_level',
        transaction
      });
      
      await queryInterface.addIndex('audit_logs', ['status', 'created_at'], {
        name: 'idx_audit_logs_status',
        transaction
      });
      
      await queryInterface.addIndex('audit_logs', ['organization_id', 'created_at'], {
        name: 'idx_audit_logs_organization',
        transaction
      });
      
      await queryInterface.addIndex('audit_logs', ['ip_address', 'created_at'], {
        name: 'idx_audit_logs_ip_address',
        transaction
      });
      
      await queryInterface.addIndex('audit_logs', ['session_id', 'created_at'], {
        name: 'idx_audit_logs_session',
        transaction
      });

      // 4. 优化安全事件表
      console.log('📋 优化安全事件表...');
      
      // 添加新字段
      await queryInterface.addColumn('security_events', 'agent_id', {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: '代理ID，用于快速查询'
      }, { transaction });
      
      await queryInterface.addColumn('security_events', 'source_ip', {
        type: Sequelize.INET,
        allowNull: true,
        comment: '源IP地址'
      }, { transaction });
      
      await queryInterface.addColumn('security_events', 'target_ip', {
        type: Sequelize.INET,
        allowNull: true,
        comment: '目标IP地址'
      }, { transaction });
      
      await queryInterface.addColumn('security_events', 'source_port', {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: '源端口'
      }, { transaction });
      
      await queryInterface.addColumn('security_events', 'target_port', {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: '目标端口'
      }, { transaction });
      
      await queryInterface.addColumn('security_events', 'threat_score', {
        type: Sequelize.FLOAT,
        allowNull: true,
        comment: '威胁评分（0-100）'
      }, { transaction });
      
      await queryInterface.addColumn('security_events', 'confidence_score', {
        type: Sequelize.FLOAT,
        allowNull: true,
        comment: '置信度评分（0-100）'
      }, { transaction });
      
      await queryInterface.addColumn('security_events', 'tags', {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: '事件标签，用于分类和搜索'
      }, { transaction });
      
      await queryInterface.addColumn('security_events', 'investigation_notes', {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: '调查笔记'
      }, { transaction });
      
      await queryInterface.addColumn('security_events', 'resolved_by', {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        comment: '解决此事件的用户'
      }, { transaction });
      
      await queryInterface.addColumn('security_events', 'resolved_at', {
        type: Sequelize.DATE,
        allowNull: true,
        comment: '事件解决时间'
      }, { transaction });
      
      await queryInterface.addColumn('security_events', 'organization_id', {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'organizations',
          key: 'id'
        }
      }, { transaction });

      // 添加新索引
      await queryInterface.addIndex('security_events', ['agent_id', 'created_at'], {
        name: 'idx_security_events_agent_time',
        transaction
      });
      
      await queryInterface.addIndex('security_events', ['organization_id', 'created_at'], {
        name: 'idx_security_events_org_time',
        transaction
      });
      
      await queryInterface.addIndex('security_events', ['threat_score', 'created_at'], {
        name: 'idx_security_events_threat_score',
        transaction
      });
      
      await queryInterface.addIndex('security_events', ['source_ip', 'created_at'], {
        name: 'idx_security_events_source_ip',
        transaction
      });
      
      await queryInterface.addIndex('security_events', ['target_ip', 'created_at'], {
        name: 'idx_security_events_target_ip',
        transaction
      });
      
      await queryInterface.addIndex('security_events', ['resolved_by'], {
        name: 'idx_security_events_resolved_by',
        transaction
      });

      await transaction.commit();
      console.log('✅ 用户管理相关表结构优化完成！');
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ 迁移失败:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      console.log('🔄 回滚用户管理相关表结构变更...');
      
      // 删除安全事件表的新字段和索引
      await queryInterface.removeIndex('security_events', 'idx_security_events_resolved_by', { transaction });
      await queryInterface.removeIndex('security_events', 'idx_security_events_target_ip', { transaction });
      await queryInterface.removeIndex('security_events', 'idx_security_events_source_ip', { transaction });
      await queryInterface.removeIndex('security_events', 'idx_security_events_threat_score', { transaction });
      await queryInterface.removeIndex('security_events', 'idx_security_events_org_time', { transaction });
      await queryInterface.removeIndex('security_events', 'idx_security_events_agent_time', { transaction });
      
      await queryInterface.removeColumn('security_events', 'organization_id', { transaction });
      await queryInterface.removeColumn('security_events', 'resolved_at', { transaction });
      await queryInterface.removeColumn('security_events', 'resolved_by', { transaction });
      await queryInterface.removeColumn('security_events', 'investigation_notes', { transaction });
      await queryInterface.removeColumn('security_events', 'tags', { transaction });
      await queryInterface.removeColumn('security_events', 'confidence_score', { transaction });
      await queryInterface.removeColumn('security_events', 'threat_score', { transaction });
      await queryInterface.removeColumn('security_events', 'target_port', { transaction });
      await queryInterface.removeColumn('security_events', 'source_port', { transaction });
      await queryInterface.removeColumn('security_events', 'target_ip', { transaction });
      await queryInterface.removeColumn('security_events', 'source_ip', { transaction });
      await queryInterface.removeColumn('security_events', 'agent_id', { transaction });
      
      // 删除审计日志表
      await queryInterface.dropTable('audit_logs', { transaction });
      
      // 删除用户会话表
      await queryInterface.dropTable('user_sessions', { transaction });
      
      // 删除用户权限表
      await queryInterface.dropTable('user_permissions', { transaction });
      
      await transaction.commit();
      console.log('✅ 回滚完成！');
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ 回滚失败:', error);
      throw error;
    }
  }
};

