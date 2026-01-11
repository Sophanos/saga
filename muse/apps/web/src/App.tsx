import { useState, useCallback, useEffect } from "react";
import { motion } from "motion/react";
import { Layout } from "./components/Layout";
import { TemplatePickerModal } from "./components/modals";
import { AuthScreen, AuthCallback } from "./components/auth";
import { InviteAcceptPage } from "./components/collaboration";
import { LAST_DOCUMENT_KEY, PENDING_INVITE_TOKEN_KEY } from "./constants/storageKeys";
import { LandingPage } from "@mythos/website/pages";
import { useProjects } from "./hooks/useProjects";
import { useProjectLoader } from "./hooks/useProjectLoader";
import { useAnonymousProjectLoader } from "./hooks/useAnonymousProjectLoader";
import { authClient } from "./lib/auth";
import { useAuthStore } from "./stores/auth";
import { useNavigationStore } from "./stores/navigation";
import { useMythosStore } from "./stores";
import { useRequestProjectStartAction } from "./stores/projectStart";
import { useProjectSelectionStore } from "./stores/projectSelection";

/**
 * Loading screen shown while checking auth state
 */
function LoadingScreen() {
  return (
    <div className="h-screen bg-mythos-bg-primary text-mythos-text-primary font-sans antialiased flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-mythos-accent-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-mythos-text-muted font-mono text-sm">Initializing...</span>
      </div>
    </div>
  );
}

/**
 * Anonymous trial app - handles loading then shows Layout in anonymous mode
 */
function AnonymousTryApp({ onSignUp }: { onSignUp: () => void }) {
  const { isLoading, error } = useAnonymousProjectLoader();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-mythos-bg-primary flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            className="w-8 h-8 mx-auto mb-4"
          >
            <div className="w-full h-full rounded-full border-2 border-mythos-text-muted/20 border-t-mythos-text-primary" />
          </motion.div>
          <p className="text-sm text-mythos-text-muted">Preparing your workspace...</p>
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-mythos-bg-primary flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-sm"
        >
          <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-mythos-accent-red/10 border border-mythos-accent-red/20 flex items-center justify-center">
            <span className="text-mythos-accent-red text-xl">!</span>
          </div>
          <h2 className="text-lg font-medium text-mythos-text-primary mb-2">
            Something went wrong
          </h2>
          <p className="text-sm text-mythos-text-muted mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg bg-mythos-bg-secondary border border-mythos-border-default hover:bg-mythos-bg-tertiary transition-colors text-sm font-medium"
          >
            Try again
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-mythos-bg-primary text-mythos-text-primary font-sans antialiased flex flex-col">
      <div className="flex-1 min-h-0">
        <Layout isAnonymous onSignUp={onSignUp} />
      </div>
    </div>
  );
}

/**
 * Main authenticated app content
 */
