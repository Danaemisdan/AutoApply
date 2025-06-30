const express = require('express');
const router = express.Router();

router.get('/initiate/:telegramId', (req, res) => {
    const { telegramId } = req.params;
    console.log(`OAuth initiated for Telegram ID: ${telegramId}`);
    res.send(`OAuth works ✅ for ${telegramId}`);
});

// Test route for router
router.get('/test', (req, res) => {
  res.send('AUTH ROUTER ALIVE');
});

// You can add more Gmail OAuth routes here if needed

module.exports = router; 