-- Safe Migration Script v2 - Handles pre-existing objects gracefully
-- This script can be run multiple times without errors

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing policies first to avoid conflicts
DO $$ 
BEGIN
    -- Drop policies for experiments table
    DROP POLICY IF EXISTS "Users can view own experiments" ON experiments;
    DROP POLICY IF EXISTS "Users can insert own experiments" ON experiments;
    DROP POLICY IF EXISTS "Users can update own experiments" ON experiments;
    DROP POLICY IF EXISTS "Users can delete own experiments" ON experiments;
    
    -- Drop policies for tags table
    DROP POLICY IF EXISTS "Users can view own tags" ON tags;
    DROP POLICY IF EXISTS "Users can insert own tags" ON tags;
    DROP POLICY IF EXISTS "Users can update own tags" ON tags;
    DROP POLICY IF EXISTS "Users can delete own tags" ON tags;
    
    -- Drop policies for experiment_tags table
    DROP POLICY IF EXISTS "Users can view own experiment_tags" ON experiment_tags;
    DROP POLICY IF EXISTS "Users can insert own experiment_tags" ON experiment_tags;
    DROP POLICY IF EXISTS "Users can delete own experiment_tags" ON experiment_tags;
    
    -- Drop policies for protocols table
    DROP POLICY IF EXISTS "Users can view own protocols" ON protocols;
    DROP POLICY IF EXISTS "Users can insert own protocols" ON protocols;
    DROP POLICY IF EXISTS "Users can update own protocols" ON protocols;
    DROP POLICY IF EXISTS "Users can delete own protocols" ON protocols;
    
    -- Drop policies for files table
    DROP POLICY IF EXISTS "Users can view own files" ON files;
    DROP POLICY IF EXISTS "Users can insert own files" ON files;
    DROP POLICY IF EXISTS "Users can update own files" ON files;
    DROP POLICY IF EXISTS "Users can delete own files" ON files;
    
    -- Drop policies for results table
    DROP POLICY IF EXISTS "Users can view own results" ON results;
    DROP POLICY IF EXISTS "Users can insert own results" ON results;
    DROP POLICY IF EXISTS "Users can update own results" ON results;
    DROP POLICY IF EXISTS "Users can delete own results" ON results;
EXCEPTION
    WHEN undefined_table THEN
        NULL; -- Table doesn't exist yet, that's fine
    WHEN undefined_object THEN
        NULL; -- Policy doesn't exist, that's fine
END $$;

-- Create experiments table if it doesn't exist
CREATE TABLE IF NOT EXISTS experiments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    researcher_name TEXT,
    protocol TEXT,
    status TEXT DEFAULT 'planning' CHECK (status IN ('planning', 'in_progress', 'completed', 'on_hold')),
    visibility TEXT DEFAULT 'private' CHECK (visibility IN ('private', 'public', 'shared')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns to experiments table if they don't exist
DO $$ 
BEGIN
    -- Add user_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'experiments' AND column_name = 'user_id') THEN
        ALTER TABLE experiments ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
    
    -- Add protocol column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'experiments' AND column_name = 'protocol') THEN
        ALTER TABLE experiments ADD COLUMN protocol TEXT;
    END IF;
    
    -- Add visibility column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'experiments' AND column_name = 'visibility') THEN
        ALTER TABLE experiments ADD COLUMN visibility TEXT DEFAULT 'private' CHECK (visibility IN ('private', 'public', 'shared'));
    END IF;
    
    -- Add updated_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'experiments' AND column_name = 'updated_at') THEN
        ALTER TABLE experiments ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- Create tags table if it doesn't exist
CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'other' CHECK (category IN ('organism', 'reagent', 'technique', 'equipment', 'other')),
    color TEXT DEFAULT '#3B82F6',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns to tags table if they don't exist
DO $$ 
BEGIN
    -- Add user_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tags' AND column_name = 'user_id') THEN
        ALTER TABLE tags ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
    
    -- Add category column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tags' AND column_name = 'category') THEN
        ALTER TABLE tags ADD COLUMN category TEXT DEFAULT 'other' CHECK (category IN ('organism', 'reagent', 'technique', 'equipment', 'other'));
    END IF;
    
    -- Add color column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tags' AND column_name = 'color') THEN
        ALTER TABLE tags ADD COLUMN color TEXT DEFAULT '#3B82F6';
    END IF;
END $$;

-- Create experiment_tags junction table if it doesn't exist
CREATE TABLE IF NOT EXISTS experiment_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    experiment_id UUID REFERENCES experiments(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(experiment_id, tag_id)
);

