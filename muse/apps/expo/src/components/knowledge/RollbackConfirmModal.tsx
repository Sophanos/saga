/**
 * RollbackConfirmModal
 *
 * Confirmation dialog for rolling back Knowledge PRs (suggestions).
 * Displays impact analysis before allowing rollback.
 */

import { useCallback, useEffect, useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useQuery } from 'convex/react';
import { api } from '../../../../../convex/_generated/api';
import type { Id } from '../../../../../convex/_generated/dataModel';
import { useTheme, spacing, radii, typography } from '@/design-system';

// ============================================================================
// Types
// ============================================================================

interface RollbackImpact {
  kind: string;
  entityName?: string;
  relationshipCount?: number;
  relationships?: Array<{
    id: string;
    sourceEntity?: string;
    targetEntity?: string;
    type: string;
  }>;
  warning?: string;
}

interface RollbackImpactResult {
  canRollback: boolean;
  error?: string;
  alreadyRolledBack?: boolean;
  impact?: RollbackImpact;
}

export interface RollbackConfirmModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** The suggestion ID to rollback */
  suggestionId: string | null;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback when rollback is confirmed */
  onConfirm: (suggestionId: string, cascadeRelationships: boolean) => Promise<void>;
  /** Whether rollback is in progress */
  isRollingBack?: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

