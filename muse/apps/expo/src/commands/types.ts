/**
 * Command palette types
 */

import type { ComponentType } from 'react';

export type CommandCategory = 'entity' | 'ai' | 'navigation' | 'general';

export interface CommandContext {
  projectId: string | null;
  hasSelection: boolean;
  // Add more context as needed
}

export interface Command {
  id: string;
  label: string;
  description?: string;
  icon?: string; // Feather icon name
  category: CommandCategory;
  keywords: string[];
  shortcut?: string;
  when?: (ctx: CommandContext) => boolean;
  execute: () => void | Promise<void>;
}

export type CommandFilter = 'all' | CommandCategory;
