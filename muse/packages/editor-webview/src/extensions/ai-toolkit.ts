/**
 * AiToolkit - Central hub for AI operations in the editor
 *
 * Inspired by Tiptap's @tiptap-pro/ai-toolkit pattern.
 * Provides a unified API for:
 * - Document comparison (diff-first editing)
 * - Suggestion management
 * - Streaming content with preview
 * - Tool execution with review
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { EditorView } from '@tiptap/pm/view';
import type { Editor } from '@tiptap/core';

// =============================================================================
// Types
// =============================================================================

export type ChangeType = 'insert' | 'delete' | 'replace';

export interface AiChange {
  id: string;
  type: ChangeType;
  from: number;
  to: number;
  /** New content (for insert/replace) */
  newContent?: string;
  /** Original content (for delete/replace) */
  oldContent?: string;
  /** Rule that generated this change */
  ruleId?: string;
  /** Model that generated the change */
  model?: string;
  /** Timestamp */
  createdAt: string;
}

export interface AiSuggestionRule {
  id: string;
  title: string;
  prompt: string;
  color: string;
  backgroundColor: string;
  /** Don't send to AI - used for diff display only */
  ignoreInGeneration?: boolean;
  /** Display as unified diff */
  displayAsDiff?: boolean;
}

export interface ReviewOptions {
  /** 'preview' shows changes for review, 'direct' applies immediately */
  mode: 'preview' | 'direct';
  /** Auto-accept behavior */
  autoAccept?: 'always' | 'never' | 'readonly-tools';
  /** Custom decoration rendering */
  displayOptions?: {
    renderDecorations?: (options: DecorationRenderOptions) => Decoration[];
  };
}

export interface DecorationRenderOptions {
  change: AiChange;
  range: { from: number; to: number };
  isSelected: boolean;
  defaultRenderDecorations: () => Decoration[];
}

export interface ToolExecutionResult {
  success: boolean;
  output: string;
  docChanged: boolean;
  changes: AiChange[];
}

export interface StreamOptions {
  position: 'cursor' | 'selection' | 'end' | number;
  reviewOptions?: ReviewOptions;
}

export interface AiToolkitState {
  /** Whether we're in comparison mode */
  isComparing: boolean;
  /** Baseline document for comparison */
  baselineDoc: ProseMirrorNode | null;
  /** All tracked changes */
  changes: Map<string, AiChange>;
  /** Currently selected change ID */
  selectedChangeId: string | null;
  /** Whether changes are visible */
  showChanges: boolean;
  /** Active rules */
  rules: AiSuggestionRule[];
  /** Loading state */
  isLoading: boolean;
  /** Streaming state */
  isStreaming: boolean;
  /** Review state */
  reviewState: {
    isReviewing: boolean;
    toolCallId: string | null;
    pendingOutput: string | null;
  };
}

export const aiToolkitPluginKey = new PluginKey<AiToolkitState>('aiToolkit');

// =============================================================================
// Default Rules
// =============================================================================

export const DEFAULT_RULES: AiSuggestionRule[] = [
  {
    id: 'grammar',
    title: 'Grammar',
    prompt: 'Fix grammar issues',
    color: '#DC143C',
    backgroundColor: '#FFE6E6',
  },
  {
    id: 'spelling',
    title: 'Spelling',
    prompt: 'Fix spelling mistakes',
    color: '#FF8C00',
    backgroundColor: '#FFF3E6',
  },
  {
    id: 'style',
    title: 'Style',
    prompt: 'Improve writing style',
    color: '#4169E1',
    backgroundColor: '#E6EDFF',
  },
  {
    id: 'clarity',
    title: 'Clarity',
    prompt: 'Make text clearer',
    color: '#228B22',
    backgroundColor: '#E6F5E6',
  },
  {
    id: 'ai-generation',
    title: 'AI Generated',
    prompt: '',
    color: '#8B5CF6',
    backgroundColor: '#F3E8FF',
    ignoreInGeneration: true,
  },
  {
    id: 'diff',
    title: 'Diff',
    prompt: '',
    color: '#000',
    backgroundColor: '#fff',
    ignoreInGeneration: true,
    displayAsDiff: true,
  },
];

// =============================================================================
// Meta Actions
// =============================================================================

