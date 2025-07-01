const { google } = require('googleapis');
const db = require('./db');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const BASE_URL = process.env.BASE_URL;
if (!BASE_URL) {
  throw new Error('BASE_URL is not set! Set BASE_URL in your Railway environment variables.');
}
const REDIRECT_URI = `${BASE_URL.replace(/\/$/, '')}/auth/gmail/callback`;

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
];

console.log('Gmail OAuth BASE_URL:', BASE_URL);
console.log('Gmail OAuth REDIRECT_URI:', REDIRECT_URI);

function getOAuth2Client() {
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}

// Step 1: Initiate OAuth
function getAuthUrl(telegramId) {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state: telegramId.toString()
  });
}

// Step 2: Handle Callback
async function handleCallback(req, res) {
  try {
    const { code, state } = req.query;
    if (!code || !state) {
      console.error('Missing code or state in OAuth callback');
      return res.status(400).send('Missing code or state');
    }
    
    const telegramId = state;
    console.log(`[${telegramId}] Processing Gmail OAuth callback`);
    
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    
    // Get user email
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: 'me' });
    const email = profile.data.emailAddress;
    
    // Save tokens to DB
    await db.saveGmailTokens({
      telegram_id: telegramId,
      email,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: tokens.expiry_date ? new Date(tokens.expiry_date) : null
    });
    
    console.log(`[${telegramId}] Gmail OAuth successful for ${email}`);
    
    // Call bot's OAuth success handler
    try {
      const TelegramBot = require('./bot');
      await TelegramBot.handleOAuthSuccess(telegramId);
    } catch (botError) {
      console.error(`[${telegramId}] Error calling bot OAuth success handler:`, botError);
    }
    
    res.send('✅ Gmail connected! You can close this window.');
    
  } catch (error) {
    console.error('Gmail OAuth callback error:', error);
    
    // Try to get telegramId from state for error handling
    const telegramId = req.query.state;
    if (telegramId) {
      try {
        const TelegramBot = require('./bot');
        await TelegramBot.handleOAuthFailure(telegramId);
      } catch (botError) {
        console.error(`[${telegramId}] Error calling bot OAuth failure handler:`, botError);
      }
    }
    
    res.status(500).send('❌ Gmail authentication failed. Please try again.');
  }
}

// Step 3: Status
async function getStatus(telegramId) {
  const tokens = await db.getGmailTokens(telegramId);
  if (!tokens) return { authenticated: false };
  return { authenticated: true, ...tokens };
}

// Step 4: Get valid tokens for sending
async function getValidTokens(telegramId) {
  const tokens = await db.getGmailTokens(telegramId);
  if (!tokens) throw new Error('No Gmail tokens found');
  // Refresh if expired
  if (tokens.token_expires_at && new Date() > new Date(tokens.token_expires_at)) {
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({ refresh_token: tokens.refresh_token });
    const { credentials } = await oauth2Client.refreshAccessToken();
    await db.saveGmailTokens({
      telegram_id: telegramId,
      email: tokens.email,
      access_token: credentials.access_token,
      refresh_token: credentials.refresh_token || tokens.refresh_token,
      token_expires_at: credentials.expiry_date ? new Date(credentials.expiry_date) : null
    });
    return credentials;
  }
  return tokens;
}

module.exports = {
  getAuthUrl,
  handleCallback,
  getStatus,
  getValidTokens
}; 