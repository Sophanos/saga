import { View, Text, StyleSheet, useWindowDimensions, Pressable } from 'react-native';
import { useState, useCallback, useRef, useEffect, useMemo, memo } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
  withSpring,
  withTiming,
  FadeIn,
  FadeOut,
  SlideInLeft,
  SlideOutLeft,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useTheme, spacing, radii, typography } from '@/design-system';
import { useLayoutStore } from '@/design-system/layout';
import { Sidebar } from './Sidebar';
import { AIPanel, AIFloatingButton } from '@/components/ai';

const MemoizedSidebar = memo(Sidebar);

interface AppShellProps {
  children: React.ReactNode;
}

const TABLET_BREAKPOINT = 768;
const DESKTOP_BREAKPOINT = 1024;

const TOOLTIP_DELAY = 80;
const SIDEBAR_DELAY = 150;
const HIDE_DELAY = 100;

export function AppShell({ children }: AppShellProps) {
  const { colors, isDark } = useTheme();
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

  const [showTooltip, setShowTooltip] = useState(false);
  const [showSidebarOverlay, setShowSidebarOverlay] = useState(false);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sidebarTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isTablet = width >= TABLET_BREAKPOINT;
  const isDesktop = width >= DESKTOP_BREAKPOINT;
  const showSidebarDocked = isTablet && !sidebarCollapsed;

  const showSidePanel = isDesktop && aiPanelMode === 'side';
  const showFloating = aiPanelMode === 'floating';
  const showFull = aiPanelMode === 'full';
  const showFAB = aiPanelMode === 'hidden';

  const clearAllTimeouts = useCallback(() => {
    if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
    if (sidebarTimeoutRef.current) clearTimeout(sidebarTimeoutRef.current);
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
  }, []);

  const handleHoverStart = useCallback(() => {
    clearAllTimeouts();
    tooltipTimeoutRef.current = setTimeout(() => setShowTooltip(true), TOOLTIP_DELAY);
    sidebarTimeoutRef.current = setTimeout(() => {
      setShowTooltip(false);
      setShowSidebarOverlay(true);
    }, SIDEBAR_DELAY);
  }, [clearAllTimeouts]);

  const handleHoverEnd = useCallback(() => {
    clearAllTimeouts();
    hideTimeoutRef.current = setTimeout(() => {
      setShowTooltip(false);
      setShowSidebarOverlay(false);
    }, HIDE_DELAY);
  }, [clearAllTimeouts]);

  const handleOverlayEnter = useCallback(() => {
    clearAllTimeouts();
  }, [clearAllTimeouts]);

  const handleOverlayLeave = useCallback(() => {
    clearAllTimeouts();
    hideTimeoutRef.current = setTimeout(() => {
      setShowSidebarOverlay(false);
    }, HIDE_DELAY);
  }, [clearAllTimeouts]);

  const handleBackdropPress = useCallback(() => {
    clearAllTimeouts();
    setShowSidebarOverlay(false);
    setShowTooltip(false);
  }, [clearAllTimeouts]);

  useEffect(() => {
    return () => clearAllTimeouts();
  }, [clearAllTimeouts]);

  return (
    <View style={[styles.container, { backgroundColor: colors.bgApp }]}>
      {showSidebarDocked && (
        <View style={[styles.sidebarContainer, { width: sidebarWidth }]}>
          <View style={[styles.sidebar, { backgroundColor: colors.sidebarBg, borderRightColor: colors.border }]}>
            <MemoizedSidebar />
          </View>
          <ResizeHandle
            side="right"
            onResize={setSidebarWidth}
            currentWidth={sidebarWidth}
            onMinimize={() => setSidebarCollapsed(true)}
            panelType="sidebar"
          />
        </View>
      )}

      {isTablet && sidebarCollapsed && !showSidebarOverlay && (
        <View
          style={styles.hoverTriggerZone}
          onPointerEnter={handleHoverStart}
          onPointerLeave={handleHoverEnd}
        >
          <Pressable
            onPress={() => setSidebarCollapsed(false)}
            style={({ pressed, hovered }) => [
              styles.expandButton,
              {
                backgroundColor: hovered || pressed
                  ? isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)'
                  : 'transparent',
              },
            ]}
          >
            <Feather name="menu" size={18} color={colors.textMuted} />
          </Pressable>

          {showTooltip && (
            <Animated.View
              entering={FadeIn.duration(150)}
              exiting={FadeOut.duration(100)}
              style={[
                styles.hoverTooltip,
                {
                  backgroundColor: isDark ? colors.bgElevated : colors.bgApp,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.tooltipText, { color: colors.text }]}>Open sidebar</Text>
              <Text style={[styles.tooltipShortcut, { color: colors.textMuted }]}>⌘B</Text>
            </Animated.View>
          )}
        </View>
      )}

      {showFull ? (
        <View style={styles.main}>
          <AIPanel mode="full" />
        </View>
      ) : (
        <View style={styles.main}>{children}</View>
      )}

      {showSidebarOverlay && isTablet && sidebarCollapsed && (
        <>
          <Animated.View
            entering={FadeIn.duration(100)}
            exiting={FadeOut.duration(80)}
            style={[
              styles.overlayBackdrop,
              { backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.1)' },
            ]}
          >
            <Pressable style={StyleSheet.absoluteFill} onPress={handleBackdropPress} />
          </Animated.View>

          <Animated.View
            entering={SlideInLeft.duration(120).springify().damping(18).stiffness(400)}
            exiting={SlideOutLeft.duration(80)}
            onPointerEnter={handleOverlayEnter}
            onPointerLeave={handleOverlayLeave}
            style={[
              styles.sidebarOverlay,
              { width: sidebarWidth, backgroundColor: colors.sidebarBg },
            ]}
          >
            <MemoizedSidebar />
          </Animated.View>
        </>
      )}

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

      {showFloating && <AIPanel mode="floating" />}
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

  const shortcut = panelType === 'ai' ? '⌘J' : '⌘B';

  return (
    <GestureDetector gesture={Gesture.Race(tap, Gesture.Simultaneous(pan, hover))}>
      <Animated.View
        style={[styles.resizeHandle, side === 'left' ? styles.resizeLeft : styles.resizeRight, handleStyle]}
      >
        <Animated.View style={[styles.resizeIcon, iconStyle]}>
          <Feather name="more-vertical" size={12} color={colors.textMuted} />
        </Animated.View>

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
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebarContainer: {
    flexDirection: 'row',
  },
  sidebar: {
    flex: 1,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  main: {
    flex: 1,
  },

  hoverTriggerZone: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 44,
    zIndex: 50,
    paddingTop: spacing[3],
    paddingLeft: spacing[3],
  },
  expandButton: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hoverTooltip: {
    position: 'absolute',
    left: 44,
    top: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing[3],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  tooltipText: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
  },
  tooltipShortcut: {
    fontSize: typography.xs,
    fontFamily: 'monospace',
  },

  overlayBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },

  sidebarOverlay: {
    position: 'absolute',
    top: 44,
    left: spacing[2],
    maxHeight: '80%',
    borderRadius: radii.lg,
    zIndex: 101,
    overflow: 'hidden',
  },

  aiPanelContainer: {
    flexDirection: 'row',
  },
  aiPanel: {
    flex: 1,
    borderLeftWidth: StyleSheet.hairlineWidth,
  },

  resizeHandle: {
    width: 6,
    cursor: 'col-resize' as const,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: -3,
    zIndex: 10,
  },
  resizeLeft: {},
  resizeRight: {},
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
