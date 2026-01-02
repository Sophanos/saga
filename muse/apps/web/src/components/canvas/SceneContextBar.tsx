import { Users, Activity, Cloud } from "lucide-react";
import type { Entity } from "@mythos/core";
import { EntityAvatar } from "./EntityAvatar";

interface SceneContextBarProps {
  /** Array of entities present in the current scene */
  entities: Entity[];
  /** Current tension level (0-100) */
  tension: number;
  /** Current scene mood */
  mood: string;
  /** Callback when an entity avatar is clicked */
  onEntityClick?: (entity: Entity) => void;
}

/**
 * Get the color class for tension level
 */
function getTensionColor(tension: number): string {
  if (tension >= 80) return "bg-mythos-accent-red";
  if (tension >= 60) return "bg-mythos-accent-amber";
  if (tension >= 40) return "bg-mythos-accent-primary";
  if (tension >= 20) return "bg-mythos-accent-green";
  return "bg-mythos-text-muted";
}

/**
 * Get the text color class for tension level
 */
function getTensionTextColor(tension: number): string {
  if (tension >= 80) return "text-mythos-accent-red";
  if (tension >= 60) return "text-mythos-accent-amber";
  if (tension >= 40) return "text-mythos-accent-primary";
  if (tension >= 20) return "text-mythos-accent-green";
  return "text-mythos-text-muted";
}

/**
 * Get descriptive tension label
 */
function getTensionLabel(tension: number): string {
  if (tension >= 80) return "Critical";
  if (tension >= 60) return "High";
  if (tension >= 40) return "Rising";
  if (tension >= 20) return "Calm";
  return "Tranquil";
}

/**
 * Get mood icon color
 */
function getMoodColor(mood: string): string {
  const lowerMood = mood.toLowerCase();
  if (
    lowerMood.includes("tense") ||
    lowerMood.includes("ominous") ||
    lowerMood.includes("dark")
  ) {
    return "text-mythos-accent-red";
  }
  if (
    lowerMood.includes("hopeful") ||
    lowerMood.includes("bright") ||
    lowerMood.includes("joyful")
  ) {
    return "text-mythos-accent-green";
  }
  if (
    lowerMood.includes("mysterious") ||
    lowerMood.includes("curious") ||
    lowerMood.includes("wonder")
  ) {
    return "text-mythos-accent-purple";
  }
  if (
    lowerMood.includes("calm") ||
    lowerMood.includes("peaceful") ||
    lowerMood.includes("serene")
  ) {
    return "text-mythos-accent-primary";
  }
  return "text-mythos-text-secondary";
}

/**
 * SceneContextBar - A horizontal bar showing current scene context
 *
 * Displays:
 * - Cast badges: Characters/entities present in the current scene with small avatars
 * - Tension indicator: Visual bar showing current tension level (0-100)
 * - Mood indicator: Current scene mood with icon
 *
 * Sits between the Header and the main workspace.
 */
export function SceneContextBar({
  entities,
  tension,
  mood,
  onEntityClick,
}: SceneContextBarProps) {
  const tensionColor = getTensionColor(tension);
  const tensionTextColor = getTensionTextColor(tension);
  const tensionLabel = getTensionLabel(tension);
  const moodColor = getMoodColor(mood);

  // Limit displayed entities to prevent overflow
  const displayedEntities = entities.slice(0, 8);
  const remainingCount = entities.length - displayedEntities.length;

  return (
    <div className="h-10 px-4 border-b border-mythos-border-default bg-mythos-bg-secondary/50 flex items-center gap-6">
      {/* Cast Section */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-mythos-text-muted">
          <Users className="w-3.5 h-3.5" />
          <span className="text-xs font-medium uppercase tracking-wide">Cast</span>
        </div>

        {entities.length > 0 ? (
          <div className="flex items-center gap-1 ml-2">
            {displayedEntities.map((entity) => (
              <EntityAvatar
                key={entity.id}
                entity={entity}
                size="sm"
                onClick={onEntityClick}
              />
            ))}
            {remainingCount > 0 && (
              <span className="text-xs text-mythos-text-muted ml-1">
                +{remainingCount}
              </span>
            )}
          </div>
        ) : (
          <span className="text-xs text-mythos-text-muted italic ml-2">
            No entities
          </span>
        )}
      </div>

      {/* Divider */}
      <div className="w-px h-5 bg-mythos-text-muted/20" />

      {/* Tension Section */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-mythos-text-muted">
          <Activity className="w-3.5 h-3.5" />
          <span className="text-xs font-medium uppercase tracking-wide">Tension</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Tension Bar */}
          <div className="w-24 h-2 bg-mythos-bg-tertiary rounded-full overflow-hidden">
            <div
              className={`h-full ${tensionColor} transition-all duration-300 rounded-full`}
              style={{ width: `${Math.min(100, Math.max(0, tension))}%` }}
            />
          </div>

          {/* Tension Value & Label */}
          <span className={`text-xs font-mono ${tensionTextColor}`}>
            {tension}
          </span>
          <span className="text-xs text-mythos-text-muted">
            ({tensionLabel})
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="w-px h-5 bg-mythos-text-muted/20" />

      {/* Mood Section */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-mythos-text-muted">
          <Cloud className="w-3.5 h-3.5" />
          <span className="text-xs font-medium uppercase tracking-wide">Mood</span>
        </div>

        <span className={`text-sm font-medium capitalize ${moodColor}`}>
          {mood || "Neutral"}
        </span>
      </div>
    </div>
  );
}
