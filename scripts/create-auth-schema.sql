-- Update experiments table to include user_id
ALTER TABLE experiments ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update tags table to include user_id
ALTER TABLE tags ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update RLS policies for experiments
DROP POLICY IF EXISTS "Allow all operations on experiments" ON experiments;
CREATE POLICY "Users can view own experiments" ON experiments
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own experiments" ON experiments
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own experiments" ON experiments
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own experiments" ON experiments
  FOR DELETE USING (auth.uid() = user_id);

-- Update RLS policies for tags
DROP POLICY IF EXISTS "Allow all operations on tags" ON tags;
CREATE POLICY "Users can view own tags" ON tags
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tags" ON tags
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tags" ON tags
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tags" ON tags
  FOR DELETE USING (auth.uid() = user_id);

-- Update RLS policies for experiment_tags (allow access if user owns the experiment)
DROP POLICY IF EXISTS "Allow all operations on experiment_tags" ON experiment_tags;
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

-- Update RLS policies for protocols
DROP POLICY IF EXISTS "Allow all operations on protocols" ON protocols;
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

-- Update RLS policies for data_files
DROP POLICY IF EXISTS "Allow all operations on data_files" ON data_files;
CREATE POLICY "Users can view own data files" ON data_files
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM experiments 
      WHERE experiments.id = data_files.experiment_id 
      AND experiments.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can insert own data files" ON data_files
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM experiments 
      WHERE experiments.id = data_files.experiment_id 
      AND experiments.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can update own data files" ON data_files
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM experiments 
      WHERE experiments.id = data_files.experiment_id 
      AND experiments.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can delete own data files" ON data_files
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM experiments 
      WHERE experiments.id = data_files.experiment_id 
      AND experiments.user_id = auth.uid()
    )
  );

-- Update storage policies
DROP POLICY IF EXISTS "Allow all operations on research files" ON storage.objects;
CREATE POLICY "Users can view own files" ON storage.objects
  FOR SELECT USING (bucket_id = 'research-files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can insert own files" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'research-files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update own files" ON storage.objects
  FOR UPDATE USING (bucket_id = 'research-files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own files" ON storage.objects
  FOR DELETE USING (bucket_id = 'research-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create a demo user (optional - for testing)
-- Note: This would normally be done through the Supabase Auth UI
-- INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
-- VALUES (
--   gen_random_uuid(),
--   'demo@research.com',
--   crypt('demo123', gen_salt('bf')),
--   now(),
--   now(),
--   now()
-- );
