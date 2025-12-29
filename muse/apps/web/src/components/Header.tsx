import { useState } from "react";
import { BookOpen, Settings, Sparkles, Play, FileDown } from "lucide-react";
import { Button } from "@mythos/ui";
import { ModeToggle } from "./ModeToggle";
import { ApiKeySettings } from "./settings/ApiKeySettings";
import { ExportModal } from "./modals/ExportModal";
import { useApiKey } from "../hooks/useApiKey";
import { useCurrentProject } from "../stores";

export function Header() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const { hasKey } = useApiKey();
  const project = useCurrentProject();

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
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
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
          onClick={() => setIsExportOpen(true)}
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
          onClick={() => setIsSettingsOpen(true)}
          className="relative"
          title="Settings"
        >
          <Settings className="w-4 h-4" />
          {!hasKey && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-mythos-accent-yellow rounded-full" />
          )}
        </Button>
      </div>

      {/* Settings Modal */}
      <ApiKeySettings
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Export Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
      />
    </header>
  );
}
