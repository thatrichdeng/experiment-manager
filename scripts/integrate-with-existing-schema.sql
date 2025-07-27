-- Your existing tables are:
-- experiments: id(uuid), user_id(uuid), title(text), protocol(text), visibility(text), created_at
-- profiles: id(uuid), username(text), created_at
-- protocols: id(uuid), experiment_id(uuid), steps(jsonb), created_at  
-- results: id(uuid), experiment_id(uuid), data(jsonb), file_url(text), created_at

-- Add missing columns to experiments table to match our app needs
ALTER TABLE experiments 
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS researcher_name text,
ADD COLUMN IF NOT EXISTS status text CHECK (status IN ('planning', 'in_progress', 'completed', 'on_hold')) DEFAULT 'planning',
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- Create tags table (this doesn't exist in your schema)
CREATE TABLE IF NOT EXISTS tags (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  category text CHECK (category IN ('organism', 'reagent', 'technique', 'equipment', 'other')) DEFAULT 'other',
  color text DEFAULT '#3B82F6',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT tags_pkey PRIMARY KEY (id),
  CONSTRAINT tags_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT tags_user_name_unique UNIQUE (user_id, name)
);

-- Create experiment_tags junction table (this doesn't exist in your schema)
CREATE TABLE IF NOT EXISTS experiment_tags (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  experiment_id uuid NOT NULL,
  tag_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT experiment_tags_pkey PRIMARY KEY (id),
  CONSTRAINT experiment_tags_experiment_id_fkey FOREIGN KEY (experiment_id) REFERENCES experiments (id) ON DELETE CASCADE,
  CONSTRAINT experiment_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE,
  CONSTRAINT experiment_tags_unique UNIQUE (experiment_id, tag_id)
);

-- Create files table (this doesn't exist in your schema, but we need it for file uploads)
CREATE TABLE IF NOT EXISTS files (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  experiment_id uuid NOT NULL,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  file_size bigint,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT files_pkey PRIMARY KEY (id),
  CONSTRAINT files_experiment_id_fkey FOREIGN KEY (experiment_id) REFERENCES experiments (id) ON DELETE CASCADE
);

-- Add updated_at trigger for experiments
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_experiments_updated_at ON experiments;
CREATE TRIGGER update_experiments_updated_at 
    BEFORE UPDATE ON experiments 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security on all tables
ALTER TABLE experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE results ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "Users can view own experiments" ON experiments;
DROP POLICY IF EXISTS "Users can insert own experiments" ON experiments;
DROP POLICY IF EXISTS "Users can update own experiments" ON experiments;
DROP POLICY IF EXISTS "Users can delete own experiments" ON experiments;

-- Create RLS policies for experiments
CREATE POLICY "Users can view own experiments" ON experiments
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own experiments" ON experiments
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own experiments" ON experiments
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own experiments" ON experiments
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for profiles
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Create RLS policies for protocols (linked through experiments)
DROP POLICY IF EXISTS "Users can view own protocols" ON protocols;
DROP POLICY IF EXISTS "Users can insert own protocols" ON protocols;
DROP POLICY IF EXISTS "Users can update own protocols" ON protocols;
DROP POLICY IF EXISTS "Users can delete own protocols" ON protocols;

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

-- Create RLS policies for results (linked through experiments)
DROP POLICY IF EXISTS "Users can view own results" ON results;
DROP POLICY IF EXISTS "Users can insert own results" ON results;
DROP POLICY IF EXISTS "Users can update own results" ON results;
DROP POLICY IF EXISTS "Users can delete own results" ON results;

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

-- Create RLS policies for tags
DROP POLICY IF EXISTS "Users can view own tags" ON tags;
DROP POLICY IF EXISTS "Users can insert own tags" ON tags;
DROP POLICY IF EXISTS "Users can update own tags" ON tags;
DROP POLICY IF EXISTS "Users can delete own tags" ON tags;

CREATE POLICY "Users can view own tags" ON tags
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tags" ON tags
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tags" ON tags
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tags" ON tags
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for experiment_tags
DROP POLICY IF EXISTS "Users can view own experiment tags" ON experiment_tags;
DROP POLICY IF EXISTS "Users can insert own experiment tags" ON experiment_tags;
DROP POLICY IF EXISTS "Users can delete own experiment tags" ON experiment_tags;

CREATE POLICY "Users can view own experiment tags" ON experiment_tags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM experiments 
      WHERE experiments.id = experiment_tags.experiment_id 
      AND experiments.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can insert own experiment tags" ON experiment_tags
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM experiments 
      WHERE experiments.id = experiment_tags.experiment_id 
      AND experiments.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can delete own experiment tags" ON experiment_tags
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM experiments 
      WHERE experiments.id = experiment_tags.experiment_id 
      AND experiments.user_id = auth.uid()
    )
  );

-- Create RLS policies for files
DROP POLICY IF EXISTS "Users can view own files" ON files;
DROP POLICY IF EXISTS "Users can insert own files" ON files;
DROP POLICY IF EXISTS "Users can update own files" ON files;
DROP POLICY IF EXISTS "Users can delete own files" ON files;

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

-- Create storage bucket for research files
INSERT INTO storage.buckets (id, name, public)
VALUES ('research-files', 'research-files', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies
DROP POLICY IF EXISTS "Users can view own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can insert own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;

CREATE POLICY "Users can view own files" ON storage.objects
  FOR SELECT USING (bucket_id = 'research-files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can insert own files" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'research-files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update own files" ON storage.objects
  FOR UPDATE USING (bucket_id = 'research-files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own files" ON storage.objects
  FOR DELETE USING (bucket_id = 'research-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Insert some sample tags for new users (optional)
INSERT INTO tags (user_id, name, category, color) 
SELECT 
  auth.uid(),
  unnest(ARRAY['E. coli', 'S. cerevisiae', 'HeLa cells']) as name,
  'organism' as category,
  '#10B981' as color
WHERE auth.uid() IS NOT NULL
ON CONFLICT (user_id, name) DO NOTHING;

INSERT INTO tags (user_id, name, category, color) 
SELECT 
  auth.uid(),
  unnest(ARRAY['PCR', 'Western Blot', 'CRISPR']) as name,
  'technique' as category,
  '#3B82F6' as color
WHERE auth.uid() IS NOT NULL
ON CONFLICT (user_id, name) DO NOTHING;

INSERT INTO tags (user_id, name, category, color) 
SELECT 
  auth.uid(),
  unnest(ARRAY['Taq Polymerase', 'DMSO', 'Antibody']) as name,
  'reagent' as category,
  '#F59E0B' as color
WHERE auth.uid() IS NOT NULL
ON CONFLICT (user_id, name) DO NOTHING;
