import { useEffect, useMemo, useCallback, useRef } from "react";
import {
  useEditor,
  EditorContent,
  StarterKit,
  Placeholder,
  EntityMark,
  LinterDecoration,
  StyleDecoration,
  PasteHandler,
  EntitySuggestion,
  createSuggestionItems,
  SlashCommand,
  SceneList,
  type SlashCommandItem,
  ReactRenderer,
} from "@mythos/editor";
import { ReactNodeViewRenderer } from "@tiptap/react";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import { ScrollArea } from "@mythos/ui";
import type { Entity } from "@mythos/core";
import { createDocument, mapDbDocumentToDocument } from "@mythos/db";
import { useEntityClick } from "../../hooks/useEntityClick";
import { useWritingAnalysis } from "../../hooks/useWritingAnalysis";
import { useLinterFixes } from "../../hooks/useLinterFixes";
import { useEntityDetection } from "../../hooks/useEntityDetection";
import { useDynamicsExtraction } from "../../hooks/useDynamicsExtraction";
import { useAutoSave } from "../../hooks/useAutoSave";
import { useAutoApplyEntityMarks } from "../../hooks/useEntityMarks";
import { useMythosStore, useEntities, useCanvasView, useCurrentProject } from "../../stores";
import {
  useMood,
  useStyleIssues,
  useSelectedStyleIssueId,
  useAnalysisStore,
} from "../../stores/analysis";
import { EntitySuggestionModal } from "../modals/EntitySuggestionModal";
import { SceneContextBar } from "./SceneContextBar";
import {
  EntitySuggestionList,
  type EntitySuggestionListRef,
} from "../editor/EntitySuggestionList";
import {
  SlashCommandList,
  type SlashCommandListRef,
} from "../editor/SlashCommandList";
import { SceneListBlock } from "../editor/SceneListBlock";
import { WorldGraphView } from "../world-graph";
import { ProjectStartCanvas } from "../projects";

/**
 * Placeholder content shown when no document is selected
 */
const PLACEHOLDER_CONTENT = `<p>Select or create a document to begin writing...</p>`;
const EMPTY_TIPTAP_DOC = { type: "doc", content: [{ type: "paragraph" }] };

interface CanvasProps {
  showProjectStart?: boolean;
  onProjectCreated?: (projectId: string) => void;
  autoAnalysis?: boolean;
}

export function Canvas({
  showProjectStart = false,
  onProjectCreated,
  autoAnalysis = true,
}: CanvasProps) {
  const canvasView = useCanvasView();
  const currentProject = useCurrentProject();

  if (showProjectStart && !currentProject) {
    if (!onProjectCreated) {
      return null;
    }
    return <ProjectStartCanvas onProjectCreated={onProjectCreated} />;
  }

  // Render World Graph if that view is selected
  if (canvasView === "worldGraph") {
    return <WorldGraphView />;
  }

  // Otherwise render the editor
  return <EditorCanvas autoAnalysis={autoAnalysis} />;
}

/**
 * The main editor canvas component
 */
interface EditorCanvasProps {
  autoAnalysis: boolean;
}

