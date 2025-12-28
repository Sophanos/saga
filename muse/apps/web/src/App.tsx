import { useState, useCallback, useEffect } from "react";
import { Layout } from "./components/Layout";
import { ProjectSelectorScreen } from "./components/projects";
import { ProjectCreateModal } from "./components/modals";
import { useProjects } from "./hooks/useProjects";
import { useProjectLoader } from "./hooks/useProjectLoader";

const LAST_PROJECT_KEY = "mythos:lastProjectId";

function App() {
  // State for selected project - initialize from localStorage
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    () => localStorage.getItem(LAST_PROJECT_KEY)
  );

  // State for create project modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Fetch project list
  const { projects, isLoading: projectsLoading, error: projectsError, reload: reloadProjects } = useProjects();

  // Load selected project data into stores
  const { isLoading: projectLoading, error: projectLoadError } = useProjectLoader({
    projectId: selectedProjectId,
    autoLoad: true,
  });

  // Handle project selection - also persist to localStorage
  const handleSelectProject = useCallback((projectId: string) => {
    setSelectedProjectId(projectId);
    localStorage.setItem(LAST_PROJECT_KEY, projectId);
  }, []);

  // Handle clearing a project (e.g., when project not found)
  const clearSelectedProject = useCallback(() => {
    setSelectedProjectId(null);
    localStorage.removeItem(LAST_PROJECT_KEY);
  }, []);

  // Handle "not found" errors - clear localStorage and reset to project selector
  useEffect(() => {
    if (projectLoadError && projectLoadError.toLowerCase().includes("not found")) {
      // The stored project was deleted, clear it from localStorage
      clearSelectedProject();
    }
  }, [projectLoadError, clearSelectedProject]);

  // Handle opening the create project modal
  const handleCreateProject = useCallback(() => {
    setIsCreateModalOpen(true);
  }, []);

  // Handle successful project creation
  const handleProjectCreated = useCallback(async (projectId: string) => {
    // Close the modal
    setIsCreateModalOpen(false);
    // Reload the project list
    await reloadProjects();
    // Select the newly created project
    handleSelectProject(projectId);
  }, [reloadProjects, handleSelectProject]);

  // Handle retry on error
  const handleRetry = useCallback(() => {
    reloadProjects();
  }, [reloadProjects]);

  // Show project selector when no project is selected
  if (selectedProjectId === null) {
    return (
      <div className="h-screen bg-mythos-bg-primary text-mythos-text-primary font-sans antialiased">
        <ProjectSelectorScreen
          projects={projects}
          isLoading={projectsLoading}
          error={projectsError}
          onSelect={handleSelectProject}
          onCreate={handleCreateProject}
          onRetry={handleRetry}
        />
        <ProjectCreateModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onCreated={handleProjectCreated}
        />
      </div>
    );
  }

  // Show loading state while project is loading
  if (projectLoading) {
    return (
      <div className="h-screen bg-mythos-bg-primary text-mythos-text-primary font-sans antialiased flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-mythos-accent-cyan border-t-transparent rounded-full animate-spin" />
          <span className="text-mythos-text-muted font-mono text-sm">Loading project...</span>
        </div>
      </div>
    );
  }

  // Show error state if project failed to load
  if (projectLoadError) {
    return (
      <div className="h-screen bg-mythos-bg-primary text-mythos-text-primary font-sans antialiased flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center px-4">
          <span className="text-mythos-accent-red font-semibold">Failed to load project</span>
          <span className="text-mythos-text-muted text-sm">{projectLoadError}</span>
          <button
            onClick={clearSelectedProject}
            className="px-4 py-2 bg-mythos-bg-secondary border border-mythos-text-muted/20 rounded text-sm hover:border-mythos-accent-cyan/50 transition-colors font-mono"
          >
            Back to Projects
          </button>
        </div>
      </div>
    );
  }

  // Show main editor when project is loaded
  return (
    <div className="h-screen bg-mythos-bg-primary text-mythos-text-primary font-sans antialiased">
      <Layout />
    </div>
  );
}

export default App;
