import { FolderOpen, Plus, RefreshCw, AlertCircle, BookOpen, Clock, Tag } from "lucide-react";
import { Button, ScrollArea, Card } from "@mythos/ui";
import { formatRelativeTime } from "@mythos/core";

interface ProjectSelectorScreenProps {
  projects: Array<{
    id: string;
    name: string;
    description: string | null;
    genre: string | null;
    updated_at: string;
  }>;
  isLoading: boolean;
  error: string | null;
  onSelect: (projectId: string) => void;
  onCreate: () => void;
  onRetry: () => void;
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-mythos-text-muted">
      <RefreshCw className="w-8 h-8 animate-spin text-mythos-accent-cyan" />
      <div className="mt-4 font-mono text-sm">
        <span className="text-mythos-accent-cyan">[</span>
        <span className="animate-pulse">LOADING</span>
        <span className="text-mythos-accent-cyan">]</span>
      </div>
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <AlertCircle className="w-12 h-12 text-mythos-accent-red mb-4" />
      <p className="text-mythos-text-secondary text-sm mb-4">{error}</p>
      <Button variant="outline" onClick={onRetry} className="gap-2 font-mono">
        <RefreshCw className="w-4 h-4" />
        Retry
      </Button>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <p className="text-mythos-text-secondary text-sm mb-6">No projects yet.</p>
      <Button onClick={onCreate} className="gap-2 font-mono">
        <Plus className="w-4 h-4" />
        Create First Project
      </Button>
    </div>
  );
}

function ProjectCard({ project, onSelect }: { project: ProjectSelectorScreenProps["projects"][0]; onSelect: (id: string) => void }) {
  return (
    <Card
      className="group cursor-pointer transition-all border-mythos-text-muted/20 hover:border-mythos-accent-cyan/50 bg-mythos-bg-secondary"
      onClick={() => onSelect(project.id)}
    >
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <FolderOpen className="w-5 h-5 text-mythos-accent-cyan" />
          <h3 className="font-semibold text-mythos-text-primary group-hover:text-mythos-accent-cyan">
            {project.name}
          </h3>
        </div>
        {project.description && (
          <p className="text-sm text-mythos-text-secondary mb-3 line-clamp-2">{project.description}</p>
        )}
        <div className="flex items-center gap-4 text-xs text-mythos-text-muted">
          {project.genre && (
            <div className="flex items-center gap-1">
              <Tag className="w-3 h-3" />
              <span className="uppercase">{project.genre}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{formatRelativeTime(project.updated_at)}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function ProjectSelectorScreen({
  projects,
  isLoading,
  error,
  onSelect,
  onCreate,
  onRetry,
}: ProjectSelectorScreenProps) {
  return (
    <div className="h-full flex flex-col bg-mythos-bg-primary">
      <header className="border-b border-mythos-text-muted/20 bg-mythos-bg-secondary px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="w-6 h-6 text-mythos-accent-cyan" />
            <div>
              <h1 className="font-semibold text-lg text-mythos-text-primary">Mythos IDE</h1>
              <p className="text-xs text-mythos-text-muted font-mono">Select a project</p>
            </div>
          </div>
          <Button onClick={onCreate} className="gap-2 font-mono" disabled={isLoading}>
            <Plus className="w-4 h-4" />
            New Project
          </Button>
        </div>
      </header>

      <ScrollArea className="flex-1">
        <div className="max-w-4xl mx-auto px-6 py-6">
          {isLoading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState error={error} onRetry={onRetry} />
          ) : projects.length === 0 ? (
            <EmptyState onCreate={onCreate} />
          ) : (
            <>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs font-semibold text-mythos-text-muted uppercase">Your Projects</span>
                <span className="text-xs text-mythos-text-muted font-mono">[{projects.length}]</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {projects.map((project) => (
                  <ProjectCard key={project.id} project={project} onSelect={onSelect} />
                ))}
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
