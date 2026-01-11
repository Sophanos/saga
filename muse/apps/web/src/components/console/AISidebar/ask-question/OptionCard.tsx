import { Check } from "lucide-react";
import { cn } from "@mythos/ui";
import type { QuestionOption } from "@mythos/agent-protocol";

interface OptionCardProps {
  option: QuestionOption;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}

export function OptionCard({ option, index, isSelected, onSelect, disabled }: OptionCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        "w-full text-left p-3 rounded-lg border transition-colors",
        isSelected
          ? "border-mythos-accent-purple bg-mythos-accent-purple/5"
          : "border-mythos-border-default hover:border-mythos-accent-purple/50",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Number badge */}
        <span
          className={cn(
            "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium",
            isSelected
              ? "bg-mythos-accent-purple text-white"
              : "bg-mythos-bg-tertiary text-mythos-text-muted"
          )}
        >
          {index + 1}
        </span>

        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-mythos-text-primary">{option.label}</div>
          {option.description && (
            <div className="text-xs text-mythos-text-muted mt-0.5 line-clamp-2">
              {option.description}
            </div>
          )}
        </div>

        {/* Selection indicator */}
        {isSelected && <Check className="w-4 h-4 text-mythos-accent-purple flex-shrink-0" />}
      </div>
    </button>
  );
}
