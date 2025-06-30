const express = require('express');
const router = express.Router();
const gmailOAuth = require('../gmail_oauth');

// Gmail OAuth initiation
router.get('/initiate/:telegramId', (req, res) => {
  console.log('HIT /auth/gmail/initiate with', req.params.telegramId);
  const { telegramId } = req.params;
  const url = gmailOAuth.getAuthUrl(telegramId);
  res.redirect(url);
});

// Test route for router
router.get('/test', (req, res) => {
  res.send('AUTH ROUTER ALIVE');
});

// You can add more Gmail OAuth routes here if needed

module.exports = router; 