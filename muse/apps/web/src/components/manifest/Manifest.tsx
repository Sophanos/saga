import { useState, useMemo, useCallback } from "react";
import {
  ChevronRight,
  ChevronDown,
  FileText,
  FolderOpen,
  User,
  MapPin,
  Sword,
  Sparkles,
  Users,
} from "lucide-react";
import { ScrollArea } from "@mythos/ui";
import type { Entity, EntityType } from "@mythos/core";
import { useEntities, useDocuments, useMythosStore } from "../../stores";

interface TreeNode {
  id: string;
  name: string;
  type: "folder" | "file" | "entity";
  entityType?: EntityType;
  children?: TreeNode[];
  entity?: Entity;
}

function getEntityIcon(entityType?: string) {
  switch (entityType) {
    case "character":
      return <User className="w-4 h-4 text-mythos-entity-character" />;
    case "location":
      return <MapPin className="w-4 h-4 text-mythos-entity-location" />;
    case "item":
      return <Sword className="w-4 h-4 text-mythos-entity-item" />;
    case "magic_system":
      return <Sparkles className="w-4 h-4 text-mythos-entity-magic" />;
    case "faction":
      return <Users className="w-4 h-4 text-mythos-accent-amber" />;
    default:
      return <FileText className="w-4 h-4 text-mythos-text-muted" />;
  }
}

interface TreeItemProps {
  node: TreeNode;
  depth?: number;
  selectedId: string | null;
  onSelect: (node: TreeNode) => void;
}

function TreeItem({ node, depth = 0, selectedId, onSelect }: TreeItemProps) {
  const [isOpen, setIsOpen] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = node.id === selectedId;

  const handleClick = () => {
    if (hasChildren) {
      setIsOpen(!isOpen);
    } else {
      onSelect(node);
    }
  };

  return (
    <div>
      <button
        onClick={handleClick}
        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left transition-colors ${
          isSelected
            ? "bg-mythos-accent-purple/20 text-mythos-accent-purple"
            : "hover:bg-mythos-bg-tertiary text-mythos-text-secondary"
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {hasChildren ? (
          isOpen ? (
            <ChevronDown className="w-4 h-4 text-mythos-text-muted" />
          ) : (
            <ChevronRight className="w-4 h-4 text-mythos-text-muted" />
          )
        ) : (
          <span className="w-4" />
        )}
        {node.type === "folder" ? (
          <FolderOpen className="w-4 h-4 text-mythos-accent-amber" />
        ) : (
          getEntityIcon(node.entityType)
        )}
        <span className="truncate">{node.name}</span>
      </button>
      {isOpen && hasChildren && (
        <div>
          {node.children!.map((child) => (
            <TreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Build the manifest tree from real store data
 */
function useManifestTree(): TreeNode[] {
  const entities = useEntities();
  const documents = useDocuments();

  return useMemo(() => {
    // Group entities by type
    const characterEntities = entities.filter((e) => e.type === "character");
    const locationEntities = entities.filter((e) => e.type === "location");
    const itemEntities = entities.filter((e) => e.type === "item");
    const magicEntities = entities.filter((e) => e.type === "magic_system");
    const factionEntities = entities.filter((e) => e.type === "faction");

    // Group documents by type
    const chapters = documents.filter((d) => d.type === "chapter");
    const scenes = documents.filter((d) => d.type === "scene");
    const notes = documents.filter((d) => d.type === "note");

    const tree: TreeNode[] = [];

    // Chapters folder
    if (chapters.length > 0 || scenes.length > 0) {
      tree.push({
        id: "chapters",
        name: "Chapters",
        type: "folder",
        children: chapters.map((doc) => ({
          id: doc.id,
          name: doc.title || `Chapter ${doc.orderIndex + 1}`,
          type: "file" as const,
        })),
      });
    }

    // Characters folder
    if (characterEntities.length > 0) {
      tree.push({
        id: "characters",
        name: "Characters",
        type: "folder",
        children: characterEntities.map((entity) => ({
          id: entity.id,
          name: entity.name,
          type: "entity" as const,
          entityType: "character" as EntityType,
          entity,
        })),
      });
    }

    // Locations folder
    if (locationEntities.length > 0) {
      tree.push({
        id: "locations",
        name: "Locations",
        type: "folder",
        children: locationEntities.map((entity) => ({
          id: entity.id,
          name: entity.name,
          type: "entity" as const,
          entityType: "location" as EntityType,
          entity,
        })),
      });
    }

    // Items folder
    if (itemEntities.length > 0) {
      tree.push({
        id: "items",
        name: "Items & Artifacts",
        type: "folder",
        children: itemEntities.map((entity) => ({
          id: entity.id,
          name: entity.name,
          type: "entity" as const,
          entityType: "item" as EntityType,
          entity,
        })),
      });
    }

    // Magic Systems folder
    if (magicEntities.length > 0) {
      tree.push({
        id: "magic",
        name: "Magic Systems",
        type: "folder",
        children: magicEntities.map((entity) => ({
          id: entity.id,
          name: entity.name,
          type: "entity" as const,
          entityType: "magic_system" as EntityType,
          entity,
        })),
      });
    }

    // Factions folder
    if (factionEntities.length > 0) {
      tree.push({
        id: "factions",
        name: "Factions",
        type: "folder",
        children: factionEntities.map((entity) => ({
          id: entity.id,
          name: entity.name,
          type: "entity" as const,
          entityType: "faction" as EntityType,
          entity,
        })),
      });
    }

    // Notes folder
    if (notes.length > 0) {
      tree.push({
        id: "notes",
        name: "Notes",
        type: "folder",
        children: notes.map((doc) => ({
          id: doc.id,
          name: doc.title || "Untitled Note",
          type: "file" as const,
        })),
      });
    }

    return tree;
  }, [entities, documents]);
}

export function Manifest() {
  const tree = useManifestTree();
  const selectedEntityId = useMythosStore((state) => state.world.selectedEntityId);
  const setSelectedEntity = useMythosStore((state) => state.setSelectedEntity);
  const showHud = useMythosStore((state) => state.showHud);

  // Handle node selection - show HUD for entities
  const handleSelect = useCallback(
    (node: TreeNode) => {
      if (node.type === "entity" && node.entity) {
        setSelectedEntity(node.entity.id);
        // Show HUD at a fixed position in the manifest area
        showHud(node.entity, { x: 280, y: 200 });
      }
      // TODO: Handle document selection (load into editor)
    },
    [setSelectedEntity, showHud]
  );

  // Show empty state if no data
  const isEmpty = tree.length === 0;

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-mythos-text-muted/20">
        <h2 className="text-xs font-semibold text-mythos-text-muted uppercase tracking-wider">
          Manifest
        </h2>
      </div>
      <ScrollArea className="flex-1 p-2">
        {isEmpty ? (
          <div className="p-4 text-center text-mythos-text-muted text-sm">
            <p>No entities or documents yet.</p>
            <p className="mt-2 text-xs">Paste content to detect entities or create them manually.</p>
          </div>
        ) : (
          tree.map((node) => (
            <TreeItem
              key={node.id}
              node={node}
              selectedId={selectedEntityId}
              onSelect={handleSelect}
            />
          ))
        )}
      </ScrollArea>
    </div>
  );
}
