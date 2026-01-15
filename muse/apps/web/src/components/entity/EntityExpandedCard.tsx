/**
 * EntityExpandedCard - Full expanded entity card with tabs
 *
 * Design: Matches ArtifactPanel's refined aesthetic with iteration chat.
 * Tabs: Overview, Graph, Mentions
 */

import { useState, useMemo, useRef, useEffect } from "react";
import {
  User,
  MapPin,
  Sword,
  Zap,
  Users,
  Sparkles,
  X,
  Network,
  MessageSquare,
  FileText,
  ExternalLink,
  ChevronRight,
  Send,
} from "lucide-react";
import { Button, ScrollArea, cn } from "@mythos/ui";
import { entity as entityColors, entityExtended, bg } from "@mythos/theme";
import type {
  EntityData,
  EntityType,
  EntityRelationship,
  EntityMention,
} from "./EntityFloatingCard";

// ============================================================================
// Types
// ============================================================================

export interface EntityExpandedCardProps {
  entity: EntityData;
  onClose?: () => void;
  onOpenGraph?: (entity: EntityData) => void;
  onNavigateToEntity?: (entityId: string) => void;
  onNavigateToDocument?: (documentId: string) => void;
  className?: string;
}

type TabId = "overview" | "graph" | "mentions";

interface IterationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

// ============================================================================
// Entity Color Config
// ============================================================================

function getEntityColor(type: EntityType): string {
  const colorMap: Record<EntityType, string> = {
    character: entityColors.character,
    location: entityColors.location,
    item: entityColors.item,
    magic_system: entityColors.magic,
    faction: entityExtended.faction,
    event: entityExtended.event,
    concept: entityExtended.concept,
  };
  return colorMap[type] ?? "#64748b";
}

function getEntityIcon(type: EntityType) {
  const iconMap: Record<EntityType, typeof User> = {
    character: User,
    location: MapPin,
    item: Sword,
    magic_system: Zap,
    faction: Users,
    event: Sparkles,
    concept: Sparkles,
  };
  return iconMap[type] ?? Sparkles;
}

// ============================================================================
// Tab Components
// ============================================================================

