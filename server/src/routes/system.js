const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');

router.get('/config', authenticate, authorize(['admin', 'super_admin']), (req, res) => {
  res.json({ message: 'Get system config - TODO: Implement' });
});

router.put('/config', authenticate, authorize(['super_admin']), (req, res) => {
  res.json({ message: 'Update system config - TODO: Implement' });
});

router.get('/stats', authenticate, (req, res) => {
  res.json({ message: 'Get system stats - TODO: Implement' });
});

module.exports = router; 