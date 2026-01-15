import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type {
  ColumnDef,
  RowSelectionState,
  SortingState,
  ColumnSizingState,
  Row,
} from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { GripVertical } from "lucide-react";
import { cn } from "@mythos/ui";
import type { ArtifactEnvelopeByType, CellValue } from "@mythos/core";
import type { ArtifactOp } from "@mythos/state";
import { toPng, toSvg } from "html-to-image";
import type { ArtifactRendererHandle, ArtifactExportResult } from "./ArtifactRuntime";

interface TableRow {
  rowId: string;
  cells: Record<string, CellValue>;
}

export interface ArtifactTableProps {
  envelope: Extract<ArtifactEnvelopeByType, { type: "table" }>;
  focusId: string | null;
  onApplyOp: (op: ArtifactOp) => void;
}

function coerceCellValue(valueType: string, rawValue: string): CellValue {
  if (valueType === "number") {
    const numberValue = Number(rawValue);
    return { t: "number", v: Number.isNaN(numberValue) ? 0 : numberValue };
  }
  if (valueType === "bool") {
    return { t: "bool", v: rawValue.toLowerCase() === "true" };
  }
  if (valueType === "date") {
    return { t: "date", v: rawValue };
  }
  if (valueType === "enum") {
    return { t: "enum", v: rawValue };
  }
  if (valueType === "entity") {
    return { t: "entity", v: rawValue };
  }
  return { t: "text", v: rawValue };
}

function formatCellValue(value: CellValue | undefined): string {
  if (!value) return "";
  if (value.t === "bool") return value.v ? "True" : "False";
  return String(value.v);
}

interface SortableRowProps {
  row: Row<TableRow>;
  rowRefs: React.MutableRefObject<Record<string, HTMLTableRowElement | null>>;
  canReorder: boolean;
}

function SortableRow({ row, rowRefs, canReorder }: SortableRowProps): JSX.Element {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.id, disabled: !canReorder });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
    opacity: isDragging ? 0.6 : 1,
  } as const;

  return (
    <tr
      key={row.id}
      ref={(node) => {
        setNodeRef(node);
        rowRefs.current[row.id] = node;
      }}
      style={style}
      className={cn(
        "border-b border-mythos-border-default/50 hover:bg-mythos-bg-hover",
        row.index % 2 === 0 && "bg-mythos-bg-secondary/20"
      )}
    >
      <td className="px-2 py-2 text-mythos-text-muted">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          className={cn(
            "cursor-grab active:cursor-grabbing",
            !canReorder && "cursor-not-allowed opacity-40"
          )}
          aria-label={`Drag row ${row.index + 1}`}
        >
          <GripVertical className="w-3.5 h-3.5 opacity-60" />
        </button>
      </td>
      <td className="px-2 py-2">
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          className="h-3.5 w-3.5 rounded border-mythos-border-default bg-mythos-bg-secondary"
          aria-label={`Select row ${row.index + 1}`}
        />
      </td>
      {row.getVisibleCells().map((cell) => (
        <td key={cell.id} className="px-3 py-2" style={{ width: cell.column.getSize() }}>
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </td>
      ))}
    </tr>
  );
}

