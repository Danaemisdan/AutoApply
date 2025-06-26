# 🔐 Google OAuth & Gmail API Setup Guide

This guide will walk you through setting up Google OAuth2 and Gmail API integration for your Telegram Job Bot.

## Prerequisites

- Google Cloud Platform account
- Domain or Railway/Fly.io app URL (for OAuth redirect)
- Basic understanding of OAuth2 flow

## Step 1: Create Google Cloud Project

1. **Go to Google Cloud Console**
   - Visit [console.cloud.google.com](https://console.cloud.google.com/)
   - Sign in with your Google account

2. **Create New Project**
   - Click on the project dropdown at the top
   - Click "New Project"
   - Enter a project name (e.g., "Telegram Job Bot")
   - Click "Create"

3. **Select Your Project**
   - Make sure your new project is selected in the dropdown

## Step 2: Enable Gmail API

1. **Navigate to APIs & Services**
   - Go to "APIs & Services" > "Library"

2. **Search for Gmail API**
   - Search for "Gmail API" in the search bar
   - Click on "Gmail API" from the results

3. **Enable the API**
   - Click "Enable" button
   - Wait for the API to be enabled

## Step 3: Create OAuth 2.0 Credentials

1. **Go to Credentials**
   - Navigate to "APIs & Services" > "Credentials"

2. **Create OAuth 2.0 Client ID**
   - Click "Create Credentials"
   - Select "OAuth 2.0 Client IDs"

3. **Configure OAuth Consent Screen**
   - If prompted, configure the OAuth consent screen:
     - **User Type**: External
     - **App name**: Your Bot Name
     - **User support email**: Your email
     - **Developer contact information**: Your email
     - **Scopes**: Add `https://www.googleapis.com/auth/gmail.send`

4. **Create Web Application**
   - Choose "Web application" as the application type
   - **Name**: "Telegram Job Bot Web Client"

5. **Add Authorized Redirect URIs**
   - **Production**: `https://your-app.railway.app/auth/google/callback`
   - **Development**: `http://localhost:3000/auth/google/callback`
   - Replace `your-app.railway.app` with your actual domain

6. **Create Credentials**
   - Click "Create"
   - You'll see a popup with your Client ID and Client Secret

## Step 4: Save Your Credentials

1. **Copy the Credentials**
   - **Client ID**: Copy this to your `.env` file
   - **Client Secret**: Copy this to your `.env` file

2. **Update Environment Variables**
   ```env
   GOOGLE_CLIENT_ID=your_client_id_here
   GOOGLE_CLIENT_SECRET=your_client_secret_here
   GOOGLE_REDIRECT_URI=https://your-app.railway.app/auth/google/callback
   ```

## Step 5: Configure OAuth Consent Screen (Optional)

1. **Go to OAuth Consent Screen**
   - Navigate to "APIs & Services" > "OAuth consent screen"

2. **Add Scopes**
   - Click "Add or Remove Scopes"
   - Add these scopes:
     - `https://www.googleapis.com/auth/gmail.send`
     - `https://www.googleapis.com/auth/gmail.compose`

3. **Add Test Users** (if in testing)
   - Add your email address as a test user
   - This allows you to test the OAuth flow

## Step 6: Test OAuth Flow

### Local Testing

1. **Start your bot locally**
   ```bash
   npm run dev
   ```

2. **Test OAuth URL**
   - Visit: `http://localhost:3000/auth/google?telegram_id=123456`
   - You should be redirected to Google's OAuth page

3. **Complete OAuth Flow**
   - Sign in with your Google account
   - Grant permissions to your app
   - You should be redirected back to your success page

### Production Testing

1. **Deploy your bot**
   - Deploy to Railway, Fly.io, or your preferred platform

2. **Update Redirect URI**
   - Make sure `GOOGLE_REDIRECT_URI` points to your production URL

3. **Test the flow**
   - Use the `/connectgmail` command in your Telegram bot
   - Follow the OAuth flow

## Step 7: Troubleshooting

### Common Issues

1. **"Invalid redirect_uri" Error**
   - Make sure the redirect URI in Google Cloud matches exactly
   - Check for trailing slashes or protocol mismatches
   - Verify the domain is correct

2. **"Access blocked" Error**
   - Add your email as a test user in OAuth consent screen
   - Make sure the app is not in "Testing" mode if you want public access

3. **"Gmail API not enabled" Error**
   - Go back to API Library and enable Gmail API
   - Wait a few minutes for the API to be fully enabled

4. **"Invalid client" Error**
   - Double-check your Client ID and Client Secret
   - Make sure they're copied correctly to your `.env` file

### Debug Commands

```bash
# Check if your bot is running
curl http://localhost:3000/health

# Test OAuth URL generation
curl "http://localhost:3000/auth/google?telegram_id=123456"

# Check environment variables
echo $GOOGLE_CLIENT_ID
echo $GOOGLE_CLIENT_SECRET
```

## Step 8: Security Best Practices

1. **Environment Variables**
   - Never commit credentials to version control
   - Use `.env` files for local development
   - Use platform secrets for production

2. **OAuth Scopes**
   - Only request the minimum scopes needed
   - `gmail.send` and `gmail.compose` are sufficient for this bot

3. **Token Storage**
   - Tokens are stored securely in Supabase
   - Refresh tokens are used to maintain access
   - Users can disconnect anytime

4. **HTTPS Only**
   - Always use HTTPS in production
   - Railway and Fly.io provide SSL automatically

## Step 9: Production Deployment

### Railway.app

1. **Set Environment Variables**
   ```bash
   GOOGLE_CLIENT_ID=your_client_id
   GOOGLE_CLIENT_SECRET=your_client_secret
   GOOGLE_REDIRECT_URI=https://your-app.railway.app/auth/google/callback
   ```

2. **Update Google Cloud**
   - Add your Railway URL to authorized redirect URIs
   - Remove localhost URLs if not needed

### Fly.io

1. **Set Secrets**
   ```bash
   fly secrets set GOOGLE_CLIENT_ID=your_client_id
   fly secrets set GOOGLE_CLIENT_SECRET=your_client_secret
   fly secrets set GOOGLE_REDIRECT_URI=https://your-app.fly.dev/auth/google/callback
   ```

2. **Update Google Cloud**
   - Add your Fly.io URL to authorized redirect URIs

## Step 10: Monitor Usage

1. **Google Cloud Console**
   - Monitor API usage in "APIs & Services" > "Dashboard"
   - Check for any quota limits or errors

2. **Application Logs**
   - Monitor your bot logs for OAuth-related errors
   - Track successful vs failed authentications

3. **User Feedback**
   - Monitor user reports of OAuth issues
   - Provide clear error messages and recovery steps

## 🔗 Useful Links

- [Google Cloud Console](https://console.cloud.google.com/)
- [Gmail API Documentation](https://developers.google.com/gmail/api)
- [OAuth 2.0 Guide](https://developers.google.com/identity/protocols/oauth2)
- [Google APIs Node.js Client](https://github.com/googleapis/google-api-nodejs-client)

## 🆘 Support

If you encounter issues:

1. Check the Google Cloud Console for API errors
2. Verify your OAuth credentials are correct
3. Ensure redirect URIs match exactly
4. Check your bot logs for detailed error messages
5. Test with a simple OAuth flow first

---

**Your OAuth setup is now complete! 🎉** 