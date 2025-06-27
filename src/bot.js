const { Telegraf } = require('telegraf');
const db = require('./db');
const llm = require('./llm');
const parser = require('./parser');
const oauth = require('./oauth');

class TelegramBot {
  constructor() {
    this.bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
    this.setupMiddleware();
    this.setupCommands();
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
      console.log('Response time: %sms', ms);
    });

    // Error handling middleware
    this.bot.catch((err, ctx) => {
      console.error(`Error for ${ctx.updateType}:`, err);
      ctx.reply('❌ Sorry, something went wrong. Please try again later.');
    });
  }

  /**
   * Setup bot commands
   */
  setupCommands() {
    // Start command
    this.bot.start(async (ctx) => {
      try {
        const telegramId = ctx.from.id;
        // Get or create user profile
        await db.getUserProfile(telegramId);
        const welcomeMessage = `👋 Welcome to *JobfinderAI*, your AI-powered job application assistant!

🚀 Upload your resume to start applying for *1000s of jobs and freelance projects* in your field — automatically.

📄 Just send me your resume (PDF, DOCX, or text) to get started.`;
        await ctx.reply(welcomeMessage, { parse_mode: 'Markdown' });
        await db.saveConversation(telegramId, '/start', welcomeMessage, 'command');
      } catch (error) {
        console.error('Error in start command:', error);
        await ctx.reply('❌ Sorry, there was an error setting up your profile. Please try again.');
      }
    });

    // Help command
    this.bot.help(async (ctx) => {
      const telegramId = ctx.from.id;
      
      const helpMessage = `🤖 **Job Application Bot Help**

**Commands:**
📄 \`/resume\` - Upload or paste your resume
💼 \`/apply [job description]\` - Generate cover letter
🔍 \`/jobs\` - Get job suggestions
📧 \`/connectgmail\` - Connect your Gmail account
📤 \`/sendapplication\` - Send job application via email
ℹ️ \`/help\` - Show this help

**How to use:**
1. Start by uploading your resume with \`/resume\`
2. Use \`/apply\` followed by a job description to generate a cover letter
3. Use \`/jobs\` to get personalized job suggestions
4. Connect your Gmail with \`/connectgmail\` for auto-applying
5. Use \`/sendapplication\` to send applications via email

**Supported file types:** PDF, DOCX, TXT (max 10MB)

**Example:**
\`/apply Software Engineer position at Google focusing on React and Node.js development\`

Need more help? Just ask!`;

      await ctx.reply(helpMessage, { parse_mode: 'Markdown' });
      await db.saveConversation(telegramId, '/help', helpMessage, 'command');
    });

    // Resume command
    this.bot.command('resume', async (ctx) => {
      const telegramId = ctx.from.id;
      
      const resumeMessage = `📄 **Resume Upload**

Please upload your resume file (PDF, DOCX, or TXT) or paste your resume text.

**Supported formats:**
• PDF files
• Word documents (DOCX)
• Text files (TXT)
• Plain text (just paste it)

**File size limit:** 10MB

Once uploaded, I'll extract the text and save it for generating cover letters and job suggestions.`;

      await ctx.reply(resumeMessage, { parse_mode: 'Markdown' });
      await db.saveConversation(telegramId, '/resume', resumeMessage, 'command');
    });

    // Apply command
    this.bot.command('apply', async (ctx) => {
      const telegramId = ctx.from.id;
      const jobDescription = ctx.message.text.replace('/apply', '').trim();
      
      if (!jobDescription) {
        const errorMessage = `❌ **Missing job description**

Please provide a job description after the /apply command.

**Example:**
\`/apply Software Engineer at Google focusing on React development\`

**Or use:** \`/apply [paste job description here]\``;
        
        await ctx.reply(errorMessage, { parse_mode: 'Markdown' });
        return;
      }

      try {
        // Check if user has a resume
        const hasResume = await db.hasResume(telegramId);
        if (!hasResume) {
          const noResumeMessage = `❌ **No resume found**

Please upload your resume first using /resume before generating a cover letter.`;
          
          await ctx.reply(noResumeMessage, { parse_mode: 'Markdown' });
          return;
        }

        // Send loading message
        const loadingMsg = await ctx.reply('🧠 Generating your cover letter...please wait.');
        
        // Get user's resume
        const resumeData = await db.getResume(telegramId);
        const userProfile = await db.getUserProfile(telegramId);
        
        // Generate cover letter
        const coverLetter = await llm.generateCoverLetter(
          resumeData.resume_text,
          jobDescription,
          userProfile.job_preferences || ''
        );

        // Delete loading message
        await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);
        
        // Send cover letter
        const successMessage = `✅ **Cover Letter Generated Successfully!**

Here's your personalized cover letter for the position:

---

${coverLetter}

---

💡 **Tips:**
• Review and customize the letter before sending
• Add specific company details if needed
• Keep it professional and concise

Need to generate another cover letter? Just use /apply with a different job description!`;

        await ctx.reply(successMessage, { parse_mode: 'Markdown' });
        
        // Save conversation
        await db.saveConversation(telegramId, jobDescription, coverLetter, 'cover_letter');
        
      } catch (error) {
        console.error('Error in apply command:', error);
        await ctx.reply('❌ Sorry, there was an error generating your cover letter. Please try again.');
      }
    });

    // Jobs command
    this.bot.command('jobs', async (ctx) => {
      const telegramId = ctx.from.id;
      
      try {
        // Send loading message
        const loadingMsg = await ctx.reply('🔍 Finding relevant jobs for you...');
        
        // Get user profile and resume
        const userProfile = await db.getUserProfile(telegramId);
        const resumeData = await db.getResume(telegramId);
        
        // Generate job suggestions
        const jobSuggestions = await llm.generateJobSuggestions(
          userProfile.job_preferences || '',
          resumeData.resume_text || ''
        );

        // Delete loading message
        await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);
        
        // Format and send job suggestions
        const jobsMessage = `💼 **Job Suggestions for You**

${jobSuggestions}

💡 **Want more specific suggestions?**
Update your job preferences by telling me what type of roles you're looking for!`;

        await ctx.reply(jobsMessage, { parse_mode: 'Markdown' });
        
        // Save conversation
        await db.saveConversation(telegramId, '/jobs', jobSuggestions, 'job_suggestions');
        
      } catch (error) {
        console.error('Error in jobs command:', error);
        await ctx.reply('❌ Sorry, there was an error finding jobs. Please try again.');
      }
    });

    // Connect Gmail command
    this.bot.command('connectgmail', async (ctx) => {
      const telegramId = ctx.from.id;
      try {
        const isConnected = await oauth.isGmailConnected(telegramId);
        if (isConnected) {
          const gmailConnected = `✅ Gmail connected successfully!

📧 Now I can start sending job applications directly from your email.

🔄 Sit back and relax — your applications are on their way. I'll keep you updated here.`;
          await ctx.reply(gmailConnected);
          return;
        }
        const oauthURL = oauth.getAuthURL(telegramId);
        const connectMessage = `🔗 Connect your Gmail to start sending job applications automatically.

👉 Click below to connect:
${oauthURL}`;
        await ctx.reply(connectMessage);
        await db.saveConversation(telegramId, '/connectgmail', connectMessage, 'oauth');
      } catch (error) {
        console.error('Error in connectgmail command:', error);
        const oauthURL = oauth.getAuthURL(telegramId);
        const gmailFailed = `❌ Gmail connection failed.

Please try again by clicking the link below:
${oauthURL}

Or type /connectgmail to retry.`;
        await ctx.reply(gmailFailed);
      }
    });

    // Send application command
    this.bot.command('sendapplication', async (ctx) => {
      const telegramId = ctx.from.id;
      const messageText = ctx.message.text.replace('/sendapplication', '').trim();
      
      if (!messageText) {
        const helpMessage = `📤 **Send Job Application**

To send a job application via email, please provide the job details in this format:

\`/sendapplication Company Name|job@company.com|Software Engineer|Your cover letter here\`

**Example:**
\`/sendapplication Google|jobs@google.com|Software Engineer|I am excited to apply for the Software Engineer position...\`

**Requirements:**
• Gmail must be connected (\`/connectgmail\`)
• Resume must be uploaded (\`/resume\`)
• Job details must be provided

**Format:** Company|Email|Job Title|Cover Letter`;
        
        await ctx.reply(helpMessage, { parse_mode: 'Markdown' });
        return;
      }

      try {
        // Check if Gmail is connected
        const isConnected = await oauth.isGmailConnected(telegramId);
        if (!isConnected) {
          const notConnectedMessage = `❌ **Gmail Not Connected**

Please connect your Gmail account first using \`/connectgmail\` before sending applications.`;
          
          await ctx.reply(notConnectedMessage, { parse_mode: 'Markdown' });
          return;
        }

        // Check if user has a resume
        const hasResume = await db.hasResume(telegramId);
        if (!hasResume) {
          const noResumeMessage = `❌ **No Resume Found**

Please upload your resume first using \`/resume\` before sending applications.`;
          
          await ctx.reply(noResumeMessage, { parse_mode: 'Markdown' });
          return;
        }

        // Parse job details
        const parts = messageText.split('|');
        if (parts.length < 4) {
          const errorMessage = '❌ **Invalid Format**\n\nPlease use the format: Company|Email|Job Title|Cover Letter\n\n**Example:**\n`/sendapplication Google|jobs@google.com|Software Engineer|I am excited to apply...`';
          await ctx.reply(errorMessage, { parse_mode: 'Markdown' });
          return;
        }

        const [companyName, companyEmail, jobTitle, coverLetter] = parts;

        // Send loading message
        const loadingMsg = await ctx.reply('📤 Sending your job application...please wait.');
        
        // Send the application
        const jobDetails = {
          company_name: companyName,
          company_email: companyEmail,
          job_title: jobTitle
        };

        await oauth.sendJobApplication(telegramId, jobDetails, coverLetter);

        // Delete loading message
        await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);
        
        // Success message
        const successMessage = `✅ **Job Application Sent Successfully!**

📧 **Sent to:** ${companyEmail}
🏢 **Company:** ${companyName}
💼 **Position:** ${jobTitle}

Your application has been sent from your Gmail account. You should receive a confirmation email shortly.

**Next steps:**
• Follow up with the company in a few days
• Check your email for any responses
• Use \`/jobs\` to find more opportunities`;

        await ctx.reply(successMessage, { parse_mode: 'Markdown' });
        await db.saveConversation(telegramId, `Sent application to ${companyName}`, 'Application sent successfully', 'email_sent');
        
      } catch (error) {
        console.error('Error in sendapplication command:', error);
        await ctx.reply('❌ Sorry, there was an error sending your application. Please check your Gmail connection and try again.');
      }
    });

    // Disconnect Gmail command
    this.bot.command('disconnectgmail', async (ctx) => {
      const telegramId = ctx.from.id;
      
      try {
        // Check if Gmail is connected
        const isConnected = await oauth.isGmailConnected(telegramId);
        
        if (!isConnected) {
          const notConnectedMessage = `📧 **Gmail Not Connected**

Your Gmail account is not currently connected to the bot.

To connect Gmail, use \`/connectgmail\``;
          
          await ctx.reply(notConnectedMessage, { parse_mode: 'Markdown' });
          return;
        }

        // Disconnect Gmail
        await oauth.disconnectGmail(telegramId);
        
        const disconnectMessage = `✅ **Gmail Disconnected Successfully**

Your Gmail account has been disconnected from the bot.

**What this means:**
• No more automatic email sending
• Your Gmail tokens have been removed
• You can reconnect anytime with \`/connectgmail\`

To reconnect Gmail, use \`/connectgmail\``;
        
        await ctx.reply(disconnectMessage, { parse_mode: 'Markdown' });
        await db.saveConversation(telegramId, '/disconnectgmail', 'Gmail disconnected', 'oauth');
        
      } catch (error) {
        console.error('Error in disconnectgmail command:', error);
        await ctx.reply('❌ Sorry, there was an error disconnecting Gmail. Please try again.');
      }
    });
  }

  /**
   * Setup message handlers
   */
  setupHandlers() {
    // Handle document uploads (resume files)
    this.bot.on('document', async (ctx) => {
      const telegramId = ctx.from.id.toString();
      const document = ctx.message.document;
      try {
        // Download file
        const file = await ctx.telegram.getFile(document.file_id);
        const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
        const buffer = await fetch(fileUrl).then(res => res.arrayBuffer());
        const text = await require('./parser').parseFile(Buffer.from(buffer), document.file_name);
        await require('./db').saveResume(telegramId, text, document.file_name);
        // Basic resume quality check
        let jobCount = 10; // Placeholder, replace with actual job count logic if available
        let resumeMsg;
        if (text && text.length > 400) {
          resumeMsg = `✅ Your resume looks great, nice work!

🔍 I've found *${jobCount} job opportunities* in your domain.

🔗 Now, let's connect your Gmail to start sending job applications automatically.

👉 Click below to connect:\n${require('./oauth').getAuthURL(telegramId)}`;
        } else {
          resumeMsg = `⚠️ Your resume seems a bit messy or incomplete.\n\nBut no worries — we can still proceed!

🔍 I've found *${jobCount} job opportunities* in your field.

🔗 Let's connect your Gmail to start applying instantly.

👉 Click below to connect:\n${require('./oauth').getAuthURL(telegramId)}`;
        }
        await ctx.reply(resumeMsg, { parse_mode: 'Markdown' });
        await require('./db').saveConversation(telegramId, '[Resume Uploaded]', resumeMsg, 'resume_upload');
      } catch (error) {
        console.error('Error processing document:', error);
        await ctx.reply('❌ Error processing your resume. Please try again.');
      }
    });

    // Handle all text messages (conversational flow)
    this.bot.on('text', async (ctx) => {
      const telegramId = ctx.from.id.toString();
      const message = ctx.message.text.trim();
      try {
        // 1. Get user context
        const db = require('./db');
        const user = await db.getUserProfile(telegramId);
        // 2. If no resume, treat this as pasted resume if long enough
        if (!user.resume_text || user.resume_text.length < 50) {
          if (message.length > 200) {
            await db.saveResume(telegramId, message, 'pasted_text.txt');
            await ctx.reply('✅ Got your resume! Now tell me — what kind of job are you looking for? (e.g., Marketing manager in Bangalore)');
            await db.saveConversation(telegramId, message, 'Resume saved', 'resume_text');
          } else {
            await ctx.reply('📄 Please upload your resume (PDF, DOCX, TXT) or paste your resume text here.');
          }
          return;
        }
        // 3. If no job preferences, treat this message as preferences
        if (!user.job_preferences) {
          await db.updateUserProfile(telegramId, { job_preferences: message });
          await ctx.reply(`✅ Job Preferences Saved!\n\nYour preferences: "${message}"\n\nNow, to apply for jobs automatically, please connect your Gmail account.`);
          await db.saveConversation(telegramId, message, 'Job preferences saved', 'preferences');
          // Continue to Gmail check below
        }
        // Refresh user context after possible update
        const updatedUser = await db.getUserProfile(telegramId);
        // 4. If Gmail not connected, ask to connect
        if (!updatedUser.gmail_access_token) {
          const oauthURL = require('./oauth').getAuthURL(telegramId);
          await ctx.reply(`✉️ To apply for jobs, please connect your Gmail: ${oauthURL}`);
          await db.saveConversation(telegramId, message, 'Asked for Gmail OAuth', 'oauth');
          return;
        }
        // 5. If all info present, generate cover letter and send email
        await ctx.reply('🧠 Generating your cover letter...');
        const llm = require('./llm');
        const coverLetter = await llm.generateCoverLetter(
          updatedUser.resume_text,
          updatedUser.job_preferences
        );
        await ctx.reply(`✅ Here's your cover letter:\n\n${coverLetter}`);
        await ctx.reply('📧 Please provide the job details in this format:\n\nCompany Name|job@company.com|Job Title');
        // Wait for next message with job details
        this.bot.once('text', async (ctx2) => {
          const jobDetailsMsg = ctx2.message.text.trim();
          const parts = jobDetailsMsg.split('|');
          if (parts.length < 3) {
            await ctx2.reply('❌ Invalid format. Please use: Company Name|job@company.com|Job Title');
            return;
          }
          const [companyName, companyEmail, jobTitle] = parts;
          await ctx2.reply('📤 Sending your job application...');
          try {
            await require('./oauth').sendJobApplication(
              telegramId,
              { company_name: companyName, company_email: companyEmail, job_title: jobTitle },
              coverLetter
            );
            await ctx2.reply('📧 Application sent successfully!');
            await db.saveConversation(telegramId, jobDetailsMsg, 'Application sent', 'email_sent');
          } catch (err) {
            console.error('Error sending email:', err);
            await ctx2.reply('❌ Failed to send application. Please check your Gmail connection and try again.');
          }
        });
      } catch (error) {
        console.error('Error in conversational flow:', error);
        await ctx.reply('❌ Sorry, there was an error processing your message. Please try again.');
      }
    });
  }

  /**
   * Launch the bot
   */
  launch() {
    console.log('🤖 Starting Telegram bot...');
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