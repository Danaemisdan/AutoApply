const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase configuration. Please check your environment variables.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

class Database {
  /**
   * Get or create user profile
   */
  async getUserProfile(telegramId) {
    try {
      // Check if user exists
      const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('telegram_id', telegramId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      if (existingUser) {
        return existingUser;
      }

      // Create new user
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([
          {
            telegram_id: telegramId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ])
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      return newUser;
    } catch (error) {
      console.error('Error in getUserProfile:', error);
      throw error;
    }
  }

  /**
   * Update user profile with name and job preferences
   */
  async updateUserProfile(telegramId, updates) {
    try {
      const { data, error } = await supabase
        .from('users')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('telegram_id', telegramId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in updateUserProfile:', error);
      throw error;
    }
  }

  /**
   * Save user's resume
   */
  async saveResume(telegramId, resumeText, fileName = null) {
    try {
      const { data, error } = await supabase
        .from('users')
        .update({
          resume_text: resumeText,
          resume_filename: fileName,
          updated_at: new Date().toISOString()
        })
        .eq('telegram_id', telegramId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in saveResume:', error);
      throw error;
    }
  }

  /**
   * Save conversation message
   */
  async saveConversation(telegramId, message, response, messageType = 'general') {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .insert([
          {
            telegram_id: telegramId,
            message: message,
            response: response,
            message_type: messageType,
            created_at: new Date().toISOString()
          }
        ])
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in saveConversation:', error);
      throw error;
    }
  }

  /**
   * Get user's conversation history
   */
  async getConversationHistory(telegramId, limit = 10) {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('telegram_id', telegramId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      return data.reverse(); // Return in chronological order
    } catch (error) {
      console.error('Error in getConversationHistory:', error);
      throw error;
    }
  }

  /**
   * Get user's resume
   */
  async getResume(telegramId) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('resume_text, resume_filename')
        .eq('telegram_id', telegramId)
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in getResume:', error);
      throw error;
    }
  }

  /**
   * Check if user has a resume
   */
  async hasResume(telegramId) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('resume_text')
        .eq('telegram_id', telegramId)
        .single();

      if (error) {
        throw error;
      }

      return data.resume_text && data.resume_text.trim().length > 0;
    } catch (error) {
      console.error('Error in hasResume:', error);
      return false;
    }
  }

  /**
   * Save a scraped job to the database
   */
  async saveScrapedJob(job) {
    const { telegram_id, job_title, company, job_url, contact_email, scraped_at } = job;
    await supabase
      .from('scraped_jobs')
      .insert([
        { telegram_id, job_title, company, job_url, contact_email, scraped_at }
      ]);
  }

  /**
   * Get all scraped jobs for a user
   */
  async getScrapedJobs(telegramId) {
    const { data } = await supabase
      .from('scraped_jobs')
      .select('*')
      .eq('telegram_id', telegramId);
    return data || [];
  }
}

module.exports = new Database(); 