/**
 * SearchPanel Component
 *
 * Semantic search panel for finding documents and entities.
 * Uses DeepInfra embeddings + Qdrant for vector search.
 */

import { useCallback, useEffect, useRef } from "react";
import {
  Search,
  FileText,
  User,
  MapPin,
  Sparkles,
  X,
  Loader2,
  AlertCircle,
  Compass,
} from "lucide-react";
import { Button, Input, ScrollArea, cn } from "@mythos/ui";
import {
  useMythosStore,
  useSearchState,
  useIsSearching,
  useSearchError,
  useDocumentSearchHits,
  useEntitySearchHits,
  useSearchResultCount,
  type DocumentSearchHit,
  type EntitySearchHit,
  type SearchScope,
} from "../../stores";
import { useSearch } from "../../hooks/useSearch";

/**
 * Props for SearchPanel
 */
interface SearchPanelProps {
  className?: string;
}

/**
 * Entity type icons
 */
const ENTITY_TYPE_ICONS: Record<string, typeof User> = {
  character: User,
  location: MapPin,
  item: Sparkles,
  faction: User,
  magic_system: Sparkles,
};

/**
 * Get icon for entity type
 */
function getEntityIcon(type: string) {
  return ENTITY_TYPE_ICONS[type] || User;
}

/**
 * Format score for display
 */
function formatScore(score: number): string {
  return `${Math.round(score * 100)}%`;
}

/**
 * Search input with clear button
 */
