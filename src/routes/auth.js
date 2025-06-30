const express = require('express');
const router = express.Router();
const gmailOAuth = require('../gmail_oauth');

router.get('/initiate/:telegramId', (req, res) => {
    const { telegramId } = req.params;
    console.log(`OAuth initiated for Telegram ID: ${telegramId}`);
    const url = gmailOAuth.getAuthUrl(telegramId);
    res.redirect(url);
});

// Test route for router
router.get('/test', (req, res) => {
  res.send('AUTH ROUTER ALIVE');
});

// You can add more Gmail OAuth routes here if needed

module.exports = router; 