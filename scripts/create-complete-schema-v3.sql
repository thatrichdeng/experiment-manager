-- Complete schema setup for experiment manager
-- This script creates all tables with correct data types and relationships

-- Drop existing tables if they exist (in correct order to handle foreign keys)
DROP TABLE IF EXISTS experiment_shares CASCADE;
DROP TABLE IF EXISTS experiment_tags CASCADE;
DROP TABLE IF EXISTS tags CASCADE;
DROP TABLE IF EXISTS experiments CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Create profiles table for user management
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create experiments table with UUID primary key to match auth.users
CREATE TABLE experiments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  researcher_name TEXT NOT NULL,
  status TEXT CHECK (status IN ('planning', 'in_progress', 'completed', 'on_hold')) DEFAULT 'planning',
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create tags table
CREATE TABLE tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  color TEXT DEFAULT '#3B82F6',
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create experiment_tags junction table
CREATE TABLE experiment_tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  experiment_id UUID REFERENCES experiments(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(experiment_id, tag_id)
);

-- Create experiment_shares table for sharing functionality
CREATE TABLE experiment_shares (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  experiment_id UUID REFERENCES experiments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_by_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_level TEXT CHECK (permission_level IN ('view', 'edit')) DEFAULT 'view',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(experiment_id, user_id)
);

-- Enable Row Level Security on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_shares ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Experiments policies
CREATE POLICY "Users can view their own experiments" ON experiments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view shared experiments" ON experiments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM experiment_shares 
      WHERE experiment_shares.experiment_id = experiments.id 
      AND experiment_shares.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own experiments" ON experiments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own experiments" ON experiments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can update shared experiments with edit permission" ON experiments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM experiment_shares 
      WHERE experiment_shares.experiment_id = experiments.id 
      AND experiment_shares.user_id = auth.uid()
      AND experiment_shares.permission_level = 'edit'
    )
  );

CREATE POLICY "Users can delete their own experiments" ON experiments
  FOR DELETE USING (auth.uid() = user_id);

-- Tags policies
CREATE POLICY "Users can view their own tags" ON tags
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view global tags" ON tags
  FOR SELECT USING (user_id IS NULL);

CREATE POLICY "Users can insert their own tags" ON tags
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tags" ON tags
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tags" ON tags
  FOR DELETE USING (auth.uid() = user_id);

-- Experiment_tags policies
CREATE POLICY "Users can view tags for their experiments" ON experiment_tags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM experiments 
      WHERE experiments.id = experiment_tags.experiment_id 
      AND experiments.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view tags for shared experiments" ON experiment_tags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM experiment_shares 
      WHERE experiment_shares.experiment_id = experiment_tags.experiment_id 
      AND experiment_shares.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage tags for their experiments" ON experiment_tags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM experiments 
      WHERE experiments.id = experiment_tags.experiment_id 
      AND experiments.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage tags for shared experiments with edit permission" ON experiment_tags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM experiment_shares 
      WHERE experiment_shares.experiment_id = experiment_tags.experiment_id 
      AND experiment_shares.user_id = auth.uid()
      AND experiment_shares.permission_level = 'edit'
    )
  );

-- Experiment_shares policies
CREATE POLICY "Users can view shares for their experiments" ON experiment_shares
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM experiments 
      WHERE experiments.id = experiment_shares.experiment_id 
      AND experiments.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their own shares" ON experiment_shares
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage shares for their experiments" ON experiment_shares
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM experiments 
      WHERE experiments.id = experiment_shares.experiment_id 
      AND experiments.user_id = auth.uid()
    )
  );

-- Function to handle user profile creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (
    NEW.id, 
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE OR REPLACE TRIGGER update_experiments_updated_at
  BEFORE UPDATE ON experiments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_experiment_shares_updated_at
  BEFORE UPDATE ON experiment_shares
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample global tags
INSERT INTO tags (name, category, color, user_id) VALUES
  ('Machine Learning', 'methodology', '#3B82F6', NULL),
  ('Psychology', 'field', '#10B981', NULL),
  ('Clinical Trial', 'type', '#F59E0B', NULL),
  ('Longitudinal', 'design', '#EF4444', NULL),
  ('Qualitative', 'methodology', '#8B5CF6', NULL),
  ('Quantitative', 'methodology', '#06B6D4', NULL),
  ('Pilot Study', 'type', '#84CC16', NULL),
  ('Meta-Analysis', 'type', '#F97316', NULL),
  ('Biochemistry', 'field', '#EC4899', NULL),
  ('Neuroscience', 'field', '#14B8A6', NULL)
ON CONFLICT DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_experiments_user_id ON experiments(user_id);
CREATE INDEX IF NOT EXISTS idx_experiments_status ON experiments(status);
CREATE INDEX IF NOT EXISTS idx_experiments_created_at ON experiments(created_at);
CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);
CREATE INDEX IF NOT EXISTS idx_tags_category ON tags(category);
CREATE INDEX IF NOT EXISTS idx_experiment_tags_experiment_id ON experiment_tags(experiment_id);
CREATE INDEX IF NOT EXISTS idx_experiment_tags_tag_id ON experiment_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_experiment_shares_experiment_id ON experiment_shares(experiment_id);
CREATE INDEX IF NOT EXISTS idx_experiment_shares_user_id ON experiment_shares(user_id);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

SELECT 'Complete schema created successfully with UUID primary keys!' as result;
