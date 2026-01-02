import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, FolderPlus, Settings, Users } from "lucide-react";
import { Button, ScrollArea, cn } from "@mythos/ui";
import { useProjects } from "../../hooks/useProjects";
import { useCurrentProject, useMythosStore } from "../../stores";
import { useNavigationStore } from "../../stores/navigation";
import { useProjectSelectionStore } from "../../stores/projectSelection";

function getProjectInitial(name?: string | null): string {
  if (!name) return "?";
  return name.trim().charAt(0).toUpperCase();
}

export function ProjectPickerSidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const currentProject = useCurrentProject();
  const { projects, isLoading, error, reload } = useProjects();
  const openModal = useMythosStore((s) => s.openModal);
  const requestNewProject = useNavigationStore((s) => s.requestNewProject);
  const setSelectedProjectId = useProjectSelectionStore((s) => s.setSelectedProjectId);

  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }, [projects]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="h-full bg-mythos-bg-secondary border-r border-mythos-border-default p-3">
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-haspopup="true"
          aria-expanded={isOpen}
          className="w-full flex items-center justify-between rounded-lg border border-mythos-border-default bg-mythos-bg-secondary px-3 py-2 text-left hover:bg-mythos-bg-hover transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-mythos-bg-tertiary flex items-center justify-center text-xs font-semibold text-mythos-text-primary">
              {getProjectInitial(currentProject?.name)}
            </div>
            <div>
              <div className="text-sm font-medium text-mythos-text-primary">
                {currentProject?.name ?? "No project yet"}
              </div>
              <div className="text-[11px] text-mythos-text-muted">
                {currentProject ? "Workspace" : "Select a project"}
              </div>
            </div>
          </div>
          <ChevronDown className={cn("w-4 h-4 text-mythos-text-muted transition-transform", isOpen && "rotate-180")} />
        </button>

        {isOpen && (
          <div className="absolute left-0 right-0 mt-2 rounded-xl border border-mythos-border-default bg-mythos-bg-secondary shadow-xl overflow-hidden z-50">
            <div className="p-3 border-b border-mythos-border-default">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-mythos-bg-tertiary flex items-center justify-center text-sm font-semibold text-mythos-text-primary">
                  {getProjectInitial(currentProject?.name)}
                </div>
                <div>
                  <div className="text-sm font-semibold text-mythos-text-primary">
                    {currentProject?.name ?? "No project selected"}
                  </div>
                  <div className="text-[11px] text-mythos-text-muted">
                    {currentProject ? "Free Plan - 1 member" : "Choose a workspace"}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-2"
                  onClick={() => {
                    openModal({ type: "settings" });
                    setIsOpen(false);
                  }}
                >
                  <Settings className="w-3.5 h-3.5" />
                  Settings
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-2"
                  disabled={!currentProject}
                  onClick={() => {
                    openModal({ type: "inviteMember" });
                    setIsOpen(false);
                  }}
                >
                  <Users className="w-3.5 h-3.5" />
                  Invite
                </Button>
              </div>
            </div>

            <div className="py-2">
              <div className="px-3 pb-2 text-[11px] uppercase tracking-wide text-mythos-text-muted">
                Projects
              </div>
              <ScrollArea className="max-h-64">
                {isLoading && (
                  <div className="px-3 py-2 text-xs text-mythos-text-muted">
                    Loading projects...
                  </div>
                )}
                {error && (
                  <button
                    type="button"
                    onClick={() => reload()}
                    className="w-full px-3 py-2 text-left text-xs text-mythos-accent-red hover:bg-mythos-bg-hover"
                  >
                    Failed to load. Tap to retry.
                  </button>
                )}
                {!isLoading && !error && sortedProjects.length === 0 && (
                  <div className="px-3 py-2 text-xs text-mythos-text-muted">
                    No projects yet.
                  </div>
                )}
                {!isLoading && !error && sortedProjects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => {
                      setSelectedProjectId(project.id);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "w-full px-3 py-2 flex items-center gap-2 text-left text-sm hover:bg-mythos-bg-hover",
                      project.id === currentProject?.id && "text-mythos-text-primary"
                    )}
                  >
                    <div className="h-6 w-6 rounded-md bg-mythos-bg-tertiary flex items-center justify-center text-xs font-semibold text-mythos-text-primary">
                      {getProjectInitial(project.name)}
                    </div>
                    <span className="flex-1 text-mythos-text-secondary">{project.name}</span>
                    {project.id === currentProject?.id && (
                      <Check className="w-4 h-4 text-mythos-accent-primary" />
                    )}
                  </button>
                ))}
              </ScrollArea>
            </div>

            <div className="border-t border-mythos-border-default">
              <button
                type="button"
                onClick={() => {
                  requestNewProject();
                  setIsOpen(false);
                }}
                className="w-full px-3 py-2 flex items-center gap-2 text-left text-sm text-mythos-accent-primary hover:bg-mythos-bg-hover"
              >
                <FolderPlus className="w-4 h-4" />
                New Project
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 text-xs text-mythos-text-muted">
        Create a project to unlock documents and world entities.
      </div>
    </div>
  );
}
