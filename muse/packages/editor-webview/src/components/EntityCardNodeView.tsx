/**
 * EntityCardNodeView - Inline entity card rendered in document flow
 *
 * This is a TipTap NodeView component that renders an entity card
 * inline in the editor, pushing content below it.
 */

import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { useState, useCallback, useEffect } from 'react';
import { MOCK_ENTITIES, type EntityData, type EntityType } from './EntityFloatingCard';

// ============================================================================
// Entity Colors
// ============================================================================

const ENTITY_COLORS: Record<EntityType, string> = {
  character: '#22d3ee',
  location: '#22c55e',
  item: '#f59e0b',
  magic_system: '#8b5cf6',
  faction: '#a855f7',
  event: '#f97316',
  concept: '#64748b',
};

function getEntityColor(type: EntityType): string {
  return ENTITY_COLORS[type] ?? '#64748b';
}

// ============================================================================
// Icons
// ============================================================================

function IconUser({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconMapPin({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function IconSword({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" />
      <line x1="13" y1="19" x2="19" y2="13" />
      <line x1="16" y1="16" x2="20" y2="20" />
      <line x1="19" y1="21" x2="21" y2="19" />
    </svg>
  );
}

function IconZap({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function IconUsers({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconSparkles({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    </svg>
  );
}

function IconChevronDown({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function IconChevronRight({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function IconX({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
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

function getEntityIcon(type: EntityType, color: string, size = 20) {
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
// Component
// ============================================================================

type TabId = 'overview' | 'graph' | 'mentions';

export function EntityCardNodeView({ node, deleteNode, updateAttributes }: NodeViewProps) {
  const { entityId, entityType, entityName, isExpanded } = node.attrs;
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const entityColor = getEntityColor(entityType as EntityType);

  // Get full entity data from mock (in real app, fetch from Convex)
  const mockKey = Object.keys(MOCK_ENTITIES).find(
    k => MOCK_ENTITIES[k].name.toLowerCase().includes(entityName.toLowerCase().split(' ')[0])
  );
  const entity: EntityData = mockKey
    ? MOCK_ENTITIES[mockKey]
    : {
        id: entityId,
        name: entityName,
        type: entityType as EntityType,
      };

  const handleToggle = useCallback(() => {
    updateAttributes({ isExpanded: !isExpanded });
  }, [isExpanded, updateAttributes]);

  const handleClose = useCallback(() => {
    deleteNode();
  }, [deleteNode]);

  const properties = entity.properties ?? {};
  const propertyEntries = Object.entries(properties);
  const relationships = entity.relationships ?? [];
  const mentions = entity.mentions ?? [];

  return (
    <NodeViewWrapper className="entity-card-node-wrapper">
      <div
        className={`entity-card-inline ${isExpanded ? 'entity-card-inline--expanded' : ''}`}
        style={{ ['--entity-color' as string]: entityColor }}
        contentEditable={false}
      >
        {/* Header - always visible */}
        <div className="entity-card-inline__header" onClick={handleToggle}>
          <div className="entity-card-inline__toggle">
            {isExpanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
          </div>

          <div className="entity-card-inline__avatar">
            {getEntityIcon(entityType as EntityType, entityColor, 18)}
          </div>

          <div className="entity-card-inline__title">
            <span className="entity-card-inline__name">{entity.name}</span>
            <span className="entity-card-inline__type">{entityType.replace('_', ' ')}</span>
          </div>

          {entity.aliases && entity.aliases.length > 0 && (
            <span className="entity-card-inline__alias">aka {entity.aliases[0]}</span>
          )}

          <div className="entity-card-inline__actions">
            <button className="entity-card-inline__action-btn" onClick={(e) => { e.stopPropagation(); }} title="Open in Graph">
              <IconNetwork size={14} />
            </button>
            <button className="entity-card-inline__action-btn" onClick={(e) => { e.stopPropagation(); }} title="Edit with AI">
              <IconEdit size={14} />
            </button>
            <button className="entity-card-inline__close-btn" onClick={(e) => { e.stopPropagation(); handleClose(); }} title="Remove">
              <IconX size={14} />
            </button>
          </div>
        </div>

        {/* Expanded content */}
        {isExpanded && (
          <div className="entity-card-inline__body">
            {/* Tabs */}
            <div className="entity-card-inline__tabs">
              <button
                className={`entity-card-tab ${activeTab === 'overview' ? 'entity-card-tab--active' : ''}`}
                onClick={() => setActiveTab('overview')}
              >
                Overview
              </button>
              <button
                className={`entity-card-tab ${activeTab === 'graph' ? 'entity-card-tab--active' : ''}`}
                onClick={() => setActiveTab('graph')}
              >
                Graph {relationships.length > 0 && <span className="entity-card-tab__count">{relationships.length}</span>}
              </button>
              <button
                className={`entity-card-tab ${activeTab === 'mentions' ? 'entity-card-tab--active' : ''}`}
                onClick={() => setActiveTab('mentions')}
              >
                Mentions {mentions.length > 0 && <span className="entity-card-tab__count">{mentions.length}</span>}
              </button>
            </div>

            {/* Tab Content */}
            <div className="entity-card-inline__content">
              {activeTab === 'overview' && (
                <div className="entity-card-overview">
                  {entity.notes && (
                    <div className="entity-card-section">
                      <p className="entity-card-notes">{entity.notes}</p>
                    </div>
                  )}

                  {propertyEntries.length > 0 && (
                    <div className="entity-card-properties">
                      {propertyEntries.map(([key, value]) => (
                        <div key={key} className="entity-card-property">
                          <span className="entity-card-property__key">{key}</span>
                          <span className="entity-card-property__value">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {!entity.notes && propertyEntries.length === 0 && (
                    <div className="entity-card-empty">No details added yet</div>
                  )}
                </div>
              )}

              {activeTab === 'graph' && (
                <div className="entity-card-graph">
                  {relationships.length === 0 ? (
                    <div className="entity-card-empty">No relationships yet</div>
                  ) : (
                    <div className="entity-card-relations">
                      {relationships.map((rel) => {
                        const targetColor = getEntityColor(rel.targetType);
                        return (
                          <button key={rel.id} className="entity-card-relation">
                            <div className="entity-card-relation__icon" style={{ ['--entity-color' as string]: targetColor }}>
                              {getEntityIcon(rel.targetType, targetColor, 14)}
                            </div>
                            <div className="entity-card-relation__info">
                              <span className="entity-card-relation__name">{rel.targetName}</span>
                              <span className="entity-card-relation__type">{rel.relationshipType}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'mentions' && (
                <div className="entity-card-mentions">
                  {mentions.length === 0 ? (
                    <div className="entity-card-empty">No mentions found</div>
                  ) : (
                    mentions.map((mention) => (
                      <button key={mention.id} className="entity-card-mention">
                        <span className="entity-card-mention__title">{mention.documentTitle}</span>
                        <p className="entity-card-mention__excerpt">{mention.excerpt}</p>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{entityCardInlineStyles}</style>
    </NodeViewWrapper>
  );
}

// ============================================================================
// Styles
// ============================================================================

const entityCardInlineStyles = `
  .entity-card-node-wrapper {
    margin: var(--space-3, 12px) 0;
    width: 100%;
    max-width: 100%;
    contain: layout inline-size;
  }

  .entity-card-inline {
    border-radius: var(--radius-lg, 8px);
    border: 1px solid var(--color-border);
    background: var(--color-bg-surface);
    overflow: hidden;
    transition: border-color 0.15s, width 0.2s ease;
    width: 100%;
    max-width: 100%;
    container-type: inline-size;
  }

  .entity-card-inline:hover {
    border-color: color-mix(in srgb, var(--entity-color) 40%, var(--color-border));
  }

  .entity-card-inline__header {
    display: flex;
    align-items: center;
    gap: var(--space-2, 8px);
    padding: var(--space-2-5, 10px) var(--space-3, 12px);
    cursor: pointer;
    user-select: none;
    min-width: 0;
  }

  .entity-card-inline__header:hover {
    background: var(--color-bg-hover);
  }

  .entity-card-inline__toggle {
    color: var(--color-text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.15s;
    flex-shrink: 0;
  }

  .entity-card-inline__avatar {
    width: 28px;
    height: 28px;
    border-radius: var(--radius-md, 6px);
    background: color-mix(in srgb, var(--entity-color) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--entity-color) 25%, transparent);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .entity-card-inline__title {
    display: flex;
    align-items: baseline;
    gap: var(--space-2, 8px);
    flex: 1;
    min-width: 0;
    overflow: hidden;
  }

  .entity-card-inline__name {
    font-size: var(--text-sm, 14px);
    font-weight: var(--font-medium, 500);
    color: var(--color-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex-shrink: 1;
    min-width: 0;
  }

  .entity-card-inline__type {
    font-size: var(--text-xs, 11px);
    padding: 2px 6px;
    border-radius: var(--radius-sm, 4px);
    background: color-mix(in srgb, var(--entity-color) 15%, transparent);
    color: var(--entity-color);
    text-transform: capitalize;
    flex-shrink: 0;
  }

  .entity-card-inline__alias {
    font-size: var(--text-xs, 12px);
    color: var(--color-text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex-shrink: 1;
    min-width: 0;
  }

  /* Hide alias on narrow widths */
  @container (max-width: 400px) {
    .entity-card-inline__alias {
      display: none;
    }
  }

  .entity-card-inline__actions {
    display: flex;
    gap: var(--space-1, 4px);
    opacity: 0;
    transition: opacity 0.15s;
    flex-shrink: 0;
  }

  .entity-card-inline:hover .entity-card-inline__actions {
    opacity: 1;
  }

  .entity-card-inline__action-btn,
  .entity-card-inline__close-btn {
    width: 26px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: none;
    border-radius: var(--radius-sm, 4px);
    cursor: pointer;
    color: var(--color-text-muted);
    transition: background 0.1s, color 0.1s;
  }

  .entity-card-inline__action-btn:hover {
    background: var(--color-bg-active);
    color: var(--color-text);
  }

  .entity-card-inline__close-btn:hover {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
  }

  /* Body */
  .entity-card-inline__body {
    border-top: 1px solid var(--color-border);
  }

  /* Tabs */
  .entity-card-inline__tabs {
    display: flex;
    padding: 0 var(--space-3, 12px);
    border-bottom: 1px solid var(--color-border);
    background: var(--color-bg-elevated);
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }

  .entity-card-inline__tabs::-webkit-scrollbar {
    display: none;
  }

  .entity-card-tab {
    display: flex;
    align-items: center;
    gap: var(--space-1, 4px);
    padding: var(--space-2, 8px) var(--space-3, 12px);
    border: none;
    background: none;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    cursor: pointer;
    font-size: var(--text-xs, 12px);
    font-family: var(--font-sans);
    font-weight: var(--font-medium, 500);
    color: var(--color-text-muted);
    transition: color 0.1s, border-color 0.1s;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .entity-card-tab:hover {
    color: var(--color-text-secondary);
  }

  .entity-card-tab--active {
    color: var(--entity-color);
    border-bottom-color: var(--entity-color);
  }

  .entity-card-tab__count {
    padding: 1px 5px;
    border-radius: var(--radius-full, 9999px);
    font-size: 10px;
    background: var(--color-bg-surface);
  }

  .entity-card-tab--active .entity-card-tab__count {
    background: color-mix(in srgb, var(--entity-color) 20%, transparent);
  }

  /* Content */
  .entity-card-inline__content {
    padding: var(--space-3, 12px);
    max-height: 200px;
    overflow-y: auto;
  }

  .entity-card-notes {
    margin: 0;
    font-size: var(--text-sm, 13px);
    color: var(--color-text-secondary);
    line-height: 1.5;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }

  .entity-card-section {
    margin-bottom: var(--space-3, 12px);
  }

  .entity-card-properties {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
    gap: var(--space-2, 8px);
  }

  @container (max-width: 300px) {
    .entity-card-properties {
      grid-template-columns: 1fr;
    }
  }

  .entity-card-property {
    display: flex;
    flex-direction: column;
    padding: var(--space-2, 8px);
    border-radius: var(--radius-md, 6px);
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    min-width: 0;
  }

  .entity-card-property__key {
    font-size: 10px;
    color: var(--color-text-muted);
    text-transform: capitalize;
  }

  .entity-card-property__value {
    font-size: var(--text-sm, 13px);
    font-weight: var(--font-medium, 500);
    color: var(--color-text);
  }

  .entity-card-empty {
    text-align: center;
    padding: var(--space-4, 16px);
    color: var(--color-text-muted);
    font-size: var(--text-sm, 13px);
  }

  /* Relations */
  .entity-card-relations {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: var(--space-2, 8px);
  }

  @container (max-width: 350px) {
    .entity-card-relations {
      grid-template-columns: 1fr;
    }
  }

  .entity-card-relation {
    display: flex;
    align-items: center;
    gap: var(--space-2, 8px);
    padding: var(--space-2, 8px);
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md, 6px);
    cursor: pointer;
    text-align: left;
    transition: background 0.1s, border-color 0.1s;
  }

  .entity-card-relation:hover {
    background: var(--color-bg-hover);
    border-color: color-mix(in srgb, var(--entity-color) 40%, transparent);
  }

  .entity-card-relation__icon {
    width: 24px;
    height: 24px;
    border-radius: var(--radius-sm, 4px);
    background: color-mix(in srgb, var(--entity-color) 15%, transparent);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .entity-card-relation__info {
    display: flex;
    flex-direction: column;
  }

  .entity-card-relation__name {
    font-size: var(--text-sm, 13px);
    font-weight: var(--font-medium, 500);
    color: var(--color-text);
  }

  .entity-card-relation__type {
    font-size: var(--text-xs, 11px);
    color: var(--color-text-muted);
  }

  /* Mentions */
  .entity-card-mention {
    display: block;
    width: 100%;
    padding: var(--space-2, 8px);
    margin-bottom: var(--space-2, 8px);
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md, 6px);
    cursor: pointer;
    text-align: left;
    transition: background 0.1s, border-color 0.1s;
  }

  .entity-card-mention:last-child {
    margin-bottom: 0;
  }

  .entity-card-mention:hover {
    background: var(--color-bg-hover);
    border-color: color-mix(in srgb, var(--entity-color) 40%, transparent);
  }

  .entity-card-mention__title {
    display: block;
    font-size: var(--text-sm, 13px);
    font-weight: var(--font-medium, 500);
    color: var(--color-text);
    margin-bottom: var(--space-1, 4px);
  }

  .entity-card-mention__excerpt {
    margin: 0;
    font-size: var(--text-xs, 12px);
    color: var(--color-text-secondary);
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
`;

export default EntityCardNodeView;
