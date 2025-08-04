-- Add sharing functionality to existing schema
-- This script adds sharing features without breaking existing data

-- Ensure experiment_shares table exists with proper structure
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

-- Ensure user_profiles table exists for user search
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on sharing tables
ALTER TABLE public.experiment_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Update experiment policies to include shared experiments
DROP POLICY IF EXISTS "Users can view own and shared experiments" ON public.experiments;
CREATE POLICY "Users can view own and shared experiments" ON public.experiments
    FOR SELECT USING (
        auth.uid() = user_id OR 
        EXISTS (
            SELECT 1 FROM public.experiment_shares 
            WHERE experiment_id = experiments.id 
            AND shared_with_id = auth.uid()
        )
    );

-- User profiles policies for search functionality
DROP POLICY IF EXISTS "Users can view profiles for sharing" ON public.user_profiles;
CREATE POLICY "Users can view profiles for sharing" ON public.user_profiles
    FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
CREATE POLICY "Users can update own profile" ON public.user_profiles
    FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
CREATE POLICY "Users can insert own profile" ON public.user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Experiment shares policies
DROP POLICY IF EXISTS "Users can view relevant shares" ON public.experiment_shares;
CREATE POLICY "Users can view relevant shares" ON public.experiment_shares
    FOR SELECT USING (
        auth.uid() = owner_id OR 
        auth.uid() = shared_with_id OR
        EXISTS (
            SELECT 1 FROM public.experiments 
            WHERE id = experiment_shares.experiment_id 
            AND user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Owners can manage shares" ON public.experiment_shares;
CREATE POLICY "Owners can manage shares" ON public.experiment_shares
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.experiments 
            WHERE id = experiment_shares.experiment_id 
            AND user_id = auth.uid()
        )
    );

-- Create function to search users for sharing
CREATE OR REPLACE FUNCTION public.search_users_for_sharing(search_term TEXT)
RETURNS TABLE (
    id UUID,
    email TEXT,
    full_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        up.id,
        up.email,
        up.full_name
    FROM public.user_profiles up
    WHERE 
        up.id != auth.uid() AND
        (
            up.email ILIKE '%' || search_term || '%' OR
            up.full_name ILIKE '%' || search_term || '%'
        )
    LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get shared experiments for a user
CREATE OR REPLACE FUNCTION public.get_shared_experiments()
RETURNS TABLE (
    experiment_id INTEGER,
    title TEXT,
    description TEXT,
    researcher_name TEXT,
    status TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    permission_level TEXT,
    owner_email TEXT,
    owner_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id as experiment_id,
        e.title,
        e.description,
        e.researcher_name,
        e.status,
        e.created_at,
        e.updated_at,
        es.permission_level,
        up.email as owner_email,
        up.full_name as owner_name
    FROM public.experiments e
    JOIN public.experiment_shares es ON e.id = es.experiment_id
    JOIN public.user_profiles up ON e.user_id = up.id
    WHERE es.shared_with_id = auth.uid()
    ORDER BY e.updated_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_experiment_shares_experiment_id ON public.experiment_shares(experiment_id);
CREATE INDEX IF NOT EXISTS idx_experiment_shares_shared_with_id ON public.experiment_shares(shared_with_id);
CREATE INDEX IF NOT EXISTS idx_experiment_shares_owner_id ON public.experiment_shares(owner_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_full_name ON public.user_profiles(full_name);

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.search_users_for_sharing(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_shared_experiments() TO authenticated;

SELECT 'Sharing functionality added successfully!' as result;
