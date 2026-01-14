/**
 * ArtifactPanel - Side panel for AI-generated artifacts with iteration chat
 *
 * Features:
 * - Shows artifact content (prose, diagram, table, code, etc.)
 * - Iteration mini-chat for refining artifacts
 * - Actions: Copy, Insert, Save
 * - Version history
 */

import { useState, useRef, useEffect, useMemo, type RefObject } from "react";
import { Button, cn, ScrollArea } from "@mythos/ui";
import { bg } from "@mythos/theme";
import {
  useArtifactStore,
  useActiveArtifact,
  useArtifacts,
  ARTIFACT_TYPE_LABELS,
  ARTIFACT_TYPE_ICONS,
  type Artifact,
  type ArtifactType,
} from "@mythos/state";
import { parseArtifactEnvelope } from "@mythos/core";
import { ArtifactRuntime, type ArtifactRendererHandle } from "./runtime/ArtifactRuntime";
import { useMythosStore } from "../../stores";
import * as LucideIcons from "lucide-react";
import {
  X,
  Copy,
  User,
  LayoutPanelLeft,
  GripVertical,
  ArrowDownToLine,
} from "lucide-react";

// Helper to get icon component from name
function ArtifactIcon({ type, className }: { type: ArtifactType; className?: string }) {
  const iconName = ARTIFACT_TYPE_ICONS[type];
  // Convert kebab-case to PascalCase for lucide
  const pascalName = iconName
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
  const IconComponent = (LucideIcons as Record<string, React.ComponentType<{ className?: string }>>)[pascalName];
  if (!IconComponent) return null;
  return <IconComponent className={className ?? "w-4 h-4"} />;
}

interface ArtifactPanelProps {
  className?: string;
  flowMode?: boolean;
}

