#!/usr/bin/env node

/**
 * 天网安全监控系统 - 日志收集器测试脚本
 * TianWang Security System - Logger Test Script
 */

const DevLogger = require('./dev-logger');
const DevLogTail = require('./dev-log-viewer');

async function testLogger() {
    console.log('🧪 开始测试日志收集器...\n');
    
    // 测试1: 创建日志收集器实例
    console.log('1. 测试创建日志收集器实例...');
    try {
        const logger = new DevLogger();
        console.log('✅ 日志收集器实例创建成功');
        console.log(`   日志文件: ${logger.logFile}`);
        console.log(`   最大行数: ${logger.maxLines.toLocaleString()}`);
    } catch (error) {
        console.log(`❌ 创建日志收集器失败: ${error.message}`);
        return;
    }
    
    // 测试2: 测试日志写入
    console.log('\n2. 测试日志写入功能...');
    try {
        const logger = new DevLogger();
        
        // 写入测试日志
        logger.writeLog('TEST', '这是一条测试日志');
        logger.writeLog('TEST', '这是另一条测试日志');
        logger.writeLog('TEST-ERROR', '这是一条测试错误日志');
        
        console.log('✅ 日志写入测试成功');
        console.log(`   当前行数: ${logger.currentLines}`);
    } catch (error) {
        console.log(`❌ 日志写入测试失败: ${error.message}`);
    }
    
    // 测试3: 测试日志查看器
    console.log('\n3. 测试日志查看器...');
    try {
        const viewer = new DevLogTail();
        
        // 检查日志文件
        if (viewer.checkLogFile()) {
            console.log('✅ 日志文件检查成功');
            
            // 显示统计信息
            const stats = viewer.getLogStats();
            if (stats) {
                console.log(`   总行数: ${stats.totalLines}`);
                console.log(`   文件大小: ${(stats.fileSize / 1024).toFixed(2)} KB`);
            }
        } else {
            console.log('⚠️  日志文件不存在，这是正常的（如果还没有启动开发环境）');
        }
    } catch (error) {
        console.log(`❌ 日志查看器测试失败: ${error.message}`);
    }
    
    // 测试4: 测试日志滚动功能
    console.log('\n4. 测试日志滚动功能...');
    try {
        const logger = new DevLogger();
        
        // 临时设置较小的行数限制进行测试
        const originalMaxLines = logger.maxLines;
        logger.maxLines = 5;
        
        // 写入足够多的日志触发滚动
        for (let i = 1; i <= 10; i++) {
            logger.writeLog('TEST', `测试日志行 ${i}`);
        }
        
        console.log('✅ 日志滚动测试成功');
        console.log(`   当前行数: ${logger.currentLines}`);
        
        // 恢复原始设置
        logger.maxLines = originalMaxLines;
    } catch (error) {
        console.log(`❌ 日志滚动测试失败: ${error.message}`);
    }
    
    console.log('\n🎉 日志收集器测试完成！');
    console.log('\n下一步:');
    console.log('1. 启动开发环境: ./dev-start-with-logger.sh');
    console.log('2. 查看日志: node scripts/dev-log-tail.js');
    console.log('3. 实时监控: node scripts/dev-log-tail.js watch');
}

// 运行测试
if (require.main === module) {
    testLogger().catch(console.error);
}

module.exports = { testLogger };
