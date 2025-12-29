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
  ReactRenderer,
} from "@mythos/editor";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import { ScrollArea } from "@mythos/ui";
import type { Entity } from "@mythos/core";
import { useEntityClick } from "../../hooks/useEntityClick";
import { useWritingAnalysis } from "../../hooks/useWritingAnalysis";
import { useLinterFixes } from "../../hooks/useLinterFixes";
import { useEntityDetection } from "../../hooks/useEntityDetection";
import { useDynamicsExtraction } from "../../hooks/useDynamicsExtraction";
import { useAutoSave } from "../../hooks/useAutoSave";
import { useAutoApplyEntityMarks } from "../../hooks/useEntityMarks";
import { useMythosStore, useEntities, useCanvasView } from "../../stores";
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
import { WorldGraphView } from "../world-graph";

/**
 * Placeholder content shown when no document is selected
 */
const PLACEHOLDER_CONTENT = `<p>Select or create a document to begin writing...</p>`;

export function Canvas() {
  const canvasView = useCanvasView();

  // Render World Graph if that view is selected
  if (canvasView === "worldGraph") {
    return <WorldGraphView />;
  }

  // Otherwise render the editor
  return <EditorCanvas />;
}

/**
 * The main editor canvas component
 */
function EditorCanvas() {
  const { handleEntityClick } = useEntityClick();

  // Store actions and state
  const setEditorInstance = useMythosStore((state) => state.setEditorInstance);
  const setWordCount = useMythosStore((state) => state.setWordCount);
  const setTensionLevel = useMythosStore((state) => state.setTensionLevel);
  const linterIssues = useMythosStore((state) => state.linter.issues);
  const showHud = useMythosStore((state) => state.showHud);
  const setSelectedEntity = useMythosStore((state) => state.setSelectedEntity);
  const tensionLevel = useMythosStore((state) => state.editor.tensionLevel);

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
    autoAnalyze: true,
    debounceMs: 1500,
    enabled: !!currentDocument,
  });

  // Wire up Linter Fixes hook (disabled when no document selected)
  const { isLinting } = useLinterFixes({
    content,
    editor,
    autoLint: true,
    debounceMs: 2000,
    enabled: !!currentDocument,
  });

  // Wire up Dynamics Extraction hook (disabled when no document selected)
  const { isExtracting } = useDynamicsExtraction({
    content,
    autoExtract: true,
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
      <div className="p-4 border-b border-mythos-text-muted/20">
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
                  <span className="animate-pulse text-mythos-accent-cyan">
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
