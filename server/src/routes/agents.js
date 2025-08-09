const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, (req, res) => {
  res.json({ message: 'Get agents - TODO: Implement' });
});

router.post('/', authenticate, (req, res) => {
  res.json({ message: 'Create agent - TODO: Implement' });
});

module.exports = router; 