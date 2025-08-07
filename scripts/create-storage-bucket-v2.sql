-- Create storage bucket for research files with proper policies
-- This script handles pre-existing buckets gracefully

-- Create the research-files bucket if it doesn't exist
DO $$ 
BEGIN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('research-files', 'research-files', true)
    ON CONFLICT (id) DO NOTHING;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Bucket creation failed or already exists: %', SQLERRM;
END $$;

-- Drop existing storage policies to avoid conflicts
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can view own files" ON storage.objects;
    DROP POLICY IF EXISTS "Users can upload own files" ON storage.objects;
    DROP POLICY IF EXISTS "Users can update own files" ON storage.objects;
    DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;
    DROP POLICY IF EXISTS "Public can view files" ON storage.objects;
EXCEPTION
    WHEN undefined_object THEN
        NULL; -- Policy doesn't exist, that's fine
END $$;

-- Create storage policies for the research-files bucket
CREATE POLICY "Users can view own files" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'research-files' 
        AND (auth.uid()::text = (storage.foldername(name))[1] OR auth.role() = 'anon')
    );

CREATE POLICY "Users can upload own files" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'research-files' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can update own files" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'research-files' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can delete own files" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'research-files' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Allow public viewing of files (for sharing research data)
CREATE POLICY "Public can view files" ON storage.objects
    FOR SELECT USING (bucket_id = 'research-files');

-- Success message
DO $$ 
BEGIN
    RAISE NOTICE 'Storage bucket and policies created successfully!';
END $$;
