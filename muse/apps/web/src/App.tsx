import { useState, useCallback, useEffect } from "react";
import { Layout } from "./components/Layout";
import { ProjectSelectorScreen } from "./components/projects";
import { TemplatePickerModal } from "./components/modals";
import { AuthScreen, AuthCallback } from "./components/auth";
import { LandingPage } from "@mythos/website/pages";
import { useProjects } from "./hooks/useProjects";
import { useProjectLoader } from "./hooks/useProjectLoader";
import { useSupabaseAuthSync } from "./hooks/useSupabaseAuthSync";
import { useAuthStore } from "./stores/auth";
import { useNavigationStore } from "./stores/navigation";

const LAST_PROJECT_KEY = "mythos:lastProjectId";

/**
 * Loading screen shown while checking auth state
 */
function LoadingScreen() {
  return (
    <div className="h-screen bg-mythos-bg-primary text-mythos-text-primary font-sans antialiased flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-mythos-accent-cyan border-t-transparent rounded-full animate-spin" />
        <span className="text-mythos-text-muted font-mono text-sm">Initializing...</span>
      </div>
    </div>
  );
}

/**
 * Main authenticated app content
 */
function AuthenticatedApp() {
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

  // Listen for navigation requests (e.g., from Header's "New Project" button)
  const showProjectSelector = useNavigationStore((s) => s.showProjectSelector);
  const openNewProjectModal = useNavigationStore((s) => s.openNewProjectModal);
  const clearNavigationRequest = useNavigationStore((s) => s.clearNavigationRequest);

  useEffect(() => {
    if (showProjectSelector) {
      clearSelectedProject();
      if (openNewProjectModal) {
        setIsCreateModalOpen(true);
      }
      clearNavigationRequest();
    }
  }, [showProjectSelector, openNewProjectModal, clearSelectedProject, clearNavigationRequest]);

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
        <TemplatePickerModal
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

function App() {
  // Auth state from store
  const isLoading = useAuthStore((state) => state.isLoading);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setAuthenticatedUser = useAuthStore((state) => state.setAuthenticatedUser);
  const setLoading = useAuthStore((state) => state.setLoading);
  const updateUserProfile = useAuthStore((state) => state.updateUserProfile);
  const signOut = useAuthStore((state) => state.signOut);

  // State for showing auth screen vs landing page
  const [showAuth, setShowAuth] = useState(false);

  // Check if we're on the auth callback route
  const isAuthCallback = window.location.pathname === "/auth/callback" ||
    window.location.search.includes("code=");

  // Sync Supabase auth with Zustand store
  useSupabaseAuthSync({
    authStore: {
      setAuthenticatedUser,
      setLoading,
      updateUserProfile,
      signOut,
    },
  });

  // Show loading state while checking auth
  if (isLoading) {
    return <LoadingScreen />;
  }

  // Handle OAuth callback
  if (isAuthCallback) {
    return <AuthCallback onComplete={() => window.location.href = "/"} />;
  }

  // Show landing or auth screen if not authenticated
  if (!isAuthenticated) {
    if (showAuth) {
      return <AuthScreen onBack={() => setShowAuth(false)} />;
    }
    return (
      <div onClick={(e) => {
        const target = e.target as HTMLElement;
        const link = target.closest('a');
        if (link && (link.href.includes('/login') || link.href.includes('/signup'))) {
          e.preventDefault();
          setShowAuth(true);
        }
      }}>
        <LandingPage />
      </div>
    );
  }

  // Show authenticated app
  return <AuthenticatedApp />;
}

export default App;
