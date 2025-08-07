-- First, let's check what we're working with
-- Run this to see your current table structures:
-- SELECT table_name, column_name, data_type, is_nullable
-- FROM information_schema.columns 
-- WHERE table_schema = 'public' 
-- AND table_name IN ('experiments', 'tags', 'experiments-tags', 'profiles', 'protocols', 'files', 'results')
-- ORDER BY table_name, ordinal_position;

-- Add user_id columns if they don't exist
-- For experiments table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'experiments' AND column_name = 'user_id') THEN
        ALTER TABLE experiments ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- For tags table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tags' AND column_name = 'user_id') THEN
        ALTER TABLE tags ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- For protocols table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'protocols' AND column_name = 'user_id') THEN
        -- Check if protocols has experiment_id to link to user through experiments
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'protocols' AND column_name = 'experiment_id') THEN
            -- Don't add user_id to protocols, we'll link through experiments
            NULL;
        ELSE
            ALTER TABLE protocols ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

-- For files table (assuming this is like my data_files)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'files' AND column_name = 'user_id') THEN
        -- Check if files has experiment_id to link to user through experiments
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'files' AND column_name = 'experiment_id') THEN
            -- Don't add user_id to files, we'll link through experiments
            NULL;
        ELSE
            ALTER TABLE files ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

-- For results table
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'results') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'results' AND column_name = 'user_id') THEN
            -- Check if results has experiment_id to link to user through experiments
            IF EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'results' AND column_name = 'experiment_id') THEN
                -- Don't add user_id to results, we'll link through experiments
                NULL;
            ELSE
                ALTER TABLE results ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
            END IF;
        END IF;
    END IF;
END $$;

-- Enable RLS on all tables
ALTER TABLE experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;

-- Enable RLS on experiments-tags junction table
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'experiments-tags') THEN
        ALTER TABLE "experiments-tags" ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Enable RLS on results if it exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'results') THEN
        ALTER TABLE results ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Drop existing policies (they might not exist, so we use IF EXISTS)
DROP POLICY IF EXISTS "Enable read access for all users" ON experiments;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON experiments;
DROP POLICY IF EXISTS "Enable update for users based on email" ON experiments;
DROP POLICY IF EXISTS "Enable delete for users based on email" ON experiments;

-- Create RLS policies for experiments
CREATE POLICY "Users can view own experiments" ON experiments
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own experiments" ON experiments
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own experiments" ON experiments
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own experiments" ON experiments
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for tags
DROP POLICY IF EXISTS "Enable read access for all users" ON tags;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON tags;
CREATE POLICY "Users can view own tags" ON tags
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tags" ON tags
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tags" ON tags
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tags" ON tags
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for protocols (linked through experiments)
DROP POLICY IF EXISTS "Enable read access for all users" ON protocols;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON protocols;
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

-- Create RLS policies for files (linked through experiments)
DROP POLICY IF EXISTS "Enable read access for all users" ON files;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON files;
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

-- Create RLS policies for experiments-tags junction table
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'experiments-tags') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Enable read access for all users" ON "experiments-tags"';
        EXECUTE 'DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON "experiments-tags"';
        EXECUTE 'CREATE POLICY "Users can view own experiment tags" ON "experiments-tags"
          FOR SELECT USING (
            EXISTS (
              SELECT 1 FROM experiments 
              WHERE experiments.id = "experiments-tags".experiment_id 
              AND experiments.user_id = auth.uid()
            )
          )';
        EXECUTE 'CREATE POLICY "Users can insert own experiment tags" ON "experiments-tags"
          FOR INSERT WITH CHECK (
            EXISTS (
              SELECT 1 FROM experiments 
              WHERE experiments.id = "experiments-tags".experiment_id 
              AND experiments.user_id = auth.uid()
            )
          )';
        EXECUTE 'CREATE POLICY "Users can delete own experiment tags" ON "experiments-tags"
          FOR DELETE USING (
            EXISTS (
              SELECT 1 FROM experiments 
              WHERE experiments.id = "experiments-tags".experiment_id 
              AND experiments.user_id = auth.uid()
            )
          )';
    END IF;
END $$;

-- Create RLS policies for results (if it exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'results') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Enable read access for all users" ON results';
        EXECUTE 'DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON results';
        EXECUTE 'CREATE POLICY "Users can view own results" ON results
          FOR SELECT USING (
            EXISTS (
              SELECT 1 FROM experiments 
              WHERE experiments.id = results.experiment_id 
              AND experiments.user_id = auth.uid()
            )
          )';
        EXECUTE 'CREATE POLICY "Users can insert own results" ON results
          FOR INSERT WITH CHECK (
            EXISTS (
              SELECT 1 FROM experiments 
              WHERE experiments.id = results.experiment_id 
              AND experiments.user_id = auth.uid()
            )
          )';
        EXECUTE 'CREATE POLICY "Users can update own results" ON results
          FOR UPDATE USING (
            EXISTS (
              SELECT 1 FROM experiments 
              WHERE experiments.id = results.experiment_id 
              AND experiments.user_id = auth.uid()
            )
          )';
        EXECUTE 'CREATE POLICY "Users can delete own results" ON results
          FOR DELETE USING (
            EXISTS (
              SELECT 1 FROM experiments 
              WHERE experiments.id = results.experiment_id 
              AND experiments.user_id = auth.uid()
            )
          )';
    END IF;
END $$;

-- Create storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('research-files', 'research-files', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies
DROP POLICY IF EXISTS "Give users access to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public downloads" ON storage.objects;

CREATE POLICY "Users can view own files" ON storage.objects
  FOR SELECT USING (bucket_id = 'research-files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can insert own files" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'research-files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update own files" ON storage.objects
  FOR UPDATE USING (bucket_id = 'research-files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own files" ON storage.objects
  FOR DELETE USING (bucket_id = 'research-files' AND auth.uid()::text = (storage.foldername(name))[1]);
