import React, { useState, useEffect } from 'react';
import { createProject, getProjects, deleteProject, saveProjectFiles, getProjectFiles, type Project } from '../src/services/supabaseService';
import type { UploadedFile, ProcessedFile } from '../src/types';
import './ProjectManager.css';

interface ProjectManagerProps {
  onLoadProject: (files: UploadedFile[]) => void;
  currentFiles: UploadedFile[];
  processedFiles: ProcessedFile[];
}

export function ProjectManager({ onLoadProject, currentFiles, processedFiles }: ProjectManagerProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setIsLoading(true);
    try {
      const data = await getProjects();
      setProjects(data);
    } catch (error) {
      console.error('Fehler beim Laden der Projekte:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProject = async () => {
    if (!projectName.trim() || currentFiles.length === 0) return;

    setIsLoading(true);
    try {
      const project = await createProject(projectName);
      
      const filesToSave = currentFiles.map(file => ({
        name: file.file.name,
        data: file.dataUrl,
        type: file.file.type
      }));

      await saveProjectFiles(project.id, filesToSave);
      setProjectName('');
      setShowSaveDialog(false);
      await loadProjects();
    } catch (error) {
      console.error('Fehler beim Speichern des Projekts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadProject = async (projectId: string) => {
    setIsLoading(true);
    try {
      const files = await getProjectFiles(projectId);
      const uploadedFiles: UploadedFile[] = files.map((file, index) => ({
        id: file.id,
        file: new File([dataURLtoBlob(file.file_data)], file.file_name, { type: file.file_type }),
        dataUrl: file.file_data,
        previewUrl: file.file_data
      }));
      onLoadProject(uploadedFiles);
    } catch (error) {
      console.error('Fehler beim Laden des Projekts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm('Möchtest du dieses Projekt wirklich löschen?')) return;

    setIsLoading(true);
    try {
      await deleteProject(projectId);
      await loadProjects();
    } catch (error) {
      console.error('Fehler beim Löschen des Projekts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const dataURLtoBlob = (dataURL: string): Blob => {
    const arr = dataURL.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  };

  return (
    <div className="project-manager">
      <div className="project-manager-header">
        <h3>Projekte</h3>
        <button 
          onClick={() => setShowSaveDialog(true)}
          disabled={currentFiles.length === 0}
          className="save-project-btn"
        >
          Aktuelles Projekt speichern
        </button>
      </div>

      {showSaveDialog && (
        <div className="save-dialog">
          <input
            type="text"
            placeholder="Projektname"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="project-name-input"
          />
          <div className="dialog-actions">
            <button onClick={() => setShowSaveDialog(false)}>Abbrechen</button>
            <button 
              onClick={handleSaveProject}
              disabled={!projectName.trim() || isLoading}
            >
              Speichern
            </button>
          </div>
        </div>
      )}

      <div className="projects-list">
        {isLoading ? (
          <div>Lade...</div>
        ) : projects.length === 0 ? (
          <div>Keine Projekte gefunden</div>
        ) : (
          projects.map(project => (
            <div key={project.id} className="project-item">
              <div className="project-info">
                <h4>{project.name}</h4>
                <small>Letzte Änderung: {new Date(project.updated_at).toLocaleDateString()}</small>
              </div>
              <div className="project-actions">
                <button onClick={() => handleLoadProject(project.id)}>Laden</button>
                <button 
                  onClick={() => handleDeleteProject(project.id)}
                  className="delete-btn"
                >
                  Löschen
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
