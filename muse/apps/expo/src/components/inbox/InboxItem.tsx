/**
 * InboxItem - Generic row component for inbox items (Expo/RN)
 *
 * Renders status icon, title, subtitle, time ago, and hover actions.
 */

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useMemo, useEffect } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useTheme, spacing, radii, typography } from '@/design-system';
import { palette } from '@/design-system/colors';

export type InboxItemStatus =
  | 'new'
  | 'pending'
  | 'running'
  | 'ready'
  | 'done'
  | 'stale'
  | 'failed';

export interface InboxItemAction {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
}

export interface InboxItemProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  context?: string;
  meta?: string;
  status?: InboxItemStatus;
  isUnread?: boolean;
  actions?: InboxItemAction[];
  onPress?: () => void;
}

// Spinner component for running status
function Spinner({ color }: { color: string }) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 1000, easing: Easing.linear }),
      -1,
      false
    );
  }, [rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <View
        style={[
          styles.spinner,
          { borderColor: color, borderTopColor: 'transparent' },
        ]}
      />
    </Animated.View>
  );
}

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);

  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;

  return `${Math.floor(days / 7)}w`;
}

export function InboxItem({
  icon,
  title,
  subtitle,
  context,
  meta,
  status = 'pending',
  isUnread = false,
  actions = [],
  onPress,
}: InboxItemProps) {
  const { colors, isDark } = useTheme();

  const statusIcon = useMemo(() => {
    if (icon) return icon;

    switch (status) {
      case 'new':
        return <View style={[styles.statusDot, { backgroundColor: colors.accent }]} />;
      case 'pending':
        return <Feather name="circle" size={12} color={colors.textMuted} />;
      case 'running':
        return <Spinner color={palette.amber[400]} />;
      case 'ready':
        return <Feather name="eye" size={14} color={colors.accent} />;
      case 'done':
        return <Feather name="check" size={14} color={palette.green[400]} />;
      case 'stale':
        return <Feather name="alert-triangle" size={14} color={palette.amber[400]} />;
      case 'failed':
        return <Feather name="alert-circle" size={14} color={palette.red[400]} />;
      default:
        return <Feather name="circle" size={12} color={colors.textMuted} />;
    }
  }, [icon, status, colors]);

  const timeDisplay = useMemo(() => {
    if (!meta) return null;
    const timestamp = parseInt(meta, 10);
    if (!isNaN(timestamp) && timestamp > 1000000000000) {
      return formatTimeAgo(timestamp);
    }
    return meta;
  }, [meta]);

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: pressed
            ? isDark ? palette.gray[750] : palette.gray[150]
            : 'transparent',
        },
      ]}
    >
      {/* Status Icon */}
      <View style={styles.iconContainer}>{statusIcon}</View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.header}>
          <Text
            style={[
              styles.title,
              { color: isUnread ? colors.text : colors.textSecondary },
            ]}
            numberOfLines={1}
          >
            {title}
          </Text>
          {isUnread && (
            <View style={[styles.unreadDot, { backgroundColor: colors.accent }]} />
          )}
        </View>

        {(subtitle || context) && (
          <View style={styles.meta}>
            {subtitle && (
              <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>
                {subtitle}
              </Text>
            )}
            {subtitle && context && (
              <Text style={[styles.dot, { color: colors.textGhost }]}> · </Text>
            )}
            {context && (
              <Text style={[styles.context, { color: colors.textMuted }]} numberOfLines={1}>
                {context}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Actions */}
      {actions.length > 0 && (
        <View style={styles.actions}>
          {actions.map((action, index) => (
            <Pressable
              key={index}
              onPress={(e) => {
                e.stopPropagation?.();
                action.onPress();
              }}
              style={({ pressed }) => [
                styles.actionButton,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text
                style={[
                  styles.actionText,
                  {
                    color:
                      action.variant === 'primary'
                        ? colors.accent
                        : colors.textMuted,
                  },
                ]}
              >
                {action.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Time */}
      {timeDisplay && (
        <Text style={[styles.time, { color: colors.textGhost }]}>{timeDisplay}</Text>
      )}
    </Pressable>
  );
}

// Pre-configured variants

export interface PulseItemProps {
  title: string;
  description?: string;
  context?: string;
  signalType: 'entity_detected' | 'voice_drift' | 'consistency_issue' | 'suggestion';
  isUnread?: boolean;
  updatedAt: number;
  onReview?: () => void;
  onDismiss?: () => void;
}

const pulseIconMap: Record<PulseItemProps['signalType'], keyof typeof Feather.glyphMap> = {
  entity_detected: 'zap',
  voice_drift: 'alert-triangle',
  consistency_issue: 'alert-circle',
  suggestion: 'file-text',
};

export function PulseItem({
  title,
  description,
  context,
  signalType,
  isUnread,
  updatedAt,
  onReview,
  onDismiss,
}: PulseItemProps) {
  const { colors } = useTheme();
  const actions: InboxItemAction[] = [];
  if (onReview) actions.push({ label: 'Review', onPress: onReview, variant: 'primary' });
  if (onDismiss) actions.push({ label: 'Dismiss', onPress: onDismiss, variant: 'ghost' });

  return (
    <InboxItem
      icon={<Feather name={pulseIconMap[signalType]} size={14} color={colors.accent} />}
      title={title}
      subtitle={description}
      context={context}
      meta={String(updatedAt)}
      status={isUnread ? 'new' : 'done'}
      isUnread={isUnread}
      actions={actions}
    />
  );
}

export interface ChangeItemRowProps {
  title: string;
  operation: string;
  riskLevel?: 'low' | 'high' | 'core';
  actorName?: string;
  updatedAt: number;
  onApprove?: () => void;
  onReject?: () => void;
}

export function ChangeItemRow({
  title,
  operation,
  actorName,
  updatedAt,
  onApprove,
  onReject,
}: ChangeItemRowProps) {
  const actions: InboxItemAction[] = [];
  if (onApprove) actions.push({ label: 'Approve', onPress: onApprove, variant: 'primary' });
  if (onReject) actions.push({ label: 'Reject', onPress: onReject, variant: 'ghost' });

  return (
    <InboxItem
      title={title}
      subtitle={actorName ? `by ${actorName}` : operation}
      status="pending"
      isUnread={true}
      meta={String(updatedAt)}
      actions={actions}
    />
  );
}

export interface ActivityItemRowProps {
  title: string;
  statusText: string;
  documentName?: string;
  status: 'running' | 'ready' | 'applied' | 'failed';
  isUnread?: boolean;
  updatedAt: number;
  onView?: () => void;
  onRetry?: () => void;
}

export function ActivityItemRow({
  title,
  statusText,
  documentName,
  status,
  isUnread,
  updatedAt,
  onView,
  onRetry,
}: ActivityItemRowProps) {
  const actions: InboxItemAction[] = [];
  if (status === 'ready' && onView) {
    actions.push({ label: 'View', onPress: onView, variant: 'primary' });
  }
  if (status === 'failed' && onRetry) {
    actions.push({ label: 'Retry', onPress: onRetry, variant: 'primary' });
  }

  return (
    <InboxItem
      title={title}
      subtitle={statusText}
      context={documentName}
      status={status === 'applied' ? 'done' : status}
      isUnread={isUnread}
      meta={String(updatedAt)}
      actions={actions}
    />
  );
}

export interface ArtifactItemRowProps {
  title: string;
  artifactType: string;
  isStale: boolean;
  lastSyncedAt?: number;
  onRefresh?: () => void;
  onOpen?: () => void;
}

export function ArtifactItemRow({
  title,
  artifactType,
  isStale,
  lastSyncedAt,
  onRefresh,
  onOpen,
}: ArtifactItemRowProps) {
  const actions: InboxItemAction[] = [];
  if (isStale && onRefresh) {
    actions.push({ label: 'Refresh', onPress: onRefresh, variant: 'primary' });
  }
  if (onOpen) {
    actions.push({ label: 'Open', onPress: onOpen, variant: 'ghost' });
  }

  const syncInfo = lastSyncedAt
    ? `Last sync: ${formatTimeAgo(lastSyncedAt)}`
    : undefined;

  return (
    <InboxItem
      title={title}
      subtitle={artifactType}
      context={syncInfo}
      status={isStale ? 'stale' : 'done'}
      isUnread={isStale}
      actions={actions}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2] + 2,
    gap: spacing[3],
  },
  iconContainer: {
    width: 14,
    height: 14,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  spinner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  title: {
    fontSize: typography.sm,
    fontWeight: '500',
    flexShrink: 1,
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    flexShrink: 0,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  subtitle: {
    fontSize: typography.xs,
    flexShrink: 1,
  },
  dot: {
    fontSize: typography.xs,
  },
  context: {
    fontSize: typography.xs,
    flexShrink: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  actionButton: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
  },
  actionText: {
    fontSize: typography.xs,
    fontWeight: '500',
  },
  time: {
    fontSize: 10,
    flexShrink: 0,
  },
});
