-- Run this after the migration to verify everything worked
SELECT 
    'experiments' as table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'experiments' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check if new tables were created
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('tags', 'experiment_tags', 'files')
ORDER BY table_name;

-- Check RLS is enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('experiments', 'tags', 'experiment_tags', 'files');
