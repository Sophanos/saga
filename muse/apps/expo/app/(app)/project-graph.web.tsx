import { useEffect } from 'react';
import { useProjectStore } from '@mythos/state';
import { ProjectGraphView } from '@/components/project-graph/ProjectGraphView';

const LAST_PROJECT_KEY = 'mythos:lastProjectId';

export default function ProjectGraphScreen(): JSX.Element {
  const currentProjectId = useProjectStore((state) => state.currentProjectId);
  const setCurrentProjectId = useProjectStore((state) => state.setCurrentProjectId);

  useEffect(() => {
    if (currentProjectId) return;
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(LAST_PROJECT_KEY);
    if (stored) {
      setCurrentProjectId(stored);
    }
  }, [currentProjectId, setCurrentProjectId]);

  return <ProjectGraphView />;
}
