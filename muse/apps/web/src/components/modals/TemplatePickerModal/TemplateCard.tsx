import type { ProjectTemplate } from "@mythos/core";
import { getTemplateIcon } from "../../../utils/templateIcons";

interface TemplateCardProps {
  template: ProjectTemplate;
  onClick: () => void;
}

// Category badge colors using mythos design tokens
const CATEGORY_COLORS: Record<string, string> = {
  fantasy: "bg-mythos-accent-purple/20 text-mythos-accent-purple",
  scifi: "bg-mythos-accent-cyan/20 text-mythos-accent-cyan",
  horror: "bg-mythos-accent-red/20 text-mythos-accent-red",
  literary: "bg-mythos-accent-amber/20 text-mythos-accent-amber",
  ttrpg: "bg-mythos-accent-green/20 text-mythos-accent-green",
  manga: "bg-mythos-accent-purple/20 text-mythos-accent-purple",
  visual: "bg-mythos-accent-cyan/20 text-mythos-accent-cyan",
  screenplay: "bg-mythos-accent-amber/20 text-mythos-accent-amber",
  serial: "bg-mythos-accent-purple/20 text-mythos-accent-purple",
  custom: "bg-mythos-text-muted/20 text-mythos-text-muted",
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
          {getTemplateIcon(template.icon)}
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
