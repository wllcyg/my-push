-- database_stats.sql
-- Create the user_daily_activity table for the Heatmap feature

CREATE TABLE IF NOT EXISTS user_daily_activity (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    activity_count INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Enable RLS
ALTER TABLE user_daily_activity ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users/anon keys from backend to manage (since backend handles increments)
CREATE POLICY "Enable all for user_daily_activity" ON user_daily_activity
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Ensure user_stats has correct policies just in case it doesn't
CREATE POLICY "Enable all for user_stats" ON user_stats
    FOR ALL
    USING (true)
    WITH CHECK (true);
