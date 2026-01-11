import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, CornerUpLeft, X } from "lucide-react";
import { useAction, useQuery } from "convex/react";
import { Button, ScrollArea, cn } from "@mythos/ui";
import { api } from "../../../../../convex/_generated/api";
import { useMythosStore } from "../../stores";
import { DiffView } from "./DiffViews";

type KnowledgeStatus = "proposed" | "accepted" | "rejected" | "resolved";
type KnowledgeRiskLevel = "low" | "high" | "core";

interface KnowledgeEditorContext {
  documentId?: string;
  documentTitle?: string;
  documentExcerpt?: string;
  selectionText?: string;
  selectionContext?: string;
}

interface KnowledgeSuggestion {
  _id: string;
  projectId: string;
  targetType: string;
  targetId?: string;
  operation: string;
  proposedPatch: unknown;
  normalizedPatch?: unknown;
  editorContext?: KnowledgeEditorContext;
  status: KnowledgeStatus;
  actorType: string;
  actorUserId?: string;
  actorAgentId?: string;
  actorName?: string;
  toolName: string;
  toolCallId: string;
  approvalType: string;
  danger?: string;
  riskLevel?: KnowledgeRiskLevel;
  streamId?: string;
  threadId?: string;
  promptMessageId?: string;
  model?: string;
  createdAt: number;
  updatedAt: number;
  resolvedAt?: number;
  resolvedByUserId?: string;
  result?: unknown;
  error?: string;
}

interface KnowledgeCitation {
  _id: string;
  memoryId: string;
  memoryCategory?: string;
  excerpt?: string;
  reason?: string;
  confidence?: number;
  visibility: "project" | "private" | "redacted";
  redactionReason?: string;
  memoryText?: string;
  memoryType?: string;
  createdAt: number;
}

interface DocumentDoc {
  _id: string;
  title?: string;
  contentText?: string;
}

interface KnowledgePRsViewProps {}

function formatRelativeTime(timestampMs: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - timestampMs) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value ?? "");
  }
}

function getStatusBadgeClasses(status: KnowledgeStatus): string {
  switch (status) {
    case "proposed":
      return "bg-mythos-accent-amber/15 text-mythos-accent-amber border-mythos-accent-amber/30";
    case "accepted":
      return "bg-mythos-accent-green/15 text-mythos-accent-green border-mythos-accent-green/30";
    case "rejected":
      return "bg-mythos-accent-red/15 text-mythos-accent-red border-mythos-accent-red/30";
    case "resolved":
      return "bg-mythos-bg-tertiary text-mythos-text-muted border-mythos-border-default";
  }
}

function getRiskBadgeClasses(riskLevel: KnowledgeRiskLevel): string {
  switch (riskLevel) {
    case "core":
      return "bg-mythos-accent-red/15 text-mythos-accent-red border-mythos-accent-red/30";
    case "high":
      return "bg-mythos-accent-amber/15 text-mythos-accent-amber border-mythos-accent-amber/30";
    case "low":
      return "bg-mythos-bg-tertiary text-mythos-text-muted border-mythos-border-default";
  }
}

function getRollbackInfo(
  suggestion: KnowledgeSuggestion
): { kind: string; rolledBackAt?: number } | null {
  if (!suggestion.result || typeof suggestion.result !== "object") return null;
  const result = suggestion.result as Record<string, unknown>;
  const rollback =
    result.rollback && typeof result.rollback === "object"
      ? (result.rollback as Record<string, unknown>)
      : null;
  if (!rollback || typeof rollback.kind !== "string") return null;
  const rolledBackAt =
    typeof result.rolledBackAt === "number" ? result.rolledBackAt : undefined;
  return { kind: rollback.kind, rolledBackAt };
}

