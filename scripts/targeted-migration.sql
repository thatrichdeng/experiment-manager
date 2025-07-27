-- Since auth.users exists, let's add user_id columns step by step

-- Step 1: Add user_id to experiments table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'experiments' 
        AND column_name = 'user_id'
        AND table_schema = 'public'
    ) THEN
        -- Add the column first
        ALTER TABLE experiments ADD COLUMN user_id UUID;
        
        -- Add the foreign key constraint
        ALTER TABLE experiments 
        ADD CONSTRAINT experiments_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
        
        RAISE NOTICE 'Added user_id column to experiments table';
    ELSE
        RAISE NOTICE 'user_id column already exists in experiments table';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error adding user_id to experiments: %', SQLERRM;
END $$;

-- Step 2: Add other missing columns to experiments
DO $$ 
BEGIN
    -- Add description if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'experiments' AND column_name = 'description'
    ) THEN
        ALTER TABLE experiments ADD COLUMN description TEXT;
        RAISE NOTICE 'Added description column';
    END IF;
    
    -- Add researcher_name if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'experiments' AND column_name = 'researcher_name'
    ) THEN
        ALTER TABLE experiments ADD COLUMN researcher_name TEXT;
        RAISE NOTICE 'Added researcher_name column';
    END IF;
    
    -- Add status if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'experiments' AND column_name = 'status'
    ) THEN
        ALTER TABLE experiments ADD COLUMN status TEXT 
        CHECK (status IN ('planning', 'in_progress', 'completed', 'on_hold')) 
        DEFAULT 'planning';
        RAISE NOTICE 'Added status column';
    END IF;
    
    -- Add updated_at if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'experiments' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE experiments ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        RAISE NOTICE 'Added updated_at column';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error adding columns to experiments: %', SQLERRM;
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
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            category TEXT CHECK (category IN ('organism', 'reagent', 'technique', 'equipment', 'other')) DEFAULT 'other',
            color TEXT DEFAULT '#3B82F6',
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            CONSTRAINT tags_pkey PRIMARY KEY (id),
            CONSTRAINT tags_user_name_unique UNIQUE (user_id, name)
        );
        RAISE NOTICE 'Created tags table';
    ELSE
        RAISE NOTICE 'Tags table already exists';
        
        -- Add user_id to existing tags table if missing
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'tags' AND column_name = 'user_id'
        ) THEN
            ALTER TABLE tags ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
            RAISE NOTICE 'Added user_id to existing tags table';
        END IF;
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error with tags table: %', SQLERRM;
END $$;

-- Step 4: Create experiment_tags junction table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'experiment_tags' AND table_schema = 'public'
    ) THEN
        CREATE TABLE experiment_tags (
            id UUID NOT NULL DEFAULT gen_random_uuid(),
            experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
            tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            CONSTRAINT experiment_tags_pkey PRIMARY KEY (id),
            CONSTRAINT experiment_tags_unique UNIQUE (experiment_id, tag_id)
        );
        RAISE NOTICE 'Created experiment_tags table';
    ELSE
        RAISE NOTICE 'experiment_tags table already exists';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error with experiment_tags table: %', SQLERRM;
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
            experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
            file_name TEXT NOT NULL,
            file_url TEXT NOT NULL,
            file_type TEXT,
            file_size BIGINT,
            description TEXT,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            CONSTRAINT files_pkey PRIMARY KEY (id)
        );
        RAISE NOTICE 'Created files table';
    ELSE
        RAISE NOTICE 'files table already exists';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error with files table: %', SQLERRM;
END $$;

-- Step 6: Enable RLS and create policies
DO $$ 
BEGIN
    -- Enable RLS on all tables
    ALTER TABLE experiments ENABLE ROW LEVEL SECURITY;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tags') THEN
        ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'experiment_tags') THEN
        ALTER TABLE experiment_tags ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'files') THEN
        ALTER TABLE files ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'protocols') THEN
        ALTER TABLE protocols ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'results') THEN
        ALTER TABLE results ENABLE ROW LEVEL SECURITY;
    END IF;
    
    RAISE NOTICE 'Enabled RLS on all tables';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error enabling RLS: %', SQLERRM;
END $$;

-- Step 7: Create RLS policies
DO $$ 
BEGIN
    -- Experiments policies
    DROP POLICY IF EXISTS "Users can view own experiments" ON experiments;
    DROP POLICY IF EXISTS "Users can insert own experiments" ON experiments;
    DROP POLICY IF EXISTS "Users can update own experiments" ON experiments;
    DROP POLICY IF EXISTS "Users can delete own experiments" ON experiments;

    CREATE POLICY "Users can view own experiments" ON experiments
        FOR SELECT USING (auth.uid() = user_id);
    CREATE POLICY "Users can insert own experiments" ON experiments
        FOR INSERT WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "Users can update own experiments" ON experiments
        FOR UPDATE USING (auth.uid() = user_id);
    CREATE POLICY "Users can delete own experiments" ON experiments
        FOR DELETE USING (auth.uid() = user_id);

    -- Tags policies
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tags') THEN
        DROP POLICY IF EXISTS "Users can view own tags" ON tags;
        DROP POLICY IF EXISTS "Users can insert own tags" ON tags;
        DROP POLICY IF EXISTS "Users can update own tags" ON tags;
        DROP POLICY IF EXISTS "Users can delete own tags" ON tags;

        CREATE POLICY "Users can view own tags" ON tags
            FOR SELECT USING (auth.uid() = user_id);
        CREATE POLICY "Users can insert own tags" ON tags
            FOR INSERT WITH CHECK (auth.uid() = user_id);
        CREATE POLICY "Users can update own tags" ON tags
            FOR UPDATE USING (auth.uid() = user_id);
        CREATE POLICY "Users can delete own tags" ON tags
            FOR DELETE USING (auth.uid() = user_id);
    END IF;

    -- Experiment_tags policies
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'experiment_tags') THEN
        DROP POLICY IF EXISTS "Users can view own experiment tags" ON experiment_tags;
        DROP POLICY IF EXISTS "Users can insert own experiment tags" ON experiment_tags;
        DROP POLICY IF EXISTS "Users can delete own experiment tags" ON experiment_tags;

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

    RAISE NOTICE 'Created RLS policies';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error creating policies: %', SQLERRM;
END $$;

-- Step 8: Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_experiments_updated_at ON experiments;
CREATE TRIGGER update_experiments_updated_at 
    BEFORE UPDATE ON experiments 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

RAISE NOTICE 'Migration completed! Check the notices above for any errors.';
