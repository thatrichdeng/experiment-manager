-- Create base schema for experiment manager
-- This script checks for existing tables and creates missing ones

-- Enable RLS
ALTER DATABASE postgres SET row_security = on;

-- Create user_profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create experiments table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.experiments (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    researcher_name TEXT,
    protocol TEXT,
    status TEXT DEFAULT 'planning' CHECK (status IN ('planning', 'in_progress', 'completed', 'on_hold')),
    visibility TEXT DEFAULT 'private',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create tags table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.tags (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'other' CHECK (category IN ('organism', 'reagent', 'technique', 'equipment', 'other')),
    color TEXT DEFAULT '#3B82F6',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create experiment_tags junction table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.experiment_tags (
    id SERIAL PRIMARY KEY,
    experiment_id INTEGER REFERENCES public.experiments(id) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES public.tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(experiment_id, tag_id)
);

-- Create protocols table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.protocols (
    id SERIAL PRIMARY KEY,
    experiment_id INTEGER REFERENCES public.experiments(id) ON DELETE CASCADE,
    steps JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create files table (renamed from data_files) if it doesn't exist
CREATE TABLE IF NOT EXISTS public.files (
    id SERIAL PRIMARY KEY,
    experiment_id INTEGER REFERENCES public.experiments(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT,
    file_size BIGINT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create results table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.results (
    id SERIAL PRIMARY KEY,
    experiment_id INTEGER REFERENCES public.experiments(id) ON DELETE CASCADE,
    data JSONB,
    file_url TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create experiment_shares table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.experiment_shares (
    id SERIAL PRIMARY KEY,
    experiment_id INTEGER REFERENCES public.experiments(id) ON DELETE CASCADE,
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    shared_with_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    permission_level TEXT DEFAULT 'view' CHECK (permission_level IN ('view', 'edit')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(experiment_id, shared_with_id)
);

-- Enable Row Level Security on all tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experiment_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experiment_shares ENABLE ROW LEVEL SECURITY;

-- Create RLS policies

-- User profiles policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
CREATE POLICY "Users can view own profile" ON public.user_profiles
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
CREATE POLICY "Users can update own profile" ON public.user_profiles
    FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
CREATE POLICY "Users can insert own profile" ON public.user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Experiments policies
DROP POLICY IF EXISTS "Users can view own experiments" ON public.experiments;
CREATE POLICY "Users can view own experiments" ON public.experiments
    FOR SELECT USING (
        auth.uid() = user_id OR 
        EXISTS (
            SELECT 1 FROM public.experiment_shares 
            WHERE experiment_id = experiments.id 
            AND shared_with_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert own experiments" ON public.experiments;
CREATE POLICY "Users can insert own experiments" ON public.experiments
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own experiments" ON public.experiments;
CREATE POLICY "Users can update own experiments" ON public.experiments
    FOR UPDATE USING (
        auth.uid() = user_id OR 
        EXISTS (
            SELECT 1 FROM public.experiment_shares 
            WHERE experiment_id = experiments.id 
            AND shared_with_id = auth.uid() 
            AND permission_level = 'edit'
        )
    );

DROP POLICY IF EXISTS "Users can delete own experiments" ON public.experiments;
CREATE POLICY "Users can delete own experiments" ON public.experiments
    FOR DELETE USING (auth.uid() = user_id);

-- Tags policies
DROP POLICY IF EXISTS "Users can view own tags" ON public.tags;
CREATE POLICY "Users can view own tags" ON public.tags
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own tags" ON public.tags;
CREATE POLICY "Users can insert own tags" ON public.tags
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own tags" ON public.tags;
CREATE POLICY "Users can update own tags" ON public.tags
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own tags" ON public.tags;
CREATE POLICY "Users can delete own tags" ON public.tags
    FOR DELETE USING (auth.uid() = user_id);

-- Experiment tags policies
DROP POLICY IF EXISTS "Users can view experiment tags" ON public.experiment_tags;
CREATE POLICY "Users can view experiment tags" ON public.experiment_tags
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.experiments 
            WHERE id = experiment_tags.experiment_id 
            AND (
                user_id = auth.uid() OR 
                EXISTS (
                    SELECT 1 FROM public.experiment_shares 
                    WHERE experiment_id = experiments.id 
                    AND shared_with_id = auth.uid()
                )
            )
        )
    );

DROP POLICY IF EXISTS "Users can manage experiment tags" ON public.experiment_tags;
CREATE POLICY "Users can manage experiment tags" ON public.experiment_tags
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.experiments 
            WHERE id = experiment_tags.experiment_id 
            AND (
                user_id = auth.uid() OR 
                EXISTS (
                    SELECT 1 FROM public.experiment_shares 
                    WHERE experiment_id = experiments.id 
                    AND shared_with_id = auth.uid() 
                    AND permission_level = 'edit'
                )
            )
        )
    );

-- Similar policies for protocols, files, and results
DROP POLICY IF EXISTS "Users can view experiment protocols" ON public.protocols;
CREATE POLICY "Users can view experiment protocols" ON public.protocols
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.experiments 
            WHERE id = protocols.experiment_id 
            AND (
                user_id = auth.uid() OR 
                EXISTS (
                    SELECT 1 FROM public.experiment_shares 
                    WHERE experiment_id = experiments.id 
                    AND shared_with_id = auth.uid()
                )
            )
        )
    );

DROP POLICY IF EXISTS "Users can manage experiment protocols" ON public.protocols;
CREATE POLICY "Users can manage experiment protocols" ON public.protocols
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.experiments 
            WHERE id = protocols.experiment_id 
            AND (
                user_id = auth.uid() OR 
                EXISTS (
                    SELECT 1 FROM public.experiment_shares 
                    WHERE experiment_id = experiments.id 
                    AND shared_with_id = auth.uid() 
                    AND permission_level = 'edit'
                )
            )
        )
    );

-- Files policies
DROP POLICY IF EXISTS "Users can view experiment files" ON public.files;
CREATE POLICY "Users can view experiment files" ON public.files
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.experiments 
            WHERE id = files.experiment_id 
            AND (
                user_id = auth.uid() OR 
                EXISTS (
                    SELECT 1 FROM public.experiment_shares 
                    WHERE experiment_id = experiments.id 
                    AND shared_with_id = auth.uid()
                )
            )
        )
    );

