import { useCallback, useMemo } from 'react';
import { useAuthStore } from '@mythos/auth';
import {
  useCurrentProject,
  useDocuments,
  useProjectStore,
} from '@mythos/state';
import { AppShell } from './components/layout/AppShell';
import { ManifestPanel } from './components/manifest/ManifestPanel';
import { EditorWebView } from './components/editor/EditorWebView';

function App() {
  const handleContentChange = useCallback((content: string, _html: string) => {
    console.log('[App] Content changed:', content.slice(0, 100));
  }, []);

  const user = useAuthStore((s) => s.user);
  const sessionToken = useAuthStore((s) => s.session?.token ?? undefined);
  const project = useCurrentProject();
  const documents = useDocuments();
  const currentDocumentId = useProjectStore((s) => s.currentDocumentId);

  const activeDocumentId = useMemo(() => {
    if (currentDocumentId) return currentDocumentId;
    return documents[0]?.id ?? undefined;
  }, [currentDocumentId, documents]);

  const collaborationUser = useMemo(() => {
    if (!user) return undefined;
    return {
      id: user.id,
      name: user.name ?? user.email,
      avatarUrl: user.image ?? undefined,
    };
  }, [user]);

  const handleAIRequest = useCallback(
    (selectedText: string, prompt?: string, action?: string) => {
      console.log('[App] AI Request:', { selectedText, prompt, action });
    },
    []
  );

  const handleEditorReady = useCallback(() => {
    console.log('[App] Editor ready');
  }, []);

  return (
    <AppShell>
      <div className="flex h-full">
        {/* Sidebar */}
        <aside className="w-64 border-r border-mythos-border bg-mythos-surface flex-shrink-0">
          <ManifestPanel />
        </aside>

        {/* Main content - Editor */}
        <main className="flex-1 bg-mythos-bg">
          <EditorWebView
            onContentChange={handleContentChange}
            onAIRequest={handleAIRequest}
            onReady={handleEditorReady}
            projectId={project?.id}
            documentId={activeDocumentId}
            user={collaborationUser}
            authToken={sessionToken}
            convexUrl={import.meta.env.VITE_CONVEX_URL}
          />
        </main>
      </div>
    </AppShell>
  );
}

export default App;
