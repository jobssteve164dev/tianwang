// 集成测试设置文件
const path = require('path');

// 设置环境变量
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-for-integration-tests';

// 设置测试超时
jest.setTimeout(30000);

// 全局的测试前置和后置处理
beforeAll(async () => {
    console.log('🚀 开始集成测试...');
});

afterAll(async () => {
    console.log('✅ 集成测试完成');
    
    // 强制清理所有定时器和句柄
    if (global.gc) {
        global.gc();
    }
});

// 全局错误处理
process.on('unhandledRejection', (reason, promise) => {
    console.error('未处理的Promise拒绝:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('未捕获的异常:', error);
});

// 抑制一些测试中的警告日志
const originalConsoleWarn = console.warn;
console.warn = (...args) => {
    // 过滤掉一些测试环境中的无关警告
    const message = args.join(' ');
    if (message.includes('Warning: ReactDOM.render is deprecated') ||
        message.includes('Warning: componentWillReceiveProps') ||
        message.includes('MaxListenersExceededWarning')) {
        return;
    }
    originalConsoleWarn.apply(console, args);
};

// 导出一些测试工具函数
global.testUtils = {
    // 等待指定时间
    wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
    
    // 创建测试用的临时目录
    createTempDir: () => {
        const os = require('os');
        const fs = require('fs');
        const tempDir = path.join(os.tmpdir(), `tianwang-test-${Date.now()}`);
        fs.mkdirSync(tempDir, { recursive: true });
        return tempDir;
    },
    
    // 清理测试用的临时目录
    cleanupTempDir: (dir) => {
        const fs = require('fs');
        if (fs.existsSync(dir)) {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    }
}; 