/**
 * ManifestPanel for Tauri (React DOM)
 *
 * Uses @mythos/manifest for shared tree logic.
 */

import { Search, ChevronDown, ChevronRight, User, MapPin, Box, Zap, Users, BookOpen, FileText, Bookmark, Edit3 } from 'lucide-react';
import {
  useManifestTree,
  useTreeExpansion,
  useManifestSearch,
  type TreeNode,
  type ManifestSection,
  type ManifestMemory,
  type TreeExpansionState,
} from '@mythos/manifest';
import type { Entity } from '@mythos/core';
import type { Document } from '@mythos/core/schema';

// Mock data
const MOCK_DOCUMENTS: Document[] = [
  { id: 'ch1', projectId: 'p1', type: 'chapter', title: 'Chapter 1: The Beginning', orderIndex: 0, wordCount: 2500, createdAt: new Date(), updatedAt: new Date() },
  { id: 'sc1', projectId: 'p1', type: 'scene', parentId: 'ch1', title: 'Scene 1: Dawn', orderIndex: 0, wordCount: 800, createdAt: new Date(), updatedAt: new Date() },
  { id: 'sc2', projectId: 'p1', type: 'scene', parentId: 'ch1', title: 'Scene 2: Journey', orderIndex: 1, wordCount: 1200, createdAt: new Date(), updatedAt: new Date() },
  { id: 'ch2', projectId: 'p1', type: 'chapter', title: 'Chapter 2: The Conflict', orderIndex: 1, wordCount: 3200, createdAt: new Date(), updatedAt: new Date() },
];

const MOCK_ENTITIES: Entity[] = [
  { id: 'e1', name: 'Marcus', type: 'character', aliases: ['Marc'], properties: {}, mentions: [], createdAt: new Date(), updatedAt: new Date() },
  { id: 'e2', name: 'Elena', type: 'character', aliases: [], properties: {}, mentions: [], createdAt: new Date(), updatedAt: new Date() },
  { id: 'e3', name: 'The Castle', type: 'location', aliases: ['Fortress'], properties: {}, mentions: [], createdAt: new Date(), updatedAt: new Date() },
];

const MOCK_MEMORIES: ManifestMemory[] = [
  { id: 'm1', category: 'decision', content: 'Marcus has blue eyes and brown hair', createdAt: new Date().toISOString(), metadata: { pinned: true } },
  { id: 'm2', category: 'style', content: 'Use short, punchy sentences for action scenes', createdAt: new Date().toISOString() },
];

