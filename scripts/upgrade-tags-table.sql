-- Add category column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tags' AND column_name = 'category') THEN
        ALTER TABLE tags ADD COLUMN category TEXT CHECK (category IN ('organism', 'reagent', 'technique', 'equipment', 'other')) DEFAULT 'other';
        
        -- Update existing tags with appropriate categories based on their names
        UPDATE tags SET category = 'organism' WHERE name IN ('E. coli', 'S. cerevisiae', 'HeLa cells');
        UPDATE tags SET category = 'technique' WHERE name IN ('PCR', 'Western Blot', 'CRISPR', 'Protein Expression', 'Gene Cloning');
        UPDATE tags SET category = 'reagent' WHERE name IN ('Taq Polymerase', 'DMSO', 'Antibody');
        UPDATE tags SET category = 'equipment' WHERE name IN ('Thermocycler', 'Microscope', 'Centrifuge');
    END IF;
    
    -- Add color column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tags' AND column_name = 'color') THEN
        ALTER TABLE tags ADD COLUMN color TEXT DEFAULT '#3B82F6';
        
        -- Update existing tags with appropriate colors based on their categories
        UPDATE tags SET color = '#10B981' WHERE category = 'organism';
        UPDATE tags SET color = '#3B82F6' WHERE category = 'technique';
        UPDATE tags SET color = '#F59E0B' WHERE category = 'reagent';
        UPDATE tags SET color = '#8B5CF6' WHERE category = 'equipment';
        UPDATE tags SET color = '#6B7280' WHERE category = 'other';
    END IF;
END $$;
