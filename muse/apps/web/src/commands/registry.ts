import type { LucideIcon } from "lucide-react";
import type { Editor } from "@mythos/editor";
import type { useMythosStore } from "../stores";
import type { ModalState } from "../stores";
import type { UIModuleId } from "@mythos/state";

// Command categories
export type CommandCategory = "entity" | "ai" | "navigation" | "general";

// Command context passed to execute and when functions
export interface CommandContext {
  store: typeof useMythosStore;
  state: ReturnType<typeof useMythosStore.getState>;
  editor: Editor | null;
  selectedText: string | null;
  openModal: (modal: ModalState) => void;
  closeModal: () => void;
  setActiveTab: (tab: string) => void;
  setCanvasView: (view: "editor" | "worldGraph") => void;
}

// Command definition
export interface Command {
  id: string;
  label: string;
  description?: string;
  icon?: LucideIcon;
  category: CommandCategory;
  keywords: string[];
  shortcut?: string;
  /** Condition for when command is visible */
  when?: (ctx: CommandContext) => boolean;
  /** Execute the command */
  execute: (ctx: CommandContext) => void | Promise<void>;
  /** Required module for progressive disclosure (gardener mode) */
  requiredModule?: UIModuleId;
}

// ============================================================================
// Progressive Disclosure Helpers
// ============================================================================

/**
 * Get unlock hint for a module
 */
export function getUnlockHint(module: UIModuleId): string {
  switch (module) {
    case "manifest":
      return "Track entities in your story to unlock the Manifest";
    case "console":
      return "Resolve a consistency issue to unlock the Console";
    case "world_graph":
      return "Add 5+ characters to unlock the World Graph";
    case "timeline":
      return "Continue writing to unlock the Timeline";
    case "hud":
      return "Keep writing to unlock the HUD";
    case "entity_mentions":
      return "Track entities to unlock mentions";
    default:
      return "Keep writing to unlock this feature";
  }
}

/**
 * Command registry for managing all available commands
 */
class CommandRegistry {
  private commands: Map<string, Command> = new Map();

  /**
   * Register a single command
   */
  register(command: Command): void {
    if (this.commands.has(command.id)) {
      console.warn(`Command "${command.id}" is already registered, overwriting.`);
    }
    this.commands.set(command.id, command);
  }

  /**
   * Register multiple commands at once
   */
  registerMany(commands: Command[]): void {
    for (const command of commands) {
      this.register(command);
    }
  }

  /**
   * Unregister a command
   */
  unregister(id: string): boolean {
    return this.commands.delete(id);
  }

  /**
   * Get a command by ID
   */
  get(id: string): Command | undefined {
    return this.commands.get(id);
  }

  /**
   * Get all commands, optionally filtered by visibility
   */
  list(ctx?: CommandContext): Command[] {
    const all = Array.from(this.commands.values());
    if (!ctx) return all;
    return all.filter((cmd) => !cmd.when || cmd.when(ctx));
  }

  /**
   * Get commands by category
   */
  byCategory(ctx: CommandContext, category: CommandCategory): Command[] {
    return this.list(ctx).filter((cmd) => cmd.category === category);
  }

  /**
   * Search commands by query (fuzzy match on label, description, keywords)
   */
  search(query: string, ctx?: CommandContext): Command[] {
    const normalizedQuery = query.toLowerCase().trim();
    if (!normalizedQuery) return this.list(ctx);

    return this.list(ctx).filter((cmd) => {
      const searchable = [
        cmd.label,
        cmd.description ?? "",
        ...cmd.keywords,
      ]
        .join(" ")
        .toLowerCase();
      return searchable.includes(normalizedQuery);
    });
  }

  /**
   * Get all registered command IDs
   */
  getAllIds(): string[] {
    return Array.from(this.commands.keys());
  }

  /**
   * Clear all registered commands
   */
  clear(): void {
    this.commands.clear();
  }
}

// Singleton instance
export const commandRegistry = new CommandRegistry();
