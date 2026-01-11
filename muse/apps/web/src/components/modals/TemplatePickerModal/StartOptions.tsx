import type { LucideIcon } from "lucide-react";
import { Button } from "@mythos/ui";
import { PROJECT_TYPE_DEFS, PROJECT_TYPE_ORDER, type AccentKey, type ProjectType } from "./projectTypes";

interface StartOptionsProps {
  projectType: ProjectType | null;
  onSelectProjectType: (projectType: ProjectType) => void;
  onStartAI: () => void;
  onStartBlank: () => void;
}

// Static accent styles lookup - Tailwind JIT requires complete class names
const ACCENT_STYLES: Record<
  AccentKey,
  {
    border: string;
    hover: string;
    selected: string;
    iconBg: string;
    icon: string;
  }
> = {
  purple: {
    border: "border-mythos-accent-purple/30",
    hover: "hover:border-mythos-accent-purple/60 hover:bg-mythos-accent-purple/5",
    selected: "border-mythos-accent-purple bg-mythos-accent-purple/10",
    iconBg: "bg-mythos-accent-purple/10",
    icon: "text-mythos-accent-purple",
  },
  green: {
    border: "border-mythos-accent-green/30",
    hover: "hover:border-mythos-accent-green/60 hover:bg-mythos-accent-green/5",
    selected: "border-mythos-accent-green bg-mythos-accent-green/10",
    iconBg: "bg-mythos-accent-green/10",
    icon: "text-mythos-accent-green",
  },
  amber: {
    border: "border-mythos-accent-amber/30",
    hover: "hover:border-mythos-accent-amber/60 hover:bg-mythos-accent-amber/5",
    selected: "border-mythos-accent-amber bg-mythos-accent-amber/10",
    iconBg: "bg-mythos-accent-amber/10",
    icon: "text-mythos-accent-amber",
  },
  orange: {
    border: "border-mythos-accent-orange/30",
    hover: "hover:border-mythos-accent-orange/60 hover:bg-mythos-accent-orange/5",
    selected: "border-mythos-accent-orange bg-mythos-accent-orange/10",
    iconBg: "bg-mythos-accent-orange/10",
    icon: "text-mythos-accent-orange",
  },
  pink: {
    border: "border-mythos-accent-pink/30",
    hover: "hover:border-mythos-accent-pink/60 hover:bg-mythos-accent-pink/5",
    selected: "border-mythos-accent-pink bg-mythos-accent-pink/10",
    iconBg: "bg-mythos-accent-pink/10",
    icon: "text-mythos-accent-pink",
  },
  yellow: {
    border: "border-mythos-accent-yellow/30",
    hover: "hover:border-mythos-accent-yellow/60 hover:bg-mythos-accent-yellow/5",
    selected: "border-mythos-accent-yellow bg-mythos-accent-yellow/10",
    iconBg: "bg-mythos-accent-yellow/10",
    icon: "text-mythos-accent-yellow",
  },
};

interface OptionCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  accent: AccentKey;
  isSelected: boolean;
  onClick: () => void;
}

function OptionCard({
  icon: Icon,
  title,
  description,
  accent,
  isSelected,
  onClick,
}: OptionCardProps): JSX.Element {
  const styles = ACCENT_STYLES[accent];

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isSelected}
      className={`relative p-4 rounded-lg border-2 transition-all text-left w-full group ${
        isSelected ? styles.selected : `${styles.border} ${styles.hover}`
      }`}
    >
      <div className="flex items-start gap-4">
        <div className={`p-2.5 rounded-lg ${styles.iconBg}`}>
          <Icon className={`w-5 h-5 ${styles.icon}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-mythos-text-primary mb-1">
            {title}
          </h3>
          <p className="text-sm text-mythos-text-muted leading-relaxed">
            {description}
          </p>
        </div>
      </div>
    </button>
  );
}

export function StartOptions({
  projectType,
  onSelectProjectType,
  onStartAI,
  onStartBlank,
}: StartOptionsProps): JSX.Element {
  const canProceed = projectType !== null;

  return (
    <div className="space-y-6">
      <p className="text-mythos-text-secondary text-sm">
        Select a project type to shape the blueprint and onboarding flow.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {PROJECT_TYPE_ORDER.map((type) => {
          const def = PROJECT_TYPE_DEFS[type];
          return (
            <OptionCard
              key={type}
              icon={def.icon}
              title={def.label}
              description={def.description}
              accent={def.accent}
              isSelected={projectType === type}
              onClick={() => onSelectProjectType(type)}
            />
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Button onClick={onStartAI} disabled={!canProceed} className="flex-1">
          Create with AI
        </Button>
        <Button variant="outline" onClick={onStartBlank} disabled={!canProceed} className="flex-1">
          Start from scratch
        </Button>
      </div>

      {!canProceed && (
        <p className="text-xs text-mythos-text-muted text-center">
          Choose a project type to continue.
        </p>
      )}

      <p className="text-xs text-mythos-text-muted text-center pt-2">
        You can always customize your project structure later in Settings.
      </p>
    </div>
  );
}
