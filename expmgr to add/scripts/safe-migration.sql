-- Step 1: Add user_id to experiments table if it doesn't exist
DO $$ 
BEGIN
    -- Check if user_id column exists in experiments table
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'experiments' 
        AND column_name = 'user_id'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE experiments ADD COLUMN user_id UUID;
        
        -- Add foreign key constraint if auth.users exists
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'auth' AND table_name = 'users'
        ) THEN
            ALTER TABLE experiments 
            ADD CONSTRAINT experiments_user_id_fkey 
            FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
        END IF;
        
        RAISE NOTICE 'Added user_id column to experiments table';
    ELSE
        RAISE NOTICE 'user_id column already exists in experiments table';
    END IF;
END $$;

-- Step 2: Add missing columns to experiments table
DO $$ 
BEGIN
    -- Add description column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'experiments' AND column_name = 'description'
    ) THEN
        ALTER TABLE experiments ADD COLUMN description TEXT;
        RAISE NOTICE 'Added description column to experiments';
    END IF;
    
    -- Add researcher_name column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'experiments' AND column_name = 'researcher_name'
    ) THEN
        ALTER TABLE experiments ADD COLUMN researcher_name TEXT;
        RAISE NOTICE 'Added researcher_name column to experiments';
    END IF;
    
    -- Add status column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'experiments' AND column_name = 'status'
    ) THEN
        ALTER TABLE experiments ADD COLUMN status TEXT 
        CHECK (status IN ('planning', 'in_progress', 'completed', 'on_hold')) 
        DEFAULT 'planning';
        RAISE NOTICE 'Added status column to experiments';
    END IF;
    
    -- Add updated_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'experiments' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE experiments ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        RAISE NOTICE 'Added updated_at column to experiments';
    END IF;
END $$;

-- Step 3: Create tags table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'tags' AND table_schema = 'public'
    ) THEN
        CREATE TABLE tags (
            id UUID NOT NULL DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL,
            name TEXT NOT NULL,
            category TEXT CHECK (category IN ('organism', 'reagent', 'technique', 'equipment', 'other')) DEFAULT 'other',
            color TEXT DEFAULT '#3B82F6',
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            CONSTRAINT tags_pkey PRIMARY KEY (id),
            CONSTRAINT tags_user_name_unique UNIQUE (user_id, name)
        );
        
        -- Add foreign key constraint if auth.users exists
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'auth' AND table_name = 'users'
        ) THEN
            ALTER TABLE tags 
            ADD CONSTRAINT tags_user_id_fkey 
            FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
        END IF;
        
        RAISE NOTICE 'Created tags table';
    ELSE
        -- If tags table exists, add user_id column if missing
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'tags' AND column_name = 'user_id'
        ) THEN
            ALTER TABLE tags ADD COLUMN user_id UUID;
            
            -- Add foreign key constraint if auth.users exists
            IF EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_schema = 'auth' AND table_name = 'users'
            ) THEN
                ALTER TABLE tags 
                ADD CONSTRAINT tags_user_id_fkey 
                FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
            END IF;
            
            RAISE NOTICE 'Added user_id column to existing tags table';
        END IF;
        
        -- Add other missing columns to tags
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'tags' AND column_name = 'category'
        ) THEN
            ALTER TABLE tags ADD COLUMN category TEXT 
            CHECK (category IN ('organism', 'reagent', 'technique', 'equipment', 'other')) 
            DEFAULT 'other';
            RAISE NOTICE 'Added category column to tags';
        END IF;
        
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'tags' AND column_name = 'color'
        ) THEN
            ALTER TABLE tags ADD COLUMN color TEXT DEFAULT '#3B82F6';
            RAISE NOTICE 'Added color column to tags';
        END IF;
    END IF;
END $$;

-- Step 4: Create experiment_tags junction table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'experiment_tags' AND table_schema = 'public'
    ) THEN
        CREATE TABLE experiment_tags (
            id UUID NOT NULL DEFAULT gen_random_uuid(),
            experiment_id UUID NOT NULL,
            tag_id UUID NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            CONSTRAINT experiment_tags_pkey PRIMARY KEY (id),
            CONSTRAINT experiment_tags_experiment_id_fkey FOREIGN KEY (experiment_id) REFERENCES experiments (id) ON DELETE CASCADE,
            CONSTRAINT experiment_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE,
            CONSTRAINT experiment_tags_unique UNIQUE (experiment_id, tag_id)
        );
        RAISE NOTICE 'Created experiment_tags table';
    END IF;
