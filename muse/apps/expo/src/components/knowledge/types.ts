import { Platform } from 'react-native';

export type KnowledgeTargetType = 'document' | 'entity' | 'relationship' | 'memory';
export type KnowledgeStatus = 'proposed' | 'accepted' | 'rejected' | 'resolved';
export type KnowledgeRiskLevel = 'low' | 'high' | 'core';
export type KnowledgeCitationVisibility = 'project' | 'private' | 'redacted';

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
  } catch {
    // Ignore copy failures (permissions / unsupported browser).
  }
}
