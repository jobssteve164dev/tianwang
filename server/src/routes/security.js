const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const yaml = require('js-yaml');
const fs = require('fs').promises;
const path = require('path');

// 基础安全路由
router.get('/', protect, (req, res) => {
  res.json({ message: 'Security API is working' });
});

// 规则管理相关路由
router.get('/rules/status', protect, async (req, res) => {
  try {
    // 调用AI引擎的规则状态API
    const response = await fetch('http://localhost:8001/rules/status');
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: '获取规则状态失败', 
      error: error.message 
    });
  }
});

router.get('/rules/sources', protect, async (req, res) => {
  try {
    // 返回支持的规则源列表
    const ruleSources = {
      sigma: {
        name: 'Sigma',
        description: '日志分析规则',
        sources: [
          {
            id: 'sigmahq',
            name: 'SigmaHQ Official',
            url: 'https://github.com/SigmaHQ/sigma.git',
            description: 'SigmaHQ官方规则库',
            enabled: true
          },
          {
            id: 'custom',
            name: '自定义规则',
            description: '用户自定义Sigma规则',
            enabled: true,
            local: true
          }
        ]
      },
      suricata: {
        name: 'Suricata',
        description: '网络入侵检测规则',
        sources: [
          {
            id: 'emergingthreats',
            name: 'Emerging Threats',
            url: 'https://rules.emergingthreats.net/open/suricata/rules/',
            description: 'Emerging Threats开源规则集',
            enabled: true
          }
        ]
      },
      yara: {
        name: 'YARA',
        description: '恶意软件检测规则',
        sources: [
          {
            id: 'yararules',
            name: 'YaraRules',
            url: 'https://github.com/Yara-Rules/rules',
            description: 'YARA规则社区',
            enabled: true
          }
        ]
      },
      snort: {
        name: 'Snort',
        description: '网络入侵检测规则',
        sources: [
          {
            id: 'snort_community',
            name: 'Snort Community',
            url: 'https://www.snort.org/downloads/community/',
            description: 'Snort社区规则',
            enabled: true
          }
        ]
      }
    };
    
    res.json({
      success: true,
      data: ruleSources,
      message: '获取规则源列表成功'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: '获取规则源列表失败', 
      error: error.message 
    });
  }
});

router.post('/rules/update', protect, async (req, res) => {
  try {
    const { source_type, source_name } = req.body;
    
    // 调用AI引擎的规则更新API
    const response = await fetch('http://localhost:8001/rules/update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ source_type, source_name })
    });
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: '规则更新失败', 
      error: error.message 
    });
  }
});

router.get('/rules/statistics', protect, async (req, res) => {
  try {
    // 获取规则统计信息
    const response = await fetch('http://localhost:8001/rules/status');
    const data = await response.json();
    
    if (data.success) {
      const stats = {
        total_rules: data.status.rules_loaded || 0,
        last_update: data.status.last_update_time,
        rule_types: {
          sigma: 0,
          suricata: 0,
          yara: 0,
          snort: 0
        },
        matches_found: data.status.matches_found || 0,
        false_positives: data.status.false_positives || 0
      };
      
      res.json({
        success: true,
        data: stats,
        message: '获取规则统计成功'
      });
    } else {
      res.status(500).json(data);
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: '获取规则统计失败', 
      error: error.message 
    });
  }
});

// 自定义规则管理API
const CUSTOM_RULES_DIR = path.join(__dirname, '../../ai-engine/rules/custom');

// 确保自定义规则目录存在
async function ensureCustomRulesDir() {
  try {
    await fs.access(CUSTOM_RULES_DIR);
  } catch {
    await fs.mkdir(CUSTOM_RULES_DIR, { recursive: true });
  }
}

// 验证Sigma规则格式
function validateSigmaRule(ruleContent) {
  try {
    const rule = yaml.load(ruleContent);
    
    // 检查必需字段
    if (!rule.title) {
      return { valid: false, error: '缺少必需字段: title' };
    }
    if (!rule.detection) {
      return { valid: false, error: '缺少必需字段: detection' };
    }
    if (!rule.logsource) {
      return { valid: false, error: '缺少必需字段: logsource' };
    }
    
    // 检查detection结构
    if (!rule.detection.selection && !rule.detection.condition) {
      return { valid: false, error: 'detection必须包含selection或condition' };
    }
    
    return { valid: true, rule };
  } catch (error) {
    return { valid: false, error: `YAML格式错误: ${error.message}` };
  }
}

// 获取自定义规则列表
router.get('/rules/custom', protect, async (req, res) => {
  try {
    await ensureCustomRulesDir();
    
    const files = await fs.readdir(CUSTOM_RULES_DIR);
    const rules = [];
    
    for (const file of files) {
      if (file.endsWith('.yml') || file.endsWith('.yaml')) {
        try {
          const filePath = path.join(CUSTOM_RULES_DIR, file);
          const content = await fs.readFile(filePath, 'utf8');
          const rule = yaml.load(content);
          
          rules.push({
            id: file.replace(/\.(yml|yaml)$/, ''),
            filename: file,
            title: rule.title || '未命名规则',
            description: rule.description || '',
            author: rule.author || '未知',
            date: rule.date || '',
            level: rule.level || 'medium',
            status: rule.status || 'experimental',
            logsource: rule.logsource || {},
            tags: rule.tags || [],
            enabled: rule.enabled !== false,
            created_at: (await fs.stat(filePath)).birthtime,
            updated_at: (await fs.stat(filePath)).mtime
          });
        } catch (error) {
          console.error(`解析规则文件 ${file} 失败:`, error);
        }
      }
    }
    
    res.json({
      success: true,
      data: rules,
      message: '获取自定义规则列表成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取自定义规则列表失败',
      error: error.message
    });
  }
});