function SearchInput({
  value,
  onChange,
  onClear,
  onSubmit,
  isSearching,
}: {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  onSubmit: () => void;
  isSearching: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
    if (e.key === "Escape") {
      onClear();
    }
  };

  return (
    <div className="relative">
      <div className="absolute left-3 top-1/2 -translate-y-1/2">
        {isSearching ? (
          <Loader2 className="w-4 h-4 text-mythos-text-muted animate-spin" />
        ) : (
          <Search className="w-4 h-4 text-mythos-text-muted" />
        )}
      </div>
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search documents and entities..."
        className="pl-10 pr-10"
      />
      {value && (
        <button
          onClick={onClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-mythos-bg-tertiary transition-colors"
        >
          <X className="w-4 h-4 text-mythos-text-muted" />
        </button>
      )}
    </div>
  );
}

/**
 * Scope filter buttons
 */
function ScopeFilter({
  scope,
  onScopeChange,
  documentCount,
  entityCount,
}: {
  scope: SearchScope;
  onScopeChange: (scope: SearchScope) => void;
  documentCount: number;
  entityCount: number;
}) {
  return (
    <div className="flex gap-1">
      <Button
        size="sm"
        variant={scope === "all" ? "default" : "ghost"}
        onClick={() => onScopeChange("all")}
        className="h-7 text-xs"
      >
        All
      </Button>
      <Button
        size="sm"
        variant={scope === "documents" ? "default" : "ghost"}
        onClick={() => onScopeChange("documents")}
        className="h-7 text-xs"
      >
        <FileText className="w-3 h-3 mr-1" />
        Docs {documentCount > 0 && `(${documentCount})`}
      </Button>
      <Button
        size="sm"
        variant={scope === "entities" ? "default" : "ghost"}
        onClick={() => onScopeChange("entities")}
        className="h-7 text-xs"
      >
        <User className="w-3 h-3 mr-1" />
        Entities {entityCount > 0 && `(${entityCount})`}
      </Button>
    </div>
  );
}

/**
 * Document result card
 */
function DocumentResultCard({
  hit,
  onClick,
}: {
  hit: DocumentSearchHit;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left p-3 rounded-md border transition-all duration-200",
        "bg-mythos-bg-secondary/50 border-mythos-text-muted/10",
        "hover:bg-mythos-bg-secondary hover:border-mythos-text-muted/20",
        "hover:shadow-lg hover:shadow-black/20"
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-mythos-accent-cyan shrink-0" />
          <span className="text-sm font-medium text-mythos-text-primary truncate">
            {hit.title || "Untitled"}
          </span>
        </div>
        <span className="text-xs text-mythos-text-muted shrink-0">
          {formatScore(hit.score)}
        </span>
      </div>
      {hit.preview && (
        <p className="text-xs text-mythos-text-secondary line-clamp-2 mt-1">
          {hit.preview}
        </p>
      )}
    </button>
  );
}

/**
 * Entity result card
 */
function EntityResultCard({
  hit,
  onClick,
  onFindSimilar,
}: {
  hit: EntitySearchHit;
  onClick: () => void;
  onFindSimilar: () => void;
}) {
  const Icon = getEntityIcon(hit.type);

  return (
    <div
      className={cn(
        "p-3 rounded-md border transition-all duration-200",
        "bg-mythos-bg-secondary/50 border-mythos-text-muted/10",
        "hover:bg-mythos-bg-secondary hover:border-mythos-text-muted/20",
        "hover:shadow-lg hover:shadow-black/20"
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <button onClick={onClick} className="flex items-center gap-2 text-left flex-1 min-w-0">
          <Icon className="w-4 h-4 text-mythos-accent-purple shrink-0" />
          <span className="text-sm font-medium text-mythos-text-primary truncate">
            {hit.name}
          </span>
          <span className="text-xs text-mythos-text-muted capitalize shrink-0">
            {hit.type}
          </span>
        </button>
        <span className="text-xs text-mythos-text-muted shrink-0">
          {formatScore(hit.score)}
        </span>
      </div>
      {hit.preview && (
        <p className="text-xs text-mythos-text-secondary line-clamp-2 mt-1">
          {hit.preview}
        </p>
      )}
      <div className="flex justify-end mt-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            onFindSimilar();
          }}
          className="h-6 text-xs opacity-70 hover:opacity-100"
        >
          <Compass className="w-3 h-3 mr-1" />
          Find Similar
        </Button>
      </div>
    </div>
  );
}

/**
 * Empty state
 */
function EmptyState({ hasQuery }: { hasQuery: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-14 h-14 rounded-full bg-mythos-accent-cyan/10 flex items-center justify-center mb-4 ring-2 ring-mythos-accent-cyan/20">
        <Search className="w-7 h-7 text-mythos-accent-cyan" />
      </div>
      <h4 className="text-sm font-medium text-mythos-text-primary mb-1">
        {hasQuery ? "No Results Found" : "Semantic Search"}
      </h4>
      <p className="text-xs text-mythos-text-muted max-w-[220px] leading-relaxed">
        {hasQuery
          ? "Try different keywords or broaden your search."
          : "Search across your documents and entities using AI-powered semantic search."}
      </p>
    </div>
  );
}

/**
 * Error state
 */
function ErrorState({ message }: { message: string }) {
  return (
    <div className="p-3 m-3 rounded bg-mythos-accent-red/10 border border-mythos-accent-red/30">
      <div className="flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-mythos-accent-red shrink-0 mt-0.5" />
        <p className="text-xs text-mythos-accent-red">{message}</p>
      </div>
    </div>
  );
}

/**
 * Results section
 */
function ResultsSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  if (count === 0) return null;

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-medium text-mythos-text-muted uppercase tracking-wide">
          {title}
        </h3>
        <span className="text-xs text-mythos-text-muted">{count}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

/**
 * SearchPanel Component
 */
export function SearchPanel({ className }: SearchPanelProps) {
  const searchState = useSearchState();
  const isSearching = useIsSearching();
  const error = useSearchError();
  const documentHits = useDocumentSearchHits();
  const entityHits = useEntitySearchHits();
  const resultCount = useSearchResultCount();

  // Store actions
  const setSearchQuery = useMythosStore((s) => s.setSearchQuery);
  const setSearchScope = useMythosStore((s) => s.setSearchScope);
  const setCurrentDocument = useMythosStore((s) => s.setCurrentDocument);
  const setSelectedEntity = useMythosStore((s) => s.setSelectedEntity);
  const documents = useMythosStore((s) => s.document.documents);

  // Search hook
  const { runSearch, findSimilarToEntity, clear } = useSearch({
    autoSearch: true,
    debounceMs: 400,
  });

  // Handle query change
  const handleQueryChange = useCallback(
    (value: string) => {
      setSearchQuery(value);
    },
    [setSearchQuery]
  );

  // Handle clear
  const handleClear = useCallback(() => {
    clear();
  }, [clear]);

  // Handle manual search
  const handleSearch = useCallback(() => {
    void runSearch();
  }, [runSearch]);

  // Handle scope change
  const handleScopeChange = useCallback(
    (scope: SearchScope) => {
      setSearchScope(scope);
      // Re-run search with new scope
      void runSearch({ scope });
    },
    [setSearchScope, runSearch]
  );

  // Handle document click - open in editor
  const handleDocumentClick = useCallback(
    (hit: DocumentSearchHit) => {
      const doc = documents.find((d) => d.id === hit.id);
      if (doc) {
        setCurrentDocument(doc);
      }
    },
    [documents, setCurrentDocument]
  );

  // Handle entity click - select and show in HUD
  const handleEntityClick = useCallback(
    (hit: EntitySearchHit) => {
      setSelectedEntity(hit.id);
    },
    [setSelectedEntity]
  );

  // Handle find similar
  const handleFindSimilar = useCallback(
    (entityId: string) => {
      void findSimilarToEntity(entityId);
    },
    [findSimilarToEntity]
  );

  // Source indicator for "Find Similar" results
  const sourceLabel =
    searchState.source.kind === "entity"
      ? `Similar to entity`
      : null;

  return (
    <div className={cn("h-full flex flex-col", className)}>
      {/* Header */}
      <div className="p-3 border-b border-mythos-text-muted/20 space-y-3">
        <SearchInput
          value={searchState.query}
          onChange={handleQueryChange}
          onClear={handleClear}
          onSubmit={handleSearch}
          isSearching={isSearching}
        />
        <div className="flex items-center justify-between">
          <ScopeFilter
            scope={searchState.scope}
            onScopeChange={handleScopeChange}
            documentCount={documentHits.length}
            entityCount={entityHits.length}
          />
          {resultCount > 0 && (
            <span className="text-xs text-mythos-text-muted">
              {resultCount} result{resultCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        {sourceLabel && (
          <div className="flex items-center gap-2 text-xs text-mythos-accent-purple">
            <Compass className="w-3 h-3" />
            {sourceLabel}
          </div>
        )}
      </div>

      {/* Error state */}
      {error && <ErrorState message={error} />}

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-3">
          {resultCount === 0 && !isSearching ? (
            <EmptyState hasQuery={searchState.query.trim().length > 0} />
          ) : (
            <>
              {/* Documents */}
              {(searchState.scope === "all" || searchState.scope === "documents") && (
                <ResultsSection title="Documents" count={documentHits.length}>
                  {documentHits.map((hit) => (
                    <DocumentResultCard
                      key={hit.id}
                      hit={hit}
                      onClick={() => handleDocumentClick(hit)}
                    />
                  ))}
                </ResultsSection>
              )}

              {/* Entities */}
              {(searchState.scope === "all" || searchState.scope === "entities") && (
                <ResultsSection title="Entities" count={entityHits.length}>
                  {entityHits.map((hit) => (
                    <EntityResultCard
                      key={hit.id}
                      hit={hit}
                      onClick={() => handleEntityClick(hit)}
                      onFindSimilar={() => handleFindSimilar(hit.id)}
                    />
                  ))}
                </ResultsSection>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
