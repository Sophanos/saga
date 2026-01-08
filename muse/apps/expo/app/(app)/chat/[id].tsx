import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useLayoutStore } from '@/design-system/layout';
import { useAIStore } from '@/stores/ai';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { setAIPanelMode } = useLayoutStore();
  const { selectThread, createThread } = useAIStore();

  useEffect(() => {
    // Set full mode and select/create thread
    setAIPanelMode('full');

    if (id === 'new') {
      createThread();
    } else if (id) {
      selectThread(id);
    }

    // Cleanup: return to side mode when leaving
    return () => {
      setAIPanelMode('side');
    };
  }, [id, setAIPanelMode, selectThread, createThread]);

  // The actual UI is rendered by AppShell when aiPanelMode === 'full'
  return null;
}