// 创建自定义规则
router.post('/rules/custom', protect, async (req, res) => {
  try {
    const { title, description, author, level, status, logsource, detection, tags, enabled } = req.body;
    
    // 构建规则内容
    const ruleContent = {
      title,
      description: description || '',
      author: author || '用户',
      date: new Date().toISOString().split('T')[0],
      level: level || 'medium',
      status: status || 'experimental',
      logsource: logsource || { product: 'windows' },
      detection,
      tags: tags || [],
      enabled: enabled !== false
    };
    
    // 验证规则格式
    const validation = validateSigmaRule(yaml.dump(ruleContent));
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: '规则格式无效',
        error: validation.error
      });
    }
    
    await ensureCustomRulesDir();
    
    // 生成文件名
    const filename = `${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}.yml`;
    const filePath = path.join(CUSTOM_RULES_DIR, filename);
    
    // 写入文件
    await fs.writeFile(filePath, yaml.dump(ruleContent), 'utf8');
    
    res.json({
      success: true,
      data: {
        id: filename.replace('.yml', ''),
        filename,
        ...ruleContent
      },
      message: '自定义规则创建成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '创建自定义规则失败',
      error: error.message
    });
  }
});

// 更新自定义规则
router.put('/rules/custom/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, author, level, status, logsource, detection, tags, enabled } = req.body;
    
    await ensureCustomRulesDir();
    
    // 查找规则文件
    const files = await fs.readdir(CUSTOM_RULES_DIR);
    const ruleFile = files.find(file => file.replace(/\.(yml|yaml)$/, '') === id);
    
    if (!ruleFile) {
      return res.status(404).json({
        success: false,
        message: '规则不存在'
      });
    }
    
    const filePath = path.join(CUSTOM_RULES_DIR, ruleFile);
    const existingContent = await fs.readFile(filePath, 'utf8');
    const existingRule = yaml.load(existingContent);
    
    // 更新规则内容
    const updatedRule = {
      ...existingRule,
      title: title || existingRule.title,
      description: description || existingRule.description,
      author: author || existingRule.author,
      level: level || existingRule.level,
      status: status || existingRule.status,
      logsource: logsource || existingRule.logsource,
      detection: detection || existingRule.detection,
      tags: tags || existingRule.tags,
      enabled: enabled !== undefined ? enabled : existingRule.enabled,
      modified: new Date().toISOString().split('T')[0]
    };
    
    // 验证规则格式
    const validation = validateSigmaRule(yaml.dump(updatedRule));
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: '规则格式无效',
        error: validation.error
      });
    }
    
    // 写入文件
    await fs.writeFile(filePath, yaml.dump(updatedRule), 'utf8');
    
    res.json({
      success: true,
      data: {
        id,
        filename: ruleFile,
        ...updatedRule
      },
      message: '自定义规则更新成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '更新自定义规则失败',
      error: error.message
    });
  }
});

// 删除自定义规则
router.delete('/rules/custom/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    
    await ensureCustomRulesDir();
    
    // 查找规则文件
    const files = await fs.readdir(CUSTOM_RULES_DIR);
    const ruleFile = files.find(file => file.replace(/\.(yml|yaml)$/, '') === id);
    
    if (!ruleFile) {
      return res.status(404).json({
        success: false,
        message: '规则不存在'
      });
    }
    
    const filePath = path.join(CUSTOM_RULES_DIR, ruleFile);
    await fs.unlink(filePath);
    
    res.json({
      success: true,
      message: '自定义规则删除成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '删除自定义规则失败',
      error: error.message
    });
  }
});

// 获取自定义规则详情
router.get('/rules/custom/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    
    await ensureCustomRulesDir();
    
    // 查找规则文件
    const files = await fs.readdir(CUSTOM_RULES_DIR);
    const ruleFile = files.find(file => file.replace(/\.(yml|yaml)$/, '') === id);
    
    if (!ruleFile) {
      return res.status(404).json({
        success: false,
        message: '规则不存在'
      });
    }
    
    const filePath = path.join(CUSTOM_RULES_DIR, ruleFile);
    const content = await fs.readFile(filePath, 'utf8');
    const rule = yaml.load(content);
    
    res.json({
      success: true,
      data: {
        id,
        filename: ruleFile,
        content,
        ...rule
      },
      message: '获取自定义规则详情成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取自定义规则详情失败',
      error: error.message
    });
  }
});

// 测试自定义规则
router.post('/rules/custom/:id/test', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const { test_data } = req.body;
    
    // 获取规则内容
    await ensureCustomRulesDir();
    const files = await fs.readdir(CUSTOM_RULES_DIR);
    const ruleFile = files.find(file => file.replace(/\.(yml|yaml)$/, '') === id);
    
    if (!ruleFile) {
      return res.status(404).json({
        success: false,
        message: '规则不存在'
      });
    }
    
    const filePath = path.join(CUSTOM_RULES_DIR, ruleFile);
    const content = await fs.readFile(filePath, 'utf8');
    const rule = yaml.load(content);
    
    // 调用AI引擎进行规则测试
    const response = await fetch('http://localhost:8001/rules/match', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        rule_content: content,
        test_data: test_data || {}
      })
    });
    
    const result = await response.json();
    
    res.json({
      success: true,
      data: {
        rule_id: id,
        rule_title: rule.title,
        test_result: result,
        matched: result.matches && result.matches.length > 0
      },
      message: '规则测试完成'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '规则测试失败',
      error: error.message
    });
  }
});

module.exports = router; 