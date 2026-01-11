import { Loader2, Sparkles, Wand2 } from "lucide-react";
import type { GenesisEntity, TemplateDraft } from "@mythos/agent-protocol";
import { TemplateDraftPreview } from "../TemplateDraftPreview";
import {
  PROJECT_TYPE_BLUEPRINTS,
  PROJECT_TYPE_DEFS,
  type ProjectType,
  type TemplateBuilderPhase,
} from "../projectTypes";

interface ProgressiveTemplatePreviewProps {
  projectType: ProjectType;
  phase: TemplateBuilderPhase;
  draft: TemplateDraft | null;
  starterEntities: GenesisEntity[];
  isGenerating: boolean;
  isReadyToGenerate: boolean;
  onUseTemplate: () => void;
  onCancel?: () => void;
  onRefine?: () => void;
}

function BlueprintSection({ title, items }: { title: string; items: string[] }): JSX.Element {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-mythos-text-muted mb-1">
        {title}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span
            key={item}
            className="px-2 py-0.5 rounded-full text-[10px] bg-mythos-bg-tertiary text-mythos-text-muted"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ProgressiveTemplatePreview({
  projectType,
  phase,
  draft,
  starterEntities,
  isGenerating,
  isReadyToGenerate,
  onUseTemplate,
  onCancel,
  onRefine,
}: ProgressiveTemplatePreviewProps): JSX.Element {
  if (draft) {
    return (
      <TemplateDraftPreview
        draft={draft}
        starterEntities={starterEntities}
        onAccept={onUseTemplate}
        onRefine={onRefine ?? (() => undefined)}
        onCancel={onCancel ?? (() => undefined)}
      />
    );
  }

  const blueprint = PROJECT_TYPE_BLUEPRINTS[projectType];
  const typeDef = PROJECT_TYPE_DEFS[projectType];
  let statusText = "Answer a few questions to shape the blueprint.";

  if (isGenerating) {
    statusText = "Generating your blueprint...";
  } else if (isReadyToGenerate) {
    statusText = "Ready to generate. Review the draft when it appears.";
  } else if (phase === "review") {
    statusText = "Draft available. Refine if needed.";
  }

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4">
        <div className="flex items-center gap-2 text-sm text-mythos-text-primary">
          <Sparkles className="w-4 h-4 text-mythos-accent-purple" />
          Blueprint Preview
        </div>
        <p className="text-xs text-mythos-text-muted mt-1">
          {typeDef.description}
        </p>
      </div>

      <div className="p-3 rounded-lg border border-mythos-border-default bg-mythos-bg-tertiary/40 mb-4">
        <div className="flex items-center gap-2 text-xs text-mythos-text-secondary">
          {isGenerating ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-mythos-accent-purple" />
          ) : (
            <Wand2 className="w-3.5 h-3.5 text-mythos-accent-purple" />
          )}
          {statusText}
        </div>
      </div>

      <div className="space-y-4">
        <BlueprintSection title="Focus" items={blueprint.focus} />
        <BlueprintSection title="Entities" items={blueprint.entities} />
        <BlueprintSection title="Relationships" items={blueprint.relationships} />
        <BlueprintSection title="Documents" items={blueprint.documents} />
      </div>
    </div>
  );
}
