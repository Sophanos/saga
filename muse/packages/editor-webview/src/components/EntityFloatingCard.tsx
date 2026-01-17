/**
 * EntityFloatingCard - Anchored popover for entity mentions
 *
 * Two modes:
 * - Compact: Quick preview with actions
 * - Expanded: Full details with tabs (Overview, Graph, Mentions)
 *
 * Design: Matches ArtifactPanel styling, uses @mythos/theme colors.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  notion,
  getNotionColorForEntity,
  type NotionColorName,
} from '@mythos/theme';

// ============================================================================
// Types
// ============================================================================

export type EntityType =
  | 'character'
  | 'location'
  | 'item'
  | 'magic_system'
  | 'faction'
  | 'event'
  | 'concept';

export interface EntityRelationship {
  id: string;
  targetId: string;
  targetName: string;
  targetType: EntityType;
  relationshipType: string;
}

export interface EntityMention {
  id: string;
  documentTitle: string;
  excerpt: string;
  timestamp: number;
}

export interface EntityData {
  id: string;
  name: string;
  type: EntityType;
  aliases?: string[];
  notes?: string;
  properties?: Record<string, string | number | boolean>;
  relationships?: EntityRelationship[];
  mentions?: EntityMention[];
}

export interface EntityFloatingCardProps {
  entity: EntityData;
  anchor: { x: number; y: number };
  onClose: () => void;
}

type TabId = 'overview' | 'graph' | 'mentions';

// ============================================================================
// Entity Color Helpers - Using centralized @mythos/theme
// ============================================================================

function getEntityColor(type: EntityType, override?: NotionColorName): string {
  const colorName = getNotionColorForEntity(type, override);
  return notion.dark[colorName].text;
}

// ============================================================================
// SVG Icons
// ============================================================================

function IconUser({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconMapPin({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function IconSword({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" />
      <line x1="13" y1="19" x2="19" y2="13" />
      <line x1="16" y1="16" x2="20" y2="20" />
      <line x1="19" y1="21" x2="21" y2="19" />
    </svg>
  );
}

function IconZap({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function IconUsers({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconSparkles({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    </svg>
  );
}

function IconMaximize({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );
}

function IconMinimize({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 14 10 14 10 20" />
      <polyline points="20 10 14 10 14 4" />
      <line x1="14" y1="10" x2="21" y2="3" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );
}

function IconNetwork({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <circle cx="19" cy="5" r="2" />
      <circle cx="5" cy="19" r="2" />
      <line x1="14.5" y1="9.5" x2="17.5" y2="6.5" />
      <line x1="9.5" y1="14.5" x2="6.5" y2="17.5" />
      <circle cx="19" cy="19" r="2" />
      <line x1="14.5" y1="14.5" x2="17.5" y2="17.5" />
    </svg>
  );
}

function IconEdit({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function IconClose({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function IconFileText({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function IconMessageSquare({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function IconExternalLink({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function getEntityIcon(type: EntityType, color: string, size = 18) {
  switch (type) {
    case 'character':
      return <IconUser color={color} size={size} />;
    case 'location':
      return <IconMapPin color={color} size={size} />;
    case 'item':
      return <IconSword color={color} size={size} />;
    case 'magic_system':
      return <IconZap color={color} size={size} />;
    case 'faction':
      return <IconUsers color={color} size={size} />;
    default:
      return <IconSparkles color={color} size={size} />;
  }
}

// ============================================================================
// Event Emitters (for parent app integration)
// ============================================================================

function emitEntityEvent(type: 'expand' | 'graph' | 'edit', entity: EntityData) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(`entity:${type}`, {
        detail: { entity },
      })
    );
  }
}

// ============================================================================
// Tab Components
// ============================================================================

function OverviewTab({ entity }: { entity: EntityData }) {
  const properties = entity.properties ?? {};
  const propertyEntries = Object.entries(properties);

  return (
    <div className="entity-tab-content">
      {entity.notes && (
        <div className="entity-section">
          <h4 className="entity-section__title">Notes</h4>
          <div className="entity-notes">
            <p>{entity.notes}</p>
          </div>
        </div>
      )}

      {propertyEntries.length > 0 && (
        <div className="entity-section">
          <h4 className="entity-section__title">Properties</h4>
          <div className="entity-properties-grid">
            {propertyEntries.map(([key, value]) => (
              <div key={key} className="entity-property-item">
                <span className="entity-property-item__key">{key}</span>
                <span className="entity-property-item__value">{String(value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!entity.notes && propertyEntries.length === 0 && (
        <div className="entity-empty">
          No details added yet
        </div>
      )}
    </div>
  );
}

function GraphTab({ entity }: { entity: EntityData }) {
  const relationships = entity.relationships ?? [];
  const entityColor = getEntityColor(entity.type);

  if (relationships.length === 0) {
    return (
      <div className="entity-tab-content">
        <div className="entity-empty">
          No relationships yet
        </div>
      </div>
    );
  }

  // Group by relationship type
  const grouped: Record<string, EntityRelationship[]> = {};
  relationships.forEach((rel) => {
    if (!grouped[rel.relationshipType]) grouped[rel.relationshipType] = [];
    grouped[rel.relationshipType].push(rel);
  });

  return (
    <div className="entity-tab-content">
      {/* Mini graph visualization */}
      <div className="entity-mini-graph">
        <div className="entity-mini-graph__center" style={{ '--entity-color': entityColor } as React.CSSProperties}>
          {getEntityIcon(entity.type, entityColor, 24)}
        </div>
        <div className="entity-mini-graph__lines">
          {relationships.slice(0, 4).map((rel, i) => (
            <div
              key={rel.id}
              className="entity-mini-graph__line"
              style={{ '--line-index': i, '--line-count': Math.min(relationships.length, 4) } as React.CSSProperties}
            />
          ))}
        </div>
        {relationships.slice(0, 4).map((rel, i) => {
          const targetColor = getEntityColor(rel.targetType);
          return (
            <div
              key={rel.id}
              className="entity-mini-graph__node"
              style={{ '--node-index': i, '--node-count': Math.min(relationships.length, 4), '--entity-color': targetColor } as React.CSSProperties}
            >
              {getEntityIcon(rel.targetType, targetColor, 14)}
            </div>
          );
        })}
      </div>

      {/* Relationship list */}
      {Object.entries(grouped).map(([type, rels]) => (
        <div key={type} className="entity-section">
          <h4 className="entity-section__title">{type}</h4>
          <div className="entity-rel-list">
            {rels.map((rel) => {
              const targetColor = getEntityColor(rel.targetType);
              return (
                <button key={rel.id} className="entity-rel-item">
                  <div className="entity-rel-item__icon" style={{ '--entity-color': targetColor } as React.CSSProperties}>
                    {getEntityIcon(rel.targetType, targetColor, 14)}
                  </div>
                  <div className="entity-rel-item__info">
                    <span className="entity-rel-item__name">{rel.targetName}</span>
                    <span className="entity-rel-item__type">{rel.targetType.replace('_', ' ')}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Open in Artifact Panel */}
      <button
        className="entity-open-graph-btn"
        onClick={() => emitEntityEvent('graph', entity)}
      >
        <IconExternalLink size={14} />
        <span>Open full graph in panel</span>
      </button>
    </div>
  );
}

function MentionsTab({ entity }: { entity: EntityData }) {
  const mentions = entity.mentions ?? [];

  if (mentions.length === 0) {
    return (
      <div className="entity-tab-content">
        <div className="entity-empty">
          No mentions found
        </div>
      </div>
    );
  }

  return (
    <div className="entity-tab-content">
      {mentions.map((mention) => (
        <button key={mention.id} className="entity-mention-item">
          <div className="entity-mention-item__header">
            <span className="entity-mention-item__title">{mention.documentTitle}</span>
            <span className="entity-mention-item__time">
              {formatTimeAgo(mention.timestamp)}
            </span>
          </div>
          <p className="entity-mention-item__excerpt">{mention.excerpt}</p>
        </button>
      ))}
    </div>
  );
}

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

// ============================================================================
// Main Component
// ============================================================================

const TABS: { id: TabId; label: string; icon: React.FC<{ size?: number }> }[] = [
  { id: 'overview', label: 'Overview', icon: IconFileText },
  { id: 'graph', label: 'Graph', icon: IconNetwork },
  { id: 'mentions', label: 'Mentions', icon: IconMessageSquare },
];

export function EntityFloatingCard({
  entity,
  anchor,
  onClose,
}: EntityFloatingCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const entityColor = getEntityColor(entity.type);
  const cardWidth = isExpanded ? 380 : 280;

  // Calculate position
  useEffect(() => {
    if (!cardRef.current) return;

    const card = cardRef.current;
    const rect = card.getBoundingClientRect();
    const padding = 12;

    let top = anchor.y + 8;
    let left = anchor.x - cardWidth / 2;

    if (left < padding) left = padding;
    if (left + cardWidth > window.innerWidth - padding) {
      left = window.innerWidth - cardWidth - padding;
    }
    if (top + rect.height > window.innerHeight - padding) {
      top = anchor.y - rect.height - 8;
    }

    setPosition({ top, left });
  }, [anchor, cardWidth, isExpanded]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onClose();
      }
    }

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Escape to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleExpand = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const handleGraph = useCallback(() => {
    emitEntityEvent('graph', entity);
  }, [entity]);

  const handleEdit = useCallback(() => {
    emitEntityEvent('edit', entity);
  }, [entity]);

  const properties = entity.properties ?? {};
  const propertyEntries = Object.entries(properties).slice(0, 3);
  const relationshipCount = entity.relationships?.length ?? 0;
  const mentionCount = entity.mentions?.length ?? 0;

  return (
    <div
      ref={cardRef}
      className={`entity-floating-card ${isExpanded ? 'entity-floating-card--expanded' : ''}`}
      style={{
        top: position.top,
        left: position.left,
        width: cardWidth,
        ['--entity-color' as string]: entityColor,
      }}
    >
      {/* Header */}
      <div className="entity-floating-card__header">
        <div className="entity-floating-card__avatar">
          {getEntityIcon(entity.type, entityColor, isExpanded ? 24 : 18)}
        </div>

        <div className="entity-floating-card__info">
          <h3 className="entity-floating-card__name">{entity.name}</h3>
          <div className="entity-floating-card__meta">
            <span className="entity-floating-card__type">
              {entity.type.replace('_', ' ')}
            </span>
            {entity.aliases && entity.aliases.length > 0 && (
              <span className="entity-floating-card__alias">
                aka {entity.aliases[0]}
              </span>
            )}
          </div>
        </div>

        <div className="entity-floating-card__header-actions">
          <button onClick={handleExpand} className="entity-floating-card__icon-btn" title={isExpanded ? 'Collapse' : 'Expand'}>
            {isExpanded ? <IconMinimize /> : <IconMaximize />}
          </button>
          <button onClick={onClose} className="entity-floating-card__icon-btn">
            <IconClose />
          </button>
        </div>
      </div>

      {/* Compact view: Properties + Actions */}
      {!isExpanded && (
        <>
          {propertyEntries.length > 0 && (
            <div className="entity-floating-card__properties">
              {propertyEntries.map(([key, value]) => (
                <span key={key} className="entity-floating-card__property">
                  <span className="entity-floating-card__property-key">{key}</span>
                  <span className="entity-floating-card__property-value">{String(value)}</span>
                </span>
              ))}
            </div>
          )}

          <div className="entity-floating-card__divider" />

          <div className="entity-floating-card__actions">
            <button className="entity-floating-card__action" onClick={handleExpand}>
              <IconMaximize />
              <span>Expand</span>
            </button>
            <button className="entity-floating-card__action" onClick={handleGraph}>
              <IconNetwork />
              <span>Graph</span>
            </button>
            <button className="entity-floating-card__action" onClick={handleEdit}>
              <IconEdit />
              <span>Edit</span>
            </button>
          </div>
        </>
      )}

      {/* Expanded view: Tabs */}
      {isExpanded && (
        <>
          {/* Tabs */}
          <div className="entity-floating-card__tabs">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              const count = tab.id === 'graph' ? relationshipCount : tab.id === 'mentions' ? mentionCount : null;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`entity-tab ${isActive ? 'entity-tab--active' : ''}`}
                >
                  <tab.icon size={14} />
                  <span>{tab.label}</span>
                  {count !== null && count > 0 && (
                    <span className="entity-tab__count">{count}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          <div className="entity-floating-card__body">
            {activeTab === 'overview' && <OverviewTab entity={entity} />}
            {activeTab === 'graph' && <GraphTab entity={entity} />}
            {activeTab === 'mentions' && <MentionsTab entity={entity} />}
          </div>

          {/* Footer Actions */}
          <div className="entity-floating-card__footer">
            <button className="entity-footer-btn" onClick={handleEdit}>
              <IconEdit size={14} />
              <span>Edit with AI</span>
            </button>
          </div>
        </>
      )}

      <style>{entityFloatingCardStyles}</style>
    </div>
  );
}

// ============================================================================
// Styles
// ============================================================================

const entityFloatingCardStyles = `
  .entity-floating-card {
    position: fixed;
    z-index: 50;
    border-radius: var(--radius-xl, 12px);
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    box-shadow: var(--shadow-lg), 0 0 0 1px rgba(0, 0, 0, 0.03);
    animation: entityCardIn 0.15s var(--ease-out);
    font-family: var(--font-sans);
    overflow: hidden;
    transition: width 0.2s var(--ease-out);
  }

  .entity-floating-card--expanded {
    max-height: 480px;
    display: flex;
    flex-direction: column;
  }

  @keyframes entityCardIn {
    from {
      opacity: 0;
      transform: scale(0.96) translateY(4px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  .entity-floating-card__header {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3, 12px);
    padding: var(--space-4, 16px);
    padding-bottom: var(--space-3, 12px);
  }

  .entity-floating-card__avatar {
    width: 40px;
    height: 40px;
    border-radius: var(--radius-lg, 8px);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: color-mix(in srgb, var(--entity-color) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--entity-color) 25%, transparent);
  }

  .entity-floating-card--expanded .entity-floating-card__avatar {
    width: 48px;
    height: 48px;
  }

  .entity-floating-card__info {
    flex: 1;
    min-width: 0;
  }

  .entity-floating-card__name {
    font-size: var(--text-sm, 14px);
    font-weight: var(--font-medium, 500);
    color: var(--color-text);
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: var(--leading-tight, 1.25);
  }

  .entity-floating-card--expanded .entity-floating-card__name {
    font-size: var(--text-base, 15px);
  }

  .entity-floating-card__meta {
    display: flex;
    align-items: center;
    gap: var(--space-2, 8px);
    margin-top: var(--space-1, 4px);
  }

  .entity-floating-card__type {
    padding: 2px 6px;
    font-size: 10px;
    font-weight: var(--font-medium, 500);
    border-radius: var(--radius-sm, 4px);
    text-transform: capitalize;
    background: color-mix(in srgb, var(--entity-color) 20%, transparent);
    color: var(--entity-color);
  }

  .entity-floating-card__alias {
    font-size: var(--text-xs, 12px);
    color: var(--color-text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .entity-floating-card__header-actions {
    display: flex;
    gap: var(--space-1, 4px);
  }

  .entity-floating-card__icon-btn {
    padding: var(--space-1, 4px);
    background: none;
    border: none;
    border-radius: var(--radius-sm, 4px);
    cursor: pointer;
    color: var(--color-text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.1s, color 0.1s;
  }

  .entity-floating-card__icon-btn:hover {
    background: var(--color-bg-hover);
    color: var(--color-text-secondary);
  }

  .entity-floating-card__properties {
    padding: 0 var(--space-4, 16px) var(--space-3, 12px);
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1-5, 6px);
  }

  .entity-floating-card__property {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1-5, 6px);
    padding: var(--space-1, 4px) var(--space-2, 8px);
    border-radius: var(--radius-md, 6px);
    font-size: var(--text-xs, 11px);
    background: var(--color-bg-surface);
    border: 1px solid var(--color-border-subtle);
  }

  .entity-floating-card__property-key {
    color: var(--color-text-muted);
    text-transform: capitalize;
  }

  .entity-floating-card__property-value {
    color: var(--color-text-secondary);
    font-weight: var(--font-medium, 500);
  }

  .entity-floating-card__divider {
    height: 1px;
    background: var(--color-border);
  }

  .entity-floating-card__actions {
    display: flex;
    gap: var(--space-1, 4px);
    padding: var(--space-2, 8px);
  }

  .entity-floating-card__action {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-1-5, 6px);
    height: 32px;
    background: none;
    border: none;
    border-radius: var(--radius-md, 6px);
    cursor: pointer;
    font-size: var(--text-xs, 12px);
    font-family: var(--font-sans);
    color: var(--color-text-secondary);
    transition: background 0.1s, color 0.1s;
  }

  .entity-floating-card__action:hover {
    background: var(--color-bg-hover);
    color: var(--color-text);
  }

  /* Tabs */
  .entity-floating-card__tabs {
    display: flex;
    border-bottom: 1px solid var(--color-border);
  }

  .entity-tab {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-1, 4px);
    padding: var(--space-2-5, 10px) var(--space-3, 12px);
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    cursor: pointer;
    font-size: var(--text-xs, 12px);
    font-family: var(--font-sans);
    font-weight: var(--font-medium, 500);
    color: var(--color-text-muted);
    transition: color 0.1s, border-color 0.1s;
  }

  .entity-tab:hover {
    color: var(--color-text-secondary);
  }

  .entity-tab--active {
    color: var(--entity-color);
    border-bottom-color: var(--entity-color);
  }

  .entity-tab__count {
    padding: 1px 5px;
    border-radius: var(--radius-full, 9999px);
    font-size: 10px;
    background: var(--color-bg-surface);
  }

  .entity-tab--active .entity-tab__count {
    background: color-mix(in srgb, var(--entity-color) 20%, transparent);
  }

  /* Tab Content */
  .entity-floating-card__body {
    flex: 1;
    overflow-y: auto;
    max-height: 280px;
  }

  .entity-tab-content {
    padding: var(--space-3, 12px);
  }

  .entity-section {
    margin-bottom: var(--space-4, 16px);
  }

  .entity-section:last-child {
    margin-bottom: 0;
  }

  .entity-section__title {
    font-size: 10px;
    font-weight: var(--font-medium, 500);
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0 0 var(--space-2, 8px) 0;
  }

  .entity-notes {
    padding: var(--space-3, 12px);
    border-radius: var(--radius-md, 6px);
    background: var(--color-bg-surface);
    border: 1px solid var(--color-border-subtle);
  }

  .entity-notes p {
    margin: 0;
    font-size: var(--text-sm, 13px);
    color: var(--color-text-secondary);
    line-height: 1.5;
  }

  .entity-properties-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-2, 8px);
  }

  .entity-property-item {
    display: flex;
    flex-direction: column;
    padding: var(--space-2, 8px);
    border-radius: var(--radius-md, 6px);
    border: 1px solid var(--color-border);
  }

  .entity-property-item__key {
    font-size: 10px;
    color: var(--color-text-muted);
    text-transform: capitalize;
  }

  .entity-property-item__value {
    font-size: var(--text-sm, 13px);
    font-weight: var(--font-medium, 500);
    color: var(--color-text);
  }

  .entity-empty {
    text-align: center;
    padding: var(--space-6, 24px);
    color: var(--color-text-muted);
    font-size: var(--text-sm, 13px);
  }

  /* Mini Graph */
  .entity-mini-graph {
    position: relative;
    height: 100px;
    margin-bottom: var(--space-4, 16px);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .entity-mini-graph__center {
    width: 48px;
    height: 48px;
    border-radius: var(--radius-lg, 8px);
    background: color-mix(in srgb, var(--entity-color) 15%, transparent);
    border: 2px solid var(--entity-color);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
  }

  .entity-mini-graph__node {
    position: absolute;
    width: 28px;
    height: 28px;
    border-radius: var(--radius-md, 6px);
    background: var(--color-bg-elevated);
    border: 1px solid color-mix(in srgb, var(--entity-color) 40%, transparent);
    display: flex;
    align-items: center;
    justify-content: center;
    transform: translate(
      calc(cos(calc(var(--node-index) * 360deg / var(--node-count) - 90deg)) * 60px),
      calc(sin(calc(var(--node-index) * 360deg / var(--node-count) - 90deg)) * 40px)
    );
  }

  .entity-mini-graph__lines {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  /* Relationship List */
  .entity-rel-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-1, 4px);
  }

  .entity-rel-item {
    display: flex;
    align-items: center;
    gap: var(--space-2, 8px);
    padding: var(--space-2, 8px);
    background: none;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md, 6px);
    cursor: pointer;
    text-align: left;
    width: 100%;
    transition: background 0.1s, border-color 0.1s;
  }

  .entity-rel-item:hover {
    background: var(--color-bg-hover);
    border-color: color-mix(in srgb, var(--entity-color) 40%, transparent);
  }

  .entity-rel-item__icon {
    width: 24px;
    height: 24px;
    border-radius: var(--radius-sm, 4px);
    background: color-mix(in srgb, var(--entity-color) 15%, transparent);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .entity-rel-item__info {
    flex: 1;
    min-width: 0;
  }

  .entity-rel-item__name {
    display: block;
    font-size: var(--text-sm, 13px);
    font-weight: var(--font-medium, 500);
    color: var(--color-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .entity-rel-item__type {
    display: block;
    font-size: var(--text-xs, 11px);
    color: var(--color-text-muted);
    text-transform: capitalize;
  }

  .entity-open-graph-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2, 8px);
    width: 100%;
    padding: var(--space-2, 8px);
    margin-top: var(--space-3, 12px);
    background: none;
    border: 1px dashed var(--color-border);
    border-radius: var(--radius-md, 6px);
    cursor: pointer;
    font-size: var(--text-xs, 12px);
    font-family: var(--font-sans);
    color: var(--color-text-muted);
    transition: background 0.1s, color 0.1s, border-color 0.1s;
  }

  .entity-open-graph-btn:hover {
    background: var(--color-bg-hover);
    color: var(--color-text-secondary);
    border-color: var(--color-text-muted);
  }

  /* Mentions */
  .entity-mention-item {
    display: block;
    width: 100%;
    padding: var(--space-3, 12px);
    margin-bottom: var(--space-2, 8px);
    background: none;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md, 6px);
    cursor: pointer;
    text-align: left;
    transition: background 0.1s, border-color 0.1s;
  }

  .entity-mention-item:last-child {
    margin-bottom: 0;
  }

  .entity-mention-item:hover {
    background: var(--color-bg-hover);
    border-color: color-mix(in srgb, var(--entity-color) 40%, transparent);
  }

  .entity-mention-item__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-1, 4px);
  }

  .entity-mention-item__title {
    font-size: var(--text-sm, 13px);
    font-weight: var(--font-medium, 500);
    color: var(--color-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .entity-mention-item__time {
    font-size: var(--text-xs, 11px);
    color: var(--color-text-muted);
    flex-shrink: 0;
    margin-left: var(--space-2, 8px);
  }

  .entity-mention-item__excerpt {
    margin: 0;
    font-size: var(--text-xs, 12px);
    color: var(--color-text-secondary);
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* Footer */
  .entity-floating-card__footer {
    padding: var(--space-2, 8px);
    border-top: 1px solid var(--color-border);
  }

  .entity-footer-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2, 8px);
    width: 100%;
    padding: var(--space-2, 8px);
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(34, 211, 238, 0.1));
    border: 1px solid color-mix(in srgb, var(--entity-color) 30%, transparent);
    border-radius: var(--radius-md, 6px);
    cursor: pointer;
    font-size: var(--text-sm, 13px);
    font-family: var(--font-sans);
    font-weight: var(--font-medium, 500);
    color: var(--color-text);
    transition: background 0.1s;
  }

  .entity-footer-btn:hover {
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(34, 211, 238, 0.15));
  }
`;

// ============================================================================
// Mock Data
// ============================================================================

export const MOCK_ENTITIES: Record<string, EntityData> = {
  elena: {
    id: 'entity_elena',
    name: 'Elena Blackwood',
    type: 'character',
    aliases: ['The Shadow Walker', 'Lady E'],
    notes: 'A skilled tracker from the Northern Reaches. She carries a mysterious blade that glows in the presence of dark magic.',
    properties: {
      occupation: 'Bounty Hunter',
      status: 'Active',
      age: 28,
    },
    relationships: [
      { id: 'rel_1', targetId: 'marcus', targetName: 'Marcus Thorne', targetType: 'character', relationshipType: 'ally' },
      { id: 'rel_2', targetId: 'shadowfell', targetName: 'The Shadowfell', targetType: 'location', relationshipType: 'origin' },
      { id: 'rel_3', targetId: 'moonblade', targetName: 'Moonblade', targetType: 'item', relationshipType: 'owns' },
    ],
    mentions: [
      { id: 'm1', documentTitle: 'Chapter 3: The Hunt Begins', excerpt: 'Elena crouched in the shadows, her blade humming softly...', timestamp: Date.now() - 86400000 },
      { id: 'm2', documentTitle: 'Chapter 7: Revelations', excerpt: '"You don\'t understand," Elena said, her voice barely above a whisper...', timestamp: Date.now() - 172800000 },
    ],
  },
  marcus: {
    id: 'entity_marcus',
    name: 'Marcus Thorne',
    type: 'character',
    aliases: ['The Red Knight'],
    notes: 'Former commander of the King\'s Guard, now leading a band of rebels against the corrupt nobility.',
    properties: {
      occupation: 'Knight Commander',
      status: 'Active',
      age: 35,
    },
    relationships: [
      { id: 'rel_4', targetId: 'elena', targetName: 'Elena Blackwood', targetType: 'character', relationshipType: 'ally' },
    ],
    mentions: [
      { id: 'm3', documentTitle: 'Chapter 1: The Beginning', excerpt: 'Marcus stood before the burning castle, his sword raised...', timestamp: Date.now() - 259200000 },
    ],
  },
  shadowfell: {
    id: 'entity_shadowfell',
    name: 'The Shadowfell',
    type: 'location',
    notes: 'A dark realm that exists parallel to the material world, home to creatures of shadow and nightmare.',
    properties: {
      region: 'Northern Reaches',
      danger: 'Extreme',
    },
  },
  moonblade: {
    id: 'entity_moonblade',
    name: 'Moonblade',
    type: 'item',
    aliases: ['The Pale Edge'],
    notes: 'An ancient elven blade that glows with pale light in the presence of dark magic.',
    properties: {
      rarity: 'Legendary',
      type: 'Longsword',
    },
  },
};

export default EntityFloatingCard;
