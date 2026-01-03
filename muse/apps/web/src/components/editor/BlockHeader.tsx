import type { ReactNode } from "react";
import { cn } from "@mythos/ui";

interface BlockHeaderProps {
  title: string;
  icon?: ReactNode;
  count?: number;
  actions?: ReactNode;
  className?: string;
}

export function BlockHeader({
  title,
  icon,
  count,
  actions,
  className,
}: BlockHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between gap-2", className)}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-mythos-text-muted">
        {icon}
        <span>{title}</span>
        {typeof count === "number" && (
          <span className="rounded-full bg-mythos-bg-tertiary px-2 py-0.5 text-[10px] text-mythos-text-muted">
            {count}
          </span>
        )}
      </div>
      {actions && <div className="flex items-center gap-1">{actions}</div>}
    </div>
  );
}
