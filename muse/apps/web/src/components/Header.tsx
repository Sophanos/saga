import { useState, useRef, useEffect } from "react";
import { BookOpen, Settings, Sparkles, Play, FileDown, FileUp, Clock, ChevronDown, FolderPlus, FolderOpen } from "lucide-react";
import { Button } from "@mythos/ui";
import { ModeToggle } from "./ModeToggle";
import { OfflineIndicator } from "./OfflineIndicator";
import { CollaboratorsBar } from "./collaboration/CollaboratorsBar";
import { InviteMemberModal } from "./collaboration/InviteMemberModal";
import { useApiKey } from "../hooks/useApiKey";
import { useCurrentProject, useMythosStore } from "../stores";
import { useNavigationStore } from "../stores/navigation";
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
  const requestNewProject = useNavigationStore((s) => s.requestNewProject);
  const requestProjectSelector = useNavigationStore((s) => s.requestProjectSelector);

  // Dropdown state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Progressive writing time (gardener mode only)
  const writingTimeSec = useActiveTotalWritingTime();
  const isGardener = useIsGardenerMode();

  return (
    <>
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

        {/* Project dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            aria-haspopup="true"
            aria-expanded={isDropdownOpen}
            className="flex items-center gap-1.5 text-sm text-mythos-text-secondary hover:text-mythos-text-primary transition-colors group"
          >
            <span>{project?.name ?? "Untitled Project"}</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} />
          </button>

          {isDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-48 bg-mythos-bg-secondary border border-mythos-text-muted/20 rounded-lg shadow-xl z-50 py-1">
              <button
                onClick={() => {
                  requestNewProject();
                  setIsDropdownOpen(false);
                }}
                className="w-full px-3 py-2 flex items-center gap-2 text-sm text-mythos-text-secondary hover:bg-mythos-accent-cyan/10 hover:text-mythos-text-primary transition-colors"
              >
                <FolderPlus className="w-4 h-4" />
                New Project
                <span className="ml-auto text-[10px] text-mythos-text-muted">⌘N</span>
              </button>
              <button
                onClick={() => {
                  requestProjectSelector();
                  setIsDropdownOpen(false);
                }}
                className="w-full px-3 py-2 flex items-center gap-2 text-sm text-mythos-text-secondary hover:bg-mythos-accent-cyan/10 hover:text-mythos-text-primary transition-colors"
              >
                <FolderOpen className="w-4 h-4" />
                Switch Project
              </button>
            </div>
          )}
        </div>
        
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
        <CollaboratorsBar onInviteClick={() => setIsInviteModalOpen(true)} />
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

      <InviteMemberModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        onInvited={() => {
          // Optionally refresh activity/members later
        }}
      />
    </>
  );
}