function OverviewTab({ entity }: { entity: EntityData }) {
  const properties = entity.properties ?? {};
  const propertyEntries = Object.entries(properties);

  return (
    <div className="p-4 space-y-5">
      {/* Notes */}
      {entity.notes && (
        <div>
          <h4 className="text-[10px] font-medium text-mythos-text-muted uppercase tracking-wider mb-2">
            Notes
          </h4>
          <div className="p-3 rounded-lg bg-mythos-bg-tertiary/50 border border-mythos-border-default/50">
            <p className="text-sm text-mythos-text-secondary leading-relaxed">
              {entity.notes}
            </p>
          </div>
        </div>
      )}

      {/* Aliases */}
      {entity.aliases && entity.aliases.length > 0 && (
        <div>
          <h4 className="text-[10px] font-medium text-mythos-text-muted uppercase tracking-wider mb-2">
            Also known as
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {entity.aliases.map((alias, i) => (
              <span
                key={i}
                className="px-2 py-1 text-xs rounded-md bg-mythos-bg-tertiary border border-mythos-border-default/50 text-mythos-text-secondary"
              >
                {alias}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Properties Grid */}
      {propertyEntries.length > 0 && (
        <div>
          <h4 className="text-[10px] font-medium text-mythos-text-muted uppercase tracking-wider mb-2">
            Properties
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {propertyEntries.map(([key, value]) => (
              <div
                key={key}
                className="p-2.5 rounded-lg border border-mythos-border-default bg-mythos-bg-tertiary/30"
              >
                <span className="block text-[10px] text-mythos-text-muted capitalize">
                  {key}
                </span>
                <span className="block text-sm font-medium text-mythos-text-primary mt-0.5">
                  {String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!entity.notes && propertyEntries.length === 0 && (
        <div className="text-center py-8">
          <FileText className="w-8 h-8 text-mythos-text-muted/30 mx-auto mb-2" />
          <p className="text-sm text-mythos-text-muted">No details added yet</p>
        </div>
      )}
    </div>
  );
}

function GraphTab({
  entity,
  onNavigateToEntity,
  onOpenGraph,
}: {
  entity: EntityData;
  onNavigateToEntity?: (entityId: string) => void;
  onOpenGraph?: (entity: EntityData) => void;
}) {
  const relationships = entity.relationships ?? [];
  const entityColor = getEntityColor(entity.type);

  // Group by relationship type
  const grouped = useMemo(() => {
    const g: Record<string, EntityRelationship[]> = {};
    relationships.forEach((rel) => {
      if (!g[rel.relationshipType]) g[rel.relationshipType] = [];
      g[rel.relationshipType].push(rel);
    });
    return g;
  }, [relationships]);

  if (relationships.length === 0) {
    return (
      <div className="p-4">
        <div className="text-center py-8">
          <Network className="w-8 h-8 text-mythos-text-muted/30 mx-auto mb-2" />
          <p className="text-sm text-mythos-text-muted">No relationships yet</p>
          <Button variant="outline" size="sm" className="mt-3 gap-1.5 text-xs">
            <Sparkles className="w-3 h-3" />
            Suggest connections
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Mini visualization */}
      <div className="relative h-24 flex items-center justify-center">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center z-10"
          style={{
            backgroundColor: `${entityColor}20`,
            border: `2px solid ${entityColor}`,
          }}
        >
          {(() => {
            const Icon = getEntityIcon(entity.type);
            return <Icon className="w-6 h-6" style={{ color: entityColor }} />;
          })()}
        </div>
        {/* Orbiting nodes */}
        {relationships.slice(0, 4).map((rel, i) => {
          const angle = (i * 90 - 45) * (Math.PI / 180);
          const radius = 50;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          const targetColor = getEntityColor(rel.targetType);
          const TargetIcon = getEntityIcon(rel.targetType);

          return (
            <button
              key={rel.id}
              onClick={() => onNavigateToEntity?.(rel.targetId)}
              className="absolute w-7 h-7 rounded-md flex items-center justify-center transition-transform hover:scale-110"
              style={{
                transform: `translate(${x}px, ${y}px)`,
                backgroundColor: `${targetColor}15`,
                border: `1px solid ${targetColor}40`,
              }}
            >
              <TargetIcon className="w-3.5 h-3.5" style={{ color: targetColor }} />
            </button>
          );
        })}
      </div>

      {/* Relationship list */}
      {Object.entries(grouped).map(([type, rels]) => (
        <div key={type}>
          <h4 className="text-[10px] font-medium text-mythos-text-muted uppercase tracking-wider mb-2 capitalize">
            {type}
          </h4>
          <div className="space-y-1">
            {rels.map((rel) => {
              const targetColor = getEntityColor(rel.targetType);
              const TargetIcon = getEntityIcon(rel.targetType);

              return (
                <button
                  key={rel.id}
                  onClick={() => onNavigateToEntity?.(rel.targetId)}
                  className="w-full flex items-center gap-2.5 p-2 rounded-lg border border-mythos-border-default hover:border-mythos-accent-primary/40 hover:bg-mythos-bg-tertiary transition-all text-left group"
                >
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: `${targetColor}15`,
                    }}
                  >
                    <TargetIcon className="w-3.5 h-3.5" style={{ color: targetColor }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-mythos-text-primary truncate">
                      {rel.targetName}
                    </span>
                    <span className="block text-[11px] text-mythos-text-muted capitalize">
                      {rel.targetType.replace("_", " ")}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-mythos-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Open full graph */}
      <button
        onClick={() => onOpenGraph?.(entity)}
        className="w-full flex items-center justify-center gap-2 p-2.5 rounded-lg border border-dashed border-mythos-border-default hover:border-mythos-text-muted hover:bg-mythos-bg-tertiary/50 transition-colors text-xs text-mythos-text-muted"
      >
        <ExternalLink className="w-3.5 h-3.5" />
        Open full graph in panel
      </button>
    </div>
  );
}

function MentionsTab({
  entity,
  onNavigateToDocument,
}: {
  entity: EntityData;
  onNavigateToDocument?: (documentId: string) => void;
}) {
  const mentions = entity.mentions ?? [];

  if (mentions.length === 0) {
    return (
      <div className="p-4">
        <div className="text-center py-8">
          <MessageSquare className="w-8 h-8 text-mythos-text-muted/30 mx-auto mb-2" />
          <p className="text-sm text-mythos-text-muted">No mentions found</p>
          <p className="text-xs text-mythos-text-muted/70 mt-1">
            This entity hasn't been referenced yet
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-2">
      {mentions.map((mention) => (
        <button
          key={mention.id}
          onClick={() => onNavigateToDocument?.(mention.id)}
          className="w-full text-left p-3 rounded-lg border border-mythos-border-default hover:border-mythos-accent-primary/40 hover:bg-mythos-bg-tertiary transition-all"
        >
          <div className="flex items-center gap-2 mb-1.5">
            <FileText className="w-3.5 h-3.5 text-mythos-accent-primary" />
            <span className="text-sm font-medium text-mythos-text-primary truncate">
              {mention.documentTitle}
            </span>
          </div>
          <p className="text-xs text-mythos-text-secondary line-clamp-2 leading-relaxed">
            {mention.excerpt}
          </p>
          <span className="text-[10px] text-mythos-text-muted mt-2 block">
            {formatTimeAgo(mention.timestamp)}
          </span>
        </button>
      ))}
    </div>
  );
}

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

// ============================================================================
// Main Component
// ============================================================================

const TABS: { id: TabId; label: string; icon: typeof FileText }[] = [
  { id: "overview", label: "Overview", icon: FileText },
  { id: "graph", label: "Graph", icon: Network },
  { id: "mentions", label: "Mentions", icon: MessageSquare },
];

export function EntityExpandedCard({
  entity,
  onClose,
  onOpenGraph,
  onNavigateToEntity,
  onNavigateToDocument,
  className,
}: EntityExpandedCardProps) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [iterationInput, setIterationInput] = useState("");
  const [iterationHistory, setIterationHistory] = useState<IterationMessage[]>([]);
  const [inputExpanded, setInputExpanded] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);

  const entityColor = getEntityColor(entity.type);
  const EntityIcon = getEntityIcon(entity.type);
  const isExpanded = inputExpanded || iterationInput.trim().length > 0;

  const relationshipCount = entity.relationships?.length ?? 0;
  const mentionCount = entity.mentions?.length ?? 0;

  // Scroll iteration history
  useEffect(() => {
    if (iterationHistory.length && historyRef.current) {
      setTimeout(() => {
        historyRef.current?.scrollTo({
          top: historyRef.current.scrollHeight,
          behavior: "smooth",
        });
      }, 100);
    }
  }, [iterationHistory.length]);

  const handleIterationSubmit = () => {
    if (!iterationInput.trim()) return;

    const userMessage: IterationMessage = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: iterationInput.trim(),
      timestamp: Date.now(),
    };

    setIterationHistory((prev) => [...prev, userMessage]);
    setIterationInput("");

    // Mock AI response
    setTimeout(() => {
      const aiMessage: IterationMessage = {
        id: `msg_${Date.now()}_ai`,
        role: "assistant",
        content: `I'll help refine "${entity.name}" based on your request. This is a placeholder response.`,
        timestamp: Date.now(),
      };
      setIterationHistory((prev) => [...prev, aiMessage]);
    }, 500);
  };

  return (
    <div
      className={cn(
        "h-full flex flex-col bg-mythos-bg-primary rounded-xl border border-mythos-border-default overflow-hidden",
        className
      )}
      style={{
        boxShadow: `0 0 0 1px rgba(0,0,0,0.03), 0 8px 32px -8px rgba(0,0,0,0.3)`,
      }}
    >
      {/* Header */}
      <div className="flex items-start gap-3 p-4 border-b border-mythos-border-default">
        {/* Avatar */}
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
          style={{
            backgroundColor: `${entityColor}18`,
            border: `1px solid ${entityColor}30`,
          }}
        >
          <EntityIcon className="w-6 h-6" style={{ color: entityColor }} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-mythos-text-primary truncate">
            {entity.name}
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="px-1.5 py-0.5 text-[10px] font-medium rounded capitalize"
              style={{
                backgroundColor: `${entityColor}20`,
                color: entityColor,
              }}
            >
              {entity.type.replace("_", " ")}
            </span>
            {entity.aliases && entity.aliases.length > 0 && (
              <span className="text-xs text-mythos-text-muted truncate">
                aka {entity.aliases[0]}
                {entity.aliases.length > 1 && ` +${entity.aliases.length - 1}`}
              </span>
            )}
          </div>
        </div>

        {/* Close */}
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-mythos-bg-tertiary text-mythos-text-muted hover:text-mythos-text-secondary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-mythos-border-default">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const count =
            tab.id === "graph"
              ? relationshipCount
              : tab.id === "mentions"
              ? mentionCount
              : null;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium border-b-2 transition-colors -mb-px",
                isActive
                  ? "border-current text-mythos-text-primary"
                  : "border-transparent text-mythos-text-muted hover:text-mythos-text-secondary"
              )}
              style={isActive ? { borderColor: entityColor, color: entityColor } : {}}
            >
              <tab.icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {count !== null && count > 0 && (
                <span
                  className={cn(
                    "px-1.5 py-0.5 text-[10px] rounded-full",
                    isActive ? "bg-current/20" : "bg-mythos-bg-tertiary"
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        {activeTab === "overview" && <OverviewTab entity={entity} />}
        {activeTab === "graph" && (
          <GraphTab
            entity={entity}
            onNavigateToEntity={onNavigateToEntity}
            onOpenGraph={onOpenGraph}
          />
        )}
        {activeTab === "mentions" && (
          <MentionsTab entity={entity} onNavigateToDocument={onNavigateToDocument} />
        )}
      </ScrollArea>

      {/* Iteration Chat */}
      <div className="p-3 border-t border-mythos-border-default">
        {/* History */}
        {iterationHistory.length > 0 && (
          <div className="relative max-h-24 mb-2">
            <div
              ref={historyRef}
              className="overflow-y-auto max-h-24 flex flex-col justify-end"
            >
              {iterationHistory.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "text-[11px] px-2.5 py-1.5 rounded-lg mb-1 leading-relaxed",
                    msg.role === "user"
                      ? "bg-mythos-bg-tertiary/60 ml-6"
                      : "bg-mythos-accent-primary/10"
                  )}
                >
                  {msg.content}
                </div>
              ))}
            </div>
            <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-mythos-bg-primary to-transparent pointer-events-none" />
          </div>
        )}

        {/* Input */}
        <div className="flex justify-center">
          <div
            className={cn(
              "overflow-hidden cursor-text transition-all duration-150",
              isExpanded ? "rounded-xl w-full" : "rounded-full w-3/4 min-w-[140px]",
              iterationInput.trim() ? "ring-1 ring-mythos-accent-primary" : ""
            )}
            style={{ backgroundColor: bg.hover }}
            onClick={() => {
              if (!isExpanded) {
                setInputExpanded(true);
                setTimeout(() => inputRef.current?.focus(), 50);
              }
            }}
          >
            {!isExpanded && (
              <div className="flex items-center justify-between px-4 py-2.5 hover:opacity-80 transition-opacity">
                <span className="text-xs text-mythos-text-muted">Refine entity...</span>
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${entityColor}20` }}
                >
                  <Send className="w-3 h-3" style={{ color: entityColor }} />
                </div>
              </div>
            )}

            {isExpanded && (
              <>
                <textarea
                  ref={inputRef}
                  value={iterationInput}
                  onChange={(e) => setIterationInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleIterationSubmit();
                    }
                    if (e.key === "Escape" && !iterationInput.trim()) {
                      setInputExpanded(false);
                      inputRef.current?.blur();
                    }
                  }}
                  onBlur={() => {
                    if (!iterationInput.trim()) {
                      setTimeout(() => setInputExpanded(false), 150);
                    }
                  }}
                  placeholder="Add fear of betrayal, expand backstory..."
                  className="w-full bg-transparent text-xs text-mythos-text-primary placeholder:text-mythos-text-muted resize-none h-14 outline-none leading-relaxed px-3 pt-2.5"
                />
                <div className="flex items-center justify-end px-2 pb-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleIterationSubmit();
                    }}
                    disabled={!iterationInput.trim()}
                    className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center transition-colors",
                      iterationInput.trim()
                        ? "text-white"
                        : "bg-mythos-bg-tertiary text-mythos-text-muted"
                    )}
                    style={
                      iterationInput.trim()
                        ? { backgroundColor: entityColor }
                        : undefined
                    }
                  >
                    <Send className="w-3 h-3" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Mock Data
// ============================================================================

export const MOCK_ELENA_FULL: EntityData = {
  id: "entity_elena",
  name: "Elena Blackwood",
  type: "character",
  aliases: ["The Shadow Walker", "Lady E", "Nightblade"],
  notes:
    "A skilled tracker from the Northern Reaches. She carries a mysterious blade that glows in the presence of dark magic. Her past is shrouded in mystery, but she is fiercely loyal to those who earn her trust. She learned her tracking skills from the monks of the Silent Order before their monastery was destroyed.",
  properties: {
    occupation: "Bounty Hunter",
    status: "Active",
    age: 28,
    affiliation: "The Silver Order",
  },
  relationships: [
    {
      id: "rel_1",
      targetId: "marcus",
      targetName: "Marcus Thorne",
      targetType: "character",
      relationshipType: "ally",
    },
    {
      id: "rel_2",
      targetId: "shadowfell",
      targetName: "The Shadowfell",
      targetType: "location",
      relationshipType: "origin",
    },
    {
      id: "rel_3",
      targetId: "moonblade",
      targetName: "Moonblade",
      targetType: "item",
      relationshipType: "owns",
    },
    {
      id: "rel_4",
      targetId: "varen",
      targetName: "Lord Varen",
      targetType: "character",
      relationshipType: "enemy",
    },
  ],
  mentions: [
    {
      id: "m1",
      documentTitle: "Chapter 3: The Hunt Begins",
      excerpt: "Elena crouched in the shadows, her blade humming softly as the darkness deepened around her...",
      timestamp: Date.now() - 86400000,
    },
    {
      id: "m2",
      documentTitle: "Chapter 7: Revelations",
      excerpt:
        '"You don\'t understand," Elena said, her voice barely above a whisper. "The blade chose me."',
      timestamp: Date.now() - 172800000,
    },
    {
      id: "m3",
      documentTitle: "Worldbuilding Notes",
      excerpt: "Elena's backstory connects to the Fall of the Northern Reaches during the Shadow War.",
      timestamp: Date.now() - 259200000,
    },
  ],
};

export default EntityExpandedCard;
