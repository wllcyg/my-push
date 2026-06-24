-- hsk_mistakes.sql
-- Create the hsk_mistakes table to store wrong answers for HSK practice

CREATE TABLE IF NOT EXISTS public.hsk_mistakes (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    word_id TEXT NOT NULL,
    level INTEGER NOT NULL,
    wrong_count INTEGER DEFAULT 1,
    last_practiced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, word_id)
);

-- Enable Row Level Security
ALTER TABLE public.hsk_mistakes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own mistakes
CREATE POLICY "Users can view their own HSK mistakes" 
ON public.hsk_mistakes 
FOR SELECT 
USING (auth.uid() = user_id);

-- Policy: Users can insert their own mistakes
CREATE POLICY "Users can insert their own HSK mistakes" 
ON public.hsk_mistakes 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own mistakes
CREATE POLICY "Users can update their own HSK mistakes" 
ON public.hsk_mistakes 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Policy: Users can delete their own mistakes (e.g., when they've mastered the word)
CREATE POLICY "Users can delete their own HSK mistakes" 
ON public.hsk_mistakes 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create an index for faster lookups
CREATE INDEX IF NOT EXISTS hsk_mistakes_user_id_idx ON public.hsk_mistakes(user_id);
