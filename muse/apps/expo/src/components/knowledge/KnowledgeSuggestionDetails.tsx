import { useCallback, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, Pressable, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../../../convex/_generated/api';
import { useTheme, spacing, radii, typography } from '@/design-system';
import type {
  GraphPreviewChange,
  KnowledgeCitation,
  KnowledgeEditorContext,
  KnowledgeSuggestion,
  KnowledgeSuggestionPreview,
} from './types';
import { canonicalizeName, copyToClipboard, formatRelativeTime, titleCase } from './types';

type ApplyDecision = 'approve' | 'reject';

export interface KnowledgeSuggestionDetailsProps {
  projectId: string | null;
  suggestion: KnowledgeSuggestion | null;
  onApply: (suggestionIds: string[], decision: ApplyDecision) => void;
  onRollback: (suggestionId: string) => void;
  onOpenWriteContent?: (suggestion: KnowledgeSuggestion) => void;
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

interface DocumentDoc {
  _id: string;
  title?: string;
  contentText?: string;
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

function isGraphPreview(value: unknown): value is KnowledgeSuggestionPreview {
  return Boolean(value && typeof value === 'object' && 'kind' in (value as Record<string, unknown>));
}

function toDiffRows(changes: GraphPreviewChange[]): DiffRow[] {
  return changes.map((change) => ({
    key: titleCase(change.key),
    from: change.from,
    to: change.to,
  }));
}

type WriteContentOperation = 'replace_selection' | 'insert_at_cursor' | 'append_document';

interface WriteContentDiffBlock {
  label: string;
  before: string;
  after: string;
}

interface WriteContentDiff {
  operation: WriteContentOperation;
  blocks: WriteContentDiffBlock[];
  rationale?: string;
  note?: string;
  documentTitle?: string;
  documentExcerpt?: string;
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

function formatApprovalReason(reason: string): string {
  switch (reason) {
    case 'risk_core':
      return 'Core registry type requires approval';
    case 'risk_high':
      return 'High-risk registry type requires approval';
    case 'create_requires_approval':
      return 'Registry requires approval for creation';
    case 'update_requires_approval':
      return 'Registry requires approval for updates';
    case 'identity_change':
      return 'Identity fields are changing';
    case 'bidirectional_change':
      return 'Bidirectional change requires review';
    case 'strength_sensitive':
      return 'Significant strength change requires review';
    case 'invalid_type':
      return 'Registry type could not be resolved';
    case 'registry_unknown':
      return 'Registry unavailable for this project';
    default:
      return titleCase(reason);
  }
}

function replaceFirst(haystack: string, needle: string, replacement: string): string {
  const index = haystack.indexOf(needle);
  if (index === -1) return haystack;
  return `${haystack.slice(0, index)}${replacement}${haystack.slice(index + needle.length)}`;
}

function parseWriteContentOperation(value: unknown): WriteContentOperation {
  if (value === 'replace_selection' || value === 'insert_at_cursor' || value === 'append_document') {
    return value;
  }
  return 'insert_at_cursor';
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
): { context: string; matchCount: number } | null {
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

function buildWriteContentDiff(
  toolArgs: Record<string, unknown>,
  editorContext?: KnowledgeEditorContext,
  documentText?: string,
  documentTitle?: string
): WriteContentDiff | null {
  const content = typeof toolArgs.content === 'string' ? toolArgs.content : '';
  if (!content) return null;

  const operation = parseWriteContentOperation(toolArgs.operation);
  const rationale = typeof toolArgs.rationale === 'string' ? toolArgs.rationale : undefined;
  const selectionText = editorContext?.selectionText;
  let selectionContext = editorContext?.selectionContext;
  let note = '';

  if (!selectionContext && selectionText && documentText) {
    const match = findSelectionContext(documentText, selectionText, 240);
    if (match) {
      selectionContext = match.context;
      if (match.matchCount > 1) {
        note = 'Multiple matches found; showing the first occurrence.';
      }
    } else {
      note = 'Selection not found in document text.';
    }
  }

  const resolvedDocumentTitle = editorContext?.documentTitle ?? documentTitle;
  const resolvedDocumentExcerpt =
    editorContext?.documentExcerpt ??
    (documentText ? buildDocumentExcerpt(documentText, 420) : undefined);

  const blocks: WriteContentDiffBlock[] = [];

  if (selectionText) {
    blocks.push({ label: 'Selection', before: selectionText, after: content });
    if (selectionContext) {
      const contextAfter = replaceFirst(selectionContext, selectionText, content);
      if (contextAfter !== selectionContext) {
        blocks.push({ label: 'Context', before: selectionContext, after: contextAfter });
      }
    }
  } else {
    if (operation === 'replace_selection') {
      note = note || 'Selection text unavailable for this proposal.';
    }
    if (documentText && operation === 'append_document') {
      const tail = buildTailExcerpt(documentText, 240);
      blocks.push({ label: 'Document end', before: tail, after: `${tail}${content}` });
    } else if (resolvedDocumentExcerpt) {
      const label = operation === 'append_document' ? 'Append' : 'Insert';
      if (!note) {
        note = 'Cursor position unavailable; showing excerpt with appended change.';
      }
      blocks.push({
        label,
        before: resolvedDocumentExcerpt,
        after: `${resolvedDocumentExcerpt}${content}`,
      });
    } else {
      const label = operation === 'append_document' ? 'Append' : 'Insert';
      blocks.push({ label, before: '', after: content });
    }
  }

  return {
    operation,
    blocks,
    rationale,
    note: note || undefined,
    documentTitle: resolvedDocumentTitle,
    documentExcerpt: resolvedDocumentExcerpt,
  };
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
  let rolledBackAt: number | undefined;
  if (typeof suggestion.rolledBackAt === 'number') {
    rolledBackAt = suggestion.rolledBackAt;
  } else if (typeof result?.rolledBackAt === 'number') {
    rolledBackAt = result.rolledBackAt as number;
  }
  return { kind: rollback.kind as string, rolledBackAt };
}

function getSuggestionTitle(suggestion: KnowledgeSuggestion): string {
  return `${titleCase(suggestion.operation || suggestion.toolName)} · ${titleCase(suggestion.targetType)}`;
}

function getSuggestionSubtitle(suggestion: KnowledgeSuggestion): string {
  const target = suggestion.targetId ? ` · ${suggestion.targetId}` : '';
  return `${titleCase(suggestion.toolName)}${target}`;
}

type NormalizedGraphMutation = {
  toolName:
    | 'create_entity'
    | 'update_entity'
    | 'create_relationship'
    | 'update_relationship'
    | 'create_node'
    | 'update_node'
    | 'create_edge'
    | 'update_edge';
  args: Record<string, unknown>;
};

function normalizeGraphMutationArgs(toolArgs: Record<string, unknown>): NormalizedGraphMutation | null {
  const action = typeof toolArgs.action === 'string' ? (toolArgs.action as string) : undefined;
  const target = typeof toolArgs.target === 'string' ? (toolArgs.target as string) : undefined;
  if (!action || !target || action === 'delete') return null;

  if (target === 'entity' || target === 'node') {
    const baseArgs: Record<string, unknown> = {
      type: toolArgs.type,
      name: toolArgs.name,
      aliases: toolArgs.aliases,
      notes: toolArgs.notes,
      properties: toolArgs.properties,
      archetype: toolArgs.archetype,
      backstory: toolArgs.backstory,
      goals: toolArgs.goals,
      fears: toolArgs.fears,
      citations: toolArgs.citations,
    };

    if (action === 'create') {
      return {
        toolName: target === 'node' ? 'create_node' : 'create_entity',
        args: baseArgs,
      };
    }

    return {
      toolName: target === 'node' ? 'update_node' : 'update_entity',
      args:
        target === 'node'
          ? {
              nodeName: toolArgs.entityName,
              nodeType: toolArgs.entityType,
              updates: toolArgs.updates,
              citations: toolArgs.citations,
            }
          : {
              entityName: toolArgs.entityName,
              entityType: toolArgs.entityType,
              updates: toolArgs.updates,
              citations: toolArgs.citations,
            },
    };
  }

  if (action === 'create') {
    return {
      toolName: target === 'edge' ? 'create_edge' : 'create_relationship',
      args: {
        type: toolArgs.type,
        sourceName: toolArgs.sourceName,
        targetName: toolArgs.targetName,
        bidirectional: toolArgs.bidirectional,
        strength: toolArgs.strength,
        notes: toolArgs.notes,
        metadata: toolArgs.metadata,
        citations: toolArgs.citations,
      },
    };
  }

  return {
    toolName: target === 'edge' ? 'update_edge' : 'update_relationship',
    args: {
      type: toolArgs.type,
      sourceName: toolArgs.sourceName,
      targetName: toolArgs.targetName,
      updates: toolArgs.updates,
      citations: toolArgs.citations,
    },
  };
}

export function KnowledgeSuggestionDetails({
  projectId,
  suggestion,
  onApply,
  onRollback,
  onOpenWriteContent,
  isBusy = false,
}: KnowledgeSuggestionDetailsProps): JSX.Element {
  const { colors } = useTheme();
  const [isRecheckingPreflight, setIsRecheckingPreflight] = useState(false);
  const [preflightRecheckError, setPreflightRecheckError] = useState<string | null>(null);

  // Convex API types are too deep for expo typecheck; treat as untyped.
  // @ts-ignore
  const apiAny: any = api;
  const rerunPreflight = useMutation(apiAny.knowledgeSuggestions.rerunPreflight as any);

  const toolArgs = useMemo(() => {
    if (!suggestion || !suggestion.proposedPatch || typeof suggestion.proposedPatch !== 'object') return null;
    return suggestion.proposedPatch as Record<string, unknown>;
  }, [suggestion]);

  const normalizedGraphMutation = useMemo((): NormalizedGraphMutation | null => {
    if (!suggestion || suggestion.toolName !== 'graph_mutation' || !toolArgs) return null;
    return normalizeGraphMutationArgs(toolArgs);
  }, [suggestion, toolArgs]);

  const effectiveToolName = normalizedGraphMutation?.toolName ?? suggestion?.toolName ?? null;
  const effectiveToolArgs = normalizedGraphMutation?.args ?? toolArgs;

  const preview = useMemo((): KnowledgeSuggestionPreview | null => {
    if (!suggestion || !isGraphPreview(suggestion.preview)) return null;
    return suggestion.preview as KnowledgeSuggestionPreview;
  }, [suggestion]);

  const approvalReasons = useMemo((): string[] => {
    return suggestion?.approvalReasons ?? [];
  }, [suggestion]);

  const shouldResolveGraph = !preview;
  const hasGraphPreview = Boolean(preview);

  const documentId =
    suggestion?.targetType === 'document'
      ? suggestion.editorContext?.documentId ?? suggestion.targetId ?? null
      : null;
  const documentRecord = useQuery(
    apiAny.documents.get as any,
    documentId ? { id: documentId } : ('skip' as any)
  ) as DocumentDoc | null | undefined;
  const documentText =
    typeof documentRecord?.contentText === 'string' ? documentRecord.contentText : undefined;

  const citations = useQuery(
    apiAny.knowledgeCitations.listBySuggestion as any,
    suggestion ? { suggestionId: suggestion._id } : ('skip' as any)
  ) as KnowledgeCitation[] | undefined;

  const entitySearchName = useMemo((): string | null => {
    if (!suggestion || !effectiveToolArgs) return null;
    if (effectiveToolName === 'update_entity') return typeof effectiveToolArgs.entityName === 'string' ? (effectiveToolArgs.entityName as string) : null;
    if (effectiveToolName === 'update_node') return typeof effectiveToolArgs.nodeName === 'string' ? (effectiveToolArgs.nodeName as string) : null;
    return null;
  }, [effectiveToolArgs, effectiveToolName, suggestion]);

  const entitySearchType = useMemo((): string | undefined => {
    if (!suggestion || !effectiveToolArgs) return undefined;
    if (effectiveToolName === 'update_entity') return typeof effectiveToolArgs.entityType === 'string' ? (effectiveToolArgs.entityType as string) : undefined;
    if (effectiveToolName === 'update_node') return typeof effectiveToolArgs.nodeType === 'string' ? (effectiveToolArgs.nodeType as string) : undefined;
    return undefined;
  }, [effectiveToolArgs, effectiveToolName, suggestion]);

  const entityByCanonical = useQuery(
    apiAny.entities.getByCanonical as any,
    shouldResolveGraph && projectId && entitySearchName && entitySearchType
      ? { projectId, type: entitySearchType, canonicalName: entitySearchName }
      : ('skip' as any)
  ) as EntityDoc | null | undefined;

  const entitySearchResults = useQuery(
    apiAny.entities.searchByName as any,
    shouldResolveGraph && projectId && entitySearchName && !entitySearchType
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
    if (!suggestion || !effectiveToolArgs) return null;
    if (effectiveToolName === 'update_relationship' || effectiveToolName === 'create_relationship') {
      return typeof effectiveToolArgs.sourceName === 'string' ? (effectiveToolArgs.sourceName as string) : null;
    }
    if (effectiveToolName === 'update_edge' || effectiveToolName === 'create_edge') {
      return typeof effectiveToolArgs.sourceName === 'string' ? (effectiveToolArgs.sourceName as string) : null;
    }
    return null;
  }, [effectiveToolArgs, effectiveToolName, suggestion]);

  const relationshipTargetName = useMemo((): string | null => {
    if (!suggestion || !effectiveToolArgs) return null;
    if (effectiveToolName === 'update_relationship' || effectiveToolName === 'create_relationship') {
      return typeof effectiveToolArgs.targetName === 'string' ? (effectiveToolArgs.targetName as string) : null;
    }
    if (effectiveToolName === 'update_edge' || effectiveToolName === 'create_edge') {
      return typeof effectiveToolArgs.targetName === 'string' ? (effectiveToolArgs.targetName as string) : null;
    }
    return null;
  }, [effectiveToolArgs, effectiveToolName, suggestion]);

  const relationshipType = useMemo((): string | null => {
    if (!suggestion || !effectiveToolArgs) return null;
    if (typeof effectiveToolArgs.type === 'string') return effectiveToolArgs.type as string;
    return null;
  }, [effectiveToolArgs, suggestion]);

  const sourceEntityMatches = useQuery(
    apiAny.entities.searchByName as any,
    shouldResolveGraph && projectId && relationshipSourceName
      ? { projectId, query: relationshipSourceName, limit: 20 }
      : ('skip' as any)
  ) as EntityDoc[] | undefined;

  const targetEntityMatches = useQuery(
    apiAny.entities.searchByName as any,
    shouldResolveGraph && projectId && relationshipTargetName
      ? { projectId, query: relationshipTargetName, limit: 20 }
      : ('skip' as any)
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
    shouldResolveGraph && projectId && relationshipType && resolvedSourceEntity && resolvedTargetEntity
      ? { projectId, sourceId: resolvedSourceEntity._id, targetId: resolvedTargetEntity._id, type: relationshipType }
      : ('skip' as any)
  ) as RelationshipDoc | null | undefined;

  const activity = useQuery(
    apiAny.activity.listBySuggestion as any,
    suggestion && projectId ? { projectId, suggestionId: suggestion._id, limit: 20 } : ('skip' as any)
  ) as ActivityLogEntry[] | undefined;

  const relatedActivity = useMemo((): ActivityLogEntry[] => {
    return activity ?? [];
  }, [activity]);

  const diffRows = useMemo((): DiffRow[] => {
    if (!suggestion || !effectiveToolArgs) return [];

    if (effectiveToolName === 'update_entity' || effectiveToolName === 'update_node') {
      const updates = effectiveToolArgs.updates && typeof effectiveToolArgs.updates === 'object'
        ? (effectiveToolArgs.updates as Record<string, unknown>)
        : {};
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

    if (effectiveToolName === 'update_relationship' || effectiveToolName === 'update_edge') {
      const updates = effectiveToolArgs.updates && typeof effectiveToolArgs.updates === 'object'
        ? (effectiveToolArgs.updates as Record<string, unknown>)
        : {};
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
  }, [effectiveToolArgs, effectiveToolName, relationshipByTypeBetween, resolvedEntity, suggestion]);

  const writeContentDiff = useMemo((): WriteContentDiff | null => {
    if (!suggestion || effectiveToolName !== 'write_content' || !effectiveToolArgs) return null;
    return buildWriteContentDiff(effectiveToolArgs, suggestion.editorContext, documentText, documentRecord?.title);
  }, [documentRecord?.title, documentText, effectiveToolArgs, effectiveToolName, suggestion]);

  const renderEntityUpdatePreview = (): JSX.Element | null => {
    if (!suggestion) return null;
    if (hasGraphPreview) return null;
    if (effectiveToolName !== 'update_entity' && effectiveToolName !== 'update_node') return null;
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
    if (hasGraphPreview) return null;
    if (effectiveToolName !== 'update_relationship' && effectiveToolName !== 'update_edge') return null;
    if (diffRows.length > 0) {
      return <DiffList rows={diffRows} colors={colors} />;
    }
    return (
      <Text style={[styles.helperText, { color: colors.textMuted }]}>
        {relationshipByTypeBetween ? 'No field changes found.' : 'Unable to resolve the relationship for a diff.'}
      </Text>
    );
  };

  const renderWriteContentPreview = (): JSX.Element | null => {
    if (!suggestion) return null;
    if (effectiveToolName !== 'write_content') return null;

    if (!writeContentDiff) {
      return (
        <View style={styles.block}>
          <Text style={[styles.helperText, { color: colors.textMuted }]}>
            Apply or reject this suggestion from the editor UI.
          </Text>
          <Text style={[styles.code, { color: colors.text }]}>{formatValue(effectiveToolArgs)}</Text>
        </View>
      );
    }

    return <DocumentDiff diff={writeContentDiff} colors={colors} />;
  };

  const renderApprovalReasons = (): JSX.Element | null => {
    if (!approvalReasons.length) return null;
    return (
      <View style={styles.block}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Why approval is required</Text>
        {approvalReasons.map((reason) => (
          <Text key={reason} style={[styles.helperText, { color: colors.text }]}>
            {formatApprovalReason(reason)}
          </Text>
        ))}
      </View>
    );
  };

  const renderGraphPreview = (): JSX.Element | null => {
    if (!preview) return null;

    if (preview.kind === 'entity_create') {
      const values: Record<string, unknown> = {
        type: preview.type,
        name: preview.name,
        aliases: preview.aliases,
        notes: preview.notes,
        properties: preview.properties,
      };
      return (
        <View style={styles.block}>
          <KeyValues title="New entity" values={values} colors={colors} />
          {preview.note ? (
            <Text style={[styles.helperText, { color: colors.textMuted }]}>{preview.note}</Text>
          ) : null}
        </View>
      );
    }

    if (preview.kind === 'entity_update') {
      if (preview.changes.length > 0) {
        return <DiffList rows={toDiffRows(preview.changes)} colors={colors} />;
      }
      return (
        <Text style={[styles.helperText, { color: colors.textMuted }]}>
          {preview.note ?? 'No field changes found.'}
        </Text>
      );
    }

    if (preview.kind === 'relationship_create') {
      const values: Record<string, unknown> = {
        type: preview.type,
        source: preview.sourceName ?? preview.sourceId,
        target: preview.targetName ?? preview.targetId,
        bidirectional: preview.bidirectional,
        strength: preview.strength,
        notes: preview.notes,
        metadata: preview.metadata,
      };
      return (
        <View style={styles.block}>
          <KeyValues title="New relationship" values={values} colors={colors} />
          {preview.note ? (
            <Text style={[styles.helperText, { color: colors.textMuted }]}>{preview.note}</Text>
          ) : null}
        </View>
      );
    }

    if (preview.kind === 'relationship_update') {
      if (preview.changes.length > 0) {
        return <DiffList rows={toDiffRows(preview.changes)} colors={colors} />;
      }
      return (
        <Text style={[styles.helperText, { color: colors.textMuted }]}>
          {preview.note ?? 'No field changes found.'}
        </Text>
      );
    }

    return null;
  };

  const preflight = suggestion?.preflight;
  const isWriteContent = effectiveToolName === 'write_content';
  const hasBlockingPreflight = preflight?.status === 'invalid' || preflight?.status === 'conflict';
  const canApprove = Boolean(suggestion?.status === 'proposed' && !isWriteContent && !hasBlockingPreflight);
  const rollbackInfo = suggestion ? getRollbackInfo(suggestion) : null;
  const isRolledBack = Boolean(suggestion?.resolution === 'rolled_back' || rollbackInfo?.rolledBackAt);
  const canRollback = Boolean(suggestion && suggestion.status === 'accepted' && rollbackInfo && !isRolledBack);

  const handleRecheckPreflight = useCallback(async (): Promise<void> => {
    if (!suggestion) return;
    setIsRecheckingPreflight(true);
    setPreflightRecheckError(null);
    try {
      await rerunPreflight({ suggestionId: suggestion._id });
    } catch (error) {
      setPreflightRecheckError(error instanceof Error ? error.message : 'Recheck failed');
    } finally {
      setIsRecheckingPreflight(false);
    }
  }, [rerunPreflight, suggestion]);

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

      {preflight && preflight.status !== 'ok' ? (
        <View style={[styles.notice, { backgroundColor: '#ef444414', borderColor: '#ef44442A' }]}>
          <Feather name="alert-triangle" size={14} color="#ef4444" />
          <View style={{ flex: 1, gap: spacing[2] }}>
            <View style={styles.noticeHeader}>
              <Text style={[styles.noticeText, { color: '#ef4444', fontWeight: '700', flex: 1 }]}>
                {preflight.status === 'conflict' ? 'Rebase required' : 'Preflight blocked'}
              </Text>
              {suggestion.status === 'proposed' && (
                <Pressable
                  onPress={() => { void handleRecheckPreflight(); }}
                  disabled={isRecheckingPreflight || isBusy}
                  style={({ pressed, hovered }) => [
                    styles.recheckButton,
                    {
                      backgroundColor: pressed || hovered ? colors.bgHover : colors.bgSurface,
                      borderColor: colors.border,
                      opacity: isRecheckingPreflight || isBusy ? 0.6 : 1,
                    },
                  ]}
                >
                  <Feather
                    name="refresh-cw"
                    size={12}
                    color={colors.textMuted}
                    style={isRecheckingPreflight ? { opacity: 0.5 } : undefined}
                  />
                  <Text style={[styles.recheckButtonText, { color: colors.text }]}>
                    {isRecheckingPreflight ? 'Checking...' : 'Recheck'}
                  </Text>
                </Pressable>
              )}
            </View>
            {preflight.status === 'conflict' ? (
              <Text style={[styles.noticeText, { color: '#ef4444' }]}>
                The target has changed since this proposal. Recheck to see if it can still be applied.
              </Text>
            ) : null}
            {(preflight.errors ?? []).map((message, index) => (
              <Text key={`preflight-error-${index}`} style={[styles.noticeText, { color: '#ef4444' }]}>
                {message}
              </Text>
            ))}
            {preflightRecheckError ? (
              <Text style={[styles.noticeText, { color: '#ef4444' }]}>
                Recheck failed: {preflightRecheckError}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}

      {preflight?.warnings && preflight.warnings.length > 0 ? (
        <View style={[styles.notice, { backgroundColor: '#f59e0b14', borderColor: '#f59e0b2A' }]}>
          <Feather name="info" size={14} color="#f59e0b" />
          <View style={{ flex: 1 }}>
            <Text style={[styles.noticeText, { color: '#f59e0b', fontWeight: '700' }]}>Review note</Text>
            {preflight.warnings.map((message, index) => (
              <Text key={`preflight-warning-${index}`} style={[styles.noticeText, { color: '#f59e0b' }]}>
                {message}
              </Text>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.actionsRow}>
        {suggestion.status === 'proposed' && (
          <>
            {isWriteContent ? (
              <Pressable
                disabled={isBusy || !onOpenWriteContent}
                testID="knowledge-doc-open"
                onPress={() => suggestion && onOpenWriteContent?.(suggestion)}
                style={({ pressed, hovered }) => [
                  styles.primaryButton,
                  {
                    backgroundColor:
                      !onOpenWriteContent
                        ? colors.bgSurface
                        : pressed || hovered
                          ? colors.accent + 'CC'
                          : colors.accent,
                    opacity: isBusy || !onOpenWriteContent ? 0.6 : 1,
                  },
                ]}
              >
                <Feather name="file-text" size={14} color={onOpenWriteContent ? '#fff' : colors.textMuted} />
                <Text style={[styles.primaryButtonText, { color: onOpenWriteContent ? '#fff' : colors.textMuted }]}>
                  Open in editor
                </Text>
              </Pressable>
            ) : (
              <Pressable
                testID={`approval-approve-${suggestion._id}`}
                disabled={isBusy || !canApprove}
                onPress={() => onApply([suggestion._id], 'approve')}
                style={({ pressed, hovered }) => [
                  styles.primaryButton,
                  {
                    backgroundColor: pressed || hovered ? colors.accent + 'CC' : colors.accent,
                    opacity: isBusy || !canApprove ? 0.6 : 1,
                  },
                ]}
              >
                <Feather name="check" size={14} color="#fff" />
                <Text style={[styles.primaryButtonText, { color: '#fff' }]}>Approve</Text>
              </Pressable>
            )}
            <Pressable
              testID={`approval-reject-${suggestion._id}`}
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
        {suggestion.resolution ? (
          <MetaRow label="Resolution" value={titleCase(suggestion.resolution)} colors={colors} />
        ) : null}
        <MetaRow label="Created" value={created} colors={colors} />
        {suggestion.riskLevel ? (
          <MetaRow
            label="Risk"
            value={titleCase(suggestion.riskLevel)}
            colors={colors}
            testID={`approval-risk-${suggestion._id}`}
          />
        ) : null}
        {suggestion.actorName ? <MetaRow label="Actor" value={suggestion.actorName} colors={colors} /> : null}
        <MetaRow
          label="Tool"
          value={
            normalizedGraphMutation && effectiveToolName
              ? `${suggestion.toolName} → ${effectiveToolName}`
              : suggestion.toolName
          }
          colors={colors}
          mono
        />
        {suggestion.model ? <MetaRow label="Model" value={suggestion.model} colors={colors} mono /> : null}
        {suggestion.threadId ? <MetaRow label="Thread" value={suggestion.threadId} colors={colors} mono /> : null}
      </View>

      <View style={[styles.previewCard, { backgroundColor: colors.bgSurface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Preview</Text>

        {renderApprovalReasons()}
        {renderGraphPreview()}

        {!hasGraphPreview && (effectiveToolName === 'create_entity' || effectiveToolName === 'create_node') ? (
          <KeyValues title="New entity" values={effectiveToolArgs ?? {}} colors={colors} />
        ) : null}

        {renderEntityUpdatePreview()}

        {!hasGraphPreview && (effectiveToolName === 'create_relationship' || effectiveToolName === 'create_edge') ? (
          <KeyValues title="New relationship" values={effectiveToolArgs ?? {}} colors={colors} />
        ) : null}

        {renderRelationshipUpdatePreview()}

        {renderWriteContentPreview()}

        {effectiveToolName === 'commit_decision' ? (
          <KeyValues title="New memory" values={effectiveToolArgs ?? {}} colors={colors} />
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
  testID,
}: {
  label: string;
  value: string;
  colors: any;
  mono?: boolean;
  testID?: string;
}): JSX.Element {
  return (
    <View style={styles.metaRow} testID={testID}>
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

function DocumentDiff({ diff, colors }: { diff: WriteContentDiff; colors: any }): JSX.Element {
  return (
    <View style={styles.block}>
      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Document diff</Text>
      <Text style={[styles.docDiffMeta, { color: colors.textMuted }]}>
        Operation: {titleCase(diff.operation)}
      </Text>
      {diff.documentTitle ? (
        <Text style={[styles.docDiffMeta, { color: colors.textMuted }]}>
          Document: {diff.documentTitle}
        </Text>
      ) : null}
      {diff.rationale ? (
        <Text style={[styles.docDiffMeta, { color: colors.textMuted }]}>
          Rationale: {diff.rationale}
        </Text>
      ) : null}
      {diff.note ? (
        <Text style={[styles.docDiffMeta, { color: colors.textMuted }]}>{diff.note}</Text>
      ) : null}
      {diff.documentExcerpt ? (
        <View style={[styles.docDiffBlock, { borderColor: colors.border, backgroundColor: colors.bgHover }]}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Document excerpt</Text>
          <Text style={[styles.code, { color: colors.text }]}>{diff.documentExcerpt}</Text>
        </View>
      ) : null}
      {diff.blocks.map((block, index) => (
        <View
          key={`${block.label}-${index}`}
          style={[styles.docDiffBlock, { borderColor: colors.border, backgroundColor: colors.bgHover }]}
        >
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{block.label}</Text>
          <Text style={[styles.docDiffMeta, { color: colors.textMuted }]}>Before</Text>
          <Text style={[styles.code, { color: colors.text }]}>{block.before || '—'}</Text>
          <Text style={[styles.docDiffMeta, { color: colors.textMuted }]}>After</Text>
          <Text style={[styles.code, { color: colors.text }]}>{block.after || '—'}</Text>
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
  noticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  recheckButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: radii.md,
    borderWidth: 1,
  },
  recheckButtonText: {
    fontSize: typography.xs,
    fontWeight: '600',
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
  docDiffMeta: {
    fontSize: typography.xs,
    lineHeight: 16,
  },
  block: {
    gap: spacing[2],
    paddingTop: spacing[2],
  },
  docDiffBlock: {
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing[3],
    gap: spacing[2],
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
