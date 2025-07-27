-- Create storage bucket for research files
INSERT INTO storage.buckets (id, name, public)
VALUES ('research-files', 'research-files', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policy for research files
CREATE POLICY "Allow all operations on research files" ON storage.objects
FOR ALL USING (bucket_id = 'research-files');
