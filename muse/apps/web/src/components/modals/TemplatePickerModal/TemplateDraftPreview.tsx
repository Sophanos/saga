import { Check, RefreshCw, X, Users, MapPin, Box, Zap, Link2, FileText, ShieldCheck } from "lucide-react";
import { Button, ScrollArea, cn } from "@mythos/ui";
import type { TemplateDraft, GenesisEntity } from "@mythos/agent-protocol";

interface TemplateDraftPreviewProps {
  draft: TemplateDraft;
  starterEntities?: GenesisEntity[];
  onAccept: () => void;
  onRefine: () => void;
  onCancel: () => void;
}

const CATEGORY_ICONS: Record<string, typeof Users> = {
  agent: Users,
  place: MapPin,
  object: Box,
  system: Zap,
  organization: Users,
  temporal: FileText,
  abstract: FileText,
};

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Users;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-mythos-text-muted" />
        <h4 className="text-xs font-medium text-mythos-text-secondary uppercase tracking-wide">
          {title}
        </h4>
      </div>
      {children}
    </div>
  );
}

export function TemplateDraftPreview({
  draft,
  starterEntities,
  onAccept,
  onRefine,
  onCancel,
}: TemplateDraftPreviewProps) {
  return (
    <div className="flex flex-col h-[60vh]">
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-lg font-medium text-mythos-text-primary">{draft.name}</h3>
        <p className="text-sm text-mythos-text-secondary mt-1">{draft.description}</p>
        <div className="flex flex-wrap gap-1.5 mt-2">
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-mythos-accent-purple/20 text-mythos-accent-purple">
            {draft.category}
          </span>
          {draft.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded-full text-[10px] bg-mythos-bg-tertiary text-mythos-text-muted"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="pr-2">
          {/* Entity Kinds */}
          <Section title={`Entity Types (${draft.entityKinds.length})`} icon={Users}>
            <div className="grid grid-cols-2 gap-2">
              {draft.entityKinds.map((ek) => {
                const Icon = CATEGORY_ICONS[ek.category] ?? Box;
                return (
                  <div
                    key={ek.kind}
                    className="flex items-center gap-2 px-2 py-1.5 rounded bg-mythos-bg-tertiary"
                  >
                    <div
                      className="w-6 h-6 rounded flex items-center justify-center"
                      style={{ backgroundColor: `${ek.color}20` }}
                    >
                      <Icon className="w-3.5 h-3.5" style={{ color: ek.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-mythos-text-primary truncate">
                        {ek.label}
                      </div>
                      <div className="text-[10px] text-mythos-text-muted">
                        {ek.fields.length} fields
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>

          {/* Relationship Kinds */}
          <Section title={`Relationships (${draft.relationshipKinds.length})`} icon={Link2}>
            <div className="flex flex-wrap gap-1.5">
              {draft.relationshipKinds.map((rk) => (
                <span
                  key={rk.kind}
                  className="px-2 py-1 rounded text-xs bg-mythos-bg-tertiary text-mythos-text-secondary"
                >
                  {rk.label}
                </span>
              ))}
            </div>
          </Section>

          {/* Linter Rules */}
          {draft.linterRules.length > 0 && (
            <Section title={`Linter Rules (${draft.linterRules.length})`} icon={ShieldCheck}>
              <div className="space-y-1">
                {draft.linterRules.slice(0, 5).map((lr) => (
                  <div
                    key={lr.id}
                    className="flex items-start gap-2 px-2 py-1.5 rounded bg-mythos-bg-tertiary"
                  >
                    <span
                      className={cn(
                        "mt-0.5 w-1.5 h-1.5 rounded-full shrink-0",
                        lr.defaultSeverity === "error" && "bg-red-500",
                        lr.defaultSeverity === "warning" && "bg-yellow-500",
                        lr.defaultSeverity === "info" && "bg-blue-500"
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-mythos-text-primary">{lr.label}</div>
                      <div className="text-[10px] text-mythos-text-muted line-clamp-1">
                        {lr.description}
                      </div>
                    </div>
                  </div>
                ))}
                {draft.linterRules.length > 5 && (
                  <div className="text-[10px] text-mythos-text-muted pl-2">
                    +{draft.linterRules.length - 5} more rules
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Starter Entities */}
          {starterEntities && starterEntities.length > 0 && (
            <Section title={`Starter Entities (${starterEntities.length})`} icon={Box}>
              <div className="space-y-1">
                {starterEntities.slice(0, 5).map((se) => (
                  <div
                    key={se.tempId}
                    className="flex items-center gap-2 px-2 py-1.5 rounded bg-mythos-bg-tertiary"
                  >
                    <span className="text-xs text-mythos-text-primary">{se.name}</span>
                    <span className="text-[10px] text-mythos-text-muted capitalize">
                      {se.type}
                    </span>
                  </div>
                ))}
                {starterEntities.length > 5 && (
                  <div className="text-[10px] text-mythos-text-muted pl-2">
                    +{starterEntities.length - 5} more entities
                  </div>
                )}
              </div>
            </Section>
          )}
        </div>
      </ScrollArea>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-mythos-text-muted/20 mt-4">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="w-3.5 h-3.5 mr-1.5" />
          Cancel
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onRefine}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Refine
          </Button>
          <Button size="sm" onClick={onAccept}>
            <Check className="w-3.5 h-3.5 mr-1.5" />
            Use Template
          </Button>
        </div>
      </div>
    </div>
  );
}
