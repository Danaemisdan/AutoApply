const express = require('express');
const router = express.Router();

router.get('/initiate/:telegramId', async (req, res) => {
  res.send('OAuth works ✅');
});

// Test route for router
router.get('/test', (req, res) => {
  res.send('AUTH ROUTER ALIVE');
});

// You can add more Gmail OAuth routes here if needed

module.exports = router; 