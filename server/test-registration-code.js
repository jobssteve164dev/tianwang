/**
 * 注册码机制测试脚本
 * Registration Code Mechanism Test Script
 */

const registrationCodeService = require('./src/services/RegistrationCodeService');
const logger = require('./src/utils/logger');

// 模拟数据库连接
const mockModels = {
  RegistrationCode: {
    create: async (data) => {
      console.log('✅ 模拟数据库创建:', data.code);
      return {
        id: 1,
        ...data,
        created_at: new Date(),
        updated_at: new Date()
      };
    },
    findOne: async ({ where }) => {
      console.log('✅ 模拟数据库查询:', where.code);
      // 模拟一个存在的注册码
      return {
        id: 1,
        code: where.code,
        signature: 'mock-signature',
        timestamp: Date.now(),
        expiry: Date.now() + 24 * 60 * 60 * 1000,
        max_uses: 2,
        used_count: 0,
        permissions: ['basic', 'monitoring'],
        description: '测试注册码',
        created_by: 'test-user',
        is_active: true,
        used_by: [],
        created_at: new Date(),
        updated_at: new Date(),
        getRemainingUses: () => 2,
        isExpired: () => false,
        isUsable: () => true,
        incrementUsage: async (agentId, fingerprint) => {
          console.log('✅ 模拟增加使用次数:', { agentId, fingerprint });
          return true;
        },
        disable: async () => {
          console.log('✅ 模拟停用注册码');
          return true;
        },
        extendExpiry: async (additionalTime) => {
          console.log('✅ 模拟延长过期时间:', additionalTime);
          return true;
        }
      };
    },
    findAll: async () => {
      console.log('✅ 模拟数据库查询所有注册码');
      return [];
    },
    count: async () => 1,
    destroy: async () => {
      console.log('✅ 模拟清理过期注册码');
      return [1];
    },
    getStats: async () => ({
      total: 1,
      active: 1,
      expired: 0,
      disabled: 0,
      used: 0,
      unused: 1
    })
  }
};

// 替换models模块
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function(id) {
  if (id === './src/models' || id === '../models') {
    return mockModels;
  }
  return originalRequire.apply(this, arguments);
};

async function testRegistrationCodeMechanism() {
  console.log('🧪 开始测试注册码机制...\n');

  try {
    // 1. 测试生成注册码
    console.log('1. 测试生成注册码...');
    const testCode = await registrationCodeService.generateRegistrationCode({
      expiry: 24 * 60 * 60 * 1000, // 24小时
      maxUses: 2,
      permissions: ['basic', 'monitoring'],
      description: '测试注册码',
      createdBy: 'test-user'
    });
    
    console.log('✅ 注册码生成成功:', {
      code: testCode.code,
      expiry: new Date(testCode.expiry),
      maxUses: testCode.max_uses,
      permissions: testCode.permissions
    });

    // 2. 测试验证注册码
    console.log('\n2. 测试验证注册码...');
    const validation = await registrationCodeService.validateRegistrationCode(testCode.code, {
      agentId: 'test-agent-001',
      hostname: 'test-host',
      platform: 'linux',
      fingerprint: 'test-fingerprint-123'
    });
    
    console.log('✅ 注册码验证结果:', {
      isValid: validation.isValid,
      permissions: validation.permissions,
      remainingUses: validation.remainingUses
    });

    // 3. 测试增加使用次数
    console.log('\n3. 测试增加使用次数...');
    const incrementResult = await registrationCodeService.incrementCodeUsage(
      testCode.code,
      'test-agent-001',
      'test-fingerprint-123'
    );
    
    console.log('✅ 使用次数增加结果:', incrementResult);

    // 4. 测试再次验证（应该显示剩余使用次数减少）
    console.log('\n4. 测试再次验证注册码...');
    const validation2 = await registrationCodeService.validateRegistrationCode(testCode.code, {
      agentId: 'test-agent-002',
      hostname: 'test-host-2',
      platform: 'windows',
      fingerprint: 'test-fingerprint-456'
    });
    
    console.log('✅ 第二次验证结果:', {
      isValid: validation2.isValid,
      permissions: validation2.permissions,
      remainingUses: validation2.remainingUses
    });

    // 5. 测试获取注册码列表
    console.log('\n5. 测试获取注册码列表...');
    const codes = await registrationCodeService.getRegistrationCodes({
      status: 'all',
      limit: 10
    });
    
    console.log('✅ 注册码列表:', {
      count: codes.length,
      codes: codes.map(c => ({
        code: c.code,
        status: c.status,
        usedCount: c.usedCount,
        maxUses: c.maxUses
      }))
    });

    // 6. 测试获取统计信息
    console.log('\n6. 测试获取统计信息...');
    const stats = await registrationCodeService.getRegistrationCodeStats();
    
    console.log('✅ 统计信息:', stats);

    // 7. 测试停用注册码
    console.log('\n7. 测试停用注册码...');
    const disableResult = await registrationCodeService.disableRegistrationCode(testCode.code);
    
    console.log('✅ 停用结果:', disableResult);

    // 8. 测试停用后的验证
    console.log('\n8. 测试停用后的验证...');
    const validation3 = await registrationCodeService.validateRegistrationCode(testCode.code, {
      agentId: 'test-agent-003',
      hostname: 'test-host-3',
      platform: 'darwin',
      fingerprint: 'test-fingerprint-789'
    });
    
    console.log('✅ 停用后验证结果:', {
      isValid: validation3.isValid,
      error: validation3.error,
      code: validation3.code
    });

    console.log('\n🎉 注册码机制测试完成！');

  } catch (error) {
    console.error('❌ 测试失败:', error);
    logger.error('注册码机制测试失败:', error);
  }
}

// 如果直接运行此脚本
console.log('🚀 检查是否直接运行...');
console.log('process.argv[1]:', process.argv[1]);
console.log('module.filename:', module.filename);

if (process.argv[1] === module.filename) {
  console.log('🚀 开始执行测试脚本...');
  testRegistrationCodeMechanism().then(() => {
    console.log('\n✅ 测试脚本执行完成');
    process.exit(0);
  }).catch(error => {
    console.error('\n❌ 测试脚本执行失败:', error);
    console.error('错误详情:', error.stack);
    process.exit(1);
  });
} else {
  console.log('⚠️ 脚本被作为模块导入，不执行测试');
}

module.exports = { testRegistrationCodeMechanism };
