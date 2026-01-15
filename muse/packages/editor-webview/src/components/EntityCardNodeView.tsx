/**
 * EntityCardNodeView - Inline entity card for TipTap
 *
 * Uses CSS variables for theme adaptation (light/dark).
 * Entity colors use Notion semantic palette from @mythos/theme
 */

import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { useState, useCallback } from 'react';
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

const IconGraph = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="2" />
    <circle cx="19" cy="5" r="1.5" />
    <circle cx="5" cy="19" r="1.5" />
    <circle cx="19" cy="19" r="1.5" />
    <path d="m13.5 10.5 4-4M10.5 13.5l-4 4M13.5 13.5l4 4" />
  </svg>
);

const IconComment = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

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

type TabId = 'overview' | 'graph' | 'mentions';

export function EntityCardNodeView({ node, deleteNode, updateAttributes }: NodeViewProps) {
  const { entityId, entityType, entityName, isExpanded } = node.attrs;
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [isHovered, setIsHovered] = useState(false);

  // Get entity data (mock for now, will come from Convex)
  const mockKey = Object.keys(MOCK_ENTITIES).find(
    k => MOCK_ENTITIES[k].name.toLowerCase().includes(entityName.toLowerCase().split(' ')[0])
  );
  const entity: EntityData = mockKey
    ? MOCK_ENTITIES[mockKey]
    : { id: entityId, name: entityName, type: entityType as EntityType };

  // Get Notion color - entity can override with notionColor property
  const notionColorName = getNotionColorForEntity(entityType, (entity as any).notionColor);
  const notionColor = {
    light: notion.light[notionColorName],
    dark: notion.dark[notionColorName],
  };

  const handleToggle = useCallback(() => {
    updateAttributes({ isExpanded: !isExpanded });
  }, [isExpanded, updateAttributes]);

  const handleClose = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    deleteNode();
  }, [deleteNode]);

  const properties = entity.properties ?? {};
  const propertyEntries = Object.entries(properties);
  const relationships = entity.relationships ?? [];
  const mentions = entity.mentions ?? [];

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
        onMouseDown={(e) => e.preventDefault()}
      >
        {/* Header */}
        <div className="entity-card__header" onClick={handleToggle}>
          <div className="entity-card__toggle">
            <IconChevron direction={isExpanded ? 'down' : 'right'} />
          </div>

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
            <button className="entity-card__action-btn" onClick={(e) => e.stopPropagation()} title="Open in Graph">
              <IconGraph size={14} />
            </button>
            <button className="entity-card__action-btn" onClick={(e) => e.stopPropagation()} title="Edit">
              <IconComment size={14} />
            </button>
            <button className="entity-card__close-btn" onClick={handleClose} title="Remove">
              <IconX size={14} />
            </button>
          </div>
        </div>

        {/* Body - animated expand/collapse */}
        <div className="entity-card__body">
          <div className="entity-card__body-inner">
            {/* Tabs */}
            <div className="entity-card__tabs">
              {(['overview', 'graph', 'mentions'] as TabId[]).map((tab) => {
                const count = tab === 'graph' ? relationships.length : tab === 'mentions' ? mentions.length : 0;
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
            </div>
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
    flex-shrink: 0;
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
    gap: var(--space-1, 4px);
    opacity: 0;
    transition: opacity 0.15s ease;
    flex-shrink: 0;
  }

  .entity-card--hovered .entity-card__actions {
    opacity: 1;
  }

  .entity-card__action-btn,
  .entity-card__close-btn {
    width: 28px;
    height: 28px;
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

  .entity-card__close-btn:hover {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
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
    gap: var(--space-1, 4px);
    padding: var(--space-2, 8px) var(--space-4, 16px);
    background: var(--color-bg-surface, rgba(0,0,0,0.2));
  }

  .entity-card__tab {
    display: flex;
    align-items: center;
    gap: var(--space-1, 4px);
    padding: var(--space-2, 8px) var(--space-3, 12px);
    border: none;
    background: transparent;
    border-radius: var(--radius-sm, 4px);
    cursor: pointer;
    font-family: inherit;
    font-size: var(--text-xs, 11px);
    font-weight: var(--font-medium, 500);
    color: var(--color-text-muted, rgba(255,255,255,0.4));
    transition: all 0.1s ease;
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
    padding: var(--space-4, 16px);
    max-height: 240px;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .entity-card__notes {
    margin: 0 0 var(--space-3, 12px);
    font-size: var(--text-sm, 13px);
    color: var(--color-text-secondary, rgba(255,255,255,0.7));
    line-height: 1.6;
  }

  .entity-card__properties {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: var(--space-2, 8px);
  }

  .entity-card__property {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--space-2, 8px) var(--space-3, 12px);
    background: var(--color-bg-surface, rgba(255,255,255,0.02));
    border-radius: var(--radius-sm, 4px);
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
    gap: var(--space-2, 8px);
  }

  .entity-card__relation {
    display: flex;
    align-items: center;
    gap: var(--space-2, 8px);
    padding: var(--space-2, 8px);
    background: var(--color-bg-surface, rgba(255,255,255,0.02));
    border: none;
    border-radius: var(--radius-sm, 4px);
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    transition: background 0.1s ease;
  }

  .entity-card__relation:hover {
    background: var(--color-bg-hover, rgba(255,255,255,0.04));
  }

  .entity-card__relation-icon {
    width: 26px;
    height: 26px;
    border-radius: var(--radius-sm, 4px);
    background: var(--rel-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .entity-card__relation-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  .entity-card__relation-name {
    font-size: var(--text-sm, 13px);
    font-weight: var(--font-medium, 500);
    color: var(--color-text, rgba(255,255,255,0.9));
  }

  .entity-card__relation-type {
    font-size: var(--text-xs, 11px);
    color: var(--color-text-muted, rgba(255,255,255,0.4));
  }

  /* Mentions */
  .entity-card__mentions {
    display: flex;
    flex-direction: column;
    gap: var(--space-2, 8px);
  }

  .entity-card__mention {
    display: block;
    width: 100%;
    padding: var(--space-3, 12px);
    background: var(--color-bg-surface, rgba(255,255,255,0.02));
    border: none;
    border-radius: var(--radius-sm, 4px);
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    transition: background 0.1s ease;
  }

  .entity-card__mention:hover {
    background: var(--color-bg-hover, rgba(255,255,255,0.04));
  }

  .entity-card__mention-title {
    display: block;
    font-size: var(--text-sm, 13px);
    font-weight: var(--font-medium, 500);
    color: var(--color-text, rgba(255,255,255,0.9));
    margin-bottom: var(--space-1, 4px);
  }

  .entity-card__mention-excerpt {
    margin: 0;
    font-size: var(--text-xs, 12px);
    color: var(--color-text-secondary, rgba(255,255,255,0.5));
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
`;

export default EntityCardNodeView;
