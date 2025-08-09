const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/users - 获取用户列表
router.get('/', authenticate, authorize(['admin', 'super_admin']), (req, res) => {
  res.json({ message: 'Get users - TODO: Implement' });
});

// GET /api/users/:id - 获取用户详情
router.get('/:id', authenticate, (req, res) => {
  res.json({ message: `Get user ${req.params.id} - TODO: Implement` });
});

// PUT /api/users/:id - 更新用户
router.put('/:id', authenticate, authorize(['admin', 'super_admin']), (req, res) => {
  res.json({ message: `Update user ${req.params.id} - TODO: Implement` });
});

module.exports = router; 