export function ArtifactPanel({ className, flowMode = false }: ArtifactPanelProps) {
  const artifact = useActiveArtifact();
  const artifacts = useArtifacts();
  const { removeArtifact, setActiveArtifact } = useArtifactStore();
  const currentDocument = useMythosStore((s) => s.document.currentDocument);

  const [iterationInput, setIterationInput] = useState("");
  const [showVersions, setShowVersions] = useState(false);
  const [showArtifactList, setShowArtifactList] = useState(false);
  const [inputExpanded, setInputExpanded] = useState(false);
  const [scrubIndex, setScrubIndex] = useState(0);
  const iterationInputRef = useRef<HTMLTextAreaElement>(null);
  const historyScrollRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<ArtifactRendererHandle | null>(null);

  // Keep expanded if has content
  const isExpanded = inputExpanded || iterationInput.trim().length > 0;

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (artifact?.iterationHistory.length && historyScrollRef.current) {
      setTimeout(() => {
        historyScrollRef.current?.scrollTo({
          top: historyScrollRef.current.scrollHeight,
          behavior: "smooth",
        });
      }, 100);
    }
  }, [artifact?.iterationHistory.length]);

  useEffect(() => {
    if (!artifact) return;
    const currentIndex = artifact.versions.findIndex((v) => v.id === artifact.currentVersionId);
    if (currentIndex >= 0) {
      setScrubIndex(currentIndex);
    }
  }, [artifact?.currentVersionId, artifact?.versions]);

  useEffect(() => {
    if (!artifact) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!artifact) return;
      const isModifier = event.metaKey || event.ctrlKey;
      if (!isModifier) return;
      if (event.key !== "[" && event.key !== "]") return;

      event.preventDefault();
      const currentIndex = artifact.versions.findIndex((v) => v.id === artifact.currentVersionId);
      if (currentIndex === -1) return;
      const delta = event.key === "[" ? -1 : 1;
      const nextIndex = Math.min(
        artifact.versions.length - 1,
        Math.max(0, currentIndex + delta)
      );
      const target = artifact.versions[nextIndex];
      if (target && target.id !== artifact.currentVersionId) {
        useArtifactStore.getState().restoreVersion(artifact.id, target.id);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [artifact]);

  // Handle iteration submit
  const handleIterationSubmit = () => {
    if (!iterationInput.trim() || !artifact) return;

    useArtifactStore.getState().addIterationMessage(artifact.id, {
      role: "user",
      content: iterationInput.trim(),
      context: currentDocument
        ? {
            documentId: currentDocument.id,
            documentTitle: currentDocument.title ?? "Untitled",
            documentContent: currentDocument.content,
          }
        : undefined,
    });

    // TODO: Call AI to process iteration
    // For now, just add a mock response
    setTimeout(() => {
      useArtifactStore.getState().addIterationMessage(artifact.id, {
        role: "assistant",
        content: "I'll update the artifact based on your feedback...",
      });
    }, 500);

    setIterationInput("");
  };

  // Handle copy
  const handleCopy = async () => {
    if (!artifact) return;
    await navigator.clipboard.writeText(artifact.content);
  };

  // Handle insert (placeholder)
  const handleInsert = () => {
    if (!artifact) return;
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("artifact:insert-content", {
          detail: {
            content: artifact.content,
            format: artifact.format,
            title: artifact.title,
            artifactId: artifact.id,
          },
        })
      );
    }
  };

  const handleExport = async () => {
    if (!runtimeRef.current || !artifact) return;
    const result = await runtimeRef.current.exportArtifact("png");
    if (!result) return;
    if (result.dataUrl) {
      const link = document.createElement("a");
      link.href = result.dataUrl;
      link.download = `${artifact.title || "artifact"}.${result.format === "svg" ? "svg" : "png"}`;
      link.click();
      return;
    }
    if (result.json) {
      const blob = new Blob([result.json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${artifact.title || "artifact"}.json`;
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  // Handle save (placeholder)
  const handleSave = () => {
    if (!artifact) return;
    // TODO: Implement save to entity/canon
    console.log("Save artifact:", artifact.id);
  };

  if (!artifact) {
    return (
      <div className={cn("h-full flex flex-col bg-mythos-bg-primary", className)}>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3 px-6">
            <LayoutPanelLeft className="w-10 h-10 mx-auto text-mythos-text-muted opacity-50" />
            <div className="text-sm text-mythos-text-muted">No artifact selected</div>
            <div className="text-xs text-mythos-text-muted/70">AI-generated content will appear here</div>
          </div>
        </div>
      </div>
    );
  }

  const hasRuntimeEnvelope = useMemo(() => {
    if (!artifact || artifact.format !== "json") return false;
    try {
      parseArtifactEnvelope(JSON.parse(artifact.content));
      return true;
    } catch {
      return false;
    }
  }, [artifact.content, artifact.format]);

  return (
    <div className={cn("h-full flex flex-col bg-mythos-bg-primary", className)}>
      {/* Minimal header - Claude style */}
      <div className="flex-none flex items-center justify-between px-3 py-2.5 relative">
        {/* Left: type label (clickable for multi-artifact) */}
        <button
          onClick={artifacts.length > 1 ? () => setShowArtifactList(!showArtifactList) : undefined}
          className="flex items-center gap-2"
        >
          <span className="text-xs text-mythos-text-muted">
            {ARTIFACT_TYPE_LABELS[artifact.type].toLowerCase()}
            {artifacts.length > 1 && ` (${artifacts.length})`}
          </span>
          {artifact.versions.length > 1 && (
            <button onClick={() => setShowVersions(!showVersions)} className="text-xs text-mythos-text-muted/70">
              v{artifact.versions.length}
            </button>
          )}
        </button>

        {/* Right: Copy + Close */}
        <div className="flex items-center gap-2">
          {hasRuntimeEnvelope && (
            <button onClick={handleExport} className="flex items-center gap-1 hover:opacity-70">
              <ArrowDownToLine className="w-3.5 h-3.5 text-mythos-text-muted" />
              <span className="text-xs text-mythos-text-muted">Export</span>
            </button>
          )}
          <button onClick={handleCopy} className="flex items-center gap-1 hover:opacity-70">
            <Copy className="w-3.5 h-3.5 text-mythos-text-muted" />
            <span className="text-xs text-mythos-text-muted">Copy</span>
          </button>
          <button onClick={() => removeArtifact(artifact.id)} className="p-1 hover:opacity-70">
            <X className="w-4 h-4 text-mythos-text-muted" />
          </button>
        </div>

        {/* Artifact list dropdown */}
        {showArtifactList && (
          <div className="absolute top-full left-2 right-2 bg-mythos-bg-elevated rounded-md p-1 z-50 shadow-lg">
            {artifacts.map((a) => (
              <button
                key={a.id}
                onClick={() => { setActiveArtifact(a.id); setShowArtifactList(false); }}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs",
                  a.id === artifact.id ? "bg-mythos-accent/20 text-mythos-accent" : "hover:bg-mythos-bg-hover text-mythos-text-secondary"
                )}
              >
                <ArtifactIcon type={a.type} className="w-3.5 h-3.5" />
                <span className="truncate">{a.title}</span>
              </button>
            ))}
          </div>
        )}

        {/* Version history dropdown */}
        {showVersions && (
          <div className="absolute top-full left-2 right-2 bg-mythos-bg-elevated rounded-md p-2 z-50 shadow-lg space-y-1">
            {artifact.versions.length > 1 && (
              <div className="px-2 pb-2">
                <input
                  type="range"
                  min={0}
                  max={artifact.versions.length - 1}
                  value={scrubIndex}
                  onChange={(event) => {
                    const nextIndex = Number(event.target.value);
                    const target = artifact.versions[nextIndex];
                    if (target && target.id !== artifact.currentVersionId) {
                      useArtifactStore.getState().restoreVersion(artifact.id, target.id);
                    }
                    setScrubIndex(nextIndex);
                  }}
                  className="w-full accent-mythos-accent"
                  aria-label="Scrub versions"
                />
              </div>
            )}
            {[...artifact.versions].reverse().map((v, idx) => (
              <button
                key={v.id}
                onClick={() => { useArtifactStore.getState().restoreVersion(artifact.id, v.id); setShowVersions(false); }}
                className={cn(
                  "w-full flex items-center justify-between px-2 py-1 rounded text-xs",
                  v.id === artifact.currentVersionId ? "bg-mythos-accent/20 text-mythos-accent" : "hover:bg-mythos-bg-hover text-mythos-text-secondary"
                )}
              >
                <span>Version {artifact.versions.length - idx}</span>
                <span className="text-mythos-text-muted">{new Date(v.timestamp).toLocaleTimeString()}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          <ArtifactRenderer artifact={artifact} runtimeRef={runtimeRef} />
        </div>
      </ScrollArea>

      {/* Iteration Chat - hidden in flow mode */}
      {!flowMode && (
        <div className="flex-none px-4 pb-4">
          {/* Iteration history with fade gradient */}
          {artifact.iterationHistory.length > 0 && (
            <div className="relative max-h-[100px] mb-1.5">
              <div
                ref={historyScrollRef}
                className="overflow-y-auto max-h-[100px] flex flex-col justify-end"
              >
                {artifact.iterationHistory.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "text-[11px] px-2 py-1 rounded mb-1",
                      msg.role === "user" ? "bg-mythos-bg-tertiary/60 ml-4" : "bg-mythos-accent/10"
                    )}
                  >
                    {msg.content}
                  </div>
                ))}
              </div>
              <div className="absolute top-0 left-0 right-0 h-5 bg-gradient-to-b from-mythos-bg-primary to-transparent pointer-events-none" />
            </div>
          )}

          {/* Collapsible pill input - centered */}
          <div className="flex justify-center">
            <div
              className={cn(
                "overflow-hidden cursor-text transition-all duration-150",
                isExpanded ? "rounded-[14px] w-full" : "rounded-full w-1/2 min-w-[120px]",
                iterationInput.trim() ? "border border-mythos-accent" : "border border-transparent"
              )}
              style={{ background: bg.hover }}
              onClick={() => {
                if (!isExpanded) {
                  setInputExpanded(true);
                  setTimeout(() => iterationInputRef.current?.focus(), 50);
                }
              }}
            >
              {/* Collapsed state - ChatGPT style pill */}
              {!isExpanded && (
                <div className="flex items-center justify-between px-4 py-3 hover:opacity-80 transition-opacity">
                  <span className="text-[13px] text-mythos-text-muted">Refine artifact...</span>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5">
                    <span className="text-sm text-mythos-text-muted">↑</span>
                  </div>
                </div>
              )}
            {/* Expanded state */}
            {isExpanded && (
              <>
                <textarea
                  ref={iterationInputRef}
                  value={iterationInput}
                  onChange={(e) => setIterationInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleIterationSubmit();
                    }
                    if (e.key === "Escape" && !iterationInput.trim()) {
                      setInputExpanded(false);
                      iterationInputRef.current?.blur();
                    }
                  }}
                  onBlur={() => {
                    if (!iterationInput.trim()) {
                      setTimeout(() => setInputExpanded(false), 150);
                    }
                  }}
                  placeholder="Refine..."
                  className="w-full bg-transparent text-[11px] text-mythos-text-primary placeholder:text-mythos-text-muted resize-none h-[60px] outline-none leading-normal px-3 pt-2"
                />
                <div className="flex items-center justify-between px-2 pb-1.5 gap-1">
                  <div className="flex items-center">
                    <button onClick={(e) => { e.stopPropagation(); handleCopy(); }} className="px-1.5 py-0.5 rounded hover:bg-white/5 text-[9px] text-mythos-text-muted">Copy</button>
                    <button onClick={(e) => { e.stopPropagation(); handleInsert(); }} className="px-1.5 py-0.5 rounded hover:bg-white/5 text-[9px] text-mythos-text-muted">Insert</button>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleIterationSubmit(); }}
                    disabled={!iterationInput.trim()}
                    className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                      iterationInput.trim() ? "bg-mythos-accent text-black" : "bg-white/5 text-mythos-text-muted"
                    )}
                  >
                    ↑
                  </button>
                </div>
              </>
            )}
            </div>
          </div>
        </div>
      )}

      {/* Minimal actions in flow mode */}
      {flowMode && (
        <div className="flex-none p-3 flex gap-2">
          <Button size="sm" variant="outline" onClick={handleCopy} className="flex-1">Copy</Button>
          <Button size="sm" variant="outline" onClick={handleInsert} className="flex-1">Insert</Button>
        </div>
      )}
    </div>
  );
}

// Artifact content renderer
function ArtifactRenderer({
  artifact,
  runtimeRef,
}: {
  artifact: Artifact;
  runtimeRef: RefObject<ArtifactRendererHandle>;
}) {
  const hasRuntimeEnvelope = useMemo(() => {
    if (artifact.format !== "json") return false;
    try {
      parseArtifactEnvelope(JSON.parse(artifact.content));
      return true;
    } catch {
      return false;
    }
  }, [artifact.content, artifact.format]);

  if (hasRuntimeEnvelope) {
    return <ArtifactRuntime ref={runtimeRef} artifact={artifact} />;
  }

  switch (artifact.type) {
    case "diagram":
      return <DiagramRenderer content={artifact.content} />;
    case "table":
      return <TableRenderer content={artifact.content} format={artifact.format} />;
    case "timeline":
      return <TimelineRenderer content={artifact.content} />;
    case "entity":
      return <EntityRenderer content={artifact.content} title={artifact.title} />;
    case "code":
      return <CodeRenderer content={artifact.content} />;
    default:
      return <ProseRenderer content={artifact.content} />;
  }
}

// Prose renderer (default)
function ProseRenderer({ content }: { content: string }) {
  return (
    <div className="prose prose-sm prose-invert max-w-none">
      <div className="whitespace-pre-wrap text-mythos-text-primary leading-relaxed">
        {content}
      </div>
    </div>
  );
}

// Diagram renderer (mermaid)
function DiagramRenderer({ content }: { content: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const renderId = useMemo(
    () => `artifact-mermaid-${Math.random().toString(36).slice(2, 9)}`,
    []
  );
  const mermaidTheme = useMemo(() => {
    if (typeof window === "undefined") return "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "default";
  }, []);

  useEffect(() => {
    let cancelled = false;

    const renderDiagram = async () => {
      if (!content.trim()) {
        setSvg(null);
        setRenderError(null);
        return;
      }
      if (typeof window === "undefined") return;

      try {
        const { default: mermaid } = await import("mermaid");
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: mermaidTheme,
        });
        const { svg: nextSvg } = await mermaid.render(renderId, content);
        if (!cancelled) {
          setSvg(nextSvg);
          setRenderError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setSvg(null);
          setRenderError(
            error instanceof Error ? error.message : "Unable to render diagram."
          );
        }
      }
    };

    renderDiagram();

    return () => {
      cancelled = true;
    };
  }, [content, mermaidTheme, renderId]);

  return (
    <div className="space-y-3">
      <div className="bg-mythos-bg-tertiary rounded-lg p-4 border border-mythos-border-default">
        <div className="text-center text-mythos-text-muted text-xs mb-3">
          Diagram Preview
        </div>
        {svg ? (
          <div className="w-full overflow-x-auto" dangerouslySetInnerHTML={{ __html: svg }} />
        ) : (
          <div className="space-y-2">
            <pre className="text-xs text-mythos-text-secondary font-mono whitespace-pre-wrap">
              {content}
            </pre>
            {renderError && (
              <div className="text-[11px] text-mythos-accent-red">{renderError}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Table renderer
function TableRenderer({ content, format }: { content: string; format: string }) {
  const tableData = useMemo(() => {
    if (format === "json") {
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) return parsed;
        if (parsed && Array.isArray(parsed.rows)) return parsed.rows;
        return null;
      } catch {
        return null;
      }
    }
    // Parse markdown table
    const lines = content.trim().split("\n").filter((l) => l.trim() && !l.includes("---"));
    if (lines.length === 0) return null;
    return lines.map((line) =>
      line.split("|").map((cell) => cell.trim()).filter(Boolean)
    );
  }, [content, format]);

  const activeArtifact = useActiveArtifact();
  const addIterationMessage = useArtifactStore((s) => s.addIterationMessage);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [editedCells, setEditedCells] = useState<Record<string, string>>({});
  const [editingCell, setEditingCell] = useState<{ rowId: string; colIndex: number } | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const headerCheckboxRef = useRef<HTMLInputElement>(null);
  const tableRows = Array.isArray(tableData) ? tableData : [];
  const header = tableRows[0] ?? [];
  const rows = tableRows.slice(1);
  const rowIds = rows.map((_, index) => `row-${index}`);
  const allSelected = rows.length > 0 && selectedRowIds.size === rows.length;
  const someSelected = selectedRowIds.size > 0 && selectedRowIds.size < rows.length;

  useEffect(() => {
    setSelectedRowIds(new Set());
    setEditedCells({});
    setEditingCell(null);
    setEditingValue("");
  }, [content, format]);

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  const toggleRow = (rowId: string) => {
    setSelectedRowIds((current) => {
      const next = new Set(current);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelectedRowIds(new Set());
      return;
    }
    setSelectedRowIds(new Set(rowIds));
  };

  const handleAddRow = () => {
    if (!activeArtifact) return;
    addIterationMessage(activeArtifact.id, {
      role: "user",
      content: "Add a row to the table.",
    });
  };

  const startEdit = (rowId: string, colIndex: number, value: string) => {
    setEditingCell({ rowId, colIndex });
    setEditingValue(value);
  };

  const commitEdit = () => {
    if (!editingCell) return;
    const rowIndex = rowIds.indexOf(editingCell.rowId);
    const rowLabel = rowIndex >= 0 ? String(rowIndex + 1) : editingCell.rowId;
    const headerValue = header[editingCell.colIndex];
    let columnLabel = `Column ${editingCell.colIndex + 1}`;
    if (typeof headerValue === "string" && headerValue.trim().length > 0) {
      columnLabel = headerValue;
    } else if (headerValue !== undefined && headerValue !== null) {
      columnLabel = String(headerValue);
    }

    setEditedCells((current) => ({
      ...current,
      [`${editingCell.rowId}:${editingCell.colIndex}`]: editingValue,
    }));
    setEditingCell(null);
    setEditingValue("");

    if (!activeArtifact) return;
    addIterationMessage(activeArtifact.id, {
      role: "user",
      content: `Update table row ${rowLabel} column "${columnLabel}" to "${editingValue}".`,
    });
  };

  if (!tableData || !Array.isArray(tableData) || tableData.length === 0) {
    return <ProseRenderer content={content} />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-mythos-border-default">
            <th className="w-8 px-2 py-2" aria-label="Row handle" />
            <th className="w-8 px-2 py-2">
              <input
                ref={headerCheckboxRef}
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="h-3.5 w-3.5 rounded border-mythos-border-default bg-mythos-bg-secondary"
                aria-label="Select all rows"
              />
            </th>
            {header.map((cell: string, i: number) => (
              <th
                key={i}
                className="px-3 py-2 text-left text-xs font-medium text-mythos-text-muted uppercase tracking-wider"
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row: string[], i: number) => (
            <tr
              key={i}
              className="border-b border-mythos-border-default/50 hover:bg-mythos-bg-hover"
            >
              <td className="px-2 py-2 text-mythos-text-muted">
                <GripVertical className="w-3.5 h-3.5 opacity-60" />
              </td>
              <td className="px-2 py-2">
                <input
                  type="checkbox"
                  checked={selectedRowIds.has(rowIds[i])}
                  onChange={() => toggleRow(rowIds[i])}
                  className="h-3.5 w-3.5 rounded border-mythos-border-default bg-mythos-bg-secondary"
                  aria-label={`Select row ${i + 1}`}
                />
              </td>
              {row.map((cell: string, j: number) => {
                const cellKey = `${rowIds[i]}:${j}`;
                const editedValue = editedCells[cellKey];
                const displayValue = editedValue ?? String(cell ?? "");
                const isEditing =
                  editingCell?.rowId === rowIds[i] && editingCell?.colIndex === j;

                if (isEditing) {
                  return (
                    <td key={j} className="px-3 py-2">
                      <input
                        value={editingValue}
                        onChange={(event) => setEditingValue(event.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            event.currentTarget.blur();
                          }
                          if (event.key === "Escape") {
                            event.preventDefault();
                            setEditingCell(null);
                            setEditingValue("");
                          }
                        }}
                        autoFocus
                        className="w-full bg-mythos-bg-secondary text-mythos-text-primary text-sm rounded px-2 py-1 outline-none"
                        aria-label={`Edit row ${i + 1} column ${j + 1}`}
                      />
                    </td>
                  );
                }

                return (
                  <td key={j} className="px-3 py-2 text-mythos-text-primary">
                    <button
                      type="button"
                      onClick={() => startEdit(rowIds[i], j, displayValue)}
                      className="w-full text-left hover:text-mythos-text-primary"
                    >
                      {displayValue}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="pt-2">
        <button
          type="button"
          onClick={handleAddRow}
          className="text-xs text-mythos-text-muted hover:text-mythos-text-primary"
        >
          + Add row
        </button>
      </div>
    </div>
  );
}

// Timeline renderer
function TimelineRenderer({ content }: { content: string }) {
  const events = useMemo(() => {
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Parse text format: "Year 1 - Event"
      const lines = content.split("\n").filter((l) => l.trim());
      return lines.map((line) => {
        const match = line.match(/^(\d+)\s*[-–—:]\s*(.+)$/);
        if (match) return { year: parseInt(match[1]), event: match[2] };
        return { year: 0, event: line };
      });
    }
    return [];
  }, [content]);

  if (events.length === 0) {
    return <ProseRenderer content={content} />;
  }

  return (
    <div className="space-y-1">
      {events.map((e: { year: number; event: string }, i: number) => (
        <div key={i} className="flex gap-3 items-start">
          <div className="flex-none w-12 text-right">
            <span className="text-xs font-mono text-mythos-accent">{e.year}</span>
          </div>
          <div className="flex-none w-px bg-mythos-border-default self-stretch" />
          <div className="flex-1 pb-3">
            <div className="text-sm text-mythos-text-primary">{e.event}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Entity renderer
function EntityRenderer({ content, title }: { content: string; title: string }) {
  const data = useMemo(() => {
    try {
      return JSON.parse(content);
    } catch {
      return null;
    }
  }, [content]);

  if (!data) {
    return <ProseRenderer content={content} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-mythos-accent/20 flex items-center justify-center">
          <User className="w-6 h-6 text-mythos-accent" />
        </div>
        <div>
          <div className="font-medium text-mythos-text-primary">{title}</div>
          {data.role && (
            <div className="text-xs text-mythos-text-muted">{data.role}</div>
          )}
        </div>
      </div>

      {data.description && (
        <div className="text-sm text-mythos-text-secondary">{data.description}</div>
      )}

      <div className="grid grid-cols-2 gap-2 text-xs">
        {Object.entries(data)
          .filter(([k]) => !["description", "role", "name"].includes(k))
          .map(([key, value]) => (
            <div key={key} className="bg-mythos-bg-tertiary rounded px-2 py-1.5">
              <div className="text-mythos-text-muted capitalize">{key}</div>
              <div className="text-mythos-text-primary">
                {Array.isArray(value) ? value.join(", ") : String(value)}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

// Code renderer
function CodeRenderer({ content }: { content: string }) {
  return (
    <pre className="bg-mythos-bg-tertiary rounded-lg p-4 overflow-x-auto">
      <code className="text-xs font-mono text-mythos-text-primary whitespace-pre">
        {content}
      </code>
    </pre>
  );
}
