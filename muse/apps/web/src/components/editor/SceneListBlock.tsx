import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";
import { FileText, Plus, Trash2, X } from "lucide-react";
import { cn } from "@mythos/ui";
import type { Document } from "@mythos/core";
import { useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { useCurrentProject, useMythosStore } from "../../stores";
import { BlockHeader } from "./BlockHeader";

type SceneListMode = "latest" | "list";
type SceneListSortBy = "createdAt" | "updatedAt" | "orderIndex";
type SceneListSortDir = "asc" | "desc";

function coerceMode(value?: string): SceneListMode {
  return value === "latest" ? "latest" : "list";
}

function coerceSortBy(value?: string): SceneListSortBy {
  if (value === "createdAt" || value === "updatedAt") {
    return value;
  }
  if (value === "orderIndex") {
    return value;
  }
  return "orderIndex";
}

function coerceSortDir(value?: string): SceneListSortDir {
  return value === "desc" ? "desc" : "asc";
}

export function SceneListBlock({
  node,
  updateAttributes,
  deleteNode,
}: NodeViewProps) {
  const chapterId = node.attrs["chapterId"] ?? null;
  const currentProject = useCurrentProject();
  const mode = coerceMode(node.attrs["mode"]);
  const sortBy = coerceSortBy(node.attrs["sortBy"]);
  const sortDir = coerceSortDir(node.attrs["sortDir"]);
  const documents = useMythosStore((state) => state.document.documents);
  const currentDocument = useMythosStore((state) => state.document.currentDocument);
  const setCurrentDocument = useMythosStore((state) => state.setCurrentDocument);
  const setCanvasView = useMythosStore((state) => state.setCanvasView);
  const addDocument = useMythosStore((state) => state.addDocument);
  const setDocuments = useMythosStore((state) => state.setDocuments);

  // Convex mutations
  const createDocumentMutation = useMutation(api.documents.create);
  const deleteDocumentMutation = useMutation(api.documents.remove);

  const resolvedChapterId =
    chapterId ??
    (currentDocument?.type === "chapter"
      ? currentDocument.id
      : currentDocument?.type === "scene"
        ? currentDocument.parentId ?? null
        : null);

  const chapterDocument = resolvedChapterId
    ? documents.find((doc) => doc.id === resolvedChapterId)
    : null;

  const scenes = documents
    .filter(
      (doc) =>
        doc.type === "scene" && doc.parentId === resolvedChapterId
    )
    .sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      const getSortValue = (scene: (typeof documents)[number]) => {
        if (sortBy === "orderIndex") return scene.orderIndex ?? 0;
        if (sortBy === "updatedAt") return new Date(scene.updatedAt).getTime();
        return new Date(scene.createdAt).getTime();
      };
      return (getSortValue(a) - getSortValue(b)) * dir;
    });

  const visibleScenes = mode === "latest" ? scenes.slice(0, 1) : scenes;
  const sortByLabel =
    sortBy === "orderIndex"
      ? "Manual"
      : sortBy === "updatedAt"
        ? "Updated"
        : "Created";

  const handleOpenScene = (sceneId: string) => {
    const scene = documents.find((doc) => doc.id === sceneId);
    if (!scene) return;
    setCurrentDocument(scene);
    setCanvasView("editor");
  };

  const handleOpenChapter = () => {
    if (!chapterDocument) return;
    setCurrentDocument(chapterDocument);
    setCanvasView("editor");
  };

  const handleCreateScene = async () => {
    if (!currentProject) return;
    const parentId = resolvedChapterId;
    if (!parentId) return;

    const siblingScenes = documents.filter(
      (doc) => doc.type === "scene" && doc.parentId === parentId
    );
    const nextOrderIndex =
      siblingScenes.length > 0
        ? Math.max(...siblingScenes.map((doc) => doc.orderIndex)) + 1
        : 0;
    const nextSceneNumber = siblingScenes.length + 1;
    const title = `Scene ${nextSceneNumber}`;
    const emptyContent = { type: "doc", content: [{ type: "paragraph" }] };

    try {
      const createdId = await createDocumentMutation({
        projectId: currentProject.id as Id<"projects">,
        parentId: parentId as Id<"documents">,
        type: "scene",
        title,
        content: emptyContent as Record<string, unknown>,
        contentText: "",
        orderIndex: nextOrderIndex,
        wordCount: 0,
      });

      const newDocument: Document = {
        id: createdId,
        projectId: currentProject.id,
        parentId,
        type: "scene",
        title,
        content: emptyContent,
        contentText: "",
        orderIndex: nextOrderIndex,
        wordCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      addDocument(newDocument);
      setCurrentDocument(newDocument);
      setCanvasView("editor");
    } catch (err) {
      console.warn("Failed to create scene:", err);
    }
  };

  const handleDeleteScene = async (sceneId: string) => {
    try {
      await deleteDocumentMutation({ id: sceneId as Id<"documents"> });
      const { document } = useMythosStore.getState();
      const nextDocuments = document.documents.filter((doc) => doc.id !== sceneId);
      setDocuments(nextDocuments);
      if (document.currentDocument?.id === sceneId) {
        setCurrentDocument(chapterDocument ?? null);
      }
    } catch (err) {
      console.warn("Failed to delete scene:", err);
    }
  };

  const handleDeleteChapter = async () => {
    if (!chapterDocument) return;
    try {
      await deleteDocumentMutation({ id: chapterDocument.id as Id<"documents"> });
      const { document } = useMythosStore.getState();
      const nextDocuments = document.documents.filter(
        (doc) => doc.id !== chapterDocument.id && doc.parentId !== chapterDocument.id
      );
      setDocuments(nextDocuments);
      if (
        document.currentDocument?.id === chapterDocument.id ||
        document.currentDocument?.parentId === chapterDocument.id
      ) {
        setCurrentDocument(null);
      }
    } catch (err) {
      console.warn("Failed to delete chapter:", err);
    }
  };

  const handleToggleMode = (nextMode: SceneListMode) => {
    updateAttributes({ mode: nextMode });
  };

  const handleCycleSortBy = () => {
    const next =
      sortBy === "createdAt"
        ? "updatedAt"
        : sortBy === "updatedAt"
          ? "orderIndex"
          : "createdAt";
    updateAttributes({ sortBy: next });
  };

  const handleToggleSortDir = () => {
    updateAttributes({ sortDir: sortDir === "asc" ? "desc" : "asc" });
  };

  return (
    <NodeViewWrapper contentEditable={false}>
      <div className="my-4 rounded-xl border border-mythos-border-default/60 bg-mythos-bg-secondary/60 p-3">
        <BlockHeader
          icon={<FileText className="h-3 w-3" />}
          title="Scenes"
          count={scenes.length}
          actions={
            <>
              <button
                type="button"
                onClick={handleCreateScene}
                disabled={!currentProject || !resolvedChapterId}
                className={cn(
                  "rounded-md p-1 text-mythos-text-muted transition-colors",
                  "hover:bg-mythos-bg-hover hover:text-mythos-text-primary",
                  "disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-mythos-text-muted"
                )}
                title="Add scene"
              >
                <Plus className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => handleToggleMode("latest")}
                className={cn(
                  "rounded-md px-2 py-1 text-[10px] uppercase tracking-wide transition-colors",
                  mode === "latest"
                    ? "bg-mythos-bg-hover text-mythos-text-primary"
                    : "text-mythos-text-muted hover:bg-mythos-bg-hover hover:text-mythos-text-primary"
                )}
                title="Show latest scene"
              >
                Latest
              </button>
              <button
                type="button"
                onClick={() => handleToggleMode("list")}
                className={cn(
                  "rounded-md px-2 py-1 text-[10px] uppercase tracking-wide transition-colors",
                  mode === "list"
                    ? "bg-mythos-bg-hover text-mythos-text-primary"
                    : "text-mythos-text-muted hover:bg-mythos-bg-hover hover:text-mythos-text-primary"
                )}
                title="Show all scenes"
              >
                List
              </button>
              <button
                type="button"
                onClick={handleCycleSortBy}
                className="rounded-md px-2 py-1 text-[10px] uppercase tracking-wide text-mythos-text-muted transition-colors hover:bg-mythos-bg-hover hover:text-mythos-text-primary"
                title="Change sort field"
              >
                {sortByLabel}
              </button>
              <button
                type="button"
                onClick={handleToggleSortDir}
                className="rounded-md px-2 py-1 text-[10px] uppercase tracking-wide text-mythos-text-muted transition-colors hover:bg-mythos-bg-hover hover:text-mythos-text-primary"
                title="Toggle sort direction"
              >
                {sortDir.toUpperCase()}
              </button>
              <button
                type="button"
                onClick={deleteNode}
                className="rounded-md p-1 text-mythos-text-muted transition-colors hover:bg-mythos-bg-hover hover:text-mythos-text-primary"
                title="Remove block"
              >
                <X className="h-3 w-3" />
              </button>
            </>
          }
        />
        <div className="mt-2 space-y-1">
          {chapterDocument && (
            <div
              role="button"
              tabIndex={0}
              onClick={handleOpenChapter}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleOpenChapter();
                }
              }}
              className={cn(
                "group flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                "hover:bg-mythos-bg-hover",
                chapterDocument.id === currentDocument?.id &&
                  "bg-mythos-bg-hover text-mythos-text-primary"
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-mythos-text-muted/70" />
              <span className="flex-1 text-mythos-text-secondary">
                {chapterDocument.title || "Untitled Chapter"}
              </span>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  void handleDeleteChapter();
                }}
                className="rounded-md p-1 text-mythos-text-muted opacity-0 transition-opacity hover:bg-mythos-bg-hover hover:text-mythos-accent-red group-hover:opacity-100"
                title="Delete chapter"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          )}
          {scenes.length === 0 && (
            <div className="text-xs text-mythos-text-muted">
              No scenes yet.
            </div>
          )}
          {visibleScenes.map((scene) => (
            <div
              key={scene.id}
              role="button"
              tabIndex={0}
              onClick={() => handleOpenScene(scene.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleOpenScene(scene.id);
                }
              }}
              className={cn(
                "group flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                "hover:bg-mythos-bg-hover",
                scene.id === currentDocument?.id &&
                  "bg-mythos-bg-hover text-mythos-text-primary"
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-mythos-text-muted/70" />
              <span className="flex-1 text-mythos-text-secondary">
                {scene.title || "Untitled"}
              </span>
              <span className="text-[10px] text-mythos-text-muted">
                Scene
              </span>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  void handleDeleteScene(scene.id);
                }}
                className="rounded-md p-1 text-mythos-text-muted opacity-0 transition-opacity hover:bg-mythos-bg-hover hover:text-mythos-accent-red group-hover:opacity-100"
                title="Delete scene"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </NodeViewWrapper>
  );
}