type AiToolkitMeta =
  | { type: 'startComparing'; baselineDoc: ProseMirrorNode }
  | { type: 'stopComparing' }
  | { type: 'addChange'; change: AiChange }
  | { type: 'removeChange'; id: string }
  | { type: 'acceptChange'; id: string }
  | { type: 'rejectChange'; id: string }
  | { type: 'acceptAll' }
  | { type: 'rejectAll' }
  | { type: 'selectChange'; id: string | null }
  | { type: 'setShowChanges'; show: boolean }
  | { type: 'setRules'; rules: AiSuggestionRule[] }
  | { type: 'setLoading'; loading: boolean }
  | { type: 'setStreaming'; streaming: boolean }
  | { type: 'setReviewState'; reviewState: AiToolkitState['reviewState'] }
  | { type: 'clear' };

// =============================================================================
// Decoration Rendering
// =============================================================================

function createChangeDecorations(
  state: AiToolkitState,
  doc: ProseMirrorNode,
  view?: EditorView
): DecorationSet {
  if (!state.showChanges || state.changes.size === 0) {
    return DecorationSet.empty;
  }

  const decorations: Decoration[] = [];
  const rule = state.rules.find(r => r.displayAsDiff) || DEFAULT_RULES.find(r => r.id === 'diff');

  for (const [id, change] of state.changes) {
    const isSelected = state.selectedChangeId === id;
    const ruleForChange = state.rules.find(r => r.id === change.ruleId) || rule;

    // Inline decoration for the change
    if (change.type === 'insert') {
      decorations.push(
        Decoration.inline(change.from, change.to, {
          class: `ai-change ai-change-insert ${isSelected ? 'ai-change-selected' : ''}`,
          style: `background-color: ${ruleForChange?.backgroundColor || 'rgba(34, 197, 94, 0.2)'}`,
          'data-change-id': id,
          'data-change-type': 'insert',
        })
      );
    } else if (change.type === 'delete') {
      // For deletions, we show a widget with the deleted content
      decorations.push(
        Decoration.widget(change.from, () => {
          const span = document.createElement('span');
          span.className = `ai-change ai-change-delete ${isSelected ? 'ai-change-selected' : ''}`;
          span.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
          span.style.textDecoration = 'line-through';
          span.style.color = 'rgba(0, 0, 0, 0.5)';
          span.textContent = change.oldContent || '';
          span.setAttribute('data-change-id', id);
          span.setAttribute('data-change-type', 'delete');
          return span;
        }, { side: -1 })
      );
    } else if (change.type === 'replace') {
      // Show both deletion and insertion
      decorations.push(
        Decoration.widget(change.from, () => {
          const span = document.createElement('span');
          span.className = `ai-change ai-change-delete ${isSelected ? 'ai-change-selected' : ''}`;
          span.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
          span.style.textDecoration = 'line-through';
          span.style.color = 'rgba(0, 0, 0, 0.5)';
          span.textContent = change.oldContent || '';
          return span;
        }, { side: -1 })
      );
      decorations.push(
        Decoration.inline(change.from, change.to, {
          class: `ai-change ai-change-insert ${isSelected ? 'ai-change-selected' : ''}`,
          style: `background-color: ${ruleForChange?.backgroundColor || 'rgba(34, 197, 94, 0.2)'}`,
          'data-change-id': id,
          'data-change-type': 'replace',
        })
      );
    }

    // Widget for accept/reject buttons
    if (view) {
      decorations.push(
        Decoration.widget(change.to, () => createChangeWidget(id, change, view), {
          side: 1,
          key: `ai-change-widget-${id}`,
        })
      );
    }
  }

  return DecorationSet.create(doc, decorations);
}

