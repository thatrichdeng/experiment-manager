-- Check if tags table exists and add missing columns
DO $$ 
BEGIN
    -- Add category column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tags' AND column_name = 'category') THEN
        ALTER TABLE tags ADD COLUMN category TEXT CHECK (category IN ('organism', 'reagent', 'technique', 'equipment', 'other')) DEFAULT 'other';
    END IF;
    
    -- Add color column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tags' AND column_name = 'color') THEN
        ALTER TABLE tags ADD COLUMN color TEXT DEFAULT '#3B82F6';
    END IF;
    
    -- Add created_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tags' AND column_name = 'created_at') THEN
        ALTER TABLE tags ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- Update existing tags to have proper categories if they don't have them
UPDATE tags SET category = 'other' WHERE category IS NULL;
UPDATE tags SET color = '#3B82F6' WHERE color IS NULL;
UPDATE tags SET created_at = NOW() WHERE created_at IS NULL;

-- Insert sample tags if the table is empty
INSERT INTO tags (name, category, color) 
SELECT * FROM (VALUES
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
) AS v(name, category, color)
WHERE NOT EXISTS (SELECT 1 FROM tags WHERE tags.name = v.name);
