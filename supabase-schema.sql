-- Create projects table
CREATE TABLE projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT DEFAULT 'anonymous' NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create project_files table
CREATE TABLE project_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_data TEXT NOT NULL, -- base64 encoded image data
  file_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_updated_at ON projects(updated_at);
CREATE INDEX idx_project_files_project_id ON project_files(project_id);

-- Enable Row Level Security (RLS)
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users to manage their own projects
CREATE POLICY "Users can manage their own projects" ON projects
  FOR ALL USING (user_id = 'anonymous');

CREATE POLICY "Users can manage their own project files" ON project_files
  FOR ALL USING (EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = project_files.project_id 
    AND projects.user_id = 'anonymous'
  ));

-- Allow public read access for project listing
CREATE POLICY "Enable read access for all users" ON projects
  FOR SELECT USING (true);

CREATE POLICY "Enable read access for project files" ON project_files
  FOR SELECT USING (true);
