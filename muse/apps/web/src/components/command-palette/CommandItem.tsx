import { Command as CmdkCommand } from "cmdk";
import { Lock } from "lucide-react";
import { cn } from "@mythos/ui";
import type { Command } from "../../commands";

interface CommandItemProps {
  command: Command;
  onSelect: () => void;
  /** Whether the command is locked (progressive disclosure) */
  isLocked?: boolean;
  /** Hint for unlocking this command */
  unlockHint?: string;
}

export function CommandItem({ command, onSelect, isLocked, unlockHint }: CommandItemProps) {
  const Icon = command.icon;

  return (
    <CmdkCommand.Item
      value={`${command.id} ${command.label} ${command.keywords.join(" ")}`}
      onSelect={onSelect}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer",
        "text-mythos-text-secondary",
        "data-[selected=true]:bg-mythos-bg-tertiary",
        "data-[selected=true]:text-mythos-text-primary",
        "outline-none",
        isLocked && "opacity-50 cursor-not-allowed"
      )}
      title={isLocked ? unlockHint : undefined}
    >
      {Icon && (
        <div className={cn(
          "w-8 h-8 rounded-md bg-mythos-bg-tertiary flex items-center justify-center shrink-0",
          isLocked && "bg-mythos-bg-tertiary/50"
        )}>
          <Icon className="w-4 h-4 text-mythos-text-muted" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{command.label}</div>
        {isLocked && unlockHint ? (
          <div className="text-xs text-mythos-accent-amber/80 truncate">
            {unlockHint}
          </div>
        ) : command.description ? (
          <div className="text-xs text-mythos-text-muted truncate">
            {command.description}
          </div>
        ) : null}
      </div>
      {isLocked ? (
        <Lock className="w-4 h-4 text-mythos-text-muted/50" />
      ) : (
        <div className="flex items-center gap-2">
          {command.requiresSelection && (
            <span className="px-2 py-1 text-[10px] uppercase tracking-wide rounded border border-mythos-border-default text-mythos-text-muted">
              Selection
            </span>
          )}
          {command.shortcut ? (
            <kbd className="px-2 py-1 text-[10px] font-mono bg-mythos-bg-primary/50 text-mythos-text-muted rounded border border-mythos-border-default">
              {command.shortcut}
            </kbd>
          ) : null}
        </div>
      )}
    </CmdkCommand.Item>
  );
}
