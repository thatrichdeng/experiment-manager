-- Drop all existing tables and related objects (with IF EXISTS to avoid errors)
DROP TABLE IF EXISTS experiment_tags CASCADE;
DROP TABLE IF EXISTS protocols CASCADE;
DROP TABLE IF EXISTS files CASCADE;
DROP TABLE IF EXISTS results CASCADE;
DROP TABLE IF EXISTS experiments CASCADE;
DROP TABLE IF EXISTS tags CASCADE;

-- Drop existing functions (with IF EXISTS)
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Drop existing storage policies (ignore errors if they don't exist)
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can upload their own files" ON storage.objects;
    DROP POLICY IF EXISTS "Users can view their own files" ON storage.objects;
    DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;
    DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Create experiments table
CREATE TABLE experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  researcher_name TEXT,
  protocol TEXT,
  status TEXT CHECK (status IN ('planning', 'in_progress', 'completed', 'on_hold')) DEFAULT 'planning',
  visibility TEXT DEFAULT 'private',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create tags table
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  category TEXT CHECK (category IN ('organism', 'reagent', 'technique', 'equipment', 'other')) DEFAULT 'other',
  color TEXT DEFAULT '#3B82F6',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Create junction table for experiment-tag relationships
CREATE TABLE experiment_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL,
  tag_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(experiment_id, tag_id)
);

-- Create protocols table
CREATE TABLE protocols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL,
  title TEXT,
  description TEXT,
  steps JSONB,
  file_url TEXT,
  file_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create files table
CREATE TABLE files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create results table
CREATE TABLE results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL,
  title TEXT,
  description TEXT,
  data JSONB,
  file_url TEXT,
  file_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key constraints after all tables are created
ALTER TABLE experiments ADD CONSTRAINT fk_experiments_user_id 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE tags ADD CONSTRAINT fk_tags_user_id 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE experiment_tags ADD CONSTRAINT fk_experiment_tags_experiment_id 
  FOREIGN KEY (experiment_id) REFERENCES experiments(id) ON DELETE CASCADE;

ALTER TABLE experiment_tags ADD CONSTRAINT fk_experiment_tags_tag_id 
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE;

ALTER TABLE protocols ADD CONSTRAINT fk_protocols_experiment_id 
  FOREIGN KEY (experiment_id) REFERENCES experiments(id) ON DELETE CASCADE;

ALTER TABLE files ADD CONSTRAINT fk_files_experiment_id 
  FOREIGN KEY (experiment_id) REFERENCES experiments(id) ON DELETE CASCADE;

ALTER TABLE results ADD CONSTRAINT fk_results_experiment_id 
  FOREIGN KEY (experiment_id) REFERENCES experiments(id) ON DELETE CASCADE;

-- Enable Row Level Security
ALTER TABLE experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE results ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for experiments
CREATE POLICY "Users can view their own experiments" ON experiments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own experiments" ON experiments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own experiments" ON experiments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own experiments" ON experiments
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for tags
CREATE POLICY "Users can view their own tags" ON tags
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tags" ON tags
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tags" ON tags
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tags" ON tags
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for experiment_tags
CREATE POLICY "Users can view experiment_tags for their experiments" ON experiment_tags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM experiments 
      WHERE experiments.id = experiment_tags.experiment_id 
      AND experiments.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert experiment_tags for their experiments" ON experiment_tags
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM experiments 
      WHERE experiments.id = experiment_tags.experiment_id 
      AND experiments.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete experiment_tags for their experiments" ON experiment_tags
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM experiments 
      WHERE experiments.id = experiment_tags.experiment_id 
      AND experiments.user_id = auth.uid()
    )
  );

-- Create RLS policies for protocols
CREATE POLICY "Users can view protocols for their experiments" ON protocols
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM experiments 
      WHERE experiments.id = protocols.experiment_id 
      AND experiments.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert protocols for their experiments" ON protocols
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM experiments 
      WHERE experiments.id = protocols.experiment_id 
      AND experiments.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update protocols for their experiments" ON protocols
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM experiments 
      WHERE experiments.id = protocols.experiment_id 
      AND experiments.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete protocols for their experiments" ON protocols
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM experiments 
      WHERE experiments.id = protocols.experiment_id 
      AND experiments.user_id = auth.uid()
    )
  );

-- Create RLS policies for files
CREATE POLICY "Users can view files for their experiments" ON files
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM experiments 
      WHERE experiments.id = files.experiment_id 
      AND experiments.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert files for their experiments" ON files
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM experiments 
      WHERE experiments.id = files.experiment_id 
      AND experiments.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update files for their experiments" ON files
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM experiments 
      WHERE experiments.id = files.experiment_id 
      AND experiments.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete files for their experiments" ON files
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM experiments 
      WHERE experiments.id = files.experiment_id 
      AND experiments.user_id = auth.uid()
    )
  );

-- Create RLS policies for results
CREATE POLICY "Users can view results for their experiments" ON results
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM experiments 
      WHERE experiments.id = results.experiment_id 
      AND experiments.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert results for their experiments" ON results
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM experiments 
      WHERE experiments.id = results.experiment_id 
      AND experiments.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update results for their experiments" ON results
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM experiments 
      WHERE experiments.id = results.experiment_id 
      AND experiments.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete results for their experiments" ON results
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM experiments 
      WHERE experiments.id = results.experiment_id 
      AND experiments.user_id = auth.uid()
    )
  );

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for experiments table
CREATE TRIGGER update_experiments_updated_at 
    BEFORE UPDATE ON experiments 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create storage bucket for research files (ignore error if it already exists)
DO $$
BEGIN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('research-files', 'research-files', true);
EXCEPTION
    WHEN unique_violation THEN
        -- Bucket already exists, do nothing
        NULL;
END $$;

-- Create storage policies
CREATE POLICY "Users can upload their own files" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'research-files' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'research-files' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own files" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'research-files' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own files" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'research-files' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
