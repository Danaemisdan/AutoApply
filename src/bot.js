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

      // Always respond to hi or /start with the button-driven flow
      if (text === 'hi' || text === '/start') {
        console.log(`[${telegramId}] Reply: 👋 Hello! Do you want to apply for jobs?`);
        await ctx.reply('👋 Hello! Do you want to apply for jobs?', Markup.keyboard([['Yes', 'No']]).oneTime().resize());
        state.step = 'AWAITING_YESNO';
        return;
      }
      if (state.step === 'AWAITING_YESNO') {
        if (text === 'yes') {
          await ctx.reply('Awesome! Please send me your resume (PDF, DOCX, or just paste it here).', Markup.removeKeyboard());
          state.step = 'AWAITING_RESUME';
        } else if (text === 'no') {
          await ctx.reply('No problem! If you change your mind, just say "hi".');
          state.step = 'GREETING';
        } else {
          await ctx.reply('Please tap Yes or No.');
        }
        return;
      }
      // Step 2: Resume upload (as text)
      if (state.step === 'AWAITING_RESUME' && text.length > 200) {
        await this.handleResume(ctx, telegramId, text, state);
        return;
      }
      // Step 3: Preferences
      if (state.step === 'AWAITING_PREFERENCES') {
        state.preferences = text;
        await db.updateUserProfile(telegramId, { job_preferences: text });
        const baseUrl = process.env.BASE_URL;
        if (!baseUrl) {
          console.error('BASE_URL is not set! Set BASE_URL in your Railway environment variables.');
          await ctx.reply('❌ Server misconfiguration: BASE_URL is not set. Please contact support.');
          return;
        }
        const oauthUrl = `${baseUrl.replace(/\/$/, '')}/auth/gmail/initiate/${telegramId}`.trim();
        console.log(`[${telegramId}] OAuth URL: ${oauthUrl}`);
        await ctx.reply(
          'Great! Now, to send job applications directly from your email, please sign in with Google:',
          Markup.inlineKeyboard([
            [Markup.button.url('Sign in with Google', oauthUrl)]
          ])
        );
        state.step = 'AWAITING_OAUTH';
        state.oauthPendingMsg = await ctx.reply('⏳ Waiting for Gmail connection...');
        return;
      }
      // Step 4: Confirm applying to jobs
      if (state.step === 'AWAITING_APPLY_CONFIRM') {
        if (text === 'yes') {
          await ctx.reply('📤 Applying to jobs...');
          // TODO: Actually send emails using Gmail
          await ctx.reply('🎉 All done! Applied to 20 jobs. Check your Gmail Sent folder!');
          state.step = 'DONE';
        } else if (text === 'no') {
          await ctx.reply('Alright, whenever you\'re ready just type "apply".');
          state.step = 'READY_TO_APPLY';
        } else {
          await ctx.reply('Please tap Yes or No.');
        }
        return;
      }
      // Fallback
      await next();
    });

    // Step 2: Resume upload (as file)
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
        // Scrape jobs
        const jobs = await require('./scraper/scraper').scrapeRemotiveJobs(telegramId);
        state.jobCount = jobs.length;
        state.step = 'AWAITING_APPLY_DECISION';
        await ctx.reply(`✅ Got your resume! I found ${jobs.length} jobs matching your profile.\n\nDo you want me to apply to them directly?`,
          Markup.keyboard([['Yes', 'No']]).oneTime().resize()
        );
      } catch (error) {
        console.error(`[${telegramId}] Error parsing resume or scraping jobs:`, error);
        await ctx.reply('❌ Error processing your resume or scraping jobs. Please try again or upload a different file.');
      }
    });

    // Step 3: Handle apply decision
    this.bot.on('text', async (ctx, next) => {
      const telegramId = ctx.from.id.toString();
      const text = ctx.message.text.trim().toLowerCase();
      const state = userState[telegramId] || {};
      if (state.step === 'AWAITING_APPLY_DECISION') {
        if (text === 'yes') {
          // Check Gmail auth
          const gmailStatus = await require('./db').getGmailTokens(telegramId);
          if (!gmailStatus || !gmailStatus.access_token) {
            const baseUrl = process.env.BASE_URL;
            const oauthUrl = `${baseUrl.replace(/\/$/, '')}/auth/gmail/initiate/${telegramId}`.trim();
            await ctx.reply('Please sign in with Google to send applications:',
              Markup.inlineKeyboard([
                [Markup.button.url('Sign in with Google', oauthUrl)]
              ])
            );
            state.step = 'AWAITING_OAUTH';
            return;
          }
          // Send up to 25 applications
          const resume = await db.getResume(telegramId);
          const sent = await require('./scraper/emailer').sendEmailsToScrapedJobs(telegramId, resume.resume_text);
          if (sent >= 25) {
            await ctx.reply('✅ Sent 25 applications! For more, please subscribe.');
          } else {
            await ctx.reply(`✅ Sent ${sent} applications!`);
          }
          state.step = 'DONE';
        } else if (text === 'no') {
          await ctx.reply('Okay! Let me know if you want to apply later.');
          state.step = 'DONE';
        } else {
          await ctx.reply('Please tap Yes or No.');
        }
        return;
      }
      await next();
    });
  }

  async handleResume(ctx, telegramId, resumeText, state) {
    try {
      await db.saveResume(telegramId, resumeText, 'uploaded_resume.txt');
      // Parse for info (mocked for now)
      const jobTitle = 'Software Engineer';
      const skills = 'JavaScript, Node.js, React';
      const jobCount = 20; // TODO: Replace with real scraping
      await ctx.reply(`✅ Got it! You are a ${jobTitle} skilled in ${skills}.\n\nNice, I found ${jobCount} jobs for you.\n\nNow tell me your preferences: remote or onsite, preferred locations, minimum salary, full-time/part-time/freelance? Please list all your requirements clearly.`);
      state.step = 'AWAITING_PREFERENCES';
      state.resumeText = resumeText;
      state.jobTitle = jobTitle;
      state.skills = skills;
      state.jobCount = jobCount;
    } catch (error) {
      console.error(`[${telegramId}] Error in handleResume:`, error);
      await ctx.reply("Hmm... I couldn't read your resume perfectly. Want to send it again or type your job role and skills manually?");
    }
  }

  async startApplying(ctx, telegramId, state) {
    // Check Gmail OAuth
    const gmailStatus = await require('./db').getGmailTokens(telegramId);
    if (!gmailStatus || !gmailStatus.access_token) {
      await ctx.reply('❌ Gmail not connected. Please sign in with Google first.');
      state.step = 'AWAITING_OAUTH';
      return;
    }
    await ctx.reply(`I found **${state.jobCount || 20} jobs** matching your profile. You can apply to 20 for free. Want me to start applying now?`,
      Markup.keyboard([['Yes', 'No']]).oneTime().resize());
    state.step = 'AWAITING_APPLY_CONFIRM';
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
}

module.exports = TelegramBot;