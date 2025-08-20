/**
 * 测试用户管理相关模型
 * Test User Management Models
 */

const { connectDatabases } = require('../src/config/database');
const { initializeModels } = require('../src/models');
const logger = require('../src/utils/logger');

async function testUserManagementModels() {
  console.log('🧪 开始测试用户管理相关模型...');
  
  try {
    // 首先连接数据库
    await connectDatabases();
    
    // 初始化模型
    const { sequelize, models } = initializeModels();
    if (!models) {
      throw new Error('模型初始化失败');
    }
    
    console.log('✅ 模型初始化成功');
    
    // 测试1: 创建测试组织
    console.log('\n📋 测试1: 创建测试组织');
    let testOrg;
    try {
      testOrg = await models.Organization.create({
        name: '测试组织_' + Date.now(),
        slug: 'test-org-' + Date.now(),
        status: 'active',
        plan: 'professional',
        settings: {
          max_users: 100,
          max_devices: 500,
          features: ['ai_detection', 'advanced_analytics']
        }
      });
      console.log('✅ 测试组织创建成功:', testOrg.id);
    } catch (error) {
      if (error.name === 'SequelizeUniqueConstraintError') {
        // 如果组织已存在，查找现有的
        testOrg = await models.Organization.findOne({
          where: { slug: 'test-org' }
        });
        if (!testOrg) {
          testOrg = await models.Organization.findOne({
            where: { name: { [models.sequelize.Op.like]: '测试组织%' } }
          });
        }
        console.log('✅ 使用现有测试组织:', testOrg.id);
      } else {
        throw error;
      }
    }
    
    // 测试2: 创建测试用户
    console.log('\n📋 测试2: 创建测试用户');
    let testUser;
    try {
      testUser = await models.User.create({
        username: 'testuser' + Date.now(),
        email: 'test_' + Date.now() + '@example.com',
        password_hash: '$2a$10$test.hash',
        full_name: '测试用户',
        role: 'admin',
        status: 'active',
        organization_id: testOrg.id,
        preferences: {
          theme: 'dark',
          language: 'zh-CN',
          notifications: {
            email: true,
            push: false
          }
        }
      });
      console.log('✅ 测试用户创建成功:', testUser.id);
    } catch (error) {
      if (error.name === 'SequelizeUniqueConstraintError') {
        // 如果用户已存在，查找现有的
        testUser = await models.User.findOne({
          where: { username: { [models.sequelize.Op.like]: 'testuser%' } }
        });
        console.log('✅ 使用现有测试用户:', testUser.id);
      } else {
        throw error;
      }
    }
    
    // 测试3: 创建用户权限
    console.log('\n📋 测试3: 创建用户权限');
    const userPermission = await models.UserPermission.create({
      user_id: testUser.id,
      resource_type: 'devices',
      action: 'read',
      granted: true,
      conditions: {
        time_restriction: {
          start_time: '09:00',
          end_time: '18:00'
        }
      },
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30天后过期
      created_by: testUser.id
    });
    console.log('✅ 用户权限创建成功:', userPermission.id);
    
    // 测试4: 创建用户会话
    console.log('\n📋 测试4: 创建用户会话');
    const userSession = await models.UserSession.create({
      user_id: testUser.id,
      session_token: 'test-session-token-' + Date.now(),
      refresh_token: 'test-refresh-token-' + Date.now(),
      ip_address: '192.168.1.100',
      user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      device_info: {
        browser: 'Chrome',
        os: 'Windows 10',
        device_type: 'desktop'
      },
      location_info: {
        country: 'CN',
        city: 'Beijing',
        timezone: 'Asia/Shanghai'
      },
      is_active: true,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24小时后过期
    });
    console.log('✅ 用户会话创建成功:', userSession.id);
    
    // 测试5: 创建审计日志
    console.log('\n📋 测试5: 创建审计日志');
    const auditLog = await models.AuditLog.create({
      user_id: testUser.id,
      session_id: userSession.id,
      action: 'login',
      resource_type: 'auth',
      details: {
        login_method: 'password',
        success: true
      },
      ip_address: '192.168.1.100',
      user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      status: 'success',
      risk_level: 'low',
      organization_id: testOrg.id
    });
    console.log('✅ 审计日志创建成功:', auditLog.id);
    
    // 测试6: 创建安全事件
    console.log('\n📋 测试6: 创建安全事件');
    const securityEvent = await models.SecurityEvent.create({
      event_type: 'suspicious_activity',
      severity: 'medium',
      title: '检测到可疑网络活动',
      description: '检测到来自未知IP的可疑连接尝试',
      raw_data: {
        source_ip: '192.168.1.200',
        target_port: 22,
        protocol: 'SSH'
      },
      status: 'open',
      agent_id: 'agent-001',
      source_ip: '192.168.1.200',
      target_ip: '192.168.1.100',
      target_port: 22,
      threat_score: 75.5,
      confidence_score: 85.2,
      tags: ['ssh_brute_force', 'network_attack'],
      investigation_notes: '需要进一步调查此IP地址',
      created_by: testUser.id,
      organization_id: testOrg.id
    });
    console.log('✅ 安全事件创建成功:', securityEvent.id);
    
    // 测试7: 查询关联数据
    console.log('\n📋 测试7: 查询关联数据');
    
    // 查询用户及其权限
    const userWithPermissions = await models.User.findOne({
      where: { id: testUser.id },
      include: [
        {
          model: models.UserPermission,
          as: 'permissions'
        },
        {
          model: models.UserSession,
          as: 'sessions'
        }
      ]
    });
    console.log('✅ 用户权限查询成功，权限数量:', userWithPermissions.permissions?.length || 0);
    console.log('✅ 用户会话查询成功，会话数量:', userWithPermissions.sessions?.length || 0);
    
    // 查询安全事件及其关联数据
    const eventWithDetails = await models.SecurityEvent.findOne({
      where: { id: securityEvent.id },
      include: [
        {
          model: models.User,
          as: 'creator'
        },
        {
          model: models.Organization,
          as: 'organization'
        }
      ]
    });
    console.log('✅ 安全事件详情查询成功，创建者:', eventWithDetails.creator?.username);
    console.log('✅ 安全事件组织查询成功，组织:', eventWithDetails.organization?.name);
    
    // 测试8: 测试索引查询性能
    console.log('\n📋 测试8: 测试索引查询性能');
    
    // 测试用户权限查询
    const startTime1 = Date.now();
    const permissions = await models.UserPermission.findAll({
      where: {
        user_id: testUser.id,
        granted: true
      }
    });
    const queryTime1 = Date.now() - startTime1;
    console.log(`✅ 用户权限查询完成，耗时: ${queryTime1}ms，结果数量: ${permissions.length}`);
    
    // 测试安全事件查询
    const startTime2 = Date.now();
    const events = await models.SecurityEvent.findAll({
      where: {
        organization_id: testOrg.id,
        severity: 'medium'
      },
      order: [['created_at', 'DESC']],
      limit: 10
    });
    const queryTime2 = Date.now() - startTime2;
    console.log(`✅ 安全事件查询完成，耗时: ${queryTime2}ms，结果数量: ${events.length}`);
    
    // 测试审计日志查询
    const startTime3 = Date.now();
    const logs = await models.AuditLog.findAll({
      where: {
        user_id: testUser.id,
        status: 'success'
      },
      order: [['created_at', 'DESC']],
      limit: 10
    });
    const queryTime3 = Date.now() - startTime3;
    console.log(`✅ 审计日志查询完成，耗时: ${queryTime3}ms，结果数量: ${logs.length}`);
    
    // 清理测试数据
    console.log('\n🧹 清理测试数据...');
    await models.AuditLog.destroy({ where: { id: auditLog.id } });
    await models.SecurityEvent.destroy({ where: { id: securityEvent.id } });
    await models.UserSession.destroy({ where: { id: userSession.id } });
    await models.UserPermission.destroy({ where: { id: userPermission.id } });
    await models.User.destroy({ where: { id: testUser.id } });
    await models.Organization.destroy({ where: { id: testOrg.id } });
    console.log('✅ 测试数据清理完成');
    
    console.log('\n🎉 所有用户管理模型测试通过！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    logger.error('用户管理模型测试失败:', error);
    throw error;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  testUserManagementModels()
    .then(() => {
      console.log('✅ 测试完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 测试失败:', error);
      process.exit(1);
    });
}

module.exports = { testUserManagementModels };
