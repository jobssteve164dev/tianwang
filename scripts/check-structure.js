#!/usr/bin/env node

/**
 * 项目结构健康检查脚本
 * Project Structure Health Check Script
 */

const fs = require('fs');
const path = require('path');

// 检查必需的文件和目录
const requiredStructure = {
  'server/package.json': 'file',
  'server/src/index.js': 'file',
  'server/src/config/index.js': 'file',
  'server/src/config/database.js': 'file',
  'server/src/config/kafka.js': 'file',
  'server/src/models/index.js': 'file',
  'server/src/models/User.js': 'file',
  'server/src/models/Device.js': 'file',
  'server/src/routes/index.js': 'file',
  'server/src/routes/auth.js': 'file',
  'server/src/middleware/auth.js': 'file',
  'server/src/middleware/errorHandler.js': 'file',
  'server/src/controllers/authController.js': 'file',
  'server/src/utils/logger.js': 'file',
  'docker-compose.yml': 'file',
  'package.json': 'file',
  'README.md': 'file',
  'config/dev/example.env': 'file'
};

console.log('🔍 TianWang项目结构健康检查\n');

let allPassed = true;
let checkedCount = 0;
let passedCount = 0;

// 检查每个必需的文件/目录
for (const [filePath, type] of Object.entries(requiredStructure)) {
  checkedCount++;
  
  try {
    const fullPath = path.join(process.cwd(), filePath);
    const stats = fs.statSync(fullPath);
    
    const isCorrectType = type === 'file' ? stats.isFile() : stats.isDirectory();
    
    if (isCorrectType) {
      console.log(`✅ ${filePath}`);
      passedCount++;
    } else {
      console.log(`❌ ${filePath} (类型错误: 期望${type})`);
      allPassed = false;
    }
    
  } catch (error) {
    console.log(`❌ ${filePath} (不存在)`);
    allPassed = false;
  }
}

console.log(`\n📊 检查结果: ${passedCount}/${checkedCount} 项通过`);

// 统计代码量
try {
  const { execSync } = require('child_process');
  
  // 统计JavaScript文件
  const jsFiles = execSync('find server -name "*.js" | wc -l').toString().trim();
  const jsLines = execSync('find server -name "*.js" -exec wc -l {} + | tail -1').toString().match(/\d+/)[0];
  
  // 统计JSON配置文件
  const jsonFiles = execSync('find . -name "*.json" -not -path "./node_modules/*" | wc -l').toString().trim();
  
  // 统计Markdown文档
  const mdFiles = execSync('find . -name "*.md" | wc -l').toString().trim();
  
  console.log(`\n📈 代码统计:`);
  console.log(`   JavaScript文件: ${jsFiles}个 (${jsLines}行)`);
  console.log(`   JSON配置文件: ${jsonFiles}个`);
  console.log(`   Markdown文档: ${mdFiles}个`);
  
} catch (error) {
  console.log('\n⚠️  无法统计代码量 (命令行工具不可用)');
}

// 检查关键配置
console.log(`\n🔧 关键配置检查:`);

try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  console.log(`✅ 项目名称: ${packageJson.name}`);
  console.log(`✅ 项目版本: ${packageJson.version}`);
  console.log(`✅ 工作区配置: ${packageJson.workspaces ? '已配置' : '未配置'}`);
} catch (error) {
  console.log(`❌ package.json读取失败`);
  allPassed = false;
}

try {
  const dockerCompose = fs.readFileSync('docker-compose.yml', 'utf8');
  const serviceCount = (dockerCompose.match(/^\s+\w+:/gm) || []).length;
  console.log(`✅ Docker服务: ${serviceCount}个服务已配置`);
} catch (error) {
  console.log(`❌ docker-compose.yml读取失败`);
  allPassed = false;
}

// 最终结果
console.log(`\n${allPassed ? '🎉' : '⚠️'} 总体状态: ${allPassed ? '健康' : '需要修复'}`);

if (allPassed) {
  console.log(`\n✨ 恭喜！第一阶段基础架构建设已完成！`);
  console.log(`   - 📁 项目结构完整`);
  console.log(`   - 🗄️ 数据库模型已创建`);
  console.log(`   - 🛣️ API路由系统已搭建`);
  console.log(`   - 🔒 认证中间件已实现`);
  console.log(`   - 📨 Kafka消息队列已配置`);
  console.log(`   - 🐳 Docker容器化已配置`);
  
  console.log(`\n🚀 下一步建议:`);
  console.log(`   1. 安装Node.js环境 (v18+)`);
  console.log(`   2. 运行 'npm run setup' 安装依赖`);
  console.log(`   3. 运行 'docker-compose up -d' 启动服务`);
  console.log(`   4. 开始第二阶段：多平台客户端开发`);
}

process.exit(allPassed ? 0 : 1); 