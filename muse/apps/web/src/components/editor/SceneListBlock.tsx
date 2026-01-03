import { NodeViewWrapper } from "@tiptap/react";
import { FileText } from "lucide-react";
import { cn } from "@mythos/ui";
import { useMythosStore } from "../../stores";

interface SceneListBlockProps {
  node: {
    attrs: {
      chapterId?: string | null;
    };
  };
}

export function SceneListBlock({ node }: SceneListBlockProps) {
  const chapterId = node.attrs.chapterId ?? null;
  const documents = useMythosStore((state) => state.document.documents);
  const currentDocument = useMythosStore((state) => state.document.currentDocument);
  const setCurrentDocument = useMythosStore((state) => state.setCurrentDocument);
  const setCanvasView = useMythosStore((state) => state.setCanvasView);

  const resolvedChapterId =
    chapterId ??
    (currentDocument?.type === "chapter" ? currentDocument.id : null);

  const scenes = documents
    .filter(
      (doc) =>
        doc.type === "scene" && doc.parentId === resolvedChapterId
    )
    .sort((a, b) => a.orderIndex - b.orderIndex);

  const handleOpenScene = (sceneId: string) => {
    const scene = documents.find((doc) => doc.id === sceneId);
    if (!scene) return;
    setCurrentDocument(scene);
    setCanvasView("editor");
  };

  return (
    <NodeViewWrapper contentEditable={false}>
      <div className="my-4 rounded-xl border border-mythos-border-default/60 bg-mythos-bg-secondary/60 p-3">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-mythos-text-muted">
          <FileText className="h-3 w-3" />
          Scenes
        </div>
        <div className="mt-2 space-y-1">
          {scenes.length === 0 && (
            <div className="text-xs text-mythos-text-muted">
              No scenes yet.
            </div>
          )}
          {scenes.map((scene) => (
            <button
              key={scene.id}
              type="button"
              onClick={() => handleOpenScene(scene.id)}
              className={cn(
                "w-full rounded-md px-2 py-1.5 text-left text-sm",
                "flex items-center gap-2 hover:bg-mythos-bg-hover",
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
            </button>
          ))}
        </div>
      </div>
    </NodeViewWrapper>
  );
}