function createChangeWidget(id: string, _change: AiChange, view: EditorView): HTMLElement {
  const wrapper = document.createElement('span');
  wrapper.className = 'ai-change-widget';
  wrapper.contentEditable = 'false';

  const acceptBtn = document.createElement('button');
  acceptBtn.className = 'ai-change-btn ai-change-btn-accept';
  acceptBtn.innerHTML = '✓';
  acceptBtn.title = 'Accept (⌘⏎)';
  acceptBtn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    view.dom.dispatchEvent(new CustomEvent('ai:acceptChange', { detail: { id }, bubbles: true }));
  };

  const rejectBtn = document.createElement('button');
  rejectBtn.className = 'ai-change-btn ai-change-btn-reject';
  rejectBtn.innerHTML = '✗';
  rejectBtn.title = 'Reject (⌘⌫)';
  rejectBtn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    view.dom.dispatchEvent(new CustomEvent('ai:rejectChange', { detail: { id }, bubbles: true }));
  };

  wrapper.appendChild(acceptBtn);
  wrapper.appendChild(rejectBtn);
  return wrapper;
}

// =============================================================================
// Plugin
// =============================================================================

function createAiToolkitPlugin(rules: AiSuggestionRule[]): Plugin<AiToolkitState> {
  return new Plugin<AiToolkitState>({
    key: aiToolkitPluginKey,

    state: {
      init(): AiToolkitState {
        return {
          isComparing: false,
          baselineDoc: null,
          changes: new Map(),
          selectedChangeId: null,
          showChanges: true,
          rules,
          isLoading: false,
          isStreaming: false,
          reviewState: {
            isReviewing: false,
            toolCallId: null,
            pendingOutput: null,
          },
        };
      },

      apply(tr, value): AiToolkitState {
        const meta = tr.getMeta(aiToolkitPluginKey) as AiToolkitMeta | undefined;

        if (!meta) {
          // Update change positions if doc changed
          if (tr.docChanged && value.changes.size > 0) {
            const newChanges = new Map<string, AiChange>();
            for (const [id, change] of value.changes) {
              const newFrom = tr.mapping.map(change.from);
              const newTo = tr.mapping.map(change.to);
              if (newFrom < newTo) {
                newChanges.set(id, { ...change, from: newFrom, to: newTo });
              }
            }
            return { ...value, changes: newChanges };
          }
          return value;
        }

        switch (meta.type) {
          case 'startComparing':
            return {
              ...value,
              isComparing: true,
              baselineDoc: meta.baselineDoc,
              changes: new Map(),
            };

          case 'stopComparing':
            return {
              ...value,
              isComparing: false,
              baselineDoc: null,
              changes: new Map(),
            };

          case 'addChange': {
            const newChanges = new Map(value.changes);
            newChanges.set(meta.change.id, meta.change);
            return { ...value, changes: newChanges };
          }

          case 'removeChange': {
            const newChanges = new Map(value.changes);
            newChanges.delete(meta.id);
            return {
              ...value,
              changes: newChanges,
              selectedChangeId: value.selectedChangeId === meta.id ? null : value.selectedChangeId,
            };
          }

          case 'acceptChange':
          case 'rejectChange': {
            const newChanges = new Map(value.changes);
            newChanges.delete(meta.id);
            return {
              ...value,
              changes: newChanges,
              selectedChangeId: value.selectedChangeId === meta.id ? null : value.selectedChangeId,
            };
          }

          case 'acceptAll':
          case 'rejectAll':
            return {
              ...value,
              changes: new Map(),
              selectedChangeId: null,
            };

          case 'selectChange':
            return { ...value, selectedChangeId: meta.id };

          case 'setShowChanges':
            return { ...value, showChanges: meta.show };

          case 'setRules':
            return { ...value, rules: meta.rules };

          case 'setLoading':
            return { ...value, isLoading: meta.loading };

          case 'setStreaming':
            return { ...value, isStreaming: meta.streaming };

          case 'setReviewState':
            return { ...value, reviewState: meta.reviewState };

          case 'clear':
            return {
              ...value,
              changes: new Map(),
              selectedChangeId: null,
              isComparing: false,
              baselineDoc: null,
            };

          default:
            return value;
        }
      },
    },

    props: {
      decorations(state) {
        const pluginState = aiToolkitPluginKey.getState(state);
        if (!pluginState) return DecorationSet.empty;
        const view = (this as unknown as { spec: { _editorView?: EditorView } }).spec._editorView;
        return createChangeDecorations(pluginState, state.doc, view);
      },
    },

    view(editorView) {
      (this as unknown as { spec: { _editorView: EditorView } }).spec._editorView = editorView;
      return {};
    },
  });
}

