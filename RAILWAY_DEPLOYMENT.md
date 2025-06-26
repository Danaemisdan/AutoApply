# 🚀 Railway Deployment Guide

This guide will walk you through deploying your Telegram Job Bot to Railway.app.

## Prerequisites

1. **GitHub Account**: Your code should be in a GitHub repository
2. **Railway Account**: Sign up at [railway.app](https://railway.app)
3. **Telegram Bot Token**: Get from [@BotFather](https://t.me/botfather)
4. **Supabase Project**: Create at [supabase.com](https://supabase.com)
5. **OpenRouter API Key**: Get from [openrouter.ai](https://openrouter.ai)

## Step 1: Prepare Your Repository

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Initial commit: Telegram Job Bot"
   git push origin main
   ```

2. **Verify Files**
   Ensure these files are in your repository:
   - `package.json`
   - `src/index.js`
   - `Procfile` (optional, Railway auto-detects)
   - `README.md`

## Step 2: Create Railway Project

1. **Login to Railway**
   - Go to [railway.app](https://railway.app)
   - Sign in with GitHub

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository
   - Railway will automatically detect it's a Node.js project

## Step 3: Configure Environment Variables

1. **Go to Variables Tab**
   - In your Railway project dashboard
   - Click on the "Variables" tab

2. **Add Required Variables**
   Add these environment variables:

   ```env
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   OPENROUTER_API_KEY=your_openrouter_api_key_here
   NODE_ENV=production
   PORT=3000
   ```

3. **Get Your Values**
   - **Telegram Bot Token**: Message [@BotFather](https://t.me/botfather) on Telegram
   - **Supabase URL**: Found in your Supabase project settings
   - **Supabase Anon Key**: Found in your Supabase project settings
   - **OpenRouter API Key**: Get from [openrouter.ai](https://openrouter.ai)

## Step 4: Set Up Database

1. **Create Supabase Tables**
   - Go to your Supabase project
   - Open the SQL Editor
   - Run the SQL from `database-setup.sql`

2. **Verify Tables**
   - Check that `users` and `conversations` tables exist
   - Verify indexes are created

## Step 5: Deploy

1. **Automatic Deployment**
   - Railway will automatically deploy when you push to GitHub
   - Or click "Deploy" in the Railway dashboard

2. **Check Logs**
   - Go to the "Deployments" tab
   - Click on the latest deployment
   - Check the logs for any errors

3. **Verify Health**
   - Your bot will be available at: `https://your-app-name.railway.app`
   - Health check: `https://your-app-name.railway.app/health`

## Step 6: Test Your Bot

1. **Find Your Bot**
   - Search for your bot username on Telegram
   - Or use the link: `https://t.me/your_bot_username`

2. **Test Commands**
   ```
   /start
   /help
   /resume
   ```

3. **Upload Resume**
   - Send a PDF, DOCX, or TXT file
   - Or paste resume text

4. **Generate Cover Letter**
   ```
   /apply Software Engineer at Google focusing on React development
   ```

## Troubleshooting

### Common Issues

1. **Bot Not Responding**
   - Check Railway logs for errors
   - Verify environment variables are set correctly
   - Ensure database tables exist

2. **Database Connection Errors**
   - Verify Supabase URL and key
   - Check if tables are created
   - Ensure network connectivity

3. **File Upload Issues**
   - Check file size (max 10MB)
   - Verify file format (PDF, DOCX, TXT)
   - Check Railway logs for parsing errors

4. **AI API Errors**
   - Verify OpenRouter API key
   - Check API usage limits
   - Review error logs

### Debug Commands

```bash
# Check Railway logs
railway logs

# Check environment variables
railway variables

# Restart deployment
railway up
```

## Monitoring

1. **Railway Dashboard**
   - Monitor CPU and memory usage
   - Check deployment status
   - View logs in real-time

2. **Health Endpoint**
   - `https://your-app-name.railway.app/health`
   - Returns bot status and uptime

3. **Custom Domain** (Optional)
   - Add custom domain in Railway settings
   - Update webhook URL if using webhooks

## Scaling

1. **Automatic Scaling**
   - Railway automatically scales based on traffic
   - No manual configuration needed

2. **Resource Limits**
   - Free tier: Limited resources
   - Pro tier: More resources and features

## Security

1. **Environment Variables**
   - All sensitive data is encrypted
   - Never commit `.env` files

2. **Database Security**
   - Supabase provides built-in security
   - Enable RLS if needed

3. **API Security**
   - Rate limiting enabled
   - CORS protection
   - Helmet.js security headers

## Cost Optimization

1. **Free Tier**
   - 500 hours/month
   - 1GB RAM
   - Shared CPU

2. **Pro Tier**
   - $5/month per developer
   - More resources
   - Custom domains

## Support

- **Railway Docs**: [docs.railway.app](https://docs.railway.app)
- **Railway Discord**: [discord.gg/railway](https://discord.gg/railway)
- **GitHub Issues**: Create issues in your repository

---

**Your bot is now live and ready to help job seekers! 🎉** 