-- Create protocols table if it doesn't exist
CREATE TABLE IF NOT EXISTS protocols (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    experiment_id UUID REFERENCES experiments(id) ON DELETE CASCADE,
    title TEXT,
    description TEXT,
    steps JSONB,
    file_url TEXT,
    file_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create files table if it doesn't exist
CREATE TABLE IF NOT EXISTS files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    experiment_id UUID REFERENCES experiments(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT,
    file_size BIGINT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create results table if it doesn't exist
CREATE TABLE IF NOT EXISTS results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    experiment_id UUID REFERENCES experiments(id) ON DELETE CASCADE,
    title TEXT,
    description TEXT,
    data JSONB,
    file_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE results ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for experiments
CREATE POLICY "Users can view own experiments" ON experiments
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own experiments" ON experiments
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own experiments" ON experiments
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own experiments" ON experiments
    FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for tags
CREATE POLICY "Users can view own tags" ON tags
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tags" ON tags
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tags" ON tags
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tags" ON tags
    FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for experiment_tags
CREATE POLICY "Users can view own experiment_tags" ON experiment_tags
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM experiments 
            WHERE experiments.id = experiment_tags.experiment_id 
            AND experiments.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own experiment_tags" ON experiment_tags
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM experiments 
            WHERE experiments.id = experiment_tags.experiment_id 
            AND experiments.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete own experiment_tags" ON experiment_tags
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM experiments 
            WHERE experiments.id = experiment_tags.experiment_id 
            AND experiments.user_id = auth.uid()
        )
    );

-- Create RLS policies for protocols
CREATE POLICY "Users can view own protocols" ON protocols
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM experiments 
            WHERE experiments.id = protocols.experiment_id 
            AND experiments.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own protocols" ON protocols
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM experiments 
            WHERE experiments.id = protocols.experiment_id 
            AND experiments.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update own protocols" ON protocols
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM experiments 
            WHERE experiments.id = protocols.experiment_id 
            AND experiments.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete own protocols" ON protocols
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM experiments 
            WHERE experiments.id = protocols.experiment_id 
            AND experiments.user_id = auth.uid()
        )
    );

-- Create RLS policies for files
CREATE POLICY "Users can view own files" ON files
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM experiments 
            WHERE experiments.id = files.experiment_id 
            AND experiments.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own files" ON files
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM experiments 
            WHERE experiments.id = files.experiment_id 
            AND experiments.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update own files" ON files
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM experiments 
            WHERE experiments.id = files.experiment_id 
            AND experiments.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete own files" ON files
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM experiments 
            WHERE experiments.id = files.experiment_id 
            AND experiments.user_id = auth.uid()
        )
    );

-- Create RLS policies for results
CREATE POLICY "Users can view own results" ON results
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM experiments 
            WHERE experiments.id = results.experiment_id 
            AND experiments.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own results" ON results
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM experiments 
            WHERE experiments.id = results.experiment_id 
            AND experiments.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update own results" ON results
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM experiments 
            WHERE experiments.id = results.experiment_id 
            AND experiments.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete own results" ON results
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM experiments 
            WHERE experiments.id = results.experiment_id 
            AND experiments.user_id = auth.uid()
        )
    );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_experiments_user_id ON experiments(user_id);
CREATE INDEX IF NOT EXISTS idx_experiments_status ON experiments(status);
CREATE INDEX IF NOT EXISTS idx_experiments_created_at ON experiments(created_at);

CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);
CREATE INDEX IF NOT EXISTS idx_tags_category ON tags(category);

CREATE INDEX IF NOT EXISTS idx_experiment_tags_experiment_id ON experiment_tags(experiment_id);
CREATE INDEX IF NOT EXISTS idx_experiment_tags_tag_id ON experiment_tags(tag_id);

CREATE INDEX IF NOT EXISTS idx_protocols_experiment_id ON protocols(experiment_id);
CREATE INDEX IF NOT EXISTS idx_files_experiment_id ON files(experiment_id);
CREATE INDEX IF NOT EXISTS idx_results_experiment_id ON results(experiment_id);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing triggers to avoid conflicts
DROP TRIGGER IF EXISTS update_experiments_updated_at ON experiments;
DROP TRIGGER IF EXISTS update_protocols_updated_at ON protocols;
DROP TRIGGER IF EXISTS update_results_updated_at ON results;

-- Create triggers for updated_at columns
CREATE TRIGGER update_experiments_updated_at
    BEFORE UPDATE ON experiments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_protocols_updated_at
    BEFORE UPDATE ON protocols
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_results_updated_at
    BEFORE UPDATE ON results
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Success message
DO $$ 
BEGIN
    RAISE NOTICE 'Migration completed successfully! All tables, policies, and indexes are now set up.';
END $$;