// =============================================================================
// AiToolkit Class (getAiToolkit pattern)
// =============================================================================

export class AiToolkit {
  constructor(private editor: Editor) {}

  // ---------------------------------------------------------------------------
  // State Access
  // ---------------------------------------------------------------------------

  private getState(): AiToolkitState | undefined {
    return aiToolkitPluginKey.getState(this.editor.state);
  }

  getChanges(): AiChange[] {
    return Array.from(this.getState()?.changes.values() ?? []);
  }

  getSelectedChange(): AiChange | null {
    const state = this.getState();
    if (!state?.selectedChangeId) return null;
    return state.changes.get(state.selectedChangeId) ?? null;
  }

  isComparing(): boolean {
    return this.getState()?.isComparing ?? false;
  }

  isLoading(): boolean {
    return this.getState()?.isLoading ?? false;
  }

  isStreaming(): boolean {
    return this.getState()?.isStreaming ?? false;
  }

  isReviewing(): boolean {
    return this.getState()?.reviewState.isReviewing ?? false;
  }

  // ---------------------------------------------------------------------------
  // Document Comparison
  // ---------------------------------------------------------------------------

  startComparingDocuments(options?: {
    otherDoc?: ProseMirrorNode;
    displayOptions?: ReviewOptions['displayOptions'];
  }): void {
    const baselineDoc = options?.otherDoc ?? this.editor.state.doc;
    this.editor.view.dispatch(
      this.editor.state.tr.setMeta(aiToolkitPluginKey, {
        type: 'startComparing',
        baselineDoc,
      })
    );
  }

  stopComparingDocuments(): void {
    this.editor.view.dispatch(
      this.editor.state.tr.setMeta(aiToolkitPluginKey, { type: 'stopComparing' })
    );
  }

  // ---------------------------------------------------------------------------
  // Change Management
  // ---------------------------------------------------------------------------

  addChange(change: Omit<AiChange, 'id' | 'createdAt'>): string {
    const id = crypto.randomUUID();
    const fullChange: AiChange = {
      ...change,
      id,
      createdAt: new Date().toISOString(),
    };

    this.editor.view.dispatch(
      this.editor.state.tr.setMeta(aiToolkitPluginKey, { type: 'addChange', change: fullChange })
    );

    return id;
  }

  setChanges(changes: AiChange[]): void {
    // Clear existing and add new
    this.editor.view.dispatch(
      this.editor.state.tr.setMeta(aiToolkitPluginKey, { type: 'clear' })
    );
    for (const change of changes) {
      this.editor.view.dispatch(
        this.editor.state.tr.setMeta(aiToolkitPluginKey, { type: 'addChange', change })
      );
    }
  }

  acceptChange(id: string): void {
    const state = this.getState();
    const change = state?.changes.get(id);
    if (!change) return;

    // For reject type, we need to apply the deletion
    if (change.type === 'delete') {
      this.editor.chain()
        .deleteRange({ from: change.from, to: change.to })
        .run();
    }
    // For insert/replace, content is already there, just remove the change marker

    this.editor.view.dispatch(
      this.editor.state.tr.setMeta(aiToolkitPluginKey, { type: 'acceptChange', id })
    );
  }

  rejectChange(id: string): void {
    const state = this.getState();
    const change = state?.changes.get(id);
    if (!change) return;

    if (change.type === 'insert') {
      // Remove the inserted content
      this.editor.chain()
        .deleteRange({ from: change.from, to: change.to })
        .run();
    } else if (change.type === 'replace' && change.oldContent) {
      // Restore original content
      this.editor.chain()
        .deleteRange({ from: change.from, to: change.to })
        .insertContentAt(change.from, change.oldContent)
        .run();
    }
    // For delete type, just remove the marker (content was never deleted)

    this.editor.view.dispatch(
      this.editor.state.tr.setMeta(aiToolkitPluginKey, { type: 'rejectChange', id })
    );
  }

  acceptAllChanges(): void {
    const changes = Array.from(this.getState()?.changes.values() ?? []);
    // Accept in reverse order to maintain positions
    for (const change of changes.sort((a, b) => b.from - a.from)) {
      this.acceptChange(change.id);
    }
  }

