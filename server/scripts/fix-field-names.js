#!/usr/bin/env node

/**
 * 批量修复字段名脚本
 * 将驼峰命名改为下划线命名以匹配数据库模型
 */

const fs = require('fs');
const path = require('path');

// 需要修复的字段映射
const fieldMappings = {
  'agentId': 'agent_id',
  'lastSeen': 'last_seen', 
  'registeredAt': 'registered_at',
  'systemInfo': 'system_info',
  'deviceFingerprint': 'device_fingerprint',
  'organizationId': 'organization_id',
  'lastHeartbeat': 'last_heartbeat'
};

// 需要处理的目录
const directories = [
  'src/controllers',
  'src/routes', 
  'src/services',
  'src/models'
];

// 需要处理的文件扩展名
const extensions = ['.js'];

function fixFieldNames(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let replacements = 0;
    
    // 应用字段映射
    for (const [oldField, newField] of Object.entries(fieldMappings)) {
      // 替换对象属性访问
      const objectAccessRegex = new RegExp(`\\.${oldField}\\b`, 'g');
      const objectAccessMatches = content.match(objectAccessRegex);
      if (objectAccessMatches) {
        content = content.replace(objectAccessRegex, `.${newField}`);
        replacements += objectAccessMatches.length;
      }
      
      // 替换变量名（但避免替换字符串中的内容）
      const variableRegex = new RegExp(`\\b${oldField}\\b`, 'g');
      const variableMatches = content.match(variableRegex);
      if (variableMatches) {
        // 更精确的替换，避免替换字符串中的内容
        content = content.replace(variableRegex, (match, offset) => {
          // 检查是否在字符串中
          const before = content.substring(0, offset);
          const quotesBefore = (before.match(/['"`]/g) || []).length;
          const after = content.substring(offset + match.length);
          const quotesAfter = (after.match(/['"`]/g) || []).length;
          
          // 如果引号数量是奇数，说明在字符串中
          if ((quotesBefore + quotesAfter) % 2 === 1) {
            return match; // 不替换字符串中的内容
          }
          return newField;
        });
        replacements += variableMatches.length;
      }
    }
    
    if (replacements > 0) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ ${filePath}: ${replacements} 次替换`);
      return replacements;
    }
    
    return 0;
  } catch (error) {
    console.error(`❌ 处理文件失败 ${filePath}:`, error.message);
    return 0;
  }
}

function processDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    console.log(`⚠️  目录不存在: ${dirPath}`);
    return 0;
  }
  
  let totalReplacements = 0;
  const files = fs.readdirSync(dirPath);
  
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      totalReplacements += processDirectory(filePath);
    } else if (stat.isFile() && extensions.includes(path.extname(file))) {
      totalReplacements += fixFieldNames(filePath);
    }
  }
  
  return totalReplacements;
}

// 主执行函数
function main() {
  console.log('🔧 开始批量修复字段名...\n');
  
  let totalReplacements = 0;
  
  for (const dir of directories) {
    console.log(`📁 处理目录: ${dir}`);
    totalReplacements += processDirectory(dir);
  }
  
  console.log(`\n🎉 修复完成！总共进行了 ${totalReplacements} 次替换`);
  console.log('📋 修复的字段映射:');
  for (const [oldField, newField] of Object.entries(fieldMappings)) {
    console.log(`   ${oldField} → ${newField}`);
  }
}

// 执行脚本
if (require.main === module) {
  main();
}

module.exports = { fixFieldNames, fieldMappings };