DROP POLICY IF EXISTS "Users can manage experiment files" ON public.files;
CREATE POLICY "Users can manage experiment files" ON public.files
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.experiments 
            WHERE id = files.experiment_id 
            AND (
                user_id = auth.uid() OR 
                EXISTS (
                    SELECT 1 FROM public.experiment_shares 
                    WHERE experiment_id = experiments.id 
                    AND shared_with_id = auth.uid() 
                    AND permission_level = 'edit'
                )
            )
        )
    );

-- Results policies
DROP POLICY IF EXISTS "Users can view experiment results" ON public.results;
CREATE POLICY "Users can view experiment results" ON public.results
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.experiments 
            WHERE id = results.experiment_id 
            AND (
                user_id = auth.uid() OR 
                EXISTS (
                    SELECT 1 FROM public.experiment_shares 
                    WHERE experiment_id = experiments.id 
                    AND shared_with_id = auth.uid()
                )
            )
        )
    );

DROP POLICY IF EXISTS "Users can manage experiment results" ON public.results;
CREATE POLICY "Users can manage experiment results" ON public.results
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.experiments 
            WHERE id = results.experiment_id 
            AND (
                user_id = auth.uid() OR 
                EXISTS (
                    SELECT 1 FROM public.experiment_shares 
                    WHERE experiment_id = experiments.id 
                    AND shared_with_id = auth.uid() 
                    AND permission_level = 'edit'
                )
            )
        )
    );

-- Experiment shares policies
DROP POLICY IF EXISTS "Users can view experiment shares" ON public.experiment_shares;
CREATE POLICY "Users can view experiment shares" ON public.experiment_shares
    FOR SELECT USING (
        auth.uid() = owner_id OR 
        auth.uid() = shared_with_id OR
        EXISTS (
            SELECT 1 FROM public.experiments 
            WHERE id = experiment_shares.experiment_id 
            AND user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Owners can manage experiment shares" ON public.experiment_shares;
CREATE POLICY "Owners can manage experiment shares" ON public.experiment_shares
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.experiments 
            WHERE id = experiment_shares.experiment_id 
            AND user_id = auth.uid()
        )
    );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_experiments_user_id ON public.experiments(user_id);
CREATE INDEX IF NOT EXISTS idx_experiments_status ON public.experiments(status);
CREATE INDEX IF NOT EXISTS idx_experiments_created_at ON public.experiments(created_at);
CREATE INDEX IF NOT EXISTS idx_tags_user_id ON public.tags(user_id);
CREATE INDEX IF NOT EXISTS idx_tags_category ON public.tags(category);
CREATE INDEX IF NOT EXISTS idx_experiment_tags_experiment_id ON public.experiment_tags(experiment_id);
CREATE INDEX IF NOT EXISTS idx_experiment_tags_tag_id ON public.experiment_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_experiment_shares_experiment_id ON public.experiment_shares(experiment_id);
CREATE INDEX IF NOT EXISTS idx_experiment_shares_shared_with_id ON public.experiment_shares(shared_with_id);

-- Create function to automatically create user profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

SELECT 'Base schema created successfully!' as result;
