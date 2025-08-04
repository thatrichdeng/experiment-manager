-- Create users table to store user profiles
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create experiment_shares table to track shared experiments
CREATE TABLE IF NOT EXISTS experiment_shares (
  id BIGSERIAL PRIMARY KEY,
  experiment_id BIGINT REFERENCES experiments(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_with_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_level TEXT CHECK (permission_level IN ('view', 'edit')) DEFAULT 'view',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(experiment_id, shared_with_id)
);

-- Add user_id column to existing tables if not exists
ALTER TABLE experiments ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE tags ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Enable RLS on new tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_shares ENABLE ROW LEVEL SECURITY;

-- Create policies for user_profiles
CREATE POLICY "Users can view all profiles" ON user_profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Create policies for experiment_shares
CREATE POLICY "Users can view shares they own or are shared with" ON experiment_shares 
  FOR SELECT USING (auth.uid() = owner_id OR auth.uid() = shared_with_id);

CREATE POLICY "Users can create shares for their experiments" ON experiment_shares 
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update shares they own" ON experiment_shares 
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete shares they own" ON experiment_shares 
  FOR DELETE USING (auth.uid() = owner_id);

-- Update existing policies for experiments to include shared access
DROP POLICY IF EXISTS "Allow all operations on experiments" ON experiments;

CREATE POLICY "Users can view own experiments" ON experiments 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view shared experiments" ON experiments 
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM experiment_shares 
      WHERE experiment_shares.experiment_id = experiments.id 
      AND experiment_shares.shared_with_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own experiments" ON experiments 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own experiments" ON experiments 
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can update shared experiments with edit permission" ON experiments 
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM experiment_shares 
      WHERE experiment_shares.experiment_id = experiments.id 
      AND experiment_shares.shared_with_id = auth.uid()
      AND experiment_shares.permission_level = 'edit'
    )
  );

CREATE POLICY "Users can delete own experiments" ON experiments 
  FOR DELETE USING (auth.uid() = user_id);

-- Update policies for related tables to respect sharing
DROP POLICY IF EXISTS "Allow all operations on experiment_tags" ON experiment_tags;
DROP POLICY IF EXISTS "Allow all operations on protocols" ON protocols;
DROP POLICY IF EXISTS "Allow all operations on files" ON files;
DROP POLICY IF EXISTS "Allow all operations on results" ON results;

-- Experiment tags policies
CREATE POLICY "Users can view experiment_tags for accessible experiments" ON experiment_tags 
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM experiments 
      WHERE experiments.id = experiment_tags.experiment_id 
      AND (experiments.user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM experiment_shares 
        WHERE experiment_shares.experiment_id = experiments.id 
        AND experiment_shares.shared_with_id = auth.uid()
      ))
    )
  );

CREATE POLICY "Users can manage experiment_tags for own experiments" ON experiment_tags 
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM experiments 
      WHERE experiments.id = experiment_tags.experiment_id 
      AND experiments.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage experiment_tags for editable shared experiments" ON experiment_tags 
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM experiments 
      JOIN experiment_shares ON experiment_shares.experiment_id = experiments.id
      WHERE experiments.id = experiment_tags.experiment_id 
      AND experiment_shares.shared_with_id = auth.uid()
      AND experiment_shares.permission_level = 'edit'
    )
  );

-- Similar policies for protocols, files, and results
CREATE POLICY "Users can view protocols for accessible experiments" ON protocols 
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM experiments 
      WHERE experiments.id = protocols.experiment_id 
      AND (experiments.user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM experiment_shares 
        WHERE experiment_shares.experiment_id = experiments.id 
        AND experiment_shares.shared_with_id = auth.uid()
      ))
    )
  );

CREATE POLICY "Users can manage protocols for own/editable experiments" ON protocols 
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM experiments 
      WHERE experiments.id = protocols.experiment_id 
      AND (experiments.user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM experiment_shares 
        WHERE experiment_shares.experiment_id = experiments.id 
        AND experiment_shares.shared_with_id = auth.uid()
        AND experiment_shares.permission_level = 'edit'
      ))
    )
  );

CREATE POLICY "Users can view files for accessible experiments" ON files 
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM experiments 
      WHERE experiments.id = files.experiment_id 
      AND (experiments.user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM experiment_shares 
        WHERE experiment_shares.experiment_id = experiments.id 
        AND experiment_shares.shared_with_id = auth.uid()
      ))
    )
  );

CREATE POLICY "Users can manage files for own/editable experiments" ON files 
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM experiments 
      WHERE experiments.id = files.experiment_id 
      AND (experiments.user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM experiment_shares 
        WHERE experiment_shares.experiment_id = experiments.id 
        AND experiment_shares.shared_with_id = auth.uid()
        AND experiment_shares.permission_level = 'edit'
      ))
    )
  );

CREATE POLICY "Users can view results for accessible experiments" ON results 
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM experiments 
      WHERE experiments.id = results.experiment_id 
      AND (experiments.user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM experiment_shares 
        WHERE experiment_shares.experiment_id = experiments.id 
        AND experiment_shares.shared_with_id = auth.uid()
      ))
    )
  );

CREATE POLICY "Users can manage results for own/editable experiments" ON results 
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM experiments 
      WHERE experiments.id = results.experiment_id 
      AND (experiments.user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM experiment_shares 
        WHERE experiment_shares.experiment_id = experiments.id 
        AND experiment_shares.shared_with_id = auth.uid()
        AND experiment_shares.permission_level = 'edit'
      ))
    )
  );

-- Create function to automatically create user profile on signup
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

-- Create function to search users by email
CREATE OR REPLACE FUNCTION search_users(search_term TEXT)
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT up.id, up.email, up.full_name
  FROM user_profiles up
  WHERE up.email ILIKE '%' || search_term || '%'
     OR up.full_name ILIKE '%' || search_term || '%'
  ORDER BY up.email
  LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
