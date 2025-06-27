require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const TelegramBot = require('./bot');
const oauth = require('./oauth');

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || process.env.RAILWAY_STATIC_URL || `http://localhost:${PORT}`;

// Security and performance middleware
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests, try again later.',
}));

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', time: new Date().toISOString() });
});

// Root endpoint
app.get('/', (req, res) => {
  res.send('🤖 JobfinderAI is running!');
});

// --- Telegram Bot Setup ---
let telegramBot;
const botInstance = new TelegramBot();
telegramBot = botInstance.getBot();

// Webhook for production, polling for local/dev
if (process.env.NODE_ENV === 'production') {
  // Webhook mode
  app.use(botInstance.getBot().webhookCallback('/telegram-webhook'));
  botInstance.getBot().launch({
    webhook: {
      domain: BASE_URL.replace(/\/$/, ''), // Remove trailing slash if any
      port: PORT,
    }
  });
  console.log('🚀 Bot running in webhook mode at:', `${BASE_URL}/telegram-webhook`);
} else {
  // Polling mode for local/dev
  botInstance.launch();
  console.log('🚀 Bot running in polling mode (local/dev)');
}

// --- OAuth Routes ---
app.get('/auth/google', (req, res) => {
  const { telegram_id } = req.query;
  if (!telegram_id) {
    return res.status(400).json({ error: 'Missing telegram_id parameter' });
  }
  try {
    const authURL = oauth.getAuthURL(telegram_id);
    res.redirect(authURL);
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({ error: 'Failed to generate authentication URL' });
  }
});

app.get('/auth/google/callback', async (req, res) => {
  try {
    await oauth.handleOAuthCallback(req, res);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).send('Authentication failed. Please try again.');
  }
});

// --- Error Handling ---
app.use((err, req, res, next) => {
  console.error('Express error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// --- 404 Handler ---
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}`);
  console.log(`📊 Health check: ${BASE_URL}/health`);
  console.log(`🔐 OAuth URL: ${BASE_URL}/auth/google`);
  console.log(`🤖 Bot is ready to receive messages!`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
}); 