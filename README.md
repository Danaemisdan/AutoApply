# 🤖 Telegram Job Application Bot

An AI-powered Telegram bot that helps users with job applications by generating personalized cover letters, parsing resumes, suggesting relevant job opportunities, and **automatically sending job applications via Gmail**.

## ✨ Features

- **📄 Resume Upload & Parsing**: Support for PDF, DOCX, and TXT files
- **💼 AI Cover Letter Generation**: Creates personalized cover letters using OpenRouter API
- **🔍 Job Suggestions**: Provides relevant job opportunities based on user preferences
- **📧 Gmail Integration**: Connect your Gmail account for automatic job application sending
- **📤 Auto-Apply**: Send job applications directly from your Gmail account
- **💬 Conversation History**: Maintains full context of user interactions
- **🛡️ Production Ready**: Built with security, error handling, and scalability in mind

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- Telegram Bot Token (from [@BotFather](https://t.me/botfather))
- Supabase account and project
- OpenRouter API key
- Google Cloud Project with Gmail API enabled

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd telegram-job-bot
npm install
```

### 2. Environment Setup

Copy the environment template and fill in your credentials:

```bash
cp env.example .env
```

Edit `.env` with your actual values:

```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here

# Supabase Database Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# OpenRouter AI API Configuration
OPENROUTER_API_KEY=your_openrouter_api_key_here

# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=https://your-app.railway.app/auth/google/callback

# Server Configuration
PORT=3000
NODE_ENV=production

# Optional: Custom AI Model (default: mistralai/mistral-small-3.2-24b-instruct:free)
AI_MODEL=mistralai/mistral-small-3.2-24b-instruct:free
```

### 3. Google Cloud Setup

1. **Create Google Cloud Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one

2. **Enable Gmail API**
   - Go to "APIs & Services" > "Library"
   - Search for "Gmail API" and enable it

3. **Create OAuth 2.0 Credentials**
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client IDs"
   - Choose "Web application"
   - Add authorized redirect URIs:
     - `https://your-app.railway.app/auth/google/callback`
     - `http://localhost:3000/auth/google/callback` (for development)

4. **Get Client ID and Secret**
   - Copy the Client ID and Client Secret to your `.env` file

### 4. Database Setup

Create the following tables in your Supabase project:

#### Users Table
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  telegram_id BIGINT UNIQUE NOT NULL,
  name VARCHAR(255),
  job_preferences TEXT,
  resume_text TEXT,
  resume_filename VARCHAR(255),
  gmail_access_token TEXT,
  gmail_refresh_token TEXT,
  gmail_token_expiry TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX idx_users_telegram_id ON users(telegram_id);
```

#### Conversations Table
```sql
CREATE TABLE conversations (
  id SERIAL PRIMARY KEY,
  telegram_id BIGINT NOT NULL,
  message TEXT NOT NULL,
  response TEXT NOT NULL,
  message_type VARCHAR(50) DEFAULT 'general',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_conversations_telegram_id ON conversations(telegram_id);
CREATE INDEX idx_conversations_created_at ON conversations(created_at);
```

### 5. Run the Bot

#### Development
```bash
npm run dev
```

#### Production
```bash
npm start
```

## 📱 Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message and bot introduction |
| `/resume` | Upload or paste your resume |
| `/apply [job description]` | Generate a cover letter |
| `/jobs` | Get job suggestions |
| `/connectgmail` | Connect your Gmail account |
| `/sendapplication` | Send job application via email |
| `/disconnectgmail` | Disconnect your Gmail account |
| `/help` | Show help information |

## 🔧 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | API information |
| `/health` | GET | Health check |
| `/auth/google` | GET | Start Google OAuth flow |
| `/auth/google/callback` | GET | Handle OAuth callback |
| `/webhook` | POST | Telegram webhook (future use) |

## 🚀 Deployment

### Railway.app

1. **Connect Repository**
   - Fork/clone this repository
   - Connect your GitHub repo to Railway

2. **Environment Variables**
   - Add all required environment variables in Railway dashboard
   - Set `NODE_ENV=production`
   - Update `GOOGLE_REDIRECT_URI` to your Railway app URL

3. **Deploy**
   - Railway will automatically detect Node.js and deploy
   - The bot will start automatically

### Fly.io

1. **Install Fly CLI**
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Login and Deploy**
   ```bash
   fly auth login
   fly launch
   fly deploy
   ```

3. **Set Environment Variables**
   ```bash
   fly secrets set TELEGRAM_BOT_TOKEN=your_token
   fly secrets set SUPABASE_URL=your_url
   fly secrets set SUPABASE_ANON_KEY=your_key
   fly secrets set OPENROUTER_API_KEY=your_key
   fly secrets set GOOGLE_CLIENT_ID=your_client_id
   fly secrets set GOOGLE_CLIENT_SECRET=your_client_secret
   fly secrets set GOOGLE_REDIRECT_URI=https://your-app.fly.dev/auth/google/callback
   ```

### Heroku

1. **Create Heroku App**
   ```bash
   heroku create your-bot-name
   ```

2. **Set Environment Variables**
   ```bash
   heroku config:set TELEGRAM_BOT_TOKEN=your_token
   heroku config:set SUPABASE_URL=your_url
   heroku config:set SUPABASE_ANON_KEY=your_key
   heroku config:set OPENROUTER_API_KEY=your_key
   heroku config:set GOOGLE_CLIENT_ID=your_client_id
   heroku config:set GOOGLE_CLIENT_SECRET=your_client_secret
   heroku config:set GOOGLE_REDIRECT_URI=https://your-app.herokuapp.com/auth/google/callback
   heroku config:set NODE_ENV=production
   ```

3. **Deploy**
   ```bash
   git push heroku main
   ```

## 🛠️ Development

### Project Structure

```
project/
├── src/
│   ├── index.js              # Main entry point
│   ├── bot.js                # Telegram bot handlers
│   ├── llm.js                # OpenRouter API handler
│   ├── db.js                 # Supabase database handler
│   ├── parser.js             # File parsing utilities
│   └── oauth.js              # Google OAuth & Gmail integration
├── .env.example              # Environment variables template
├── package.json              # Dependencies and scripts
└── README.md                 # This file
```

### Key Components

- **`bot.js`**: Handles all Telegram interactions and commands
- **`llm.js`**: Manages AI API calls with retry logic and error handling
- **`db.js`**: Database operations for users and conversations
- **`parser.js`**: File parsing for PDF, DOCX, and TXT files
- **`oauth.js`**: Google OAuth and Gmail API integration
- **`index.js`**: Express server setup with security middleware

### Adding New Features

1. **New Commands**: Add to `bot.js` in the `setupCommands()` method
2. **Database Operations**: Extend `db.js` with new methods
3. **AI Features**: Add new methods to `llm.js`
4. **File Types**: Extend `parser.js` with new parsers
5. **OAuth Services**: Extend `oauth.js` with new integrations

## 🔒 Security Features

- **Helmet.js**: Security headers
- **Rate Limiting**: Prevents abuse
- **CORS**: Cross-origin protection
- **Input Validation**: File size and type checking
- **OAuth2**: Secure Google authentication
- **Token Management**: Secure storage and refresh of OAuth tokens
- **Error Handling**: Graceful error responses

## 📊 Monitoring

The bot includes built-in monitoring:

- **Health Check**: `/health` endpoint
- **Response Time Logging**: All bot interactions
- **Error Logging**: Comprehensive error tracking
- **Uptime Monitoring**: Process uptime tracking
- **OAuth Flow Tracking**: Monitor authentication success/failure

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📝 License

MIT License - see LICENSE file for details

## 🆘 Support

If you encounter any issues:

1. Check the logs for error messages
2. Verify your environment variables
3. Ensure your Supabase tables are created correctly
4. Verify Google OAuth credentials are correct
5. Test with a simple message first

## 🔮 Future Enhancements

- [ ] Job board API integration
- [ ] Resume optimization suggestions
- [ ] Interview preparation features
- [ ] Multi-language support
- [ ] Web dashboard for analytics
- [ ] Email templates customization
- [ ] Application tracking system

---

**Made with ❤️ for job seekers everywhere** 