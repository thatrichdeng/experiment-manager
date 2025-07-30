-- Check what columns exist in each table
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name IN ('experiments', 'tags', 'protocols', 'files', 'results', 'profiles')
ORDER BY table_name, ordinal_position;

-- Check what tables actually exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('experiments', 'tags', 'protocols', 'files', 'results', 'profiles', 'experiment_tags');

-- Check if auth.users table is accessible
SELECT EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_schema = 'auth' 
    AND table_name = 'users'
) as auth_users_exists;
