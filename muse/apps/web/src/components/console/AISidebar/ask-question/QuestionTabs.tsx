import { Check, ChevronRight } from "lucide-react";
import { cn } from "@mythos/ui";
import type { ResearchQuestion, QuestionAnswer } from "@mythos/agent-protocol";

interface QuestionTabsProps {
  questions: ResearchQuestion[];
  activeId: string;
  answers: Record<string, QuestionAnswer>;
  onSelect: (id: string) => void;
}

export function QuestionTabs({ questions, activeId, answers, onSelect }: QuestionTabsProps) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-thin">
      {questions.map((q) => {
        const isActive = q.id === activeId;
        const isAnswered = answers[q.id]?.answer && !answers[q.id]?.skipped;
        const isSkipped = answers[q.id]?.skipped;

        return (
          <button
            key={q.id}
            type="button"
            onClick={() => onSelect(q.id)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md whitespace-nowrap",
              "transition-colors border",
              isActive
                ? "bg-mythos-accent-purple/10 border-mythos-accent-purple/30 text-mythos-text-primary"
                : "bg-transparent border-transparent text-mythos-text-muted hover:text-mythos-text-secondary"
            )}
          >
            {isAnswered && <Check className="w-3 h-3 text-mythos-accent-green" />}
            {isSkipped && <span className="w-3 h-3 text-mythos-text-muted">-</span>}
            <span>{q.tabLabel || q.question.slice(0, 15) + (q.question.length > 15 ? "..." : "")}</span>
          </button>
        );
      })}

      {/* Submit pseudo-tab indicator */}
      <div className="ml-auto pl-2 border-l border-mythos-border-default flex items-center gap-1 text-mythos-text-muted">
        <ChevronRight className="w-3 h-3" />
        <span className="text-xs">Submit</span>
      </div>
    </div>
  );
}
