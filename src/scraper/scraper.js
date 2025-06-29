const fetch = require('node-fetch');
const db = require('../db');

/**
 * Scrape recent jobs from Remotive API (last 10 days)
 * @param {string|number} telegramId
 * @returns {Promise<Array>} Array of job objects
 */
async function scrapeRemotiveJobs(telegramId) {
  const url = 'https://remotive.com/api/remote-jobs';
  const res = await fetch(url);
  const data = await res.json();
  const jobs = (data.jobs || []).filter(job => {
    // Only jobs posted in last 10 days
    const posted = new Date(job.publication_date);
    const now = new Date();
    const daysAgo = (now - posted) / (1000 * 60 * 60 * 24);
    return daysAgo <= 10;
  });

  // Save jobs to DB
  for (const job of jobs) {
    await db.saveScrapedJob({
      telegram_id: telegramId,
      job_title: job.title,
      company: job.company_name,
      job_url: job.url,
      contact_email: job.candidate_required_location || '', // Remotive doesn't always have email
      scraped_at: new Date()
    });
  }
  return jobs;
}

module.exports = { scrapeRemotiveJobs }; 