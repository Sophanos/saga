import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Button, cn } from "@mythos/ui";
import type { ArtifactSourceType, ArtifactSourceRef } from "@mythos/agent-protocol";
import { searchViaEdge, type SemanticResult } from "../../services/ai";

interface SourcePickerModalProps {
  isOpen: boolean;
  projectId: string;
  existingSources: ArtifactSourceRef[];
  onClose: () => void;
  onConfirm: (sources: Array<{ type: ArtifactSourceType; id: string }>) => Promise<void>;
}

interface SourceCandidate {
  type: ArtifactSourceType;
  id: string;
  title?: string;
}

function mapResultToCandidate(result: SemanticResult): SourceCandidate {
  return {
    type: result.type,
    id: result.id,
    title: result.title,
  };
}

function buildSourceKey(source: { type: string; id: string }): string {
  return `${source.type}:${source.id}`;
}

export function SourcePickerModal({
  isOpen,
  projectId,
  existingSources,
  onClose,
  onConfirm,
}: SourcePickerModalProps): JSX.Element | null {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SemanticResult[]>([]);
  const [selected, setSelected] = useState<SourceCandidate[]>([]);
  const [manualType, setManualType] = useState<ArtifactSourceType>("document");
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const existingKeys = useMemo(() => {
    return new Set(existingSources.map((source) => buildSourceKey(source)));
  }, [existingSources]);

  const selectedKeys = useMemo(() => {
    return new Set(selected.map((source) => buildSourceKey(source)));
  }, [selected]);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setResults([]);
      setSelected([]);
      setError(null);
      setIsSearching(false);
      abortRef.current?.abort();
      abortRef.current = null;
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setError(null);

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    const handle = setTimeout(async () => {
      try {
        const response = await searchViaEdge(
          {
            query: trimmed,
            projectId,
            limit: 8,
          },
          { signal: controller.signal }
        );
        setResults(response.results ?? []);
      } catch (err) {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : "Search failed";
        setError(message);
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    }, 300);

    return () => {
      clearTimeout(handle);
      controller.abort();
    };
  }, [query, projectId, isOpen]);

  const addCandidate = useCallback(
    (candidate: SourceCandidate) => {
      const key = buildSourceKey(candidate);
      if (existingKeys.has(key) || selectedKeys.has(key)) return;
      setSelected((prev) => [...prev, candidate]);
    },
    [existingKeys, selectedKeys]
  );

  const removeCandidate = useCallback((candidate: SourceCandidate) => {
    const key = buildSourceKey(candidate);
    setSelected((prev) => prev.filter((item) => buildSourceKey(item) !== key));
  }, []);

  const handleManualAdd = useCallback(() => {
    const trimmed = query.trim();
    if (!trimmed) return;
    addCandidate({ type: manualType, id: trimmed });
    setQuery("");
  }, [query, manualType, addCandidate]);

  const handleConfirm = useCallback(async () => {
    if (selected.length === 0) {
      onClose();
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onConfirm(
        selected.map((item) => ({ type: item.type, id: item.id }))
      );
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to add sources";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [selected, onConfirm, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-mythos-bg-primary/70" onClick={onClose} />
      <div
        className={cn(
          "relative z-10 w-full max-w-xl mx-4",
          "bg-mythos-bg-secondary border border-mythos-border-default rounded-xl shadow-2xl",
          "flex flex-col max-h-[80vh]"
        )}
      >
        <div className="px-5 py-4 border-b border-mythos-border-default flex items-center justify-between">
          <div className="text-sm font-medium text-mythos-text-primary">Add sources</div>
          <button onClick={onClose} className="text-mythos-text-muted hover:text-mythos-text-primary">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="flex items-center gap-2 rounded-lg border border-mythos-border-default px-3 py-2">
            <Search className="w-4 h-4 text-mythos-text-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search documents or entities..."
              data-testid="widget-source-picker-search"
              className="flex-1 bg-transparent text-sm text-mythos-text-primary outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={manualType}
              onChange={(event) => setManualType(event.target.value as ArtifactSourceType)}
              className="bg-mythos-bg-primary border border-mythos-border-default rounded-md px-2 py-1 text-xs text-mythos-text-secondary"
            >
              <option value="document">Document</option>
              <option value="entity">Entity</option>
              <option value="memory">Memory</option>
            </select>
            <Button
              size="sm"
              variant="outline"
              onClick={handleManualAdd}
              disabled={!query.trim()}
              data-testid="widget-source-picker-add-id"
            >
              Add ID
            </Button>
            <span className="text-xs text-mythos-text-muted">
              Paste an ID to add directly
            </span>
          </div>

          {selected.length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] uppercase tracking-wide text-mythos-text-muted">
                Selected
              </div>
              <div className="flex flex-wrap gap-2">
                {selected.map((item) => (
                  <button
                    key={buildSourceKey(item)}
                    onClick={() => removeCandidate(item)}
                    className="px-2 py-1 rounded-full text-xs bg-mythos-bg-primary text-mythos-text-secondary border border-mythos-border-default hover:text-mythos-text-primary"
                  >
                    {item.title ?? item.id} · {item.type}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="text-[11px] uppercase tracking-wide text-mythos-text-muted">
              Results
            </div>
            {isSearching && (
              <div className="text-xs text-mythos-text-muted">Searching…</div>
            )}
            {error && (
              <div className="text-xs text-mythos-accent-red">{error}</div>
            )}
            {!isSearching && !error && results.length === 0 && query.trim() && (
              <div className="text-xs text-mythos-text-muted">No results</div>
            )}
            <div className="space-y-2">
              {results.map((result) => {
                const candidate = mapResultToCandidate(result);
                const key = buildSourceKey(candidate);
                const alreadyAdded = existingKeys.has(key) || selectedKeys.has(key);
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-2 rounded-lg border border-mythos-border-default px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="text-sm text-mythos-text-primary truncate">
                        {candidate.title ?? candidate.id}
                      </div>
                      <div className="text-xs text-mythos-text-muted">
                        {candidate.type}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => addCandidate(candidate)}
                      disabled={alreadyAdded}
                    >
                      {alreadyAdded ? "Added" : "Add"}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-mythos-border-default flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleConfirm} disabled={isSubmitting} data-testid="widget-source-picker-confirm">
            {isSubmitting ? "Saving..." : "Add sources"}
          </Button>
        </div>
      </div>
    </div>
  );
}
