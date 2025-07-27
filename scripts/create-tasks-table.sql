-- Create the tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows all operations for now
-- In production, you'd want more restrictive policies
CREATE POLICY "Allow all operations on tasks" ON tasks
  FOR ALL USING (true);

-- Insert some sample data
INSERT INTO tasks (title, description, completed) VALUES
  ('Setup Supabase Project', 'Configure the Supabase project and database', true),
  ('Create React Components', 'Build the UI components for the task manager', false),
  ('Implement CRUD Operations', 'Add create, read, update, delete functionality', false),
  ('Add Authentication', 'Implement user authentication with Supabase Auth', false),
  ('Deploy to Production', 'Deploy the application to Vercel', false);
