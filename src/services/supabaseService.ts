import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Project {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectFile {
  id: string;
  project_id: string;
  file_name: string;
  file_data: string; // base64
  file_type: string;
  created_at: string;
}

export async function createProject(name: string): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .insert([{ name }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function saveProjectFiles(projectId: string, files: Array<{name: string, data: string, type: string}>): Promise<void> {
  const filesToInsert = files.map(file => ({
    project_id: projectId,
    file_name: file.name,
    file_data: file.data,
    file_type: file.type
  }));

  const { error } = await supabase
    .from('project_files')
    .insert(filesToInsert);

  if (error) throw error;
}

export async function getProjectFiles(projectId: string): Promise<ProjectFile[]> {
  const { data, error } = await supabase
    .from('project_files')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at');

  if (error) throw error;
  return data;
}

export async function deleteProject(projectId: string): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId);

  if (error) throw error;
}
