import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CollaborativeEditor, Editor } from './components';
import type { NativeToEditorMessage } from './bridge';
import './styles/tokens.css';
import './styles/suggestions.css';

interface EditorBundleProps {
  initialContent?: string;
  placeholder?: string;
  editable?: boolean;
}

interface CollaborationConfig {
  projectId: string;
  documentId: string;
  user: { id: string; name: string; avatarUrl?: string };
  authToken?: string;
  convexUrl?: string;
}

function useCollaborationConfig() {
  const [config, setConfig] = useState<CollaborationConfig | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as NativeToEditorMessage | undefined;
      if (!detail) return;
      if (detail.type === 'connectCollaboration') {
        setConfig({
          projectId: detail.projectId,
          documentId: detail.documentId,
          user: detail.user,
          authToken: detail.authToken,
          convexUrl: detail.convexUrl ?? import.meta.env['VITE_CONVEX_URL'],
        });
      }
      if (detail.type === 'disconnectCollaboration') {
        setConfig(null);
      }
    };

    window.addEventListener('editor-bridge-message', handler as EventListener);
    return () => window.removeEventListener('editor-bridge-message', handler as EventListener);
  }, []);

  return config;
}

function EditorBundle({
  initialContent = '',
  placeholder = 'Start writing...',
  editable = true,
}: EditorBundleProps) {
  const collaboration = useCollaborationConfig();

  if (collaboration) {
    return (
      <CollaborativeEditor
        projectId={collaboration.projectId}
        documentId={collaboration.documentId}
        user={collaboration.user}
        authToken={collaboration.authToken}
        convexUrl={collaboration.convexUrl}
        placeholder={placeholder}
        editable={editable}
        showTitle={false}
        autoFocus
        enableBridge
      />
    );
  }

  return (
    <Editor
      content={initialContent}
      placeholder={placeholder}
      editable={editable}
      showTitle={false}
      autoFocus
      enableBridge
    />
  );
}

function mount(container: HTMLElement, props?: EditorBundleProps) {
  const root = createRoot(container);
  root.render(<EditorBundle {...props} />);
  return root;
}

(window as any).EditorBundle = { mount, EditorBundle };

const rootEl = document.getElementById('root');
if (rootEl) {
  mount(rootEl);
}
