module.exports = {
    // 测试环境
    testEnvironment: 'node',
    
    // 测试文件匹配模式
    testMatch: [
        '**/tests/**/*.test.js',
        '**/tests/**/*.spec.js'
    ],
    
    // 忽略的测试目录
    testPathIgnorePatterns: [
        '/node_modules/',
        '/server/tests/',
        '/agents/tests/',
        '/agents/openwrt/tests/'
    ],
    
    // 覆盖率收集
    collectCoverageFrom: [
        'server/src/**/*.js',
        'agents/src/**/*.js',
        '!**/node_modules/**',
        '!**/tests/**',
        '!**/coverage/**'
    ],
    
    // 覆盖率目录
    coverageDirectory: 'coverage-integration',
    
    // 覆盖率报告格式
    coverageReporters: [
        'text',
        'lcov',
        'html',
        'json-summary'
    ],
    
    // 设置超时时间（集成测试可能需要更长时间）
    testTimeout: 30000,
    
    // 设置文件
    setupFilesAfterEnv: [
        '<rootDir>/tests/setup.js'
    ],
    
    // 模块路径映射
    moduleNameMapping: {
        '^@server/(.*)$': '<rootDir>/server/src/$1',
        '^@agents/(.*)$': '<rootDir>/agents/src/$1'
    },
    
    // 全局变量
    globals: {
        'process.env.NODE_ENV': 'test',
        'process.env.JWT_SECRET': 'test-secret'
    },
    
    // 详细输出
    verbose: true,
    
    // 并行运行测试
    maxWorkers: '50%',
    
    // 强制退出
    forceExit: true,
    
    // 检测打开的句柄
    detectOpenHandles: true
}; 