import {
  Sparkles,
  User,
  GitBranch,
  AlertTriangle,
  BookOpen,
  Lightbulb,
  ScanSearch,
  LayoutTemplate,
  Eye,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@mythos/ui";

interface QuickAction {
  id: string;
  label: string;
  icon: LucideIcon;
  requiresSelection?: boolean;
  prompt: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "describe",
    label: "Describe",
    icon: Sparkles,
    requiresSelection: true,
    prompt: "Describe what's happening in the selected text in vivid detail.",
  },
  {
    id: "detect-entities",
    label: "Detect Entities",
    icon: ScanSearch,
    prompt: "Analyze the current document and detect all characters, locations, items, and other story elements that should be tracked as entities.",
  },
  {
    id: "create-character",
    label: "Create Character",
    icon: User,
    prompt: "Help me create a new character based on the current story context. Ask me about their role, personality, and appearance.",
  },
  {
    id: "suggest-relationships",
    label: "Relationships",
    icon: GitBranch,
    prompt: "Analyze the entities in my story and suggest potential relationships between them. Consider family ties, alliances, rivalries, and romantic connections.",
  },
  {
    id: "check-consistency",
    label: "Consistency",
    icon: AlertTriangle,
    prompt: "Check the current document for contradictions, plot holes, and timeline issues. Look for inconsistencies in character details and world-building.",
  },
  {
    id: "backstory",
    label: "Backstory",
    icon: BookOpen,
    requiresSelection: true,
    prompt: "Generate a compelling backstory for the character or element in the selected text.",
  },
  {
    id: "build-world",
    label: "Build World",
    icon: LayoutTemplate,
    prompt: "Help me expand my story world. Generate entities, relationships, and story structure based on what I've written so far.",
  },
  {
    id: "brainstorm",
    label: "Next Steps",
    icon: Lightbulb,
    prompt: "Based on the current story, suggest 3-5 possible directions for what could happen next. Consider character arcs, plot tension, and thematic elements.",
  },
  {
    id: "clarity-check",
    label: "Clarity Check",
    icon: Eye,
    prompt: "Run a clarity_check on the current document. Flag ambiguous pronouns, unclear antecedents, clichés, filler/weasel words, and dangling modifiers. Include readability metrics.",
  },
];

interface QuickActionsProps {
  hasSelection: boolean;
  onAction: (prompt: string) => void;
  className?: string;
}

export function QuickActions({
  hasSelection,
  onAction,
  className,
}: QuickActionsProps) {
  const availableActions = QUICK_ACTIONS.filter(
    (action) => !action.requiresSelection || hasSelection
  );

  return (
    <div className={cn("px-3 py-2", className)}>
      <div className="text-[10px] font-medium text-mythos-text-muted uppercase tracking-wider mb-2">
        Quick Actions
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {availableActions.map((action) => (
          <button
            key={action.id}
            onClick={() => onAction(action.prompt)}
            className={cn(
              "flex items-center gap-2 px-2.5 py-2 rounded-lg text-left",
              "bg-mythos-bg-tertiary/50 hover:bg-mythos-bg-tertiary",
              "text-xs text-mythos-text-secondary hover:text-mythos-text-primary",
              "transition-colors border border-mythos-text-muted/10"
            )}
          >
            <action.icon className="w-3.5 h-3.5 text-mythos-accent-purple shrink-0" />
            <span className="truncate">{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
