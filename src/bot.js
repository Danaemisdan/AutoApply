console.log("=== JOBFINDERAI: NEW BOT CODE RUNNING (bot.js) ===");

const { Telegraf, Markup } = require('telegraf');
const db = require('./db');
const llm = require('./llm');
const parser = require('./parser');
const gmailOAuth = require('./gmail_oauth');

const userState = {};

class TelegramBot {
  constructor() {
    this.bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
    this.setupMiddleware();
    this.setupHandlers();
  }

  /**
   * Setup bot middleware
   */
  setupMiddleware() {
    // Log all updates
    this.bot.use(async (ctx, next) => {
      const start = new Date();
      await next();
      const ms = new Date() - start;
      console.log(`[${ctx.from?.id}] Response time: %sms`, ms);
    });

    // Error handling middleware
    this.bot.catch((err, ctx) => {
      console.error(`[${ctx.from?.id}] Error:`, err);
      ctx.reply('❌ Sorry, something went wrong. Please try again later.');
    });
  }

  /**
   * Setup message handlers
   */
  setupHandlers() {
    // Entry point: hi or /start
    this.bot.on('text', async (ctx, next) => {
      const telegramId = ctx.from.id.toString();
      const text = ctx.message.text.trim().toLowerCase();
      console.log(`[${telegramId}] Incoming message: ${text}`);
      if (!userState[telegramId]) userState[telegramId] = { step: 'GREETING' };
      const state = userState[telegramId];
      console.log(`[${telegramId}] State: ${state.step}, Message: ${text}`);

      // Step 1: User says 'Hi' or '/start' -> bot asks 'Do you want to apply for jobs?'
      if (text === 'hi' || text === '/start') {
        console.log(`[${telegramId}] Reply: Do you want to apply for jobs?`);
        await ctx.reply('Do you want to apply for jobs?', Markup.keyboard([['Yes', 'No']]).oneTime().resize());
        state.step = 'AWAITING_YESNO';
        return;
      }

      // Step 2: User says 'Yes' -> bot asks for resume
      if (state.step === 'AWAITING_YESNO') {
        if (text === 'yes') {
          await ctx.reply('Send me your resume.', Markup.removeKeyboard());
          state.step = 'AWAITING_RESUME';
        } else if (text === 'no') {
          await ctx.reply('No problem! If you change your mind, just say "hi".');
          state.step = 'GREETING';
        } else {
          await ctx.reply('Please tap Yes or No.');
        }
        return;
      }

      // Step 3: Resume upload (as text)
      if (state.step === 'AWAITING_RESUME' && text.length > 200) {
        await this.handleResume(ctx, telegramId, text, state);
        return;
      }

      // Step 4: After resume processing, ask if user wants to apply
      if (state.step === 'AWAITING_APPLY_DECISION') {
        if (text === 'yes') {
          // Check if Gmail OAuth is already connected
          const gmailStatus = await db.getGmailTokens(telegramId);
          if (!gmailStatus || !gmailStatus.access_token) {
            // Step 5: Ask for Google OAuth
            const baseUrl = process.env.BASE_URL;
            if (!baseUrl) {
              console.error('BASE_URL is not set! Set BASE_URL in your Railway environment variables.');
              await ctx.reply('❌ Server misconfiguration: BASE_URL is not set. Please contact support.');
              return;
            }
            const oauthUrl = `${baseUrl.replace(/\/$/, '')}/auth/gmail/initiate/${telegramId}`.trim();
            console.log(`[${telegramId}] OAuth URL: ${oauthUrl}`);
            await ctx.reply('Sign in with Google is required to proceed.', 
              Markup.inlineKeyboard([
                [Markup.button.url('Sign in with Google', oauthUrl)]
              ])
            );
            state.step = 'AWAITING_OAUTH';
            state.oauthPendingMsg = await ctx.reply('⏳ Waiting for Gmail connection...');
            return;
          } else {
            // Gmail already connected, proceed with applications
            await this.startJobApplications(ctx, telegramId, state);
            return;
          }
        } else if (text === 'no') {
          await ctx.reply('Okay! Let me know if you want to apply later.');
          state.step = 'GREETING';
        } else {
          await ctx.reply('Please tap Yes or No.');
        }
        return;
      }

      // Step 6: Handle OAuth failure retry
      if (state.step === 'AWAITING_OAUTH_RETRY') {
        if (text === 'yes') {
          const baseUrl = process.env.BASE_URL;
          const oauthUrl = `${baseUrl.replace(/\/$/, '')}/auth/gmail/initiate/${telegramId}`.trim();
          await ctx.reply('Sign in with Google is required to proceed.',
            Markup.inlineKeyboard([
              [Markup.button.url('Sign in with Google', oauthUrl)]
            ])
          );
          state.step = 'AWAITING_OAUTH';
          state.oauthPendingMsg = await ctx.reply('⏳ Waiting for Gmail connection...');
        } else {
          await ctx.reply('No problem! You can try again later by saying "hi".');
          state.step = 'GREETING';
        }
        return;
      }

      // Fallback
      await next();
    });

    // Resume upload (as file)
    this.bot.on('document', async (ctx) => {
      const telegramId = ctx.from.id.toString();
      if (!userState[telegramId]) userState[telegramId] = { step: 'AWAITING_RESUME' };
      const state = userState[telegramId];
      if (state.step !== 'AWAITING_RESUME') return;
      
      try {
        const file = await ctx.telegram.getFile(ctx.message.document.file_id);
        const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
        const buffer = await fetch(fileUrl).then(res => res.arrayBuffer());
        const text = await parser.parseFile(Buffer.from(buffer), ctx.message.document.file_name);
        
        // Save resume
        await db.saveResume(telegramId, text, ctx.message.document.file_name);
        
        // Extract key details from resume
        const resumeDetails = await this.extractResumeDetails(text);
        
        // Scrape jobs matching the resume
        const jobs = await require('./scraper/scraper').scrapeRemotiveJobs(telegramId);
        state.jobCount = jobs.length;
        state.resumeDetails = resumeDetails;
        state.step = 'AWAITING_APPLY_DECISION';
        
        await ctx.reply(`I found ${jobs.length} jobs matching your profile. Do you want me to apply to them directly?`,
          Markup.keyboard([['Yes', 'No']]).oneTime().resize()
        );
      } catch (error) {
        console.error(`[${telegramId}] Error parsing resume or scraping jobs:`, error);
        await ctx.reply('❌ Error processing your resume or scraping jobs. Please try again or upload a different file.');
      }
    });
  }