END $$;

-- Step 5: Create files table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'files' AND table_schema = 'public'
    ) THEN
        CREATE TABLE files (
            id UUID NOT NULL DEFAULT gen_random_uuid(),
            experiment_id UUID NOT NULL,
            file_name TEXT NOT NULL,
            file_url TEXT NOT NULL,
            file_type TEXT,
            file_size BIGINT,
            description TEXT,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            CONSTRAINT files_pkey PRIMARY KEY (id),
            CONSTRAINT files_experiment_id_fkey FOREIGN KEY (experiment_id) REFERENCES experiments (id) ON DELETE CASCADE
        );
        RAISE NOTICE 'Created files table';
    END IF;
END $$;

-- Step 6: Create updated_at trigger function and trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop trigger if it exists and recreate it
DROP TRIGGER IF EXISTS update_experiments_updated_at ON experiments;
CREATE TRIGGER update_experiments_updated_at 
    BEFORE UPDATE ON experiments 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Step 7: Enable Row Level Security on all tables
ALTER TABLE experiments ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
        ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'protocols') THEN
        ALTER TABLE protocols ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'results') THEN
        ALTER TABLE results ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tags') THEN
        ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'experiment_tags') THEN
        ALTER TABLE experiment_tags ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'files') THEN
        ALTER TABLE files ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Step 8: Create RLS policies only if auth.users exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'auth' AND table_name = 'users'
    ) THEN
        -- Drop existing policies first
        DROP POLICY IF EXISTS "Users can view own experiments" ON experiments;
        DROP POLICY IF EXISTS "Users can insert own experiments" ON experiments;
        DROP POLICY IF EXISTS "Users can update own experiments" ON experiments;
        DROP POLICY IF EXISTS "Users can delete own experiments" ON experiments;
        DROP POLICY IF EXISTS "Allow all operations on experiments" ON experiments;

        -- Create RLS policies for experiments
        CREATE POLICY "Users can view own experiments" ON experiments
            FOR SELECT USING (auth.uid() = user_id);
        CREATE POLICY "Users can insert own experiments" ON experiments
            FOR INSERT WITH CHECK (auth.uid() = user_id);
        CREATE POLICY "Users can update own experiments" ON experiments
            FOR UPDATE USING (auth.uid() = user_id);
        CREATE POLICY "Users can delete own experiments" ON experiments
            FOR DELETE USING (auth.uid() = user_id);

        -- Create policies for other tables if they exist
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tags') THEN
            DROP POLICY IF EXISTS "Users can view own tags" ON tags;
            DROP POLICY IF EXISTS "Users can insert own tags" ON tags;
            DROP POLICY IF EXISTS "Users can update own tags" ON tags;
            DROP POLICY IF EXISTS "Users can delete own tags" ON tags;
            DROP POLICY IF EXISTS "Allow all operations on tags" ON tags;

            CREATE POLICY "Users can view own tags" ON tags
                FOR SELECT USING (auth.uid() = user_id);
            CREATE POLICY "Users can insert own tags" ON tags
                FOR INSERT WITH CHECK (auth.uid() = user_id);
            CREATE POLICY "Users can update own tags" ON tags
                FOR UPDATE USING (auth.uid() = user_id);
            CREATE POLICY "Users can delete own tags" ON tags
                FOR DELETE USING (auth.uid() = user_id);
        END IF;

        -- Create policies for experiment_tags
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'experiment_tags') THEN
            DROP POLICY IF EXISTS "Users can view own experiment tags" ON experiment_tags;
            DROP POLICY IF EXISTS "Users can insert own experiment tags" ON experiment_tags;
            DROP POLICY IF EXISTS "Users can delete own experiment tags" ON experiment_tags;
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
        END IF;

        RAISE NOTICE 'Created RLS policies for authenticated users';
    ELSE
        RAISE NOTICE 'auth.users table not found - skipping RLS policies';
    END IF;
END $$;

-- Step 9: Create storage bucket (this might fail if storage extension isn't enabled)
DO $$ 
BEGIN
    BEGIN
        INSERT INTO storage.buckets (id, name, public)
        VALUES ('research-files', 'research-files', true)
        ON CONFLICT (id) DO NOTHING;
        RAISE NOTICE 'Created storage bucket';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not create storage bucket - storage extension may not be enabled';
    END;
END $$;

RAISE NOTICE 'Migration completed successfully!';
