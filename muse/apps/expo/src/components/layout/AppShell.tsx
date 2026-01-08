import { View, Text, StyleSheet, useWindowDimensions, Pressable } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
  withSpring,
  withTiming,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useTheme, sizing, spacing, radii, typography } from '@/design-system';
import { useLayoutStore } from '@/design-system/layout';
import { Sidebar } from './Sidebar';
import { AIPanel, AIFloatingButton } from '@/components/ai';

interface AppShellProps {
  children: React.ReactNode;
}

const TABLET_BREAKPOINT = 768;
const DESKTOP_BREAKPOINT = 1024;

export function AppShell({ children }: AppShellProps) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const {
    sidebarCollapsed,
    setSidebarCollapsed,
    sidebarWidth,
    setSidebarWidth,
    aiPanelMode,
    setAIPanelMode,
    aiPanelWidth,
    setAIPanelWidth,
  } = useLayoutStore();

  const isTablet = width >= TABLET_BREAKPOINT;
  const isDesktop = width >= DESKTOP_BREAKPOINT;
  const showSidebar = isTablet;

  const currentSidebarWidth = sidebarCollapsed ? sizing.sidebarCollapsed : sidebarWidth;

  // AI Panel mode logic
  const showSidePanel = isDesktop && aiPanelMode === 'side';
  const showFloating = aiPanelMode === 'floating';
  const showFull = aiPanelMode === 'full';
  const showFAB = aiPanelMode === 'hidden';

  return (
    <View style={[styles.container, { backgroundColor: colors.bgApp }]}>
      {/* Sidebar */}
      {showSidebar && (
        <View style={[styles.sidebarContainer, { width: currentSidebarWidth }]}>
          <View style={[styles.sidebar, { backgroundColor: colors.sidebarBg, borderRightColor: colors.border }]}>
            <Sidebar />
          </View>
          {!sidebarCollapsed && (
            <ResizeHandle
              side="right"
              onResize={setSidebarWidth}
              currentWidth={sidebarWidth}
              onMinimize={() => setSidebarCollapsed(true)}
              panelType="sidebar"
            />
          )}
        </View>
      )}

      {/* Main content OR Full AI Panel */}
      {showFull ? (
        <View style={styles.main}>
          <AIPanel mode="full" />
        </View>
      ) : (
        <View style={styles.main}>{children}</View>
      )}

      {/* Side Panel (docked right) */}
      {showSidePanel && (
        <View style={[styles.aiPanelContainer, { width: aiPanelWidth }]}>
          <ResizeHandle
            side="left"
            onResize={setAIPanelWidth}
            currentWidth={aiPanelWidth}
            onMinimize={() => setAIPanelMode('hidden')}
            panelType="ai"
          />
          <View style={[styles.aiPanel, { backgroundColor: colors.sidebarBg, borderLeftColor: colors.border }]}>
            <AIPanel mode="side" />
          </View>
        </View>
      )}

      {/* Floating Panel */}
      {showFloating && <AIPanel mode="floating" />}

      {/* FAB to reopen */}
      {showFAB && <AIFloatingButton />}
    </View>
  );
}

interface ResizeHandleProps {
  side: 'left' | 'right';
  onResize: (width: number) => void;
  currentWidth: number;
  onMinimize?: () => void;
  panelType?: 'sidebar' | 'ai';
}

function ResizeHandle({ side, onResize, currentWidth, onMinimize, panelType = 'sidebar' }: ResizeHandleProps) {
  const { colors, isDark } = useTheme();
  const startWidth = useSharedValue(currentWidth);
  const isHovered = useSharedValue(false);
  const isDragging = useSharedValue(false);
  const showTooltip = useSharedValue(false);

  const pan = Gesture.Pan()
    .onStart(() => {
      startWidth.value = currentWidth;
      isDragging.value = true;
    })
    .onUpdate((e) => {
      const delta = side === 'right' ? e.translationX : -e.translationX;
      runOnJS(onResize)(startWidth.value + delta);
    })
    .onEnd(() => {
      isDragging.value = false;
    });

  const hover = Gesture.Hover()
    .onStart(() => {
      isHovered.value = true;
      showTooltip.value = true;
    })
    .onEnd(() => {
      isHovered.value = false;
      showTooltip.value = false;
    });

  const tap = Gesture.Tap()
    .onEnd(() => {
      if (onMinimize) runOnJS(onMinimize)();
    });

  const handleStyle = useAnimatedStyle(() => ({
    backgroundColor: isDragging.value
      ? colors.accent
      : isHovered.value
        ? isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'
        : 'transparent',
  }));

  const iconStyle = useAnimatedStyle(() => ({
    opacity: withTiming(isHovered.value ? 1 : 0, { duration: 150 }),
    transform: [{ scale: withSpring(isHovered.value ? 1 : 0.8, { damping: 20, stiffness: 300 }) }],
  }));

  const tooltipStyle = useAnimatedStyle(() => ({
    opacity: withTiming(showTooltip.value && !isDragging.value ? 1 : 0, { duration: 150 }),
    transform: [
      { translateX: side === 'right' ? 8 : -8 },
      { scale: withSpring(showTooltip.value && !isDragging.value ? 1 : 0.95, { damping: 20, stiffness: 400 }) },
    ],
  }));

  const shortcut = panelType === 'ai' ? '⌘J' : '⌘\\';

  return (
    <GestureDetector gesture={Gesture.Race(tap, Gesture.Simultaneous(pan, hover))}>
      <Animated.View
        style={[styles.resizeHandle, side === 'left' ? styles.resizeLeft : styles.resizeRight, handleStyle]}
      >
        {/* Grip icon */}
        <Animated.View style={[styles.resizeIcon, iconStyle]}>
          <Feather name="more-vertical" size={12} color={colors.textMuted} />
        </Animated.View>

        {/* Tooltip */}
        {onMinimize && (
          <Animated.View
            style={[
              styles.resizeTooltip,
              side === 'left' ? styles.tooltipLeft : styles.tooltipRight,
              { backgroundColor: isDark ? colors.bgElevated : colors.bgApp, borderColor: colors.border },
              tooltipStyle,
            ]}
          >
            <View style={styles.tooltipRow}>
              <Text style={[styles.tooltipLabel, { color: colors.text }]}>Close</Text>
              <Text style={[styles.tooltipShortcut, { color: colors.textMuted }]}>{shortcut}</Text>
            </View>
            <View style={styles.tooltipRow}>
              <Text style={[styles.tooltipLabel, { color: colors.text }]}>Resize</Text>
              <Text style={[styles.tooltipShortcut, { color: colors.textMuted }]}>Drag</Text>
            </View>
          </Animated.View>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row' },
  sidebarContainer: { flexDirection: 'row' },
  sidebar: { flex: 1, borderRightWidth: StyleSheet.hairlineWidth },
  main: { flex: 1 },
  aiPanelContainer: { flexDirection: 'row' },
  aiPanel: { flex: 1, borderLeftWidth: StyleSheet.hairlineWidth },
  resizeHandle: {
    width: 8,
    cursor: 'pointer' as const,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resizeLeft: { marginRight: -4, zIndex: 10 },
  resizeRight: { marginLeft: -4, zIndex: 10 },
  resizeIcon: {
    width: 16,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
  },
  resizeTooltip: {
    position: 'absolute',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing[1],
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  tooltipLeft: { right: 16 },
  tooltipRight: { left: 16 },
  tooltipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[4],
  },
  tooltipLabel: {
    fontSize: typography.xs,
    fontWeight: typography.medium,
  },
  tooltipShortcut: {
    fontSize: typography.xs,
  },
});