function EditorCanvas({ autoAnalysis }: EditorCanvasProps) {
  const { handleEntityClick } = useEntityClick();
  const currentProject = useCurrentProject();

  // Store actions and state
  const setEditorInstance = useMythosStore((state) => state.setEditorInstance);
  const setWordCount = useMythosStore((state) => state.setWordCount);
  const setTensionLevel = useMythosStore((state) => state.setTensionLevel);
  const linterIssues = useMythosStore((state) => state.linter.issues);
  const showHud = useMythosStore((state) => state.showHud);
  const setSelectedEntity = useMythosStore((state) => state.setSelectedEntity);
  const tensionLevel = useMythosStore((state) => state.editor.tensionLevel);
  const documents = useMythosStore((state) => state.document.documents);
  const addDocument = useMythosStore((state) => state.addDocument);
  const setCurrentDocument = useMythosStore((state) => state.setCurrentDocument);
  const setCanvasView = useMythosStore((state) => state.setCanvasView);

  // Get current document from store
  const currentDocument = useMythosStore(
    (state) => state.document.currentDocument
  );
  const updateDocumentInStore = useMythosStore((state) => state.updateDocument);

  // Track the current document ID to detect changes
  const previousDocumentIdRef = useRef<string | null>(null);

  // Get entities from the store for SceneContextBar
  const sceneEntities = useEntities();

  // Get mood from analysis store
  const mood = useMood();

  // Get style issues and selection from analysis store
  const styleIssues = useStyleIssues();
  const selectedStyleIssueId = useSelectedStyleIssueId();
  const setSelectedStyleIssueId = useAnalysisStore(
    (state) => state.setSelectedStyleIssueId
  );

  // Handle entity avatar click in SceneContextBar
  const handleSceneEntityClick = useCallback(
    (entity: Entity) => {
      // Set selected entity and show HUD at a default position (center-ish of viewport)
      setSelectedEntity(entity.id);
      showHud(entity, {
        x: window.innerWidth / 2,
        y: 120, // Below the context bar
      });
    },
    [setSelectedEntity, showHud]
  );

  // Create a stable callback ref for handlePaste to break circular dependency
  // (editor needs handlePaste, but useEntityDetection needs editor for marks)
  const handlePasteRef = useRef<(text: string, pastePosition: number) => void>(
    () => {}
  );
  const stableHandlePaste = useCallback(
    (text: string, pastePosition: number) => {
      handlePasteRef.current(text, pastePosition);
    },
    []
  );

  const resolveSceneParentId = useCallback((): string | undefined => {
    if (currentDocument?.type === "chapter") {
      return currentDocument.id;
    }
    if (currentDocument?.type === "scene") {
      return currentDocument.parentId;
    }
    const chapters = documents
      .filter((doc) => doc.type === "chapter")
      .sort((a, b) => a.orderIndex - b.orderIndex);
    return chapters.length > 0 ? chapters[chapters.length - 1].id : undefined;
  }, [currentDocument, documents]);

  const handleCreateScene = useCallback(async () => {
    if (!currentProject) return;
    const parentId = resolveSceneParentId();
    const siblingScenes = documents.filter(
      (doc) => doc.type === "scene" && doc.parentId === parentId
    );
    const nextOrderIndex =
      siblingScenes.length > 0
        ? Math.max(...siblingScenes.map((doc) => doc.orderIndex)) + 1
        : 0;
    const nextSceneNumber = siblingScenes.length + 1;
    const title = `Scene ${nextSceneNumber}`;

    try {
      const created = await createDocument({
        project_id: currentProject.id,
        parent_id: parentId ?? null,
        type: "scene",
        title,
        content: EMPTY_TIPTAP_DOC,
        content_text: "",
        order_index: nextOrderIndex,
        word_count: 0,
      });
      const mapped = mapDbDocumentToDocument(created);
      addDocument(mapped);
      setCurrentDocument(mapped);
      setCanvasView("editor");
    } catch (err) {
      console.warn("Failed to create scene:", err);
    }
  }, [
    currentProject,
    resolveSceneParentId,
    documents,
    addDocument,
    setCurrentDocument,
    setCanvasView,
  ]);

  const createSceneRef = useRef<() => void>(() => {});

  useEffect(() => {
    createSceneRef.current = () => {
      void handleCreateScene();
    };
  }, [handleCreateScene]);

  const slashItems = useMemo<SlashCommandItem[]>(
    () => [
      {
        id: "scene",
        label: "Scene",
        description: "Create a scene under the current chapter",
        keywords: ["scene", "chapter"],
      },
    ],
    []
  );

  // Determine initial content based on currentDocument
  const initialContent = useMemo(() => {
    if (currentDocument?.content) {
      // Document content is stored as Tiptap JSON
      return currentDocument.content;
    }
    return PLACEHOLDER_CONTENT;
    // Only recompute on initial mount - we'll handle document switches via effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Create editor at Canvas level (lifted state for cross-component access)
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      SceneList.extend({
        addNodeView() {
          return ReactNodeViewRenderer(SceneListBlock);
        },
      }),
      Placeholder.configure({
        placeholder: currentDocument
          ? "Begin your story..."
          : "Select or create a document to begin...",
      }),
      EntityMark,
      LinterDecoration,
      StyleDecoration.configure({
        onIssueSelect: (issueId) => setSelectedStyleIssueId(issueId),
      }),
      PasteHandler.configure({
        minLength: 100,
        onSubstantialPaste: stableHandlePaste,
      }),
      SlashCommand.configure({
        suggestion: {
          items: ({ query }) => {
            const hasProject =
              !!useMythosStore.getState().project.currentProject;
            if (!hasProject) return [];
            const lower = query.toLowerCase();
            return slashItems.filter((item) => {
              if (!lower) return true;
              const keywords = item.keywords ?? [];
              return (
                item.label.toLowerCase().includes(lower) ||
                keywords.some((k) => k.toLowerCase().includes(lower))
              );
            });
          },
          command: ({ editor, range, props }) => {
            editor.chain().focus().deleteRange(range).run();
            if (props.id === "scene") {
              const state = useMythosStore.getState();
              const currentDoc = state.document.currentDocument;
              const docList = state.document.documents;
              let chapterId: string | null = null;

              if (currentDoc?.type === "chapter") {
                chapterId = currentDoc.id;
              } else if (currentDoc?.type === "scene") {
                chapterId = currentDoc.parentId ?? null;
              } else {
                const chapters = docList
                  .filter((doc) => doc.type === "chapter")
                  .sort((a, b) => a.orderIndex - b.orderIndex);
                chapterId = chapters.length > 0 ? chapters[chapters.length - 1].id : null;
              }

              editor
                .chain()
                .focus()
                .insertContent({
                  type: "sceneList",
                  attrs: { chapterId },
                })
                .run();
              createSceneRef.current();
            }
          },
          render: () => {
            let component: ReactRenderer<SlashCommandListRef> | null = null;
            let popup: TippyInstance[] | null = null;

            return {
              onStart: (props) => {
                component = new ReactRenderer(SlashCommandList, {
                  props,
                  editor: props.editor,
                });

                if (!props.clientRect) {
                  return;
                }

                popup = tippy("body", {
                  getReferenceClientRect: props.clientRect as () => DOMRect,
                  appendTo: () => document.body,
                  content: component.element,
                  showOnCreate: true,
                  interactive: true,
                  trigger: "manual",
                  placement: "bottom-start",
                });
              },

              onUpdate: (props) => {
                component?.updateProps(props);

                if (!props.clientRect) {
                  return;
                }

                popup?.[0]?.setProps({
                  getReferenceClientRect: props.clientRect as () => DOMRect,
                });
              },

              onKeyDown: (props) => {
                if (props.event.key === "Escape") {
                  popup?.[0]?.hide();
                  return true;
                }

                return component?.ref?.onKeyDown(props) ?? false;
              },

              onExit: () => {
                popup?.[0]?.destroy();
                component?.destroy();
              },
            };
          },
        },
      }),
      EntitySuggestion.configure({
        suggestion: {
          items: ({ query }) => {
            // Read entities from store dynamically
            const entities = Array.from(
              useMythosStore.getState().world.entities.values()
            );
            return createSuggestionItems(entities, query);
          },
          render: () => {
            let component: ReactRenderer<EntitySuggestionListRef> | null = null;
            let popup: TippyInstance[] | null = null;

            return {
              onStart: (props) => {
                component = new ReactRenderer(EntitySuggestionList, {
                  props,
                  editor: props.editor,
                });

                if (!props.clientRect) {
                  return;
                }

                popup = tippy("body", {
                  getReferenceClientRect: props.clientRect as () => DOMRect,
                  appendTo: () => document.body,
                  content: component.element,
                  showOnCreate: true,
                  interactive: true,
                  trigger: "manual",
                  placement: "bottom-start",
                });
              },

              onUpdate: (props) => {
                component?.updateProps(props);

                if (!props.clientRect) {
                  return;
                }

                popup?.[0]?.setProps({
                  getReferenceClientRect: props.clientRect as () => DOMRect,
                });
              },

              onKeyDown: (props) => {
                if (props.event.key === "Escape") {
                  popup?.[0]?.hide();
                  return true;
                }

                return component?.ref?.onKeyDown(props) ?? false;
              },

              onExit: () => {
                popup?.[0]?.destroy();
                component?.destroy();
              },
            };
          },
        },
      }),
    ],
    content: initialContent,
    editable: !!currentDocument, // Only editable when a document is selected
    editorProps: {
      attributes: {
        class:
          "prose prose-invert prose-lg max-w-none focus:outline-none font-serif",
      },
    },
    onUpdate: ({ editor: ed }) => {
      // Update word count when content changes
      const text = ed.getText();
      const words = text.split(/\s+/).filter(Boolean).length;
      setWordCount(words);

      // Update document content in the store (for local state consistency)
      if (currentDocument?.id) {
        const jsonContent = ed.getJSON();
        updateDocumentInStore(currentDocument.id, {
          content: jsonContent,
          wordCount: words,
        });
      }
    },
  });

  // Store editor instance in Zustand for cross-component access (Console, etc.)
  useEffect(() => {
    setEditorInstance(editor);
    return () => setEditorInstance(null);
  }, [editor, setEditorInstance]);

  // Entity detection hook - called after editor is created so marks can be applied
  const {
    isDetecting,
    detectedEntities,
    warnings,
    isModalOpen,
    isCreating,
    handlePaste,
    closeModal,
    applyEntities,
  } = useEntityDetection({ minLength: 100, editor });

  // Wire up the stable callback ref to the actual handlePaste
  useEffect(() => {
    handlePasteRef.current = handlePaste;
  }, [handlePaste]);

  // Auto-apply EntityMarks when document loads (for existing entity mentions)
  useAutoApplyEntityMarks(editor, sceneEntities, currentDocument?.id ?? null);

  // Wire up auto-save for document persistence
  const { isSaving, lastSavedAt, error: saveError } = useAutoSave({
    editor,
    documentId: currentDocument?.id ?? null,
    enabled: !!currentDocument,
    debounceMs: 2000,
  });

  // Handle document switching - update editor content when currentDocument changes
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;

    const currentId = currentDocument?.id ?? null;
    const previousId = previousDocumentIdRef.current;

    // Only update content if the document actually changed
    if (currentId !== previousId) {
      previousDocumentIdRef.current = currentId;

      if (currentDocument?.content) {
        // Load the new document's content
        editor.commands.setContent(currentDocument.content);
      } else if (!currentDocument) {
        // No document selected - show placeholder
        editor.commands.setContent(PLACEHOLDER_CONTENT);
      } else {
        // New document with no content - start fresh
        editor.commands.setContent("");
      }

      // Update editable state
      editor.setEditable(!!currentDocument);
    }
  }, [editor, currentDocument]);

  // Get editor text content for AI hooks
  const content = useMemo(() => {
    return editor?.getText() ?? "";
  }, [editor?.state?.doc?.content]);

  // Wire up Writing Analysis hook (disabled when no document selected)
  const { isAnalyzing, metrics } = useWritingAnalysis({
    content,
    autoAnalyze: autoAnalysis,
    debounceMs: 1500,
    enabled: !!currentDocument,
  });

  // Wire up Linter Fixes hook (disabled when no document selected)
  const { isLinting } = useLinterFixes({
    content,
    editor,
    autoLint: autoAnalysis,
    debounceMs: 2000,
    enabled: !!currentDocument,
  });

  // Wire up Dynamics Extraction hook (disabled when no document selected)
  const { isExtracting } = useDynamicsExtraction({
    content,
    autoExtract: autoAnalysis,
    debounceMs: 2000,
    enabled: !!currentDocument,
  });

  // Sync linter issues from store to editor decorations
  useEffect(() => {
    if (editor && !editor.isDestroyed && editor.commands.setLinterIssues) {
      const decorationIssues = linterIssues.map((issue) => ({
        id: issue.id,
        severity: issue.severity,
        location: issue.location,
        message: issue.message,
      }));
      editor.commands.setLinterIssues(decorationIssues);
    }
  }, [editor, linterIssues]);

  // Sync style issues from store to editor decorations
  useEffect(() => {
    if (editor && !editor.isDestroyed && editor.commands.setStyleIssues) {
      editor.commands.setStyleIssues(styleIssues);
    }
  }, [editor, styleIssues]);

  // Sync selected style issue from store to editor
  useEffect(() => {
    if (editor && !editor.isDestroyed && editor.commands.setSelectedStyleIssue) {
      editor.commands.setSelectedStyleIssue(selectedStyleIssueId);
    }
  }, [editor, selectedStyleIssueId]);

  // Update tension level when metrics change (0-100 scale for SceneContextBar)
  useEffect(() => {
    if (metrics?.tension?.length) {
      const latestTension = metrics.tension[metrics.tension.length - 1];
      // Convert 0-1 normalized tension to 0-100 scale
      setTensionLevel(Math.round(latestTension * 100));
    }
  }, [metrics, setTensionLevel]);

  // Compute dynamic display values
  const wordCount = useMemo(() => {
    return content.split(/\s+/).filter(Boolean).length;
  }, [content]);

  const tensionDisplay = useMemo(() => {
    if (metrics?.tension?.length) {
      const latestTension = metrics.tension[metrics.tension.length - 1];
      // Display as percentage (0-100 scale)
      return `${Math.round(latestTension * 100)}%`;
    }
    return "—";
  }, [metrics]);

  return (
    <div className="h-full flex flex-col">
      {/* Scene Context Bar - shows cast, tension, and mood */}
      <SceneContextBar
        entities={sceneEntities}
        tension={tensionLevel}
        mood={mood}
        onEntityClick={handleSceneEntityClick}
      />

      {/* Document header - shows title and status */}
      <div className="p-4 border-b border-mythos-border-default">
        {currentDocument ? (
          <>
            <input
              type="text"
              defaultValue={currentDocument.title ?? "Untitled"}
              key={currentDocument.id} // Reset input when document changes
              className="text-2xl font-serif font-bold bg-transparent border-none outline-none text-mythos-text-primary w-full placeholder:text-mythos-text-muted"
              placeholder="Document Title..."
              onChange={(e) => {
                if (currentDocument?.id) {
                  updateDocumentInStore(currentDocument.id, {
                    title: e.target.value,
                  });
                }
              }}
            />
            <div className="flex items-center gap-4 mt-2 text-xs text-mythos-text-muted">
              <span className="capitalize">{currentDocument.type}</span>
              <span>|</span>
              <span>{wordCount.toLocaleString()} words</span>
              <span>|</span>
              <span>Tension: {tensionDisplay}</span>
              {/* Save status */}
              {isSaving && (
                <>
                  <span>|</span>
                  <span className="animate-pulse text-mythos-accent-gold">
                    Saving...
                  </span>
                </>
              )}
              {!isSaving && lastSavedAt && (
                <>
                  <span>|</span>
                  <span className="text-mythos-accent-green">Saved</span>
                </>
              )}
              {saveError && (
                <>
                  <span>|</span>
                  <span className="text-mythos-accent-red" title={saveError}>
                    Save failed
                  </span>
                </>
              )}
              {/* Analysis status */}
              {(isAnalyzing || isLinting || isDetecting || isExtracting) && (
                <>
                  <span>|</span>
                  <span className="animate-pulse text-mythos-accent-primary">
                    {isDetecting
                      ? "Detecting entities..."
                      : isExtracting
                        ? "Extracting dynamics..."
                        : isAnalyzing
                          ? "Analyzing..."
                          : "Linting..."}
                  </span>
                </>
              )}
            </div>
          </>
        ) : (
          <div className="text-mythos-text-muted">
            <h2 className="text-2xl font-serif font-bold">No Document Selected</h2>
            <p className="mt-2 text-sm">
              Select a document from the manifest or create a new one to start writing.
            </p>
          </div>
        )}
      </div>

      {/* Editor */}
      <ScrollArea className="flex-1">
        <div className="max-w-3xl mx-auto px-8 py-6">
          <div className="mythos-editor" onClick={handleEntityClick}>
            <EditorContent editor={editor} />
          </div>
        </div>
      </ScrollArea>

      {/* Entity Suggestion Modal */}
      <EntitySuggestionModal
        isOpen={isModalOpen}
        entities={detectedEntities}
        warnings={warnings}
        onClose={closeModal}
        onApply={applyEntities}
        isProcessing={isDetecting || isCreating}
      />
    </div>
  );
}