  rejectAllChanges(): void {
    const changes = Array.from(this.getState()?.changes.values() ?? []);
    // Reject in reverse order to maintain positions
    for (const change of changes.sort((a, b) => b.from - a.from)) {
      this.rejectChange(change.id);
    }
  }

  selectChange(id: string | null): void {
    this.editor.view.dispatch(
      this.editor.state.tr.setMeta(aiToolkitPluginKey, { type: 'selectChange', id })
    );

    // Move cursor to change if selecting
    if (id) {
      const change = this.getState()?.changes.get(id);
      if (change) {
        this.editor.chain().setTextSelection(change.from).run();
      }
    }
  }

  setShowChanges(show: boolean): void {
    this.editor.view.dispatch(
      this.editor.state.tr.setMeta(aiToolkitPluginKey, { type: 'setShowChanges', show })
    );
  }

  // ---------------------------------------------------------------------------
  // Streaming
  // ---------------------------------------------------------------------------

  async streamText(
    stream: ReadableStream<string>,
    options: StreamOptions = { position: 'cursor' }
  ): Promise<{ success: boolean; content: string }> {
    const isPreview = options.reviewOptions?.mode === 'preview';

    // Set streaming state
    this.editor.view.dispatch(
      this.editor.state.tr.setMeta(aiToolkitPluginKey, { type: 'setStreaming', streaming: true })
    );

    // Determine insert position
    let insertPos: number;
    if (options.position === 'cursor') {
      insertPos = this.editor.state.selection.from;
    } else if (options.position === 'selection') {
      insertPos = this.editor.state.selection.to;
    } else if (options.position === 'end') {
      insertPos = this.editor.state.doc.content.size;
    } else {
      insertPos = options.position;
    }

    const startPos = insertPos;
    let fullContent = '';

    try {
      const reader = stream.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = typeof value === 'string' ? value : decoder.decode(value);
        fullContent += chunk;

        // Insert chunk at current position
        this.editor.chain()
          .insertContentAt(insertPos, chunk)
          .run();

        insertPos += chunk.length;
      }

      // If preview mode, create a change for the entire insertion
      if (isPreview && fullContent.length > 0) {
        this.addChange({
          type: 'insert',
          from: startPos,
          to: startPos + fullContent.length,
          newContent: fullContent,
          ruleId: 'ai-generation',
        });

        // Set review state
        this.editor.view.dispatch(
          this.editor.state.tr.setMeta(aiToolkitPluginKey, {
            type: 'setReviewState',
            reviewState: { isReviewing: true, toolCallId: null, pendingOutput: fullContent },
          })
        );
      }

      return { success: true, content: fullContent };
    } finally {
      this.editor.view.dispatch(
        this.editor.state.tr.setMeta(aiToolkitPluginKey, { type: 'setStreaming', streaming: false })
      );
    }
  }

  async streamHtml(
    stream: ReadableStream<string>,
    options: StreamOptions = { position: 'cursor' }
  ): Promise<{ success: boolean; content: string }> {
    // For HTML, we accumulate and parse at end
    const isPreview = options.reviewOptions?.mode === 'preview';

    this.editor.view.dispatch(
      this.editor.state.tr.setMeta(aiToolkitPluginKey, { type: 'setStreaming', streaming: true })
    );

    let insertPos: number;
    if (options.position === 'cursor') {
      insertPos = this.editor.state.selection.from;
    } else if (options.position === 'selection') {
      insertPos = this.editor.state.selection.to;
    } else if (options.position === 'end') {
      insertPos = this.editor.state.doc.content.size;
    } else {
      insertPos = options.position;
    }

    const startPos = insertPos;
    let fullContent = '';

    try {
      const reader = stream.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullContent += typeof value === 'string' ? value : decoder.decode(value);
      }

      // Insert HTML content
      if (fullContent) {
        this.editor.chain()
          .insertContentAt(insertPos, fullContent)
          .run();

        const endPos = this.editor.state.selection.to;

        if (isPreview) {
          this.addChange({
            type: 'insert',
            from: startPos,
            to: endPos,
            newContent: fullContent,
            ruleId: 'ai-generation',
          });

          this.editor.view.dispatch(
            this.editor.state.tr.setMeta(aiToolkitPluginKey, {
              type: 'setReviewState',
              reviewState: { isReviewing: true, toolCallId: null, pendingOutput: fullContent },
            })
          );
        }
      }

      return { success: true, content: fullContent };
    } finally {
      this.editor.view.dispatch(
        this.editor.state.tr.setMeta(aiToolkitPluginKey, { type: 'setStreaming', streaming: false })
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Tool Execution
  // ---------------------------------------------------------------------------

  executeTool(options: {
    toolName: string;
    input: Record<string, unknown>;
    toolCallId?: string;
    reviewOptions?: ReviewOptions;
  }): ToolExecutionResult {
    const { toolName, input, toolCallId, reviewOptions } = options;
    const isPreview = reviewOptions?.mode === 'preview';

    // Start comparing if in preview mode
    if (isPreview) {
      this.startComparingDocuments();
    }

    const changes: AiChange[] = [];
    let docChanged = false;

    // Execute based on tool type
    switch (toolName) {
      case 'insertText':
      case 'insert': {
        const text = input['text'] as string;
        const position = (input['position'] as number) ?? this.editor.state.selection.from;

        this.editor.chain().insertContentAt(position, text).run();

        const changeId = this.addChange({
          type: 'insert',
          from: position,
          to: position + text.length,
          newContent: text,
          ruleId: 'ai-generation',
        });

        changes.push(this.getState()?.changes.get(changeId)!);
        docChanged = true;
        break;
      }

      case 'replaceText':
      case 'replace': {
        const text = input['text'] as string;
        const from = input['from'] as number;
        const to = input['to'] as number;
        const oldContent = this.editor.state.doc.textBetween(from, to);

        this.editor.chain().deleteRange({ from, to }).insertContentAt(from, text).run();

        const changeId = this.addChange({
          type: 'replace',
          from,
          to: from + text.length,
          newContent: text,
          oldContent,
          ruleId: 'ai-generation',
        });

        changes.push(this.getState()?.changes.get(changeId)!);
        docChanged = true;
        break;
      }

      case 'deleteText':
      case 'delete': {
        const from = input['from'] as number;
        const to = input['to'] as number;
        const oldContent = this.editor.state.doc.textBetween(from, to);

        if (!isPreview) {
          this.editor.chain().deleteRange({ from, to }).run();
        }

        const changeId = this.addChange({
          type: 'delete',
          from,
          to,
          oldContent,
          ruleId: 'ai-generation',
        });

        changes.push(this.getState()?.changes.get(changeId)!);
        docChanged = true;
        break;
      }
    }

    // Set review state if needed
    if (isPreview && docChanged) {
      this.editor.view.dispatch(
        this.editor.state.tr.setMeta(aiToolkitPluginKey, {
          type: 'setReviewState',
          reviewState: {
            isReviewing: true,
            toolCallId: toolCallId ?? null,
            pendingOutput: `Tool ${toolName} executed successfully`,
          },
        })
      );
    }

    return {
      success: true,
      output: `Tool ${toolName} executed successfully`,
      docChanged,
      changes,
    };
  }

  // ---------------------------------------------------------------------------
  // Review State
  // ---------------------------------------------------------------------------

  acceptToolCall(): void {
    this.acceptAllChanges();
    this.stopComparingDocuments();
    this.editor.view.dispatch(
      this.editor.state.tr.setMeta(aiToolkitPluginKey, {
        type: 'setReviewState',
        reviewState: { isReviewing: false, toolCallId: null, pendingOutput: null },
      })
    );
  }

  rejectToolCall(): void {
    this.rejectAllChanges();
    this.stopComparingDocuments();
    this.editor.view.dispatch(
      this.editor.state.tr.setMeta(aiToolkitPluginKey, {
        type: 'setReviewState',
        reviewState: { isReviewing: false, toolCallId: null, pendingOutput: null },
      })
    );
  }

  getReviewState(): AiToolkitState['reviewState'] {
    return this.getState()?.reviewState ?? {
      isReviewing: false,
      toolCallId: null,
      pendingOutput: null,
    };
  }

  // ---------------------------------------------------------------------------
  // Rules
  // ---------------------------------------------------------------------------

  setRules(rules: AiSuggestionRule[]): void {
    this.editor.view.dispatch(
      this.editor.state.tr.setMeta(aiToolkitPluginKey, { type: 'setRules', rules })
    );
  }

  getRules(): AiSuggestionRule[] {
    return this.getState()?.rules ?? [];
  }
}

// =============================================================================
// Get Toolkit Helper
// =============================================================================

const toolkitCache = new WeakMap<Editor, AiToolkit>();

export function getAiToolkit(editor: Editor): AiToolkit {
  let toolkit = toolkitCache.get(editor);
  if (!toolkit) {
    toolkit = new AiToolkit(editor);
    toolkitCache.set(editor, toolkit);
  }
  return toolkit;
}

// =============================================================================
// Extension
// =============================================================================

export interface AiToolkitOptions {
  rules?: AiSuggestionRule[];
  showChanges?: boolean;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    aiToolkit: {
      startTrackingAiChanges: (doc?: ProseMirrorNode) => ReturnType;
      stopTrackingAiChanges: () => ReturnType;
      acceptAiChange: (id: string) => ReturnType;
      rejectAiChange: (id: string) => ReturnType;
      acceptAllAiChanges: () => ReturnType;
      rejectAllAiChanges: () => ReturnType;
      selectAiChange: (id: string | null) => ReturnType;
      setShowAiChanges: (show: boolean) => ReturnType;
    };
  }
}

