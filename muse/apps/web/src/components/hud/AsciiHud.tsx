import type { Entity, Character, Item, Location, NarrativeThread } from "@mythos/core";
import { X, User, Sword, MapPin, Sparkles } from "lucide-react";
import { useMode } from "../../hooks/useMode";
import { useHudPosition } from "../../hooks/useHudPosition";

interface AsciiHudProps {
  entity: Entity;
  onClose: () => void;
  position?: { x: number; y: number } | null;
  /** Optional narrative threads for Writer mode */
  narrativeThreads?: NarrativeThread[];
}

// Type guards for entity types
function isCharacter(entity: Entity): entity is Character {
  return entity.type === "character";
}

function isItem(entity: Entity): entity is Item {
  return entity.type === "item";
}

function isLocation(entity: Entity): entity is Location {
  return entity.type === "location";
}

// Entity type icon component
function EntityIcon({ entity }: { entity: Entity }) {
  const className = "w-4 h-4";

  if (isCharacter(entity)) {
    return <User className={`${className} text-mythos-entity-character`} />;
  }
  if (isItem(entity)) {
    return <Sword className={`${className} text-mythos-entity-item`} />;
  }
  if (isLocation(entity)) {
    return <MapPin className={`${className} text-mythos-entity-location`} />;
  }
  return <Sparkles className={`${className} text-mythos-accent-cyan`} />;
}

