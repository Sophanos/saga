import { useState, useMemo, useCallback, useEffect } from "react";
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
  Search,
  Filter,
  BookOpen,
  Film,
  StickyNote,
  ListTree,
  Globe,
  X,
  Plus,
  Pencil,
  Bookmark,
  Lock,
  Unlock,
  EyeOff,
  Trash2,
} from "lucide-react";
import { ScrollArea, Input, Button, Select } from "@mythos/ui";
import type { Entity, EntityType, Document, DocumentType, Character, Location, Item, MagicSystem, Faction } from "@mythos/core";
import type { MemoryRecord, MemoryCategory } from "@mythos/memory";
import { useEntities, useDocuments, useMythosStore, useCurrentProject } from "../../stores";
import { EntityFormModal, type EntityFormData } from "../modals";
import { useEntityPersistence } from "../../hooks";
import { useMemory } from "../../hooks/useMemory";
import { useRequestProjectStartAction } from "../../stores/projectStart";

interface TreeNode {
  id: string;
  name: string;
  type: "folder" | "file" | "entity" | "memory";
  entityType?: EntityType;
  documentType?: DocumentType;
  memoryCategory?: MemoryCategory;
  children?: TreeNode[];
  entity?: Entity;
  document?: Document;
  memory?: MemoryRecord;
  wordCount?: number;
  parentId?: string;
}

// Document type filter options
const DOCUMENT_TYPE_FILTERS: { value: DocumentType | "all"; label: string }[] = [
  { value: "all", label: "All Types" },
  { value: "chapter", label: "Chapters" },
  { value: "scene", label: "Scenes" },
  { value: "note", label: "Notes" },
  { value: "outline", label: "Outlines" },
  { value: "worldbuilding", label: "Worldbuilding" },
];

