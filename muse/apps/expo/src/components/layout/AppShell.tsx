import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, runOnJS } from 'react-native-reanimated';
import { useTheme, sizing } from '@/design-system';
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
    sidebarWidth,
    setSidebarWidth,
    aiPanelMode,
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
            <ResizeHandle side="right" onResize={setSidebarWidth} currentWidth={sidebarWidth} />
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
          <ResizeHandle side="left" onResize={setAIPanelWidth} currentWidth={aiPanelWidth} />
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
}

function ResizeHandle({ side, onResize, currentWidth }: ResizeHandleProps) {
  const { colors } = useTheme();
  const startWidth = useSharedValue(currentWidth);
  const isHovered = useSharedValue(false);

  const pan = Gesture.Pan()
    .onStart(() => { startWidth.value = currentWidth; })
    .onUpdate((e) => {
      const delta = side === 'right' ? e.translationX : -e.translationX;
      runOnJS(onResize)(startWidth.value + delta);
    });

  const hover = Gesture.Hover()
    .onStart(() => { isHovered.value = true; })
    .onEnd(() => { isHovered.value = false; });

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: isHovered.value ? colors.accent : 'transparent',
  }));

  return (
    <GestureDetector gesture={Gesture.Simultaneous(pan, hover)}>
      <Animated.View
        style={[styles.resizeHandle, side === 'left' ? styles.resizeLeft : styles.resizeRight, animatedStyle]}
      />
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
  resizeHandle: { width: 4, cursor: 'pointer' as const },
  resizeLeft: { marginRight: -2, zIndex: 10 },
  resizeRight: { marginLeft: -2, zIndex: 10 },
});