function titleCase(input: string): string {
  return input
    .split(/[_.\s]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getImpactDescription(impact: RollbackImpact): string {
  switch (impact.kind) {
    case 'entity.create':
      return `This will delete the entity "${impact.entityName ?? 'Unknown'}".`;
    case 'entity.update':
      return `This will revert changes to "${impact.entityName ?? 'Unknown'}".`;
    case 'relationship.create':
      return 'This will delete the relationship.';
    case 'relationship.update':
      return 'This will revert changes to the relationship.';
    case 'memory.commit_decision':
      return 'This will remove the pinned canon decision.';
    default:
      return `This will undo the ${titleCase(impact.kind)} operation.`;
  }
}

// ============================================================================
// Component
// ============================================================================

export function RollbackConfirmModal({
  visible,
  suggestionId,
  onClose,
  onConfirm,
  isRollingBack = false,
}: RollbackConfirmModalProps): JSX.Element {
  const { colors } = useTheme();
  const [localError, setLocalError] = useState<string | null>(null);

  // Query rollback impact
  const apiAny: any = api;
  const impact = useQuery(
    apiAny.knowledgeSuggestions.getRollbackImpact,
    suggestionId ? { suggestionId: suggestionId as Id<'knowledgeSuggestions'> } : 'skip'
  ) as RollbackImpactResult | undefined;

  // Reset error when modal opens
  useEffect(() => {
    if (visible) {
      setLocalError(null);
    }
  }, [visible]);

  const handleConfirm = useCallback(async () => {
    if (!suggestionId || !impact?.canRollback) return;
    setLocalError(null);
    try {
      await onConfirm(suggestionId, true);
      onClose();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Rollback failed');
    }
  }, [suggestionId, impact?.canRollback, onConfirm, onClose]);

  const isLoading = impact === undefined;
  const canProceed = impact?.canRollback && !isRollingBack && !isLoading;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View entering={FadeIn.duration(200)} style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={isRollingBack ? undefined : onClose}
        />
        <Animated.View
          entering={SlideInDown.duration(300).springify().damping(18)}
          style={[styles.modal, { backgroundColor: colors.bgApp, borderColor: colors.border }]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.headerLeft}>
              <View style={[styles.headerIcon, { backgroundColor: '#f59e0b20' }]}>
                <Feather name="alert-triangle" size={16} color="#f59e0b" />
              </View>
              <Text style={[styles.headerTitle, { color: colors.text }]}>Confirm Undo</Text>
            </View>
            <Pressable
              onPress={onClose}
              disabled={isRollingBack}
              style={({ pressed, hovered }) => [
                styles.closeButton,
                (pressed || hovered) && { backgroundColor: colors.bgHover },
              ]}
              accessibilityLabel="Close"
            >
              <Feather name="x" size={18} color={colors.textMuted} />
            </Pressable>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {/* Loading state */}
            {isLoading && (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={colors.textMuted} />
                <Text style={[styles.loadingText, { color: colors.textMuted }]}>
                  Checking rollback impact...
                </Text>
              </View>
            )}

            {/* Error state from query */}
            {impact && !impact.canRollback && (
              <View style={[styles.errorBox, { backgroundColor: '#ef444414', borderColor: '#ef44442A' }]}>
                <Feather name="alert-circle" size={14} color="#ef4444" />
                <Text style={[styles.errorText, { color: '#ef4444' }]}>
                  {impact.error || 'Cannot rollback this change'}
                </Text>
              </View>
            )}

            {/* Local error from action */}
            {localError && (
              <View style={[styles.errorBox, { backgroundColor: '#ef444414', borderColor: '#ef44442A' }]}>
                <Feather name="alert-circle" size={14} color="#ef4444" />
                <Text style={[styles.errorText, { color: '#ef4444' }]}>{localError}</Text>
              </View>
            )}

            {/* Impact description */}
            {impact?.canRollback && impact.impact && (
              <>
                <Text style={[styles.description, { color: colors.textSecondary }]}>
                  {getImpactDescription(impact.impact)}
                </Text>

                {/* Warning about cascade */}
                {impact.impact.warning && (
                  <View style={[styles.warningBox, { backgroundColor: '#f59e0b14', borderColor: '#f59e0b2A' }]}>
                    <Feather name="alert-triangle" size={14} color="#f59e0b" style={styles.warningIcon} />
                    <Text style={[styles.warningText, { color: '#f59e0b' }]}>
                      {impact.impact.warning}
                    </Text>
                  </View>
                )}

                {/* Relationship list */}
                {impact.impact.relationships && impact.impact.relationships.length > 0 && (
                  <View style={styles.relationshipSection}>
                    <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
                      AFFECTED RELATIONSHIPS
                    </Text>
                    {impact.impact.relationships.map((rel) => (
                      <View
                        key={rel.id}
                        style={[styles.relationshipRow, { backgroundColor: colors.bgSurface }]}
                      >
                        <Feather name="link" size={12} color={colors.textMuted} />
                        <Text style={[styles.relationshipText, { color: colors.textSecondary }]} numberOfLines={1}>
                          {rel.sourceEntity ?? '?'}{' '}
                          <Text style={{ color: colors.textMuted }}>→</Text>{' '}
                          <Text style={{ color: colors.accent }}>{rel.type}</Text>{' '}
                          <Text style={{ color: colors.textMuted }}>→</Text>{' '}
                          {rel.targetEntity ?? '?'}
                        </Text>
                      </View>
                    ))}
                    {impact.impact.relationshipCount &&
                      impact.impact.relationshipCount > impact.impact.relationships.length && (
                        <Text style={[styles.moreText, { color: colors.textMuted }]}>
                          +{impact.impact.relationshipCount - impact.impact.relationships.length} more
                        </Text>
                      )}
                  </View>
                )}

                {/* Info box */}
                <View style={[styles.infoBox, { backgroundColor: colors.bgSurface, borderColor: colors.border }]}>
                  <Text style={[styles.infoText, { color: colors.textMuted }]}>
                    This action cannot be undone. The change will be reverted to its previous state.
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* Footer */}
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <Pressable
              onPress={onClose}
              disabled={isRollingBack}
              style={({ pressed, hovered }) => [
                styles.cancelButton,
                { borderColor: colors.border, backgroundColor: colors.bgSurface },
                (pressed || hovered) && { backgroundColor: colors.bgHover },
              ]}
            >
              <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleConfirm}
              disabled={!canProceed}
              style={({ pressed, hovered }) => [
                styles.confirmButton,
                { backgroundColor: canProceed ? '#ef4444' : colors.bgHover },
                (pressed || hovered) && canProceed && { backgroundColor: '#dc2626' },
              ]}
            >
              {isRollingBack ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Feather name="corner-up-left" size={14} color={canProceed ? '#fff' : colors.textMuted} />
              )}
              <Text
                style={[
                  styles.confirmButtonText,
                  { color: canProceed ? '#fff' : colors.textMuted },
                ]}
              >
                {isRollingBack ? 'Undoing...' : 'Undo Change'}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[4],
  },
  modal: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radii.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: typography.lg,
    fontWeight: '600',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: spacing[4],
    gap: spacing[3],
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  loadingText: {
    fontSize: typography.sm,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    padding: spacing[3],
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  errorText: {
    flex: 1,
    fontSize: typography.sm,
  },
  description: {
    fontSize: typography.sm,
    lineHeight: 20,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    padding: spacing[3],
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  warningIcon: {
    marginTop: 2,
  },
  warningText: {
    flex: 1,
    fontSize: typography.sm,
    lineHeight: 20,
  },
  relationshipSection: {
    gap: spacing[2],
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  relationshipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    padding: spacing[2],
    borderRadius: radii.md,
  },
  relationshipText: {
    flex: 1,
    fontSize: typography.xs,
  },
  moreText: {
    fontSize: typography.xs,
    paddingLeft: spacing[5],
  },
  infoBox: {
    padding: spacing[3],
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  infoText: {
    fontSize: typography.xs,
    lineHeight: 16,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
    padding: spacing[4],
    borderTopWidth: 1,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: radii.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: typography.sm,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
  },
  confirmButtonText: {
    fontSize: typography.sm,
    fontWeight: '600',
  },
});
