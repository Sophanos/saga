import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import {
  Check,
  ChevronDown,
  ChevronRight,
  CreditCard,
  FilePlus,
  FolderPlus,
  Plus,
  Settings,
  Users,
} from "lucide-react";
import { Button, ScrollArea, cn } from "@mythos/ui";
import { useProjects } from "../../hooks/useProjects";
import {
  useCurrentProject,
  useEntities,
  useMythosStore,
  useRecentDocuments,
  useRecentEntities,
} from "../../stores";
import { useNavigationStore } from "../../stores/navigation";
import { useProjectSelectionStore } from "../../stores/projectSelection";
import { getEntityTypeButtons } from "../../utils/entityConfig";
import { type Document, type EntityType } from "@mythos/core";

const EMPTY_TIPTAP_DOC = { type: "doc", content: [{ type: "paragraph" }] };

function getProjectInitial(name?: string | null): string {
  if (!name) return "?";
  return name.trim().charAt(0).toUpperCase();
}

export function ProjectPickerSidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
  const [isCreatingChapter, setIsCreatingChapter] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({});
  const dropdownRef = useRef<HTMLDivElement>(null);
  const createMenuRef = useRef<HTMLDivElement>(null);
  const currentProject = useCurrentProject();
  const { projects, isLoading, error } = useProjects();
  const openModal = useMythosStore((s) => s.openModal);
  const requestNewProject = useNavigationStore((s) => s.requestNewProject);
  const setSelectedProjectId = useProjectSelectionStore((s) => s.setSelectedProjectId);
  const documents = useMythosStore((s) => s.document.documents);
  const addDocument = useMythosStore((s) => s.addDocument);
  const setCurrentDocument = useMythosStore((s) => s.setCurrentDocument);
  const setCanvasView = useMythosStore((s) => s.setCanvasView);
  const currentDocument = useMythosStore((s) => s.document.currentDocument);
  const setSelectedEntity = useMythosStore((s) => s.setSelectedEntity);
  const selectedEntityId = useMythosStore((s) => s.world.selectedEntityId);
  const showHud = useMythosStore((s) => s.showHud);
  const recentDocuments = useRecentDocuments();
  const recentEntities = useRecentEntities();
  const entities = useEntities();
  const createDocumentMutation = useMutation(api.documents.create);

  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => b.updatedAt - a.updatedAt);
  }, [projects]);

  const chapterSections = useMemo(() => {
    const chapters = documents
      .filter((doc) => doc.type === "chapter")
      .sort((a, b) => a.orderIndex - b.orderIndex);
    const scenes = documents
      .filter((doc) => doc.type === "scene")
      .sort((a, b) => a.orderIndex - b.orderIndex);
    const scenesByChapter = new Map<string, typeof scenes>();
    const orphanScenes: typeof scenes = [];

    scenes.forEach((scene) => {
      if (!scene.parentId) {
        orphanScenes.push(scene);
        return;
      }
      const list = scenesByChapter.get(scene.parentId) ?? [];
      list.push(scene);
      scenesByChapter.set(scene.parentId, list);
    });

    return { chapters, scenesByChapter, orphanScenes };
  }, [documents]);

  const entitySections = useMemo(() => {
    const characters = entities
      .filter((entity) => entity.type === "character")
      .sort((a, b) => a.name.localeCompare(b.name));
    const world = entities
      .filter((entity) => entity.type !== "character")
      .sort((a, b) => a.name.localeCompare(b.name));
    return { characters, world };
  }, [entities]);

  const handleSelectDocument = (documentId: string) => {
    const doc = documents.find((d) => d.id === documentId);
    if (!doc) return;
    setCurrentDocument(doc);
    setCanvasView("editor");
  };

  const handleSelectEntity = (entityId: string) => {
    const entity = entities.find((e) => e.id === entityId);
    if (!entity) return;
    setSelectedEntity(entity.id);
    showHud(entity, { x: 280, y: 200 });
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
      if (createMenuRef.current && !createMenuRef.current.contains(event.target as Node)) {
        setIsCreateMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!currentDocument) return;
    const targetChapterId =
      currentDocument.type === "chapter"
        ? currentDocument.id
        : currentDocument.type === "scene"
          ? currentDocument.parentId
          : undefined;
    if (!targetChapterId) return;
    setExpandedChapters((prev) =>
      prev[targetChapterId] ? prev : { ...prev, [targetChapterId]: true }
    );
  }, [currentDocument]);

  const toggleChapter = (chapterId: string) => {
    setExpandedChapters((prev) => ({
      ...prev,
      [chapterId]: !prev[chapterId],
    }));
  };

  const handleCreateChapter = async () => {
    if (!currentProject || isCreatingChapter) return;
    setIsCreatingChapter(true);
    setCreateError(null);

    try {
      const nextOrderIndex =
        documents.length > 0
          ? Math.max(...documents.map((doc) => doc.orderIndex)) + 1
          : 0;
      const nextChapterNumber =
        documents.filter((doc) => doc.type === "chapter").length + 1;
      const title = `Chapter ${nextChapterNumber}`;

      const createdId = await createDocumentMutation({
        projectId: currentProject.id as Id<"projects">,
        type: "chapter",
        title,
        content: EMPTY_TIPTAP_DOC,
        contentText: "",
        orderIndex: nextOrderIndex,
      });

      const now = new Date();
      const createdDocument: Document = {
        id: createdId,
        projectId: currentProject.id,
        parentId: undefined,
        type: "chapter",
        title,
        content: EMPTY_TIPTAP_DOC,
        orderIndex: nextOrderIndex,
        wordCount: 0,
        createdAt: now,
        updatedAt: now,
      };

      addDocument(createdDocument);
      setCurrentDocument(createdDocument);
      setCanvasView("editor");
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create chapter");
    } finally {
      setIsCreatingChapter(false);
    }
  };

  const handleCreateEntity = (entityType: EntityType) => {
    openModal({ type: "entityForm", mode: "create", entityType });
    setIsCreateMenuOpen(false);
  };

  return (
    <div className="h-full bg-mythos-bg-secondary border-r border-mythos-border-default p-3 flex flex-col">
      <div className="flex items-center gap-2">
        <div className="relative flex-1" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => {
              setIsOpen((prev) => !prev);
              setIsCreateMenuOpen(false);
            }}
            aria-haspopup="true"
            aria-expanded={isOpen}
            className="w-full flex items-center justify-between rounded-lg border border-mythos-border-default bg-mythos-bg-secondary px-3 py-2 text-left hover:bg-mythos-bg-hover transition-colors"
            data-testid="project-picker-toggle"
          >
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-md bg-mythos-bg-tertiary flex items-center justify-center text-xs font-semibold text-mythos-text-primary">
                {getProjectInitial(currentProject?.name)}
              </div>
              <div>
                <div className="text-sm font-medium text-mythos-text-primary">
                  {currentProject?.name ?? "No project yet"}
                </div>
              </div>
            </div>
            <ChevronDown className={cn("w-4 h-4 text-mythos-text-muted transition-transform", isOpen && "rotate-180")} />
          </button>

          {isOpen && (
            <div className="absolute left-0 mt-2 w-72 rounded-xl border border-mythos-border-default bg-mythos-bg-secondary shadow-xl overflow-hidden z-50">
              <div className="px-3 py-2 border-b border-mythos-border-default">
                <div className="flex items-center justify-between gap-2">
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
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        openModal({ type: "billing" });
                        setIsOpen(false);
                      }}
                      title="Billing"
                      data-testid="project-billing-button"
                    >
                      <CreditCard className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        openModal({ type: "settings" });
                        setIsOpen(false);
                      }}
                      title="Settings"
                      data-testid="project-settings-button"
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={!currentProject}
                      onClick={() => {
                        openModal({ type: "inviteMember" });
                        setIsOpen(false);
                      }}
                      title="Invite"
                    >
                      <Users className="w-4 h-4" />
                    </Button>
                  </div>
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
                    <div className="px-3 py-2 text-xs text-mythos-accent-red">
                      Failed to load projects.
                    </div>
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

        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 hover:ring-1 hover:ring-mythos-border-default"
          onClick={handleCreateChapter}
          disabled={!currentProject || isCreatingChapter}
          title="New Chapter"
        >
          <FilePlus className="w-4 h-4" />
        </Button>

        <div className="relative" ref={createMenuRef}>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => {
              setIsCreateMenuOpen((prev) => !prev);
              setIsOpen(false);
            }}
            title="Create"
          >
            <ChevronDown className={cn("w-4 h-4 transition-transform", isCreateMenuOpen && "rotate-180")} />
          </Button>

          {isCreateMenuOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-mythos-border-default bg-mythos-bg-secondary shadow-xl overflow-hidden z-50">
              <div className="px-3 py-2 text-[11px] uppercase tracking-wide text-mythos-text-muted">
                Create
              </div>
              <div className="pb-2">
                {getEntityTypeButtons().map((config) => {
                  const Icon = config.icon;
                  return (
                  <button
                      key={config.type}
                      type="button"
                      onClick={() => handleCreateEntity(config.type)}
                      className="w-full px-3 py-2 flex items-center gap-2 text-left text-sm text-mythos-text-secondary hover:bg-mythos-bg-hover"
                    >
                      <Icon className="w-4 h-4" />
                      <span>{config.label}</span>
                      {config.type === "character" && (
                        <span className="ml-auto text-[11px] font-mono text-mythos-text-muted">
                          ⌘C
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      {createError && (
        <div className="mt-2 text-xs text-mythos-accent-red">{createError}</div>
      )}
      <ScrollArea className="mt-4 flex-1 pr-1">
        <div className="space-y-5">
          <div>
            <div className="px-1 pb-2 text-[11px] uppercase tracking-wide text-mythos-text-muted">
              Recents
            </div>
            <div className="space-y-1">
              {recentDocuments.length === 0 && recentEntities.length === 0 && (
                <div className="px-2 py-1 text-xs text-mythos-text-muted">
                  No recent items yet.
                </div>
              )}
              {recentDocuments.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => handleSelectDocument(doc.id)}
                  className={cn(
                    "w-full px-2 py-1.5 rounded-md flex items-center gap-2 text-left text-sm hover:bg-mythos-bg-hover",
                    doc.id === currentDocument?.id && "bg-mythos-bg-hover text-mythos-text-primary"
                  )}
                >
                  <div className="h-6 w-6 rounded-md bg-mythos-bg-tertiary flex items-center justify-center text-[11px] font-semibold text-mythos-text-primary">
                    {getProjectInitial(doc.title)}
                  </div>
                  <span className="flex-1 text-mythos-text-secondary">
                    {doc.title || "Untitled"}
                  </span>
                </button>
              ))}
              {recentEntities.map((entity) => (
                <button
                  key={entity.id}
                  type="button"
                  onClick={() => handleSelectEntity(entity.id)}
                  className={cn(
                    "w-full px-2 py-1.5 rounded-md flex items-center gap-2 text-left text-sm hover:bg-mythos-bg-hover",
                    entity.id === selectedEntityId && "bg-mythos-bg-hover text-mythos-text-primary"
                  )}
                >
                  <div className="h-6 w-6 rounded-md bg-mythos-bg-tertiary flex items-center justify-center text-[11px] font-semibold text-mythos-text-primary">
                    {getProjectInitial(entity.name)}
                  </div>
                  <span className="flex-1 text-mythos-text-secondary">
                    {entity.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="px-1 pb-2 text-[11px] uppercase tracking-wide text-mythos-text-muted">
              Chapters
            </div>
            <div className="space-y-2">
              {chapterSections.chapters.length === 0 && (
                <div className="px-2 py-1 text-xs text-mythos-text-muted">
                  No chapters yet.
                </div>
              )}
              {chapterSections.chapters.map((chapter) => {
                const scenes = chapterSections.scenesByChapter.get(chapter.id) ?? [];
                const isExpanded = !!expandedChapters[chapter.id];
                return (
                  <div key={chapter.id} className="space-y-1">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => toggleChapter(chapter.id)}
                        className="h-6 w-6 flex items-center justify-center rounded-md text-mythos-text-muted hover:bg-mythos-bg-hover"
                        aria-label={isExpanded ? "Collapse chapter" : "Expand chapter"}
                      >
                        <ChevronRight
                          className={cn(
                            "w-4 h-4 transition-transform",
                            isExpanded && "rotate-90"
                          )}
                        />
                      </button>
                      <button
                        key={chapter.id}
                        type="button"
                        onClick={() => handleSelectDocument(chapter.id)}
                        className={cn(
                          "flex-1 px-2 py-1.5 rounded-md flex items-center gap-2 text-left text-sm hover:bg-mythos-bg-hover",
                          chapter.id === currentDocument?.id &&
                            "bg-mythos-bg-hover text-mythos-text-primary"
                        )}
                      >
                        <div className="h-6 w-6 rounded-md bg-mythos-bg-tertiary flex items-center justify-center text-[11px] font-semibold text-mythos-text-primary">
                          {getProjectInitial(chapter.title)}
                        </div>
                        <span className="flex-1 text-mythos-text-secondary">
                          {chapter.title || "Untitled"}
                        </span>
                      </button>
                    </div>
                    {isExpanded && (
                      <div className="ml-7 space-y-1 border-l border-mythos-border-default/60 pl-3">
                        <div className="px-2 pt-1 text-[10px] uppercase tracking-wide text-mythos-text-muted">
                          Scenes
                        </div>
                        {scenes.length === 0 && (
                          <div className="px-2 py-1 text-xs text-mythos-text-muted">
                            No scenes yet.
                          </div>
                        )}
                        {scenes.map((scene) => (
                          <button
                            key={scene.id}
                            type="button"
                            onClick={() => handleSelectDocument(scene.id)}
                            className={cn(
                              "w-full px-2 py-1.5 rounded-md flex items-center gap-2 text-left text-sm hover:bg-mythos-bg-hover",
                              scene.id === currentDocument?.id &&
                                "bg-mythos-bg-hover text-mythos-text-primary"
                            )}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-mythos-text-muted/70" />
                            <div className="h-5 w-5 rounded-md bg-mythos-bg-tertiary flex items-center justify-center text-[10px] font-semibold text-mythos-text-primary">
                              {getProjectInitial(scene.title)}
                            </div>
                            <span className="flex-1 text-mythos-text-secondary">
                              {scene.title || "Untitled"}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {chapterSections.orphanScenes.length > 0 && (
                <div className="pt-2">
                  <div className="px-2 text-[10px] uppercase tracking-wide text-mythos-text-muted">
                    Unassigned Scenes
                  </div>
                  <div className="mt-1 space-y-1">
                    {chapterSections.orphanScenes.map((scene) => (
                      <button
                        key={scene.id}
                        type="button"
                        onClick={() => handleSelectDocument(scene.id)}
                        className={cn(
                          "w-full px-2 py-1.5 rounded-md flex items-center gap-2 text-left text-sm hover:bg-mythos-bg-hover",
                          scene.id === currentDocument?.id &&
                            "bg-mythos-bg-hover text-mythos-text-primary"
                        )}
                      >
                        <div className="h-5 w-5 rounded-md bg-mythos-bg-tertiary flex items-center justify-center text-[10px] font-semibold text-mythos-text-primary">
                          {getProjectInitial(scene.title)}
                        </div>
                        <span className="flex-1 text-mythos-text-secondary">
                          {scene.title || "Untitled"}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="px-1 pb-2 flex items-center justify-between text-[11px] uppercase tracking-wide text-mythos-text-muted">
              <span>Characters</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={() => handleCreateEntity("character")}
                title="New character"
              >
                <Plus className="w-3 h-3" />
              </Button>
            </div>
            <div className="space-y-1">
              {entitySections.characters.length === 0 && (
                <div className="px-2 py-1 text-xs text-mythos-text-muted">
                  No characters yet.
                </div>
              )}
              {entitySections.characters.map((entity) => (
                <button
                  key={entity.id}
                  type="button"
                  onClick={() => handleSelectEntity(entity.id)}
                  className={cn(
                    "w-full px-2 py-1.5 rounded-md flex items-center gap-2 text-left text-sm hover:bg-mythos-bg-hover",
                    entity.id === selectedEntityId && "bg-mythos-bg-hover text-mythos-text-primary"
                  )}
                >
                  <div className="h-6 w-6 rounded-md bg-mythos-bg-tertiary flex items-center justify-center text-[11px] font-semibold text-mythos-text-primary">
                    {getProjectInitial(entity.name)}
                  </div>
                  <span className="flex-1 text-mythos-text-secondary">
                    {entity.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="px-1 pb-2 flex items-center justify-between text-[11px] uppercase tracking-wide text-mythos-text-muted">
              <span>World</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={() => handleCreateEntity("location")}
                title="New world item"
              >
                <Plus className="w-3 h-3" />
              </Button>
            </div>
            <div className="space-y-1">
              {entitySections.world.length === 0 && (
                <div className="px-2 py-1 text-xs text-mythos-text-muted">
                  No world entities yet.
                </div>
              )}
              {entitySections.world.map((entity) => (
                <button
                  key={entity.id}
                  type="button"
                  onClick={() => handleSelectEntity(entity.id)}
                  className={cn(
                    "w-full px-2 py-1.5 rounded-md flex items-center gap-2 text-left text-sm hover:bg-mythos-bg-hover",
                    entity.id === selectedEntityId && "bg-mythos-bg-hover text-mythos-text-primary"
                  )}
                >
                  <div className="h-6 w-6 rounded-md bg-mythos-bg-tertiary flex items-center justify-center text-[11px] font-semibold text-mythos-text-primary">
                    {getProjectInitial(entity.name)}
                  </div>
                  <span className="flex-1 text-mythos-text-secondary">
                    {entity.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
