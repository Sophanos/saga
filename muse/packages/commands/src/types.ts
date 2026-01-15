/**
 * Command palette types
 */

export type CommandCategory = 'entity' | 'ai' | 'navigation' | 'general' | 'graph' | 'widget';

export interface CommandContext {
  projectId: string | null;
  hasSelection: boolean;
  /** Optional: the selected text content */
  selectedText?: string;
  /** Optional: selection range in the editor */
  selectionRange?: { from: number; to: number };
  /** Optional: current document ID */
  documentId?: string;
}

export interface Command {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  category: CommandCategory;
  keywords: string[];
  shortcut?: string;
  /** Whether command requires text selection */
  requiresSelection?: boolean;
  when?: (ctx: CommandContext) => boolean;
  execute: () => void | Promise<void>;
}

export type CommandFilter = 'all' | CommandCategory;
