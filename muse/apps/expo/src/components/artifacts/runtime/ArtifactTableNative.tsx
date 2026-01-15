/**
 * ArtifactTableNative - Native table renderer with drag-to-reorder
 *
 * Features:
 * - Gesture-based row reordering (emits table.row.reorder op)
 * - Row selection with checkboxes
 * - Cell editing (inline)
 * - Focus support for deep linking (focusId prop)
 * - Add row / Remove selected actions
 */

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  FlatList,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import {
  GestureDetector,
  Gesture,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import { Feather } from "@expo/vector-icons";
import { useTheme, spacing, typography, radii } from "@/design-system";
import type { ArtifactOp } from "@mythos/state";
import type { ArtifactEnvelopeByType } from "@mythos/core";

// Enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Use the actual table envelope type from core
type TableEnvelope = Extract<ArtifactEnvelopeByType, { type: "table" }>;

// Extract column and row types from the table data
type TableColumn = TableEnvelope["data"]["columnsById"][string];
type TableRow = TableEnvelope["data"]["rowsById"][string];

interface ArtifactTableNativeProps {
  envelope: TableEnvelope;
  focusId?: string | null;
  onApplyOp: (op: ArtifactOp) => void;
  onSelectElement?: (elementId: string) => void;
}

const ROW_HEIGHT = 48;
const HANDLE_WIDTH = 32;
const CHECKBOX_WIDTH = 36;

export function ArtifactTableNative({
  envelope,
  focusId,
  onApplyOp,
  onSelectElement,
}: ArtifactTableNativeProps) {
  const { colors } = useTheme();
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<{
    rowId: string;
    columnId: string;
  } | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [draggingRowId, setDraggingRowId] = useState<string | null>(null);
  const [localRowOrder, setLocalRowOrder] = useState<string[]>(envelope.data.rowOrder);
  const scrollViewRef = useRef<ScrollView>(null);

  const { columnsById, columnOrder, rowsById, rowOrder } = envelope.data;

  // Get columns in order
  const columns = columnOrder.map((colId) => columnsById[colId]).filter(Boolean);

  // Sync local order with envelope when it changes from server
  useEffect(() => {
    setLocalRowOrder(envelope.data.rowOrder);
  }, [envelope.data.rowOrder]);

  // Focus handling - scroll to and highlight focused row
  useEffect(() => {
    if (!focusId) return;

    const rowIndex = localRowOrder.indexOf(focusId);
    if (rowIndex >= 0) {
      // Scroll to focused row
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          y: rowIndex * ROW_HEIGHT,
          animated: true,
        });
      }, 100);
    }
  }, [focusId, localRowOrder]);

  // Selection helpers
  const allSelected = useMemo(
    () => localRowOrder.length > 0 && selectedRowIds.size === localRowOrder.length,
    [localRowOrder.length, selectedRowIds.size]
  );

  const toggleRow = useCallback((rowId: string) => {
    setSelectedRowIds((current) => {
      const next = new Set(current);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
    onSelectElement?.(rowId);
  }, [onSelectElement]);

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelectedRowIds(new Set());
    } else {
      setSelectedRowIds(new Set(localRowOrder));
    }
  }, [allSelected, localRowOrder]);

  // Cell editing
  const startEdit = useCallback((rowId: string, columnId: string, cell: unknown) => {
    setEditingCell({ rowId, columnId });
    // Extract value from typed cell
    const typedCell = cell as { t?: string; v?: unknown } | undefined;
    setEditingValue(String(typedCell?.v ?? ""));
  }, []);

  const commitEdit = useCallback(() => {
    if (!editingCell) return;

    const { rowId, columnId } = editingCell;
    const currentRow = rowsById[rowId];
    const currentCell = currentRow?.cells[columnId] as { t?: string; v?: unknown } | undefined;
    const currentValue = String(currentCell?.v ?? "");
    const currentType = currentCell?.t ?? "text";

    // Only emit op if value changed
    if (currentValue !== editingValue) {
      onApplyOp({
        type: "table.cell.update",
        rowId,
        columnId,
        value: { t: currentType, v: editingValue },
      });
    }

    setEditingCell(null);
    setEditingValue("");
  }, [editingCell, editingValue, onApplyOp, rowsById]);

  // Row reordering
  const handleDragEnd = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) {
        setDraggingRowId(null);
        return;
      }

      const nextOrder = [...localRowOrder];
      const [removed] = nextOrder.splice(fromIndex, 1);
      nextOrder.splice(toIndex, 0, removed);

      // Optimistic update
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setLocalRowOrder(nextOrder);
      setDraggingRowId(null);

      // Emit op
      onApplyOp({ type: "table.row.reorder", rowOrder: nextOrder });
    },
    [localRowOrder, onApplyOp]
  );

  // Helper to get display value from typed cell
  const getCellDisplayValue = useCallback((cell: unknown): string => {
    if (!cell || typeof cell !== "object") return "";
    const typedCell = cell as { t?: string; v?: unknown };
    if (typedCell.v === undefined) return "";
    return String(typedCell.v);
  }, []);

  // Add row action
  const handleAddRow = useCallback(() => {
    const newRowId = `row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const cells: Record<string, { t: string; v: string }> = {};
    for (const col of columns) {
      cells[col.columnId] = { t: "text", v: "" };
    }

    onApplyOp({
      type: "table.row.add",
      row: { rowId: newRowId, cells },
    });
  }, [columns, onApplyOp]);

  // Remove selected action
  const handleRemoveSelected = useCallback(() => {
    if (selectedRowIds.size === 0) return;

    onApplyOp({
      type: "table.rows.remove",
      rowIds: Array.from(selectedRowIds),
    });

    setSelectedRowIds(new Set());
  }, [onApplyOp, selectedRowIds]);

  return (
    <View style={styles.container}>
      {/* Toolbar */}
      <View style={[styles.toolbar, { borderBottomColor: colors.border }]}>
        <Pressable
          onPress={handleAddRow}
          style={[styles.toolbarButton, { backgroundColor: colors.bgElevated }]}
        >
          <Feather name="plus" size={14} color={colors.textMuted} />
          <Text style={[styles.toolbarButtonText, { color: colors.textMuted }]}>
            Add row
          </Text>
        </Pressable>
        <Pressable
          onPress={handleRemoveSelected}
          disabled={selectedRowIds.size === 0}
          style={[
            styles.toolbarButton,
            { backgroundColor: colors.bgElevated },
            selectedRowIds.size === 0 && styles.toolbarButtonDisabled,
          ]}
        >
          <Feather
            name="trash-2"
            size={14}
            color={selectedRowIds.size === 0 ? colors.textMuted + "66" : colors.textMuted}
          />
          <Text
            style={[
              styles.toolbarButtonText,
              { color: colors.textMuted },
              selectedRowIds.size === 0 && styles.toolbarButtonTextDisabled,
            ]}
          >
            Remove selected {selectedRowIds.size > 0 && `(${selectedRowIds.size})`}
          </Text>
        </Pressable>
      </View>

      {/* Focus indicator */}
      {focusId && localRowOrder.includes(focusId) && (
        <View style={[styles.focusIndicator, { backgroundColor: colors.accent + "20" }]}>
          <Feather name="target" size={12} color={colors.accent} />
          <Text style={[styles.focusIndicatorText, { color: colors.accent }]}>
            Focused: Row {localRowOrder.indexOf(focusId) + 1}
          </Text>
        </View>
      )}

      <ScrollView
        ref={scrollViewRef}
        style={styles.tableScroll}
        horizontal={false}
        showsVerticalScrollIndicator
      >
        {/* Header */}
        <View style={[styles.headerRow, { borderBottomColor: colors.border }]}>
          <View style={styles.handleCell} />
          <Pressable onPress={toggleAll} style={styles.checkboxCell}>
            <Feather
              name={allSelected ? "check-square" : "square"}
              size={16}
              color={allSelected ? colors.accent : colors.textMuted}
            />
          </Pressable>
          {columns.map((col) => (
            <View key={col.columnId} style={[styles.headerCell, { minWidth: col.width ?? 120 }]}>
              <Text style={[styles.headerText, { color: colors.textMuted }]} numberOfLines={1}>
                {col.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Rows with drag handles */}
        <GestureHandlerRootView style={styles.rowsContainer}>
          {localRowOrder.map((rowId, index) => {
            const row = rowsById[rowId];
            if (!row) return null;

            const isFocused = focusId === rowId;
            const isSelected = selectedRowIds.has(rowId);
            const isDragging = draggingRowId === rowId;

            return (
              <DraggableRow
                key={rowId}
                rowId={rowId}
                row={row}
                index={index}
                columns={columns}
                colors={colors}
                isFocused={isFocused}
                isSelected={isSelected}
                isDragging={isDragging}
                editingCell={editingCell}
                editingValue={editingValue}
                getCellDisplayValue={getCellDisplayValue}
                onToggleSelect={() => toggleRow(rowId)}
                onStartEdit={startEdit}
                onChangeEditValue={setEditingValue}
                onCommitEdit={commitEdit}
                onDragStart={() => setDraggingRowId(rowId)}
                onDragEnd={(toIndex) => handleDragEnd(index, toIndex)}
                totalRows={localRowOrder.length}
              />
            );
          })}
        </GestureHandlerRootView>
      </ScrollView>
    </View>
  );
}

// Individual draggable row component
interface DraggableRowProps {
  rowId: string;
  row: TableRow;
  index: number;
  columns: TableColumn[];
  colors: ReturnType<typeof useTheme>["colors"];
  isFocused: boolean;
  isSelected: boolean;
  isDragging: boolean;
  editingCell: { rowId: string; columnId: string } | null;
  editingValue: string;
  getCellDisplayValue: (cell: unknown) => string;
  onToggleSelect: () => void;
  onStartEdit: (rowId: string, columnId: string, cell: unknown) => void;
  onChangeEditValue: (value: string) => void;
  onCommitEdit: () => void;
  onDragStart: () => void;
  onDragEnd: (toIndex: number) => void;
  totalRows: number;
}

function DraggableRow({
  rowId,
  row,
  index,
  columns,
  colors,
  isFocused,
  isSelected,
  isDragging,
  editingCell,
  editingValue,
  getCellDisplayValue,
  onToggleSelect,
  onStartEdit,
  onChangeEditValue,
  onCommitEdit,
  onDragStart,
  onDragEnd,
  totalRows,
}: DraggableRowProps) {
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const zIndex = useSharedValue(0);
  const startIndex = useRef(index);

  const panGesture = Gesture.Pan()
    .onStart(() => {
      startIndex.current = index;
      scale.value = withSpring(1.02);
      zIndex.value = 100;
      runOnJS(onDragStart)();
    })
    .onUpdate((event) => {
      translateY.value = event.translationY;
    })
    .onEnd(() => {
      const movedRows = Math.round(translateY.value / ROW_HEIGHT);
      const newIndex = Math.max(0, Math.min(totalRows - 1, startIndex.current + movedRows));

      translateY.value = withSpring(0);
      scale.value = withSpring(1);
      zIndex.value = 0;

      runOnJS(onDragEnd)(newIndex);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
    zIndex: zIndex.value,
  }));

  return (
    <Animated.View
      style={[
        styles.rowWrapper,
        animatedStyle,
        isDragging && styles.rowDragging,
        isFocused && { backgroundColor: colors.accent + "15" },
      ]}
    >
      <View
        style={[
          styles.row,
          { borderBottomColor: colors.border },
          isSelected && { backgroundColor: colors.accent + "10" },
          isFocused && styles.rowFocused,
        ]}
      >
        {/* Drag handle */}
        <GestureDetector gesture={panGesture}>
          <View style={styles.handleCell}>
            <Feather name="menu" size={14} color={colors.textMuted} />
          </View>
        </GestureDetector>

        {/* Checkbox */}
        <Pressable onPress={onToggleSelect} style={styles.checkboxCell}>
          <Feather
            name={isSelected ? "check-square" : "square"}
            size={16}
            color={isSelected ? colors.accent : colors.textMuted}
          />
        </Pressable>

        {/* Cells */}
        {columns.map((col) => {
          const cellValue = row.cells[col.columnId];
          const isEditing =
            editingCell?.rowId === rowId && editingCell?.columnId === col.columnId;

          if (isEditing) {
            return (
              <View key={col.columnId} style={[styles.cell, { minWidth: col.width ?? 120 }]}>
                <TextInput
                  value={editingValue}
                  onChangeText={onChangeEditValue}
                  onBlur={onCommitEdit}
                  onSubmitEditing={onCommitEdit}
                  autoFocus
                  style={[
                    styles.cellInput,
                    { color: colors.text, borderColor: colors.accent },
                  ]}
                  returnKeyType="done"
                />
              </View>
            );
          }

          return (
            <Pressable
              key={col.columnId}
              onPress={() => onStartEdit(rowId, col.columnId, cellValue)}
              style={[styles.cell, { minWidth: col.width ?? 120 }]}
            >
              <Text style={[styles.cellText, { color: colors.text }]} numberOfLines={2}>
                {getCellDisplayValue(cellValue)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Focus ring indicator */}
      {isFocused && (
        <View
          style={[styles.focusRing, { borderColor: colors.accent }]}
          pointerEvents="none"
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  toolbar: {
    flexDirection: "row",
    gap: spacing[2],
    padding: spacing[2],
    borderBottomWidth: 1,
  },
  toolbarButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[1],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1.5],
    borderRadius: radii.md,
  },
  toolbarButtonDisabled: {
    opacity: 0.5,
  },
  toolbarButtonText: {
    fontSize: typography.xs,
  },
  toolbarButtonTextDisabled: {
    opacity: 0.6,
  },
  focusIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[1],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
  },
  focusIndicatorText: {
    fontSize: typography.xs,
  },
  tableScroll: {
    flex: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    height: ROW_HEIGHT,
    borderBottomWidth: 1,
  },
  handleCell: {
    width: HANDLE_WIDTH,
    height: ROW_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxCell: {
    width: CHECKBOX_WIDTH,
    height: ROW_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCell: {
    paddingHorizontal: spacing[2],
    height: ROW_HEIGHT,
    justifyContent: "center",
  },
  headerText: {
    fontSize: typography.xs,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  rowsContainer: {
    flex: 1,
  },
  rowWrapper: {
    position: "relative",
  },
  rowDragging: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    height: ROW_HEIGHT,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowFocused: {
    borderLeftWidth: 3,
  },
  cell: {
    paddingHorizontal: spacing[2],
    height: ROW_HEIGHT,
    justifyContent: "center",
  },
  cellText: {
    fontSize: typography.sm,
  },
  cellInput: {
    flex: 1,
    fontSize: typography.sm,
    paddingHorizontal: spacing[1],
    paddingVertical: spacing[0.5],
    borderWidth: 1,
    borderRadius: radii.sm,
  },
  focusRing: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 2,
    borderRadius: radii.sm,
    pointerEvents: "none",
  },
});

export default ArtifactTableNative;
