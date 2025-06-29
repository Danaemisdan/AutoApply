const db = require('../db');
const oauth = require('../oauth');

/**
 * Send emails to all scraped job contacts for a user using their Gmail
 * @param {string|number} telegramId
 * @param {string} resumeText
 * @returns {Promise<number>} Number of emails sent
 */
async function sendEmailsToScrapedJobs(telegramId, resumeText) {
  // Get jobs for this user
  const jobs = await db.getScrapedJobs(telegramId);
  let sent = 0;
  for (const job of jobs) {
    if (!job.contact_email) continue;
    const subject = `Application for ${job.job_title} at ${job.company}`;
    const body = `Hi,\n\nI'm interested in the ${job.job_title} role at ${job.company}. Please find my resume below.\n\n${resumeText}\n\nBest regards,\n`;
    try {
      await oauth.sendEmail(telegramId, job.contact_email, subject, body);
      sent++;
    } catch (e) {
      // Log and skip
      console.error('Failed to send email to', job.contact_email, e.message);
    }
  }
  return sent;
}

module.exports = { sendEmailsToScrapedJobs }; 