// Character stats block for DM mode
function CharacterStatsBlock({ character }: { character: Character }) {
  return (
    <div className="space-y-2 text-xs">
      {/* Archetype */}
      {character.archetype && (
        <div className="flex justify-between">
          <span className="text-mythos-text-muted">Archetype:</span>
          <span className="text-mythos-accent-purple uppercase">
            {character.archetype.replace("_", " ")}
          </span>
        </div>
      )}

      {/* Status */}
      {character.status.health && (
        <div className="flex justify-between">
          <span className="text-mythos-text-muted">Status:</span>
          <span
            className={
              character.status.health === "healthy"
                ? "text-mythos-accent-green"
                : character.status.health === "dead"
                ? "text-mythos-accent-red"
                : "text-mythos-accent-amber"
            }
          >
            {character.status.health.toUpperCase()}
          </span>
        </div>
      )}

      {/* Mood */}
      {character.status.mood && (
        <div className="flex justify-between">
          <span className="text-mythos-text-muted">Mood:</span>
          <span className="text-mythos-text-secondary">{character.status.mood}</span>
        </div>
      )}

      {/* Location */}
      {character.status.location && (
        <div className="flex justify-between">
          <span className="text-mythos-text-muted">Location:</span>
          <span className="text-mythos-entity-location">{character.status.location}</span>
        </div>
      )}

      {/* Active Quest */}
      {character.status.activeQuest && (
        <div className="flex justify-between">
          <span className="text-mythos-text-muted">Quest:</span>
          <span className="text-mythos-text-secondary truncate max-w-[180px]">
            {character.status.activeQuest}
          </span>
        </div>
      )}

      {/* Traits */}
      {character.traits.length > 0 && (
        <div className="mt-3 pt-2 border-t border-mythos-border-default">
          <span className="text-mythos-text-muted block mb-1">Traits:</span>
          <div className="flex flex-wrap gap-1">
            {character.traits.map((trait, i) => (
              <span
                key={i}
                className={`px-1.5 py-0.5 rounded text-[10px] ${
                  trait.type === "strength"
                    ? "bg-mythos-accent-green/20 text-mythos-accent-green"
                    : trait.type === "weakness"
                    ? "bg-mythos-accent-red/20 text-mythos-accent-red"
                    : trait.type === "shadow"
                    ? "bg-mythos-accent-purple/20 text-mythos-accent-purple"
                    : "bg-mythos-bg-tertiary text-mythos-text-muted"
                }`}
              >
                {trait.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Visual Description snippet */}
      {character.visualDescription.eyeColor && (
        <div className="mt-3 pt-2 border-t border-mythos-border-default">
          <span className="text-mythos-text-muted block mb-1">Visual:</span>
          <span className="text-mythos-text-secondary text-[11px]">
            {[
              character.visualDescription.eyeColor &&
                `${character.visualDescription.eyeColor} eyes`,
              character.visualDescription.hairColor &&
                `${character.visualDescription.hairColor} hair`,
              character.visualDescription.build,
            ]
              .filter(Boolean)
              .join(", ")}
          </span>
        </div>
      )}
    </div>
  );
}

// Item stats block for DM mode
function ItemStatsBlock({ item }: { item: Item }) {
  return (
    <div className="space-y-2 text-xs">
      {/* Category */}
      <div className="flex justify-between">
        <span className="text-mythos-text-muted">Category:</span>
        <span className="text-mythos-accent-cyan uppercase">{item.category}</span>
      </div>

      {/* Rarity */}
      {item.rarity && (
        <div className="flex justify-between">
          <span className="text-mythos-text-muted">Rarity:</span>
          <span
            className={
              item.rarity === "legendary"
                ? "text-mythos-accent-amber"
                : item.rarity === "unique"
                ? "text-mythos-accent-purple"
                : item.rarity === "rare"
                ? "text-mythos-accent-cyan"
                : "text-mythos-text-secondary"
            }
          >
            {item.rarity.toUpperCase()}
          </span>
        </div>
      )}

      {/* Owner */}
      {item.owner && (
        <div className="flex justify-between">
          <span className="text-mythos-text-muted">Owner:</span>
          <span className="text-mythos-entity-character">{item.owner}</span>
        </div>
      )}

      {/* Location */}
      {item.location && (
        <div className="flex justify-between">
          <span className="text-mythos-text-muted">Location:</span>
          <span className="text-mythos-entity-location">{item.location}</span>
        </div>
      )}

      {/* Abilities */}
      {item.abilities && item.abilities.length > 0 && (
        <div className="mt-3 pt-2 border-t border-mythos-border-default">
          <span className="text-mythos-text-muted block mb-1">Abilities:</span>
          <ul className="space-y-1">
            {item.abilities.map((ability, i) => (
              <li key={i} className="text-mythos-text-secondary text-[11px]">
                - {ability}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Location stats block for DM mode
function LocationStatsBlock({ location }: { location: Location }) {
  return (
    <div className="space-y-2 text-xs">
      {/* Parent Location */}
      {location.parentLocation && (
        <div className="flex justify-between">
          <span className="text-mythos-text-muted">Part of:</span>
          <span className="text-mythos-entity-location">{location.parentLocation}</span>
        </div>
      )}

      {/* Climate */}
      {location.climate && (
        <div className="flex justify-between">
          <span className="text-mythos-text-muted">Climate:</span>
          <span className="text-mythos-text-secondary">{location.climate}</span>
        </div>
      )}

      {/* Atmosphere */}
      {location.atmosphere && (
        <div className="flex justify-between">
          <span className="text-mythos-text-muted">Atmosphere:</span>
          <span className="text-mythos-accent-purple">{location.atmosphere}</span>
        </div>
      )}

      {/* Inhabitants */}
      {location.inhabitants && location.inhabitants.length > 0 && (
        <div className="mt-3 pt-2 border-t border-mythos-border-default">
          <span className="text-mythos-text-muted block mb-1">
            Inhabitants ({location.inhabitants.length}):
          </span>
          <div className="flex flex-wrap gap-1">
            {location.inhabitants.slice(0, 5).map((inhabitant, i) => (
              <span
                key={i}
                className="px-1.5 py-0.5 rounded text-[10px] bg-mythos-bg-tertiary text-mythos-entity-character"
              >
                {inhabitant}
              </span>
            ))}
            {location.inhabitants.length > 5 && (
              <span className="px-1.5 py-0.5 text-[10px] text-mythos-text-muted">
                +{location.inhabitants.length - 5} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Connected Locations */}
      {location.connectedTo && location.connectedTo.length > 0 && (
        <div className="mt-3 pt-2 border-t border-mythos-border-default">
          <span className="text-mythos-text-muted block mb-1">Connected to:</span>
          <div className="flex flex-wrap gap-1">
            {location.connectedTo.slice(0, 4).map((connected, i) => (
              <span
                key={i}
                className="px-1.5 py-0.5 rounded text-[10px] bg-mythos-bg-tertiary text-mythos-entity-location"
              >
                {connected}
              </span>
            ))}
            {location.connectedTo.length > 4 && (
              <span className="px-1.5 py-0.5 text-[10px] text-mythos-text-muted">
                +{location.connectedTo.length - 4} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Narrative threads block for Writer mode
function NarrativeThreadsBlock({ threads }: { threads: NarrativeThread[] }) {
  if (threads.length === 0) {
    return (
      <div className="text-xs text-mythos-text-muted italic">
        No narrative threads connected yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {threads.map((thread) => (
        <div
          key={thread.id}
          className="p-2 rounded bg-mythos-bg-tertiary/50 border border-mythos-text-muted/10"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-mythos-accent-cyan">{thread.label}</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded ${
                thread.status === "active"
                  ? "bg-mythos-accent-green/20 text-mythos-accent-green"
                  : thread.status === "resolved"
                  ? "bg-mythos-text-muted/20 text-mythos-text-muted"
                  : "bg-mythos-accent-amber/20 text-mythos-accent-amber"
              }`}
            >
              {thread.status || "active"}
            </span>
          </div>
          <p className="text-[11px] text-mythos-text-secondary">{thread.description}</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-[10px] text-mythos-text-muted uppercase">{thread.type}</span>
            <span className="text-[10px] text-mythos-text-muted">|</span>
            <span className="text-[10px] text-mythos-text-muted">
              Importance: {thread.importance}/10
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function AsciiHud({ entity, onClose, position, narrativeThreads = [] }: AsciiHudProps) {
  const { isDM, isWriter } = useMode();

  // Calculate position ensuring HUD stays in viewport
  const calculatedPosition = useHudPosition({
    position: position ?? null,
    hudWidth: 320,
    hudHeight: 400,
  });

  const style = calculatedPosition
    ? {
        left: `${calculatedPosition.x}px`,
        top: `${calculatedPosition.y}px`,
      }
    : {};

  // Get entity type color
  const entityTypeColor = isCharacter(entity)
    ? "text-mythos-entity-character"
    : isItem(entity)
    ? "text-mythos-entity-item"
    : isLocation(entity)
    ? "text-mythos-entity-location"
    : "text-mythos-accent-cyan";

  return (
    <div
      className="ascii-hud fixed z-50 p-4 min-w-[280px] max-w-[360px] font-mono text-sm bg-mythos-bg-primary border border-mythos-accent-cyan/30 rounded-lg shadow-lg shadow-mythos-accent-cyan/10"
      style={style}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-mythos-accent-cyan/30 pb-2 mb-3">
        <div className="flex items-center gap-2">
          <EntityIcon entity={entity} />
          <span className={`font-bold ${entityTypeColor}`}>{entity.name}</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Mode indicator */}
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded ${
              isDM
                ? "bg-mythos-accent-green/20 text-mythos-accent-green"
                : "bg-mythos-accent-cyan/20 text-mythos-accent-cyan"
            }`}
          >
            {isDM ? "DM" : "WRITER"}
          </span>
          <button
            onClick={onClose}
            className="text-mythos-text-muted hover:text-mythos-text-primary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content based on mode */}
      <div className="max-h-[300px] overflow-y-auto scrollbar-thin">
        {/* DM Mode: Show stats */}
        {isDM && (
          <>
            {isCharacter(entity) && <CharacterStatsBlock character={entity} />}
            {isItem(entity) && <ItemStatsBlock item={entity} />}
            {isLocation(entity) && <LocationStatsBlock location={entity} />}
          </>
        )}

        {/* Writer Mode: Show narrative threads */}
        {isWriter && (
          <div className="space-y-3">
            <div className="text-xs text-mythos-text-muted uppercase tracking-wider">
              Narrative Threads
            </div>
            <NarrativeThreadsBlock threads={narrativeThreads} />

            {/* Also show a brief summary of the entity */}
            {entity.notes && (
              <div className="mt-3 pt-2 border-t border-mythos-border-default">
                <span className="text-xs text-mythos-text-muted block mb-1">Notes:</span>
                <p className="text-[11px] text-mythos-text-secondary">{entity.notes}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ASCII art border bottom */}
      <div className="mt-3 text-mythos-text-muted text-[10px] text-center select-none">
        ═══════════════════════════
      </div>
    </div>
  );
}
