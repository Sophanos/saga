import { BookOpen, Settings, Sparkles, Play, FileDown, FileUp, Clock } from "lucide-react";
import { Button } from "@mythos/ui";
import { ModeToggle } from "./ModeToggle";
import { OfflineIndicator } from "./OfflineIndicator";
import { CollaboratorsBar } from "./collaboration/CollaboratorsBar";
import { useApiKey } from "../hooks/useApiKey";
import { useCurrentProject, useMythosStore } from "../stores";
import { useActiveTotalWritingTime, useIsGardenerMode } from "@mythos/state";

/**
 * Format writing time in a human-readable format
 */
function formatWritingTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return "<1m";
}

export function Header() {
  const { hasKey } = useApiKey();
  const project = useCurrentProject();
  const openModal = useMythosStore((s) => s.openModal);
  
  // Progressive writing time (gardener mode only)
  const writingTimeSec = useActiveTotalWritingTime();
  const isGardener = useIsGardenerMode();

  return (
    <header className="h-12 border-b border-mythos-text-muted/20 bg-mythos-bg-secondary flex items-center justify-between px-4">
      {/* Logo & Project Name */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-mythos-accent-cyan" />
          <span className="font-semibold text-mythos-text-primary">
            Mythos IDE
          </span>
        </div>
        <span className="text-mythos-text-muted">|</span>
        <span className="text-sm text-mythos-text-secondary">
          {project?.name ?? "Untitled Project"}
        </span>
        
        {/* Writing time indicator (gardener mode only) */}
        {isGardener && writingTimeSec > 60 && (
          <>
            <span className="text-mythos-text-muted">|</span>
            <div
              className="flex items-center gap-1.5 text-xs text-mythos-text-muted"
              title="Total writing time for this project"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{formatWritingTime(writingTimeSec)}</span>
            </div>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Collaboration & Status */}
        <CollaboratorsBar />
        <OfflineIndicator />
        <div className="w-px h-6 bg-mythos-text-muted/20 mx-1" />
        
        {/* Tools */}
        <Button variant="ghost" size="sm" className="gap-2">
          <Sparkles className="w-4 h-4" />
          <span className="hidden sm:inline">Genesis</span>
        </Button>
        <Button variant="ghost" size="sm" className="gap-2">
          <Play className="w-4 h-4" />
          <span className="hidden sm:inline">Run Linter</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
          onClick={() => openModal({ type: "import" })}
        >
          <FileUp className="w-4 h-4" />
          <span className="hidden sm:inline">Import</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
          onClick={() => openModal({ type: "export" })}
        >
          <FileDown className="w-4 h-4" />
          <span className="hidden sm:inline">Export</span>
        </Button>
        <div className="w-px h-6 bg-mythos-text-muted/20 mx-1" />
        <ModeToggle />
        <div className="w-px h-6 bg-mythos-text-muted/20 mx-1" />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => openModal({ type: "settings" })}
          className="relative"
          title="Settings"
        >
          <Settings className="w-4 h-4" />
          {!hasKey && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-mythos-accent-yellow rounded-full" />
          )}
        </Button>
      </div>
    </header>
  );
}