function ArtifactTableComponent(
  { envelope, focusId, onApplyOp }: ArtifactTableProps,
  ref: React.Ref<ArtifactRendererHandle>
): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const [editingCell, setEditingCell] = useState<{ rowId: string; columnId: string } | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});

  const columnsById = envelope.data.columnsById;
  const columnOrder = envelope.data.columnOrder;
  const rowsById = envelope.data.rowsById;
  const rowOrder = envelope.data.rowOrder;
  const selectedRowIds = Object.keys(rowSelection).filter((rowId) => rowSelection[rowId]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const canReorder = sorting.length === 0;

  const data = useMemo<TableRow[]>(() => {
    return rowOrder
      .map((rowId) => rowsById[rowId])
      .filter(Boolean)
      .map((row) => ({ rowId: row.rowId, cells: row.cells }));
  }, [rowOrder, rowsById]);

  const columns = useMemo<ColumnDef<TableRow>[]>(() => {
    return columnOrder.map((columnId) => {
      const column = columnsById[columnId];
      return {
        id: columnId,
        header: column?.label ?? columnId,
        accessorFn: (row) => row.cells[columnId],
        size: column?.width,
        cell: (info) => {
          const value = info.getValue() as CellValue | undefined;
          const rowId = info.row.original.rowId;
          const isEditing =
            editingCell?.rowId === rowId && editingCell?.columnId === columnId;
          const displayValue = formatCellValue(value);

          if (isEditing) {
            return (
              <input
                value={editingValue}
                onChange={(event) => setEditingValue(event.target.value)}
                onBlur={() => {
                  const valueType = column?.valueType ?? "text";
                  const nextValue = coerceCellValue(valueType, editingValue);
                  onApplyOp({
                    type: "table.cell.update",
                    rowId,
                    columnId,
                    value: nextValue,
                  });
                  setEditingCell(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                  if (event.key === "Escape") {
                    setEditingCell(null);
                  }
                }}
                className="w-full bg-mythos-bg-secondary text-mythos-text-primary text-xs rounded px-2 py-1"
              />
            );
          }

          return (
            <button
              type="button"
              onClick={() => {
                setEditingCell({ rowId, columnId });
                setEditingValue(displayValue);
              }}
              className="w-full text-left text-mythos-text-primary hover:text-mythos-text-primary"
            >
              {displayValue}
            </button>
          );
        },
      };
    });
  }, [columnOrder, columnsById, editingCell, editingValue, onApplyOp]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => row.rowId,
    onSortingChange: setSorting,
    onColumnSizingChange: setColumnSizing,
    columnResizeMode: "onChange",
    state: { rowSelection, sorting, columnSizing },
  });

  useEffect(() => {
    if (!focusId) return;
    const rowEl = rowRefs.current[focusId];
    if (rowEl) {
      rowEl.scrollIntoView({ behavior: "smooth", block: "center" });
      rowEl.classList.add("ring-2", "ring-mythos-accent/60");
      setTimeout(() => rowEl.classList.remove("ring-2", "ring-mythos-accent/60"), 1200);
    }
  }, [focusId]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!canReorder || !over || active.id === over.id) return;
    const oldIndex = rowOrder.indexOf(String(active.id));
    const newIndex = rowOrder.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    const nextOrder = arrayMove(rowOrder, oldIndex, newIndex);
    onApplyOp({ type: "table.row.reorder", rowOrder: nextOrder });
  };

  const handleAddRow = () => {
    const rowId = `row-${Date.now()}`;
    const newRow: TableRow = {
      rowId,
      cells: {},
    };
    for (const columnId of columnOrder) {
      const column = columnsById[columnId];
      newRow.cells[columnId] = coerceCellValue(column?.valueType ?? "text", "");
    }
    onApplyOp({ type: "table.row.add", row: newRow });
  };

  const handleDeleteSelected = () => {
    if (selectedRowIds.length === 0) return;
    onApplyOp({ type: "table.rows.remove", rowIds: selectedRowIds });
    setRowSelection({});
  };

  const handleExport = useCallback(async (format: "png" | "svg" | "json"): Promise<ArtifactExportResult | null> => {
    if (format === "json") {
      return { format: "json", json: JSON.stringify(envelope, null, 2) };
    }
    if (!containerRef.current) return null;
    if (format === "svg") {
      try {
        const dataUrl = await toSvg(containerRef.current);
        return { format: "svg", dataUrl };
      } catch (error) {
        console.warn("[ArtifactTable] SVG export failed, falling back to PNG", error);
      }
    }
    const dataUrl = await toPng(containerRef.current);
    return { format: "png", dataUrl };
  }, [envelope]);

  const handleFocus = useCallback((elementId: string) => {
    const rowEl = rowRefs.current[elementId];
    if (rowEl) {
      rowEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  useImperativeHandle(ref, () => ({
    exportArtifact: handleExport,
    focusElement: handleFocus,
  }), [handleExport, handleFocus]);

  return (
    <div ref={containerRef} className="space-y-3">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={rowOrder} strategy={verticalListSortingStrategy}>
          <div className="overflow-x-auto rounded-lg border border-mythos-border-default">
            <table className="w-full text-sm">
              <thead className="bg-mythos-bg-secondary">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id} className="border-b border-mythos-border-default">
                    <th className="w-8 px-2 py-2" aria-label="Row handle" />
                    <th className="w-8 px-2 py-2" />
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className="relative px-3 py-2 text-left text-xs font-medium text-mythos-text-muted uppercase tracking-wider"
                        style={{ width: header.getSize() }}
                      >
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="flex items-center gap-1"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getIsSorted() === "asc" && <span>↑</span>}
                          {header.column.getIsSorted() === "desc" && <span>↓</span>}
                        </button>
                        {header.column.getCanResize() && (
                          <div
                            onMouseDown={header.getResizeHandler()}
                            onTouchStart={header.getResizeHandler()}
                            className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize select-none"
                          />
                        )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <SortableRow
                    key={row.id}
                    row={row}
                    rowRefs={rowRefs}
                    canReorder={canReorder}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </SortableContext>
      </DndContext>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleAddRow}
          className="text-xs text-mythos-text-muted hover:text-mythos-text-primary"
        >
          + Add row
        </button>
        <button
          type="button"
          onClick={handleDeleteSelected}
          disabled={selectedRowIds.length === 0}
          className="text-xs text-mythos-text-muted hover:text-mythos-text-primary disabled:opacity-40"
        >
          Remove selected
        </button>
      </div>
    </div>
  );
}

export const ArtifactTable = forwardRef(ArtifactTableComponent);
