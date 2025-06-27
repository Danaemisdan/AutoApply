require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const TelegramBot = require('./bot');
const oauth = require('./oauth');

// Validate environment variables
const requiredEnvVars = [
  'TELEGRAM_BOT_TOKEN',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'OPENROUTER_API_KEY',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REDIRECT_URI'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : true,
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: '🤖 Telegram Job Bot API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      webhook: '/webhook',
      auth: {
        google: '/auth/google',
        callback: '/auth/google/callback'
      }
    }
  });
});

// OAuth Routes
app.get('/auth/google', (req, res) => {
  const { telegram_id } = req.query;
  
  if (!telegram_id) {
    return res.status(400).json({
      error: 'Missing telegram_id parameter',
      message: 'Please provide a valid telegram_id in the query parameters'
    });
  }

  try {
    const authURL = oauth.getAuthURL(telegram_id);
    res.redirect(authURL);
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({
      error: 'Failed to generate authentication URL',
      message: 'Please try again later'
    });
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

// Webhook endpoint for Telegram (for production webhook mode)
app.post('/telegram-webhook', express.raw({ type: 'application/json' }), (req, res) => {
  // This endpoint handles Telegram webhook updates
  if (telegramBot) {
    telegramBot.getBot().handleUpdate(req.body, res);
  } else {
    res.status(500).send('Bot not initialized');
  }
});

// Legacy webhook endpoint for Telegram (optional, for production)
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  // This endpoint can be used for webhook-based bot updates
  // For now, we're using polling, but this is here for future use
  res.status(200).send('OK');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Express error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: 'The requested endpoint does not exist'
  });
});

// Initialize and start the Telegram bot
let telegramBot;

async function startBot() {
  try {
    console.log('🚀 Initializing Telegram bot...');
    telegramBot = new TelegramBot();
    
    // Use webhooks for production, polling for development
    if (process.env.NODE_ENV === 'production') {
      const BASE_URL = process.env.BASE_URL || process.env.RAILWAY_STATIC_URL || 'https://your-app.railway.app';
      console.log('🌐 Using webhook mode with URL:', BASE_URL);
      
      // Set up webhook
      telegramBot.getBot().launch({
        webhook: {
          domain: BASE_URL,
          port: process.env.PORT || 3000
        }
      });
    } else {
      console.log('🔄 Using polling mode for development');
      telegramBot.launch();
    }
    
    console.log('✅ Telegram bot started successfully');
  } catch (error) {
    console.error('❌ Failed to start Telegram bot:', error);
    process.exit(1);
  }
}

// Start the server
async function startServer() {
  try {
    await startBot();
    
    app.listen(PORT, () => {
      console.log(`🌐 Server running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🔐 OAuth URL: http://localhost:${PORT}/auth/google`);
      console.log(`🤖 Bot is ready to receive messages!`);
      console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  if (telegramBot) {
    telegramBot.getBot().stop('SIGTERM');
  }
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  if (telegramBot) {
    telegramBot.getBot().stop('SIGINT');
  }
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the application
startServer(); 