import { useCallback } from 'react';
import { AppShell } from './components/layout/AppShell';
import { ManifestPanel } from './components/manifest/ManifestPanel';
import { EditorWebView } from './components/editor/EditorWebView';

function App() {
  const handleContentChange = useCallback((content: string, _html: string) => {
    console.log('[App] Content changed:', content.slice(0, 100));
  }, []);

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
          />
        </main>
      </div>
    </AppShell>
  );
}

export default App;