  async handleResume(ctx, telegramId, resumeText, state) {
    try {
      await db.saveResume(telegramId, resumeText, 'uploaded_resume.txt');
      
      // Extract key details from resume
      const resumeDetails = await this.extractResumeDetails(resumeText);
      
      // Scrape jobs matching the resume
      const jobs = await require('./scraper/scraper').scrapeRemotiveJobs(telegramId);
      state.jobCount = jobs.length;
      state.resumeDetails = resumeDetails;
      state.step = 'AWAITING_APPLY_DECISION';
      
      await ctx.reply(`I found ${jobs.length} jobs matching your profile. Do you want me to apply to them directly?`,
        Markup.keyboard([['Yes', 'No']]).oneTime().resize()
      );
    } catch (error) {
      console.error(`[${telegramId}] Error in handleResume:`, error);
      await ctx.reply("Hmm... I couldn't read your resume perfectly. Want to send it again or type your job role and skills manually?");
    }
  }

  async extractResumeDetails(resumeText) {
    try {
      // Use LLM to extract key details from resume
      const prompt = `Extract the following information from this resume in JSON format:
      - name: Full name
      - email: Email address
      - phone: Phone number
      - skills: Array of skills
      - experience: Years of experience
      - jobTitle: Current or desired job title
      
      Resume: ${resumeText}
      
      Return only valid JSON:`;
      
      const response = await llm.generateResponse(prompt);
      const details = JSON.parse(response);
      return details;
    } catch (error) {
      console.error('Error extracting resume details:', error);
      return {
        name: 'User',
        email: '',
        phone: '',
        skills: ['General'],
        experience: '1+ years',
        jobTitle: 'Professional'
      };
    }
  }

