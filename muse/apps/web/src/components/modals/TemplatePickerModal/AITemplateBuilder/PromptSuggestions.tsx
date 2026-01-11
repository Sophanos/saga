import { Sparkles } from "lucide-react";
import {
  DOMAIN_QUESTIONS,
  DOMAIN_SUGGESTIONS,
  PROJECT_TYPE_DEFS,
  type ProjectType,
} from "../projectTypes";

interface PromptSuggestionsProps {
  projectType: ProjectType;
  onSelect: (prompt: string) => void;
  disabled?: boolean;
}

export function PromptSuggestions({
  projectType,
  onSelect,
  disabled,
}: PromptSuggestionsProps): JSX.Element {
  const typeDef = PROJECT_TYPE_DEFS[projectType];
  const suggestions = DOMAIN_SUGGESTIONS[projectType];
  const questions = DOMAIN_QUESTIONS[projectType];

  return (
    <div className="flex flex-col items-center justify-center py-8 px-4">
      <div className="w-12 h-12 rounded-full bg-mythos-accent-purple/20 flex items-center justify-center mb-4">
        <Sparkles className="w-6 h-6 text-mythos-accent-purple" />
      </div>
      <h3 className="text-sm font-medium text-mythos-text-primary mb-2">
        Describe your {typeDef.label.toLowerCase()}
      </h3>
      <p className="text-xs text-mythos-text-muted text-center mb-6 max-w-[280px]">
        Share your idea and I&apos;ll build a domain-specific blueprint with entities,
        relationships, and structure.
      </p>

      <div className="w-full space-y-2">
        <p className="text-[10px] text-mythos-text-muted uppercase tracking-wide mb-2">
          Try one of these
        </p>
        {suggestions.map((s) => (
          <button
            key={s.label}
            onClick={() => onSelect(s.prompt)}
            disabled={disabled}
            className="w-full text-left px-3 py-2 rounded-lg text-sm
              bg-mythos-bg-tertiary hover:bg-mythos-accent-purple/10
              text-mythos-text-secondary hover:text-mythos-text-primary
              border border-transparent hover:border-mythos-accent-purple/30
              transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="w-full mt-6">
        <p className="text-[10px] text-mythos-text-muted uppercase tracking-wide mb-2">
          We will ask about
        </p>
        <div className="flex flex-wrap gap-1.5">
          {questions.slice(0, 4).map((q) => (
            <span
              key={q.id}
              className="px-2 py-0.5 rounded-full text-[10px] bg-mythos-bg-tertiary text-mythos-text-muted"
            >
              {q.question}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
