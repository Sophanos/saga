import * as Icons from "lucide-react";
import type { LucideIcon } from "lucide-react";

export function resolveLucideIcon(name?: string): LucideIcon {
  const iconMap = Icons as unknown as Record<string, LucideIcon>;
  if (name && iconMap[name]) {
    return iconMap[name];
  }
  return Icons.Circle;
}
