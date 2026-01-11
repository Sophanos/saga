import * as Icons from "lucide-react";
import type { LucideIcon } from "lucide-react";

export function resolveLucideIcon(name?: string): LucideIcon {
  if (name && (Icons as Record<string, LucideIcon>)[name]) {
    return (Icons as Record<string, LucideIcon>)[name];
  }
  return Icons.Circle;
}
