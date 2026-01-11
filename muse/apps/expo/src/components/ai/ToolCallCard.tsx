/**
 * ToolCallCard - Displays tool execution status inline in chat
 * Minimal, non-intrusive design with collapsible result preview
 */

import { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { useTheme, spacing, radii, typography } from '@/design-system';
import { palette } from '@/design-system/colors';

type ToolStatus = 'pending' | 'running' | 'complete' | 'error';

interface ToolCallCardProps {
  id: string;
  name: string;
  status: ToolStatus;
  result?: unknown;
  error?: string;
  timestamp?: number;
}

const TOOL_LABELS: Record<string, string> = {
  ask_question: 'Asking question',
  open_panel: 'Opening panel',
  focus_entity: 'Focusing entity',
  show_graph: 'Showing relationships',
  create_entity: 'Creating entity',
  create_relationship: 'Creating relationship',
  analyze_consistency: 'Analyzing consistency',
  suggest_connections: 'Finding connections',
  detect_entities: 'Detecting entities',
  check_consistency: 'Checking consistency',
  project_manage: 'Setting up project',
  genesis_world: 'Generating project scaffold',
  generate_template: 'Creating template',
};

export function ToolCallCard({
  id,
  name,
  status,
  result,
  error,
}: ToolCallCardProps) {
  const { colors, isDark } = useTheme();
  const [expanded, setExpanded] = useState(false);

  const hasResult = result !== undefined || error !== undefined;
  const canExpand = hasResult && status === 'complete';

  const toggleExpanded = useCallback(() => {
    if (canExpand) {
      setExpanded(prev => !prev);
    }
  }, [canExpand]);

  const label = TOOL_LABELS[name] || name.replace(/_/g, ' ');

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
      style={[
        styles.container,
        {
          backgroundColor: isDark ? palette.gray[900] : palette.gray[50],
          borderColor: isDark ? palette.gray[800] : palette.gray[200],
        },
      ]}
    >
      <Pressable
        onPress={toggleExpanded}
        disabled={!canExpand}
        style={styles.header}
      >
        <StatusIndicator status={status} />
        <Text
          style={[
            styles.label,
            { color: status === 'error' ? palette.red[400] : colors.textSecondary },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
        {canExpand && (
          <ExpandChevron expanded={expanded} />
        )}
      </Pressable>

      {expanded && hasResult && (
        <Animated.View
          entering={FadeIn.duration(150)}
          style={[
            styles.resultContainer,
            { borderTopColor: colors.borderSubtle },
          ]}
        >
          {error ? (
            <Text style={[styles.errorText, { color: palette.red[400] }]}>
              {error}
            </Text>
          ) : (
            <Text
              style={[styles.resultText, { color: colors.textMuted }]}
              numberOfLines={8}
            >
              {formatResult(result)}
            </Text>
          )}
        </Animated.View>
      )}
    </Animated.View>
  );
}

interface StatusIndicatorProps {
  status: ToolStatus;
}

function StatusIndicator({ status }: StatusIndicatorProps) {
  const { isDark } = useTheme();
  const rotation = useSharedValue(0);
  const pulse = useSharedValue(1);

  // Spinning animation for running state
  if (status === 'running') {
    rotation.value = withRepeat(
      withTiming(360, { duration: 1000, easing: Easing.linear }),
      -1,
      false
    );
  }

  // Pulse animation for pending state
  if (status === 'pending') {
    pulse.value = withRepeat(
      withSequence(
        withTiming(0.5, { duration: 600 }),
        withTiming(1, { duration: 600 })
      ),
      -1,
      false
    );
  }

  const animatedStyle = useAnimatedStyle(() => ({
    transform: status === 'running' ? [{ rotate: `${rotation.value}deg` }] : [],
    opacity: status === 'pending' ? pulse.value : 1,
  }));

  const getStatusColor = () => {
    switch (status) {
      case 'pending':
        return palette.gray[500];
      case 'running':
        return isDark ? palette.blue[400] : palette.blue[500];
      case 'complete':
        return isDark ? palette.green[400] : palette.green[500];
      case 'error':
        return palette.red[400];
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'pending':
        return '○';
      case 'running':
        return '◐';
      case 'complete':
        return '●';
      case 'error':
        return '!';
    }
  };

  return (
    <Animated.View style={[styles.statusIndicator, animatedStyle]}>
      <Text style={[styles.statusIcon, { color: getStatusColor() }]}>
        {getStatusIcon()}
      </Text>
    </Animated.View>
  );
}

interface ExpandChevronProps {
  expanded: boolean;
}

function ExpandChevron({ expanded }: ExpandChevronProps) {
  const { colors } = useTheme();
  const rotation = useSharedValue(expanded ? 180 : 0);

  rotation.value = withSpring(expanded ? 180 : 0, {
    damping: 15,
    stiffness: 200,
  });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View style={[styles.chevron, animatedStyle]}>
      <Text style={[styles.chevronIcon, { color: colors.textMuted }]}>
        v
      </Text>
    </Animated.View>
  );
}

function formatResult(result: unknown): string {
  if (result === null || result === undefined) {
    return 'No result';
  }
  if (typeof result === 'string') {
    return result;
  }
  if (typeof result === 'object') {
    try {
      return JSON.stringify(result, null, 2);
    } catch {
      return String(result);
    }
  }
  return String(result);
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    gap: spacing[2],
  },
  statusIndicator: {
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusIcon: {
    fontSize: 10,
    fontWeight: typography.bold,
  },
  label: {
    flex: 1,
    fontSize: typography.xs,
    fontWeight: typography.medium,
    textTransform: 'capitalize',
  },
  chevron: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevronIcon: {
    fontSize: typography.xs,
  },
  resultContainer: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  resultText: {
    fontSize: typography.xs,
    fontFamily: 'SpaceMono',
    lineHeight: typography.xs * 1.5,
  },
  errorText: {
    fontSize: typography.xs,
    fontWeight: typography.medium,
  },
});
