-- Create a simple tags table with just the essential columns
CREATE TABLE IF NOT EXISTS tags (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

-- Create policy
DROP POLICY IF EXISTS "Allow all operations on tags" ON tags;
CREATE POLICY "Allow all operations on tags" ON tags FOR ALL USING (true);

-- Insert some basic sample tags
INSERT INTO tags (name) VALUES
  ('E. coli'),
  ('S. cerevisiae'),
  ('HeLa cells'),
  ('PCR'),
  ('Western Blot'),
  ('CRISPR'),
  ('Taq Polymerase'),
  ('DMSO'),
  ('Antibody'),
  ('Thermocycler'),
  ('Microscope'),
  ('Centrifuge'),
  ('Protein Expression'),
  ('Gene Cloning')
ON CONFLICT (name) DO NOTHING;
