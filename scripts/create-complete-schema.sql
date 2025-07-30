-- Create experiments table
CREATE TABLE IF NOT EXISTS experiments (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  researcher_name TEXT NOT NULL,
  status TEXT CHECK (status IN ('planning', 'in_progress', 'completed', 'on_hold')) DEFAULT 'planning',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create tags table
CREATE TABLE IF NOT EXISTS tags (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  category TEXT CHECK (category IN ('organism', 'reagent', 'technique', 'equipment', 'other')) DEFAULT 'other',
  color TEXT DEFAULT '#3B82F6',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create experiment_tags junction table
CREATE TABLE IF NOT EXISTS experiment_tags (
  id BIGSERIAL PRIMARY KEY,
  experiment_id BIGINT NOT NULL,
  tag_id BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(experiment_id, tag_id)
);

-- Add foreign key constraints if they don't exist
DO $$ 
BEGIN
    -- Add foreign key for experiment_id if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'experiment_tags_experiment_id_fkey'
    ) THEN
        ALTER TABLE experiment_tags 
        ADD CONSTRAINT experiment_tags_experiment_id_fkey 
        FOREIGN KEY (experiment_id) REFERENCES experiments(id) ON DELETE CASCADE;
    END IF;
    
    -- Add foreign key for tag_id if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'experiment_tags_tag_id_fkey'
    ) THEN
        ALTER TABLE experiment_tags 
        ADD CONSTRAINT experiment_tags_tag_id_fkey 
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Create protocols table
CREATE TABLE IF NOT EXISTS protocols (
  id BIGSERIAL PRIMARY KEY,
  experiment_id BIGINT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT,
  file_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key for protocols if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'protocols_experiment_id_fkey'
    ) THEN
        ALTER TABLE protocols 
        ADD CONSTRAINT protocols_experiment_id_fkey 
        FOREIGN KEY (experiment_id) REFERENCES experiments(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Create data_files table
CREATE TABLE IF NOT EXISTS data_files (
  id BIGSERIAL PRIMARY KEY,
  experiment_id BIGINT NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key for data_files if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'data_files_experiment_id_fkey'
    ) THEN
        ALTER TABLE data_files 
        ADD CONSTRAINT data_files_experiment_id_fkey 
        FOREIGN KEY (experiment_id) REFERENCES experiments(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_files ENABLE ROW LEVEL SECURITY;

-- Create policies (allowing all operations for demo)
DROP POLICY IF EXISTS "Allow all operations on experiments" ON experiments;
CREATE POLICY "Allow all operations on experiments" ON experiments FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all operations on tags" ON tags;
CREATE POLICY "Allow all operations on tags" ON tags FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all operations on experiment_tags" ON experiment_tags;
CREATE POLICY "Allow all operations on experiment_tags" ON experiment_tags FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all operations on protocols" ON protocols;
CREATE POLICY "Allow all operations on protocols" ON protocols FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all operations on data_files" ON data_files;
CREATE POLICY "Allow all operations on data_files" ON data_files FOR ALL USING (true);

-- Insert sample tags
INSERT INTO tags (name, category, color) VALUES
  ('E. coli', 'organism', '#10B981'),
  ('S. cerevisiae', 'organism', '#10B981'),
  ('HeLa cells', 'organism', '#10B981'),
  ('PCR', 'technique', '#3B82F6'),
  ('Western Blot', 'technique', '#3B82F6'),
  ('CRISPR', 'technique', '#3B82F6'),
  ('Taq Polymerase', 'reagent', '#F59E0B'),
  ('DMSO', 'reagent', '#F59E0B'),
  ('Antibody', 'reagent', '#F59E0B'),
  ('Thermocycler', 'equipment', '#8B5CF6'),
  ('Microscope', 'equipment', '#8B5CF6'),
  ('Centrifuge', 'equipment', '#8B5CF6'),
  ('Protein Expression', 'other', '#6B7280'),
  ('Gene Cloning', 'other', '#6B7280')
ON CONFLICT (name) DO NOTHING;

-- Insert sample experiments
INSERT INTO experiments (title, description, researcher_name, status) VALUES
  (
    'CRISPR-Cas9 Gene Editing in E. coli',
    'Investigating the efficiency of CRISPR-Cas9 system for targeted gene knockout in E. coli strain DH5α.',
    'Dr. Sarah Johnson',
    'in_progress'
  ),
  (
    'Protein Expression Analysis in Yeast',
    'Comparative analysis of recombinant protein expression levels in different S. cerevisiae strains.',
    'Dr. Michael Chen',
    'completed'
  ),
  (
    'Cell Viability Assay Development',
    'Development of a high-throughput cell viability assay for drug screening using HeLa cell line.',
    'Dr. Emily Rodriguez',
    'planning'
  )
ON CONFLICT DO NOTHING;

-- Add some sample experiment-tag relationships
INSERT INTO experiment_tags (experiment_id, tag_id) 
SELECT e.id, t.id 
FROM experiments e, tags t 
WHERE (e.title LIKE '%E. coli%' AND t.name = 'E. coli')
   OR (e.title LIKE '%E. coli%' AND t.name = 'CRISPR')
   OR (e.title LIKE '%Yeast%' AND t.name = 'S. cerevisiae')
   OR (e.title LIKE '%Yeast%' AND t.name = 'Protein Expression')
   OR (e.title LIKE '%Cell Viability%' AND t.name = 'HeLa cells')
ON CONFLICT (experiment_id, tag_id) DO NOTHING;

-- Create storage bucket for research files
INSERT INTO storage.buckets (id, name, public)
VALUES ('research-files', 'research-files', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policy for research files
DROP POLICY IF EXISTS "Allow all operations on research files" ON storage.objects;
CREATE POLICY "Allow all operations on research files" ON storage.objects
FOR ALL USING (bucket_id = 'research-files');