export function ManifestPanel() {
  const search = useManifestSearch();

  const manifestData = useManifestTree({
    documents: MOCK_DOCUMENTS,
    entities: MOCK_ENTITIES,
    memories: MOCK_MEMORIES,
    searchQuery: search.query,
  });

  const expansion = useTreeExpansion(['chapters', 'story-bible', 'character']);

  return (
    <div className="manifest-panel">
      {/* Header */}
      <div className="manifest-header">
        <span className="manifest-logo">Mythos</span>
      </div>

      {/* Search */}
      <div className="manifest-search">
        <Search size={14} className="search-icon" />
        <input
          type="text"
          placeholder="Search..."
          value={search.query}
          onChange={(e) => search.setQuery(e.target.value)}
          className="search-input"
        />
      </div>

      {/* Content */}
      <div className="manifest-content">
        {manifestData.sections.map((section) => (
          <SectionComponent
            key={section.id}
            section={section}
            expansion={expansion}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="manifest-footer">
        <span>{manifestData.chapterCount} chapters</span>
        <span>{manifestData.totalWordCount.toLocaleString()} words</span>
      </div>

      <style>{`
        .manifest-panel {
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .manifest-header {
          padding: 12px 16px;
          border-bottom: 1px solid var(--mythos-border);
        }

        .manifest-logo {
          font-size: 16px;
          font-weight: 600;
          color: var(--mythos-text);
        }

        .manifest-search {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 8px 12px;
          padding: 8px 12px;
          border: 1px solid var(--mythos-border);
          border-radius: 6px;
        }

        .search-icon {
          color: var(--mythos-text-muted);
        }

        .search-input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          color: var(--mythos-text);
          font-size: 13px;
        }

        .search-input::placeholder {
          color: var(--mythos-text-muted);
        }

        .manifest-content {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
        }

        .manifest-footer {
          padding: 8px 16px;
          border-top: 1px solid var(--mythos-border);
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          color: var(--mythos-text-muted);
        }

        .section {
          margin-bottom: 4px;
        }

        .section-header {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 8px;
          border-radius: 4px;
          cursor: pointer;
          user-select: none;
        }

        .section-header:hover {
          background: var(--mythos-hover);
        }

        .section-title {
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.5px;
          color: var(--mythos-text-muted);
          text-transform: uppercase;
        }

        .section-count {
          font-size: 10px;
          color: var(--mythos-text-muted);
        }

        .section-spacer {
          flex: 1;
        }

        .tree-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 8px;
          border-radius: 4px;
          cursor: pointer;
        }

        .tree-row:hover {
          background: var(--mythos-hover);
        }

        .tree-chevron {
          width: 14px;
          color: var(--mythos-text-muted);
        }

        .tree-icon {
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
        }

        .tree-label {
          flex: 1;
          font-size: 13px;
          color: var(--mythos-text-secondary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .tree-wordcount {
          font-size: 10px;
          color: var(--mythos-text-muted);
          font-family: monospace;
        }
      `}</style>
    </div>
  );
}

function SectionComponent({
  section,
  expansion,
}: {
  section: ManifestSection;
  expansion: TreeExpansionState;
}) {
  const isExpanded = expansion.isExpanded(section.id);

  return (
    <div className="section">
      <div className="section-header" onClick={() => expansion.toggle(section.id)}>
        {isExpanded ? (
          <ChevronDown size={12} color="var(--mythos-text-muted)" />
        ) : (
          <ChevronRight size={12} color="var(--mythos-text-muted)" />
        )}
        <span className="section-title">{section.title}</span>
        {section.count !== undefined && section.count > 0 && (
          <span className="section-count">{section.count}</span>
        )}
        <span className="section-spacer" />
      </div>

      {isExpanded && (
        <div style={{ marginLeft: 4 }}>
          {section.children.map((node) => (
            <TreeRowComponent
              key={node.id}
              node={node}
              depth={0}
              expansion={expansion}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TreeRowComponent({
  node,
  depth,
  expansion,
}: {
  node: TreeNode;
  depth: number;
  expansion: TreeExpansionState;
}) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expansion.isExpanded(node.id);
  const Icon = getNodeIcon(node);
  const iconColor = getNodeColor(node);

  return (
    <div>
      <div
        className="tree-row"
        style={{ paddingLeft: 8 + depth * 12 }}
        onClick={() => hasChildren && expansion.toggle(node.id)}
      >
        <span className="tree-chevron">
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown size={12} />
            ) : (
              <ChevronRight size={12} />
            )
          ) : null}
        </span>

        <span
          className="tree-icon"
          style={{ background: `${iconColor}20` }}
        >
          <Icon size={12} color={iconColor} />
        </span>

        <span className="tree-label">{node.name}</span>

        {node.wordCount !== undefined && node.wordCount > 0 && (
          <span className="tree-wordcount">
            {node.wordCount >= 1000
              ? `${(node.wordCount / 1000).toFixed(1)}k`
              : node.wordCount}
          </span>
        )}
      </div>

      {isExpanded && hasChildren && (
        <div>
          {node.children!.map((child) => (
            <TreeRowComponent
              key={child.id}
              node={child}
              depth={depth + 1}
              expansion={expansion}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function getNodeIcon(node: TreeNode) {
  switch (node.type) {
    case 'folder':
      return ChevronRight;
    case 'chapter':
      return BookOpen;
    case 'scene':
      return FileText;
    case 'entity':
      switch (node.entityType) {
        case 'character':
          return User;
        case 'location':
          return MapPin;
        case 'item':
          return Box;
        case 'magic_system':
          return Zap;
        case 'faction':
          return Users;
        default:
          return FileText;
      }
    case 'memory':
      if (node.memoryCategory === 'decision') return Bookmark;
      if (node.memoryCategory === 'style') return Edit3;
      return Bookmark;
    default:
      return FileText;
  }
}

function getNodeColor(node: TreeNode): string {
  if (node.color) return node.color;

  switch (node.entityType) {
    case 'character':
      return 'var(--mythos-entity-character)';
    case 'location':
      return 'var(--mythos-entity-location)';
    case 'item':
      return 'var(--mythos-entity-item)';
    case 'magic_system':
      return 'var(--mythos-entity-magic)';
    case 'faction':
      return 'var(--mythos-entity-faction)';
    default:
      return 'var(--mythos-text-secondary)';
  }
}