function AuthenticatedApp() {
  const selectedProjectId = useProjectSelectionStore((s) => s.selectedProjectId);
  const setSelectedProjectId = useProjectSelectionStore((s) => s.setSelectedProjectId);
  const clearSelectedProjectId = useProjectSelectionStore((s) => s.clearSelectedProjectId);
  const currentDocumentId = useMythosStore((s) => s.document.currentDocument?.id ?? null);

  // State for create project modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Fetch project list (Convex queries are reactive, no manual reload needed)
  const { projects, isLoading: projectsLoading, error: projectsError } = useProjects();

  // Load selected project data into stores
  const { isLoading: projectLoading, error: projectLoadError } = useProjectLoader({
    projectId: selectedProjectId,
    autoLoad: true,
  });

  // Handle project selection - also persist to localStorage
  const handleSelectProject = useCallback((projectId: string) => {
    setSelectedProjectId(projectId);
  }, [setSelectedProjectId]);

  // Handle clearing a project (e.g., when project not found)
  const clearSelectedProject = useCallback(() => {
    clearSelectedProjectId();
  }, [clearSelectedProjectId]);

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
  const requestProjectStartAction = useRequestProjectStartAction();
  const resetForProjectSwitch = useMythosStore((s) => s.resetForProjectSwitch);
  const setCurrentProject = useMythosStore((s) => s.setCurrentProject);

  useEffect(() => {
    if (showProjectSelector) {
      clearSelectedProject();
      if (openNewProjectModal) {
        if (!projectsLoading && !projectsError && projects.length === 0) {
          requestProjectStartAction("ai-builder");
        } else {
          setIsCreateModalOpen(true);
        }
      }
      clearNavigationRequest();
    }
  }, [
    showProjectSelector,
    openNewProjectModal,
    projectsLoading,
    projectsError,
    projects.length,
    clearSelectedProject,
    clearNavigationRequest,
    requestProjectStartAction,
  ]);

  useEffect(() => {
    if (selectedProjectId !== null) return;
    if (projectsLoading || projectsError) return;
    if (projects.length > 0) return;

    resetForProjectSwitch();
    setCurrentProject(null);
  }, [
    selectedProjectId,
    projectsLoading,
    projectsError,
    projects.length,
    resetForProjectSwitch,
    setCurrentProject,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (currentDocumentId) {
      localStorage.setItem(LAST_DOCUMENT_KEY, currentDocumentId);
      return;
    }
    localStorage.removeItem(LAST_DOCUMENT_KEY);
  }, [currentDocumentId]);

  // Handle successful project creation
  const handleProjectCreated = useCallback((projectId: string) => {
    // Close the modal
    setIsCreateModalOpen(false);
    // Select the newly created project (Convex will auto-update the list)
    handleSelectProject(projectId);
  }, [handleSelectProject]);

  useEffect(() => {
    if (selectedProjectId !== null) return;
    if (projectsLoading || projectsError) return;
    if (projects.length === 0) return;

    const sorted = [...projects].sort((a, b) => b.updatedAt - a.updatedAt);
    setSelectedProjectId(sorted[0].id);
  }, [selectedProjectId, projectsLoading, projectsError, projects, setSelectedProjectId]);

  // Show project start flow when no project is selected and none exist
  if (selectedProjectId === null) {
    if (!projectsLoading && !projectsError && projects.length === 0) {
      return (
        <div className="h-screen bg-mythos-bg-primary text-mythos-text-primary font-sans antialiased">
          <Layout showProjectStart onProjectCreated={handleProjectCreated} />
          <TemplatePickerModal
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
            onCreated={handleProjectCreated}
          />
        </div>
      );
    }
  }

  // Show loading state while project is loading
  if (projectLoading) {
    return (
      <div className="h-screen bg-mythos-bg-primary text-mythos-text-primary font-sans antialiased flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-mythos-accent-primary border-t-transparent rounded-full animate-spin" />
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
            className="px-4 py-2 bg-mythos-bg-secondary border border-mythos-border-default rounded text-sm hover:border-mythos-accent-primary/50 transition-colors font-mono"
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
      <TemplatePickerModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={handleProjectCreated}
      />
    </div>
  );
}

function App() {
  // Auth state from store
  const isLoading = useAuthStore((state) => state.isLoading);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setAuthenticatedUser = useAuthStore((state) => state.setAuthenticatedUser);
  const setLoading = useAuthStore((state) => state.setLoading);
  const signOut = useAuthStore((state) => state.signOut);

  // State for showing auth screen vs landing page
  // Initialize based on URL path to support direct navigation
  const [showAuth, setShowAuth] = useState(() => {
    const path = window.location.pathname;
    return path === "/login" || path === "/signup";
  });

  // Check for /try route (anonymous trial)
  const pathname = window.location.pathname;
  const isTryRoute = pathname === "/try";

  // Check if we're on the auth callback route
  const isAuthCallback = pathname === "/auth/callback" ||
    window.location.search.includes("code=");

  // Check if we're on an invite route
  const inviteMatch = pathname.match(/^\/invite\/([^/]+)$/);
  const inviteTokenFromPath = inviteMatch?.[1] ?? null;
  const pendingInviteToken = sessionStorage.getItem(PENDING_INVITE_TOKEN_KEY);
  const inviteToken = inviteTokenFromPath ?? pendingInviteToken;
  const isInviteRoute = Boolean(inviteToken);

  // Sync Better Auth session with Zustand store
  const { data: session, isPending: sessionLoading } = authClient.useSession();

  useEffect(() => {
    setLoading(sessionLoading);
    if (sessionLoading) return;

    if (session?.user) {
      setAuthenticatedUser({
        id: session.user.id,
        email: session.user.email,
        name: session.user.name ?? undefined,
        avatarUrl: session.user.image ?? undefined,
      });
    } else {
      signOut();
    }
  }, [session, sessionLoading, setAuthenticatedUser, setLoading, signOut]);

  // Show loading state while checking auth
  if (isLoading) {
    return <LoadingScreen />;
  }

  // Handle OAuth callback
  if (isAuthCallback) {
    return <AuthCallback onComplete={() => window.location.href = "/"} />;
  }

  // Handle invitation acceptance route
  if (isInviteRoute && inviteToken) {
    return <InviteAcceptPage token={inviteToken} />;
  }

  // Handle /try route (anonymous trial) - shows real app with trial limits
  if (isTryRoute && !isAuthenticated) {
    return (
      <AnonymousTryApp
        onSignUp={() => {
          window.history.pushState({}, "", "/signup");
          setShowAuth(true);
        }}
      />
    );
  }

  // If on /try but authenticated, redirect to main app
  if (isTryRoute && isAuthenticated) {
    window.history.replaceState({}, "", "/");
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
