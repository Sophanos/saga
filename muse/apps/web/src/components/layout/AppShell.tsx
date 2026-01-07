/**
 * AppShell - Main layout container
 * Sidebar (left) | Main (center) | AI Panel (right, optional)
 */

import { View, StyleSheet } from 'react-native';
import { useTheme, sizing } from '@/design-system';
import { useLayoutStore } from '@/design-system/layout';
import { Sidebar } from './Sidebar';
import { AIPanel } from './AIPanel';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { colors } = useTheme();
  const { sidebarCollapsed, aiPanelMode } = useLayoutStore();

  const sidebarWidth = sidebarCollapsed ? sizing.sidebarCollapsed : sizing.sidebarWidth;
  const showAIPanel = aiPanelMode !== 'hidden';
  const aiPanelSticky = aiPanelMode === 'sticky';

  return (
    <View style={[styles.container, { backgroundColor: colors.bgApp }]}>
      {/* Sidebar */}
      <View style={[styles.sidebar, { width: sidebarWidth, backgroundColor: colors.sidebarBg }]}>
        <Sidebar />
      </View>

      {/* Main content */}
      <View style={styles.main}>
        {children}
      </View>

      {/* AI Panel - sticky (in flow) */}
      {showAIPanel && aiPanelSticky && (
        <View style={[styles.aiPanelSticky, { backgroundColor: colors.sidebarBg }]}>
          <AIPanel />
        </View>
      )}

      {/* AI Panel - floating (overlay) */}
      {showAIPanel && !aiPanelSticky && (
        <AIPanel floating />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    borderRightWidth: 1,
    borderRightColor: 'transparent', // set via theme
  },
  main: {
    flex: 1,
  },
  aiPanelSticky: {
    width: sizing.rightPanelWidth,
    borderLeftWidth: 1,
    borderLeftColor: 'transparent', // set via theme
  },
});
