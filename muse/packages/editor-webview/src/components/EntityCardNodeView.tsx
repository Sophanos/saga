/**
 * EntityCardNodeView - Inline entity card for TipTap
 *
 * Uses CSS variables for theme adaptation (light/dark).
 * Entity colors use Notion semantic palette from @mythos/theme
 */

import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { useState, useCallback, useEffect } from 'react';
import {
  notion,
  getNotionColorForEntity,
  type NotionColorName,
} from '@mythos/theme';
import { MOCK_ENTITIES, type EntityData, type EntityType } from './EntityFloatingCard';

// ============================================================================
// Icons
// ============================================================================

const IconUser = ({ color, size = 18 }: { color: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4" />
    <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
  </svg>
);

const IconMapPin = ({ color, size = 18 }: { color: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 21c-4-4-8-7.5-8-12a8 8 0 1 1 16 0c0 4.5-4 8-8 12z" />
    <circle cx="12" cy="9" r="2.5" />
  </svg>
);

const IconSword = ({ color, size = 18 }: { color: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="m14.5 17.5-10-10V4h3.5l10 10" />
    <path d="m13 19 6-6M16 16l4 4M19 21l2-2" />
  </svg>
);

const IconZap = ({ color, size = 18 }: { color: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
  </svg>
);

const IconUsers = ({ color, size = 18 }: { color: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="10" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const IconSparkle = ({ color, size = 18 }: { color: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z" />
  </svg>
);

const IconChevron = ({ direction, size = 14 }: { direction: 'down' | 'right'; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d={direction === 'down' ? 'm6 9 6 6 6-6' : 'm9 18 6-6-6-6'} />
  </svg>
);

const IconX = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

// Graph icon - network/nodes visualization
const IconGraph = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6" cy="6" r="3" />
    <circle cx="18" cy="6" r="3" />
    <circle cx="12" cy="18" r="3" />
    <path d="M8.5 7.5 11 16" />
    <path d="M15.5 7.5 13 16" />
  </svg>
);

// Pin icon - keep card visible
const IconPin = ({ size = 14, pinned = false }: { size?: number; pinned?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 17v5" />
    <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1z" />
    <path d="M10 5V3" />
    <path d="M14 5V3" />
  </svg>
);

// Minimize icon
const IconMinus = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14" />
  </svg>
);

const IconComment = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const IconHistory = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M12 7v5l4 2" />
  </svg>
);

const IconCopy = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </svg>
);

const IconInsert = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
  </svg>
);

const IconSend = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m22 2-7 20-4-9-9-4 20-7z" />
    <path d="m22 2-11 11" />
  </svg>
);

// Helper to format relative time
function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function getEntityIcon(type: string, color: string, size = 18) {
  const icons: Record<string, JSX.Element> = {
    character: <IconUser color={color} size={size} />,
    location: <IconMapPin color={color} size={size} />,
    item: <IconSword color={color} size={size} />,
    magic_system: <IconZap color={color} size={size} />,
    faction: <IconUsers color={color} size={size} />,
    event: <IconSparkle color={color} size={size} />,
    concept: <IconSparkle color={color} size={size} />,
  };
  return icons[type] ?? <IconSparkle color={color} size={size} />;
}

// ============================================================================
// Component
// ============================================================================

type TabId = 'overview' | 'graph' | 'mentions' | 'history';

// Mock history data
interface HistoryEntry {
  id: string;
  action: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
  timestamp: Date;
  actor: 'user' | 'ai';
}

export function EntityCardNodeView({ node, deleteNode, updateAttributes }: NodeViewProps) {
  const { entityId, entityType, entityName } = node.attrs;

  // Use local state for isExpanded to ensure React re-renders properly
  // TipTap's updateAttributes updates the document but may not trigger re-render
  const [isExpanded, setIsExpanded] = useState<boolean>(node.attrs.isExpanded ?? true);
  const [isPinned, setIsPinned] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [isHovered, setIsHovered] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Sync local state with node attributes when they change externally
  useEffect(() => {
    if (node.attrs.isExpanded !== isExpanded) {
      setIsExpanded(node.attrs.isExpanded ?? true);
    }
  }, [node.attrs.isExpanded]);

  // Auto-collapse when user starts typing elsewhere in the editor (unless pinned)
  useEffect(() => {
    if (!isExpanded || isPinned) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in our own chat input
      const target = e.target as HTMLElement;
      if (target.closest('.entity-card__chat-input')) return;

      // Ignore modifier-only keys
      if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') return;

      // Ignore navigation keys
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) return;

      // If typing in the editor (not in our card), collapse
      if (target.closest('.ProseMirror') && !target.closest('.entity-card')) {
        setIsExpanded(false);
        updateAttributes({ isExpanded: false });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded, isPinned, updateAttributes]);

  // Get entity data (mock for now, will come from Convex)
  // Try multiple matching strategies in order of preference
  const mockKey = Object.keys(MOCK_ENTITIES).find(k => {
    const mockEntity = MOCK_ENTITIES[k];

    // 1. Exact ID match
    if (mockEntity.id === entityId) return true;

    // 2. ID prefix match (e.g., "entity_elena_123" matches "entity_elena")
    if (entityId && mockEntity.id && entityId.startsWith(mockEntity.id)) return true;

    // 3. Entity key in entityId (e.g., "elena" is in "entity_elena_123")
    if (entityId && entityId.toLowerCase().includes(k.toLowerCase())) return true;

    // 4. Name match - exact match first
    if (entityName && mockEntity.name.toLowerCase() === entityName.toLowerCase()) return true;

    // 5. Name match - partial match on first word
    if (entityName) {
      const searchName = entityName.toLowerCase().split(' ')[0];
      if (searchName.length > 2 && mockEntity.name.toLowerCase().includes(searchName)) return true;
    }

    return false;
  });

  const entity: EntityData = mockKey
    ? MOCK_ENTITIES[mockKey]
    : {
        id: entityId,
        name: entityName || 'Unknown Entity',
        type: entityType as EntityType,
        notes: 'No additional details available yet. This entity data will be fetched from the database.',
        properties: {},
        relationships: [],
        mentions: [],
      };

  // Get Notion color - entity can override with notionColor property
  const notionColorName = getNotionColorForEntity(entityType, (entity as any).notionColor);
  const notionColor = {
    light: notion.light[notionColorName],
    dark: notion.dark[notionColorName],
  };

  const handleToggle = useCallback(() => {
    const newExpanded = !isExpanded;
    console.log('[EntityCard] Toggle clicked, changing from', isExpanded, 'to', newExpanded);
    // Update local state immediately for responsive UI
    setIsExpanded(newExpanded);
    // Also update node attributes for persistence
    updateAttributes({ isExpanded: newExpanded });
  }, [isExpanded, updateAttributes]);

  const handleClose = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    deleteNode();
  }, [deleteNode]);

  const properties = entity.properties ?? {};
  const propertyEntries = Object.entries(properties);
  const relationships = entity.relationships ?? [];
  const mentions = entity.mentions ?? [];

  // Mock history entries
  const history: HistoryEntry[] = [
    { id: '1', action: 'created', timestamp: new Date(Date.now() - 86400000 * 3), actor: 'user' },
    { id: '2', action: 'updated', field: 'notes', timestamp: new Date(Date.now() - 86400000 * 2), actor: 'user' },
    { id: '3', action: 'updated', field: 'occupation', oldValue: 'Hunter', newValue: 'Bounty Hunter', timestamp: new Date(Date.now() - 86400000), actor: 'ai' },
    { id: '4', action: 'relationship_added', field: 'Marcus Thorne', timestamp: new Date(Date.now() - 3600000), actor: 'user' },
  ];

  // Iteration chat handler
  const handleChatSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isProcessing) return;

    setIsProcessing(true);
    // TODO: Send to AI for entity refinement
    console.log('Refining entity:', chatInput);

    // Simulate processing
    setTimeout(() => {
      setChatInput('');
      setIsProcessing(false);
    }, 1000);
  }, [chatInput, isProcessing]);

  // Action handlers
  const handleInsert = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    // TODO: Insert entity mention at cursor
    console.log('Insert entity:', entity.name);
  }, [entity.name]);

  const handleCopy = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    // Copy as @mention format for sharing with collaborators/agents
    const mentionText = `@${entity.name}`;
    navigator.clipboard.writeText(mentionText);
    console.log('[EntityCard] Copied mention:', mentionText);
  }, [entity.name]);

  const handleOpenInGraph = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    // Dispatch event to open entity in Artifact Panel graph view
    // Per ENTITY_UX.md: "Click [Graph] → Entity-centric graph opens in Artifact Panel"
    window.dispatchEvent(new CustomEvent('entity:open-graph', {
      detail: { entityId, entityName: entity.name, entityType }
    }));
    console.log('Open in Graph:', entity.name);
  }, [entityId, entity.name, entityType]);

  const handlePin = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPinned(!isPinned);
  }, [isPinned]);

  const handleMinimize = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(false);
    updateAttributes({ isExpanded: false });
  }, [updateAttributes]);

  // Pass colors as CSS variables for theme support
  const colorVars = {
    '--ec-accent': notionColor.dark.text,
    '--ec-accent-bg': notionColor.dark.bg,
    '--ec-accent-light': notionColor.light.text,
    '--ec-accent-bg-light': notionColor.light.bg,
  } as React.CSSProperties;

  return (
    <NodeViewWrapper className="entity-card-wrapper">
      <div
        className={`entity-card ${isExpanded ? 'entity-card--expanded' : ''} ${isHovered ? 'entity-card--hovered' : ''}`}
        style={colorVars}
        contentEditable={false}
        draggable={false}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onMouseDown={(e) => {
          // Allow clicks on interactive elements (inputs, buttons, and the toggle)
          const target = e.target as HTMLElement;
          if (
            target.tagName === 'INPUT' ||
            target.tagName === 'BUTTON' ||
            target.closest('input') ||
            target.closest('button') ||
            target.closest('.entity-card__toggle')
          ) {
            return;
          }
          e.preventDefault();
        }}
      >
        {/* Header */}
        <div className="entity-card__header" onClick={handleToggle}>
          <button
            type="button"
            className="entity-card__toggle"
            onClick={(e) => {
              e.stopPropagation();
              handleToggle();
            }}
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            <IconChevron direction={isExpanded ? 'down' : 'right'} />
          </button>

          <div className="entity-card__avatar">
            {getEntityIcon(entityType, `var(--ec-accent)`)}
          </div>

          <div className="entity-card__title-group">
            <span className="entity-card__name">{entity.name}</span>
            <span className="entity-card__badge">{entityType.replace('_', ' ')}</span>
            {entity.aliases && entity.aliases.length > 0 && (
              <span className="entity-card__alias">aka {entity.aliases[0]}</span>
            )}
          </div>

          <div className="entity-card__actions">
            <button className="entity-card__action-btn" onClick={handleInsert} title="Insert @mention">
              <IconInsert size={14} />
            </button>
            <button className="entity-card__action-btn" onClick={handleCopy} title="Copy @mention">
              <IconCopy size={14} />
            </button>
            <button className="entity-card__action-btn" onClick={handleOpenInGraph} title="Open Graph">
              <IconGraph size={14} />
            </button>
            <button
              className={`entity-card__action-btn ${isPinned ? 'entity-card__action-btn--active' : ''}`}
              onClick={handlePin}
              title={isPinned ? 'Unpin card' : 'Pin card (prevents auto-close)'}
            >
              <IconPin size={14} pinned={isPinned} />
            </button>
            <button className="entity-card__action-btn entity-card__action-btn--close" onClick={handleClose} title="Close">
              <IconX size={14} />
            </button>
          </div>
        </div>

        {/* Body - animated expand/collapse */}
        <div className="entity-card__body">
          <div className="entity-card__body-inner">
            {/* Tabs */}
            <div className="entity-card__tabs">
              {(['overview', 'graph', 'mentions', 'history'] as TabId[]).map((tab) => {
                const count = tab === 'graph' ? relationships.length
                  : tab === 'mentions' ? mentions.length
                  : tab === 'history' ? history.length
                  : 0;
                return (
                  <button
                    key={tab}
                    className={`entity-card__tab ${activeTab === tab ? 'entity-card__tab--active' : ''}`}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    {count > 0 && <span className="entity-card__tab-count">{count}</span>}
                  </button>
                );
              })}
            </div>

            {/* Content */}
            <div className="entity-card__content">
              {activeTab === 'overview' && (
                <>
                  {entity.notes && <p className="entity-card__notes">{entity.notes}</p>}
                  {propertyEntries.length > 0 && (
                    <div className="entity-card__properties">
                      {propertyEntries.map(([key, value]) => (
                        <div key={key} className="entity-card__property">
                          <span className="entity-card__property-key">{key}</span>
                          <span className="entity-card__property-value">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {!entity.notes && propertyEntries.length === 0 && (
                    <div className="entity-card__empty">No details added yet</div>
                  )}
                </>
              )}

              {activeTab === 'graph' && (
                <>
                  {relationships.length === 0 ? (
                    <div className="entity-card__empty">No relationships yet</div>
                  ) : (
                    <div className="entity-card__relations">
                      {relationships.map((rel) => {
                        const relColorName = getNotionColorForEntity(rel.targetType);
                        const relColor = { light: notion.light[relColorName], dark: notion.dark[relColorName] };
                        return (
                          <button
                            key={rel.id}
                            className="entity-card__relation"
                            style={{ '--rel-accent': relColor.dark.text, '--rel-bg': relColor.dark.bg } as React.CSSProperties}
                          >
                            <div className="entity-card__relation-icon">
                              {getEntityIcon(rel.targetType, relColor.dark.text, 14)}
                            </div>
                            <div className="entity-card__relation-info">
                              <span className="entity-card__relation-name">{rel.targetName}</span>
                              <span className="entity-card__relation-type">{rel.relationshipType}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {activeTab === 'mentions' && (
                <>
                  {mentions.length === 0 ? (
                    <div className="entity-card__empty">No mentions found</div>
                  ) : (
                    <div className="entity-card__mentions">
                      {mentions.map((mention) => (
                        <button key={mention.id} className="entity-card__mention">
                          <span className="entity-card__mention-title">{mention.documentTitle}</span>
                          <p className="entity-card__mention-excerpt">{mention.excerpt}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}

              {activeTab === 'history' && (
                <>
                  {history.length === 0 ? (
                    <div className="entity-card__empty">No history yet</div>
                  ) : (
                    <div className="entity-card__history">
                      {history.map((entry) => {
                        const timeAgo = formatTimeAgo(entry.timestamp);
                        return (
                          <div key={entry.id} className="entity-card__history-entry">
                            <div className={`entity-card__history-indicator entity-card__history-indicator--${entry.actor}`} />
                            <div className="entity-card__history-content">
                              <span className="entity-card__history-action">
                                {entry.action === 'created' && 'Created'}
                                {entry.action === 'updated' && `Updated ${entry.field}`}
                                {entry.action === 'relationship_added' && `Added relationship to ${entry.field}`}
                              </span>
                              {entry.oldValue && entry.newValue && (
                                <span className="entity-card__history-change">
                                  <span className="entity-card__history-old">{entry.oldValue}</span>
                                  <span className="entity-card__history-arrow">→</span>
                                  <span className="entity-card__history-new">{entry.newValue}</span>
                                </span>
                              )}
                            </div>
                            <span className="entity-card__history-time">{timeAgo}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Iteration Chat Input */}
            <form className="entity-card__chat" onSubmit={handleChatSubmit}>
              <input
                type="text"
                className="entity-card__chat-input"
                placeholder="Refine with AI... e.g. 'add fear of betrayal'"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={isProcessing}
              />
              <button
                type="submit"
                className={`entity-card__chat-btn ${isProcessing ? 'entity-card__chat-btn--loading' : ''}`}
                disabled={!chatInput.trim() || isProcessing}
              >
                <IconSend size={14} />
              </button>
            </form>
          </div>
        </div>
      </div>

      <style>{styles}</style>
    </NodeViewWrapper>
  );
}

// ============================================================================
// Styles - Uses CSS variables for theme adaptation
// ============================================================================

const styles = `
  .entity-card-wrapper {
    margin: var(--space-3, 12px) 0;
    width: 100%;
    user-select: none;
    -webkit-user-select: none;
  }

  .entity-card {
    /* Use editor's font */
    font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);

    /* Card surface - adapts to theme */
    background: var(--color-bg-elevated, #1e1e1e);
    border-radius: var(--radius-lg, 12px);

    /* Prevent rendering artifacts during animations */
    overflow: hidden;
    isolation: isolate;
    -webkit-transform: translateZ(0);
    transform: translateZ(0);

    /* Visible border with entity accent color on hover */
    border: 1px solid var(--color-border, rgba(255,255,255,0.08));

    /* Subtle shadow for depth */
    box-shadow: var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.2));

    overflow: hidden;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .entity-card--hovered {
    border-color: color-mix(in srgb, var(--ec-accent) 50%, var(--color-border, transparent));
    box-shadow: var(--shadow-md, 0 4px 12px rgba(0,0,0,0.3)), 0 0 0 1px color-mix(in srgb, var(--ec-accent) 20%, transparent);
  }

  /* Header */
  .entity-card__header {
    display: flex;
    align-items: center;
    gap: var(--space-2, 8px);
    padding: var(--space-3, 12px) var(--space-4, 16px);
    cursor: pointer;
    transition: background 0.1s ease;
  }

  .entity-card__header:hover {
    background: var(--color-bg-hover, rgba(255,255,255,0.03));
  }

  .entity-card__toggle {
    color: var(--color-text-muted, rgba(255,255,255,0.4));
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: none;
    border: none;
    padding: 4px;
    margin: -4px;
    border-radius: var(--radius-sm, 4px);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .entity-card__toggle:hover {
    color: var(--color-text, rgba(255,255,255,0.9));
    background: var(--color-bg-hover, rgba(255,255,255,0.06));
  }

  .entity-card__avatar {
    width: 32px;
    height: 32px;
    border-radius: var(--radius-md, 8px);
    background: var(--ec-accent-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .entity-card__avatar svg {
    color: var(--ec-accent);
  }

  .entity-card__title-group {
    display: flex;
    align-items: center;
    gap: var(--space-2, 8px);
    flex: 1;
    min-width: 0;
    overflow: hidden;
  }

  .entity-card__name {
    font-size: var(--text-sm, 14px);
    font-weight: var(--font-semibold, 600);
    color: var(--color-text, rgba(255,255,255,0.9));
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    letter-spacing: -0.01em;
  }

  .entity-card__badge {
    font-size: var(--text-xs, 11px);
    font-weight: var(--font-medium, 500);
    padding: 3px 8px;
    border-radius: var(--radius-sm, 4px);
    background: var(--ec-accent-bg);
    color: var(--ec-accent);
    text-transform: capitalize;
    letter-spacing: 0.01em;
    flex-shrink: 0;
  }

  .entity-card__alias {
    font-size: var(--text-xs, 11px);
    color: var(--color-text-muted, rgba(255,255,255,0.4));
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-style: italic;
  }

  .entity-card__actions {
    display: flex;
    gap: 2px;
    opacity: 0;
    transition: opacity 0.15s ease;
    flex-shrink: 0;
  }

  .entity-card--hovered .entity-card__actions {
    opacity: 1;
  }

  .entity-card__action-btn {
    width: 26px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    border-radius: var(--radius-sm, 4px);
    cursor: pointer;
    color: var(--color-text-muted, rgba(255,255,255,0.4));
    transition: all 0.1s ease;
  }

  .entity-card__action-btn:hover {
    background: var(--color-bg-hover, rgba(255,255,255,0.06));
    color: var(--color-text, rgba(255,255,255,0.9));
  }

  .entity-card__action-btn--close:hover {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
  }

  .entity-card__action-btn--active {
    color: var(--ec-accent);
    background: color-mix(in srgb, var(--ec-accent) 15%, transparent);
  }

  .entity-card__action-btn--active:hover {
    background: color-mix(in srgb, var(--ec-accent) 20%, transparent);
    color: var(--ec-accent);
  }

  /* Body - animated */
  .entity-card__body {
    display: grid;
    grid-template-rows: 0fr;
    transition: grid-template-rows 0.25s ease;
    border-top: 1px solid transparent;
  }

  .entity-card--expanded .entity-card__body {
    grid-template-rows: 1fr;
    border-top-color: var(--color-border, rgba(255,255,255,0.06));
  }

  .entity-card__body-inner {
    overflow: hidden;
  }

  /* Tabs */
  .entity-card__tabs {
    display: flex;
    gap: var(--space-2, 8px);
    padding: var(--space-3, 12px) var(--space-5, 20px);
    background: var(--color-bg-surface, rgba(0,0,0,0.15));
    border-bottom: 1px solid var(--color-border, rgba(255,255,255,0.04));
  }

  .entity-card__tab {
    display: flex;
    align-items: center;
    gap: var(--space-1-5, 6px);
    padding: var(--space-2, 8px) var(--space-3, 12px);
    border: none;
    background: transparent;
    border-radius: var(--radius-md, 8px);
    cursor: pointer;
    font-family: inherit;
    font-size: var(--text-xs, 12px);
    font-weight: var(--font-medium, 500);
    color: var(--color-text-muted, rgba(255,255,255,0.45));
    transition: all 0.15s ease;
    white-space: nowrap;
  }

  .entity-card__tab:hover {
    background: var(--color-bg-hover, rgba(255,255,255,0.04));
    color: var(--color-text-secondary, rgba(255,255,255,0.6));
  }

  .entity-card__tab--active {
    background: var(--color-bg-hover, rgba(255,255,255,0.06));
    color: var(--ec-accent);
  }

  .entity-card__tab-count {
    font-size: 10px;
    font-weight: var(--font-semibold, 600);
    padding: 2px 6px;
    border-radius: var(--radius-full, 99px);
    background: var(--color-bg-active, rgba(255,255,255,0.06));
  }

  .entity-card__tab--active .entity-card__tab-count {
    background: color-mix(in srgb, var(--ec-accent) 20%, transparent);
    color: var(--ec-accent);
  }

  /* Content */
  .entity-card__content {
    padding: var(--space-4, 16px) var(--space-5, 20px);
    max-height: 280px;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .entity-card__notes {
    margin: 0 0 var(--space-5, 20px);
    font-size: var(--text-sm, 14px);
    color: var(--color-text-secondary, rgba(255,255,255,0.75));
    line-height: 1.65;
    padding-bottom: var(--space-4, 16px);
    border-bottom: 1px solid var(--color-border, rgba(255,255,255,0.06));
  }

  .entity-card__properties {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    gap: var(--space-3, 12px);
    margin-top: var(--space-2, 8px);
  }

  .entity-card__property {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: var(--space-3, 12px) var(--space-4, 16px);
    background: var(--color-bg-surface, rgba(255,255,255,0.03));
    border-radius: var(--radius-md, 8px);
    border: 1px solid var(--color-border, rgba(255,255,255,0.04));
  }

  .entity-card__property-key {
    font-size: 10px;
    font-weight: var(--font-medium, 500);
    color: var(--color-text-muted, rgba(255,255,255,0.35));
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .entity-card__property-value {
    font-size: var(--text-sm, 13px);
    font-weight: var(--font-medium, 500);
    color: var(--color-text, rgba(255,255,255,0.9));
  }

  .entity-card__empty {
    text-align: center;
    padding: var(--space-6, 24px);
    color: var(--color-text-muted, rgba(255,255,255,0.3));
    font-size: var(--text-sm, 13px);
    font-style: italic;
  }

  /* Relations */
  .entity-card__relations {
    display: flex;
    flex-direction: column;
    gap: var(--space-3, 12px);
  }

  .entity-card__relation {
    display: flex;
    align-items: center;
    gap: var(--space-3, 12px);
    padding: var(--space-3, 12px) var(--space-4, 16px);
    background: var(--color-bg-surface, rgba(255,255,255,0.03));
    border: 1px solid var(--color-border, rgba(255,255,255,0.04));
    border-radius: var(--radius-md, 8px);
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    transition: all 0.15s ease;
  }

  .entity-card__relation:hover {
    background: var(--color-bg-hover, rgba(255,255,255,0.05));
    border-color: color-mix(in srgb, var(--rel-accent, var(--ec-accent)) 30%, transparent);
    transform: translateX(2px);
  }

  .entity-card__relation-icon {
    width: 32px;
    height: 32px;
    border-radius: var(--radius-md, 8px);
    background: var(--rel-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .entity-card__relation-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    flex: 1;
  }

  .entity-card__relation-name {
    font-size: var(--text-sm, 14px);
    font-weight: var(--font-medium, 500);
    color: var(--color-text, rgba(255,255,255,0.9));
  }

  .entity-card__relation-type {
    font-size: var(--text-xs, 12px);
    color: var(--color-text-muted, rgba(255,255,255,0.45));
    text-transform: capitalize;
  }

  /* Mentions */
  .entity-card__mentions {
    display: flex;
    flex-direction: column;
    gap: var(--space-3, 12px);
  }

  .entity-card__mention {
    display: block;
    width: 100%;
    padding: var(--space-3, 12px) var(--space-4, 16px);
    background: var(--color-bg-surface, rgba(255,255,255,0.03));
    border: 1px solid var(--color-border, rgba(255,255,255,0.04));
    border-radius: var(--radius-md, 8px);
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    transition: all 0.15s ease;
  }

  .entity-card__mention:hover {
    background: var(--color-bg-hover, rgba(255,255,255,0.05));
    border-color: color-mix(in srgb, var(--ec-accent) 25%, transparent);
  }

  .entity-card__mention-title {
    display: block;
    font-size: var(--text-sm, 14px);
    font-weight: var(--font-medium, 500);
    color: var(--color-text, rgba(255,255,255,0.9));
    margin-bottom: var(--space-2, 8px);
  }

  .entity-card__mention-excerpt {
    margin: 0;
    font-size: var(--text-sm, 13px);
    color: var(--color-text-secondary, rgba(255,255,255,0.6));
    line-height: 1.6;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    font-style: italic;
  }

  /* History */
  .entity-card__history {
    display: flex;
    flex-direction: column;
    gap: var(--space-3, 12px);
  }

  .entity-card__history-entry {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3, 12px);
    padding: var(--space-3, 12px) var(--space-4, 16px);
    background: var(--color-bg-surface, rgba(255,255,255,0.03));
    border: 1px solid var(--color-border, rgba(255,255,255,0.04));
    border-radius: var(--radius-md, 8px);
  }

  .entity-card__history-indicator {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    margin-top: 4px;
    flex-shrink: 0;
    box-shadow: 0 0 0 2px var(--color-bg-elevated, #1e1e1e);
  }

  .entity-card__history-indicator--user {
    background: var(--ec-accent);
  }

  .entity-card__history-indicator--ai {
    background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%);
  }

  .entity-card__history-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .entity-card__history-action {
    font-size: var(--text-sm, 14px);
    color: var(--color-text, rgba(255,255,255,0.9));
  }

  .entity-card__history-change {
    font-size: var(--text-xs, 12px);
    display: flex;
    align-items: center;
    gap: var(--space-2, 8px);
    padding: var(--space-1, 4px) 0;
  }

  .entity-card__history-old {
    color: var(--color-text-muted, rgba(255,255,255,0.4));
    text-decoration: line-through;
    background: rgba(239, 68, 68, 0.1);
    padding: 2px 6px;
    border-radius: 4px;
  }

  .entity-card__history-arrow {
    color: var(--color-text-muted, rgba(255,255,255,0.35));
    font-size: 14px;
  }

  .entity-card__history-new {
    color: var(--ec-accent);
    font-weight: var(--font-medium, 500);
    background: color-mix(in srgb, var(--ec-accent) 15%, transparent);
    padding: 2px 6px;
    border-radius: 4px;
  }

  .entity-card__history-time {
    font-size: var(--text-xs, 11px);
    color: var(--color-text-muted, rgba(255,255,255,0.4));
    flex-shrink: 0;
    margin-top: 2px;
  }

  /* Iteration Chat */
  .entity-card__chat {
    display: flex;
    align-items: center;
    gap: var(--space-3, 12px);
    padding: var(--space-4, 16px) var(--space-5, 20px);
    border-top: 1px solid var(--color-border, rgba(255,255,255,0.06));
    background: linear-gradient(to bottom, var(--color-bg-surface, rgba(0,0,0,0.1)), var(--color-bg-elevated, rgba(0,0,0,0.15)));
  }

  .entity-card__chat-input {
    flex: 1;
    background: var(--color-bg-app, rgba(0,0,0,0.3));
    border: 1px solid var(--color-border, rgba(255,255,255,0.08));
    border-radius: var(--radius-lg, 12px);
    padding: var(--space-3, 12px) var(--space-4, 16px);
    font-family: inherit;
    font-size: var(--text-sm, 14px);
    color: var(--color-text, rgba(255,255,255,0.9));
    outline: none;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .entity-card__chat-input::placeholder {
    color: var(--color-text-muted, rgba(255,255,255,0.35));
  }

  .entity-card__chat-input:focus {
    border-color: var(--ec-accent);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--ec-accent) 20%, transparent);
  }

  .entity-card__chat-input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .entity-card__chat-btn {
    width: 38px;
    height: 38px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--ec-accent);
    border: none;
    border-radius: var(--radius-lg, 12px);
    cursor: pointer;
    color: white;
    transition: all 0.15s ease;
    flex-shrink: 0;
    box-shadow: 0 2px 8px color-mix(in srgb, var(--ec-accent) 40%, transparent);
  }

  .entity-card__chat-btn:hover:not(:disabled) {
    filter: brightness(1.15);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px color-mix(in srgb, var(--ec-accent) 50%, transparent);
  }

  .entity-card__chat-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
    box-shadow: none;
  }

  .entity-card__chat-btn--loading {
    animation: entity-card-pulse 1s ease-in-out infinite;
  }

  @keyframes entity-card-pulse {
    0%, 100% { opacity: 0.6; }
    50% { opacity: 1; }
  }
`;

export default EntityCardNodeView;
