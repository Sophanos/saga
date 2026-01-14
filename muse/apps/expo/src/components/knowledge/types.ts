import { Platform } from 'react-native';
import { toast } from '@mythos/ui';

export type KnowledgeTargetType = 'document' | 'entity' | 'relationship' | 'memory';
export type KnowledgeStatus = 'proposed' | 'accepted' | 'rejected' | 'resolved';
export type KnowledgeRiskLevel = 'low' | 'high' | 'core';
export type KnowledgeResolution =
  | 'executed'
  | 'user_rejected'
  | 'execution_failed'
  | 'rolled_back'
  | 'applied_in_editor';
export type SuggestionPreflightStatus = 'ok' | 'invalid' | 'conflict';
export type KnowledgeCitationVisibility = 'project' | 'private' | 'redacted';

export interface SuggestionPreflight {
  status: SuggestionPreflightStatus;
  errors?: string[];
  warnings?: string[];
  resolvedTargetId?: string;
  computedAt: number;
}

export interface KnowledgeEditorContext {
  documentId?: string;
  documentTitle?: string;
  documentExcerpt?: string;
  selectionText?: string;
  selectionContext?: string;
}

export interface GraphPreviewChange {
  key: string;
  from?: unknown;
  to?: unknown;
}

export type KnowledgeSuggestionPreview =
  | {
      kind: 'entity_create';
      type: string;
      name: string;
      aliases?: string[];
      notes?: string;
      properties?: Record<string, unknown>;
      source?: string;
      note?: string;
    }
  | {
      kind: 'entity_update';
      entityId?: string;
      name?: string;
      type?: string;
      changes: GraphPreviewChange[];
      note?: string;
    }
  | {
      kind: 'relationship_create';
      type: string;
      sourceName?: string;
      targetName?: string;
      sourceId?: string;
      targetId?: string;
      bidirectional?: boolean;
      strength?: number;
      notes?: string;
      metadata?: Record<string, unknown>;
      note?: string;
    }
  | {
      kind: 'relationship_update';
      relationshipId?: string;
      type?: string;
      sourceName?: string;
      targetName?: string;
      changes: GraphPreviewChange[];
      note?: string;
    };

export interface KnowledgeCitation {
  _id: string;
  projectId: string;
  targetKind: string;
  targetId: string;
  phase: string;
  memoryId: string;
  memoryCategory?: string;
  excerpt?: string;
  reason?: string;
  confidence?: number;
  visibility: KnowledgeCitationVisibility;
  redactionReason?: string;
  memoryText?: string;
  memoryType?: string;
  createdAt: number;
}

export interface KnowledgeSuggestion {
  _id: string;
  projectId: string;
  targetType: KnowledgeTargetType;
  targetId?: string;
  operation: string;
  proposedPatch: unknown;
  normalizedPatch?: unknown;
  editorContext?: KnowledgeEditorContext;
  status: KnowledgeStatus;
  resolution?: KnowledgeResolution;
  preflight?: SuggestionPreflight;
  rolledBackAt?: number;
  rolledBackByUserId?: string;
  actorType: string;
  actorUserId?: string;
  actorAgentId?: string;
  actorName?: string;
  toolName: string;
  toolCallId: string;
  approvalType: string;
  danger?: string;
  riskLevel?: KnowledgeRiskLevel;
  approvalReasons?: string[];
  preview?: KnowledgeSuggestionPreview;
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

export function titleCase(input: string): string {
  return input
    .split(/[_\s]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function canonicalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

export function formatRelativeTime(timestampMs: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - timestampMs) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

export async function copyToClipboard(value: string): Promise<void> {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') {
    return;
  }
  try {
    await navigator.clipboard.writeText(value);
    toast.copied();
  } catch {
    // Ignore copy failures (permissions / unsupported browser).
  }
}
