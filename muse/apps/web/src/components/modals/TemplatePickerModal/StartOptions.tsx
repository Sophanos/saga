import { Sparkles, LayoutGrid, Feather } from "lucide-react";

interface StartOptionsProps {
  onStartBlank: () => void;
  onBrowseTemplates: () => void;
  onAIBuilder: () => void;
}

// Static accent styles lookup - Tailwind JIT requires complete class names
const ACCENT_STYLES = {
  purple: {
    hover: "hover:border-mythos-accent-purple/50 hover:bg-mythos-accent-purple/5",
    iconBg: "group-hover:bg-mythos-accent-purple/10",
  },
  cyan: {
    hover: "hover:border-mythos-accent-primary/50 hover:bg-mythos-accent-primary/5",
    iconBg: "group-hover:bg-mythos-accent-primary/10",
  },
  green: {
    hover: "hover:border-mythos-accent-green/50 hover:bg-mythos-accent-green/5",
    iconBg: "group-hover:bg-mythos-accent-green/10",
  },
} as const;

type AccentKey = keyof typeof ACCENT_STYLES;

interface OptionCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  accent: AccentKey;
  onClick: () => void;
  badge?: string;
}

function OptionCard({ icon, title, description, accent, onClick, badge }: OptionCardProps) {
  const styles = ACCENT_STYLES[accent];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative p-5 rounded-lg border-2 transition-all text-left w-full
        border-mythos-text-muted/30 ${styles.hover} group`}
    >
      {badge && (
        <span className="absolute top-3 right-3 text-[10px] font-medium px-1.5 py-0.5 rounded bg-mythos-accent-purple/20 text-mythos-accent-purple">
          {badge}
        </span>
      )}
      <div className="flex items-start gap-4">
        <div
          className={`p-2.5 rounded-lg bg-mythos-text-muted/10 ${styles.iconBg}`}
        >
          {icon}
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
  onStartBlank,
  onBrowseTemplates,
  onAIBuilder,
}: StartOptionsProps) {
  return (
    <div className="space-y-6">
      <p className="text-mythos-text-secondary text-sm">
        How would you like to start your project?
      </p>

      <div className="space-y-3">
        {/* AI Builder */}
        <OptionCard
          icon={<Sparkles className="w-5 h-5 text-mythos-accent-purple" />}
          title="Create with AI"
          description="Describe your story idea and let AI generate a custom template with entity types, relationships, and structure tailored to your vision."
          accent="purple"
          onClick={onAIBuilder}
        />

        {/* Browse Templates */}
        <OptionCard
          icon={<LayoutGrid className="w-5 h-5 text-mythos-accent-primary" />}
          title="Browse Templates"
          description="Choose from 14 genre-specific templates like Epic Fantasy, Sci-Fi, TTRPG Campaigns, Manga, Screenplays, and more."
          accent="cyan"
          onClick={onBrowseTemplates}
        />

        {/* Start Blank (Gardener) */}
        <OptionCard
          icon={<Feather className="w-5 h-5 text-mythos-accent-green" />}
          title="Start Blank"
          description="Begin with a minimal setup and discover your world as you write. Perfect for gardeners who prefer organic development."
          accent="green"
          onClick={onStartBlank}
        />
      </div>

      <p className="text-xs text-mythos-text-muted text-center pt-2">
        You can always customize your project structure later in Settings.
      </p>
    </div>
  );
}
