import { Sparkles } from "lucide-react";

interface PromptSuggestionsProps {
  onSelect: (prompt: string) => void;
  disabled?: boolean;
}

const SUGGESTIONS = [
  {
    label: "Noir detective",
    prompt: "A noir detective story with supernatural elements, set in a rain-soaked 1940s city where magic lurks in the shadows",
  },
  {
    label: "Space opera",
    prompt: "A space opera with warring factions, ancient alien artifacts, and a ragtag crew caught in the middle",
  },
  {
    label: "Cozy fantasy",
    prompt: "A cozy fantasy with a found family running a magical bakery in a small village",
  },
  {
    label: "TTRPG campaign",
    prompt: "A TTRPG campaign setting in a post-apocalyptic world where magic returned after the collapse",
  },
];

export function PromptSuggestions({ onSelect, disabled }: PromptSuggestionsProps) {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-4">
      <div className="w-12 h-12 rounded-full bg-mythos-accent-purple/20 flex items-center justify-center mb-4">
        <Sparkles className="w-6 h-6 text-mythos-accent-purple" />
      </div>
      <h3 className="text-sm font-medium text-mythos-text-primary mb-2">
        Describe your story
      </h3>
      <p className="text-xs text-mythos-text-muted text-center mb-6 max-w-[280px]">
        Tell me about your story idea and I&apos;ll create a custom template with entity types, relationships, and structure.
      </p>

      <div className="w-full space-y-2">
        <p className="text-[10px] text-mythos-text-muted uppercase tracking-wide mb-2">
          Try one of these
        </p>
        {SUGGESTIONS.map((s) => (
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
    </div>
  );
}
