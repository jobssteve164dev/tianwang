const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

router.get('/events', authenticate, (req, res) => {
  res.json({ message: 'Get security events - TODO: Implement' });
});

router.get('/rules', authenticate, (req, res) => {
  res.json({ message: 'Get threat rules - TODO: Implement' });
});

router.post('/rules', authenticate, (req, res) => {
  res.json({ message: 'Create threat rule - TODO: Implement' });
});

module.exports = router; 