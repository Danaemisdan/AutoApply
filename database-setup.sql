-- Database setup script for Telegram Job Bot
-- Run this in your Supabase SQL editor

-- Enable Row Level Security (RLS)
-- Note: You may need to configure RLS policies based on your security requirements

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  telegram_id BIGINT UNIQUE NOT NULL,
  name VARCHAR(255),
  job_preferences TEXT,
  resume_text TEXT,
  resume_filename VARCHAR(255),
  gmail_access_token TEXT,
  gmail_refresh_token TEXT,
  gmail_token_expiry TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,
  telegram_id BIGINT NOT NULL,
  message TEXT NOT NULL,
  response TEXT NOT NULL,
  message_type VARCHAR(50) DEFAULT 'general',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create scraped jobs table
CREATE TABLE IF NOT EXISTS scraped_jobs (
  id SERIAL PRIMARY KEY,
  telegram_id BIGINT NOT NULL,
  job_title TEXT,
  company TEXT,
  job_url TEXT,
  contact_email TEXT,
  scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create gmail OAuth tokens table
CREATE TABLE IF NOT EXISTS gmail_tokens (
  telegram_id BIGINT PRIMARY KEY,
  email TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_conversations_telegram_id ON conversations(telegram_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at);
CREATE INDEX IF NOT EXISTS idx_scraped_jobs_telegram_id ON scraped_jobs(telegram_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Optional: Enable Row Level Security (uncomment if needed)
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Optional: Create policies for RLS (uncomment and modify if using RLS)
-- CREATE POLICY "Users can view own data" ON users FOR SELECT USING (true);
-- CREATE POLICY "Users can insert own data" ON users FOR INSERT WITH CHECK (true);
-- CREATE POLICY "Users can update own data" ON users FOR UPDATE USING (true);
-- CREATE POLICY "Conversations can be viewed" ON conversations FOR SELECT USING (true);
-- CREATE POLICY "Conversations can be inserted" ON conversations FOR INSERT WITH CHECK (true);

-- Verify tables were created
SELECT 
  table_name, 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name IN ('users', 'conversations', 'scraped_jobs')
ORDER BY table_name, ordinal_position; 