import { useCallback, useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, Text, Pressable, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useQuery } from 'convex/react';
import { api } from '../../../../../convex/_generated/api';
import { useTheme, spacing, radii, typography } from '@/design-system';
import type { KnowledgeCitation, KnowledgeSuggestion } from './types';
import { canonicalizeName, copyToClipboard, formatRelativeTime, titleCase } from './types';

type ApplyDecision = 'approve' | 'reject';

export interface KnowledgeSuggestionDetailsProps {
  projectId: string | null;
  suggestion: KnowledgeSuggestion | null;
  onApply: (suggestionIds: string[], decision: ApplyDecision) => void;
  onRollback: (suggestionId: string) => void;
  isBusy?: boolean;
}

interface EntityDoc {
  _id: string;
  name: string;
  type: string;
  aliases: string[];
  notes?: string;
  properties?: Record<string, unknown>;
}

interface RelationshipDoc {
  _id: string;
  projectId: string;
  sourceId: string;
  targetId: string;
  type: string;
  bidirectional?: boolean;
  strength?: number;
  notes?: string;
  metadata?: unknown;
}

interface ActivityLogEntry {
  _id: string;
  action: string;
  summary?: string;
  actorName?: string;
  metadata?: unknown;
  createdAt: number;
}

interface DiffRow {
  key: string;
  from: unknown;
  to: unknown;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function pickBestEntityMatch(name: string, candidates: EntityDoc[] | undefined): EntityDoc | null {
  const items = candidates ?? [];
  if (items.length === 0) return null;
  const canon = canonicalizeName(name);
  const exact = items.find((e) => {
    if (canonicalizeName(e.name) === canon) return true;
    return (e.aliases ?? []).some((a) => canonicalizeName(a) === canon);
  });
  return exact ?? items[0] ?? null;
}

function getRollbackInfo(suggestion: KnowledgeSuggestion): { kind: string; rolledBackAt?: number } | null {
  const result =
    suggestion.result && typeof suggestion.result === 'object'
      ? (suggestion.result as Record<string, unknown>)
      : null;
  const rollback = result && typeof result.rollback === 'object' ? (result.rollback as Record<string, unknown>) : null;
  if (!rollback || typeof rollback.kind !== 'string') return null;
  const rolledBackAtValue = result?.rolledBackAt;
  const rolledBackAt = typeof rolledBackAtValue === 'number' ? rolledBackAtValue : undefined;
  return { kind: rollback.kind as string, rolledBackAt };
}

function getSuggestionTitle(suggestion: KnowledgeSuggestion): string {
  return `${titleCase(suggestion.operation || suggestion.toolName)} · ${titleCase(suggestion.targetType)}`;
}

function getSuggestionSubtitle(suggestion: KnowledgeSuggestion): string {
  const target = suggestion.targetId ? ` · ${suggestion.targetId}` : '';
  return `${titleCase(suggestion.toolName)}${target}`;
}

export function KnowledgeSuggestionDetails({
  projectId,
  suggestion,
  onApply,
  onRollback,
  isBusy = false,
}: KnowledgeSuggestionDetailsProps): JSX.Element {
  const { colors } = useTheme();

  // Convex API types are too deep for expo typecheck; treat as untyped.
  // @ts-ignore
  const apiAny: any = api;

  const toolArgs = useMemo(() => {
    if (!suggestion || !suggestion.proposedPatch || typeof suggestion.proposedPatch !== 'object') return null;
    return suggestion.proposedPatch as Record<string, unknown>;
  }, [suggestion]);

  const citations = useQuery(
    apiAny.knowledgeCitations.listBySuggestion as any,
    suggestion ? { suggestionId: suggestion._id } : ('skip' as any)
  ) as KnowledgeCitation[] | undefined;

  const entitySearchName = useMemo((): string | null => {
    if (!suggestion || !toolArgs) return null;
    if (suggestion.toolName === 'update_entity') return typeof toolArgs.entityName === 'string' ? (toolArgs.entityName as string) : null;
    if (suggestion.toolName === 'update_node') return typeof toolArgs.nodeName === 'string' ? (toolArgs.nodeName as string) : null;
    return null;
  }, [suggestion, toolArgs]);

  const entitySearchType = useMemo((): string | undefined => {
    if (!suggestion || !toolArgs) return undefined;
    if (suggestion.toolName === 'update_entity') return typeof toolArgs.entityType === 'string' ? (toolArgs.entityType as string) : undefined;
    if (suggestion.toolName === 'update_node') return typeof toolArgs.nodeType === 'string' ? (toolArgs.nodeType as string) : undefined;
    return undefined;
  }, [suggestion, toolArgs]);

  const entityByCanonical = useQuery(
    apiAny.entities.getByCanonical as any,
    projectId && entitySearchName && entitySearchType
      ? { projectId, type: entitySearchType, canonicalName: entitySearchName }
      : ('skip' as any)
  ) as EntityDoc | null | undefined;

  const entitySearchResults = useQuery(
    apiAny.entities.searchByName as any,
    projectId && entitySearchName && !entitySearchType
      ? { projectId, query: entitySearchName, limit: 20 }
      : ('skip' as any)
  ) as EntityDoc[] | undefined;

  const resolvedEntity = useMemo((): EntityDoc | null => {
    if (!entitySearchName) return null;
    if (entityByCanonical === undefined && entitySearchResults === undefined) return null;
    if (entityByCanonical) return entityByCanonical;
    return pickBestEntityMatch(entitySearchName, entitySearchResults);
  }, [entityByCanonical, entitySearchName, entitySearchResults]);

  const relationshipSourceName = useMemo((): string | null => {
    if (!suggestion || !toolArgs) return null;
    if (suggestion.toolName === 'update_relationship' || suggestion.toolName === 'create_relationship') {
      return typeof toolArgs.sourceName === 'string' ? (toolArgs.sourceName as string) : null;
    }
    if (suggestion.toolName === 'update_edge' || suggestion.toolName === 'create_edge') {
      return typeof toolArgs.sourceName === 'string' ? (toolArgs.sourceName as string) : null;
    }
    return null;
  }, [suggestion, toolArgs]);

  const relationshipTargetName = useMemo((): string | null => {
    if (!suggestion || !toolArgs) return null;
    if (suggestion.toolName === 'update_relationship' || suggestion.toolName === 'create_relationship') {
      return typeof toolArgs.targetName === 'string' ? (toolArgs.targetName as string) : null;
    }
    if (suggestion.toolName === 'update_edge' || suggestion.toolName === 'create_edge') {
      return typeof toolArgs.targetName === 'string' ? (toolArgs.targetName as string) : null;
    }
    return null;
  }, [suggestion, toolArgs]);

  const relationshipType = useMemo((): string | null => {
    if (!suggestion || !toolArgs) return null;
    if (typeof toolArgs.type === 'string') return toolArgs.type as string;
    return null;
  }, [suggestion, toolArgs]);

  const sourceEntityMatches = useQuery(
    apiAny.entities.searchByName as any,
    projectId && relationshipSourceName ? { projectId, query: relationshipSourceName, limit: 20 } : ('skip' as any)
  ) as EntityDoc[] | undefined;

  const targetEntityMatches = useQuery(
    apiAny.entities.searchByName as any,
    projectId && relationshipTargetName ? { projectId, query: relationshipTargetName, limit: 20 } : ('skip' as any)
  ) as EntityDoc[] | undefined;

  const resolvedSourceEntity = useMemo(() => {
    if (!relationshipSourceName) return null;
    return pickBestEntityMatch(relationshipSourceName, sourceEntityMatches);
  }, [relationshipSourceName, sourceEntityMatches]);

  const resolvedTargetEntity = useMemo(() => {
    if (!relationshipTargetName) return null;
    return pickBestEntityMatch(relationshipTargetName, targetEntityMatches);
  }, [relationshipTargetName, targetEntityMatches]);

  const relationshipByTypeBetween = useQuery(
    apiAny.relationships.getByTypeBetween as any,
    projectId && relationshipType && resolvedSourceEntity && resolvedTargetEntity
      ? { projectId, sourceId: resolvedSourceEntity._id, targetId: resolvedTargetEntity._id, type: relationshipType }
      : ('skip' as any)
  ) as RelationshipDoc | null | undefined;

  const activity = useQuery(
    apiAny.activity.listByProject as any,
    projectId ? { projectId, limit: 80 } : ('skip' as any)
  ) as ActivityLogEntry[] | undefined;

  const relatedActivity = useMemo((): ActivityLogEntry[] => {
    if (!suggestion || !activity) return [];
    const toolCallId = suggestion.toolCallId;
    const targetId = suggestion.targetId;
    const results: ActivityLogEntry[] = [];

    for (const entry of activity) {
      const meta =
        entry.metadata && typeof entry.metadata === 'object'
          ? (entry.metadata as Record<string, unknown>)
          : null;
      const source =
        meta?.source && typeof meta.source === 'object'
          ? (meta.source as Record<string, unknown>)
          : null;

      const metaToolCallId = typeof meta?.toolCallId === 'string' ? (meta.toolCallId as string) : null;
      const sourceToolCallId = typeof source?.toolCallId === 'string' ? (source.toolCallId as string) : null;
      const metaEntityId = typeof meta?.entityId === 'string' ? (meta.entityId as string) : null;
      const metaRelationshipId = typeof meta?.relationshipId === 'string' ? (meta.relationshipId as string) : null;

      const matches =
        (toolCallId && (metaToolCallId === toolCallId || sourceToolCallId === toolCallId)) ||
        (targetId && (metaEntityId === targetId || metaRelationshipId === targetId));

      if (matches) {
        results.push(entry);
      }
    }

    return results.slice(0, 6);
  }, [activity, suggestion]);

  const diffRows = useMemo((): DiffRow[] => {
    if (!suggestion || !toolArgs) return [];

    if (suggestion.toolName === 'update_entity' || suggestion.toolName === 'update_node') {
      const updates = toolArgs.updates && typeof toolArgs.updates === 'object' ? (toolArgs.updates as Record<string, unknown>) : {};
      if (!resolvedEntity) return [];

      const rows: DiffRow[] = [];
      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined) continue;
        if (key === 'name') rows.push({ key: 'Name', from: resolvedEntity.name, to: value });
        else if (key === 'aliases') rows.push({ key: 'Aliases', from: resolvedEntity.aliases, to: value });
        else if (key === 'notes') rows.push({ key: 'Notes', from: resolvedEntity.notes, to: value });
        else rows.push({ key: titleCase(key), from: resolvedEntity.properties?.[key], to: value });
      }
      return rows;
    }

    if (suggestion.toolName === 'update_relationship' || suggestion.toolName === 'update_edge') {
      const updates = toolArgs.updates && typeof toolArgs.updates === 'object' ? (toolArgs.updates as Record<string, unknown>) : {};
      if (!relationshipByTypeBetween) return [];

      const rows: DiffRow[] = [];
      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined) continue;
        if (key === 'notes') rows.push({ key: 'Notes', from: relationshipByTypeBetween.notes, to: value });
        else if (key === 'strength') rows.push({ key: 'Strength', from: relationshipByTypeBetween.strength, to: value });
        else if (key === 'bidirectional') rows.push({ key: 'Bidirectional', from: relationshipByTypeBetween.bidirectional ?? false, to: value });
        else if (key === 'metadata') rows.push({ key: 'Metadata', from: relationshipByTypeBetween.metadata, to: value });
        else rows.push({ key: titleCase(key), from: (relationshipByTypeBetween as any)[key], to: value });
      }
      return rows;
    }

    return [];
  }, [relationshipByTypeBetween, resolvedEntity, suggestion, toolArgs]);

  const renderEntityUpdatePreview = (): JSX.Element | null => {
    if (!suggestion) return null;
    if (suggestion.toolName !== 'update_entity' && suggestion.toolName !== 'update_node') return null;
    if (diffRows.length > 0) {
      return <DiffList rows={diffRows} colors={colors} />;
    }
    return (
      <Text style={[styles.helperText, { color: colors.textMuted }]}>
        {resolvedEntity ? 'No field changes found.' : 'Unable to resolve the entity for a diff.'}
      </Text>
    );
  };

  const renderRelationshipUpdatePreview = (): JSX.Element | null => {
    if (!suggestion) return null;
    if (suggestion.toolName !== 'update_relationship' && suggestion.toolName !== 'update_edge') return null;
    if (diffRows.length > 0) {
      return <DiffList rows={diffRows} colors={colors} />;
    }
    return (
      <Text style={[styles.helperText, { color: colors.textMuted }]}>
        {relationshipByTypeBetween ? 'No field changes found.' : 'Unable to resolve the relationship for a diff.'}
      </Text>
    );
  };

  const canApprove = suggestion?.status === 'proposed';
  const rollbackInfo = suggestion ? getRollbackInfo(suggestion) : null;
  const canRollback = Boolean(suggestion && suggestion.status === 'accepted' && rollbackInfo && !rollbackInfo.rolledBackAt);

  const handleCopyIds = useCallback((): void => {
    if (!suggestion) return;
    const payload = [
      `suggestionId: ${suggestion._id}`,
      `toolName: ${suggestion.toolName}`,
      `toolCallId: ${suggestion.toolCallId}`,
      suggestion.streamId ? `streamId: ${suggestion.streamId}` : null,
      suggestion.threadId ? `threadId: ${suggestion.threadId}` : null,
      suggestion.promptMessageId ? `promptMessageId: ${suggestion.promptMessageId}` : null,
    ]
      .filter(Boolean)
      .join('\n');
    void copyToClipboard(payload);
  }, [suggestion]);

  const handleCopyPatch = useCallback((): void => {
    if (!suggestion) return;
    void copyToClipboard(JSON.stringify(suggestion.proposedPatch, null, 2));
  }, [suggestion]);

  if (!suggestion) {
    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>Select a change to see details.</Text>
      </View>
    );
  }

  const title = getSuggestionTitle(suggestion);
  const subtitle = getSuggestionSubtitle(suggestion);
  const created = formatRelativeTime(suggestion.createdAt);

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false} testID="knowledge-pr-details">
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      </View>

      {suggestion.error ? (
        <View style={[styles.notice, { backgroundColor: '#ef444414', borderColor: '#ef44442A' }]}>
          <Feather name="alert-triangle" size={14} color="#ef4444" />
          <Text style={[styles.noticeText, { color: '#ef4444' }]} numberOfLines={3}>
            {suggestion.error}
          </Text>
        </View>
      ) : null}

      <View style={styles.actionsRow}>
        {canApprove && (
          <>
            <Pressable
              disabled={isBusy}
              onPress={() => onApply([suggestion._id], 'approve')}
              style={({ pressed, hovered }) => [
                styles.primaryButton,
                { backgroundColor: pressed || hovered ? colors.accent + 'CC' : colors.accent, opacity: isBusy ? 0.6 : 1 },
              ]}
            >
              <Feather name="check" size={14} color="#fff" />
              <Text style={[styles.primaryButtonText, { color: '#fff' }]}>Approve</Text>
            </Pressable>
            <Pressable
              disabled={isBusy}
              onPress={() => onApply([suggestion._id], 'reject')}
              style={({ pressed, hovered }) => [
                styles.secondaryButton,
                {
                  backgroundColor: pressed || hovered ? colors.bgHover : colors.bgSurface,
                  borderColor: colors.border,
                  opacity: isBusy ? 0.6 : 1,
                },
              ]}
            >
              <Feather name="x" size={14} color={colors.textMuted} />
              <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Reject</Text>
            </Pressable>
          </>
        )}

        {canRollback && (
          <Pressable
            disabled={isBusy}
            onPress={() => onRollback(suggestion._id)}
            style={({ pressed, hovered }) => [
              styles.secondaryButton,
              {
                backgroundColor: pressed || hovered ? colors.bgHover : colors.bgSurface,
                borderColor: colors.border,
                opacity: isBusy ? 0.6 : 1,
              },
            ]}
          >
            <Feather name="corner-up-left" size={14} color={colors.textMuted} />
            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Undo</Text>
          </Pressable>
        )}

        <View style={{ flex: 1 }} />

        <Pressable
          onPress={handleCopyIds}
          style={({ pressed, hovered }) => [
            styles.iconButton,
            (pressed || hovered) && { backgroundColor: colors.bgHover },
          ]}
          accessibilityLabel="Copy IDs"
        >
          <Feather name="copy" size={16} color={colors.textMuted} />
        </Pressable>
        <Pressable
          onPress={handleCopyPatch}
          style={({ pressed, hovered }) => [
            styles.iconButton,
            (pressed || hovered) && { backgroundColor: colors.bgHover },
          ]}
          accessibilityLabel="Copy patch JSON"
        >
          <Feather name="code" size={16} color={colors.textMuted} />
        </Pressable>
      </View>

      <View style={[styles.metaCard, { borderColor: colors.border, backgroundColor: colors.bgSurface }]}>
        <MetaRow label="Status" value={titleCase(suggestion.status)} colors={colors} />
        <MetaRow label="Created" value={created} colors={colors} />
        {suggestion.riskLevel ? <MetaRow label="Risk" value={titleCase(suggestion.riskLevel)} colors={colors} /> : null}
        {suggestion.actorName ? <MetaRow label="Actor" value={suggestion.actorName} colors={colors} /> : null}
        <MetaRow label="Tool" value={suggestion.toolName} colors={colors} mono />
        {suggestion.model ? <MetaRow label="Model" value={suggestion.model} colors={colors} mono /> : null}
        {suggestion.threadId ? <MetaRow label="Thread" value={suggestion.threadId} colors={colors} mono /> : null}
      </View>

      <View style={[styles.previewCard, { backgroundColor: colors.bgSurface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Preview</Text>

        {suggestion.toolName === 'create_entity' || suggestion.toolName === 'create_node' ? (
          <KeyValues title="New entity" values={toolArgs ?? {}} colors={colors} />
        ) : null}

        {renderEntityUpdatePreview()}

        {suggestion.toolName === 'create_relationship' || suggestion.toolName === 'create_edge' ? (
          <KeyValues title="New relationship" values={toolArgs ?? {}} colors={colors} />
        ) : null}

        {renderRelationshipUpdatePreview()}

        {suggestion.toolName === 'write_content' ? (
          <View style={styles.block}>
            <Text style={[styles.helperText, { color: colors.textMuted }]}>
              Apply or reject this suggestion from the editor UI.
            </Text>
            <Text style={[styles.code, { color: colors.text }]}>{formatValue(toolArgs)}</Text>
          </View>
        ) : null}

        {suggestion.toolName === 'commit_decision' ? (
          <KeyValues title="New memory" values={toolArgs ?? {}} colors={colors} />
        ) : null}

        {suggestion.normalizedPatch ? (
          <View style={styles.block}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Normalized patch</Text>
            <Text style={[styles.code, { color: colors.text }]}>{JSON.stringify(suggestion.normalizedPatch, null, 2)}</Text>
          </View>
        ) : null}

        <View style={styles.block}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Raw patch</Text>
          <Text style={[styles.code, { color: colors.text }]}>{JSON.stringify(suggestion.proposedPatch, null, 2)}</Text>
        </View>
      </View>

      {citations && citations.length > 0 ? (
        <View style={[styles.previewCard, { backgroundColor: colors.bgSurface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Citations</Text>
          <View style={styles.citationList}>
            {citations.map((citation) => {
              const heading = citation.memoryCategory ? titleCase(citation.memoryCategory) : 'Canon memory';
              const redacted = citation.visibility === 'redacted';
              return (
                <View key={citation._id} style={[styles.citationRow, { borderColor: colors.border }]}>
                  <View style={styles.citationHeader}>
                    <Text style={[styles.citationTitle, { color: colors.text }]}>{heading}</Text>
                    <Text style={[styles.citationMeta, { color: colors.textMuted }]} numberOfLines={1}>
                      {citation.memoryId}
                    </Text>
                  </View>
                  {redacted ? (
                    <Text style={[styles.helperText, { color: colors.textMuted }]}>
                      Citation redacted{citation.redactionReason ? ` (${citation.redactionReason})` : ''}.
                    </Text>
                  ) : (
                    <>
                      <Text style={[styles.citationText, { color: colors.text }]} numberOfLines={4}>
                        {citation.memoryText ?? 'Memory content unavailable.'}
                      </Text>
                      {citation.reason ? (
                        <Text style={[styles.helperText, { color: colors.textMuted }]}>{citation.reason}</Text>
                      ) : null}
                      {citation.excerpt ? (
                        <Text style={[styles.helperText, { color: colors.textMuted }]}>{citation.excerpt}</Text>
                      ) : null}
                    </>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      {relatedActivity.length > 0 ? (
        <View style={[styles.previewCard, { backgroundColor: colors.bgSurface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Related activity</Text>
          <View style={styles.activityList}>
            {relatedActivity.map((entry) => (
              <View key={entry._id} style={[styles.activityRow, { borderColor: colors.border }]}>
                <View style={styles.activityTop}>
                  <Text style={[styles.activityTitle, { color: colors.text }]} numberOfLines={1}>
                    {entry.summary ?? titleCase(entry.action)}
                  </Text>
                  <Text style={[styles.activityMeta, { color: colors.textMuted }]}>
                    {formatRelativeTime(entry.createdAt)}
                  </Text>
                </View>
                {entry.actorName ? (
                  <Text style={[styles.activityMeta, { color: colors.textMuted }]} numberOfLines={1}>
                    {entry.actorName}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

function MetaRow({
  label,
  value,
  colors,
  mono = false,
}: {
  label: string;
  value: string;
  colors: any;
  mono?: boolean;
}): JSX.Element {
  return (
    <View style={styles.metaRow}>
      <Text style={[styles.metaLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text
        style={[
          styles.metaValue,
          { color: colors.text },
          mono && {
            fontFamily: Platform.select({ web: 'ui-monospace, SFMono-Regular, Menlo, monospace', default: undefined }),
          },
        ]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

function DiffList({ rows, colors }: { rows: DiffRow[]; colors: any }): JSX.Element {
  return (
    <View style={styles.diffList}>
      {rows.map((row) => (
        <View key={row.key} style={[styles.diffRow, { borderColor: colors.border }]}>
          <Text style={[styles.diffKey, { color: colors.textMuted }]}>{row.key}</Text>
          <View style={styles.diffValues}>
            <Text style={[styles.diffValue, { color: colors.textMuted }]} numberOfLines={2}>
              {formatValue(row.from)}
            </Text>
            <Text style={[styles.diffArrow, { color: colors.textMuted }]}>→</Text>
            <Text style={[styles.diffValue, { color: colors.text }]} numberOfLines={2}>
              {formatValue(row.to)}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function KeyValues({ title, values, colors }: { title: string; values: Record<string, unknown>; colors: any }): JSX.Element {
  const entries = Object.entries(values).filter(([, v]) => v !== undefined);
  if (entries.length === 0) {
    return <Text style={[styles.helperText, { color: colors.textMuted }]}>No fields.</Text>;
  }

  return (
    <View style={styles.block}>
      <Text style={[styles.helperText, { color: colors.textMuted }]}>{title}</Text>
      {entries.map(([k, v]) => (
        <View key={k} style={styles.kvRow}>
          <Text style={[styles.kvKey, { color: colors.textMuted }]}>{titleCase(k)}</Text>
          <Text style={[styles.kvValue, { color: colors.text }]} numberOfLines={3}>
            {formatValue(v)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[4],
  },
  emptyText: {
    fontSize: typography.sm,
    lineHeight: 20,
  },
  container: {
    padding: spacing[4],
    gap: spacing[3],
  } as any,
  header: {
    gap: spacing[1],
  },
  headerText: {
    gap: spacing[1],
  },
  title: {
    fontSize: typography.lg,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: typography.sm,
  },
  notice: {
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    flexDirection: 'row',
    gap: spacing[2],
    alignItems: 'center',
  },
  noticeText: {
    flex: 1,
    fontSize: typography.sm,
    lineHeight: 18,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing[2],
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radii.lg,
  },
  primaryButtonText: {
    fontSize: typography.sm,
    fontWeight: '700',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: typography.sm,
    fontWeight: '700',
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaCard: {
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing[3],
    gap: spacing[2],
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  metaLabel: {
    fontSize: typography.xs,
  },
  metaValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: typography.xs,
  },
  previewCard: {
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing[3],
    gap: spacing[2],
  },
  sectionTitle: {
    fontSize: typography.xs,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  helperText: {
    fontSize: typography.sm,
    lineHeight: 20,
  },
  block: {
    gap: spacing[2],
    paddingTop: spacing[2],
  },
  code: {
    fontSize: typography.xs,
    lineHeight: 18,
    fontFamily: Platform.select({ web: 'ui-monospace, SFMono-Regular, Menlo, monospace', default: undefined }),
  },
  kvRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  kvKey: {
    width: 120,
    fontSize: typography.xs,
  },
  kvValue: {
    flex: 1,
    fontSize: typography.sm,
    lineHeight: 18,
    textAlign: 'right',
  },
  diffList: {
    gap: spacing[2],
  },
  diffRow: {
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing[3],
    gap: spacing[2],
  },
  diffKey: {
    fontSize: typography.xs,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  diffValues: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  diffValue: {
    flex: 1,
    fontSize: typography.xs,
    lineHeight: 18,
  },
  diffArrow: {
    fontSize: typography.xs,
  },
  citationList: {
    gap: spacing[2],
    paddingTop: spacing[2],
  },
  citationRow: {
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing[3],
    gap: spacing[2],
  },
  citationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  citationTitle: {
    fontSize: typography.xs,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  citationMeta: {
    flex: 1,
    textAlign: 'right',
    fontSize: typography.xs,
  },
  citationText: {
    fontSize: typography.sm,
    lineHeight: 20,
  },
  activityList: {
    gap: spacing[2],
    paddingTop: spacing[2],
  },
  activityRow: {
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing[3],
    gap: spacing[1],
  },
  activityTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  activityTitle: {
    flex: 1,
    fontSize: typography.sm,
    fontWeight: '600',
  },
  activityMeta: {
    fontSize: typography.xs,
  },
});
