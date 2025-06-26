const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');

// Google OAuth2 configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
  throw new Error('Missing Google OAuth configuration. Please check your environment variables.');
}

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase configuration. Please check your environment variables.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI
);

// Gmail API scopes
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.compose'
];

class OAuthService {
  /**
   * Generate OAuth URL for Google authentication
   */
  getAuthURL(telegramId) {
    const state = Buffer.from(JSON.stringify({ telegram_id: telegramId })).toString('base64');
    
    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent', // Force consent to get refresh token
      state: state
    });
  }

  /**
   * Handle OAuth callback from Google
   */
  async handleOAuthCallback(req, res) {
    try {
      const { code, state } = req.query;
      
      if (!code || !state) {
        return res.status(400).send('Missing authorization code or state');
      }

      // Decode state to get telegram_id
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
      const telegramId = stateData.telegram_id;

      if (!telegramId) {
        return res.status(400).send('Invalid state parameter');
      }

      // Exchange code for tokens
      const { tokens } = await oauth2Client.getToken(code);
      
      // Save tokens to database
      await this.saveTokens(telegramId, tokens);

      // Success page
      const successHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Gmail Connected Successfully</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              margin: 0;
              padding: 0;
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .container {
              background: white;
              padding: 40px;
              border-radius: 12px;
              box-shadow: 0 20px 40px rgba(0,0,0,0.1);
              text-align: center;
              max-width: 400px;
              width: 90%;
            }
            .success-icon {
              font-size: 48px;
              margin-bottom: 20px;
            }
            h1 {
              color: #333;
              margin-bottom: 16px;
              font-size: 24px;
            }
            p {
              color: #666;
              line-height: 1.6;
              margin-bottom: 24px;
            }
            .button {
              background: #4285f4;
              color: white;
              padding: 12px 24px;
              border: none;
              border-radius: 6px;
              text-decoration: none;
              display: inline-block;
              font-weight: 500;
              transition: background 0.3s;
            }
            .button:hover {
              background: #3367d6;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success-icon">✅</div>
            <h1>Gmail Connected Successfully!</h1>
            <p>Your Gmail account has been connected to the Job Application Bot. You can now return to Telegram and start sending job applications automatically.</p>
            <a href="https://t.me/your_bot_username" class="button">Return to Telegram</a>
          </div>
        </body>
        </html>
      `;

      res.send(successHTML);

    } catch (error) {
      console.error('OAuth callback error:', error);
      
      const errorHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Connection Failed</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
              margin: 0;
              padding: 0;
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .container {
              background: white;
              padding: 40px;
              border-radius: 12px;
              box-shadow: 0 20px 40px rgba(0,0,0,0.1);
              text-align: center;
              max-width: 400px;
              width: 90%;
            }
            .error-icon {
              font-size: 48px;
              margin-bottom: 20px;
            }
            h1 {
              color: #333;
              margin-bottom: 16px;
              font-size: 24px;
            }
            p {
              color: #666;
              line-height: 1.6;
              margin-bottom: 24px;
            }
            .button {
              background: #ff6b6b;
              color: white;
              padding: 12px 24px;
              border: none;
              border-radius: 6px;
              text-decoration: none;
              display: inline-block;
              font-weight: 500;
              transition: background 0.3s;
            }
            .button:hover {
              background: #ee5a24;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="error-icon">❌</div>
            <h1>Connection Failed</h1>
            <p>There was an error connecting your Gmail account. Please try again or contact support if the problem persists.</p>
            <a href="https://t.me/your_bot_username" class="button">Return to Telegram</a>
          </div>
        </body>
        </html>
      `;

      res.send(errorHTML);
    }
  }

  /**
   * Save OAuth tokens to database
   */
  async saveTokens(telegramId, tokens) {
    try {
      const { data, error } = await supabase
        .from('users')
        .update({
          gmail_access_token: tokens.access_token,
          gmail_refresh_token: tokens.refresh_token,
          gmail_token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
          updated_at: new Date().toISOString()
        })
        .eq('telegram_id', telegramId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      console.log(`Gmail tokens saved for user ${telegramId}`);
      return data;
    } catch (error) {
      console.error('Error saving tokens:', error);
      throw error;
    }
  }

  /**
   * Get tokens from database
   */
  async getTokens(telegramId) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('gmail_access_token, gmail_refresh_token, gmail_token_expiry')
        .eq('telegram_id', telegramId)
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error getting tokens:', error);
      throw error;
    }
  }

  /**
   * Check if user has connected Gmail
   */
  async isGmailConnected(telegramId) {
    try {
      const tokens = await this.getTokens(telegramId);
      return !!(tokens && tokens.gmail_access_token);
    } catch (error) {
      console.error('Error checking Gmail connection:', error);
      return false;
    }
  }

  /**
   * Refresh access token if expired
   */
  async refreshTokenIfNeeded(telegramId) {
    try {
      const tokens = await this.getTokens(telegramId);
      
      if (!tokens || !tokens.gmail_refresh_token) {
        throw new Error('No refresh token available');
      }

      // Check if token is expired (with 5 minute buffer)
      const expiryDate = new Date(tokens.gmail_token_expiry);
      const now = new Date();
      const bufferTime = 5 * 60 * 1000; // 5 minutes

      if (expiryDate.getTime() - now.getTime() > bufferTime) {
        // Token is still valid
        return tokens.gmail_access_token;
      }

      // Token is expired, refresh it
      oauth2Client.setCredentials({
        refresh_token: tokens.gmail_refresh_token
      });

      const { credentials } = await oauth2Client.refreshAccessToken();
      
      // Save new tokens
      await this.saveTokens(telegramId, credentials);
      
      return credentials.access_token;
    } catch (error) {
      console.error('Error refreshing token:', error);
      throw error;
    }
  }

  /**
   * Send email using Gmail API
   */
  async sendEmail(telegramId, to, subject, body, isHTML = false) {
    try {
      // Get fresh access token
      const accessToken = await this.refreshTokenIfNeeded(telegramId);
      
      // Set credentials
      oauth2Client.setCredentials({
        access_token: accessToken
      });

      // Create Gmail service
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

      // Create email message
      const message = this.createEmailMessage(to, subject, body, isHTML);

      // Send email
      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: message
        }
      });

      console.log(`Email sent successfully to ${to} for user ${telegramId}`);
      return response.data;
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

  /**
   * Create email message in Gmail API format
   */
  createEmailMessage(to, subject, body, isHTML = false) {
    const emailLines = [
      `To: ${to}`,
      'From: me',
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      `Content-Type: ${isHTML ? 'text/html' : 'text/plain'}; charset=utf-8`,
      '',
      body
    ];

    const email = emailLines.join('\r\n');
    return Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
  }

  /**
   * Send job application email
   */
  async sendJobApplication(telegramId, jobDetails, coverLetter) {
    try {
      const { company_email, company_name, job_title } = jobDetails;
      
      const subject = `Application for ${job_title} position at ${company_name}`;
      
      const emailBody = `
        <html>
        <body>
          <p>Dear Hiring Manager,</p>
          
          <p>${coverLetter}</p>
          
          <p>I look forward to discussing how my skills and experience can contribute to ${company_name}.</p>
          
          <p>Best regards,<br>
          [Your Name]</p>
        </body>
        </html>
      `;

      return await this.sendEmail(telegramId, company_email, subject, emailBody, true);
    } catch (error) {
      console.error('Error sending job application:', error);
      throw error;
    }
  }

  /**
   * Disconnect Gmail (remove tokens)
   */
  async disconnectGmail(telegramId) {
    try {
      const { data, error } = await supabase
        .from('users')
        .update({
          gmail_access_token: null,
          gmail_refresh_token: null,
          gmail_token_expiry: null,
          updated_at: new Date().toISOString()
        })
        .eq('telegram_id', telegramId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      console.log(`Gmail disconnected for user ${telegramId}`);
      return data;
    } catch (error) {
      console.error('Error disconnecting Gmail:', error);
      throw error;
    }
  }
}

module.exports = new OAuthService(); 