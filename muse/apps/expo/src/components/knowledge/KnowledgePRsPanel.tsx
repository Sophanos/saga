/**
 * KnowledgePRsPanel
 *
 * Expo Web UI for reviewing Knowledge Suggestions (tool approval requests).
 * Product labels: "Changes to review" / "Version history".
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, FlatList, useWindowDimensions, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAction, useConvex } from 'convex/react';
import { api } from '../../../../../convex/_generated/api';
import type { Id } from '../../../../../convex/_generated/dataModel';
import { useTheme, spacing, radii, typography } from '@/design-system';
import { useLayoutStore } from '@mythos/state';
import { KnowledgeSuggestionDetails } from '@/components/knowledge/KnowledgeSuggestionDetails';
import { RollbackConfirmModal } from '@/components/knowledge/RollbackConfirmModal';
import type { KnowledgeStatus, KnowledgeSuggestion } from '@/components/knowledge/types';
import { formatRelativeTime, titleCase } from '@/components/knowledge/types';

function statusPillColors(
  status: KnowledgeStatus,
  colors: { text: string; textMuted: string; bgHover: string; bgSurface: string; border: string; accent: string }
): { bg: string; fg: string; border: string } {
  switch (status) {
    case 'proposed':
      return { bg: colors.accent + '14', fg: colors.accent, border: colors.accent + '2A' };
    case 'accepted':
      return { bg: '#22c55e14', fg: '#22c55e', border: '#22c55e2A' };
    case 'rejected':
      return { bg: '#ef444414', fg: '#ef4444', border: '#ef44442A' };
    case 'resolved':
      return { bg: colors.bgHover, fg: colors.textMuted, border: colors.border };
  }
}

export interface KnowledgePRsPanelProps {
  projectId: string | null;
  onClose: () => void;
}

const PAGE_SIZE = 50;

export function KnowledgePRsPanel({ projectId, onClose }: KnowledgePRsPanelProps): JSX.Element {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const router = useRouter();
  const convex = useConvex();
  const { setPendingWriteContent, closeKnowledgePanel } = useLayoutStore();

  const [status, setStatus] = useState<KnowledgeStatus | 'all'>('proposed');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Pagination state
  const [suggestions, setSuggestions] = useState<KnowledgeSuggestion[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const isMountedRef = useRef(true);

  // Rollback modal state
  const [rollbackModalVisible, setRollbackModalVisible] = useState(false);
  const [rollbackSuggestionId, setRollbackSuggestionId] = useState<string | null>(null);
  const [isRollingBack, setIsRollingBack] = useState(false);

  // Convex API types are too deep for expo typecheck; treat as untyped.
  // @ts-ignore
  const apiAny: any = api;
  const applyDecisions = useAction(apiAny.knowledgeSuggestions.applyDecisions as any);
  const rollbackSuggestionAction = useAction(apiAny.knowledgeSuggestions.rollbackSuggestion as any);

  // Track mounted state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Load suggestions with cursor-based pagination
  const loadSuggestions = useCallback(
    async (reset = false) => {
      if (!projectId || isLoading) return;

      setIsLoading(true);
      try {
        const currentCursor = reset ? null : cursor;
        const data = await convex.query(api.knowledgeSuggestions.listByProject, {
          projectId: projectId as Id<'projects'>,
          status: status === 'all' ? undefined : status,
          limit: PAGE_SIZE,
          cursor: currentCursor ?? undefined,
        }) as KnowledgeSuggestion[];

        if (!isMountedRef.current) return;

        // Derive next cursor from last item's createdAt
        const nextCursor = data.length > 0 ? data[data.length - 1]!.createdAt : null;

        if (reset) {
          setSuggestions(data);
        } else {
          setSuggestions((prev) => [...prev, ...data]);
        }
        setCursor(nextCursor);
        setHasMore(data.length === PAGE_SIZE);
        setIsInitialLoad(false);
      } catch (error) {
        if (!isMountedRef.current) return;
        console.error('[KnowledgePRs] Failed to load suggestions:', error);
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [convex, projectId, status, cursor, isLoading]
  );

  // Load on mount and when filters change
  useEffect(() => {
    if (projectId) {
      setSuggestions([]);
      setCursor(null);
      setHasMore(true);
      setIsInitialLoad(true);
      loadSuggestions(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, status]);

  const handleLoadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      loadSuggestions(false);
    }
  }, [isLoading, hasMore, loadSuggestions]);

  const filtered = useMemo((): KnowledgeSuggestion[] => {
    const items = suggestions ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((s) => {
      const haystack = [
        s.operation,
        s.toolName,
        s.targetType,
        s.targetId ?? '',
        s.actorName ?? '',
        s.toolCallId,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [search, suggestions]);

  useEffect(() => {
    if (!filtered.length) return;
    if (selectedId && filtered.some((s) => s._id === selectedId)) return;
    setSelectedId(filtered[0]!._id);
  }, [filtered, selectedId]);

  const selected = useMemo((): KnowledgeSuggestion | null => {
    return filtered.find((s) => s._id === selectedId) ?? null;
  }, [filtered, selectedId]);

  const checkedSet = useMemo(() => new Set(checkedIds), [checkedIds]);

  useEffect(() => {
    setCheckedIds((prev) => prev.filter((id) => filtered.some((s) => s._id === id)));
  }, [filtered]);

  const metaLabel = useMemo((): string => {
    if (!projectId) return 'No project selected';
    if (isInitialLoad) return 'Loading…';
    const suffix = hasMore ? '+' : '';
    return `${filtered.length}${suffix} result${filtered.length === 1 ? '' : 's'}`;
  }, [filtered.length, hasMore, isInitialLoad, projectId]);

  const toggleChecked = useCallback((id: string): void => {
    setCheckedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const clearChecked = useCallback((): void => {
    setCheckedIds([]);
  }, []);

  const handleApply = useCallback(async (suggestionIds: string[], decision: 'approve' | 'reject'): Promise<void> => {
    if (!suggestionIds.length) return;
    if (!projectId) return;
    setIsBusy(true);
    setActionError(null);
    try {
      await applyDecisions({ suggestionIds, decision });
      setCheckedIds([]);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to apply decision');
    } finally {
      setIsBusy(false);
    }
  }, [applyDecisions, projectId]);

  // Open rollback confirmation modal instead of direct rollback
  const handleOpenRollbackModal = useCallback((suggestionId: string): void => {
    setRollbackSuggestionId(suggestionId);
    setRollbackModalVisible(true);
  }, []);

  const handleCloseRollbackModal = useCallback((): void => {
    setRollbackModalVisible(false);
    setRollbackSuggestionId(null);
  }, []);

  const handleConfirmRollback = useCallback(
    async (suggestionId: string, cascadeRelationships: boolean): Promise<void> => {
      setIsRollingBack(true);
      setActionError(null);
      try {
        await rollbackSuggestionAction({ suggestionId, cascadeRelationships });
        // Refresh the list after successful rollback
        loadSuggestions(true);
      } catch (error) {
        setActionError(error instanceof Error ? error.message : 'Failed to undo change');
        throw error; // Re-throw so modal can show error
      } finally {
        setIsRollingBack(false);
      }
    },
    [rollbackSuggestionAction, loadSuggestions]
  );

  const handleOpenWriteContent = useCallback((suggestion: KnowledgeSuggestion): void => {
    if (!projectId || suggestion.toolName !== 'write_content') return;

    const toolArgs = (suggestion.proposedPatch ?? {}) as Record<string, unknown>;
    const content = typeof toolArgs.content === 'string' ? toolArgs.content : '';
    const operation =
      toolArgs.operation === 'replace_selection' || toolArgs.operation === 'append_document'
        ? toolArgs.operation
        : 'insert_at_cursor';
    const documentId =
      suggestion.editorContext?.documentId ?? suggestion.targetId ?? null;

    if (!documentId || !content) {
      setActionError('Missing document or content for write_content suggestion');
      return;
    }

    // Set the pending write_content in state
    setPendingWriteContent({
      suggestionId: suggestion._id,
      toolCallId: suggestion.toolCallId,
      documentId,
      content,
      operation: operation as 'replace_selection' | 'insert_at_cursor' | 'append_document',
      selectionText: suggestion.editorContext?.selectionText,
    });

    // Close the panel and navigate to the editor
    closeKnowledgePanel();
    router.push({
      pathname: '/editor',
      params: { projectId, documentId },
    });
  }, [closeKnowledgePanel, projectId, router, setPendingWriteContent]);

  return (
    <View style={styles.root} testID="approvals-panel">
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <View style={[styles.headerIcon, { backgroundColor: colors.bgHover }]}>
            <Feather name="git-pull-request" size={14} color={colors.accent} />
          </View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Changes to review</Text>
        </View>
        <Pressable
          onPress={onClose}
          accessibilityLabel="Close changes to review"
          style={({ pressed, hovered }) => [
            styles.iconButton,
            (pressed || hovered) && { backgroundColor: colors.bgHover },
          ]}
        >
          <Feather name="x" size={16} color={colors.textMuted} />
        </Pressable>
      </View>

      <View style={[styles.controls, { borderBottomColor: colors.border }]}>
        <View style={[styles.searchRow, { backgroundColor: colors.bgSurface, borderColor: colors.border }]}>
          <Feather name="search" size={14} color={colors.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search changes…"
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.text }]}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.filters}>
	          {(['proposed', 'accepted', 'rejected', 'all'] as const).map((value) => {
	            const isActive = status === value;
	            const label = value === 'all' ? 'All' : titleCase(value);
	            return (
	              <Pressable
	                key={value}
	                onPress={() => setStatus(value)}
	                style={({ pressed, hovered }) => {
	                  let backgroundColor: string = colors.bgSurface;
	                  if (isActive) {
	                    backgroundColor = colors.accent + '16';
	                  } else if (pressed || hovered) {
	                    backgroundColor = colors.bgHover;
	                  }
	                  return [
	                    styles.filterChip,
	                    {
	                      borderColor: isActive ? colors.accent : colors.border,
	                      backgroundColor,
	                    },
	                  ];
	                }}
	              >
	                <Text style={[styles.filterChipText, { color: isActive ? colors.accent : colors.textSecondary }]}>
	                  {label}
	                </Text>
	              </Pressable>
            );
	          })}
	          <View style={{ flex: 1 }} />
	          <Text style={[styles.metaText, { color: colors.textMuted }]}>
	            {metaLabel}
	          </Text>
	        </View>

        {actionError ? (
          <View style={[styles.banner, { backgroundColor: '#ef444414', borderColor: '#ef44442A' }]}>
            <Feather name="alert-triangle" size={14} color="#ef4444" />
            <Text style={[styles.bannerText, { color: '#ef4444' }]} numberOfLines={2}>
              {actionError}
            </Text>
          </View>
        ) : null}

        {checkedIds.length > 0 ? (
          <View style={styles.batchRow}>
            <Text style={[styles.batchText, { color: colors.textMuted }]}>
              {checkedIds.length} selected
            </Text>
            <Pressable
              disabled={isBusy}
              onPress={() => { void handleApply(checkedIds, 'approve'); }}
              style={({ pressed, hovered }) => [
                styles.batchPrimary,
                { backgroundColor: pressed || hovered ? colors.accent + 'CC' : colors.accent, opacity: isBusy ? 0.6 : 1 },
              ]}
            >
              <Text style={[styles.batchPrimaryText, { color: '#fff' }]}>Approve</Text>
            </Pressable>
            <Pressable
              disabled={isBusy}
              onPress={() => { void handleApply(checkedIds, 'reject'); }}
              style={({ pressed, hovered }) => [
                styles.batchSecondary,
                {
                  backgroundColor: pressed || hovered ? colors.bgHover : colors.bgSurface,
                  borderColor: colors.border,
                  opacity: isBusy ? 0.6 : 1,
                },
              ]}
            >
              <Text style={[styles.batchSecondaryText, { color: colors.text }]}>Reject</Text>
            </Pressable>
            <Pressable
              onPress={clearChecked}
              style={({ pressed, hovered }) => [
                styles.batchClear,
                (pressed || hovered) && { backgroundColor: colors.bgHover },
              ]}
            >
              <Text style={[styles.batchClearText, { color: colors.textMuted }]}>Clear</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <View style={[styles.body, { flexDirection: isWide ? 'row' : 'column' }]}>
        <View style={[styles.listColumn, { borderRightColor: isWide ? colors.border : 'transparent' }]}>
          {!projectId ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Select a project</Text>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                Changes to review appear after the agent requests approval for high-impact tools.
              </Text>
            </View>
          ) : isInitialLoad ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="small" color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>Loading…</Text>
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No changes yet</Text>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                Nothing matches this filter.
              </Text>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item._id}
              contentContainerStyle={styles.listScroll}
              showsVerticalScrollIndicator={false}
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.5}
              ListFooterComponent={
                isLoading ? (
                  <View style={styles.loadingFooter}>
                    <ActivityIndicator size="small" color={colors.textMuted} />
                  </View>
                ) : hasMore ? (
                  <Pressable
                    onPress={handleLoadMore}
                    style={({ pressed, hovered }) => [
                      styles.loadMoreButton,
                      { backgroundColor: colors.bgSurface, borderColor: colors.border },
                      (pressed || hovered) && { backgroundColor: colors.bgHover },
                    ]}
                  >
                    <Feather name="chevron-down" size={14} color={colors.textMuted} />
                    <Text style={[styles.loadMoreText, { color: colors.textMuted }]}>Load more</Text>
                  </Pressable>
                ) : null
              }
              renderItem={({ item: s }) => {
                const isSelected = s._id === selectedId;
                const isChecked = checkedSet.has(s._id);
                const pill = statusPillColors(s.status, colors);
                const title = `${titleCase(s.operation || s.toolName)} · ${titleCase(s.targetType)}`;
                const subtitle = `${titleCase(s.toolName)}${s.targetId ? ` · ${s.targetId}` : ''}`;
                return (
                  <Pressable
                    testID={`approval-item-${s._id}`}
                    accessibilityLabel={`Change to review: ${title}`}
                    onPress={() => setSelectedId(s._id)}
                    style={({ pressed, hovered }) => {
                      let backgroundColor: string = 'transparent';
                      if (isSelected) {
                        backgroundColor = colors.accent + '10';
                      } else if (pressed || hovered) {
                        backgroundColor = colors.bgHover;
                      }
                      return [
                        styles.row,
                        {
                          backgroundColor,
                          borderColor: isSelected ? colors.accent + '30' : colors.border,
                        },
                      ];
                    }}
                  >
                    <View style={styles.rowTop}>
                      <Pressable
                        onPress={() => toggleChecked(s._id)}
                        hitSlop={8}
                        style={({ pressed, hovered }) => [
                          styles.rowCheckbox,
                          (pressed || hovered) && { backgroundColor: colors.bgHover },
                        ]}
                        accessibilityLabel={isChecked ? 'Deselect change' : 'Select change'}
                      >
                        <Feather name={isChecked ? 'check-square' : 'square'} size={16} color={colors.textMuted} />
                      </Pressable>
                      <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                        {title}
                      </Text>
                      <View style={[styles.statusPill, { backgroundColor: pill.bg, borderColor: pill.border }]}>
                        <Text style={[styles.statusPillText, { color: pill.fg }]}>{titleCase(s.status)}</Text>
                      </View>
                    </View>
                    <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                      {subtitle}
                    </Text>
                    <View style={styles.rowMeta}>
                      <Text style={[styles.rowMetaText, { color: colors.textMuted }]} numberOfLines={1}>
                        {s.actorName ?? 'Agent'}
                      </Text>
                      <Text style={[styles.rowMetaText, { color: colors.textMuted }]}>·</Text>
                      <Text style={[styles.rowMetaText, { color: colors.textMuted }]}>
                        {formatRelativeTime(s.createdAt)}
                      </Text>
                      {s.danger ? (
                        <>
                          <Text style={[styles.rowMetaText, { color: colors.textMuted }]}>·</Text>
                          <Text style={[styles.rowDanger, { color: '#ef4444' }]} numberOfLines={1}>
                            {titleCase(s.danger)}
                          </Text>
                        </>
                      ) : null}
                    </View>
                  </Pressable>
                );
              }}
            />
          )}
        </View>

        <View style={styles.detailsColumn}>
          <KnowledgeSuggestionDetails
            projectId={projectId}
            suggestion={selected}
            onApply={handleApply}
            onRollback={handleOpenRollbackModal}
            onOpenWriteContent={handleOpenWriteContent}
            isBusy={isBusy || isRollingBack}
          />
        </View>
      </View>

      {/* Rollback confirmation modal */}
      <RollbackConfirmModal
        visible={rollbackModalVisible}
        suggestionId={rollbackSuggestionId}
        onClose={handleCloseRollbackModal}
        onConfirm={handleConfirmRollback}
        isRollingBack={isRollingBack}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
  },
  header: {
    height: 48,
    paddingHorizontal: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    minWidth: 0,
  },
  headerIcon: {
    width: 26,
    height: 26,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: typography.base,
    fontWeight: '600',
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    gap: spacing[3],
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    height: 36,
    borderWidth: 1,
    borderRadius: radii.lg,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.sm,
    outlineStyle: 'none',
  } as any,
  filters: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  filterChip: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderWidth: 1,
    borderRadius: radii.full,
  },
  filterChipText: {
    fontSize: typography.xs,
    fontWeight: '500',
  },
  metaText: {
    fontSize: typography.xs,
  },
  body: {
    flex: 1,
    minHeight: 0,
  },
  listColumn: {
    width: 360,
    borderRightWidth: 1,
    minHeight: 0,
  },
  listScroll: {
    padding: spacing[3],
    gap: spacing[2],
  } as any,
  loadingFooter: {
    padding: spacing[4],
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: radii.lg,
    borderWidth: 1,
    marginTop: spacing[2],
  },
  loadMoreText: {
    fontSize: typography.sm,
    fontWeight: '500',
  },
  row: {
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing[3],
    gap: spacing[1],
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    minWidth: 0,
  },
  rowCheckbox: {
    width: 28,
    height: 28,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    flex: 1,
    fontSize: typography.sm,
    fontWeight: '600',
  },
  rowSubtitle: {
    fontSize: typography.xs,
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    flexWrap: 'wrap',
  },
  rowMetaText: {
    fontSize: typography.xs,
  },
  rowDanger: {
    fontSize: typography.xs,
    fontWeight: '500',
  },
  statusPill: {
    borderWidth: 1,
    borderRadius: radii.full,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  detailsColumn: {
    flex: 1,
    minHeight: 0,
  },
  emptyState: {
    padding: spacing[4],
    gap: spacing[2],
  },
  emptyTitle: {
    fontSize: typography.sm,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: typography.sm,
    lineHeight: 20,
  },
  banner: {
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  bannerText: {
    flex: 1,
    fontSize: typography.sm,
    lineHeight: 18,
  },
  batchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    flexWrap: 'wrap',
  },
  batchText: {
    fontSize: typography.xs,
  },
  batchPrimary: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radii.lg,
  },
  batchPrimaryText: {
    fontSize: typography.xs,
    fontWeight: '700',
  },
  batchSecondary: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  batchSecondaryText: {
    fontSize: typography.xs,
    fontWeight: '700',
  },
  batchClear: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[2],
    borderRadius: radii.md,
  },
  batchClearText: {
    fontSize: typography.xs,
    fontWeight: '600',
  },
});