  async startJobApplications(ctx, telegramId, state) {
    try {
      await ctx.reply('Gmail connected successfully. Starting job applications now...');
      
      // Get resume and job count
      const resume = await db.getResume(telegramId);
      const jobCount = state.jobCount || 20;
      
      // Send applications with real-time updates
      let appliedCount = 0;
      const maxApplications = Math.min(jobCount, 25); // Limit to 25 applications
      
      for (let i = 1; i <= maxApplications; i++) {
        try {
          await ctx.reply(`Applying to Job ${i} of ${maxApplications}...`);
          
          // Send email using Gmail API
          const sent = await require('./scraper/emailer').sendEmailsToScrapedJobs(telegramId, resume.resume_text, 1);
          if (sent > 0) {
            appliedCount++;
          }
          
          // Small delay between applications
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error) {
          console.error(`[${telegramId}] Error applying to job ${i}:`, error);
          await ctx.reply(`❌ Failed to apply to Job ${i}. Skipping to next...`);
        }
      }
      
      await ctx.reply(`🎉 Done! Applied to ${appliedCount} jobs. Check your Gmail Sent folder!`);
      state.step = 'DONE';
      
    } catch (error) {
      console.error(`[${telegramId}] Error in startJobApplications:`, error);
      await ctx.reply('❌ Error starting job applications. Please try again.');
      state.step = 'GREETING';
    }
  }

  /**
   * Launch the bot
   */
  launch() {
    console.log('🤖 Starting Telegram bot...');
    console.log('Bot BASE_URL:', process.env.BASE_URL);
    this.bot.launch();
    console.log('✅ Bot is running!');
    
    // Enable graceful stop
    process.once('SIGINT', () => this.bot.stop('SIGINT'));
    process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
  }

  /**
   * Get bot instance
   */
  getBot() {
    return this.bot;
  }

  // Static methods for OAuth callbacks
  static async handleOAuthSuccess(telegramId) {
    try {
      const state = userState[telegramId];
      if (!state) {
        console.log(`[${telegramId}] No state found for OAuth success`);
        return;
      }

      // Create a mock context for sending messages
      const bot = new TelegramBot();
      const mockCtx = {
        reply: (msg) => bot.bot.telegram.sendMessage(telegramId, msg)
      };

      // Update OAuth pending message if it exists
      if (state.oauthPendingMsg) {
        try {
          await bot.bot.telegram.editMessageText(
            state.oauthPendingMsg.chat.id,
            state.oauthPendingMsg.message_id,
            null,
            '✅ Gmail connected successfully!'
          );
        } catch (error) {
          console.error(`[${telegramId}] Error updating OAuth message:`, error);
        }
      }

      // Continue with job applications
      if (state.step === 'AWAITING_OAUTH') {
        state.step = 'OAUTH_SUCCESS';
        // Start job applications automatically
        await bot.startJobApplications(mockCtx, telegramId, state);
      }
    } catch (error) {
      console.error(`[${telegramId}] Error in handleOAuthSuccess:`, error);
    }
  }

  static async handleOAuthFailure(telegramId) {
    try {
      const state = userState[telegramId];
      if (!state) return;

      const bot = new TelegramBot();

      // Update OAuth pending message if it exists
      if (state.oauthPendingMsg) {
        try {
          await bot.bot.telegram.editMessageText(
            state.oauthPendingMsg.chat.id,
            state.oauthPendingMsg.message_id,
            null,
            '❌ Gmail connection failed.'
          );
        } catch (error) {
          console.error(`[${telegramId}] Error updating OAuth failure message:`, error);
        }
      }

      // Ask user to retry
      await bot.bot.telegram.sendMessage(
        telegramId,
        'Sign in with Google is required to proceed. Would you like to try again?',
        Markup.keyboard([['Yes', 'No']]).oneTime().resize()
      );
      state.step = 'AWAITING_OAUTH_RETRY';
    } catch (error) {
      console.error(`[${telegramId}] Error in handleOAuthFailure:`, error);
    }
  }
}

module.exports = TelegramBot;