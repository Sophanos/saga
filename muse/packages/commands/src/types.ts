/**
 * Command palette types
 */

export type CommandCategory = 'entity' | 'ai' | 'navigation' | 'general';

export interface CommandContext {
  projectId: string | null;
  hasSelection: boolean;
}

export interface Command {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  category: CommandCategory;
  keywords: string[];
  shortcut?: string;
  when?: (ctx: CommandContext) => boolean;
  execute: () => void | Promise<void>;
}

export type CommandFilter = 'all' | CommandCategory;
