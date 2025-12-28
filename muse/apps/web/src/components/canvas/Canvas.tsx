import { useEffect, useMemo, useCallback } from "react";
import {
  useEditor,
  EditorContent,
  StarterKit,
  Placeholder,
  EntityMark,
  LinterDecoration,
  PasteHandler,
} from "@mythos/editor";
import { ScrollArea } from "@mythos/ui";
import type { Entity } from "@mythos/core";
import { useEntityClick } from "../../hooks/useEntityClick";
import { useWritingAnalysis } from "../../hooks/useWritingAnalysis";
import { useLinterFixes } from "../../hooks/useLinterFixes";
import { useEntityDetection } from "../../hooks/useEntityDetection";
import { useDynamicsExtraction } from "../../hooks/useDynamicsExtraction";
import { useMythosStore, useEntities } from "../../stores";
import { useMood } from "../../stores/analysis";
import { EntitySuggestionModal } from "../modals/EntitySuggestionModal";
import { SceneContextBar } from "./SceneContextBar";

const INITIAL_CONTENT = `<p>The ancient city of <span data-entity-id="loc1" data-entity-type="location" class="entity-location">Valdris</span> stretched before him, its spires catching the last light of sunset. <span data-entity-id="char1" data-entity-type="character" class="entity-character">Kael</span> adjusted the worn leather of his cloak and stepped through the gate.</p>

<p>"You're late," said <span data-entity-id="char2" data-entity-type="character" class="entity-character">Master Theron</span>, emerging from the shadows. The old man's eyes gleamed with something between amusement and concern. "The council has been waiting."</p>

<p>Kael's hand instinctively moved to the <span data-entity-id="item1" data-entity-type="item" class="entity-item">Blade of Whispers</span> at his side. He could feel its familiar hum, a reminder of the power—and the burden—he carried.</p>

<p>"Let them wait," he replied, though he quickened his pace. "What I've discovered changes everything."</p>`;

export function Canvas() {
  const { handleEntityClick } = useEntityClick();

  // Store actions and state
  const setEditorInstance = useMythosStore((state) => state.setEditorInstance);
  const setWordCount = useMythosStore((state) => state.setWordCount);
  const setTensionLevel = useMythosStore((state) => state.setTensionLevel);
  const linterIssues = useMythosStore((state) => state.linter.issues);
  const showHud = useMythosStore((state) => state.showHud);
  const setSelectedEntity = useMythosStore((state) => state.setSelectedEntity);
  const tensionLevel = useMythosStore((state) => state.editor.tensionLevel);

  // Get entities from the store for SceneContextBar
  const sceneEntities = useEntities();

  // Get mood from analysis store
  const mood = useMood();

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

  // Entity detection hook
  const {
    isDetecting,
    detectedEntities,
    warnings,
    isModalOpen,
    isCreating,
    handlePaste,
    closeModal,
    applyEntities,
  } = useEntityDetection({ minLength: 100 });

  // Create editor at Canvas level (lifted state for cross-component access)
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: "Begin your story...",
      }),
      EntityMark,
      LinterDecoration,
      PasteHandler.configure({
        minLength: 100,
        onSubstantialPaste: handlePaste,
      }),
    ],
    content: INITIAL_CONTENT,
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
    },
  });

  // Store editor instance in Zustand for cross-component access (Console, etc.)
  useEffect(() => {
    setEditorInstance(editor);
    return () => setEditorInstance(null);
  }, [editor, setEditorInstance]);

  // Get editor text content for AI hooks
  const content = useMemo(() => {
    return editor?.getText() ?? "";
  }, [editor?.state?.doc?.content]);

  // Wire up Writing Analysis hook
  const { isAnalyzing, metrics } = useWritingAnalysis({
    content,
    autoAnalyze: true,
    debounceMs: 1500,
  });

  // Wire up Linter Fixes hook
  const { isLinting } = useLinterFixes({
    content,
    editor,
    autoLint: true,
    debounceMs: 2000,
  });

  // Wire up Dynamics Extraction hook
  const { isExtracting } = useDynamicsExtraction({
    content,
    autoExtract: true,
    debounceMs: 2000,
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

  // Update tension level when metrics change
  useEffect(() => {
    if (metrics?.tension?.length) {
      const latestTension = metrics.tension[metrics.tension.length - 1];
      setTensionLevel(Math.round(latestTension * 10));
    }
  }, [metrics, setTensionLevel]);

  // Compute dynamic display values
  const wordCount = useMemo(() => {
    return content.split(/\s+/).filter(Boolean).length;
  }, [content]);

  const tensionDisplay = useMemo(() => {
    if (metrics?.tension?.length) {
      const latestTension = metrics.tension[metrics.tension.length - 1];
      return `${Math.round(latestTension * 10)}/10`;
    }
    return "—/10";
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

      {/* Document header - NOW DYNAMIC */}
      <div className="p-4 border-b border-mythos-text-muted/20">
        <input
          type="text"
          defaultValue="Chapter 1: The Beginning"
          className="text-2xl font-serif font-bold bg-transparent border-none outline-none text-mythos-text-primary w-full placeholder:text-mythos-text-muted"
          placeholder="Chapter Title..."
        />
        <div className="flex items-center gap-4 mt-2 text-xs text-mythos-text-muted">
          <span>Scene 1 of 3</span>
          <span>|</span>
          <span>{wordCount.toLocaleString()} words</span>
          <span>|</span>
          <span>Tension: {tensionDisplay}</span>
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
