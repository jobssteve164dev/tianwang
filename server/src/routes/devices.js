const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

// GET /api/devices - 获取设备列表
router.get('/', authenticate, (req, res) => {
  res.json({ message: 'Get devices - TODO: Implement' });
});

// POST /api/devices - 添加设备
router.post('/', authenticate, (req, res) => {
  res.json({ message: 'Create device - TODO: Implement' });
});

// GET /api/devices/:id - 获取设备详情
router.get('/:id', authenticate, (req, res) => {
  res.json({ message: `Get device ${req.params.id} - TODO: Implement` });
});

// PUT /api/devices/:id - 更新设备
router.put('/:id', authenticate, (req, res) => {
  res.json({ message: `Update device ${req.params.id} - TODO: Implement` });
});

// DELETE /api/devices/:id - 删除设备
router.delete('/:id', authenticate, (req, res) => {
  res.json({ message: `Delete device ${req.params.id} - TODO: Implement` });
});

module.exports = router; 