// Get icon for document type
function getDocumentIcon(documentType?: DocumentType) {
  switch (documentType) {
    case "chapter":
      return <BookOpen className="w-4 h-4 text-mythos-accent-cyan" />;
    case "scene":
      return <Film className="w-4 h-4 text-mythos-accent-purple" />;
    case "note":
      return <StickyNote className="w-4 h-4 text-mythos-accent-amber" />;
    case "outline":
      return <ListTree className="w-4 h-4 text-mythos-text-secondary" />;
    case "worldbuilding":
      return <Globe className="w-4 h-4 text-mythos-entity-location" />;
    default:
      return <FileText className="w-4 h-4 text-mythos-text-muted" />;
  }
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

function getMemoryIcon(memory?: MemoryRecord) {
  if (!memory) {
    return <FileText className="w-4 h-4 text-mythos-text-muted" />;
  }

  if (memory.metadata?.redacted) {
    return <EyeOff className="w-4 h-4 text-mythos-text-muted" />;
  }

  if (memory.category === "decision") {
    return memory.metadata?.pinned
      ? <Lock className="w-4 h-4 text-mythos-accent-amber" />
      : <Bookmark className="w-4 h-4 text-mythos-accent-amber" />;
  }

  if (memory.category === "style") {
    return <Sparkles className="w-4 h-4 text-mythos-accent-purple" />;
  }

  if (memory.category === "preference") {
    return <Filter className="w-4 h-4 text-mythos-accent-cyan" />;
  }

  return <FileText className="w-4 h-4 text-mythos-text-muted" />;
}

function formatMemoryLabel(memory: MemoryRecord): string {
  const text = memory.content.trim();
  if (!text) return "Untitled memory";
  const firstLine = text.split("\n")[0] ?? text;
  return firstLine.length > 80 ? `${firstLine.slice(0, 77)}...` : firstLine;
}

const START_ACTIONS = [
  { label: "Page", action: "start-blank", icon: FileText },
  { label: "AI Builder", action: "ai-builder", icon: Sparkles },
] as const;

const MEMORY_CATEGORY_OPTIONS: Array<{ id: MemoryCategory; label: string }> = [
  { id: "decision", label: "Canon" },
  { id: "style", label: "Style" },
  { id: "preference", label: "Preferences" },
];

const STORY_BIBLE_CATEGORIES: MemoryCategory[] = [
  "decision",
  "style",
  "preference",
];

const DEFAULT_MEMORY_CATEGORY_CONTROLS: Record<MemoryCategory, boolean> = {
  decision: true,
  style: true,
  preference: true,
  session: false,
};

const DEFAULT_MEMORY_RETENTION_DAYS: Record<MemoryCategory, string> = {
  decision: "",
  style: "",
  preference: "",
  session: "",
};

interface TreeItemProps {
  node: TreeNode;
  depth?: number;
  selectedId: string | null;
  currentDocumentId: string | null;
  selectedMemoryId: string | null;
  onSelect: (node: TreeNode) => void;
  onEdit?: (entity: Entity) => void;
  onPinMemory?: (memoryId: string, pinned: boolean) => void;
  onRedactMemory?: (memoryId: string) => void;
  onForgetMemory?: (memoryId: string) => void;
}

function TreeItem({
  node,
  depth = 0,
  selectedId,
  currentDocumentId,
  selectedMemoryId,
  onSelect,
  onEdit,
  onPinMemory,
  onRedactMemory,
  onForgetMemory,
}: TreeItemProps) {
  const [isOpen, setIsOpen] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const isSelectedEntity = node.type === "entity" && node.id === selectedId;
  const isSelectedDocument = node.type === "file" && node.id === currentDocumentId;
  const isSelectedMemory = node.type === "memory" && node.id === selectedMemoryId;
  const isSelected = isSelectedEntity || isSelectedDocument || isSelectedMemory;
  const isRedactedMemory = node.type === "memory" && node.memory?.metadata?.redacted === true;

  const handleClick = () => {
    if (hasChildren && node.type === "folder") {
      setIsOpen(!isOpen);
    } else {
      onSelect(node);
    }
  };

  // Get the appropriate icon
  const getIcon = () => {
    if (node.type === "folder") {
      return <FolderOpen className="w-4 h-4 text-mythos-accent-amber flex-shrink-0" />;
    }
    if (node.type === "file" && node.documentType) {
      return getDocumentIcon(node.documentType);
    }
    if (node.type === "memory") {
      return getMemoryIcon(node.memory);
    }
    return getEntityIcon(node.entityType);
  };

  // Format word count for display
  const formatWordCount = (count?: number) => {
    if (!count) return null;
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`;
    }
    return count.toString();
  };

  return (
    <div>
      <button
        onClick={handleClick}
        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left transition-colors group ${
          isSelected
            ? "bg-mythos-accent-purple/20 text-mythos-accent-purple"
            : "hover:bg-mythos-bg-tertiary text-mythos-text-secondary"
        } ${isRedactedMemory ? "opacity-70" : ""}`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {hasChildren ? (
          isOpen ? (
            <ChevronDown className="w-4 h-4 text-mythos-text-muted flex-shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-mythos-text-muted flex-shrink-0" />
          )
        ) : (
          <span className="w-4 flex-shrink-0" />
        )}
        {getIcon()}
        <span className="truncate flex-1">{node.name}</span>
        {node.type === "entity" && node.entity && onEdit && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onEdit(node.entity!);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                e.preventDefault();
                onEdit(node.entity!);
              }
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 p-0.5 rounded hover:bg-mythos-bg-primary hover:text-mythos-accent-cyan"
            title="Edit entity"
          >
            <Pencil className="w-3 h-3" />
          </span>
        )}
        {node.type === "memory" && node.memory && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            {node.memory.category === "decision" && onPinMemory && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPinMemory(node.memory!.id, !node.memory!.metadata?.pinned);
                }}
                className="p-0.5 rounded hover:bg-mythos-bg-primary"
                title={node.memory.metadata?.pinned ? "Unpin canon" : "Pin as canon"}
              >
                {node.memory.metadata?.pinned ? (
                  <Unlock className="w-3 h-3 text-mythos-accent-amber" />
                ) : (
                  <Lock className="w-3 h-3 text-mythos-accent-amber" />
                )}
              </button>
            )}
            {onRedactMemory && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRedactMemory(node.memory!.id);
                }}
                disabled={node.memory.metadata?.redacted === true}
                className="p-0.5 rounded hover:bg-mythos-bg-primary disabled:opacity-50"
                title={node.memory.metadata?.redacted ? "Already redacted" : "Redact memory"}
              >
                <EyeOff className="w-3 h-3 text-mythos-text-muted" />
              </button>
            )}
            {onForgetMemory && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onForgetMemory(node.memory!.id);
                }}
                className="p-0.5 rounded hover:bg-mythos-bg-primary"
                title="Forget memory"
              >
                <Trash2 className="w-3 h-3 text-mythos-text-muted" />
              </button>
            )}
          </div>
        )}
        {node.wordCount !== undefined && node.wordCount > 0 && (
          <span className="text-xs text-mythos-text-muted opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            {formatWordCount(node.wordCount)}
          </span>
        )}
      </button>
      {isOpen && hasChildren && (
        <div>
          {node.children!.map((child) => (
            <TreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              currentDocumentId={currentDocumentId}
              selectedMemoryId={selectedMemoryId}
              onSelect={onSelect}
              onEdit={onEdit}
              onPinMemory={onPinMemory}
              onRedactMemory={onRedactMemory}
              onForgetMemory={onForgetMemory}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Check if a string matches a search query (case-insensitive)
 */
function matchesSearch(text: string, query: string): boolean {
  return text.toLowerCase().includes(query.toLowerCase());
}

/**
 * Check if an entity matches the search query (by name or aliases)
 */
function entityMatchesSearch(entity: Entity, query: string): boolean {
  if (!query) return true;
  if (matchesSearch(entity.name, query)) return true;
  return entity.aliases.some((alias) => matchesSearch(alias, query));
}

/**
 * Check if a document matches the search query (by title)
 */
function documentMatchesSearch(doc: Document, query: string): boolean {
  if (!query) return true;
  const title = doc.title || "";
  return matchesSearch(title, query);
}

function memoryMatchesSearch(memory: MemoryRecord, query: string): boolean {
  if (!query) return true;
  return matchesSearch(memory.content, query);
}

function parseRetentionDays(value: string): number | undefined {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed;
}

function formatRetentionDays(value?: number): string {
  if (!value || value <= 0) return "";
  return String(value);
}

interface UseManifestTreeOptions {
  searchQuery: string;
  documentTypeFilter: DocumentType | "all";
  memoryBuckets: Record<MemoryCategory, MemoryRecord[]>;
}

/**
 * Build the manifest tree from real store data with search and filter support
 */
function useManifestTree({
  searchQuery,
  documentTypeFilter,
  memoryBuckets,
}: UseManifestTreeOptions): TreeNode[] {
  const entities = useEntities();
  const documents = useDocuments();

  return useMemo(() => {
    // Filter entities by search query
    const filteredEntities = searchQuery
      ? entities.filter((e) => entityMatchesSearch(e, searchQuery))
      : entities;

    // Filter documents by search query and type
    let filteredDocuments = documents;
    if (searchQuery) {
      filteredDocuments = filteredDocuments.filter((d) => documentMatchesSearch(d, searchQuery));
    }
    if (documentTypeFilter !== "all") {
      filteredDocuments = filteredDocuments.filter((d) => d.type === documentTypeFilter);
    }

    // Group entities by type
    const characterEntities = filteredEntities.filter((e) => e.type === "character");
    const locationEntities = filteredEntities.filter((e) => e.type === "location");
    const itemEntities = filteredEntities.filter((e) => e.type === "item");
    const magicEntities = filteredEntities.filter((e) => e.type === "magic_system");
    const factionEntities = filteredEntities.filter((e) => e.type === "faction");

    // Group documents by type
    const chapters = filteredDocuments.filter((d) => d.type === "chapter");
    const scenes = filteredDocuments.filter((d) => d.type === "scene");
    const notes = filteredDocuments.filter((d) => d.type === "note");
    const outlines = filteredDocuments.filter((d) => d.type === "outline");
    const worldbuilding = filteredDocuments.filter((d) => d.type === "worldbuilding");

    // Build document hierarchy - scenes can be children of chapters
    const buildChapterWithChildren = (chapter: Document): TreeNode => {
      // Find scenes that belong to this chapter (parentId matches)
      const chapterScenes = scenes.filter((s) => s.parentId === chapter.id);

      return {
        id: chapter.id,
        name: chapter.title || `Chapter ${chapter.orderIndex + 1}`,
        type: "file" as const,
        documentType: "chapter" as DocumentType,
        document: chapter,
        wordCount: chapter.wordCount,
        children: chapterScenes.length > 0
          ? chapterScenes
              .sort((a, b) => a.orderIndex - b.orderIndex)
              .map((scene) => ({
                id: scene.id,
                name: scene.title || `Scene ${scene.orderIndex + 1}`,
                type: "file" as const,
                documentType: "scene" as DocumentType,
                document: scene,
                wordCount: scene.wordCount,
                parentId: chapter.id,
              }))
          : undefined,
      };
    };

    // Get orphan scenes (scenes without a parent chapter)
    const orphanScenes = scenes.filter(
      (s) => !s.parentId || !chapters.some((c) => c.id === s.parentId)
    );

    const tree: TreeNode[] = [];

    const sortMemories = (memories: MemoryRecord[]) =>
      [...memories].sort((a, b) => {
        const pinnedDelta =
          Number(Boolean(b.metadata?.pinned)) - Number(Boolean(a.metadata?.pinned));
        if (pinnedDelta !== 0) return pinnedDelta;
        return b.createdAt.localeCompare(a.createdAt);
      });

    const storyBibleChildren: TreeNode[] = [];
    const decisionMemories = searchQuery
      ? memoryBuckets.decision.filter((m) => memoryMatchesSearch(m, searchQuery))
      : memoryBuckets.decision;
    const styleMemories = searchQuery
      ? memoryBuckets.style.filter((m) => memoryMatchesSearch(m, searchQuery))
      : memoryBuckets.style;
    const preferenceMemories = searchQuery
      ? memoryBuckets.preference.filter((m) => memoryMatchesSearch(m, searchQuery))
      : memoryBuckets.preference;

    if (decisionMemories.length > 0) {
      storyBibleChildren.push({
        id: "canon",
        name: "Canon",
        type: "folder",
        children: sortMemories(decisionMemories).map((memory) => ({
          id: memory.id,
          name: formatMemoryLabel(memory),
          type: "memory",
          memoryCategory: "decision",
          memory,
        })),
      });
    }

    if (styleMemories.length > 0) {
      storyBibleChildren.push({
        id: "style",
        name: "Style",
        type: "folder",
        children: sortMemories(styleMemories).map((memory) => ({
          id: memory.id,
          name: formatMemoryLabel(memory),
          type: "memory",
          memoryCategory: "style",
          memory,
        })),
      });
    }

    if (preferenceMemories.length > 0) {
      storyBibleChildren.push({
        id: "preferences",
        name: "Preferences",
        type: "folder",
        children: sortMemories(preferenceMemories).map((memory) => ({
          id: memory.id,
          name: formatMemoryLabel(memory),
          type: "memory",
          memoryCategory: "preference",
          memory,
        })),
      });
    }

    if (storyBibleChildren.length > 0) {
      tree.push({
        id: "story-bible",
        name: "Story Bible",
        type: "folder",
        children: storyBibleChildren,
      });
    }

    // Chapters folder (with nested scenes)
    if (chapters.length > 0 || orphanScenes.length > 0) {
      const chapterNodes = chapters
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map(buildChapterWithChildren);

      // Add orphan scenes at the chapter level
      const orphanSceneNodes = orphanScenes
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((scene) => ({
          id: scene.id,
          name: scene.title || `Scene ${scene.orderIndex + 1}`,
          type: "file" as const,
          documentType: "scene" as DocumentType,
          document: scene,
          wordCount: scene.wordCount,
        }));

      tree.push({
        id: "chapters",
        name: "Chapters",
        type: "folder",
        children: [...chapterNodes, ...orphanSceneNodes],
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
        children: notes
          .sort((a, b) => a.orderIndex - b.orderIndex)
          .map((doc) => ({
            id: doc.id,
            name: doc.title || "Untitled Note",
            type: "file" as const,
            documentType: "note" as DocumentType,
            document: doc,
            wordCount: doc.wordCount,
          })),
      });
    }

    // Outlines folder
    if (outlines.length > 0) {
      tree.push({
        id: "outlines",
        name: "Outlines",
        type: "folder",
        children: outlines
          .sort((a, b) => a.orderIndex - b.orderIndex)
          .map((doc) => ({
            id: doc.id,
            name: doc.title || "Untitled Outline",
            type: "file" as const,
            documentType: "outline" as DocumentType,
            document: doc,
            wordCount: doc.wordCount,
          })),
      });
    }

    // Worldbuilding folder
    if (worldbuilding.length > 0) {
      tree.push({
        id: "worldbuilding",
        name: "Worldbuilding",
        type: "folder",
        children: worldbuilding
          .sort((a, b) => a.orderIndex - b.orderIndex)
          .map((doc) => ({
            id: doc.id,
            name: doc.title || "Untitled",
            type: "file" as const,
            documentType: "worldbuilding" as DocumentType,
            document: doc,
            wordCount: doc.wordCount,
          })),
      });
    }

    return tree;
  }, [entities, documents, searchQuery, documentTypeFilter, memoryBuckets]);
}

export function Manifest() {
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [documentTypeFilter, setDocumentTypeFilter] = useState<DocumentType | "all">("all");
  const [showFilters, setShowFilters] = useState(false);
  const [memoryCategoryControls, setMemoryCategoryControls] = useState<Record<MemoryCategory, boolean>>(
    () => ({ ...DEFAULT_MEMORY_CATEGORY_CONTROLS })
  );
  const [memoryRetentionDays, setMemoryRetentionDays] = useState<Record<MemoryCategory, string>>(
    () => ({ ...DEFAULT_MEMORY_RETENTION_DAYS })
  );

  // Entity form modal state
  const [isEntityFormOpen, setIsEntityFormOpen] = useState(false);
  const [entityFormMode, setEntityFormMode] = useState<"create" | "edit">("create");
  const [editingEntity, setEditingEntity] = useState<Entity | undefined>(undefined);

  const {
    byCategory,
    read,
    pin: pinMemory,
    redact: redactMemory,
    forget: forgetMemory,
  } = useMemory({
    autoFetch: false,
  });

  const currentProject = useCurrentProject();

  useEffect(() => {
    if (!currentProject?.id) return;

    const controls = currentProject.config?.memoryControls;
    if (!controls) {
      setMemoryCategoryControls({ ...DEFAULT_MEMORY_CATEGORY_CONTROLS });
      setMemoryRetentionDays({ ...DEFAULT_MEMORY_RETENTION_DAYS });
      return;
    }

    const categories = controls.categories ?? {};
    setMemoryCategoryControls({
      decision: categories.decision?.enabled ?? DEFAULT_MEMORY_CATEGORY_CONTROLS.decision,
      style: categories.style?.enabled ?? DEFAULT_MEMORY_CATEGORY_CONTROLS.style,
      preference: categories.preference?.enabled ?? DEFAULT_MEMORY_CATEGORY_CONTROLS.preference,
      session: categories.session?.enabled ?? DEFAULT_MEMORY_CATEGORY_CONTROLS.session,
    });

    setMemoryRetentionDays({
      decision: formatRetentionDays(categories.decision?.maxAgeDays),
      style: formatRetentionDays(categories.style?.maxAgeDays),
      preference: formatRetentionDays(categories.preference?.maxAgeDays),
      session: formatRetentionDays(categories.session?.maxAgeDays),
    });
  }, [currentProject?.id]);

  const enabledMemoryCategories = useMemo(
    () => STORY_BIBLE_CATEGORIES.filter((category) => memoryCategoryControls[category]),
    [memoryCategoryControls]
  );

  const filterMemoriesByRetention = useCallback(
    (memories: MemoryRecord[], category: MemoryCategory) => {
      const maxAgeDays = parseRetentionDays(memoryRetentionDays[category]);
      if (!maxAgeDays) return memories;
      const cutoffMs = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
      return memories.filter((memory) => {
        const createdAt = memory.createdAt ? new Date(memory.createdAt).getTime() : 0;
        return createdAt >= cutoffMs;
      });
    },
    [memoryRetentionDays]
  );

  useEffect(() => {
    if (!currentProject?.id || enabledMemoryCategories.length === 0) {
      return;
    }

    void (async () => {
      await Promise.all(
        enabledMemoryCategories.map((category) => {
          const maxAgeDays = parseRetentionDays(memoryRetentionDays[category]);
          return read({
            categories: [category],
            includeExpired: false,
            includeRedacted: false,
            maxAgeDays,
          });
        })
      );
    })();
  }, [currentProject?.id, enabledMemoryCategories, memoryRetentionDays, read]);

  const memoryBuckets: Record<MemoryCategory, MemoryRecord[]> = {
    decision: memoryCategoryControls.decision
      ? filterMemoriesByRetention(byCategory("decision"), "decision")
      : [],
    style: memoryCategoryControls.style
      ? filterMemoriesByRetention(byCategory("style"), "style")
      : [],
    preference: memoryCategoryControls.preference
      ? filterMemoriesByRetention(byCategory("preference"), "preference")
      : [],
    session: [],
  };

  const tree = useManifestTree({ searchQuery, documentTypeFilter, memoryBuckets });
  const selectedEntityId = useMythosStore((state) => state.world.selectedEntityId);
  const currentDocument = useMythosStore((state) => state.document.currentDocument);
  const selectedMemoryId = useMythosStore((state) => state.ui.selectedMemoryId);
  const setSelectedEntity = useMythosStore((state) => state.setSelectedEntity);
  const setCurrentDocument = useMythosStore((state) => state.setCurrentDocument);
  const setSelectedMemoryId = useMythosStore((state) => state.setSelectedMemoryId);
  const showHud = useMythosStore((state) => state.showHud);

  // Entity persistence hook for DB + store sync
  // Note: isSaving and saveError are available for future UI feedback
  const { createEntity, updateEntity, isLoading: _isSaving, error: _saveError } = useEntityPersistence();

  // Handle node selection - show HUD for entities, set currentDocument for files
  const handleSelect = useCallback(
    (node: TreeNode) => {
      if (node.type === "entity" && node.entity) {
        setSelectedEntity(node.entity.id);
        setSelectedMemoryId(null);
        // Show HUD at a fixed position in the manifest area
        showHud(node.entity, { x: 280, y: 200 });
      } else if (node.type === "file" && node.document) {
        // Set the document as current document in the store
        setCurrentDocument(node.document);
        setSelectedMemoryId(null);
      } else if (node.type === "memory" && node.memory) {
        setSelectedMemoryId(node.memory.id);
      }
    },
    [setSelectedEntity, setSelectedMemoryId, showHud, setCurrentDocument]
  );

  const handlePinMemory = useCallback(
    async (memoryId: string, pinned: boolean) => {
      await pinMemory(memoryId, pinned);
    },
    [pinMemory]
  );

  const handleRedactMemory = useCallback(
    async (memoryId: string) => {
      await redactMemory(memoryId);
    },
    [redactMemory]
  );

  const handleForgetMemory = useCallback(
    async (memoryId: string) => {
      await forgetMemory([memoryId]);
    },
    [forgetMemory]
  );

  const handleToggleMemoryCategory = useCallback(
    (category: MemoryCategory) => {
      setMemoryCategoryControls((prev) => ({
        ...prev,
        [category]: !prev[category],
      }));
    },
    []
  );

  const handleRetentionChange = useCallback(
    (category: MemoryCategory, value: string) => {
      setMemoryRetentionDays((prev) => ({
        ...prev,
        [category]: value,
      }));
    },
    []
  );

  // Clear search
  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
  }, []);

  // Clear filter
  const handleClearFilter = useCallback(() => {
    setDocumentTypeFilter("all");
  }, []);

  const disabledMemoryCategories = useMemo(
    () => MEMORY_CATEGORY_OPTIONS.filter((option) => !memoryCategoryControls[option.id]),
    [memoryCategoryControls]
  );

  const retentionFilters = useMemo(
    () => (
      MEMORY_CATEGORY_OPTIONS
        .map((option) => ({
          option,
          days: parseRetentionDays(memoryRetentionDays[option.id]),
        }))
        .filter((entry) => entry.days !== undefined)
    ),
    [memoryRetentionDays]
  );

  // Check if filters are active
  const hasActiveFilters =
    searchQuery.length > 0
    || documentTypeFilter !== "all"
    || disabledMemoryCategories.length > 0
    || retentionFilters.length > 0;

  // Show empty state if no data
  const isEmpty = tree.length === 0;
  const requestProjectStartAction = useRequestProjectStartAction();

  // Open create entity modal
  const handleCreateEntity = useCallback(() => {
    setEntityFormMode("create");
    setEditingEntity(undefined);
    setIsEntityFormOpen(true);
  }, []);

  // Open edit entity modal
  const handleEditEntity = useCallback((entity: Entity) => {
    setEntityFormMode("edit");
    setEditingEntity(entity);
    setIsEntityFormOpen(true);
  }, []);

  // Close entity form modal
  const handleCloseEntityForm = useCallback(() => {
    setIsEntityFormOpen(false);
    setEditingEntity(undefined);
  }, []);

  // Save entity (create or update) - now persists to DB via useEntityPersistence
  const handleSaveEntity = useCallback(
    async (formData: EntityFormData) => {
      const now = new Date();
      const baseEntity = {
        name: formData.name,
        aliases: formData.aliases,
        type: formData.type,
        properties: {},
        mentions: [],
        notes: formData.notes,
        updatedAt: now,
      };

      // Get projectId from store for DB persistence
      const projectId = useMythosStore.getState().project.currentProject?.id;
      if (!projectId) {
        console.error("[Manifest] Cannot save entity: No project loaded");
        return;
      }

      if (entityFormMode === "create") {
        // Create new entity with generated ID
        const id = `entity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        let newEntity: Entity;

        switch (formData.type) {
          case "character":
            newEntity = {
              ...baseEntity,
              id,
              createdAt: now,
              type: "character",
              archetype: formData.archetype,
              traits: formData.traits || [],
              status: {},
              visualDescription: {},
              backstory: formData.backstory,
              goals: formData.goals,
              fears: formData.fears,
              voiceNotes: formData.voiceNotes,
            } as Character;
            break;
          case "location":
            newEntity = {
              ...baseEntity,
              id,
              createdAt: now,
              type: "location",
              parentLocation: formData.parentLocation,
              climate: formData.climate,
              atmosphere: formData.atmosphere,
            } as Location;
            break;
          case "item":
            newEntity = {
              ...baseEntity,
              id,
              createdAt: now,
              type: "item",
              category: formData.category || "other",
              rarity: formData.rarity,
              abilities: formData.abilities,
            } as Item;
            break;
          case "magic_system":
            newEntity = {
              ...baseEntity,
              id,
              createdAt: now,
              type: "magic_system",
              rules: formData.rules || [],
              limitations: formData.limitations || [],
              costs: formData.costs,
            } as MagicSystem;
            break;
          case "faction":
            newEntity = {
              ...baseEntity,
              id,
              createdAt: now,
              type: "faction",
              leader: formData.leader,
              headquarters: formData.headquarters,
              goals: formData.factionGoals,
              rivals: formData.rivals,
              allies: formData.allies,
            } as Faction;
            break;
          default:
            newEntity = {
              ...baseEntity,
              id,
              createdAt: now,
            } as Entity;
        }

        // Persist to DB and add to store
        const result = await createEntity(newEntity, projectId);
        if (result.error) {
          console.error("[Manifest] Failed to create entity:", result.error);
          return;
        }
      } else if (editingEntity) {
        // Update existing entity
        const updates: Partial<Entity> = {
          name: formData.name,
          aliases: formData.aliases,
          notes: formData.notes,
          updatedAt: now,
        };

        // Add type-specific updates
        switch (formData.type) {
          case "character":
            Object.assign(updates, {
              archetype: formData.archetype,
              traits: formData.traits || [],
              backstory: formData.backstory,
              goals: formData.goals,
              fears: formData.fears,
              voiceNotes: formData.voiceNotes,
            });
            break;
          case "location":
            Object.assign(updates, {
              parentLocation: formData.parentLocation,
              climate: formData.climate,
              atmosphere: formData.atmosphere,
            });
            break;
          case "item":
            Object.assign(updates, {
              category: formData.category,
              rarity: formData.rarity,
              abilities: formData.abilities,
            });
            break;
          case "magic_system":
            Object.assign(updates, {
              rules: formData.rules || [],
              limitations: formData.limitations || [],
              costs: formData.costs,
            });
            break;
          case "faction":
            Object.assign(updates, {
              leader: formData.leader,
              headquarters: formData.headquarters,
              goals: formData.factionGoals,
              rivals: formData.rivals,
              allies: formData.allies,
            });
            break;
        }

        // Persist to DB and update in store
        const result = await updateEntity(editingEntity.id, updates);
        if (result.error) {
          console.error("[Manifest] Failed to update entity:", result.error);
          return;
        }
      }

      handleCloseEntityForm();
    },
    [entityFormMode, editingEntity, createEntity, updateEntity, handleCloseEntityForm]
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-mythos-border-default">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold text-mythos-text-muted uppercase tracking-wider">
            Manifest
          </h2>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-mythos-text-muted hover:text-mythos-accent-green"
              onClick={handleCreateEntity}
              title="Create new entity"
            >
              <Plus className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={`h-6 w-6 ${showFilters ? "text-mythos-accent-cyan" : "text-mythos-text-muted"}`}
              onClick={() => setShowFilters(!showFilters)}
              title="Toggle filters"
            >
              <Filter className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-mythos-text-muted" />
          <Input
            type="text"
            placeholder="Search documents, entities, canon..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 pr-8 text-xs bg-mythos-bg-primary"
          />
          {searchQuery && (
            <button
              onClick={handleClearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-mythos-text-muted hover:text-mythos-text-primary transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Dropdown */}
        {showFilters && (
          <div className="mt-2 space-y-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-mythos-text-muted whitespace-nowrap">
                Type:
              </label>
              <Select
                value={documentTypeFilter}
                onChange={(value) => setDocumentTypeFilter(value as DocumentType | "all")}
                options={DOCUMENT_TYPE_FILTERS}
                className="flex-1 h-7 text-xs"
              />
            </div>

            <div className="pt-2 border-t border-mythos-border-default/40">
              <p className="text-[10px] uppercase tracking-wide text-mythos-text-muted mb-2">
                Story Bible
              </p>
              <div className="flex flex-wrap gap-1.5">
                {MEMORY_CATEGORY_OPTIONS.map((option) => {
                  const isEnabled = memoryCategoryControls[option.id];
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleToggleMemoryCategory(option.id)}
                      className={`px-2 py-1 rounded border text-[11px] transition-colors ${
                        isEnabled
                          ? "border-mythos-accent-cyan/40 bg-mythos-accent-cyan/10 text-mythos-accent-cyan"
                          : "border-mythos-border-default text-mythos-text-muted hover:text-mythos-text-secondary"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 space-y-1.5">
                {MEMORY_CATEGORY_OPTIONS.map((option) => (
                  <label
                    key={option.id}
                    className="flex items-center justify-between gap-2 text-xs text-mythos-text-muted"
                  >
                    <span>{option.label} retention</span>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      placeholder="Days"
                      value={memoryRetentionDays[option.id]}
                      onChange={(e) => handleRetentionChange(option.id, e.target.value)}
                      disabled={!memoryCategoryControls[option.id]}
                      className="h-7 w-20 text-xs bg-mythos-bg-primary"
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Active Filters Indicator */}
        {hasActiveFilters && (
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="text-mythos-text-muted">Filtering:</span>
            {searchQuery && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-mythos-accent-cyan/20 text-mythos-accent-cyan">
                "{searchQuery}"
                <button onClick={handleClearSearch} className="hover:text-white">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {documentTypeFilter !== "all" && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-mythos-accent-purple/20 text-mythos-accent-purple">
                {DOCUMENT_TYPE_FILTERS.find((f) => f.value === documentTypeFilter)?.label}
                <button onClick={handleClearFilter} className="hover:text-white">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {disabledMemoryCategories.map((option) => (
              <span
                key={`memory-off-${option.id}`}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-mythos-bg-tertiary text-mythos-text-muted"
              >
                Hide {option.label}
                <button
                  onClick={() => handleToggleMemoryCategory(option.id)}
                  className="hover:text-mythos-text-primary"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {retentionFilters.map(({ option, days }) => (
              <span
                key={`memory-retention-${option.id}`}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-mythos-accent-amber/20 text-mythos-accent-amber"
              >
                {option.label} ≤ {days}d
                <button
                  onClick={() => handleRetentionChange(option.id, "")}
                  className="hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Tree Content */}
      <ScrollArea className="flex-1 p-2">
        {isEmpty ? (
          !currentProject ? (
            <div className="p-3">
              <div className="rounded-xl border border-mythos-border-default bg-mythos-bg-secondary/60 p-3">
                <p className="text-[11px] uppercase tracking-wide text-mythos-text-muted">
                  Start here
                </p>
                <div className="mt-2 space-y-1">
                  {START_ACTIONS.map(({ label, action, icon: Icon }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => requestProjectStartAction(action)}
                      className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm text-mythos-text-secondary hover:text-mythos-text-primary hover:bg-mythos-bg-hover transition-colors"
                    >
                      <Icon className="w-4 h-4 text-mythos-text-muted" />
                      <span className="flex-1 text-left">{label}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[10px] text-mythos-text-muted">
                  Create a project to unlock documents and world entities.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 text-center text-mythos-text-muted text-sm">
              {hasActiveFilters ? (
                <>
                  <p>No matching results.</p>
                  <p className="mt-2 text-xs">Try adjusting your search or filters.</p>
                </>
              ) : (
                <>
                  <p>No entities or documents yet.</p>
                  <p className="mt-2 text-xs">Paste content to detect entities or create them manually.</p>
                </>
              )}
            </div>
          )
        ) : (
          tree.map((node) => (
            <TreeItem
              key={node.id}
              node={node}
              selectedId={selectedEntityId}
              currentDocumentId={currentDocument?.id ?? null}
              selectedMemoryId={selectedMemoryId}
              onSelect={handleSelect}
              onEdit={handleEditEntity}
              onPinMemory={handlePinMemory}
              onRedactMemory={handleRedactMemory}
              onForgetMemory={handleForgetMemory}
            />
          ))
        )}
      </ScrollArea>

      {/* Entity Form Modal */}
      <EntityFormModal
        isOpen={isEntityFormOpen}
        mode={entityFormMode}
        entity={editingEntity}
        onClose={handleCloseEntityForm}
        onSave={handleSaveEntity}
      />
    </div>
  );
}
