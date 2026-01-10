/**
 * Editor Screen - TipTap editor (web only)
 *
 * This route renders the full TipTap editor on web platform.
 * On native platforms, shows a placeholder.
 */

import React, { Suspense, lazy } from 'react';
import { Platform, View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTheme, typography } from '@/design-system';
import { useAuthStore } from '@mythos/auth';
import {
  useLayoutStore,
  useCurrentProject,
  useDocuments,
  useProjectStore,
} from '@mythos/state';

// Lazy load editor only on web
const LazyEditorShell = Platform.OS === 'web'
  ? lazy(() => import('@mythos/editor-webview').then(mod => ({ default: mod.EditorShell })))
  : null;

export default function EditorScreen() {
  const { colors } = useTheme();
  const { aiPanelMode, sidebarCollapsed } = useLayoutStore();
  const params = useLocalSearchParams<{ projectId?: string | string[]; documentId?: string | string[] }>();
  const user = useAuthStore((s) => s.user);
  const sessionToken = useAuthStore((s) => s.session?.token ?? undefined);
  const project = useCurrentProject();
  const documents = useDocuments();
  const currentDocumentId = useProjectStore((s) => s.currentDocumentId);

  const queryProjectId =
    typeof params.projectId === 'string' ? params.projectId : params.projectId?.[0];
  const queryDocumentId =
    typeof params.documentId === 'string' ? params.documentId : params.documentId?.[0];

  const activeDocumentId =
    queryDocumentId ?? currentDocumentId ?? documents[0]?.id ?? null;

  const collaborationUser = user
    ? {
        id: user.id,
        name: user.name ?? user.email,
        avatarUrl: user.image ?? undefined,
      }
    : null;

  // Hide quick actions when AI panel is visible (side or floating mode)
  const hideQuickActions = aiPanelMode === 'side' || aiPanelMode === 'floating';
  const collaborationProjectId = queryProjectId ?? project?.id ?? null;

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
            collaboration={
              collaborationProjectId && activeDocumentId && collaborationUser
                ? {
                    projectId: collaborationProjectId,
                    documentId: activeDocumentId,
                    user: collaborationUser,
                    authToken: sessionToken,
                  }
                : undefined
            }
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
