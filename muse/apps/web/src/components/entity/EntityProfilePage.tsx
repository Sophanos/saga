/**
 * EntityProfilePage - Universal Entity Profile
 *
 * Placeholder-first implementation for testing UI before backend wiring.
 * Spec: docs/UNIVERSAL_ENTITY_PROFILE.md
 */

import { useState, useMemo } from "react";
import {
  ArrowLeft,
  User,
  MapPin,
  Sword,
  FileText,
  History,
  MoreHorizontal,
  Pencil,
  Trash2,
  Copy,
  Image as ImageIcon,
  Link2,
  Sparkles,
  MessageSquare,
  Network,
} from "lucide-react";
import {
  Button,
  ScrollArea,
  cn,
} from "@mythos/ui";
import { resolveLucideIcon } from "../../utils/iconResolver";

// ============================================================================
// Mock Data (placeholder until backend wiring)
// ============================================================================

interface MockEntity {
  id: string;
  name: string;
  type: string;
  aliases: string[];
  notes: string;
  iconName?: string;
  color?: string;
  fictional: boolean;
  properties: Record<string, string | number | boolean>;
  imageUrl?: string;
  relationships: MockRelationship[];
  mentions: MockMention[];
  history: MockHistoryEntry[];
}

interface MockRelationship {
  id: string;
  targetId: string;
  targetName: string;
  targetType: string;
  relationshipType: string;
  direction: "outgoing" | "incoming";
}

interface MockMention {
  id: string;
  documentTitle: string;
  excerpt: string;
  timestamp: number;
}

interface MockHistoryEntry {
  id: string;
  action: "created" | "updated" | "relationship_added";
  field?: string;
  oldValue?: string;
  newValue?: string;
  timestamp: number;
  source: "user" | "ai";
}

const MOCK_ENTITY: MockEntity = {
  id: "entity_001",
  name: "Elena Blackwood",
  type: "character",
  aliases: ["The Shadow Walker", "Lady E"],
  notes: "A skilled tracker from the Northern Reaches. She carries a mysterious blade that glows in the presence of dark magic. Her past is shrouded in mystery, but she is fiercely loyal to those who earn her trust.",
  iconName: "User",
  color: "#8b5cf6",
  fictional: true,
  imageUrl: undefined,
  properties: {
    age: 28,
    occupation: "Bounty Hunter",
    affiliation: "The Silver Order",
    status: "Active",
  },
  relationships: [
    { id: "rel_1", targetId: "e2", targetName: "Marcus Thorne", targetType: "character", relationshipType: "ally", direction: "outgoing" },
    { id: "rel_2", targetId: "e3", targetName: "The Shadowfell", targetType: "location", relationshipType: "origin", direction: "outgoing" },
    { id: "rel_3", targetId: "e4", targetName: "Moonblade", targetType: "item", relationshipType: "owns", direction: "outgoing" },
    { id: "rel_4", targetId: "e5", targetName: "Lord Varen", targetType: "character", relationshipType: "enemy", direction: "incoming" },
  ],
  mentions: [
    { id: "m1", documentTitle: "Chapter 3: The Hunt Begins", excerpt: "Elena crouched in the shadows, her blade humming softly...", timestamp: Date.now() - 86400000 },
    { id: "m2", documentTitle: "Chapter 7: Revelations", excerpt: "\"You don't understand,\" Elena said, her voice barely above a whisper...", timestamp: Date.now() - 172800000 },
    { id: "m3", documentTitle: "Worldbuilding Notes", excerpt: "Elena's backstory connects to the Fall of the Northern Reaches...", timestamp: Date.now() - 259200000 },
  ],
  history: [
    { id: "h1", action: "updated", field: "notes", newValue: "Added backstory details", timestamp: Date.now() - 3600000, source: "user" },
    { id: "h2", action: "relationship_added", newValue: "ally → Marcus Thorne", timestamp: Date.now() - 86400000, source: "ai" },
    { id: "h3", action: "created", timestamp: Date.now() - 604800000, source: "ai" },
  ],
};

