import type { ProjectTemplate } from "@mythos/core";
import type { LucideIcon } from "lucide-react";
import * as LucideIcons from "lucide-react";

interface TemplateCardProps {
  template: ProjectTemplate;
  onClick: () => void;
}

// Get Lucide icon by name
function getIcon(iconName: string): React.ReactNode {
  const icons = LucideIcons as unknown as Record<string, LucideIcon>;
  const Icon = icons[iconName];
  if (Icon) {
    return <Icon className="w-5 h-5" />;
  }
  return <LucideIcons.FileText className="w-5 h-5" />;
}

// Category badge colors
const CATEGORY_COLORS: Record<string, string> = {
  fantasy: "bg-purple-500/20 text-purple-400",
  scifi: "bg-cyan-500/20 text-cyan-400",
  horror: "bg-red-500/20 text-red-400",
  literary: "bg-amber-500/20 text-amber-400",
  ttrpg: "bg-green-500/20 text-green-400",
  manga: "bg-pink-500/20 text-pink-400",
  visual: "bg-blue-500/20 text-blue-400",
  screenplay: "bg-orange-500/20 text-orange-400",
  serial: "bg-indigo-500/20 text-indigo-400",
  custom: "bg-gray-500/20 text-gray-400",
};

export function TemplateCard({ template, onClick }: TemplateCardProps) {
  const entityCount = template.entityKinds.length;
  const relationshipCount = template.relationshipKinds.length;

  return (
    <button
      type="button"
      onClick={onClick}
      className="p-4 rounded-lg border border-mythos-text-muted/20 hover:border-mythos-accent-cyan/50
        hover:bg-mythos-accent-cyan/5 transition-all text-left group"
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="p-2 rounded-lg bg-mythos-text-muted/10 group-hover:bg-mythos-accent-cyan/10 text-mythos-text-muted group-hover:text-mythos-accent-cyan transition-colors">
          {getIcon(template.icon)}
        </div>

        <div className="flex-1 min-w-0">
          {/* Title & Category */}
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-mythos-text-primary truncate">
              {template.name}
            </h3>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${CATEGORY_COLORS[template.category] || CATEGORY_COLORS["custom"]}`}>
              {template.category}
            </span>
          </div>

          {/* Description */}
          <p className="text-xs text-mythos-text-muted line-clamp-2 mb-2">
            {template.description}
          </p>

          {/* Stats */}
          <div className="flex items-center gap-3 text-[10px] text-mythos-text-muted">
            <span>{entityCount} entity types</span>
            <span className="text-mythos-text-muted/50">|</span>
            <span>{relationshipCount} relationships</span>
          </div>
        </div>
      </div>
    </button>
  );
}
