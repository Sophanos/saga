/**
 * Editor Screen - TipTap editor (web only)
 *
 * This route renders the full TipTap editor on web platform.
 * On native platforms, shows a placeholder.
 */

import React, { Suspense, lazy } from 'react';
import { Platform, View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme, typography } from '@/design-system';
import { useLayoutStore } from '@/design-system/layout';

// Lazy load editor only on web
const LazyEditorShell = Platform.OS === 'web'
  ? lazy(() => import('@mythos/editor-webview').then(mod => ({ default: mod.EditorShell })))
  : null;

export default function EditorScreen() {
  const { colors } = useTheme();
  const { aiPanelMode, sidebarCollapsed } = useLayoutStore();

  // Hide quick actions when AI panel is visible (side or floating mode)
  const hideQuickActions = aiPanelMode === 'side' || aiPanelMode === 'floating';

  // Web-only: render TipTap editor
  if (Platform.OS === 'web' && LazyEditorShell) {
    return (
      <Suspense fallback={
        <View style={[styles.container, { backgroundColor: colors.bgApp }]}>
          <ActivityIndicator color={colors.accent} />
        </View>
      }>
        <div style={{
          height: '100%',
          width: '100%',
          flex: 1,
        }}>
          <LazyEditorShell
            hideQuickActions={hideQuickActions}
            sidebarCollapsed={sidebarCollapsed}
            onQuickAction={(action: string) => {
              console.log('Quick action:', action);
            }}
            onShare={() => {
              console.log('Share clicked');
            }}
          />
        </div>
      </Suspense>
    );
  }

  // Native fallback
  return (
    <View style={[styles.container, { backgroundColor: colors.bgApp }]}>
      <Text style={[styles.text, { color: colors.textMuted }]}>
        Editor is only available on web for now
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: typography.base,
  },
});