function titleCase(input: string): string {
  return input
    .split(/[_\s]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

type WriteContentOperation = "replace_selection" | "insert_at_cursor" | "append_document";

type WriteContentDiffBlock = {
  label: string;
  before: string;
  after: string;
};

type WriteContentDiff = {
  operation: WriteContentOperation;
  blocks: WriteContentDiffBlock[];
  rationale?: string;
  note?: string;
  documentTitle?: string;
  documentExcerpt?: string;
};

type SelectionContextMatch = {
  context: string;
  matchCount: number;
};

function getRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function replaceFirst(haystack: string, needle: string, replacement: string): string {
  const index = haystack.indexOf(needle);
  if (index === -1) return haystack;
  return `${haystack.slice(0, index)}${replacement}${haystack.slice(index + needle.length)}`;
}

function parseWriteContentOperation(value: unknown): WriteContentOperation {
  if (value === "replace_selection" || value === "insert_at_cursor" || value === "append_document") {
    return value;
  }
  return "insert_at_cursor";
}

function buildDocumentExcerpt(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

function buildTailExcerpt(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `...${text.slice(text.length - maxLength)}`;
}

function findSelectionContext(
  documentText: string,
  selectionText: string,
  radius: number
): SelectionContextMatch | null {
  if (!selectionText) return null;

  const firstIndex = documentText.indexOf(selectionText);
  if (firstIndex === -1) return null;

  let matchCount = 0;
  let searchIndex = firstIndex;
  while (searchIndex !== -1) {
    matchCount += 1;
    searchIndex = documentText.indexOf(selectionText, searchIndex + selectionText.length);
  }

  const start = Math.max(0, firstIndex - radius);
  const end = Math.min(documentText.length, firstIndex + selectionText.length + radius);
  let context = documentText.slice(start, end);
  if (start > 0) context = `...${context}`;
  if (end < documentText.length) context = `${context}...`;

  return { context, matchCount };
}

function parseWriteContentArgs(
  patch: unknown
): { operation: WriteContentOperation; content: string; rationale?: string } | null {
  const record = getRecord(patch);
  if (!record) return null;
  const content = typeof record.content === "string" ? record.content : "";
  if (!content) return null;
  const operation = parseWriteContentOperation(record.operation);
  const rationale = typeof record.rationale === "string" ? record.rationale : undefined;
  return { operation, content, rationale };
}

function buildWriteContentDiff(
  patch: unknown,
  editorContext?: KnowledgeEditorContext,
  documentText?: string,
  documentTitle?: string
): WriteContentDiff | null {
  const parsed = parseWriteContentArgs(patch);
  if (!parsed) return null;

  const selectionText = editorContext?.selectionText;
  let selectionContext = editorContext?.selectionContext;
  let note = "";

  if (!selectionContext && selectionText && documentText) {
    const match = findSelectionContext(documentText, selectionText, 240);
    if (match) {
      selectionContext = match.context;
      if (match.matchCount > 1) {
        note = "Multiple matches found; showing the first occurrence.";
      }
    } else {
      note = "Selection not found in document text.";
    }
  }

  const resolvedDocumentTitle = editorContext?.documentTitle ?? documentTitle;
  const resolvedDocumentExcerpt =
    editorContext?.documentExcerpt ??
    (documentText ? buildDocumentExcerpt(documentText, 420) : undefined);

  const blocks: WriteContentDiffBlock[] = [];

  if (selectionText) {
    blocks.push({ label: "Selection", before: selectionText, after: parsed.content });
    if (selectionContext) {
      const contextAfter = replaceFirst(selectionContext, selectionText, parsed.content);
      if (contextAfter !== selectionContext) {
        blocks.push({ label: "Context", before: selectionContext, after: contextAfter });
      }
    }
  } else {
    if (parsed.operation === "replace_selection") {
      note = note || "Selection text unavailable for this proposal.";
    }
    if (documentText && parsed.operation === "append_document") {
      const tail = buildTailExcerpt(documentText, 240);
      blocks.push({
        label: "Document end",
        before: tail,
        after: `${tail}${parsed.content}`,
      });
    } else if (resolvedDocumentExcerpt) {
      const label = parsed.operation === "append_document" ? "Append" : "Insert";
      if (!note) {
        note = "Cursor position unavailable; showing excerpt with appended change.";
      }
      blocks.push({
        label,
        before: resolvedDocumentExcerpt,
        after: `${resolvedDocumentExcerpt}${parsed.content}`,
      });
    } else {
      const label = parsed.operation === "append_document" ? "Append" : "Insert";
      blocks.push({ label, before: "", after: parsed.content });
    }
  }

  const resolvedNote = note || undefined;
  return {
    operation: parsed.operation,
    blocks,
    rationale: parsed.rationale,
    note: resolvedNote,
    documentTitle: resolvedDocumentTitle,
    documentExcerpt: resolvedDocumentExcerpt,
  };
}

export function KnowledgePRsView(_: KnowledgePRsViewProps): JSX.Element {
  const projectId = useMythosStore((s) => s.project.currentProject?.id);
  const apiAny: any = api;

  const [status, setStatus] = useState<KnowledgeStatus | "all">("proposed");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const suggestions = useQuery(
    apiAny.knowledgeSuggestions.listByProject as any,
    projectId
      ? {
          projectId,
          status: status === "all" ? undefined : status,
          limit: 200,
        }
      : ("skip" as any)
  ) as KnowledgeSuggestion[] | undefined;

  const applyDecisions = useAction(
    apiAny.knowledgeSuggestions.applyDecisions as any
  );
  const rollbackSuggestion = useAction(
    apiAny.knowledgeSuggestions.rollbackSuggestion as any
  );

  const filtered = useMemo((): KnowledgeSuggestion[] => {
    const items = suggestions ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((s) => {
      const haystack = [
        s.operation,
        s.toolName,
        s.targetType,
        s.targetId ?? "",
        s.actorName ?? "",
        s.toolCallId,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [search, suggestions]);

  useEffect(() => {
    if (!filtered.length) {
      setSelectedId(null);
      return;
    }
    if (selectedId && filtered.some((s) => s._id === selectedId)) return;
    setSelectedId(filtered[0]?._id ?? null);
  }, [filtered, selectedId]);

  const selected = useMemo((): KnowledgeSuggestion | null => {
    return filtered.find((s) => s._id === selectedId) ?? null;
  }, [filtered, selectedId]);

  const citations = useQuery(
    apiAny.knowledgeCitations.listBySuggestion as any,
    selected ? { suggestionId: selected._id } : ("skip" as any)
  ) as KnowledgeCitation[] | undefined;

  const documentId =
    selected?.targetType === "document"
      ? selected.editorContext?.documentId ?? selected.targetId
      : undefined;
  const documentRecord = useQuery(
    apiAny.documents.get as any,
    documentId ? { id: documentId } : ("skip" as any)
  ) as DocumentDoc | undefined;
  const documentText =
    typeof documentRecord?.contentText === "string"
      ? documentRecord.contentText
      : undefined;

  const writeContentDiff = useMemo((): WriteContentDiff | null => {
    if (!selected || selected.toolName !== "write_content") return null;
    return buildWriteContentDiff(
      selected.proposedPatch,
      selected.editorContext,
      documentText,
      documentRecord?.title
    );
  }, [documentRecord?.title, documentText, selected]);

  const metaLabel = useMemo((): string => {
    if (!projectId) return "No project selected";
    if (suggestions === undefined) return "Loading…";
    return `${filtered.length} result${filtered.length === 1 ? "" : "s"}`;
  }, [filtered.length, projectId, suggestions]);

  const handleApply = useCallback(
    async (decision: "approve" | "reject"): Promise<void> => {
      if (!selected) return;
      setIsBusy(true);
      setActionError(null);
      try {
        await applyDecisions({ suggestionIds: [selected._id], decision });
      } catch (error) {
        setActionError(
          error instanceof Error ? error.message : "Failed to apply decision"
        );
      } finally {
        setIsBusy(false);
      }
    },
    [applyDecisions, selected]
  );

  const handleRollback = useCallback(async (): Promise<void> => {
    if (!selected) return;
    setIsBusy(true);
    setActionError(null);
    try {
      await rollbackSuggestion({ suggestionId: selected._id });
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Failed to undo change"
      );
    } finally {
      setIsBusy(false);
    }
  }, [rollbackSuggestion, selected]);

  const rollbackInfo = selected ? getRollbackInfo(selected) : null;
  const canRollback =
    selected?.status === "accepted" && rollbackInfo && !rollbackInfo.rolledBackAt;

  return (
    <div className="h-full flex flex-col md:flex-row">
      <div className="md:w-80 w-full border-b md:border-b-0 md:border-r border-mythos-border-default flex flex-col">
        <div className="p-3 border-b border-mythos-border-default space-y-3">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search changes…"
            className="w-full bg-mythos-bg-secondary/50 border border-mythos-border-default rounded-md px-3 py-2 text-sm text-mythos-text-primary focus:outline-none focus:border-mythos-accent-primary"
          />
          <div className="flex items-center gap-2 flex-wrap">
            {(["proposed", "accepted", "rejected", "all"] as const).map(
              (value) => (
                <Button
                  key={value}
                  size="sm"
                  variant={status === value ? "default" : "ghost"}
                  onClick={() => setStatus(value)}
                  className="h-7 text-xs"
                >
                  {value === "all" ? "All" : titleCase(value)}
                </Button>
              )
            )}
            <span className="text-xs text-mythos-text-muted ml-auto">
              {metaLabel}
            </span>
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-2">
            {filtered.length === 0 ? (
              <div className="text-xs text-mythos-text-muted">
                No Knowledge PRs found.
              </div>
            ) : (
              filtered.map((item) => (
                <button
                  key={item._id}
                  onClick={() => setSelectedId(item._id)}
                  className={cn(
                    "w-full text-left rounded-md border p-3 transition-colors",
                    selectedId === item._id
                      ? "border-mythos-accent-primary bg-mythos-bg-secondary"
                      : "border-mythos-border-default bg-mythos-bg-secondary/40 hover:bg-mythos-bg-secondary"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium text-mythos-text-primary truncate">
                      {titleCase(item.operation || item.toolName)} ·{" "}
                      {titleCase(item.targetType)}
                    </div>
                    <span
                      className={cn(
                        "text-[10px] px-2 py-0.5 rounded-full border",
                        getStatusBadgeClasses(item.status)
                      )}
                    >
                      {titleCase(item.status)}
                    </span>
                  </div>
                  <div className="text-xs text-mythos-text-muted truncate mt-1">
                    {item.toolName}
                    {item.targetId ? ` · ${item.targetId}` : ""}
                  </div>
                  <div className="text-[10px] text-mythos-text-muted mt-2">
                    {formatRelativeTime(item.createdAt)}
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="flex-1 p-4 space-y-4 overflow-auto">
        {!projectId ? (
          <div className="text-sm text-mythos-text-muted">
            Select a project to review Knowledge PRs.
          </div>
        ) : !selected ? (
          <div className="text-sm text-mythos-text-muted">
            Select a change to see details.
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-semibold text-mythos-text-primary">
                  {titleCase(selected.operation || selected.toolName)} ·{" "}
                  {titleCase(selected.targetType)}
                </h3>
                <span
                  className={cn(
                    "text-xs px-2 py-0.5 rounded-full border",
                    getStatusBadgeClasses(selected.status)
                  )}
                >
                  {titleCase(selected.status)}
                </span>
                {selected.riskLevel ? (
                  <span
                    className={cn(
                      "text-xs px-2 py-0.5 rounded-full border",
                      getRiskBadgeClasses(selected.riskLevel)
                    )}
                  >
                    {titleCase(selected.riskLevel)}
                  </span>
                ) : null}
              </div>
              <div className="text-xs text-mythos-text-muted">
                {selected.toolName}
                {selected.targetId ? ` · ${selected.targetId}` : ""}
              </div>
            </div>

            {selected.error ? (
              <div className="text-xs text-mythos-accent-red border border-mythos-accent-red/30 bg-mythos-accent-red/10 rounded-md px-3 py-2">
                {selected.error}
              </div>
            ) : null}

            {actionError ? (
              <div className="text-xs text-mythos-accent-red border border-mythos-accent-red/30 bg-mythos-accent-red/10 rounded-md px-3 py-2">
                {actionError}
              </div>
            ) : null}

            <div className="flex items-center gap-2 flex-wrap">
              {selected.status === "proposed" ? (
                <>
                  <Button
                    size="sm"
                    onClick={() => handleApply("approve")}
                    disabled={isBusy}
                    className="gap-1"
                  >
                    <Check className="w-3 h-3" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleApply("reject")}
                    disabled={isBusy}
                    className="gap-1"
                  >
                    <X className="w-3 h-3" />
                    Reject
                  </Button>
                </>
              ) : null}
              {canRollback ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRollback}
                  disabled={isBusy}
                  className="gap-1"
                >
                  <CornerUpLeft className="w-3 h-3" />
                  Undo
                </Button>
              ) : null}
            </div>

            {writeContentDiff ? (
              <div className="rounded-md border border-mythos-border-default bg-mythos-bg-secondary/40 p-3 space-y-3">
                <div className="text-[10px] uppercase tracking-wider text-mythos-text-muted">
                  Document diff
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-mythos-text-muted">
                  <span>Operation: {titleCase(writeContentDiff.operation)}</span>
                  {writeContentDiff.documentTitle ? (
                    <span>Document: {writeContentDiff.documentTitle}</span>
                  ) : null}
                  {selected.targetId ? (
                    <span className="truncate">Doc ID: {selected.targetId}</span>
                  ) : null}
                </div>
                {writeContentDiff.rationale ? (
                  <div className="text-xs text-mythos-text-muted">
                    Rationale: {writeContentDiff.rationale}
                  </div>
                ) : null}
                {writeContentDiff.note ? (
                  <div className="text-xs text-mythos-text-muted">{writeContentDiff.note}</div>
                ) : null}
                {writeContentDiff.documentExcerpt ? (
                  <div className="rounded-md border border-mythos-border-default bg-mythos-bg-tertiary/30 p-3">
                    <div className="text-[10px] uppercase tracking-wider text-mythos-text-muted">
                      Document excerpt
                    </div>
                    <pre className="mt-2 text-xs text-mythos-text-primary whitespace-pre-wrap">
                      {writeContentDiff.documentExcerpt}
                    </pre>
                  </div>
                ) : null}
                <div className="space-y-3">
                  {writeContentDiff.blocks.map((block, index) => (
                    <div key={`${block.label}-${index}`} className="space-y-2">
                      <div className="text-[10px] uppercase tracking-wider text-mythos-text-muted">
                        {block.label}
                      </div>
                      <DiffView before={block.before || "—"} after={block.after || "—"} />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="rounded-md border border-mythos-border-default bg-mythos-bg-secondary/40 p-3 space-y-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-mythos-text-muted">
                  Proposed patch
                </div>
                <pre className="mt-2 text-xs text-mythos-text-primary whitespace-pre-wrap">
                  {formatJson(selected.proposedPatch)}
                </pre>
              </div>
              {selected.normalizedPatch ? (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-mythos-text-muted">
                    Normalized patch
                  </div>
                  <pre className="mt-2 text-xs text-mythos-text-primary whitespace-pre-wrap">
                    {formatJson(selected.normalizedPatch)}
                  </pre>
                </div>
              ) : null}
            </div>

            {citations && citations.length > 0 ? (
              <div className="rounded-md border border-mythos-border-default bg-mythos-bg-secondary/40 p-3 space-y-3">
                <div className="text-[10px] uppercase tracking-wider text-mythos-text-muted">
                  Citations
                </div>
                <div className="space-y-2">
                  {citations.map((citation) => {
                    const redacted = citation.visibility === "redacted";
                    return (
                      <div
                        key={citation._id}
                        className="rounded-md border border-mythos-border-default p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs text-mythos-text-muted">
                          <span>
                            {citation.memoryCategory
                              ? titleCase(citation.memoryCategory)
                              : "Canon memory"}
                          </span>
                          <span className="truncate">{citation.memoryId}</span>
                        </div>
                        {redacted ? (
                          <div className="text-xs text-mythos-text-muted">
                            Citation redacted
                            {citation.redactionReason
                              ? ` (${citation.redactionReason})`
                              : ""}
                            .
                          </div>
                        ) : (
                          <>
                            <div className="text-sm text-mythos-text-primary">
                              {citation.memoryText ?? "Memory content unavailable."}
                            </div>
                            {citation.reason ? (
                              <div className="text-xs text-mythos-text-muted">
                                {citation.reason}
                              </div>
                            ) : null}
                            {citation.excerpt ? (
                              <div className="text-xs text-mythos-text-muted">
                                {citation.excerpt}
                              </div>
                            ) : null}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
