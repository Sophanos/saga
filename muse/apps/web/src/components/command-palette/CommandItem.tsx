import { Command as CmdkCommand } from "cmdk";
import { cn } from "@mythos/ui";
import type { Command } from "../../commands";

interface CommandItemProps {
  command: Command;
  onSelect: () => void;
}

export function CommandItem({ command, onSelect }: CommandItemProps) {
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
        "outline-none"
      )}
    >
      {Icon && (
        <div className="w-8 h-8 rounded-md bg-mythos-bg-tertiary flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-mythos-text-muted" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{command.label}</div>
        {command.description && (
          <div className="text-xs text-mythos-text-muted truncate">
            {command.description}
          </div>
        )}
      </div>
      {command.shortcut && (
        <kbd className="px-2 py-1 text-[10px] font-mono bg-mythos-bg-primary/50 text-mythos-text-muted rounded border border-mythos-text-muted/20">
          {command.shortcut}
        </kbd>
      )}
    </CmdkCommand.Item>
  );
}