export const AiToolkitExtension = Extension.create<AiToolkitOptions>({
  name: 'aiToolkit',

  addOptions() {
    return {
      rules: DEFAULT_RULES,
      showChanges: true,
    };
  },

  addProseMirrorPlugins() {
    return [createAiToolkitPlugin(this.options.rules ?? DEFAULT_RULES)];
  },

  addCommands() {
    return {
      startTrackingAiChanges: (doc) => ({ editor }) => {
        const toolkit = getAiToolkit(editor);
        toolkit.startComparingDocuments({ otherDoc: doc });
        return true;
      },

      stopTrackingAiChanges: () => ({ editor }) => {
        const toolkit = getAiToolkit(editor);
        toolkit.stopComparingDocuments();
        return true;
      },

      acceptAiChange: (id) => ({ editor }) => {
        const toolkit = getAiToolkit(editor);
        toolkit.acceptChange(id);
        return true;
      },

      rejectAiChange: (id) => ({ editor }) => {
        const toolkit = getAiToolkit(editor);
        toolkit.rejectChange(id);
        return true;
      },

      acceptAllAiChanges: () => ({ editor }) => {
        const toolkit = getAiToolkit(editor);
        toolkit.acceptAllChanges();
        return true;
      },

      rejectAllAiChanges: () => ({ editor }) => {
        const toolkit = getAiToolkit(editor);
        toolkit.rejectAllChanges();
        return true;
      },

      selectAiChange: (id) => ({ editor }) => {
        const toolkit = getAiToolkit(editor);
        toolkit.selectChange(id);
        return true;
      },

      setShowAiChanges: (show) => ({ editor }) => {
        const toolkit = getAiToolkit(editor);
        toolkit.setShowChanges(show);
        return true;
      },
    };
  },

  onCreate() {
    // Listen for custom events
    const handleAccept = (e: Event) => {
      const id = (e as CustomEvent).detail?.id;
      if (id) getAiToolkit(this.editor).acceptChange(id);
    };

    const handleReject = (e: Event) => {
      const id = (e as CustomEvent).detail?.id;
      if (id) getAiToolkit(this.editor).rejectChange(id);
    };

    this.editor.view.dom.addEventListener('ai:acceptChange', handleAccept);
    this.editor.view.dom.addEventListener('ai:rejectChange', handleReject);

    // Store for cleanup
    (this.editor as unknown as { _aiToolkitHandlers: typeof handleAccept[] })._aiToolkitHandlers = [
      handleAccept,
      handleReject,
    ];
  },

  onDestroy() {
    const handlers = (this.editor as unknown as { _aiToolkitHandlers?: EventListener[] })._aiToolkitHandlers;
    if (handlers) {
      this.editor.view.dom.removeEventListener('ai:acceptChange', handlers[0]);
      this.editor.view.dom.removeEventListener('ai:rejectChange', handlers[1]);
    }
  },
});

export default AiToolkitExtension;
