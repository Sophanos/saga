/**
 * Command registry - manages all available commands
 */

import type { Command, CommandCategory, CommandContext } from './types';

interface CachedCommand extends Command {
  _searchCache: string;
}

function buildSearchCache(cmd: Command): string {
  return [cmd.label, cmd.description ?? '', ...cmd.keywords].join(' ').toLowerCase();
}

export class CommandRegistry {
  private commands: Map<string, CachedCommand> = new Map();

  register(command: Command): void {
    const cached: CachedCommand = {
      ...command,
      _searchCache: buildSearchCache(command),
    };
    this.commands.set(command.id, cached);
  }

  registerMany(commands: Command[]): void {
    commands.forEach((cmd) => this.register(cmd));
  }

  unregister(id: string): void {
    this.commands.delete(id);
  }

  get(id: string): Command | undefined {
    return this.commands.get(id);
  }

  list(ctx?: CommandContext): Command[] {
    const all = Array.from(this.commands.values());
    if (!ctx) return all;
    return all.filter((cmd) => !cmd.when || cmd.when(ctx));
  }

  byCategory(category: CommandCategory, ctx?: CommandContext): Command[] {
    return this.list(ctx).filter((cmd) => cmd.category === category);
  }

  search(query: string, ctx?: CommandContext): Command[] {
    const q = query.toLowerCase().trim();
    if (!q) return this.list(ctx);
    return this.list(ctx).filter((cmd) => {
      const cached = cmd as CachedCommand;
      return cached._searchCache.includes(q);
    });
  }

  clear(): void {
    this.commands.clear();
  }
}

export const commandRegistry = new CommandRegistry();
