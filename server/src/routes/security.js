const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');

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

module.exports = router; 