-- ============================================
-- HumaLation Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Users / Subscribers table
CREATE TABLE IF NOT EXISTS users (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email                 TEXT UNIQUE NOT NULL,
  plan                  TEXT DEFAULT 'free' CHECK (plan IN ('free','basic_monthly','pro_monthly','lifetime')),
  languages             INTEGER DEFAULT 5,
  bundle                BOOLEAN DEFAULT false,
  lifetime              BOOLEAN DEFAULT false,
  active                BOOLEAN DEFAULT false,
  stripe_customer_id    TEXT,
  stripe_subscription_id TEXT,
  expires_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

-- Usage logs table
CREATE TABLE IF NOT EXISTS usage_logs (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email             TEXT NOT NULL,
  action            TEXT NOT NULL DEFAULT 'translate',
  languages_count   INTEGER DEFAULT 0,
  elapsed_seconds   FLOAT DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_usage_email_date ON usage_logs(email, created_at);

-- Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

-- Service role has full access (for API)
CREATE POLICY "Service role full access - users"
  ON users FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access - usage_logs"
  ON usage_logs FOR ALL
  USING (auth.role() = 'service_role');

-- Monthly usage view (useful for dashboard)
CREATE OR REPLACE VIEW monthly_usage AS
SELECT
  email,
  DATE_TRUNC('month', created_at) AS month,
  COUNT(*) AS translation_count,
  SUM(languages_count) AS total_languages,
  AVG(elapsed_seconds) AS avg_seconds
FROM usage_logs
WHERE action = 'translate'
GROUP BY email, DATE_TRUNC('month', created_at)
ORDER BY month DESC;

-- Admin stats view
CREATE OR REPLACE VIEW admin_stats AS
SELECT
  COUNT(*) FILTER (WHERE plan = 'free') AS free_users,
  COUNT(*) FILTER (WHERE plan = 'basic_monthly' AND active = true) AS basic_active,
  COUNT(*) FILTER (WHERE plan = 'pro_monthly' AND active = true) AS pro_active,
  COUNT(*) FILTER (WHERE plan = 'lifetime') AS lifetime_users,
  COUNT(*) FILTER (WHERE active = true) AS total_active
FROM users;
