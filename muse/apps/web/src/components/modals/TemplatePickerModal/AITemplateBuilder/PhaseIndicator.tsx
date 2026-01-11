import { CheckCircle2, Circle } from "lucide-react";
import { cn } from "@mythos/ui";
import { PROJECT_TYPE_DEFS, type ProjectType, type TemplateBuilderPhase } from "../projectTypes";

interface PhaseIndicatorProps {
  phase: TemplateBuilderPhase;
  projectType: ProjectType;
}

const PHASES: Array<{ id: TemplateBuilderPhase; label: string; description: string }> = [
  {
    id: "discovery",
    label: "Discovery",
    description: "Capture goals and constraints",
  },
  {
    id: "generate",
    label: "Generate",
    description: "Shape the blueprint",
  },
  {
    id: "review",
    label: "Review",
    description: "Inspect and refine",
  },
  {
    id: "done",
    label: "Ready",
    description: "Template confirmed",
  },
];

export function PhaseIndicator({ phase, projectType }: PhaseIndicatorProps): JSX.Element {
  const currentIndex = PHASES.findIndex((step) => step.id === phase);
  const activeLabel = PHASES[currentIndex]?.label ?? "Discovery";
  const typeLabel = PROJECT_TYPE_DEFS[projectType].label;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-mythos-text-muted">
            Blueprint
          </div>
          <div className="text-sm font-medium text-mythos-text-primary">{typeLabel}</div>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-mythos-bg-tertiary text-mythos-text-muted">
          {activeLabel}
        </span>
      </div>

      <div className="space-y-2">
        {PHASES.map((step, index) => {
          const isActive = index === currentIndex;
          const isComplete = index < currentIndex;
          let icon = <Circle className="w-3.5 h-3.5 text-mythos-text-muted" />;
          if (isComplete) {
            icon = <CheckCircle2 className="w-3.5 h-3.5 text-mythos-accent-green" />;
          }
          if (isActive) {
            icon = <Circle className="w-3.5 h-3.5 text-mythos-accent-purple" />;
          }

          return (
            <div key={step.id} className="flex items-start gap-2">
              <div className="mt-0.5">{icon}</div>
              <div>
                <div
                  className={cn(
                    "text-xs font-medium",
                    isActive && "text-mythos-text-primary",
                    !isActive && "text-mythos-text-secondary"
                  )}
                >
                  {step.label}
                </div>
                <div className="text-[10px] text-mythos-text-muted">{step.description}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
