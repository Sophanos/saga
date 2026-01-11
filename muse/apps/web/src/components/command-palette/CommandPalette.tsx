import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Command as CmdkCommand } from "cmdk";
import {
  Search,
  FileText,
  Clock,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { cn } from "@mythos/ui";
import {
  useCommandPaletteStore,
  useCommandPaletteOpen,
  useCommandPaletteQuery,
  useCommandPaletteFilter,
  useCommandPaletteExpanded,
  useRecentCommandIds,
  type CommandPaletteFilter,
} from "../../stores/commandPalette";
import {
  useMythosStore,
  useRecentDocuments,
  useRecentEntities,
  type DocumentSearchHit,
  type EntitySearchHit,
} from "../../stores";
import {
  commandRegistry,
  getUnlockHint,
  type Command,
  type CommandContext,
  type CommandCategory,
} from "../../commands";
import { CommandItem } from "./CommandItem";
import { searchViaEdge, SearchApiError } from "../../services/ai";
import { useGetEditorSelection, useIsCommandLocked } from "../../hooks";
import { getEntityIconComponent } from "../../utils/entityConfig";
import type { Editor } from "@mythos/editor";
import type { EntityType } from "@mythos/core";

const FILTER_LABELS: Record<CommandPaletteFilter, string> = {
  all: "All",
  entity: "Entity",
  ai: "AI",
  navigation: "Nav",
  general: "General",
};

interface SearchState {
  isSearching: boolean;
  error: string | null;
  documents: DocumentSearchHit[];
  entities: EntitySearchHit[];
}

export function CommandPalette() {
  const isOpen = useCommandPaletteOpen();
  const query = useCommandPaletteQuery();
  const filter = useCommandPaletteFilter();
  const expanded = useCommandPaletteExpanded();
  const recentCommandIds = useRecentCommandIds();

  const {
    close,
    setQuery,
    setFilter,
    cycleFilter,
    setExpanded,
    addRecentCommand,
  } = useCommandPaletteStore();

  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Main store state
  const store = useMythosStore;
  const openModal = useMythosStore((s) => s.openModal);
  const closeModal = useMythosStore((s) => s.closeModal);
  const setActiveTab = useMythosStore((s) => s.setActiveTab);
  const setCanvasView = useMythosStore((s) => s.setCanvasView);
  const setCurrentDocument = useMythosStore((s) => s.setCurrentDocument);
  const setSelectedEntity = useMythosStore((s) => s.setSelectedEntity);
  const editorInstance = useMythosStore((s) => s.editor.editorInstance) as Editor | null;
  const projectId = useMythosStore((s) => s.project.currentProject?.id);
  const documents = useMythosStore((s) => s.document.documents);
  const entities = useMythosStore((s) => s.world.entities);

  // Get selection imperatively (for command execution)
  const getSelectedText = useGetEditorSelection(editorInstance);

  // Use shared hook for checking command lock state (progressive disclosure)
  const isCommandLocked = useIsCommandLocked();

  // Recent items
  const recentDocuments = useRecentDocuments();
  const recentEntities = useRecentEntities();

  // Semantic search state
  const [searchState, setSearchState] = useState<SearchState>({
    isSearching: false,
    error: null,
    documents: [],
    entities: [],
  });

  // Build command context
  const getCommandContext = useCallback((): CommandContext => {
    const currentState = store.getState();

    return {
      store,
      state: currentState,
      editor: editorInstance,
      selectedText: getSelectedText(),
      openModal,
      closeModal,
      setActiveTab: setActiveTab as (tab: string) => void,
      setCanvasView,
    };
  }, [store, editorInstance, getSelectedText, openModal, closeModal, setActiveTab, setCanvasView]);

  // Get filtered commands
  const filteredCommands = useMemo(() => {
    const ctx = getCommandContext();
    let commands = commandRegistry.list(ctx);

    // Filter by category if not "all"
    if (filter !== "all") {
      commands = commands.filter((cmd) => cmd.category === filter);
    }

    // Filter by query if present
    if (query.trim()) {
      const normalizedQuery = query.toLowerCase().trim();
      commands = commands.filter((cmd) => {
        const searchable = [cmd.label, cmd.description ?? "", ...cmd.keywords]
          .join(" ")
          .toLowerCase();
        return searchable.includes(normalizedQuery);
      });
    }

    return commands;
  }, [filter, query, getCommandContext]);

  // Get recent commands
  const recentCommands = useMemo(() => {
    return recentCommandIds
      .map((id) => commandRegistry.get(id))
      .filter((cmd): cmd is Command => cmd !== undefined)
      .slice(0, 3);
  }, [recentCommandIds]);

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<CommandCategory, Command[]> = {
      entity: [],
      ai: [],
      navigation: [],
      general: [],
    };

    for (const cmd of filteredCommands) {
      groups[cmd.category].push(cmd);
    }

    return groups;
  }, [filteredCommands]);

  // Handle command execution
  const executeCommand = useCallback(
    (command: Command) => {
      // Check if command is locked (progressive disclosure)
      if (isCommandLocked(command)) {
        // Don't execute - the hint is shown in the UI
        console.log(
          `[CommandPalette] Command "${command.id}" is locked. Hint: ${getUnlockHint(command.requiredModule!)}`
        );
        return;
      }

      const ctx = getCommandContext();
      addRecentCommand(command.id);
      close();
      command.execute(ctx);
    },
    [getCommandContext, addRecentCommand, close, isCommandLocked]
  );

  // Handle document selection
  const handleDocumentSelect = useCallback(
    (docId: string) => {
      const doc = documents.find((d) => d.id === docId);
      if (doc) {
        setCanvasView("editor"); // Ensure we're viewing the editor
        setCurrentDocument(doc);
        close();
      }
    },
    [documents, setCurrentDocument, setCanvasView, close]
  );

  // Handle entity selection
  const handleEntitySelect = useCallback(
    (entityId: string) => {
      const entity = entities.get(entityId);
      setSelectedEntity(entityId);
      // Show entity in project graph or open edit modal
      if (entity) {
        setCanvasView("projectGraph");
      }
      close();
    },
    [entities, setSelectedEntity, setCanvasView, close]
  );

  // Semantic search
  useEffect(() => {
    if (!query.trim() || query.length < 2 || !projectId) {
      setSearchState((s) => ({ ...s, documents: [], entities: [], isSearching: false }));
      return;
    }

    // Debounce
    const timeout = setTimeout(async () => {
      // Abort previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setSearchState((s) => ({ ...s, isSearching: true, error: null }));

      try {
        const result = await searchViaEdge(
          {
            query,
            projectId,
            limit: 10,
            scope: "all",
          },
          { signal: abortControllerRef.current.signal }
        );

        const docs: DocumentSearchHit[] = [];
        const ents: EntitySearchHit[] = [];

        for (const item of result.results) {
          if (item.type === "document") {
            docs.push({
              id: item.id,
              title: item.title,
              type: "chapter",
              score: item.rerankScore ?? item.vectorScore,
              scoreKind: "similarity",
              preview: item.preview,
            });
          } else {
            ents.push({
              id: item.id,
              name: item.title ?? "",
              type: (item.entityType as EntityType) ?? "character",
              score: item.rerankScore ?? item.vectorScore,
              scoreKind: "similarity",
              preview: item.preview,
            });
          }
        }

        setSearchState({
          isSearching: false,
          error: null,
          documents: docs,
          entities: ents,
        });
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setSearchState({
          isSearching: false,
          error: err instanceof SearchApiError ? err.message : "Search failed",
          documents: [],
          entities: [],
        });
      }
    }, 300);

    return () => {
      clearTimeout(timeout);
      abortControllerRef.current?.abort();
    };
  }, [query, projectId]);

  // Handle keyboard events
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Tab") {
        e.preventDefault();
        cycleFilter(e.shiftKey ? -1 : 1);
      } else if (e.key === "Escape") {
        if (query) {
          setQuery("");
        } else {
          close();
        }
      }
    },
    [query, cycleFilter, setQuery, close]
  );

  // Focus input when opening
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  if (!isOpen) return null;

  const hasQuery = query.trim().length > 0;
  const showRecent = !hasQuery && !expanded && recentCommands.length > 0;
  const showSearchResults = hasQuery && (searchState.documents.length > 0 || searchState.entities.length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-mythos-bg-primary/80 backdrop-blur-sm"
        onClick={close}
      />

      {/* Dialog */}
      <CmdkCommand
        className={cn(
          "relative z-10 w-full max-w-xl mx-4",
          "bg-mythos-bg-secondary border border-mythos-border-default rounded-xl shadow-2xl",
          "overflow-hidden"
        )}
        onKeyDown={handleKeyDown}
        loop
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 border-b border-mythos-border-default">
          <Search className="w-4 h-4 text-mythos-text-muted shrink-0" />
          <CmdkCommand.Input
            ref={inputRef}
            value={query}
            onValueChange={setQuery}
            placeholder="Search commands and content..."
            className={cn(
              "flex-1 h-12 bg-transparent text-sm text-mythos-text-primary",
              "placeholder:text-mythos-text-muted outline-none"
            )}
          />
          {searchState.isSearching && (
            <Loader2 className="w-4 h-4 text-mythos-accent-primary animate-spin" />
          )}
          <kbd className="px-2 py-1 text-[10px] font-mono bg-mythos-bg-primary/50 text-mythos-text-muted rounded">
            ⌘K
          </kbd>
        </div>

        {/* Filter tabs (shown when expanded or has query) */}
        {(expanded || hasQuery) && (
          <div className="flex items-center gap-1 px-3 py-2 border-b border-mythos-border-default">
            {(Object.keys(FILTER_LABELS) as CommandPaletteFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-3 py-1 text-xs rounded-md transition-colors",
                  filter === f
                    ? "bg-mythos-accent-primary/20 text-mythos-accent-primary"
                    : "text-mythos-text-muted hover:text-mythos-text-secondary hover:bg-mythos-bg-tertiary"
                )}
              >
                {FILTER_LABELS[f]}
              </button>
            ))}
            <div className="flex-1" />
            <span className="text-[10px] text-mythos-text-muted">
              Tab to filter
            </span>
          </div>
        )}

        {/* Command List */}
        <CmdkCommand.List className="max-h-[400px] overflow-y-auto p-2">
          <CmdkCommand.Empty className="py-8 text-center text-sm text-mythos-text-muted">
            No results found.
          </CmdkCommand.Empty>

          {/* Recent section */}
          {showRecent && (
            <CmdkCommand.Group heading="Recent">
              <div className="px-2 py-1.5 text-xs font-medium text-mythos-text-muted uppercase tracking-wider">
                Recent
              </div>
              {recentDocuments.slice(0, 2).map((doc) => (
                <CmdkCommand.Item
                  key={`doc-${doc.id}`}
                  value={`recent-doc-${doc.id} ${doc.title}`}
                  onSelect={() => handleDocumentSelect(doc.id)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer",
                    "text-mythos-text-secondary",
                    "data-[selected=true]:bg-mythos-bg-tertiary",
                    "data-[selected=true]:text-mythos-text-primary"
                  )}
                >
                  <FileText className="w-4 h-4 text-mythos-text-muted" />
                  <span className="flex-1 truncate text-sm">{doc.title}</span>
                  <Clock className="w-3 h-3 text-mythos-text-muted" />
                </CmdkCommand.Item>
              ))}
              {recentEntities.slice(0, 2).map((entity) => {
                const Icon = getEntityIconComponent(entity.type);
                return (
                  <CmdkCommand.Item
                    key={`entity-${entity.id}`}
                    value={`recent-entity-${entity.id} ${entity.name}`}
                    onSelect={() => handleEntitySelect(entity.id)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer",
                      "text-mythos-text-secondary",
                      "data-[selected=true]:bg-mythos-bg-tertiary",
                      "data-[selected=true]:text-mythos-text-primary"
                    )}
                  >
                    <Icon className="w-4 h-4 text-mythos-text-muted" />
                    <span className="flex-1 truncate text-sm">{entity.name}</span>
                    <span className="text-xs text-mythos-text-muted capitalize">{entity.type}</span>
                  </CmdkCommand.Item>
                );
              })}
            </CmdkCommand.Group>
          )}

          {/* Quick Actions */}
          {showRecent && (
            <CmdkCommand.Group heading="Quick Actions">
              <div className="px-2 py-1.5 text-xs font-medium text-mythos-text-muted uppercase tracking-wider">
                Quick Actions
              </div>
              {recentCommands.map((cmd) => (
                <CommandItem
                  key={cmd.id}
                  command={cmd}
                  onSelect={() => executeCommand(cmd)}
                  isLocked={isCommandLocked(cmd)}
                  unlockHint={cmd.requiredModule ? getUnlockHint(cmd.requiredModule) : undefined}
                />
              ))}
              {filteredCommands.slice(0, 3).map((cmd) => (
                <CommandItem
                  key={cmd.id}
                  command={cmd}
                  onSelect={() => executeCommand(cmd)}
                  isLocked={isCommandLocked(cmd)}
                  unlockHint={cmd.requiredModule ? getUnlockHint(cmd.requiredModule) : undefined}
                />
              ))}
            </CmdkCommand.Group>
          )}

          {/* Show All button */}
          {!expanded && !hasQuery && (
            <button
              onClick={() => setExpanded(true)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 mt-2",
                "text-sm text-mythos-text-muted hover:text-mythos-text-secondary",
                "hover:bg-mythos-bg-tertiary rounded-lg transition-colors"
              )}
            >
              <span>More...</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {/* Semantic search results */}
          {showSearchResults && (
            <>
              {searchState.entities.length > 0 && (
                <CmdkCommand.Group heading="Entities">
                  <div className="px-2 py-1.5 text-xs font-medium text-mythos-text-muted uppercase tracking-wider">
                    Entities
                  </div>
                  {searchState.entities.map((hit) => {
                    const Icon = getEntityIconComponent(hit.type);
                    return (
                      <CmdkCommand.Item
                        key={`search-entity-${hit.id}`}
                        value={`search-entity-${hit.id} ${hit.name}`}
                        onSelect={() => handleEntitySelect(hit.id)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer",
                          "text-mythos-text-secondary",
                          "data-[selected=true]:bg-mythos-bg-tertiary",
                          "data-[selected=true]:text-mythos-text-primary"
                        )}
                      >
                        <Icon className="w-4 h-4 text-mythos-text-muted" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{hit.name}</div>
                          {hit.preview && (
                            <div className="text-xs text-mythos-text-muted truncate">
                              {hit.preview}
                            </div>
                          )}
                        </div>
                        <span className="text-xs text-mythos-text-muted">
                          {Math.round(hit.score * 100)}%
                        </span>
                      </CmdkCommand.Item>
                    );
                  })}
                </CmdkCommand.Group>
              )}

              {searchState.documents.length > 0 && (
                <CmdkCommand.Group heading="Documents">
                  <div className="px-2 py-1.5 text-xs font-medium text-mythos-text-muted uppercase tracking-wider">
                    Documents
                  </div>
                  {searchState.documents.map((hit) => (
                    <CmdkCommand.Item
                      key={`search-doc-${hit.id}`}
                      value={`search-doc-${hit.id} ${hit.title}`}
                      onSelect={() => handleDocumentSelect(hit.id)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer",
                        "text-mythos-text-secondary",
                        "data-[selected=true]:bg-mythos-bg-tertiary",
                        "data-[selected=true]:text-mythos-text-primary"
                      )}
                    >
                      <FileText className="w-4 h-4 text-mythos-text-muted" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{hit.title}</div>
                        {hit.preview && (
                          <div className="text-xs text-mythos-text-muted truncate">
                            {hit.preview}
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-mythos-text-muted">
                        {Math.round(hit.score * 100)}%
                      </span>
                    </CmdkCommand.Item>
                  ))}
                </CmdkCommand.Group>
              )}
            </>
          )}

          {/* Expanded command groups */}
          {(expanded || hasQuery) && (
            <>
              {Object.entries(groupedCommands).map(([category, commands]) => {
                if (commands.length === 0) return null;
                return (
                  <CmdkCommand.Group key={category} heading={category}>
                    <div className="px-2 py-1.5 text-xs font-medium text-mythos-text-muted uppercase tracking-wider">
                      {category}
                    </div>
                    {commands.map((cmd) => (
                      <CommandItem
                        key={cmd.id}
                        command={cmd}
                        onSelect={() => executeCommand(cmd)}
                        isLocked={isCommandLocked(cmd)}
                        unlockHint={cmd.requiredModule ? getUnlockHint(cmd.requiredModule) : undefined}
                      />
                    ))}
                  </CmdkCommand.Group>
                );
              })}
            </>
          )}
        </CmdkCommand.List>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-mythos-border-default text-[10px] text-mythos-text-muted">
          <div className="flex items-center gap-3">
            <span>↑↓ navigate</span>
            <span>Tab sections</span>
            <span>↵ select</span>
          </div>
          <span>esc close</span>
        </div>
      </CmdkCommand>
    </div>
  );
}