type TabId = "overview" | "graph" | "mentions" | "history";

const TABS: { id: TabId; label: string; icon: typeof FileText }[] = [
  { id: "overview", label: "Overview", icon: FileText },
  { id: "graph", label: "Graph", icon: Network },
  { id: "mentions", label: "Mentions", icon: MessageSquare },
  { id: "history", label: "History", icon: History },
];

// ============================================================================
// Sub-components
// ============================================================================

function EntityHeader({ entity, onMenuAction }: { entity: MockEntity; onMenuAction: (action: string) => void }) {
  const Icon = resolveLucideIcon(entity.iconName);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex items-start gap-4 p-6 border-b border-mythos-border-default">
      {/* Avatar / Image */}
      <div
        className="w-16 h-16 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${entity.color}20` }}
      >
        {entity.imageUrl ? (
          <img src={entity.imageUrl} alt={entity.name} className="w-full h-full object-cover rounded-xl" />
        ) : (
          <Icon className="w-8 h-8" style={{ color: entity.color }} />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-xl font-semibold text-mythos-text-primary truncate">
            {entity.name}
          </h1>
          {entity.fictional && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-mythos-accent-primary/20 text-mythos-accent-primary rounded">
              Fictional
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-sm text-mythos-text-muted mb-3">
          <span className="capitalize">{entity.type}</span>
          {entity.aliases.length > 0 && (
            <>
              <span className="text-mythos-border-default">·</span>
              <span className="text-mythos-text-muted/70">
                aka {entity.aliases.slice(0, 2).join(", ")}
                {entity.aliases.length > 2 && ` +${entity.aliases.length - 2}`}
              </span>
            </>
          )}
        </div>

        {/* Property pills */}
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(entity.properties).slice(0, 4).map(([key, value]) => (
            <span
              key={key}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-mythos-bg-tertiary text-mythos-text-secondary"
            >
              <span className="text-mythos-text-muted capitalize">{key}:</span>
              <span>{String(value)}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <Button variant="outline" size="sm" className="gap-1.5">
          <Pencil className="w-3.5 h-3.5" />
          Edit
        </Button>
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <MoreHorizontal className="w-4 h-4" />
          </Button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 w-48 py-1 rounded-lg border border-mythos-border-default bg-mythos-bg-secondary shadow-lg z-50">
                <button
                  onClick={() => { onMenuAction("add-image"); setMenuOpen(false); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-mythos-text-secondary hover:bg-mythos-bg-tertiary"
                >
                  <ImageIcon className="w-4 h-4" />
                  Add image
                </button>
                <button
                  onClick={() => { onMenuAction("copy-link"); setMenuOpen(false); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-mythos-text-secondary hover:bg-mythos-bg-tertiary"
                >
                  <Link2 className="w-4 h-4" />
                  Copy link
                </button>
                <button
                  onClick={() => { onMenuAction("duplicate"); setMenuOpen(false); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-mythos-text-secondary hover:bg-mythos-bg-tertiary"
                >
                  <Copy className="w-4 h-4" />
                  Duplicate
                </button>
                <div className="my-1 border-t border-mythos-border-default" />
                <button
                  onClick={() => { onMenuAction("delete"); setMenuOpen(false); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-mythos-accent-red hover:bg-mythos-bg-tertiary"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function OverviewTab({ entity }: { entity: MockEntity }) {
  return (
    <div className="p-6 space-y-6">
      {/* Notes / Editor area */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-mythos-text-primary">Notes</h3>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-mythos-text-muted">
              <Sparkles className="w-3 h-3" />
              /expand
            </Button>
          </div>
        </div>
        <div className="min-h-[200px] p-4 rounded-lg border border-mythos-border-default bg-mythos-bg-secondary/50">
          <p className="text-sm text-mythos-text-secondary whitespace-pre-wrap">
            {entity.notes}
          </p>
          <p className="text-xs text-mythos-text-muted mt-4 italic">
            [TipTap editor will be embedded here]
          </p>
        </div>
      </div>

      {/* Quick widgets */}
      <div>
        <h3 className="text-sm font-medium text-mythos-text-primary mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-2">
          {[
            { icon: Sparkles, label: "/generate name", desc: "Generate alternative names" },
            { icon: FileText, label: "/expand backstory", desc: "Expand character history" },
            { icon: Network, label: "/suggest-connections", desc: "Find potential relationships" },
            { icon: MessageSquare, label: "/add-voice", desc: "Define voice profile" },
          ].map((widget) => (
            <button
              key={widget.label}
              className="flex items-start gap-3 p-3 rounded-lg border border-mythos-border-default hover:border-mythos-accent-primary/50 hover:bg-mythos-bg-tertiary transition-colors text-left"
            >
              <widget.icon className="w-4 h-4 text-mythos-accent-primary mt-0.5" />
              <div>
                <span className="text-sm font-medium text-mythos-text-primary block">
                  {widget.label}
                </span>
                <span className="text-xs text-mythos-text-muted">{widget.desc}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Properties */}
      <div>
        <h3 className="text-sm font-medium text-mythos-text-primary mb-3">Properties</h3>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(entity.properties).map(([key, value]) => (
            <div
              key={key}
              className="flex items-center justify-between p-3 rounded-lg border border-mythos-border-default"
            >
              <span className="text-sm text-mythos-text-muted capitalize">{key}</span>
              <span className="text-sm font-medium text-mythos-text-primary">{String(value)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function GraphTab({ entity }: { entity: MockEntity }) {
  const relationshipsByType = useMemo(() => {
    const grouped: Record<string, typeof entity.relationships> = {};
    entity.relationships.forEach((rel) => {
      if (!grouped[rel.relationshipType]) grouped[rel.relationshipType] = [];
      grouped[rel.relationshipType].push(rel);
    });
    return grouped;
  }, [entity.relationships]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-mythos-text-primary">
          Relationships ({entity.relationships.length})
        </h3>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
          <Network className="w-3.5 h-3.5" />
          Open Full Graph
        </Button>
      </div>

      <div className="space-y-4">
        {Object.entries(relationshipsByType).map(([type, rels]) => (
          <div key={type}>
            <h4 className="text-xs font-medium text-mythos-text-muted uppercase tracking-wide mb-2">
              {type}
            </h4>
            <div className="space-y-2">
              {rels.map((rel) => {
                const TypeIcon = rel.targetType === "character" ? User
                  : rel.targetType === "location" ? MapPin
                  : rel.targetType === "item" ? Sword
                  : FileText;
                return (
                  <button
                    key={rel.id}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-mythos-border-default hover:border-mythos-accent-primary/50 hover:bg-mythos-bg-tertiary transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-lg bg-mythos-bg-tertiary flex items-center justify-center">
                      <TypeIcon className="w-4 h-4 text-mythos-text-muted" />
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-medium text-mythos-text-primary block">
                        {rel.targetName}
                      </span>
                      <span className="text-xs text-mythos-text-muted capitalize">
                        {rel.targetType}
                      </span>
                    </div>
                    <span className="text-xs text-mythos-text-muted">
                      {rel.direction === "outgoing" ? "→" : "←"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {entity.relationships.length === 0 && (
        <div className="text-center py-12">
          <Network className="w-10 h-10 text-mythos-text-muted/30 mx-auto mb-3" />
          <p className="text-sm text-mythos-text-muted">No relationships yet</p>
          <Button variant="outline" size="sm" className="mt-3 gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Suggest connections
          </Button>
        </div>
      )}
    </div>
  );
}

function MentionsTab({ entity }: { entity: MockEntity }) {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-mythos-text-primary">
          Mentions ({entity.mentions.length})
        </h3>
        <span className="text-xs text-mythos-text-muted">
          Semantic search across documents
        </span>
      </div>

      <div className="space-y-3">
        {entity.mentions.map((mention) => (
          <button
            key={mention.id}
            className="w-full text-left p-4 rounded-lg border border-mythos-border-default hover:border-mythos-accent-primary/50 hover:bg-mythos-bg-tertiary transition-colors"
          >
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-3.5 h-3.5 text-mythos-accent-primary" />
              <span className="text-sm font-medium text-mythos-text-primary">
                {mention.documentTitle}
              </span>
            </div>
            <p className="text-sm text-mythos-text-secondary line-clamp-2">
              {mention.excerpt}
            </p>
            <span className="text-xs text-mythos-text-muted mt-2 block">
              {new Date(mention.timestamp).toLocaleDateString()}
            </span>
          </button>
        ))}
      </div>

      {entity.mentions.length === 0 && (
        <div className="text-center py-12">
          <FileText className="w-10 h-10 text-mythos-text-muted/30 mx-auto mb-3" />
          <p className="text-sm text-mythos-text-muted">No mentions found</p>
          <p className="text-xs text-mythos-text-muted/70 mt-1">
            This entity hasn't been referenced in any documents yet
          </p>
        </div>
      )}
    </div>
  );
}

function HistoryTab({ entity }: { entity: MockEntity }) {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-mythos-text-primary">
          History
        </h3>
        <span className="text-xs text-mythos-text-muted">
          Knowledge PRs + changes
        </span>
      </div>

      <div className="space-y-3">
        {entity.history.map((entry) => (
          <div
            key={entry.id}
            className="flex gap-3 p-3 rounded-lg border border-mythos-border-default"
          >
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
              entry.source === "ai" ? "bg-mythos-accent-primary/20" : "bg-mythos-bg-tertiary"
            )}>
              {entry.source === "ai" ? (
                <Sparkles className="w-4 h-4 text-mythos-accent-primary" />
              ) : (
                <User className="w-4 h-4 text-mythos-text-muted" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-mythos-text-primary capitalize">
                  {entry.action.replace("_", " ")}
                </span>
                {entry.field && (
                  <span className="text-xs text-mythos-text-muted">
                    · {entry.field}
                  </span>
                )}
              </div>
              {entry.newValue && (
                <p className="text-sm text-mythos-text-secondary mt-1 truncate">
                  {entry.newValue}
                </p>
              )}
              <span className="text-xs text-mythos-text-muted mt-1 block">
                {new Date(entry.timestamp).toLocaleString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

interface EntityProfilePageProps {
  entityId?: string;
  onBack?: () => void;
}

export function EntityProfilePage({ onBack }: EntityProfilePageProps) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  // TODO: Replace with real Convex query
  const entity = MOCK_ENTITY;

  const handleMenuAction = (action: string) => {
    console.log("Menu action:", action);
    // TODO: Implement menu actions
  };

  return (
    <div className="h-full flex flex-col bg-mythos-bg-primary" data-testid="entity-profile-page">
      {/* Top bar */}
      <div className="h-10 border-b border-mythos-border-default bg-mythos-bg-secondary flex items-center px-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-1.5 text-xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {/* Header */}
        <EntityHeader entity={entity} onMenuAction={handleMenuAction} />

        {/* Custom Tabs */}
        <div className="border-b border-mythos-border-default px-6">
          <div className="flex gap-4">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 py-2.5 px-1 text-sm font-medium border-b-2 transition-colors",
                  activeTab === tab.id
                    ? "border-mythos-accent-primary text-mythos-text-primary"
                    : "border-transparent text-mythos-text-muted hover:text-mythos-text-secondary"
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {tab.id === "graph" && (
                  <span className="ml-1 text-xs text-mythos-text-muted">
                    {entity.relationships.length}
                  </span>
                )}
                {tab.id === "mentions" && (
                  <span className="ml-1 text-xs text-mythos-text-muted">
                    {entity.mentions.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === "overview" && <OverviewTab entity={entity} />}
        {activeTab === "graph" && <GraphTab entity={entity} />}
        {activeTab === "mentions" && <MentionsTab entity={entity} />}
        {activeTab === "history" && <HistoryTab entity={entity} />}
      </ScrollArea>
    </div>
  );
}

export default EntityProfilePage;
